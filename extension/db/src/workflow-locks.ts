import { getDatabase, randomLikeId, DEFAULT_WORKSPACE_ID } from "./database.ts";
import type { WorkflowLockRecord, WorkflowLockResourceType } from "./types.ts";

const LOCK_TTL_MS = 300_000; // 5 minutes

/** Acquire a lock on a resource. Returns lock record on success, null if already locked. */
export function acquireWorkflowLockSync(input: {
  workspaceId?: string;
  resourceType: WorkflowLockResourceType;
  resourceId: string;
  holderId: string;
  ttlMs?: number;
}): WorkflowLockRecord | null {
  const db = getDatabase();
  const workspaceId = input.workspaceId ?? DEFAULT_WORKSPACE_ID;
  const ttlMs = input.ttlMs ?? LOCK_TTL_MS;
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();

  // Clean up expired locks first
  db.prepare("DELETE FROM workflow_lock WHERE resource_type = ? AND resource_id = ? AND expires_at < ?").run(
    input.resourceType, input.resourceId, now,
  );

  // Try to insert — UNIQUE index on (resource_type, resource_id) prevents duplicates
  const id = `wfl-${randomLikeId()}`;
  try {
    db.prepare(
      `INSERT INTO workflow_lock (id, workspace_id, resource_type, resource_id, holder_id, acquired_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, workspaceId, input.resourceType, input.resourceId, input.holderId, now, expiresAt);
    return readWorkflowLockSync(id);
  } catch {
    return null; // Lock already held
  }
}

/** Release a lock held by a specific holder. */
export function releaseWorkflowLockSync(resourceType: string, resourceId: string, holderId: string): boolean {
  const db = getDatabase();
  const result = db.prepare(
    "DELETE FROM workflow_lock WHERE resource_type = ? AND resource_id = ? AND holder_id = ?",
  ).run(resourceType, resourceId, holderId);
  return result.changes > 0;
}

/** Release all locks held by a specific holder. */
export function releaseAllWorkflowLocksForHolderSync(holderId: string): number {
  const db = getDatabase();
  const result = db.prepare("DELETE FROM workflow_lock WHERE holder_id = ?").run(holderId);
  return result.changes;
}

/** Extend lock TTL. */
export function extendWorkflowLockSync(id: string, additionalMs?: number): boolean {
  const db = getDatabase();
  const ttlMs = additionalMs ?? LOCK_TTL_MS;
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  const result = db.prepare("UPDATE workflow_lock SET expires_at = ? WHERE id = ?").run(expiresAt, id);
  return result.changes > 0;
}

export function readWorkflowLockSync(id: string): WorkflowLockRecord | null {
  const db = getDatabase();
  const row = db.prepare("SELECT * FROM workflow_lock WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row["id"] as string,
    workspaceId: row["workspace_id"] as string,
    resourceType: row["resource_type"] as WorkflowLockResourceType,
    resourceId: row["resource_id"] as string,
    holderId: row["holder_id"] as string,
    acquiredAt: row["acquired_at"] as string,
    expiresAt: row["expires_at"] as string,
    metadata: row["metadata"] as string | undefined,
  };
}

export function readWorkflowLockForResourceSync(
  resourceType: string,
  resourceId: string,
): WorkflowLockRecord | null {
  const db = getDatabase();
  const now = new Date().toISOString();
  const row = db.prepare(
    "SELECT * FROM workflow_lock WHERE resource_type = ? AND resource_id = ? AND expires_at > ?",
  ).get(resourceType, resourceId, now) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row["id"] as string,
    workspaceId: row["workspace_id"] as string,
    resourceType: row["resource_type"] as WorkflowLockResourceType,
    resourceId: row["resource_id"] as string,
    holderId: row["holder_id"] as string,
    acquiredAt: row["acquired_at"] as string,
    expiresAt: row["expires_at"] as string,
    metadata: row["metadata"] as string | undefined,
  };
}

/** Clean up all expired locks. Returns number removed. */
export function pruneExpiredWorkflowLocksSync(): number {
  const db = getDatabase();
  const now = new Date().toISOString();
  const result = db.prepare("DELETE FROM workflow_lock WHERE expires_at < ?").run(now);
  return result.changes;
}
