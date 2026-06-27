// ── Git-style multi-agent collaboration workflow ──

export type WorkflowIssueStatus = "open" | "in_progress" | "resolved" | "closed";
export type WorkflowProposalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "merged";
export type WorkflowReviewStatus = "pending" | "commented" | "approved" | "rejected";
export type WorkflowReviewSeverity = "suggestion" | "issue" | "blocker";
export type WorkflowConflictStatus = "detected" | "resolved" | "abandoned";
export type WorkflowLockResourceType = "issue" | "proposal" | "review" | "workspace_state";

/** An issue created by an agent describing work to be done (like a GitHub issue) */
export interface WorkflowIssue {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  status: WorkflowIssueStatus;
  priority: "low" | "medium" | "high" | "critical";
  createdBy: string;
  assignee?: string;
  labels: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** A proposal (PR) submitted by an agent as a solution to an issue */
export interface WorkflowProposal {
  id: string;
  workspaceId: string;
  issueId: string;
  title: string;
  description: string;
  status: WorkflowProposalStatus;
  proposedBy: string;
  reviewers: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** A review submitted by an agent for a proposal */
export interface WorkflowReview {
  id: string;
  workspaceId: string;
  proposalId: string;
  reviewerId: string;
  status: WorkflowReviewStatus;
  summary: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** A comment within a review */
export interface WorkflowReviewComment {
  id: string;
  reviewId: string;
  reviewerId: string;
  content: string;
  lineRef?: string;
  severity: WorkflowReviewSeverity;
  resolved: boolean;
  createdAt: string;
}

/** An async lock record for conflict prevention */
export interface WorkflowLock {
  id: string;
  resourceType: WorkflowLockResourceType;
  resourceId: string;
  holderId: string;
  acquiredAt: string;
  expiresAt: string;
  metadata?: Record<string, unknown>;
}

/** A conflict detected by the state database */
export interface WorkflowConflict {
  id: string;
  workspaceId: string;
  resourceType: WorkflowLockResourceType;
  resourceId: string;
  operationA: string;
  operationB: string;
  stateVersionA: number;
  stateVersionB: number;
  status: WorkflowConflictStatus;
  resolution?: string;
  resolverId?: string;
  detectedAt: string;
  resolvedAt?: string;
}

/** An entry in the synchronous operation queue */
export interface WorkflowQueueEntry {
  id: string;
  workspaceId: string;
  resourceType: WorkflowLockResourceType;
  resourceId: string;
  operation: string;
  payload: string;
  requestedBy: string;
  priority: number;
  status: "queued" | "processing" | "completed" | "failed";
  errorText?: string;
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export function isWorkflowIssueStatus(v: unknown): v is WorkflowIssueStatus {
  return v === "open" || v === "in_progress" || v === "resolved" || v === "closed";
}

export function isWorkflowProposalStatus(v: unknown): v is WorkflowProposalStatus {
  return (
    v === "draft" ||
    v === "submitted" ||
    v === "under_review" ||
    v === "approved" ||
    v === "rejected" ||
    v === "merged"
  );
}
