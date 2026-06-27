import {
  acquireWorkflowLockSync,
  releaseWorkflowLockSync,
  releaseAllWorkflowLocksForHolderSync,
  extendWorkflowLockSync,
  readWorkflowLockForResourceSync,
  pruneExpiredWorkflowLocksSync,
  enqueueWorkflowOperationSync,
  type WorkflowLockResourceType,
} from "@agent-space/db";

export type { WorkflowLockResourceType };

/**
 * Try to acquire an async lock on a resource.
 * If the lock is already held, the operation is queued and null is returned.
 */
export function tryAcquireLock(input: {
  workspaceId?: string;
  resourceType: WorkflowLockResourceType;
  resourceId: string;
  holderId: string;
  onContention?: "queue" | "fail";
  payload?: Record<string, unknown>;
  ttlMs?: number;
}): { acquired: true; lockId: string } | { acquired: false; queued: boolean; queueId?: string } {
  // Prune expired locks before attempting
  pruneExpiredWorkflowLocksSync();

  const lock = acquireWorkflowLockSync({
    workspaceId: input.workspaceId,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    holderId: input.holderId,
    ttlMs: input.ttlMs,
  });

  if (lock) {
    return { acquired: true, lockId: lock.id };
  }

  if (input.onContention === "fail") {
    return { acquired: false, queued: false };
  }

  // Queue the operation for serial execution
  const queueId = enqueueWorkflowOperationSync({
    workspaceId: input.workspaceId,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    operation: "acquire_lock",
    payload: input.payload ?? {},
    requestedBy: input.holderId,
    priority: 5, // lock acquisition is high priority
  });

  return { acquired: false, queued: true, queueId };
}

/** Release a lock held by the given holder. */
export function releaseLock(
  resourceType: string,
  resourceId: string,
  holderId: string,
): boolean {
  return releaseWorkflowLockSync(resourceType, resourceId, holderId);
}

/** Release all locks held by a holder (e.g., when an agent finishes). */
export function releaseAllLocksForHolder(holderId: string): number {
  return releaseAllWorkflowLocksForHolderSync(holderId);
}

/** Extend a lock's TTL to keep it alive during long operations. */
export function extendLock(lockId: string, additionalMs?: number): boolean {
  return extendWorkflowLockSync(lockId, additionalMs);
}

/** Check if a resource is currently locked and by whom. */
export function checkResourceLocked(
  resourceType: string,
  resourceId: string,
): { locked: boolean; holderId?: string; expiresAt?: string } {
  const lock = readWorkflowLockForResourceSync(resourceType, resourceId);
  if (!lock) return { locked: false };
  return { locked: true, holderId: lock.holderId, expiresAt: lock.expiresAt };
}

/**
 * Execute a function with a lock held, automatically releasing after.
 * If lock acquisition fails and onContention is "queue", the operation is enqueued.
 * Returns the result of the function or a queued indicator.
 */
export function withLock<T>(input: {
  workspaceId?: string;
  resourceType: WorkflowLockResourceType;
  resourceId: string;
  holderId: string;
  onContention?: "queue" | "fail";
  ttlMs?: number;
  fn: () => T;
}): { success: true; result: T } | { success: false; queued: boolean; queueId?: string } {
  const lockResult = tryAcquireLock({
    workspaceId: input.workspaceId,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    holderId: input.holderId,
    onContention: input.onContention,
    ttlMs: input.ttlMs,
  });

  if (!lockResult.acquired) {
    return { success: false, queued: lockResult.queued, queueId: lockResult.queueId };
  }

  try {
    const result = input.fn();
    return { success: true, result };
  } finally {
    releaseLock(input.resourceType, input.resourceId, input.holderId);
  }
}
