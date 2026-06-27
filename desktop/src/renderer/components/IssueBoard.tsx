import { useState } from "react";
import type { WorkflowIssue, AgentDefinition } from "../../shared/types";
import AgentTerminal from "./AgentTerminal";

interface Props {
  issues: WorkflowIssue[];
  agents: AgentDefinition[];
  onRefresh: () => void;
}

const COLUMNS = [
  { status: "open", label: "Open", color: "#3fb950" },
  { status: "in_progress", label: "In Progress", color: "#d29922" },
  { status: "resolved", label: "Resolved", color: "#a371f7" },
  { status: "closed", label: "Closed", color: "#8b949e" },
] as const;

export default function IssueBoard({ issues, agents, onRefresh }: Props) {
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
      {/* Kanban Board */}
      <div className="kanban">
        {COLUMNS.map(col => {
          const items = getIssuesForStatus(col.status);
          return (
            <div key={col.status} className="kanban-col">
              <div className="kanban-col-header" style={{ color: col.color }}>
                {col.label} ({items.length})
              </div>
              {items.map(issue => (
                <div
                  key={issue.id}
                  className={`card ${selectedIssue?.id === issue.id ? "selected" : ""}`}
                  onClick={() => setSelectedIssue(selectedIssue?.id === issue.id ? null : issue)}
                >
                  <div className="card-title">{issue.title}</div>
                  <div className="card-meta">
                    <span className={`priority priority-${issue.priority}`}>{issue.priority}</span>
                    {issue.assignee && <span>@{issue.assignee}</span>}
                    {issue.dependsOn.length > 0 && (
                      <span style={{ color: "#d29922" }}>
                        blocked by {issue.dependsOn.length}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <div style={{ fontSize: 12, color: "#484f58", textAlign: "center", padding: 16 }}>
                  No issues
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Issue Detail */}
      {selectedIssue && (
        <div className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 16, marginBottom: 8 }}>{selectedIssue.title}</h3>
              <p style={{ fontSize: 13, color: "#8b949e", marginBottom: 12, whiteSpace: "pre-wrap" }}>
                {selectedIssue.description}
              </p>
              <div className="card-meta" style={{ marginBottom: 8 }}>
                <span className={`priority priority-${selectedIssue.priority}`}>{selectedIssue.priority}</span>
                <span className={`status-tag status-${selectedIssue.status}`}>{selectedIssue.status}</span>
                {selectedIssue.assignee && <span>Assignee: {selectedIssue.assignee}</span>}
                <span>ID: {selectedIssue.id}</span>
              </div>
              {selectedIssue.dependsOn.length > 0 && (
                <div style={{ fontSize: 12, color: "#d29922", marginBottom: 8 }}>
                  Blocked by: {selectedIssue.dependsOn.map(d => {
                    const dep = issues.find(i => i.id === d);
                    return dep ? dep.title : d;
                  }).join(", ")}
                </div>
              )}
              {selectedIssue.blocks.length > 0 && (
                <div style={{ fontSize: 12, color: "#58a6ff", marginBottom: 8 }}>
                  Blocks: {selectedIssue.blocks.map(b => {
                    const blocked = issues.find(i => i.id === b);
                    return blocked ? blocked.title : b;
                  }).join(", ")}
                </div>
              )}
            </div>

            {/* Assign to Agent */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 180 }}>
              <select
                className="input"
                value={selectedAgentId}
                onChange={e => setSelectedAgentId(e.target.value)}
                style={{ fontSize: 12 }}
              >
                <option value="">Select agent...</option>
                {developerAgents.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <button
                className="btn btn-primary btn-xs"
                onClick={() => handleClaimIssue(selectedIssue)}
                disabled={!selectedAgentId || selectedIssue.status !== "open"}
              >
                Assign & Start
              </button>
            </div>
          </div>

          {/* Show agent terminal if issue is in progress */}
          {selectedIssue.assignee && selectedIssue.status === "in_progress" && (
            <AgentTerminal agentId={selectedIssue.assignee} />
          )}
        </div>
      )}
    </div>
  );
}
