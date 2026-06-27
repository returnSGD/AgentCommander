import {
  createWorkflowIssueSync,
  readWorkflowIssueSync,
  listWorkflowIssuesSync,
  updateWorkflowIssueStatusSync,
  updateWorkflowIssueSync,
  deleteWorkflowIssueSync,
  createWorkflowProposalSync,
  readWorkflowProposalSync,
  listWorkflowProposalsSync,
  updateWorkflowProposalStatusSync,
  updateWorkflowProposalReviewersSync,
  createWorkflowReviewSync,
  readWorkflowReviewSync,
  listWorkflowReviewsSync,
  updateWorkflowReviewStatusSync,
  createWorkflowReviewCommentSync,
  listWorkflowReviewCommentsSync,
  resolveWorkflowReviewCommentSync,
  enqueueNativeTaskSync,
} from "@agent-space/db";

import { tryAcquireLock, releaseLock, checkResourceLocked, withLock } from "./async-lock.ts";
import { enqueueOperation, recordConflict, processQueue } from "./conflict-queue.ts";

// ── Re-exports for convenience ──
export { tryAcquireLock, releaseLock, checkResourceLocked, withLock } from "./async-lock.ts";
export {
  enqueueOperation,
  recordConflict,
  listConflicts,
  resolveConflict,
  abandonConflict,
  claimNextOperation,
  completeOperation,
  failOperation,
  listQueue,
  processQueue,
} from "./conflict-queue.ts";

// ── Issue Operations ──

export interface CreateIssueInput {
  workspaceId?: string;
  title: string;
  description: string;
  priority?: "low" | "medium" | "high" | "critical";
  createdBy: string;
  assignee?: string;
  labels?: string[];
  /** If true, also enqueue a native task for the assignee */
  enqueueTask?: boolean;
}

export function createIssue(input: CreateIssueInput) {
  const issue = createWorkflowIssueSync({
    workspaceId: input.workspaceId,
    title: input.title,
    description: input.description,
    priority: input.priority,
    createdBy: input.createdBy,
    assignee: input.assignee,
    labels: input.labels,
  });

  if (issue && input.enqueueTask && input.assignee) {
    enqueueNativeTaskSync({
      workspaceId: input.workspaceId,
      assignee: input.assignee,
      title: `[Issue] ${input.title}`,
      priority: input.priority ?? "medium",
      triggerType: "workflow_issue",
      metadata: { issueId: issue.id, workflowType: "issue" },
    });
  }

  return issue;
}

export function getIssue(issueId: string) {
  return readWorkflowIssueSync(issueId);
}

export function listIssues(workspaceId?: string, status?: string) {
  return listWorkflowIssuesSync(workspaceId, status as Parameters<typeof listWorkflowIssuesSync>[1]);
}

export function updateIssueStatus(
  issueId: string,
  status: Parameters<typeof updateWorkflowIssueStatusSync>[1],
  expectedVersion: number,
) {
  return updateWorkflowIssueStatusSync(issueId, status, expectedVersion);
}

export function updateIssue(
  issueId: string,
  updates: Parameters<typeof updateWorkflowIssueSync>[1],
  expectedVersion: number,
) {
  return updateWorkflowIssueSync(issueId, updates, expectedVersion);
}

export function deleteIssue(issueId: string) {
  return deleteWorkflowIssueSync(issueId);
}

// ── Proposal (PR) Operations ──

export interface CreateProposalInput {
  workspaceId?: string;
  issueId: string;
  title: string;
  description: string;
  proposedBy: string;
  reviewers?: string[];
}

export function createProposal(input: CreateProposalInput) {
  // Lock the issue while creating the proposal
  const lockResult = withLock({
    workspaceId: input.workspaceId,
    resourceType: "issue",
    resourceId: input.issueId,
    holderId: input.proposedBy,
    onContention: "queue",
    fn: () => {
      return createWorkflowProposalSync({
        workspaceId: input.workspaceId,
        issueId: input.issueId,
        title: input.title,
        description: input.description,
        proposedBy: input.proposedBy,
        reviewers: input.reviewers,
      });
    },
  });

  if (!lockResult.success) {
    return { proposal: null, queued: true, queueId: lockResult.queueId };
  }

  const proposal = lockResult.result;

  // If reviewers specified, create review records and enqueue review tasks
  if (proposal && input.reviewers && input.reviewers.length > 0) {
    for (const reviewerId of input.reviewers) {
      createWorkflowReviewSync({
        workspaceId: input.workspaceId,
        proposalId: proposal.id,
        reviewerId,
      });

      enqueueNativeTaskSync({
        workspaceId: input.workspaceId,
        assignee: reviewerId,
        title: `[Review] ${input.title}`,
        priority: "high",
        triggerType: "workflow_review",
        metadata: {
          proposalId: proposal.id,
          issueId: input.issueId,
          workflowType: "review",
        },
      });
    }
  }

  return { proposal, queued: false };
}

export function getProposal(proposalId: string) {
  return readWorkflowProposalSync(proposalId);
}

export function listProposals(workspaceId?: string, issueId?: string) {
  return listWorkflowProposalsSync(workspaceId, issueId);
}

export function updateProposalStatus(
  proposalId: string,
  status: Parameters<typeof updateWorkflowProposalStatusSync>[1],
  expectedVersion: number,
) {
  return updateWorkflowProposalStatusSync(proposalId, status, expectedVersion);
}

// ── Review Operations ──

export interface SubmitReviewInput {
  reviewId: string;
  reviewerId: string;
  status: "approved" | "rejected" | "commented";
  summary: string;
  expectedVersion: number;
}

export function submitReview(input: SubmitReviewInput) {
  // Lock the proposal during review submission
  const review = readWorkflowReviewSync(input.reviewId);
  if (!review) return { success: false, error: "Review not found" };

  const lockResult = withLock({
    resourceType: "proposal",
    resourceId: review.proposalId,
    holderId: input.reviewerId,
    onContention: "queue",
    fn: () => {
      return updateWorkflowReviewStatusSync(
        input.reviewId,
        input.status,
        input.summary,
        input.expectedVersion,
      );
    },
  });

  if (!lockResult.success) {
    return { success: false, queued: true, queueId: lockResult.queueId };
  }

  const result = lockResult.result;

  // Check if all reviews for this proposal are complete
  if (result.record) {
    checkProposalReviewConsensus(result.record.proposalId);
  }

  return { success: !result.conflict, review: result.record, conflict: result.conflict };
}

export function addReviewComment(input: {
  reviewId: string;
  reviewerId: string;
  content: string;
  lineRef?: string;
  severity?: "suggestion" | "issue" | "blocker";
}) {
  return createWorkflowReviewCommentSync(input);
}

export function getReview(reviewId: string) {
  return readWorkflowReviewSync(reviewId);
}

export function listReviews(proposalId?: string) {
  return listWorkflowReviewsSync(proposalId);
}

export function listReviewComments(reviewId: string) {
  return listWorkflowReviewCommentsSync(reviewId);
}

/** Check if all reviews for a proposal are done and update status accordingly. */
function checkProposalReviewConsensus(proposalId: string) {
  const reviews = listWorkflowReviewsSync(proposalId);
  if (reviews.length === 0) return;

  const allReviewed = reviews.every((r) => r.status !== "pending");
  if (!allReviewed) return;

  const anyRejected = reviews.some((r) => r.status === "rejected");
  const allApproved = reviews.every((r) => r.status === "approved");

  if (allApproved) {
    updateWorkflowProposalStatusSync(proposalId, "approved", getLatestProposalVersion(proposalId));
    const proposal = readWorkflowProposalSync(proposalId);
    if (proposal) {
      updateWorkflowIssueStatusSync(proposal.issueId, "resolved", getLatestIssueVersion(proposal.issueId));
    }
  } else if (anyRejected) {
    updateWorkflowProposalStatusSync(proposalId, "rejected", getLatestProposalVersion(proposalId));
  }
}

function getLatestProposalVersion(proposalId: string): number {
  const p = readWorkflowProposalSync(proposalId);
  return p?.version ?? 0;
}

function getLatestIssueVersion(issueId: string): number {
  const i = readWorkflowIssueSync(issueId);
  return i?.version ?? 0;
}

// ── Full Workflow Orchestration ──

/**
 * Execute the full workflow pipeline:
 *   Issue → Proposal → Reviews → Merge/Close
 *
 * This is the high-level orchestration that coordinates all the pieces.
 * Each step uses the lock + queue + version-check pattern to prevent conflicts.
 */
export class WorkflowOrchestrator {
  private workspaceId?: string;

  constructor(workspaceId?: string) {
    this.workspaceId = workspaceId;
  }

  /** Step 1: Agent creates an issue */
  openIssue(input: Omit<CreateIssueInput, "workspaceId">) {
    return createIssue({ ...input, workspaceId: this.workspaceId });
  }

  /** Step 2: Agent submits a proposal (PR) for an issue */
  submitProposal(input: Omit<CreateProposalInput, "workspaceId">) {
    return createProposal({ ...input, workspaceId: this.workspaceId });
  }

  /** Step 3: Agent submits a review for a proposal */
  reviewProposal(input: SubmitReviewInput) {
    return submitReview(input);
  }

  /** Step 4: Merge an approved proposal (close the issue) */
  mergeProposal(proposalId: string, mergedBy: string) {
    const lockResult = withLock({
      workspaceId: this.workspaceId,
      resourceType: "proposal",
      resourceId: proposalId,
      holderId: mergedBy,
      onContention: "queue",
      fn: () => {
        const proposal = readWorkflowProposalSync(proposalId);
        if (!proposal) return { success: false, error: "Proposal not found" };
        if (proposal.status !== "approved") return { success: false, error: "Proposal is not approved" };

        const propResult = updateWorkflowProposalStatusSync(proposalId, "merged", proposal.version);
        if (propResult.conflict) {
          recordConflict({
            workspaceId: this.workspaceId,
            resourceType: "proposal",
            resourceId: proposalId,
            operationA: "merge",
            operationB: "concurrent_update",
            stateVersionA: proposal.version,
            stateVersionB: propResult.record?.version ?? 0,
          });
          return { success: false, error: "Conflict detected", conflict: true };
        }

        updateWorkflowIssueStatusSync(proposal.issueId, "closed", getLatestIssueVersionSync(proposal.issueId));
        return { success: true };
      },
    });

    return lockResult;
  }

  /** Process any queued operations for the workspace. */
  processPendingQueue(executor: (op: Record<string, unknown>) => boolean) {
    return processQueue(this.workspaceId, executor);
  }

  /** Get the full state of an issue with its proposals and reviews. */
  getIssueBoard(issueId: string) {
    const issue = readWorkflowIssueSync(issueId);
    if (!issue) return null;

    const proposals = listWorkflowProposalsSync(this.workspaceId, issueId);
    const reviewsMap: Record<string, ReturnType<typeof listWorkflowReviewsSync>> = {};
    for (const p of proposals) {
      reviewsMap[p.id] = listWorkflowReviewsSync(p.id);
    }

    return { issue, proposals, reviewsMap };
  }
}

function getLatestIssueVersionSync(issueId: string): number {
  const i = readWorkflowIssueSync(issueId);
  return i?.version ?? 0;
}
