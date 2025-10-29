# @repo/planning-sync

Simple GitHub/Linear synchronization for Claude Code planning sessions.

## Features

- ✅ Create parent planning issues in GitHub or Linear
- ✅ Create sub-issues for each task
- ✅ Auto-detect and apply labels from task content
- ✅ Rich issue summaries with metadata
- ✅ GitHub Projects v2 integration
- ✅ Parent-child relationships
- ✅ Sync task status bidirectionally (TODOs.md ↔ GitHub/Linear)
- ✅ ~200 lines vs ~2000+ in tools-todo-linear
- ✅ No file scanning, no AI, no complexity

## Installation

```bash
pnpm add @repo/planning-sync
```

## Quick Start

### GitHub Sync

**📖 Full Setup Guide**: See [GITHUB-SETUP.md](./GITHUB-SETUP.md) for complete instructions.

**1. Configure GitHub Token** (requires `repo`, `read:project`, `write:project` scopes):

```bash
# Add to .env.local
GITHUB_TOKEN=ghp_your_token_here
GITHUB_REPO=owner/repo-name
```

**2. Run Sync**:

```bash
export GITHUB_TOKEN="ghp_..." && \
export GITHUB_REPO="owner/repo" && \
node --import tsx/esm packages/planning-sync/src/scripts/planning-sync.ts \
  /absolute/path/to/.claude/sessions/planning/P-XXX-feature-name \
  github
```

**3. Clean Up Issues** (testing only):

```bash
gh issue list --state all --limit 1000 --json number -q '.[].number' | \
  xargs -I {} gh issue delete {} --yes
```

### Linear Sync

**1. Configure Linear API**:

```bash
# Add to .env.local
LINEAR_API_KEY=your_linear_api_key
LINEAR_TEAM_ID=your_team_id
```

Get these from Linear Settings → API → Personal API Keys.

**2. Run Sync**:

```bash
pnpm run planning:sync /path/to/planning/session
```

## Usage

### Sync Planning to Linear

```typescript
import { syncPlanningToLinear } from '@repo/planning-sync';

const result = await syncPlanningToLinear(
  '.claude/sessions/planning/user-auth',
  {
    apiKey: process.env.LINEAR_API_KEY!,
    teamId: process.env.LINEAR_TEAM_ID!,
  }
);

console.log(`Parent issue: ${result.parentIssueUrl}`);
console.log(`Created: ${result.tasksCreated} tasks`);
```

### Mark Task as Completed

```typescript
import { markTaskCompleted } from '@repo/planning-sync';

const result = await markTaskCompleted(
  '.claude/sessions/planning/user-auth',
  'task-id-or-title',
  {
    apiKey: process.env.LINEAR_API_KEY!,
    teamId: process.env.LINEAR_TEAM_ID!,
  }
);

console.log(`Completed: ${result.issueUrl}`);
```

### Get Planning Session Info

```typescript
import { getPlanningSession } from '@repo/planning-sync';

const session = await getPlanningSession(
  '.claude/sessions/planning/user-auth'
);

if (session) {
  console.log(`Feature: ${session.feature}`);
  console.log(`Parent: ${session.parentIssueId}`);
  console.log(`Tasks: ${session.tasks.length}`);
}
```

## How It Works

### 1. Planning Session Structure

```
.claude/sessions/planning/user-auth/
├── PDR.md                  # Product requirements
├── tech-analysis.md        # Technical analysis
├── TODOs.md                # Tasks (parsed by this package)
└── issues-sync.json        # Sync state (created by this package)
```

### 2. TODOs.md Format

```markdown
## Tasks

- [ ] Create Zod schemas for user validation
  > Define validation schemas for user entity

- [~] Implement User model extending BaseModel
  > Create model with CRUD operations

- [x] Write user model tests
  > Test all model methods with 90% coverage
```

Status markers:

- `[ ]` = pending
- `[~]` = in_progress
- `[x]` = completed

### 3. Linear Structure

```
[Planning] User Authentication (parent issue)
├── Create Zod schemas for user validation (sub-issue)
├── Implement User model extending BaseModel (sub-issue)
└── Write user model tests (sub-issue)
```

### 4. Sync State (issues-sync.json)

```json
{
  "feature": "User Authentication",
  "parentIssueId": "HOSP-123",
  "linearTeamId": "abc-123",
  "syncedAt": "2025-01-15T10:30:00Z",
  "tasks": [
    {
      "id": "abc12345",
      "title": "Create Zod schemas",
      "status": "completed",
      "linearIssueId": "HOSP-124"
    }
  ]
}
```

## Claude Code Integration

### Command: `/sync-planning`

Syncs current planning session to Linear.

See: `.claude/commands/sync-planning.md`

### Workflow Integration

Automatically asks to mark tasks complete after implementation.

See: `.claude/docs/workflows/task-completion-protocol.md`

## API

### `syncPlanningToLinear(sessionPath, config)`

Synchronizes planning session to Linear.

**Parameters:**

- `sessionPath`: Path to planning session directory
- `config`: Linear configuration (apiKey, teamId)

**Returns:** `Promise<SyncResult>`

```typescript
interface SyncResult {
  parentIssueUrl: string;
  parentIssueId: string;
  tasksCreated: number;
  tasksUpdated: number;
  tasksUnchanged: number;
}
```

### `markTaskCompleted(sessionPath, taskId, config)`

Marks task as completed in TODOs.md and Linear.

**Parameters:**

- `sessionPath`: Path to planning session directory
- `taskId`: Task ID or title
- `config`: Linear configuration

**Returns:** `Promise<CompleteTaskResult>`

```typescript
interface CompleteTaskResult {
  taskId: string;
  linearIssueId: string;
  issueUrl: string;
}
```

### `getPlanningSession(sessionPath)`

Gets current planning session data.

**Parameters:**

- `sessionPath`: Path to planning session directory

**Returns:** `Promise<PlanningSession | null>`

```typescript
interface PlanningSession {
  feature: string;
  parentIssueId?: string;
  linearTeamId?: string;
  syncedAt?: string;
  tasks: PlanningTask[];
}
```

### `updateTaskStatusInSync(sessionPath, taskId, newStatus, config)`

Updates task status in TODOs.md and Linear.

**Parameters:**

- `sessionPath`: Path to planning session directory
- `taskId`: Task ID or title
- `newStatus`: 'pending' | 'in_progress' | 'completed'
- `config`: Linear configuration

**Returns:** `Promise<void>`

## Comparison with tools-todo-linear

| Feature | planning-sync | tools-todo-linear |
|---------|---------------|-------------------|
| **Purpose** | Planning sessions | Code TODOs |
| **Lines of code** | ~200 | ~2000+ |
| **File scanning** | No | Yes (entire codebase) |
| **AI integration** | No | Yes (5 providers) |
| **Label caching** | Simple | Complex |
| **Use case** | Feature planning | TODO comments |
| **Complexity** | Low | High |

## License

MIT

## Author

Qazuor - Hospeda Project
