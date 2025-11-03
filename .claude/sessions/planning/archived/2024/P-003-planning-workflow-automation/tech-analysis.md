# Technical Analysis - Unified Synchronization System

## 1. Existing Packages Analysis

### Planning Sync (~200 lines)

**Strengths:**

- ✅ Simple and focused
- ✅ Robust TODOs.md and PDR.md parser
- ✅ Generates unique codes (P-XXX, T-XXX-XXX)
- ✅ Dual GitHub/Linear support
- ✅ Clean tracking in issues-sync.json

**Reusable Code:**

```typescript
// TODOs.md Parser - KEEP
packages/planning-sync/src/parser.ts
- parseTodosMarkdown()
- parseFeatureName()
- parsePdrSummary()
- updateTaskStatus()

// Code Generator - KEEP
packages/planning-sync/src/code-generator.ts
- getPlanningCode()
- generateTaskCodes()

// GitHub client base - ADAPT
packages/planning-sync/src/github-client.ts
- createOrUpdateParentIssue()
- createSubIssue()
- updateIssueStatus()
```

**To Remove:**

- Complete Linear client
- Dual GitHub/Linear logic
- Linear sync script

---

### Tools-Todo-Linear (~2000 lines)

**Strengths:**

- ✅ Robust file scanner
- ✅ Sophisticated comment parser
- ✅ Tracking system with AI states
- ✅ Batch processing
- ✅ Retry logic

**Reusable Code:**

```typescript
// File scanner - KEEP
packages/tools-todo-linear/src/core/file-scanner.ts
- scanAllFiles()
- Gitignore respect
- File filters

// Comment parser - KEEP
packages/tools-todo-linear/src/core/parser.ts
- parse() main method
- @username detection
- Label extraction

// Tracking - ADAPT
packages/tools-todo-linear/src/core/tracking.ts
- TrackingManager class
- States and retry logic
- Persistence
```

**To Remove:**

- Complete Linear client
- 5 external AI providers (openai, anthropic, etc)
- Customizable prompts system
- Entire src/ai/providers/ folder
- ~1500 lines of AI code

**To Replace:**

- AI analysis → Claude Code agent
- Linear API → GitHub API

---

## 2. New Architecture

### Package Structure

```
packages/github-workflow/
├── src/
│   ├── core/                           # ~400 lines
│   │   ├── github-client.ts            # 150 lines
│   │   ├── file-scanner.ts             # 100 lines (from tools-todo-linear)
│   │   ├── planning-parser.ts          # 80 lines (from planning-sync)
│   │   ├── todo-parser.ts              # 70 lines (from tools-todo-linear)
│   │   └── tracking.ts                 # 100 lines (adapted)
│   │
│   ├── sync/                           # ~200 lines
│   │   ├── planning-sync.ts            # 100 lines
│   │   ├── todo-sync.ts                # 80 lines
│   │   └── completion-detector.ts      # 60 lines
│   │
│   ├── enrichment/                     # ~150 lines
│   │   ├── claude-agent.ts             # 80 lines
│   │   └── context-extractor.ts        # 70 lines
│   │
│   ├── commands/                       # ~100 lines
│   │   ├── sync-planning.ts            # 25 lines
│   │   ├── sync-todos.ts               # 25 lines
│   │   ├── check-completed.ts          # 25 lines
│   │   └── cleanup-issues.ts           # 25 lines
│   │
│   ├── hooks/                          # ~50 lines
│   │   ├── pre-commit.ts               # 25 lines
│   │   └── post-commit.ts              # 25 lines
│   │
│   ├── config/                         # ~50 lines
│   │   └── config.ts                   # 50 lines
│   │
│   ├── types/                          # ~100 lines
│   │   └── index.ts                    # 100 lines
│   │
│   └── index.ts                        # 20 lines
│
└── test/                               # ~400 lines
    ├── core/
    ├── sync/
    └── integration/

Total: ~950 lines (vs ~2200 current)
Reduction: ~57%
```

### Detailed Data Flow

#### 1. Planning Sync Flow

```typescript
// User executes: /sync-planning

async function syncPlanning(sessionPath: string) {
  // 1. Parse planning files
  const pdr = await parsePDR(`${sessionPath}/PDR.md`);
  const todos = await parseTodos(`${sessionPath}/TODOs.md`);
  const existing = await loadSync(`${sessionPath}/issues-sync.json`);

  // 2. Get/Create planning code
  const planningCode = existing?.planningCode ||
    await getPlanningCode(sessionPath, pdr.featureName);

  // 3. Generate task codes
  const tasksWithCodes = await assignTaskCodes(todos, planningCode);

  // 4. Create GitHub Project
  const project = await github.createProject({
    name: `Planning: ${pdr.featureName}`,
    description: pdr.summary,
  });

  // 5. Create parent issue
  const parentIssue = await github.createIssue({
    title: `[${planningCode}] ${pdr.featureName}`,
    body: formatPDRBody(pdr),
    labels: ['planning:parent'],
  });

  await github.addToProject(project.id, parentIssue.id);

  // 6. Create/Update sub-issues
  for (const task of tasksWithCodes) {
    const issue = await github.createIssue({
      title: `[${task.code}] ${task.title}`,
      body: task.description,
      labels: ['planning:task', `phase:${task.phase}`],
    });

    await github.linkIssues(parentIssue.number, issue.number);
    await github.addToProject(project.id, issue.id);

    task.githubIssueNumber = issue.number;
  }

  // 7. Update TODOs.md with links
  await updateTodosWithLinks(
    `${sessionPath}/TODOs.md`,
    tasksWithCodes
  );

  // 8. Save sync metadata
  await saveSync(`${sessionPath}/issues-sync.json`, {
    feature: pdr.featureName,
    planningCode,
    platform: 'github',
    parentGithubIssueNumber: parentIssue.number,
    tasks: tasksWithCodes,
    syncedAt: new Date().toISOString(),
  });
}
```

#### 2. TODO Sync Flow

```typescript
// User executes: /sync-todos or git commit trigger

async function syncTodos() {
  // 1. Scan codebase
  const files = await scanner.scanAllFiles({
    excludePaths: config.sync.todos.excludePaths,
  });

  // 2. Parse TODOs
  const currentTodos = files.flatMap(file =>
    parser.parseComments(file.content, file.path)
  );

  // 3. Load tracking
  const tracked = await tracking.load();

  // 4. Classify changes
  const { toCreate, toUpdate, toClose } = classifyChanges(
    currentTodos,
    tracked
  );

  // 5. Enrich with Claude Code
  if (config.enrichment.enabled) {
    for (const todo of toCreate) {
      const analysis = await claudeAgent.analyze({
        filePath: todo.filePath,
        line: todo.line,
        comment: todo.text,
        context: await contextExtractor.extract(todo),
      });

      todo.enrichment = analysis;
    }
  }

  // 6. Sync to GitHub
  for (const todo of toCreate) {
    const issue = await github.createIssue({
      title: todo.title,
      body: formatTodoIssue(todo),
      labels: getTodoLabels(todo),
    });

    todo.githubIssueNumber = issue.number;
    await tracking.add(todo);
  }

  for (const { todo, tracked } of toUpdate) {
    await github.updateIssue(tracked.githubIssue.number, {
      body: formatTodoIssue(todo),
    });

    await tracking.update(todo);
  }

  for (const tracked of toClose) {
    await github.closeIssue(tracked.githubIssue.number);
    await tracking.markClosed(tracked.id);
  }

  // 7. Save tracking
  await tracking.save();
}
```

#### 3. Claude Code Enrichment

```typescript
// Enrichment using Claude Code agent

import { Task } from '@claude/sdk';

async function analyzeContext(context: CodeContext): Promise<Analysis> {
  // Prepare context
  const codeSnippet = extractCodeSnippet(
    context.filePath,
    context.line,
    10 // lines before/after
  );

  const imports = extractImports(context.filePath);
  const relatedFiles = await findRelatedFiles(context.filePath);

  // Invoke Claude Code agent
  const result = await Task({
    subagent_type: 'general-purpose',
    description: 'Analyze TODO context',
    prompt: `
Analyze this TODO comment and provide detailed context.

File: ${context.filePath}:${context.line}
TODO: ${context.comment}

Code Context:
\`\`\`typescript
${codeSnippet}
\`\`\`

Imports in file:
${imports.join(', ')}

Please provide:

1. **Current Code Behavior**: What does the code currently do?

2. **Why TODO is Needed**: Why is this change/fix necessary?

3. **Implementation Approach**: Specific suggestions on how to implement

4. **Related Changes**: Other files that might need changes

5. **Complexity Estimate**: Small (1-2h), Medium (3-5h), Large (1-2d)

Format response as JSON:
{
  "currentBehavior": "...",
  "whyNeeded": "...",
  "implementation": "...",
  "relatedFiles": ["..."],
  "complexity": "small|medium|large"
}
    `,
  });

  return JSON.parse(result);
}
```

---

## 3. Technical Decisions

### DT-001: GitHub GraphQL vs REST API

**Options:**

1. **REST API** (v3)
   - Pros: More familiar, more documentation
   - Cons: Multiple requests, less efficient

2. **GraphQL API** (v4) ✅ **SELECTED**
   - Pros: Single request, efficient, Projects v2 native
   - Cons: Learning curve

**Justification:**

- GitHub Projects v2 only available in GraphQL
- Reduce number of API calls
- Better overall performance
- Use Octokit which supports both

**Implementation:**

```typescript
import { graphql } from '@octokit/graphql';

const graphqlWithAuth = graphql.defaults({
  headers: {
    authorization: `token ${token}`,
  },
});

// Single request to create project + issue + linking
const result = await graphqlWithAuth(`
  mutation CreatePlanningStructure($input: CreateProjectInput!) {
    createProject: createProjectV2(input: $input) {
      projectV2 {
        id
        url
      }
    }
  }
`);
```

---

### DT-002: Claude Code Integration Approach

**Options:**

1. **Direct calls to external AI providers**
   - Pros: Full control
   - Cons: Complexity, costs, configuration

2. **Task tool with general-purpose agent** ✅ **SELECTED**
   - Pros: Already available, no setup, free
   - Cons: Less control over prompts

3. **Custom Claude Code agent**
   - Pros: Specialized, optimized
   - Cons: More work, requires new agent

**Justification:**

- We already have Claude Code available
- No additional API keys required
- Sufficient analysis quality
- Simplifies the system

**Implementation:**

```typescript
import { Task } from '@claude/sdk';

// Use existing agent
const analysis = await Task({
  subagent_type: 'general-purpose',
  description: 'Analyze code context for TODO',
  prompt: buildAnalysisPrompt(context),
});

// Parse response
const parsed = parseClaudeResponse(analysis.result);
```

---

### DT-003: Tracking Storage Format

**Options:**

1. **SQLite database**
   - Pros: Complex queries, relational
   - Cons: Overhead, additional dependency

2. **JSON files** ✅ **SELECTED**
   - Pros: Simple, git-friendly, readable
   - Cons: No queries, full load

3. **Git notes**
   - Pros: Integrated in git
   - Cons: Complex to use, limited

**Justification:**

- Simple and sufficient for current scale
- Easy to version in git
- Easy to debug
- Easy to migrate if it grows

**Structure:**

```json
{
  "version": "1.0",
  "todos": [...],
  "plannings": [...],
  "lastSync": "..."
}
```

---

### DT-004: Completion Detection Strategy

**Options:**

1. **Git diff analysis**
   - Pros: Precise
   - Cons: Complex, fragile

2. **Task code in commit message** ✅ **SELECTED**
   - Pros: Explicit, simple, reliable
   - Cons: Requires dev discipline

3. **File heuristics**
   - Pros: Automatic
   - Cons: Can fail, false positives

**Justification:**

- Explicit avoids errors
- Commit message already has task context
- Easy to implement
- Developer has control

**Implementation:**

```typescript
function detectCompletedTasks(commit: GitCommit): string[] {
  // Find task codes in message
  const taskCodes = commit.message.match(/T-\d{3}-\d{3}/g) || [];

  // Verify required files exist
  for (const code of taskCodes) {
    const task = findTaskByCode(code);
    const requiredFiles = getRequiredFiles(task);

    if (allFilesExist(requiredFiles)) {
      // Task complete
      completed.push(code);
    }
  }

  return completed;
}
```

---

### DT-005: Pre-created Projects vs Dynamic Project Creation

**Options:**

1. **Create projects dynamically** (original approach)
   - Pros: Flexible, automatic
   - Cons: Creates project sprawl, hard to organize

2. **Use pre-created projects** ✅ **SELECTED**
   - Pros: Organized, consistent with team structure
   - Cons: Requires project setup, path mapping config

3. **Hybrid approach**
   - Pros: Flexibility when needed
   - Cons: Complexity, inconsistent organization

**Justification:**

- Team already has organizational structure
- 4 pre-created projects match monorepo structure
- Easier to find and manage issues
- Prevents project proliferation

**Pre-created Projects:**

- **Hospeda** - General/cross-cutting issues
- **Hospeda API** - Backend API issues
- **Hospeda Admin** - Admin dashboard issues
- **Hospeda Web** - Public web app issues

**Path Mapping:**

```typescript
projectMapping: {
  'apps/api/**': 'Hospeda API',
  'apps/admin/**': 'Hospeda Admin',
  'apps/web/**': 'Hospeda Web',
  'packages/**': 'Hospeda',
}
```

---

### DT-006: Label Generation Strategy

**Options:**

1. **Manual label assignment**
   - Pros: Full control
   - Cons: Tedious, inconsistent, error-prone

2. **Rule-based labels**
   - Pros: Automatic, consistent
   - Cons: Limited, can't adapt to context

3. **Claude Code generated labels** ✅ **SELECTED**
   - Pros: Context-aware, intelligent, flexible
   - Cons: Requires Claude Code invocation

**Justification:**

- Claude Code can analyze context and suggest appropriate labels
- Combines automatic consistency with intelligent decisions
- Can detect type, priority, difficulty, impact from code
- Universal `from:claude-code` label for all issues

**Label Categories:**

```typescript
const labelCategories = {
  universal: 'from:claude-code',
  source: ['todo', 'hack', 'debug'],
  type: ['type:feature', 'type:bugfix', 'type:refactor'],
  app: ['app:api', 'app:web', 'app:admin'],
  package: ['pkg:db', 'pkg:service-core', 'pkg:schemas'],
  priority: ['priority:critical', 'priority:high', 'priority:medium', 'priority:low'],
  difficulty: ['difficulty:easy', 'difficulty:medium', 'difficulty:hard'],
  impact: ['impact:breaking', 'impact:multiple-apps', 'impact:single-app'],
  planning: ['planning:P-XXX'],
};
```

**Claude Code Prompt:**

```typescript
async function generateLabels(context: IssueContext): Promise<string[]> {
  const analysis = await claudeAgent.analyze({
    filePath: context.filePath,
    code: context.code,
    comment: context.comment,
    prompt: `
Analyze this code and suggest appropriate GitHub labels.

Categories available:
- Type: feature, bugfix, refactor, docs, test
- Priority: critical, high, medium, low
- Difficulty: easy, medium, hard
- Impact: breaking, multiple-apps, single-app

Return JSON array of labels like: ["type:feature", "priority:high", "difficulty:medium"]
    `,
  });

  const suggested = JSON.parse(analysis);
  return ['from:claude-code', ...suggested];
}
```

---

### DT-007: Issue Templates vs Dynamic Formatting

**Options:**

1. **Dynamic formatting in code**
   - Pros: Flexible, no files needed
   - Cons: Inconsistent, hard to preview

2. **GitHub issue templates** ✅ **SELECTED**
   - Pros: Consistent, GitHub native, can be edited
   - Cons: Requires template files

3. **Template engine (Handlebars)**
   - Pros: Very flexible
   - Cons: Additional dependency, overkill

**Justification:**

- GitHub templates are the standard
- Easy to preview and edit
- Provides consistent structure
- Team can customize templates
- No additional dependencies

**Templates Location:**

- `.github/ISSUE_TEMPLATE/planning-task.md`
- `.github/ISSUE_TEMPLATE/code-todo.md`
- `.github/ISSUE_TEMPLATE/code-hack.md`

**Template Variables:**

```typescript
interface TemplateVars {
  title: string;
  description: string;
  location?: string;
  codeContext?: string;
  analysis?: string;
  vscodeLink?: string;
  labels: string[];
  assignees: string[];
}
```

---

### DT-008: TODO Tracking Persistence Strategy

**Options:**

1. **File path + line number only**
   - Pros: Simple
   - Cons: Breaks when file moves or lines change

2. **Content hash**
   - Pros: Survives line changes
   - Cons: Breaks on text edits

3. **GitHub issue number in comment** ✅ **SELECTED**
   - Pros: Persistent, visible, survives all changes
   - Cons: Modifies code comments

4. **Git blame + AST analysis**
   - Pros: Sophisticated
   - Cons: Complex, performance impact

**Justification:**

- Explicitly embedding issue number in comment is most reliable
- Survives file moves, renames, line changes
- Developer can see which issue a TODO tracks
- Enables manual updates if needed
- Simple to implement and understand

**Comment Format:**

```typescript
// Single-line
// TODO(#123): Fix authentication bug

// Multi-line with metadata
// TODO(#123): Implement user authentication
// GitHub: https://github.com/org/repo/issues/123
// Context: Need to add Clerk integration
```

**Tracking Algorithm:**

```typescript
async function trackTodo(todo: ParsedComment): Promise<void> {
  // 1. Check if already has GitHub issue number in comment
  const existing = todo.text.match(/\(#(\d+)\)/);

  if (existing) {
    // Update existing issue
    await github.updateIssue(existing[1], {
      body: formatTodoBody(todo),
    });
  } else {
    // Create new issue
    const issue = await github.createIssue({
      title: todo.title,
      body: formatTodoBody(todo),
    });

    // Update comment in code with issue number
    await updateCommentInCode(todo.filePath, todo.line, {
      issueNumber: issue.number,
      issueUrl: issue.url,
    });
  }
}
```

**Migration from Linear:**

```typescript
async function cleanupLinearTodos(): Promise<void> {
  // Find all TODOs with Linear IDs
  const todos = await scanner.findTodos();
  const withLinear = todos.filter(t => /\(LIN-\d+\)/.test(t.text));

  // Remove Linear IDs
  for (const todo of withLinear) {
    const cleaned = todo.text.replace(/\(LIN-\d+\)/, '').trim();
    await updateCommentInCode(todo.filePath, todo.line, {
      text: cleaned,
    });
  }

  // Report
  logger.info(`Cleaned ${withLinear.length} Linear TODOs`);
}
```

---

## 4. Integration with Current System

### Migrating Existing Planning Sessions

**Strategy:**

```typescript
// Script: migrate-planning-sessions.ts

async function migratePlanningSession(sessionPath: string) {
  // 1. Read existing issues-sync.json
  const existing = await readJSON(`${sessionPath}/issues-sync.json`);

  // 2. If Linear, migrate to GitHub
  if (existing.platform === 'linear') {
    // Create structure in GitHub
    const githubStructure = await createGitHubFromLinear(existing);

    // Update issues-sync.json
    await writeJSON(`${sessionPath}/issues-sync.json`, {
      ...existing,
      platform: 'github',
      parentGithubIssueNumber: githubStructure.parentIssue.number,
      tasks: githubStructure.tasks,
      // Keep Linear IDs for reference
      _legacy: {
        linearParentId: existing.parentIssueId,
        linearTasks: existing.tasks,
      },
    });

    // Update TODOs.md with new links
    await updateTodosWithGitHubLinks(sessionPath, githubStructure.tasks);
  }

  // 3. If already GitHub, verify format
  else if (existing.platform === 'github') {
    // Validate and update if needed
    await validateGitHubSync(sessionPath);
  }
}
```

### Migrating TODO Tracking

**Strategy:**

```typescript
// Script: migrate-todo-tracking.ts

async function migrateTodoTracking() {
  // 1. Read existing tracking from tools-todo-linear
  const oldTracking = await readJSON('.todo-linear-tracking.json');

  // 2. For each TODO, migrate to GitHub if Linear
  const newTracking = {
    version: '1.0',
    todos: [],
    lastSync: new Date().toISOString(),
  };

  for (const todo of oldTracking.comments) {
    // If has Linear ID, create in GitHub
    if (todo.linearId) {
      const githubIssue = await migrateLinearToGitHub(todo);

      newTracking.todos.push({
        id: todo.id || generateId(),
        type: todo.type,
        filePath: todo.filePath,
        line: todo.line,
        title: todo.title,
        githubIssue: {
          number: githubIssue.number,
          url: githubIssue.url,
          state: 'open',
        },
        createdAt: todo.createdAt,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  // 3. Save new tracking
  await writeJSON('.github-workflow/tracking.json', newTracking);

  // 4. Backup old
  await rename(
    '.todo-linear-tracking.json',
    '.todo-linear-tracking.json.backup'
  );
}
```

---

## 5. Performance and Optimization

### Caching Strategy

```typescript
// GitHub label cache
class GitHubClient {
  private labelCache = new Map<string, Label>();

  async getOrCreateLabel(name: string, color: string): Promise<Label> {
    // Check cache
    if (this.labelCache.has(name)) {
      return this.labelCache.get(name)!;
    }

    // Fetch or create
    const label = await this.fetchOrCreateLabel(name, color);

    // Cache
    this.labelCache.set(name, label);

    return label;
  }

  async warmupCache(): Promise<void> {
    // Pre-load common labels
    const labels = await this.listLabels();
    for (const label of labels) {
      this.labelCache.set(label.name, label);
    }
  }
}
```

### Batch Processing

```typescript
// Process multiple TODOs in batch
async function syncTodosBatch(todos: ParsedComment[]): Promise<void> {
  // Group by operation
  const batches = groupByOperation(todos);

  // Process creates in parallel (max 5 concurrent)
  await pMap(
    batches.toCreate,
    async (todo) => await createIssue(todo),
    { concurrency: 5 }
  );

  // Process updates in parallel
  await pMap(
    batches.toUpdate,
    async (todo) => await updateIssue(todo),
    { concurrency: 5 }
  );
}
```

### Rate Limiting

```typescript
// Respect GitHub rate limits
class RateLimiter {
  private remaining = 5000;
  private resetAt = Date.now() + 3600000; // 1 hour

  async checkLimit(): Promise<void> {
    if (this.remaining < 100) {
      const waitTime = this.resetAt - Date.now();
      logger.warn(`Rate limit low, waiting ${waitTime}ms`);
      await sleep(waitTime);
    }
  }

  updateFromResponse(headers: Headers): void {
    this.remaining = Number.parseInt(headers.get('x-ratelimit-remaining') || '5000');
    this.resetAt = Number.parseInt(headers.get('x-ratelimit-reset') || '0') * 1000;
  }
}
```

---

## 6. Security

### Token Management

```typescript
// .env.local (gitignored)
GITHUB_TOKEN=ghp_xxxxxxxxxxxxx

// config.ts
export function loadConfig(): GitHubWorkflowConfig {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error(
      'GITHUB_TOKEN not found. Set in .env.local'
    );
  }

  // Validate token format
  if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
    throw new Error('Invalid GitHub token format');
  }

  return {
    github: {
      token,
      // ...
    },
  };
}
```

### Required Permissions

**Minimum GitHub Token Scopes:**

- `repo` - Full control of repositories
  - `repo:status` - Access commit status
  - `repo_deployment` - Access deployment status
  - `public_repo` - Access public repositories
  - `repo:invite` - Access repository invitations
- `project` - Full control of projects
  - `read:project` - Read project metadata
  - `write:project` - Write project metadata

**Verification:**

```typescript
async function verifyTokenPermissions(token: string): Promise<void> {
  const octokit = new Octokit({ auth: token });

  try {
    // Test repo access
    await octokit.repos.get({
      owner: config.github.owner,
      repo: config.github.repo,
    });

    // Test project access
    await octokit.graphql(`
      query {
        viewer {
          projectsV2(first: 1) {
            nodes {
              id
            }
          }
        }
      }
    `);
  } catch (error) {
    throw new Error(`Token lacks required permissions: ${error.message}`);
  }
}
```

---

## 7. Dependencies

### Dependency Analysis

**New Dependencies:**

```json
{
  "dependencies": {
    "@octokit/graphql": "^7.0.0",      // 50KB - GitHub GraphQL
    "@octokit/rest": "^20.0.0",        // 100KB - GitHub REST (backup)
    "chokidar": "^3.5.0",              // 80KB - File watching (from todo-linear)
    "cosmiconfig": "^9.0.0",           // 40KB - Config loading
    "globby": "^14.0.0",               // 20KB - File globbing (from todo-linear)
    "pino": "^8.17.0",                 // 30KB - Logging
    "zod": "^3.22.0"                   // 60KB - Validation (already in project)
  }
}
```

**Total:** ~380KB (vs ~1.2MB current)

**Dependencies to Remove:**

```json
{
  "removes": {
    "@linear/sdk": "15.0.0",           // 200KB
    "openai": "^4.0.0",                // 300KB
    "@anthropic-ai/sdk": "^0.9.0",     // 150KB
    "@google/generative-ai": "^0.1.0", // 200KB
    "groq-sdk": "^0.1.0",              // 100KB
    // ... other AI providers
  }
}
```

**Total Removed:** ~950KB

---

## 8. Testing Strategy

### Unit Tests

```typescript
// core/planning-parser.test.ts
describe('PlanningParser', () => {
  it('should parse TODOs with all statuses', () => {
    const markdown = `
      - [ ] Pending task
      - [~] In progress task
      - [x] Completed task
    `;

    const tasks = parseTodosMarkdown(markdown);

    expect(tasks).toHaveLength(3);
    expect(tasks[0].status).toBe('pending');
  });
});

// core/github-client.test.ts
describe('GitHubClient', () => {
  it('should create project with correct structure', async () => {
    const mockOctokit = mockGitHubAPI();
    const client = new GitHubClient(mockOctokit);

    const project = await client.createProject({
      name: 'Test Project',
      description: 'Test Description',
    });

    expect(project.title).toBe('Test Project');
    expect(mockOctokit.graphql).toHaveBeenCalledWith(
      expect.stringContaining('createProjectV2')
    );
  });
});
```

### Integration Tests

```typescript
// sync/planning-sync.integration.test.ts
describe('Planning Sync Integration', () => {
  it('should sync complete planning to GitHub', async () => {
    // Setup
    const testSession = await createTestPlanningSession({
      feature: 'Test Feature',
      tasks: [
        { title: 'Task 1', status: 'pending' },
        { title: 'Task 2', status: 'pending' },
      ],
    });

    // Execute
    const result = await planningSync.sync(testSession.path);

    // Verify
    expect(result.projectCreated).toBe(true);
    expect(result.issuesCreated).toBe(3); // 1 parent + 2 tasks

    // Verify GitHub state
    const project = await github.getProject(result.projectId);
    expect(project.issues).toHaveLength(3);

    // Verify local state
    const sync = await readSync(`${testSession.path}/issues-sync.json`);
    expect(sync.tasks).toHaveLength(2);
  });
});
```

---

## 9. Technical Documentation

### API Reference

```typescript
/**
 * Main sync function for planning sessions
 *
 * @param sessionPath - Path to planning session directory
 * @param options - Sync options
 * @returns Sync result with statistics
 *
 * @example
 * ```typescript
 * const result = await syncPlanning(
 *   '.claude/sessions/planning/P-003-feature',
 *   { force: false }
 * );
 *
 * console.log(`Created ${result.issuesCreated} issues`);
 * ```
 */
export async function syncPlanning(
  sessionPath: string,
  options?: SyncOptions
): Promise<SyncResult>;
```

### Configuration Schema

```typescript
import { z } from 'zod';

export const ConfigSchema = z.object({
  github: z.object({
    token: z.string(),
    owner: z.string(),
    repo: z.string(),
  }),

  sync: z.object({
    planning: z.object({
      enabled: z.boolean().default(true),
      autoSync: z.boolean().default(false),
    }),

    todos: z.object({
      enabled: z.boolean().default(true),
      types: z.array(z.enum(['TODO', 'HACK', 'DEBUG'])),
    }),
  }),

  // ... rest of schema
});

export type GitHubWorkflowConfig = z.infer<typeof ConfigSchema>;
```

---

## Decision Summary

| Decision | Selected Option | Justification |
|----------|----------------|---------------|
| **DT-001** GitHub API | GraphQL v4 | Efficiency, Projects v2 native |
| **DT-002** Claude Integration | Task tool | Available, free, sufficient |
| **DT-003** Tracking Storage | JSON files | Simple, git-friendly, readable |
| **DT-004** Completion Detection | Commit message | Explicit, reliable, dev control |
| **DT-005** Project Management | Pre-created projects | Organized, team structure |
| **DT-006** Label Generation | Claude Code | Context-aware, intelligent |
| **DT-007** Issue Formatting | GitHub templates | Consistent, native, editable |
| **DT-008** TODO Tracking | Issue # in comment | Persistent, visible, reliable |
| Code to Reuse | ~40% from both | Parsers, scanner, tracking |
| Total Lines | ~1050 | 52% reduction |
| Dependencies | 7 main | 380KB vs 1.2MB |

---

*Technical Analysis completed by Claude Code*
*Date: 2025-01-31*
