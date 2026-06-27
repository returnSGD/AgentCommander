import { useState } from "react";
import { useLang } from "../i18n/LanguageContext";
import type { AgentDefinition, WorkflowIssue, WorkflowProposal } from "../../shared/types";
import AgentTerminal from "./AgentTerminal";

interface Props {
  agents: AgentDefinition[];
  issues: WorkflowIssue[];
  proposals: WorkflowProposal[];
  onRefresh: () => void;
}

export default function AgentPool({ agents, issues, proposals, onRefresh }: Props) {
  const { t } = useLang();
  const [selectedAgent, setSelectedAgent] = useState<AgentDefinition | null>(null);
  const [targetId, setTargetId] = useState("");

  const handleStartAgent = async (agent: AgentDefinition) => {
    if (!targetId && agent.role !== "merger") return;
    await window.api.startAgent(agent.id, targetId);
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
      case "planner": return "var(--accent-blue)";
      case "developer": return "var(--accent-green)";
      case "reviewer": return "var(--accent-yellow)";
      case "merger": return "var(--accent-purple)";
      default: return "var(--text-secondary)";
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "idle": return "var(--accent-green)";
      case "working": return "var(--accent-yellow)";
      case "waiting": return "var(--accent-blue)";
      case "error": return "var(--accent-red)";
      default: return "var(--text-secondary)";
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "idle": return t("agent.idle");
      case "working": return t("agent.working");
      case "waiting": return t("agent.waiting");
      case "error": return t("agent.error");
      default: return status;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="panel">
        <h2 className="panel-title">{t("agent.pool")}</h2>
        <div className="grid-3">
          {agents.map(agent => (
            <div
              key={agent.id}
              className={`card ${selectedAgent?.id === agent.id ? "selected" : ""}`}
              onClick={() => { setSelectedAgent(selectedAgent?.id === agent.id ? null : agent); setTargetId(""); }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span className="card-title">{agent.name}</span>
                <span style={{ fontSize: 11, color: statusColor(agent.status) }}>
                  {statusLabel(agent.status)}
                </span>
              </div>
              <div className="card-meta">
                <span style={{ color: roleColor(agent.role) }}>{t(`role.${agent.role}`)}</span>
                {agent.currentTask && <span>Task: {agent.currentTask}</span>}
              </div>
              {agent.status === "working" && (
                <div style={{ marginTop: 6, height: 3, background: "var(--border-primary)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: "60%", background: "var(--accent-yellow)", animation: "pulse 1.5s infinite" }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {selectedAgent && (
        <div className="panel">
          <h3 className="panel-title">{t("agent.control")}: {selectedAgent.name}</h3>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {selectedAgent.role === "developer" && (
              <select className="input" value={targetId} onChange={e => setTargetId(e.target.value)}
                style={{ maxWidth: 300, fontSize: 12 }}>
                <option value="">{t("agent.selectIssue")}</option>
                {openIssues.map(iss => (
                  <option key={iss.id} value={iss.id}>{iss.title}</option>
                ))}
              </select>
            )}
            {selectedAgent.role === "reviewer" && (
              <select className="input" value={targetId} onChange={e => setTargetId(e.target.value)}
                style={{ maxWidth: 300, fontSize: 12 }}>
                <option value="">{t("agent.selectProposal")}</option>
                {pendingReviews.map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            )}
            {selectedAgent.role === "planner" && (
              <input className="input" value={targetId} onChange={e => setTargetId(e.target.value)}
                placeholder={t("agent.plannerHint")} style={{ maxWidth: 300 }} />
            )}
            {selectedAgent.role === "merger" && (
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t("agent.mergerHint")}</span>
            )}

            <button className="btn btn-primary btn-xs"
              onClick={() => handleStartAgent(selectedAgent)}
              disabled={selectedAgent.status === "working" || (selectedAgent.role !== "merger" && !targetId)}>
              {t("agent.start")}
            </button>
            {selectedAgent.status === "working" && (
              <button className="btn btn-danger btn-xs" onClick={() => handleStopAgent(selectedAgent.id)}>
                {t("agent.stop")}
              </button>
            )}
          </div>

          {selectedAgent.status === "working" && (
            <div style={{ marginTop: 12 }}>
              <AgentTerminal agentId={selectedAgent.id} title={`${selectedAgent.name} Output`} />
            </div>
          )}
        </div>
      )}

      {agents.filter(a => a.status === "working").length > 0 && (
        <div className="panel">
          <h2 className="panel-title">
            {t("agent.liveOutput")} ({agents.filter(a => a.status === "working").length} {t("agent.running")})
          </h2>
          <div className="grid-2" style={{ marginTop: 8 }}>
            {agents.filter(a => a.status === "working").map(agent => (
              <AgentTerminal key={agent.id} agentId={agent.id} title={`${agent.name} (${t(`role.${agent.role}`)})`} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
