export type Lang = "zh-CN" | "en";

// All UI strings live here so components stay clean.
const zh: Record<string, string> = {
  // App shell
  "app.title": "AgentCommander",
  "app.subtitle": "GIT-STYLE MULTI-AGENT WORKFLOW",
  "app.connected": "已连接",
  "app.disconnected": "API 未配置",
  "app.loading": "正在启动 AgentCommander...",
  "app.loadError": "加载失败，请重启应用。",
  "app.helpTip": "打开教程",

  // Sidebar
  "tab.issues": "任务看板",
  "tab.reviews": "审核中心",
  "tab.agents": "智能体池",
  "tab.settings": "设置",

  // TaskInput
  "task.title": "新建任务",
  "task.hint": "描述你想要构建的内容。Planner 智能体会将其分解为带依赖关系的 Issue。",
  "task.placeholder": "例如：构建一个带身份认证的用户管理 REST API",
  "task.submit": "提交任务",
  "task.decomposing": "分解中...",

  // IssueBoard
  "issue.kanban": "任务看板",
  "issue.open": "待处理",
  "issue.inProgress": "进行中",
  "issue.resolved": "已解决",
  "issue.closed": "已关闭",
  "issue.noIssues": "暂无 Issue",
  "issue.blockedBy": "被阻塞于",
  "issue.blocks": "阻塞",
  "issue.assignee": "负责人",
  "issue.selectAgent": "选择智能体...",
  "issue.assignAndStart": "分配并启动",
  "issue.detail": "详情",

  // ReviewPanel
  "review.title": "提案",
  "review.pending": "待审核",
  "review.noProposals": "暂无提案，请先提交任务。",
  "review.approved": "已通过",
  "review.rejected": "已拒绝",
  "review.pendingCount": "个待审核",
  "review.by": "由",
  "review.noReviewers": "无审核员",
  "review.merge": "合并",
  "review.quickReview": "AI 快速审核：",
  "review.manualHint": "或手动通过/拒绝",
  "review.reviews": "审核意见",

  // AgentPool
  "agent.pool": "智能体池",
  "agent.control": "控制",
  "agent.selectIssue": "选择 Issue...",
  "agent.selectProposal": "选择提案...",
  "agent.plannerHint": "输入要规划的任务标题...",
  "agent.mergerHint": "Merger 会自动合并所有已通过的提案",
  "agent.start": "启动智能体",
  "agent.stop": "停止",
  "agent.running": "运行中",
  "agent.idle": "空闲",
  "agent.working": "工作中",
  "agent.waiting": "等待中",
  "agent.error": "错误",
  "agent.liveOutput": "实时输出",
  "agent.waitingOutput": "等待输出...",

  // Settings
  "settings.title": "API 设置",
  "settings.apiUrl": "API 基础 URL",
  "settings.apiKey": "API 密钥",
  "settings.model": "模型",
  "settings.maxAgents": "最大并发智能体数",
  "settings.save": "保存设置",
  "settings.saving": "保存中...",
  "settings.saved": "设置保存成功。",
  "settings.supportedApis": "支持的 API：",
  "settings.apiNote": "OpenAI 兼容",

  // Roles
  "role.planner": "Planner",
  "role.developer": "Developer",
  "role.reviewer": "Reviewer",
  "role.merger": "Merger",

  // Status labels
  "status.draft": "草稿",
  "status.submitted": "已提交",
  "status.under_review": "审核中",
  "status.approved": "已通过",
  "status.rejected": "已拒绝",
  "status.merged": "已合并",
  "status.pending": "待处理",

  // Priority
  "priority.critical": "紧急",
  "priority.high": "高",
  "priority.medium": "中",
  "priority.low": "低",

  // Tutorial
  "tutorial.welcome.title": "欢迎使用 AgentCommander",
  "tutorial.welcome.desc": "一个 Git 风格的多智能体协作工作流。AI 智能体像真实的开发团队一样协作——Planner 分解任务，Developer 编写方案，Reviewer 审查工作，Merger 合并已通过的变更。\n\n本教程将通过 6 个步骤带你了解应用的关键功能。",
  "tutorial.step1.title": "1. 配置 API 设置",
  "tutorial.step1.desc": "在开始之前，请前往设置页面输入你的 API 凭证。支持 OpenAI、Anthropic 以及任何 OpenAI 兼容接口（Ollama、vLLM 等）。",
  "tutorial.step2.title": "2. 提交任务",
  "tutorial.step2.desc": "在顶部的任务输入框中描述你想要构建的内容。Planner 智能体会分析任务并将其分解为带有依赖关系的结构化 Issue。",
  "tutorial.step3.title": "3. 看板 Issue 面板",
  "tutorial.step3.desc": "Issue 流经四个列：待处理 → 进行中 → 已解决 → 已关闭。点击任意 Issue 可查看详情、依赖关系，并将其分配给可用的 Developer 智能体。",
  "tutorial.step4.title": "4. 智能体池",
  "tutorial.step4.desc": "六个预配置的 AI 智能体分别担任不同角色。选择一个智能体来启动/停止它、分配任务，并实时查看其终端输出。智能体并发运行以最大化吞吐量。",
  "tutorial.step5.title": "5. 审核与合并",
  "tutorial.step5.desc": "当 Developer 完成一个任务后，会创建一个提案。Reviewer 检查方案的正确性、质量和安全性。当两位 Reviewer 都通过后，Merger 会自动合并变更。",
  "tutorial.step6.title": "准备就绪！",
  "tutorial.step6.desc": "一切就绪。首先在设置中配置你的 API 密钥，然后提交一个任务来体验完整的多智能体工作流。随时点击标题栏中的 ? 按钮重新查看本教程。",
  "tutorial.skip": "跳过教程",
  "tutorial.back": "上一步",
  "tutorial.next": "下一步",
  "tutorial.done": "开始使用",

  // Language & Theme
  "lang.switch": "Switch to English",
  "theme.switchLight": "切换浅色主题",
  "theme.switchDark": "切换深色主题",
};

const en: Record<string, string> = {
  "app.title": "AgentCommander",
  "app.subtitle": "GIT-STYLE MULTI-AGENT WORKFLOW",
  "app.connected": "Connected",
  "app.disconnected": "API not configured",
  "app.loading": "Starting AgentCommander...",
  "app.loadError": "Failed to load. Please restart.",
  "app.helpTip": "Open tutorial",

  "tab.issues": "Issue Board",
  "tab.reviews": "Reviews",
  "tab.agents": "Agent Pool",
  "tab.settings": "Settings",

  "task.title": "New Task",
  "task.hint": "Describe what you want to build. The Planner agent will decompose it into issues with dependencies.",
  "task.placeholder": "e.g. Build a REST API for user management with authentication",
  "task.submit": "Submit Task",
  "task.decomposing": "Decomposing...",

  "issue.kanban": "Issue Board",
  "issue.open": "Open",
  "issue.inProgress": "In Progress",
  "issue.resolved": "Resolved",
  "issue.closed": "Closed",
  "issue.noIssues": "No issues",
  "issue.blockedBy": "Blocked by",
  "issue.blocks": "Blocks",
  "issue.assignee": "Assignee",
  "issue.selectAgent": "Select agent...",
  "issue.assignAndStart": "Assign & Start",
  "issue.detail": "Detail",

  "review.title": "Proposals",
  "review.pending": "pending review",
  "review.noProposals": "No proposals yet. Submit a task to get started.",
  "review.approved": "approved",
  "review.rejected": "rejected",
  "review.pendingCount": "pending",
  "review.by": "by",
  "review.noReviewers": "No reviewers",
  "review.merge": "Merge",
  "review.quickReview": "Quick AI review:",
  "review.manualHint": "or approve/reject manually",
  "review.reviews": "Reviews",

  "agent.pool": "Agent Pool",
  "agent.control": "Control",
  "agent.selectIssue": "Select an issue...",
  "agent.selectProposal": "Select a proposal...",
  "agent.plannerHint": "Task title to plan...",
  "agent.mergerHint": "Merger auto-merges all approved proposals",
  "agent.start": "Start Agent",
  "agent.stop": "Stop",
  "agent.running": "running",
  "agent.idle": "idle",
  "agent.working": "working",
  "agent.waiting": "waiting",
  "agent.error": "error",
  "agent.liveOutput": "Live Output",
  "agent.waitingOutput": "Waiting for output...",

  "settings.title": "API Settings",
  "settings.apiUrl": "API Base URL",
  "settings.apiKey": "API Key",
  "settings.model": "Model",
  "settings.maxAgents": "Max Concurrent Agents",
  "settings.save": "Save Settings",
  "settings.saving": "Saving...",
  "settings.saved": "Settings saved successfully.",
  "settings.supportedApis": "Supported APIs:",
  "settings.apiNote": "OpenAI-compatible",

  "role.planner": "Planner",
  "role.developer": "Developer",
  "role.reviewer": "Reviewer",
  "role.merger": "Merger",

  "status.draft": "Draft",
  "status.submitted": "Submitted",
  "status.under_review": "Under Review",
  "status.approved": "Approved",
  "status.rejected": "Rejected",
  "status.merged": "Merged",
  "status.pending": "Pending",

  "priority.critical": "Critical",
  "priority.high": "High",
  "priority.medium": "Medium",
  "priority.low": "Low",

  "tutorial.welcome.title": "Welcome to AgentCommander",
  "tutorial.welcome.desc": "A Git-style multi-agent collaboration workflow. AI agents work together like a real dev team — a Planner decomposes tasks, Developers write solutions, Reviewers check the work, and a Merger integrates approved changes.\n\nThis tutorial will walk you through the key parts of the app in 6 quick steps.",
  "tutorial.step1.title": "1. Configure API Settings",
  "tutorial.step1.desc": "Before starting, head to Settings to enter your API credentials. Supports OpenAI, Anthropic, and any OpenAI-compatible endpoint (Ollama, vLLM, etc.).",
  "tutorial.step2.title": "2. Submit a Task",
  "tutorial.step2.desc": "Describe what you want to build in the task input at the top. The Planner agent will analyze it and decompose it into structured issues with dependency relationships.",
  "tutorial.step3.title": "3. Kanban Issue Board",
  "tutorial.step3.desc": "Issues flow through four columns: Open → In Progress → Resolved → Closed. Click any issue to see its details, dependencies, and to assign it to an available developer agent.",
  "tutorial.step4.title": "4. Agent Pool",
  "tutorial.step4.desc": "Six pre-configured AI agents serve different roles. Select an agent to start/stop it, assign tasks, and watch its terminal output in real time. Agents run concurrently to maximize throughput.",
  "tutorial.step5.title": "5. Review & Merge",
  "tutorial.step5.desc": "When a developer finishes a task, a proposal is created. Reviewers check the solution for correctness, quality, and security. Once both reviewers approve, the Merger automatically integrates the change.",
  "tutorial.step6.title": "Ready to Go!",
  "tutorial.step6.desc": "You're all set. Start by configuring your API key in Settings, then submit a task to see the full multi-agent workflow in action. Use the ? button in the header to revisit this tutorial at any time.",
  "tutorial.skip": "Skip tutorial",
  "tutorial.back": "Back",
  "tutorial.next": "Next",
  "tutorial.done": "Get Started",

  "lang.switch": "切换到中文",
  "theme.switchLight": "Switch to Light",
  "theme.switchDark": "Switch to Dark",
};

const dictionaries = { "zh-CN": zh, en };

export function getLang(): Lang {
  try {
    const v = localStorage.getItem("agentcommander_lang");
    if (v === "en") return "en";
  } catch { /* noop */ }
  return "zh-CN";
}

export function setLang(lang: Lang): void {
  try {
    localStorage.setItem("agentcommander_lang", lang);
  } catch { /* noop */ }
}

export function t(key: string, lang: Lang): string {
  return dictionaries[lang]?.[key] ?? dictionaries["zh-CN"]?.[key] ?? key;
}
