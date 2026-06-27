import Database from "better-sqlite3";
import path from "path";
import { app } from "electron";
import { v4 as uuid } from "uuid";
import type {
  WorkflowIssue, WorkflowProposal, WorkflowReview,
  AgentDefinition, AppSettings,
} from "../shared/types";

let db: Database.Database;

export function initDatabase(): void {
  const dbPath = path.join(app.getPath("userData"), "agent-commander.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS issues (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open',
      priority TEXT NOT NULL DEFAULT 'medium',
      created_by TEXT NOT NULL DEFAULT '',
      assignee TEXT,
      labels TEXT NOT NULL DEFAULT '[]',
      depends_on TEXT NOT NULL DEFAULT '[]',
      blocks TEXT NOT NULL DEFAULT '[]',
      version INTEGER NOT NULL DEFAULT 1,
      task_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS proposals (
      id TEXT PRIMARY KEY,
      issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      proposed_by TEXT NOT NULL,
      reviewers TEXT NOT NULL DEFAULT '[]',
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      proposal_id TEXT NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
      reviewer_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      summary TEXT NOT NULL DEFAULT '',
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'idle',
      current_task TEXT,
      terminal_buffer TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL
    );
  `);

  // Seed default agents if none exist
  const count = db.prepare("SELECT COUNT(*) as c FROM agents").get() as { c: number };
  if (count.c === 0) {
    seedDefaultAgents();
  }
}

function seedDefaultAgents(): void {
  const now = new Date().toISOString();
  const defaults: Omit<AgentDefinition, "terminalBuffer">[] = [
    { id: "agent-planner",  name: "Planner",   role: "planner",    status: "idle", createdAt: now },
    { id: "agent-dev-1",    name: "Dev Alpha",  role: "developer",  status: "idle", createdAt: now },
    { id: "agent-dev-2",    name: "Dev Beta",   role: "developer",  status: "idle", createdAt: now },
    { id: "agent-review-1", name: "Reviewer A", role: "reviewer",   status: "idle", createdAt: now },
    { id: "agent-review-2", name: "Reviewer B", role: "reviewer",   status: "idle", createdAt: now },
    { id: "agent-merger",   name: "Merger",     role: "merger",     status: "idle", createdAt: now },
  ];
  const stmt = db.prepare(
    "INSERT INTO agents (id, name, role, status, terminal_buffer, created_at) VALUES (?, ?, ?, ?, '[]', ?)"
  );
  for (const a of defaults) {
    stmt.run(a.id, a.name, a.role, a.status, a.createdAt);
  }
}

// ── Settings ──

export function getSettings(): AppSettings {
  const defaults: AppSettings = {
    apiUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o",
    maxAgents: 6,
    workDir: app.getPath("userData"),
  };
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'app'").get() as { value: string } | undefined;
    if (row) return { ...defaults, ...JSON.parse(row.value) };
  } catch { /* use defaults */ }
  return defaults;
}

export function saveSettings(settings: AppSettings): void {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES ('app', ?) ON CONFLICT(key) DO UPDATE SET value = ?"
  ).run(JSON.stringify(settings), JSON.stringify(settings));
}

// ── Issues ──

export function createIssue(input: {
  title: string; description: string; priority?: string;
  createdBy?: string; dependsOn?: string[]; taskId?: string;
}): WorkflowIssue {
  const now = new Date().toISOString();
  const issue: WorkflowIssue = {
    id: `iss-${uuid().slice(0, 8)}`,
    title: input.title,
    description: input.description,
    status: "open",
    priority: (input.priority as WorkflowIssue["priority"]) ?? "medium",
    createdBy: input.createdBy ?? "planner",
    labels: [],
    dependsOn: input.dependsOn ?? [],
    blockedBy: input.dependsOn ?? [],
    blocks: [],
    version: 1,
    taskId: input.taskId,
    createdAt: now,
    updatedAt: now,
  };
  db.prepare(
    `INSERT INTO issues (id, title, description, status, priority, created_by, depends_on, blocks, version, task_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`
  ).run(issue.id, issue.title, issue.description, issue.status, issue.priority, issue.createdBy,
    JSON.stringify(issue.dependsOn), JSON.stringify(issue.blocks), issue.taskId ?? null, now, now);

  // Update blocks array on dependency issues
  for (const depId of issue.dependsOn) {
    const dep = getIssue(depId);
    if (dep) {
      const blocks = [...dep.blocks, issue.id];
      db.prepare("UPDATE issues SET blocks = ?, updated_at = ? WHERE id = ?")
        .run(JSON.stringify(blocks), now, depId);
    }
  }
  return issue;
}

export function getIssue(id: string): WorkflowIssue | null {
  const row = db.prepare("SELECT * FROM issues WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? rowToIssue(row) : null;
}

export function listIssues(status?: string): WorkflowIssue[] {
  let rows: Record<string, unknown>[];
  if (status) {
    rows = db.prepare("SELECT * FROM issues WHERE status = ? ORDER BY created_at DESC").all(status) as Record<string, unknown>[];
  } else {
    rows = db.prepare("SELECT * FROM issues ORDER BY created_at DESC").all() as Record<string, unknown>[];
  }
  return rows.map(rowToIssue);
}

export function updateIssueStatus(id: string, status: string, assignee?: string): WorkflowIssue | null {
  const now = new Date().toISOString();
  const sets = ["status = ?", "updated_at = ?", "version = version + 1"];
  const params: unknown[] = [status, now];
  if (assignee !== undefined) { sets.push("assignee = ?"); params.push(assignee); }
  params.push(id);
  db.prepare(`UPDATE issues SET ${sets.join(", ")} WHERE id = ?`).run(...params);
  return getIssue(id);
}

// ── Proposals ──

export function createProposal(input: {
  issueId: string; title: string; description: string;
  proposedBy: string; reviewers?: string[];
}): WorkflowProposal {
  const now = new Date().toISOString();
  const proposal: WorkflowProposal = {
    id: `prp-${uuid().slice(0, 8)}`,
    issueId: input.issueId,
    title: input.title,
    description: input.description,
    status: "submitted",
    proposedBy: input.proposedBy,
    reviewers: input.reviewers ?? [],
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  db.prepare(
    `INSERT INTO proposals (id, issue_id, title, description, status, proposed_by, reviewers, version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  ).run(proposal.id, proposal.issueId, proposal.title, proposal.description,
    proposal.status, proposal.proposedBy, JSON.stringify(proposal.reviewers), now, now);

  // Create review records for each reviewer
  for (const reviewerId of proposal.reviewers) {
    createReview({ proposalId: proposal.id, reviewerId });
  }

  return proposal;
}

export function getProposal(id: string): WorkflowProposal | null {
  const row = db.prepare("SELECT * FROM proposals WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? rowToProposal(row) : null;
}

export function listProposals(issueId?: string): WorkflowProposal[] {
  let rows: Record<string, unknown>[];
  if (issueId) {
    rows = db.prepare("SELECT * FROM proposals WHERE issue_id = ? ORDER BY created_at DESC").all(issueId) as Record<string, unknown>[];
  } else {
    rows = db.prepare("SELECT * FROM proposals ORDER BY created_at DESC").all() as Record<string, unknown>[];
  }
  return rows.map(rowToProposal);
}

export function updateProposalStatus(id: string, status: string): WorkflowProposal | null {
  const now = new Date().toISOString();
  db.prepare(
    "UPDATE proposals SET status = ?, version = version + 1, updated_at = ? WHERE id = ?"
  ).run(status, now, id);
  return getProposal(id);
}

// ── Reviews ──

function createReview(input: { proposalId: string; reviewerId: string }): WorkflowReview {
  const now = new Date().toISOString();
  const review: WorkflowReview = {
    id: `rev-${uuid().slice(0, 8)}`,
    proposalId: input.proposalId,
    reviewerId: input.reviewerId,
    status: "pending",
    summary: "",
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  db.prepare(
    "INSERT INTO reviews (id, proposal_id, reviewer_id, status, summary, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)"
  ).run(review.id, review.proposalId, review.reviewerId, review.status, review.summary, now, now);
  return review;
}

export function submitReview(input: {
  reviewId: string; status: string; summary: string;
}): WorkflowReview | null {
  const now = new Date().toISOString();
  db.prepare(
    "UPDATE reviews SET status = ?, summary = ?, version = version + 1, updated_at = ? WHERE id = ?"
  ).run(input.status, input.summary, now, input.reviewId);

  const review = getReview(input.reviewId);
  if (review) checkProposalConsensus(review.proposalId);
  return review;
}

export function getReview(id: string): WorkflowReview | null {
  const row = db.prepare("SELECT * FROM reviews WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? rowToReview(row) : null;
}

export function listReviews(proposalId?: string): WorkflowReview[] {
  let rows: Record<string, unknown>[];
  if (proposalId) {
    rows = db.prepare("SELECT * FROM reviews WHERE proposal_id = ?").all(proposalId) as Record<string, unknown>[];
  } else {
    rows = db.prepare("SELECT * FROM reviews ORDER BY created_at DESC").all() as Record<string, unknown>[];
  }
  return rows.map(rowToReview);
}

function checkProposalConsensus(proposalId: string): void {
  const reviews = listReviews(proposalId);
  if (reviews.length === 0) return;
  const allDone = reviews.every(r => r.status !== "pending");
  if (!allDone) return;
  const allApproved = reviews.every(r => r.status === "approved");

  if (allApproved) {
    updateProposalStatus(proposalId, "approved");
    const proposal = getProposal(proposalId);
    if (proposal) updateIssueStatus(proposal.issueId, "resolved");
  } else {
    updateProposalStatus(proposalId, "rejected");
  }
}

// ── Agents ──

export function listAgents(): AgentDefinition[] {
  const rows = db.prepare("SELECT * FROM agents ORDER BY created_at ASC").all() as Record<string, unknown>[];
  return rows.map(rowToAgent);
}

export function updateAgentStatus(id: string, status: string, currentTask?: string): void {
  const sets = ["status = ?"];
  const params: unknown[] = [status];
  if (currentTask !== undefined) { sets.push("current_task = ?"); params.push(currentTask); }
  params.push(id);
  db.prepare(`UPDATE agents SET ${sets.join(", ")} WHERE id = ?`).run(...params);
}

export function appendAgentOutput(agentId: string, line: string): void {
  const agent = db.prepare("SELECT terminal_buffer FROM agents WHERE id = ?").get(agentId) as { terminal_buffer: string } | undefined;
  if (!agent) return;
  const buffer: string[] = JSON.parse(agent.terminal_buffer);
  buffer.push(line);
  if (buffer.length > 500) buffer.splice(0, buffer.length - 500); // keep last 500 lines
  db.prepare("UPDATE agents SET terminal_buffer = ? WHERE id = ?").run(JSON.stringify(buffer), agentId);
}

export function getAgentOutput(agentId: string): string[] {
  const row = db.prepare("SELECT terminal_buffer FROM agents WHERE id = ?").get(agentId) as { terminal_buffer: string } | undefined;
  return row ? JSON.parse(row.terminal_buffer) : [];
}

// ── Tasks ──

export function createTask(title: string): { id: string; title: string; status: string; createdAt: string } {
  const now = new Date().toISOString();
  const id = `tsk-${uuid().slice(0, 8)}`;
  db.prepare("INSERT INTO tasks (id, title, status, created_at) VALUES (?, ?, 'pending', ?)").run(id, title, now);
  return { id, title, status: "pending", createdAt: now };
}

// ── Row normalizers ──

function rowToIssue(row: Record<string, unknown>): WorkflowIssue {
  return {
    id: row.id as string, title: row.title as string, description: row.description as string,
    status: row.status as WorkflowIssue["status"], priority: row.priority as WorkflowIssue["priority"],
    createdBy: row.created_by as string, assignee: row.assignee as string | undefined,
    labels: JSON.parse(row.labels as string),
    dependsOn: JSON.parse(row.depends_on as string),
    blockedBy: JSON.parse(row.depends_on as string),
    blocks: JSON.parse(row.blocks as string),
    version: row.version as number,
    taskId: row.task_id as string | undefined,
    createdAt: row.created_at as string, updatedAt: row.updated_at as string,
  };
}

function rowToProposal(row: Record<string, unknown>): WorkflowProposal {
  return {
    id: row.id as string, issueId: row.issue_id as string,
    title: row.title as string, description: row.description as string,
    status: row.status as WorkflowProposal["status"], proposedBy: row.proposed_by as string,
    reviewers: JSON.parse(row.reviewers as string),
    version: row.version as number,
    createdAt: row.created_at as string, updatedAt: row.updated_at as string,
  };
}

function rowToReview(row: Record<string, unknown>): WorkflowReview {
  return {
    id: row.id as string, proposalId: row.proposal_id as string,
    reviewerId: row.reviewer_id as string,
    status: row.status as WorkflowReview["status"], summary: row.summary as string,
    version: row.version as number,
    createdAt: row.created_at as string, updatedAt: row.updated_at as string,
  };
}

function rowToAgent(row: Record<string, unknown>): AgentDefinition {
  return {
    id: row.id as string, name: row.name as string,
    role: row.role as AgentDefinition["role"],
    status: row.status as AgentDefinition["status"],
    currentTask: row.current_task as string | undefined,
    terminalBuffer: JSON.parse(row.terminal_buffer as string),
    createdAt: row.created_at as string,
  };
}
