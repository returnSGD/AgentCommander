import { contextBridge, ipcRenderer } from "electron";

// Inlined to avoid cross-module require in Electron's sandboxed preload environment.
// Electron's preloadRequire does not resolve extensionless paths like "../shared/types".
const IPC_CHANNELS = {
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

contextBridge.exposeInMainWorld("api", {
  getState: () => ipcRenderer.invoke(IPC_CHANNELS.GET_STATE),
  saveSettings: (settings: unknown) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_SETTINGS, settings),
  submitTask: (title: string) => ipcRenderer.invoke(IPC_CHANNELS.SUBMIT_TASK, title),
  createIssue: (input: unknown) => ipcRenderer.invoke(IPC_CHANNELS.CREATE_ISSUE, input),
  claimIssue: (issueId: string, agentId: string) => ipcRenderer.invoke(IPC_CHANNELS.CLAIM_ISSUE, issueId, agentId),
  submitProposal: (input: unknown) => ipcRenderer.invoke(IPC_CHANNELS.SUBMIT_PROPOSAL, input),
  submitReview: (input: unknown) => ipcRenderer.invoke(IPC_CHANNELS.SUBMIT_REVIEW, input),
  mergeProposal: (proposalId: string) => ipcRenderer.invoke(IPC_CHANNELS.MERGE_PROPOSAL, proposalId),
  getAgents: () => ipcRenderer.invoke(IPC_CHANNELS.GET_AGENTS),
  startAgent: (agentId: string, targetId: string) => ipcRenderer.invoke(IPC_CHANNELS.START_AGENT, agentId, targetId),
  stopAgent: (agentId: string) => ipcRenderer.invoke(IPC_CHANNELS.STOP_AGENT, agentId),

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
