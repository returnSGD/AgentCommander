import { getDatabase, randomLikeId, DEFAULT_WORKSPACE_ID } from "./database.ts";
import type {
  WorkflowReviewRecord,
  WorkflowReviewStatus,
  WorkflowReviewCommentRecord,
} from "./types.ts";

// ── Reviews ──

export function createWorkflowReviewSync(input: {
  workspaceId?: string;
  proposalId: string;
  reviewerId: string;
}): WorkflowReviewRecord | null {
  const db = getDatabase();
  const workspaceId = input.workspaceId ?? DEFAULT_WORKSPACE_ID;
  const id = `wfr-${randomLikeId()}`;
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO workflow_review (id, workspace_id, proposal_id, reviewer_id, status, summary, version, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'pending', '', 1, ?, ?)`,
  ).run(id, workspaceId, input.proposalId, input.reviewerId, now, now);

  return readWorkflowReviewSync(id);
}

export function readWorkflowReviewSync(id: string): WorkflowReviewRecord | null {
  const db = getDatabase();
  const row = db.prepare("SELECT * FROM workflow_review WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return normalizeReviewRow(row);
}

export function listWorkflowReviewsSync(proposalId?: string): WorkflowReviewRecord[] {
  const db = getDatabase();
  let rows: Record<string, unknown>[];
  if (proposalId) {
    rows = db.prepare("SELECT * FROM workflow_review WHERE proposal_id = ? ORDER BY created_at DESC").all(proposalId) as Record<string, unknown>[];
  } else {
    rows = db.prepare("SELECT * FROM workflow_review ORDER BY created_at DESC").all() as Record<string, unknown>[];
  }
  return rows.map(normalizeReviewRow);
}

export function updateWorkflowReviewStatusSync(
  id: string,
  status: WorkflowReviewStatus,
  summary: string,
  expectedVersion: number,
): { record: WorkflowReviewRecord | null; conflict: boolean } {
  const db = getDatabase();
  const now = new Date().toISOString();
  const result = db.prepare(
    `UPDATE workflow_review SET status = ?, summary = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?`,
  ).run(status, summary, now, id, expectedVersion);

  if (result.changes === 0) {
    return { record: readWorkflowReviewSync(id), conflict: true };
  }
  return { record: readWorkflowReviewSync(id), conflict: false };
}

// ── Review Comments ──

export function createWorkflowReviewCommentSync(input: {
  reviewId: string;
  reviewerId: string;
  content: string;
  lineRef?: string;
  severity?: "suggestion" | "issue" | "blocker";
}): WorkflowReviewCommentRecord | null {
  const db = getDatabase();
  const id = `wfrc-${randomLikeId()}`;
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO workflow_review_comment (id, review_id, reviewer_id, content, line_ref, severity, resolved, created_at)
     VALUES (?, ?, ?, ?, ?, ?, FALSE, ?)`,
  ).run(id, input.reviewId, input.reviewerId, input.content, input.lineRef ?? null, input.severity ?? "suggestion", now);

  return readWorkflowReviewCommentSync(id);
}

export function readWorkflowReviewCommentSync(id: string): WorkflowReviewCommentRecord | null {
  const db = getDatabase();
  const row = db.prepare("SELECT * FROM workflow_review_comment WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return normalizeCommentRow(row);
}

export function listWorkflowReviewCommentsSync(reviewId: string): WorkflowReviewCommentRecord[] {
  const db = getDatabase();
  const rows = db.prepare("SELECT * FROM workflow_review_comment WHERE review_id = ? ORDER BY created_at ASC").all(reviewId) as Record<string, unknown>[];
  return rows.map(normalizeCommentRow);
}

export function resolveWorkflowReviewCommentSync(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare("UPDATE workflow_review_comment SET resolved = TRUE WHERE id = ?").run(id);
  return result.changes > 0;
}

// ── Normalizers ──

function normalizeReviewRow(row: Record<string, unknown>): WorkflowReviewRecord {
  return {
    id: row["id"] as string,
    workspaceId: row["workspace_id"] as string,
    proposalId: row["proposal_id"] as string,
    reviewerId: row["reviewer_id"] as string,
    status: row["status"] as WorkflowReviewStatus,
    summary: row["summary"] as string,
    version: row["version"] as number,
    createdAt: row["created_at"] as string,
    updatedAt: row["updated_at"] as string,
  };
}

function normalizeCommentRow(row: Record<string, unknown>): WorkflowReviewCommentRecord {
  return {
    id: row["id"] as string,
    reviewId: row["review_id"] as string,
    reviewerId: row["reviewer_id"] as string,
    content: row["content"] as string,
    lineRef: row["line_ref"] as string | undefined,
    severity: row["severity"] as string,
    resolved: Boolean(row["resolved"]),
    createdAt: row["created_at"] as string,
  };
}
