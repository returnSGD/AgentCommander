import { useEffect, useRef, useState } from "react";

interface Props {
  agentId: string;
  title?: string;
}

export default function AgentTerminal({ agentId, title }: Props) {
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
        <span>{title || `Agent: ${agentId}`}</span>
        <span style={{ fontSize: 10, color: "#484f58" }}>{lines.length} lines</span>
      </div>
      <div className="terminal-content" ref={containerRef}>
        {lines.length === 0 ? (
          <span style={{ color: "#484f58" }}>Waiting for output...</span>
        ) : (
          lines.map((line, i) => (
            <div key={i} style={{ color: line.startsWith("[") ? "#58a6ff" : line.includes("Error") ? "#f85149" : "#c9d1d9" }}>
              {line}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
