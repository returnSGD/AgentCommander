import { useState } from "react";
import type { AgentDefinition, WorkflowIssue, WorkflowProposal } from "../../shared/types";
import AgentTerminal from "./AgentTerminal";

interface Props {
  agents: AgentDefinition[];
  issues: WorkflowIssue[];
  proposals: WorkflowProposal[];
  onRefresh: () => void;
}

export default function AgentPool({ agents, issues, proposals, onRefresh }: Props) {
  const [selectedAgent, setSelectedAgent] = useState<AgentDefinition | null>(null);
  const [targetId, setTargetId] = useState("");

  const handleStartAgent = async (agent: AgentDefinition) => {
    if (!targetId) return;

    if (agent.role === "developer") {
      await window.api.startAgent(agent.id, targetId);
    } else if (agent.role === "reviewer") {
      await window.api.startAgent(agent.id, targetId);
    } else if (agent.role === "planner" || agent.role === "merger") {
      await window.api.startAgent(agent.id, targetId);
    }
    onRefresh();
  };

  const handleStopAgent = async (agentId: string) => {
    await window.api.stopAgent(agentId);
    onRefresh();
  };

  const openIssues = issues.filter(i => i.status === "open");
  const pendingReviews = proposals.filter(p => p.status === "submitted" || p.status === "under_review");

  const roleColor = (role: string) => {
    switch (role) {
      case "planner": return "#58a6ff";
      case "developer": return "#3fb950";
      case "reviewer": return "#d29922";
      case "merger": return "#a371f7";
      default: return "#8b949e";
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "idle": return "#3fb950";
      case "working": return "#d29922";
      case "waiting": return "#58a6ff";
      case "error": return "#f85149";
      default: return "#8b949e";
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Agent Grid */}
      <div className="panel">
        <h2 className="panel-title">Agent Pool</h2>
        <div className="grid-3">
          {agents.map(agent => (
            <div
              key={agent.id}
              className={`card ${selectedAgent?.id === agent.id ? "selected" : ""}`}
              onClick={() => {
                setSelectedAgent(selectedAgent?.id === agent.id ? null : agent);
                setTargetId("");
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span className="card-title">{agent.name}</span>
                <span style={{ fontSize: 11, color: statusColor(agent.status) }}>
                  {agent.status}
                </span>
              </div>
              <div className="card-meta">
                <span style={{ color: roleColor(agent.role) }}>{agent.role}</span>
                {agent.currentTask && <span>Task: {agent.currentTask}</span>}
              </div>
              {agent.status === "working" && (
                <div style={{ marginTop: 6, height: 3, background: "#30363d", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: "60%", background: "#d29922", animation: "pulse 1.5s infinite" }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Agent Control */}
      {selectedAgent && (
        <div className="panel">
          <h3 className="panel-title">Control: {selectedAgent.name}</h3>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {(selectedAgent.role === "developer") && (
              <select
                className="input"
                value={targetId}
                onChange={e => setTargetId(e.target.value)}
                style={{ maxWidth: 300, fontSize: 12 }}
              >
                <option value="">Select an issue...</option>
                {openIssues.map(iss => (
                  <option key={iss.id} value={iss.id}>{iss.title}</option>
                ))}
              </select>
            )}
            {(selectedAgent.role === "reviewer") && (
              <select
                className="input"
                value={targetId}
                onChange={e => setTargetId(e.target.value)}
                style={{ maxWidth: 300, fontSize: 12 }}
              >
                <option value="">Select a proposal...</option>
                {pendingReviews.map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            )}
            {(selectedAgent.role === "planner") && (
              <input className="input" value={targetId} onChange={e => setTargetId(e.target.value)}
                placeholder="Task title to plan..." style={{ maxWidth: 300 }} />
            )}
            {selectedAgent.role === "merger" && (
              <span style={{ fontSize: 12, color: "#8b949e" }}>Merger auto-merges all approved proposals</span>
            )}

            <button
              className="btn btn-primary btn-xs"
              onClick={() => handleStartAgent(selectedAgent)}
              disabled={selectedAgent.status === "working" || (selectedAgent.role !== "merger" && !targetId)}
            >
              Start Agent
            </button>
            {selectedAgent.status === "working" && (
              <button className="btn btn-danger btn-xs" onClick={() => handleStopAgent(selectedAgent.id)}>
                Stop
              </button>
            )}
          </div>

          {/* Agent Terminal */}
          {selectedAgent.status === "working" && (
            <div style={{ marginTop: 12 }}>
              <AgentTerminal agentId={selectedAgent.id} title={`${selectedAgent.name} Output`} />
            </div>
          )}
        </div>
      )}

      {/* All Running Terminals */}
      {agents.filter(a => a.status === "working").length > 0 && (
        <div className="panel">
          <h2 className="panel-title">Live Output ({agents.filter(a => a.status === "working").length} running)</h2>
          <div className="grid-2" style={{ marginTop: 8 }}>
            {agents.filter(a => a.status === "working").map(agent => (
              <AgentTerminal key={agent.id} agentId={agent.id} title={`${agent.name} (${agent.role})`} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
