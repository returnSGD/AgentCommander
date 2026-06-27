import { useState } from "react";
import { useLang } from "../i18n/LanguageContext";
import type { WorkflowIssue, AgentDefinition } from "../../shared/types";
import AgentTerminal from "./AgentTerminal";

interface Props {
  issues: WorkflowIssue[];
  agents: AgentDefinition[];
  onRefresh: () => void;
}

const STATUS_KEYS = [
  { status: "open", labelKey: "issue.open", colorVar: "--accent-green" },
  { status: "in_progress", labelKey: "issue.inProgress", colorVar: "--accent-yellow" },
  { status: "resolved", labelKey: "issue.resolved", colorVar: "--accent-purple" },
  { status: "closed", labelKey: "issue.closed", colorVar: "--text-secondary" },
] as const;

export default function IssueBoard({ issues, agents, onRefresh }: Props) {
  const { t } = useLang();
  const [selectedIssue, setSelectedIssue] = useState<WorkflowIssue | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");

  const getIssuesForStatus = (status: string) =>
    issues.filter(i => i.status === status);

  const handleClaimIssue = async (issue: WorkflowIssue) => {
    if (!selectedAgentId) return;
    await window.api.claimIssue(issue.id, selectedAgentId);
    onRefresh();
  };

  const developerAgents = agents.filter(a => a.role === "developer" && a.status === "idle");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="kanban">
        {STATUS_KEYS.map(col => {
          const items = getIssuesForStatus(col.status);
          return (
            <div key={col.status} className="kanban-col">
              <div className="kanban-col-header" style={{ color: `var(${col.colorVar})` }}>
                {t(col.labelKey)} ({items.length})
              </div>
              {items.map(issue => (
                <div
                  key={issue.id}
                  className={`card ${selectedIssue?.id === issue.id ? "selected" : ""}`}
                  onClick={() => setSelectedIssue(selectedIssue?.id === issue.id ? null : issue)}
                >
                  <div className="card-title">{issue.title}</div>
                  <div className="card-meta">
                    <span className={`priority priority-${issue.priority}`}>{t(`priority.${issue.priority}`)}</span>
                    {issue.assignee && <span>@{issue.assignee}</span>}
                    {issue.dependsOn.length > 0 && (
                      <span style={{ color: "var(--accent-yellow)" }}>
                        {t("issue.blockedBy")} {issue.dependsOn.length}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: 16 }}>
                  {t("issue.noIssues")}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedIssue && (
        <div className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 16, marginBottom: 8, color: "var(--text-heading)" }}>{selectedIssue.title}</h3>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12, whiteSpace: "pre-wrap" }}>
                {selectedIssue.description}
              </p>
              <div className="card-meta" style={{ marginBottom: 8 }}>
                <span className={`priority priority-${selectedIssue.priority}`}>{t(`priority.${selectedIssue.priority}`)}</span>
                <span className={`status-tag status-${selectedIssue.status}`}>{t(`status.${selectedIssue.status}`)}</span>
                {selectedIssue.assignee && <span>{t("issue.assignee")}: {selectedIssue.assignee}</span>}
                <span>ID: {selectedIssue.id}</span>
              </div>
              {selectedIssue.dependsOn.length > 0 && (
                <div style={{ fontSize: 12, color: "var(--accent-yellow)", marginBottom: 8 }}>
                  {t("issue.blockedBy")}: {selectedIssue.dependsOn.map(d => {
                    const dep = issues.find(i => i.id === d);
                    return dep ? dep.title : d;
                  }).join(", ")}
                </div>
              )}
              {selectedIssue.blocks.length > 0 && (
                <div style={{ fontSize: 12, color: "var(--accent-blue)", marginBottom: 8 }}>
                  {t("issue.blocks")}: {selectedIssue.blocks.map(b => {
                    const blocked = issues.find(i => i.id === b);
                    return blocked ? blocked.title : b;
                  }).join(", ")}
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 180 }}>
              <select
                className="input"
                value={selectedAgentId}
                onChange={e => setSelectedAgentId(e.target.value)}
                style={{ fontSize: 12 }}
              >
                <option value="">{t("issue.selectAgent")}</option>
                {developerAgents.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <button
                className="btn btn-primary btn-xs"
                onClick={() => handleClaimIssue(selectedIssue)}
                disabled={!selectedAgentId || selectedIssue.status !== "open"}
              >
                {t("issue.assignAndStart")}
              </button>
            </div>
          </div>

          {selectedIssue.assignee && selectedIssue.status === "in_progress" && (
            <AgentTerminal agentId={selectedIssue.assignee} />
          )}
        </div>
      )}
    </div>
  );
}
