import { getSettings } from "./state-db";

interface ChatMessage { role: "system" | "user" | "assistant"; content: string; }

export async function chatCompletion(messages: ChatMessage[], onToken?: (token: string) => void): Promise<string> {
  const settings = getSettings();
  if (!settings.apiKey) throw new Error("API key not configured");

  const isAnthropic = settings.apiUrl.includes("anthropic.com");

  if (isAnthropic) {
    return anthropicChat(settings, messages, onToken);
  }
  return openaiChat(settings, messages, onToken);
}

async function openaiChat(
  settings: ReturnType<typeof getSettings>,
  messages: ChatMessage[],
  onToken?: (token: string) => void,
): Promise<string> {
  const url = settings.apiUrl.replace(/\/+$/, "") + "/chat/completions";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      stream: !!onToken,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }

  if (onToken && res.body) {
    return readOpenAIStream(res.body, onToken);
  }

  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message?.content ?? "";
}

async function readOpenAIStream(body: ReadableStream<Uint8Array>, onToken: (t: string) => void): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n").filter(l => l.startsWith("data: "));
    for (const line of lines) {
      const data = line.slice(6);
      if (data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data);
        const token = parsed.choices?.[0]?.delta?.content;
        if (token) { full += token; onToken(token); }
      } catch { /* skip malformed */ }
    }
  }
  return full;
}

async function anthropicChat(
  settings: ReturnType<typeof getSettings>,
  messages: ChatMessage[],
  onToken?: (token: string) => void,
): Promise<string> {
  const url = settings.apiUrl.replace(/\/+$/, "") + "/messages";

  // Extract system message
  const systemMsg = messages.find(m => m.role === "system");
  const chatMessages = messages.filter(m => m.role !== "system").map(m => ({
    role: m.role,
    content: m.content,
  }));

  const body: Record<string, unknown> = {
    model: settings.model,
    max_tokens: 8192,
    messages: chatMessages,
    stream: !!onToken,
  };
  if (systemMsg) body.system = systemMsg.content;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": settings.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }

  if (onToken && res.body) {
    return readAnthropicStream(res.body, onToken);
  }

  const data = await res.json() as { content: { type: string; text: string }[] };
  return data.content.find(c => c.type === "text")?.text ?? "";
}

async function readAnthropicStream(body: ReadableStream<Uint8Array>, onToken: (t: string) => void): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n").filter(l => l.startsWith("data: "));
    for (const line of lines) {
      const data = line.slice(6);
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === "content_block_delta") {
          const token = parsed.delta?.text;
          if (token) { full += token; onToken(token); }
        }
      } catch { /* skip */ }
    }
  }
  return full;
}
