import { getDatabase, randomLikeId, DEFAULT_WORKSPACE_ID } from "./database.ts";
import type {
  WorkflowConflictRecord,
  WorkflowConflictStatus,
  WorkflowLockResourceType,
} from "./types.ts";

export function createWorkflowConflictSync(input: {
  workspaceId?: string;
  resourceType: WorkflowLockResourceType;
  resourceId: string;
  operationA: string;
  operationB: string;
  stateVersionA: number;
  stateVersionB: number;
}): WorkflowConflictRecord {
  const db = getDatabase();
  const workspaceId = input.workspaceId ?? DEFAULT_WORKSPACE_ID;
  const id = `wfc-${randomLikeId()}`;
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO workflow_conflict (id, workspace_id, resource_type, resource_id, operation_a, operation_b, state_version_a, state_version_b, status, detected_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'detected', ?)`,
  ).run(id, workspaceId, input.resourceType, input.resourceId, input.operationA, input.operationB, input.stateVersionA, input.stateVersionB, now);

  return readWorkflowConflictSync(id)!;
}

export function readWorkflowConflictSync(id: string): WorkflowConflictRecord | null {
  const db = getDatabase();
  const row = db.prepare("SELECT * FROM workflow_conflict WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return normalizeConflictRow(row);
}

export function listWorkflowConflictsSync(
  workspaceId?: string,
  status?: WorkflowConflictStatus,
): WorkflowConflictRecord[] {
  const db = getDatabase();
  const wsId = workspaceId ?? DEFAULT_WORKSPACE_ID;
  let rows: Record<string, unknown>[];
  if (status) {
    rows = db.prepare(
      "SELECT * FROM workflow_conflict WHERE workspace_id = ? AND status = ? ORDER BY detected_at DESC",
    ).all(wsId, status) as Record<string, unknown>[];
  } else {
    rows = db.prepare(
      "SELECT * FROM workflow_conflict WHERE workspace_id = ? ORDER BY detected_at DESC",
    ).all(wsId) as Record<string, unknown>[];
  }
  return rows.map(normalizeConflictRow);
}

export function resolveWorkflowConflictSync(
  id: string,
  resolution: string,
  resolverId: string,
): WorkflowConflictRecord | null {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE workflow_conflict SET status = 'resolved', resolution = ?, resolver_id = ?, resolved_at = ? WHERE id = ?`,
  ).run(resolution, resolverId, now, id);
  return readWorkflowConflictSync(id);
}

export function abandonWorkflowConflictSync(id: string): boolean {
  const db = getDatabase();
  const now = new Date().toISOString();
  const result = db.prepare(
    "UPDATE workflow_conflict SET status = 'abandoned', resolved_at = ? WHERE id = ?",
  ).run(now, id);
  return result.changes > 0;
}

// ── Operation Queue ──

export function enqueueWorkflowOperationSync(input: {
  workspaceId?: string;
  resourceType: WorkflowLockResourceType;
  resourceId: string;
  operation: string;
  payload?: Record<string, unknown>;
  requestedBy: string;
  priority?: number;
}): string {
  const db = getDatabase();
  const workspaceId = input.workspaceId ?? DEFAULT_WORKSPACE_ID;
  const id = `wfq-${randomLikeId()}`;
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO workflow_operation_queue (id, workspace_id, resource_type, resource_id, operation, payload, requested_by, priority, status, queued_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?)`,
  ).run(id, workspaceId, input.resourceType, input.resourceId, input.operation, JSON.stringify(input.payload ?? {}), input.requestedBy, input.priority ?? 1, now);

  return id;
}

export function claimNextQueuedOperationSync(workspaceId?: string): Record<string, unknown> | null {
  const db = getDatabase();
  const wsId = workspaceId ?? DEFAULT_WORKSPACE_ID;
  const now = new Date().toISOString();

  const row = db.prepare(
    `SELECT * FROM workflow_operation_queue
     WHERE workspace_id = ? AND status = 'queued'
     ORDER BY priority DESC, queued_at ASC
     LIMIT 1`,
  ).get(wsId) as Record<string, unknown> | undefined;

  if (!row) return null;

  db.prepare(
    `UPDATE workflow_operation_queue SET status = 'processing', started_at = ? WHERE id = ?`,
  ).run(now, row["id"]);

  return row;
}

export function completeQueuedOperationSync(queueId: string): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE workflow_operation_queue SET status = 'completed', completed_at = ? WHERE id = ?`,
  ).run(now, queueId);
}

export function failQueuedOperationSync(queueId: string, errorText: string): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE workflow_operation_queue SET status = 'failed', error_text = ?, completed_at = ? WHERE id = ?`,
  ).run(errorText, now, queueId);
}

export function listQueuedOperationsSync(
  workspaceId?: string,
  status?: string,
): Record<string, unknown>[] {
  const db = getDatabase();
  const wsId = workspaceId ?? DEFAULT_WORKSPACE_ID;
  if (status) {
    return db.prepare(
      "SELECT * FROM workflow_operation_queue WHERE workspace_id = ? AND status = ? ORDER BY priority DESC, queued_at ASC",
    ).all(wsId, status) as Record<string, unknown>[];
  }
  return db.prepare(
    "SELECT * FROM workflow_operation_queue WHERE workspace_id = ? ORDER BY priority DESC, queued_at ASC",
  ).all(wsId) as Record<string, unknown>[];
}

function normalizeConflictRow(row: Record<string, unknown>): WorkflowConflictRecord {
  return {
    id: row["id"] as string,
    workspaceId: row["workspace_id"] as string,
    resourceType: row["resource_type"] as WorkflowLockResourceType,
    resourceId: row["resource_id"] as string,
    operationA: row["operation_a"] as string,
    operationB: row["operation_b"] as string,
    stateVersionA: row["state_version_a"] as number,
    stateVersionB: row["state_version_b"] as number,
    status: row["status"] as WorkflowConflictStatus,
    resolution: row["resolution"] as string | undefined,
    resolverId: row["resolver_id"] as string | undefined,
    detectedAt: row["detected_at"] as string,
    resolvedAt: row["resolved_at"] as string | undefined,
  };
}
