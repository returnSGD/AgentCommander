import { useEffect, useRef, useState } from "react";
import { useLang } from "../i18n/LanguageContext";

interface Props {
  agentId: string;
  title?: string;
}

export default function AgentTerminal({ agentId, title }: Props) {
  const { t } = useLang();
  const [lines, setLines] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.api.onAgentOutput((data) => {
      if (data.agentId === agentId) {
        setLines(prev => {
          const next = [...prev, data.line];
          return next.length > 500 ? next.slice(next.length - 500) : next;
        });
      }
    });
    return () => { window.api.removeAllListeners("agent:output"); };
  }, [agentId]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div className="terminal-container" style={{ marginTop: title ? 0 : 12 }}>
      <div className="terminal-header">
        <span>{title || `${t("agent.pool")}: ${agentId}`}</span>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{lines.length} lines</span>
      </div>
      <div className="terminal-content" ref={containerRef}>
        {lines.length === 0 ? (
          <span style={{ color: "var(--text-muted)" }}>{t("agent.waitingOutput")}</span>
        ) : (
          lines.map((line, i) => (
            <div key={i} style={{ color: line.startsWith("[") ? "var(--accent-blue)" : line.includes("Error") ? "var(--accent-red)" : "var(--text-primary)" }}>
              {line}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
