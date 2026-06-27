import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS, type AppState, type AppSettings,
  type WorkflowIssue, type WorkflowProposal, type WorkflowReview,
  type AgentDefinition } from "../shared/types";

contextBridge.exposeInMainWorld("api", {
  getState: (): Promise<AppState> => ipcRenderer.invoke(IPC_CHANNELS.GET_STATE),
  saveSettings: (settings: AppSettings): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_SETTINGS, settings),
  submitTask: (title: string): Promise<{ id: string; title: string; status: string; createdAt: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.SUBMIT_TASK, title),
  createIssue: (input: Partial<WorkflowIssue>): Promise<WorkflowIssue> =>
    ipcRenderer.invoke(IPC_CHANNELS.CREATE_ISSUE, input),
  claimIssue: (issueId: string, agentId: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.CLAIM_ISSUE, issueId, agentId),
  submitProposal: (input: Partial<WorkflowProposal>): Promise<WorkflowProposal> =>
    ipcRenderer.invoke(IPC_CHANNELS.SUBMIT_PROPOSAL, input),
  submitReview: (input: { reviewId: string; status: string; summary: string; agentId: string }): Promise<WorkflowReview> =>
    ipcRenderer.invoke(IPC_CHANNELS.SUBMIT_REVIEW, input),
  mergeProposal: (proposalId: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.MERGE_PROPOSAL, proposalId),
  getAgents: (): Promise<AgentDefinition[]> => ipcRenderer.invoke(IPC_CHANNELS.GET_AGENTS),
  startAgent: (agentId: string, targetId: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.START_AGENT, agentId, targetId),
  stopAgent: (agentId: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.STOP_AGENT, agentId),

  // Event listeners
  onAgentOutput: (cb: (data: { agentId: string; line: string }) => void) => {
    ipcRenderer.on(IPC_CHANNELS.AGENT_OUTPUT, (_e, data) => cb(data));
  },
  onAgentStatusChange: (cb: (data: { agentId: string; status: string }) => void) => {
    ipcRenderer.on(IPC_CHANNELS.AGENT_STATUS_CHANGE, (_e, data) => cb(data));
  },
  onStateChanged: (cb: () => void) => {
    ipcRenderer.on("app:state-changed", () => cb());
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
});
