import type { AppState, AppSettings, WorkflowIssue, WorkflowProposal, WorkflowReview, AgentDefinition } from "../shared/types";

interface AgentCommanderAPI {
  getState(): Promise<AppState>;
  saveSettings(settings: AppSettings): Promise<{ success: boolean }>;
  submitTask(title: string): Promise<{ id: string; title: string; status: string; createdAt: string }>;
  createIssue(input: Partial<WorkflowIssue>): Promise<WorkflowIssue>;
  claimIssue(issueId: string, agentId: string): Promise<{ success: boolean; error?: string }>;
  submitProposal(input: Partial<WorkflowProposal>): Promise<WorkflowProposal>;
  submitReview(input: { reviewId: string; status: string; summary: string; agentId: string }): Promise<WorkflowReview>;
  mergeProposal(proposalId: string): Promise<{ success: boolean; error?: string }>;
  getAgents(): Promise<AgentDefinition[]>;
  startAgent(agentId: string, targetId: string): Promise<{ success: boolean; error?: string }>;
  stopAgent(agentId: string): Promise<{ success: boolean }>;
  onAgentOutput(cb: (data: { agentId: string; line: string }) => void): void;
  onAgentStatusChange(cb: (data: { agentId: string; status: string }) => void): void;
  onStateChanged(cb: () => void): void;
  removeAllListeners(channel: string): void;
}

declare global {
  interface Window {
    api: AgentCommanderAPI;
  }
}
