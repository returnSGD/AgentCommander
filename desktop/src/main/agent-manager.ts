import { BrowserWindow } from "electron";
import { listAgents, updateAgentStatus, appendAgentOutput } from "./state-db";
import {
  decomposeTask, executeDecompositionPlan,
  agentWorkOnIssue, agentReviewProposal, agentMergeProposals,
} from "./workflow-engine";
import type { AgentDefinition } from "../shared/types";

let mainWindow: BrowserWindow | null = null;

export function setMainWindow(win: BrowserWindow): void {
  mainWindow = win;
}

function sendToRenderer(channel: string, data: unknown): void {
  mainWindow?.webContents.send(channel, data);
}

function agentLog(agentId: string, msg: string): void {
  appendAgentOutput(agentId, msg);
  sendToRenderer("agent:output", { agentId, line: msg });
}

/** Start the Planner agent to decompose a task */
export async function startPlannerAgent(taskTitle: string, taskId: string): Promise<void> {
  const planner = listAgents().find(a => a.role === "planner");
  if (!planner) return;

  updateAgentStatus(planner.id, "working");
  sendToRenderer("agent:status-change", { agentId: planner.id, status: "working" });

  const onProgress = (msg: string) => agentLog(planner.id, msg);

  try {
    const plan = await decomposeTask(taskTitle, taskId, onProgress);
    const issueIds = executeDecompositionPlan(plan);
    agentLog(planner.id, `\n[Planner] Created ${issueIds.length} issues successfully.\n`);
    updateAgentStatus(planner.id, "idle");
    sendToRenderer("agent:status-change", { agentId: planner.id, status: "idle" });
    sendToRenderer("app:state-changed", {});
  } catch (err) {
    agentLog(planner.id, `\n[Planner] Error: ${err instanceof Error ? err.message : String(err)}\n`);
    updateAgentStatus(planner.id, "error");
    sendToRenderer("agent:status-change", { agentId: planner.id, status: "error" });
  }
}

/** Start a Developer agent on an issue */
export async function startDeveloperAgent(agent: AgentDefinition, issueId: string): Promise<void> {
  updateAgentStatus(agent.id, "working", issueId);
  sendToRenderer("agent:status-change", { agentId: agent.id, status: "working" });

  const onProgress = (msg: string) => agentLog(agent.id, msg);

  try {
    await agentWorkOnIssue(agent.id, agent.name, issueId, onProgress);
    sendToRenderer("agent:status-change", { agentId: agent.id, status: "idle" });
    sendToRenderer("app:state-changed", {});
  } catch (err) {
    agentLog(agent.id, `\n[${agent.name}] Error: ${err instanceof Error ? err.message : String(err)}\n`);
    updateAgentStatus(agent.id, "error");
    sendToRenderer("agent:status-change", { agentId: agent.id, status: "error" });
  }
}

/** Start a Reviewer agent on a proposal */
export async function startReviewerAgent(agent: AgentDefinition, proposalId: string): Promise<void> {
  updateAgentStatus(agent.id, "working", proposalId);
  sendToRenderer("agent:status-change", { agentId: agent.id, status: "working" });

  const onProgress = (msg: string) => agentLog(agent.id, msg);

  try {
    await agentReviewProposal(agent.id, agent.name, proposalId, onProgress);
    sendToRenderer("agent:status-change", { agentId: agent.id, status: "idle" });
    sendToRenderer("app:state-changed", {});
  } catch (err) {
    agentLog(agent.id, `\n[${agent.name}] Error: ${err instanceof Error ? err.message : String(err)}\n`);
    updateAgentStatus(agent.id, "error");
    sendToRenderer("agent:status-change", { agentId: agent.id, status: "error" });
  }
}

/** Start the Merger agent to merge approved proposals */
export async function startMergerAgent(): Promise<void> {
  const merger = listAgents().find(a => a.role === "merger");
  if (!merger) return;

  updateAgentStatus(merger.id, "working");
  sendToRenderer("agent:status-change", { agentId: merger.id, status: "working" });

  const onProgress = (msg: string) => agentLog(merger.id, msg);

  try {
    await agentMergeProposals(merger.id, merger.name, onProgress);
    sendToRenderer("agent:status-change", { agentId: merger.id, status: "idle" });
    sendToRenderer("app:state-changed", {});
  } catch (err) {
    agentLog(merger.id, `\n[${merger.name}] Error: ${err instanceof Error ? err.message : String(err)}\n`);
    updateAgentStatus(merger.id, "error");
    sendToRenderer("agent:status-change", { agentId: merger.id, status: "error" });
  }
}
