import { chatCompletion } from "./api-client";
import {
  createIssue, listIssues, updateIssueStatus,
  createProposal, submitReview, listReviews,
  updateProposalStatus, getProposal,
} from "./state-db";
import { appendAgentOutput, updateAgentStatus } from "./state-db";
import type { TaskDecomposition } from "../shared/types";

/**
 * Decompose a user task into structured issues with dependencies.
 * This is called by the "Planner" agent.
 */
export async function decomposeTask(
  taskTitle: string,
  taskId: string,
  onProgress: (msg: string) => void,
): Promise<TaskDecomposition> {
  onProgress("[Planner] Analyzing task and designing issue breakdown...\n");

  const prompt = `You are a technical project planner. Decompose the following task into a set of issues.

Task: "${taskTitle}"

Output a JSON object with this structure:
{
  "title": "refined task title",
  "issues": [
    {
      "title": "Issue title",
      "description": "Detailed description of what needs to be done",
      "priority": "high|medium|low|critical",
      "dependsOn": [0, 1],  // indices of issues this depends on (empty array if none)
      "suggestedAssignee": "developer|reviewer"  // optional, which role should handle this
    }
  ]
}

Rules:
- Break the task into 3-8 issues
- Issues should be atomic and independently verifiable
- Define dependency relationships carefully (issue 2 depends on issue 1 being done)
- Assign appropriate priorities
- First issues (setup/infrastructure) should have no dependencies
- Output ONLY valid JSON, no markdown or explanation`;

  const response = await chatCompletion(
    [{ role: "user", content: prompt }],
    (token) => onProgress(token),
  );

  onProgress("\n\n[Planner] Parsing decomposition plan...\n");

  // Extract JSON from response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to parse decomposition JSON from planner response");

  const plan: TaskDecomposition = JSON.parse(jsonMatch[0]);
  plan.parentTaskId = taskId;

  onProgress(`[Planner] Created ${plan.issues.length} issues:\n`);
  for (let i = 0; i < plan.issues.length; i++) {
    const iss = plan.issues[i];
    const deps = iss.dependsOn.map((d: number) => plan.issues[d].title).join(", ") || "none";
    onProgress(`  ${i + 1}. [${iss.priority}] ${iss.title} (depends on: ${deps})\n`);
  }

  return plan;
}

/**
 * Execute the decomposition plan: create all issues in the DB.
 */
export function executeDecompositionPlan(plan: TaskDecomposition): string[] {
  const issueIds: string[] = [];

  // First pass: create all issues without dependencies
  const tempIds: string[] = [];
  for (const iss of plan.issues) {
    const created = createIssue({
      title: iss.title,
      description: iss.description,
      priority: iss.priority,
      createdBy: "planner",
      taskId: plan.parentTaskId,
    });
    tempIds.push(created.id);
    issueIds.push(created.id);
  }

  // Second pass: update dependencies using real IDs
  for (let i = 0; i < plan.issues.length; i++) {
    const iss = plan.issues[i];
    if (iss.dependsOn.length > 0) {
      const realDeps = iss.dependsOn.map((d: number) => tempIds[d]);
      // Update the issue with real dependency IDs
      const { default: Database } = require("better-sqlite3");
      // Simple update of depends_on
      const now = new Date().toISOString();
      const db = (global as any).__db;
      if (db) {
        db.prepare("UPDATE issues SET depends_on = ?, updated_at = ? WHERE id = ?")
          .run(JSON.stringify(realDeps), now, tempIds[i]);
        // Update blocks on dependencies
        for (const depId of realDeps) {
          const dep = db.prepare("SELECT blocks FROM issues WHERE id = ?").get(depId) as any;
          if (dep) {
            const blocks = [...JSON.parse(dep.blocks), tempIds[i]];
            db.prepare("UPDATE issues SET blocks = ?, updated_at = ? WHERE id = ?")
              .run(JSON.stringify(blocks), now, depId);
          }
        }
      }
    }
  }

  return issueIds;
}

/**
 * Agent claims an issue and works on it (developer role).
 */
export async function agentWorkOnIssue(
  agentId: string,
  agentName: string,
  issueId: string,
  onProgress: (msg: string) => void,
): Promise<void> {
  updateAgentStatus(agentId, "working", issueId);
  onProgress(`[${agentName}] Claimed issue ${issueId}, starting work...\n`);

  const issue = (await import("./state-db")).getIssue(issueId); // re-import to avoid circular ref
  if (!issue) {
    onProgress(`[${agentName}] Error: Issue not found\n`);
    updateAgentStatus(agentId, "error");
    return;
  }

  const prompt = `You are a software developer agent named "${agentName}".
You are working on the following issue:

Issue: ${issue.title}
Description: ${issue.description}
Priority: ${issue.priority}

Produce a concrete solution (code, configuration, documentation, or design).
Output your solution clearly with explanations. Include specific file paths, code blocks, and implementation details.
When you're done, end with "PROPOSAL_COMPLETE" on a new line.`;

  const solution = await chatCompletion(
    [
      { role: "system", content: "You are a skilled developer. Provide detailed, actionable solutions. Include code blocks with file paths." },
      { role: "user", content: prompt },
    ],
    (token) => onProgress(token),
  );

  // Create a proposal from the solution
  const cleanSolution = solution.replace("PROPOSAL_COMPLETE", "").trim();
  const proposal = createProposal({
    issueId: issue.id,
    title: `Solution for: ${issue.title}`,
    description: cleanSolution,
    proposedBy: agentId,
    reviewers: ["agent-review-1", "agent-review-2"], // default reviewers
  });

  onProgress(`\n[${agentName}] Proposal submitted: ${proposal.id}\n`);
  updateAgentStatus(agentId, "idle");
}

/**
 * Agent reviews a proposal (reviewer role).
 */
export async function agentReviewProposal(
  agentId: string,
  agentName: string,
  proposalId: string,
  onProgress: (msg: string) => void,
): Promise<void> {
  updateAgentStatus(agentId, "working", proposalId);
  onProgress(`[${agentName}] Reviewing proposal ${proposalId}...\n`);

  const proposal = getProposal(proposalId);
  if (!proposal) {
    onProgress(`[${agentName}] Error: Proposal not found\n`);
    updateAgentStatus(agentId, "error");
    return;
  }

  const reviews = listReviews(proposalId);
  const myReview = reviews.find(r => r.reviewerId === agentId);
  if (!myReview) {
    onProgress(`[${agentName}] No review assignment found\n`);
    updateAgentStatus(agentId, "idle");
    return;
  }

  const prompt = `You are a code reviewer agent named "${agentName}".
Review the following proposal:

Proposal: ${proposal.title}
Description: ${proposal.description}

Evaluate the solution on:
1. Correctness - Does it solve the issue?
2. Quality - Is it well-implemented?
3. Security - Are there any security concerns?
4. Completeness - Is anything missing?

Respond with:
- STATUS: APPROVED or STATUS: REJECTED
- A detailed review summary explaining your decision
- If rejected, specify what needs to be fixed`;

  const reviewText = await chatCompletion(
    [
      { role: "system", content: "You are a thorough code reviewer. Be fair but rigorous." },
      { role: "user", content: prompt },
    ],
    (token) => onProgress(token),
  );

  const isApproved = reviewText.includes("STATUS: APPROVED");
  const status = isApproved ? "approved" : "rejected";

  submitReview({
    reviewId: myReview.id,
    status,
    summary: reviewText,
  });

  onProgress(`\n[${agentName}] Review ${status}: ${myReview.id}\n`);
  updateAgentStatus(agentId, "idle");
}

/**
 * Merger agent checks consensus and merges approved proposals.
 */
export async function agentMergeProposals(
  agentId: string,
  agentName: string,
  onProgress: (msg: string) => void,
): Promise<void> {
  updateAgentStatus(agentId, "working");
  onProgress(`[${agentName}] Checking for approved proposals to merge...\n`);

  const proposals = (await import("./state-db")).listProposals();
  const approved = proposals.filter(p => p.status === "approved");

  if (approved.length === 0) {
    onProgress(`[${agentName}] No approved proposals to merge.\n`);
    updateAgentStatus(agentId, "idle");
    return;
  }

  for (const proposal of approved) {
    updateProposalStatus(proposal.id, "merged");
    const issue = (await import("./state-db")).getIssue(proposal.issueId);
    if (issue) {
      updateIssueStatus(issue.id, "closed");
    }
    onProgress(`[${agentName}] Merged proposal ${proposal.id} (issue: ${proposal.issueId})\n`);
  }

  onProgress(`[${agentName}] Merged ${approved.length} proposals.\n`);
  updateAgentStatus(agentId, "idle");
}
