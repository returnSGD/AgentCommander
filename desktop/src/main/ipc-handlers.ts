import { ipcMain } from "electron";
import {
  initDatabase, getSettings, saveSettings,
  createIssue, listIssues, updateIssueStatus,
  createProposal, listProposals,
  submitReview, listReviews, getProposal,
  listAgents, updateAgentStatus, getAgentOutput, createTask,
} from "./state-db";
import {
  startPlannerAgent, startDeveloperAgent,
  startReviewerAgent, startMergerAgent,
} from "./agent-manager";
import { IPC_CHANNELS } from "../shared/types";

export function registerIpcHandlers(): void {
  initDatabase();

  ipcMain.handle(IPC_CHANNELS.GET_STATE, () => {
    return {
      settings: getSettings(),
      issues: listIssues(),
      proposals: listProposals(),
      reviews: listReviews(),
      agents: listAgents(),
      tasks: [], // will be populated by task list query
    };
  });

  ipcMain.handle(IPC_CHANNELS.SAVE_SETTINGS, (_e, settings) => {
    saveSettings(settings);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.SUBMIT_TASK, async (_e, title: string) => {
    const task = createTask(title);
    // Start planner agent in background
    startPlannerAgent(title, task.id).catch(console.error);
    return task;
  });

  ipcMain.handle(IPC_CHANNELS.CREATE_ISSUE, (_e, input) => {
    return createIssue(input);
  });

  ipcMain.handle(IPC_CHANNELS.CLAIM_ISSUE, async (_e, issueId: string, agentId: string) => {
    const agents = listAgents();
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return { success: false, error: "Agent not found" };

    updateIssueStatus(issueId, "in_progress", agentId);

    if (agent.role === "developer") {
      startDeveloperAgent(agent, issueId).catch(console.error);
    }

    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.SUBMIT_PROPOSAL, (_e, input) => {
    return createProposal(input);
  });

  ipcMain.handle(IPC_CHANNELS.SUBMIT_REVIEW, async (_e, input: {
    reviewId: string; status: string; summary: string; agentId: string;
  }) => {
    const result = submitReview({
      reviewId: input.reviewId,
      status: input.status,
      summary: input.summary,
    });

    // Check if we should auto-merge
    if (result && result.status === "approved") {
      const proposal = getProposal(result.proposalId);
      if (proposal) {
        const reviews = listReviews(proposal.id);
        const allApproved = reviews.every(r => r.status === "approved");
        if (allApproved) {
          startMergerAgent().catch(console.error);
        }
      }
    }

    return result;
  });

  ipcMain.handle(IPC_CHANNELS.MERGE_PROPOSAL, async (_e, proposalId: string) => {
    const { updateProposalStatus, getIssue, listReviews } = await import("./state-db");
    const proposal = getProposal(proposalId);
    if (!proposal) return { success: false, error: "Proposal not found" };
    if (proposal.status !== "approved") return { success: false, error: "Proposal not approved" };

    updateProposalStatus(proposalId, "merged");
    const issue = getIssue(proposal.issueId);
    if (issue) updateIssueStatus(issue.id, "closed");

    startMergerAgent().catch(console.error);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.GET_AGENTS, () => {
    return listAgents();
  });

  ipcMain.handle(IPC_CHANNELS.START_AGENT, async (_e, agentId: string, targetId: string) => {
    const agents = listAgents();
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return { success: false, error: "Agent not found" };

    if (agent.role === "planner") {
      startPlannerAgent(targetId, targetId).catch(console.error);
    } else if (agent.role === "developer") {
      startDeveloperAgent(agent, targetId).catch(console.error);
    } else if (agent.role === "reviewer") {
      startReviewerAgent(agent, targetId).catch(console.error);
    } else if (agent.role === "merger") {
      startMergerAgent().catch(console.error);
    }

    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.STOP_AGENT, (_e, agentId: string) => {
    updateAgentStatus(agentId, "idle");
    return { success: true };
  });
}
