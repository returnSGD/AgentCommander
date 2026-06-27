// ── Shared types between main & renderer process ──

export interface AppSettings {
  apiUrl: string;
  apiKey: string;
  model: string;
  maxAgents: number;
  workDir: string;
}

export type IssueStatus = "open" | "in_progress" | "resolved" | "closed";
export type ProposalStatus = "draft" | "submitted" | "under_review" | "approved" | "rejected" | "merged";
export type ReviewStatus = "pending" | "commented" | "approved" | "rejected";
export type AgentRole = "planner" | "developer" | "reviewer" | "merger";
export type AgentStatus = "idle" | "working" | "waiting" | "error";

export interface WorkflowIssue {
  id: string;
  title: string;
  description: string;
  status: IssueStatus;
  priority: "low" | "medium" | "high" | "critical";
  createdBy: string;
  assignee?: string;
  labels: string[];
  dependsOn: string[];    // IDs of issues this depends on (blocked by)
  blockedBy: string[];    // alias for dependsOn
  blocks: string[];       // IDs of issues this blocks
  version: number;
  taskId?: string;        // parent task ID
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowProposal {
  id: string;
  issueId: string;
  title: string;
  description: string;
  status: ProposalStatus;
  proposedBy: string;
  reviewers: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowReview {
  id: string;
  proposalId: string;
  reviewerId: string;
  status: ReviewStatus;
  summary: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface AgentDefinition {
  id: string;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  currentTask?: string;
  terminalBuffer: string[];
  createdAt: string;
}

export interface TaskDecomposition {
  parentTaskId: string;
  title: string;
  issues: {
    title: string;
    description: string;
    priority: "low" | "medium" | "high" | "critical";
    dependsOn: number[]; // indices of issues this depends on
    suggestedAssignee?: string;
  }[];
}

export interface AppState {
  settings: AppSettings;
  issues: WorkflowIssue[];
  proposals: WorkflowProposal[];
  reviews: WorkflowReview[];
  agents: AgentDefinition[];
  tasks: { id: string; title: string; status: string; createdAt: string }[];
}

// IPC channel names
export const IPC_CHANNELS = {
  GET_STATE: "app:get-state",
  SAVE_SETTINGS: "app:save-settings",
  SUBMIT_TASK: "app:submit-task",
  DECOMPOSE_TASK: "app:decompose-task",
  CREATE_ISSUE: "app:create-issue",
  CLAIM_ISSUE: "app:claim-issue",
  SUBMIT_PROPOSAL: "app:submit-proposal",
  SUBMIT_REVIEW: "app:submit-review",
  MERGE_PROPOSAL: "app:merge-proposal",
  GET_AGENTS: "app:get-agents",
  AGENT_OUTPUT: "agent:output",
  AGENT_STATUS_CHANGE: "agent:status-change",
  START_AGENT: "app:start-agent",
  STOP_AGENT: "app:stop-agent",
} as const;
