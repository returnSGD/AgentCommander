# AgentCommander — Git-style Multi-Agent Collaboration for AgentSpace

在 [AgentSpace](https://github.com/HKUDS/AgentSpace) 基础上实现的 Git 式多 Agent 协作工作流扩展。

## 工作流模型

```
Issue → Proposal(PR) → Review × N → Merge/Close
  ↑          ↑              ↑             ↑
Agent A    Agent B      Agents C,D    Auto-merge
(提需求)   (提交方案)    (评审)       (所有review通过)
```

## 冲突解决 (三层防护)

| 层级 | 机制 | 实现 |
|---|---|---|
| ① 异步锁 | 资源级互斥 | `workflow_lock` 表 + UNIQUE 约束，带 TTL 自动过期 |
| ② 同步队列 | FIFO 串行化 | `workflow_operation_queue` 表，优先级排序，`processQueue()` 逐条拿锁执行 |
| ③ 状态数据库 | 乐观锁版本控制 | `version` 列，`UPDATE ... WHERE version = ?`，冲突时记录到 `workflow_conflict` |

## 安装

```bash
# 1. 复制新增文件
cp -r extension/domain/src/*   AgentSpace/packages/domain/src/
cp -r extension/db/src/*       AgentSpace/packages/db/src/
cp -r extension/services/src/* AgentSpace/packages/services/src/

# 2. 覆盖修改文件 (AgentSpace 原有文件 + workflow 集成)
cp modified/domain/src/workspace.ts      AgentSpace/packages/domain/src/
cp modified/domain/src/index.ts          AgentSpace/packages/domain/src/
cp modified/db/src/types.ts              AgentSpace/packages/db/src/
cp modified/db/src/postgres-schema.ts    AgentSpace/packages/db/src/
cp modified/db/src/index.ts              AgentSpace/packages/db/src/
cp modified/services/src/index.ts        AgentSpace/packages/services/src/

# 3. 安装依赖
cd AgentSpace && npm run setup
```

## 快速开始

```typescript
import { WorkflowOrchestrator } from "@agent-space/services";

const wf = new WorkflowOrchestrator();

// 1. 创建 Issue
const issue = wf.openIssue({
  title: "优化搜索性能",
  description: "延迟需从 2s 降到 200ms",
  createdBy: "architect-agent",
  priority: "high",
  enqueueTask: true,
});

// 2. 提交 PR
const { proposal } = wf.submitProposal({
  issueId: issue.id,
  title: "引入 Elasticsearch",
  description: "用 ES 倒排索引替代 SQL LIKE",
  proposedBy: "dev-agent",
  reviewers: ["qa-agent", "security-agent"],
});

// 3. 评审
wf.reviewProposal({
  reviewId: "wfr-xxx",
  reviewerId: "qa-agent",
  status: "approved",
  summary: "LGTM",
  expectedVersion: 1,
});

// 4. 所有评审通过后自动合并
// → proposal → merged, issue → closed
```

## 文件清单

### 新增 (10 files)
```
extension/
├── domain/src/git-workflow.ts          # 领域类型定义
├── db/src/workflow-issues.ts           # Issue CRUD + 乐观锁
├── db/src/workflow-proposals.ts        # Proposal(PR) CRUD
├── db/src/workflow-reviews.ts          # Review + Comment CRUD
├── db/src/workflow-locks.ts            # 异步锁 CRUD + 过期清理
├── db/src/workflow-conflicts.ts        # 冲突记录 + 操作队列 CRUD
└── services/src/workflow/
    ├── async-lock.ts                   # withLock() 自动锁服务
    ├── conflict-queue.ts               # processQueue() 同步FIFO队列
    └── engine.ts                       # WorkflowOrchestrator 编排引擎
```

### 修改 (6 files)
```
modified/
├── domain/src/workspace.ts             # +7 字段在 AgentSpaceState, +11 事件类型
├── domain/src/index.ts                 # +export git-workflow.ts
├── db/src/types.ts                     # +13 workflow DB record 类型
├── db/src/postgres-schema.ts           # +6 张表 + 索引
├── db/src/index.ts                     # +export 所有新模块
└── services/src/index.ts               # +export 所有工作流服务
```

### 新增数据库表 (6 张，自动迁移)
`workflow_issue`, `workflow_proposal`, `workflow_review`, `workflow_review_comment`, `workflow_lock`, `workflow_operation_queue`, `workflow_conflict`
