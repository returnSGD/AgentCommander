import { getDatabase, randomLikeId, DEFAULT_WORKSPACE_ID } from "./database.ts";
import type { WorkflowIssueRecord, WorkflowIssueStatus } from "./types.ts";

export function createWorkflowIssueSync(input: {
  workspaceId?: string;
  title: string;
  description: string;
  priority?: "low" | "medium" | "high" | "critical";
  createdBy: string;
  assignee?: string;
  labels?: string[];
}): WorkflowIssueRecord | null {
  const db = getDatabase();
  const workspaceId = input.workspaceId ?? DEFAULT_WORKSPACE_ID;
  const id = `wfi-${randomLikeId()}`;
  const now = new Date().toISOString();
  const labels = JSON.stringify(input.labels ?? []);

  db.prepare(
    `INSERT INTO workflow_issue (id, workspace_id, title, description, status, priority, created_by, assignee, labels, version, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, 1, ?, ?)`,
  ).run(id, workspaceId, input.title, input.description, input.priority ?? "medium", input.createdBy, input.assignee ?? null, labels, now, now);

  return readWorkflowIssueSync(id);
}

export function readWorkflowIssueSync(id: string): WorkflowIssueRecord | null {
  const db = getDatabase();
  const row = db.prepare("SELECT * FROM workflow_issue WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return normalizeWorkflowIssueRow(row);
}

export function listWorkflowIssuesSync(workspaceId?: string, status?: WorkflowIssueStatus): WorkflowIssueRecord[] {
  const db = getDatabase();
  const wsId = workspaceId ?? DEFAULT_WORKSPACE_ID;
  let rows: Record<string, unknown>[];
  if (status) {
    rows = db.prepare("SELECT * FROM workflow_issue WHERE workspace_id = ? AND status = ? ORDER BY created_at DESC").all(wsId, status) as Record<string, unknown>[];
  } else {
    rows = db.prepare("SELECT * FROM workflow_issue WHERE workspace_id = ? ORDER BY created_at DESC").all(wsId) as Record<string, unknown>[];
  }
  return rows.map(normalizeWorkflowIssueRow);
}

export function updateWorkflowIssueStatusSync(
  id: string,
  status: WorkflowIssueStatus,
  expectedVersion: number,
): { record: WorkflowIssueRecord | null; conflict: boolean } {
  const db = getDatabase();
  const now = new Date().toISOString();
  const result = db.prepare(
    `UPDATE workflow_issue SET status = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?`,
  ).run(status, now, id, expectedVersion);

  if (result.changes === 0) {
    return { record: readWorkflowIssueSync(id), conflict: true };
  }
  return { record: readWorkflowIssueSync(id), conflict: false };
}

export function updateWorkflowIssueSync(
  id: string,
  updates: { title?: string; description?: string; priority?: string; assignee?: string | null; labels?: string[] },
  expectedVersion: number,
): { record: WorkflowIssueRecord | null; conflict: boolean } {
  const db = getDatabase();
  const now = new Date().toISOString();
  const sets: string[] = ["version = version + 1", "updated_at = ?"];
  const params: unknown[] = [now];

  if (updates.title !== undefined) { sets.push("title = ?"); params.push(updates.title); }
  if (updates.description !== undefined) { sets.push("description = ?"); params.push(updates.description); }
  if (updates.priority !== undefined) { sets.push("priority = ?"); params.push(updates.priority); }
  if (updates.assignee !== undefined) { sets.push("assignee = ?"); params.push(updates.assignee); }
  if (updates.labels !== undefined) { sets.push("labels = ?"); params.push(JSON.stringify(updates.labels)); }

  params.push(id, expectedVersion);
  const result = db.prepare(`UPDATE workflow_issue SET ${sets.join(", ")} WHERE id = ? AND version = ?`).run(...params);

  if (result.changes === 0) {
    return { record: readWorkflowIssueSync(id), conflict: true };
  }
  return { record: readWorkflowIssueSync(id), conflict: false };
}

export function deleteWorkflowIssueSync(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare("DELETE FROM workflow_issue WHERE id = ?").run(id);
  return result.changes > 0;
}

function normalizeWorkflowIssueRow(row: Record<string, unknown>): WorkflowIssueRecord {
  return {
    id: row["id"] as string,
    workspaceId: row["workspace_id"] as string,
    title: row["title"] as string,
    description: row["description"] as string,
    status: row["status"] as WorkflowIssueStatus,
    priority: row["priority"] as WorkflowIssueRecord["priority"],
    createdBy: row["created_by"] as string,
    assignee: row["assignee"] as string | undefined,
    labels: row["labels"] as string,
    version: row["version"] as number,
    createdAt: row["created_at"] as string,
    updatedAt: row["updated_at"] as string,
  };
}
