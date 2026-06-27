import {
  createWorkflowConflictSync,
  listWorkflowConflictsSync,
  resolveWorkflowConflictSync,
  abandonWorkflowConflictSync,
  claimNextQueuedOperationSync,
  completeQueuedOperationSync,
  failQueuedOperationSync,
  listQueuedOperationsSync,
  enqueueWorkflowOperationSync,
  pruneExpiredWorkflowLocksSync,
  acquireWorkflowLockSync,
  releaseWorkflowLockSync,
  type WorkflowConflictStatus,
  type WorkflowLockResourceType,
} from "@agent-space/db";

export type { WorkflowConflictStatus, WorkflowLockResourceType };

/**
 * Synchronous FIFO queue for serializing operations on the same resource.
 *
 * When two agents attempt to modify the same resource simultaneously:
 * 1. The first agent acquires the lock and proceeds
 * 2. The second agent's operation is enqueued
 * 3. When the first completes, the queue processor picks up the next operation
 *
 * This ensures deterministic, conflict-free execution order.
 */

export interface QueueOperation {
  resourceType: WorkflowLockResourceType;
  resourceId: string;
  operation: string;
  payload: Record<string, unknown>;
  requestedBy: string;
  priority?: number;
}

/** Enqueue an operation for serial execution on a resource. */
export function enqueueOperation(input: QueueOperation & { workspaceId?: string }): string {
  return enqueueWorkflowOperationSync({
    workspaceId: input.workspaceId,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    operation: input.operation,
    payload: input.payload,
    requestedBy: input.requestedBy,
    priority: input.priority,
  });
}

/** Record a version conflict between two operations. */
export function recordConflict(input: {
  workspaceId?: string;
  resourceType: WorkflowLockResourceType;
  resourceId: string;
  operationA: string;
  operationB: string;
  stateVersionA: number;
  stateVersionB: number;
}): string {
  const conflict = createWorkflowConflictSync(input);
  return conflict.id;
}

/** List conflicts for a workspace, optionally filtered by status. */
export function listConflicts(workspaceId?: string, status?: WorkflowConflictStatus) {
  return listWorkflowConflictsSync(workspaceId, status);
}

/** Resolve a conflict with a specific resolution strategy. */
export function resolveConflict(
  conflictId: string,
  resolution: string,
  resolverId: string,
) {
  return resolveWorkflowConflictSync(conflictId, resolution, resolverId);
}

/** Abandon a conflict (e.g., one operation is no longer relevant). */
export function abandonConflict(conflictId: string): boolean {
  return abandonWorkflowConflictSync(conflictId);
}

/**
 * Process the next queued operation for a workspace.
 *
 * This is the core of the sync queue: it claims the highest-priority queued
 * operation, attempts to acquire its lock, and returns the operation details
 * so the caller can execute it. The caller must call completeOperation or
 * failOperation after execution.
 */
export function claimNextOperation(workspaceId?: string): {
  operation: Record<string, unknown>;
} | null {
  // Clean up stale locks first
  pruneExpiredWorkflowLocksSync();

  const row = claimNextQueuedOperationSync(workspaceId);
  if (!row) return null;
  return { operation: row };
}

/** Mark a queued operation as completed. */
export function completeOperation(queueId: string): void {
  completeQueuedOperationSync(queueId);
}

/** Mark a queued operation as failed. */
export function failOperation(queueId: string, errorText: string): void {
  failQueuedOperationSync(queueId, errorText);
}

/** List all queued operations. */
export function listQueue(workspaceId?: string, status?: string) {
  return listQueuedOperationsSync(workspaceId, status);
}

/**
 * Process the full queue for a workspace sequentially.
 * Each operation is executed with lock acquisition before and release after.
 *
 * @param workspaceId - The workspace to process
 * @param executor - Function that executes a single operation. Receives the
 *   operation record and must return whether it succeeded.
 * @returns Summary of processed operations.
 */
export function processQueue(
  workspaceId: string | undefined,
  executor: (operation: Record<string, unknown>) => boolean,
): { processed: number; succeeded: number; failed: number } {
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  // Process up to 100 operations per run to prevent infinite loops
  const maxBatch = 100;

  for (let i = 0; i < maxBatch; i++) {
    const claimed = claimNextOperation(workspaceId);
    if (!claimed) break;

    processed++;

    try {
      const op = claimed.operation;
      const resourceType = op["resource_type"] as string;
      const resourceId = op["resource_id"] as string;
      const requestedBy = op["requested_by"] as string;
      const queueId = op["id"] as string;

      // Attempt lock acquisition
      const lock = acquireWorkflowLockSync({
        resourceType: resourceType as WorkflowLockResourceType,
        resourceId,
        holderId: requestedBy,
        workspaceId,
      });

      if (!lock) {
        // Still contended — re-queue with lower priority
        failOperation(queueId, "Resource still locked");
        enqueueWorkflowOperationSync({
          workspaceId,
          resourceType: resourceType as WorkflowLockResourceType,
          resourceId,
          operation: op["operation"] as string,
          payload: JSON.parse((op["payload"] as string) || "{}"),
          requestedBy,
          priority: Math.max(0, ((op["priority"] as number) ?? 1) - 1),
        });
        failed++;
        continue;
      }

      const success = executor(claimed.operation);

      if (success) {
        completeOperation(queueId);
        succeeded++;
      } else {
        failOperation(queueId, "Executor returned failure");
        failed++;
      }

      // Release the lock
      releaseWorkflowLockSync(resourceType, resourceId, requestedBy);
    } catch (err) {
      failed++;
      const queueId = claimed.operation["id"] as string;
      failOperation(queueId, err instanceof Error ? err.message : String(err));
    }
  }

  return { processed, succeeded, failed };
}
