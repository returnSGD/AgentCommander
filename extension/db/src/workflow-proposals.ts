import { getDatabase, randomLikeId, DEFAULT_WORKSPACE_ID } from "./database.ts";
import type { WorkflowProposalRecord, WorkflowProposalStatus } from "./types.ts";

export function createWorkflowProposalSync(input: {
  workspaceId?: string;
  issueId: string;
  title: string;
  description: string;
  proposedBy: string;
  reviewers?: string[];
}): WorkflowProposalRecord | null {
  const db = getDatabase();
  const workspaceId = input.workspaceId ?? DEFAULT_WORKSPACE_ID;
  const id = `wfp-${randomLikeId()}`;
  const now = new Date().toISOString();
  const reviewers = JSON.stringify(input.reviewers ?? []);

  db.prepare(
    `INSERT INTO workflow_proposal (id, workspace_id, issue_id, title, description, status, proposed_by, reviewers, version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'submitted', ?, ?, 1, ?, ?)`,
  ).run(id, workspaceId, input.issueId, input.title, input.description, input.proposedBy, reviewers, now, now);

  return readWorkflowProposalSync(id);
}

export function readWorkflowProposalSync(id: string): WorkflowProposalRecord | null {
  const db = getDatabase();
  const row = db.prepare("SELECT * FROM workflow_proposal WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return normalizeProposalRow(row);
}

export function listWorkflowProposalsSync(workspaceId?: string, issueId?: string): WorkflowProposalRecord[] {
  const db = getDatabase();
  const wsId = workspaceId ?? DEFAULT_WORKSPACE_ID;
  let rows: Record<string, unknown>[];
  if (issueId) {
    rows = db.prepare("SELECT * FROM workflow_proposal WHERE workspace_id = ? AND issue_id = ? ORDER BY created_at DESC").all(wsId, issueId) as Record<string, unknown>[];
  } else {
    rows = db.prepare("SELECT * FROM workflow_proposal WHERE workspace_id = ? ORDER BY created_at DESC").all(wsId) as Record<string, unknown>[];
  }
  return rows.map(normalizeProposalRow);
}

export function updateWorkflowProposalStatusSync(
  id: string,
  status: WorkflowProposalStatus,
  expectedVersion: number,
): { record: WorkflowProposalRecord | null; conflict: boolean } {
  const db = getDatabase();
  const now = new Date().toISOString();
  const result = db.prepare(
    `UPDATE workflow_proposal SET status = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?`,
  ).run(status, now, id, expectedVersion);

  if (result.changes === 0) {
    return { record: readWorkflowProposalSync(id), conflict: true };
  }
  return { record: readWorkflowProposalSync(id), conflict: false };
}

export function updateWorkflowProposalReviewersSync(
  id: string,
  reviewers: string[],
  expectedVersion: number,
): { record: WorkflowProposalRecord | null; conflict: boolean } {
  const db = getDatabase();
  const now = new Date().toISOString();
  const result = db.prepare(
    `UPDATE workflow_proposal SET reviewers = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?`,
  ).run(JSON.stringify(reviewers), now, id, expectedVersion);

  if (result.changes === 0) {
    return { record: readWorkflowProposalSync(id), conflict: true };
  }
  return { record: readWorkflowProposalSync(id), conflict: false };
}

export function deleteWorkflowProposalSync(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare("DELETE FROM workflow_proposal WHERE id = ?").run(id);
  return result.changes > 0;
}

function normalizeProposalRow(row: Record<string, unknown>): WorkflowProposalRecord {
  return {
    id: row["id"] as string,
    workspaceId: row["workspace_id"] as string,
    issueId: row["issue_id"] as string,
    title: row["title"] as string,
    description: row["description"] as string,
    status: row["status"] as WorkflowProposalStatus,
    proposedBy: row["proposed_by"] as string,
    reviewers: row["reviewers"] as string,
    version: row["version"] as number,
    createdAt: row["created_at"] as string,
    updatedAt: row["updated_at"] as string,
  };
}
