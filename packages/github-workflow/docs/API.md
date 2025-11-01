# API Reference

Complete API reference for programmatic usage of the GitHub Workflow package.

## Table of Contents

- [Core API](#core-api)
- [Sync API](#sync-api)
- [Enrichment API](#enrichment-api)
- [Configuration API](#configuration-api)
- [Utilities API](#utilities-api)
- [Type Definitions](#type-definitions)

## Core API

### GitHubClient

Main client for interacting with GitHub API.

```typescript
import { GitHubClient } from '@repo/github-workflow/core';
```

#### Constructor

```typescript
new GitHubClient(config: GitHubClientConfig)
```

**Parameters:**

- `config.token` - GitHub Personal Access Token
- `config.owner` - Repository owner
- `config.repo` - Repository name

**Example:**

```typescript
const client = new GitHubClient({
  token: process.env.GITHUB_TOKEN!,
  owner: 'hospeda',
  repo: 'main',
});
```

#### Methods

##### `createIssue(options: CreateIssueOptions): Promise<IssueResponse>`

Creates a new GitHub issue.

**Parameters:**

```typescript
{
  title: string;              // Issue title (required)
  body?: string;              // Issue body (markdown)
  labels?: string[];          // Label names
  assignees?: string[];       // GitHub usernames
  milestone?: number;         // Milestone number
  projects?: string[];        // Project names
}
```

**Returns:** `Promise<IssueResponse>`

```typescript
{
  number: number;        // Issue number
  html_url: string;      // Issue URL
  state: 'open' | 'closed';
  // ... other GitHub issue fields
}
```

**Example:**

```typescript
const issue = await client.createIssue({
  title: 'Implement user authentication',
  body: '## Description\n\nAdd JWT-based auth...',
  labels: ['feature', 'priority-high'],
  assignees: ['developer'],
});

console.log(`Created issue #${issue.number}`);
```

##### `updateIssue(issueNumber: number, options: UpdateIssueOptions): Promise<IssueResponse>`

Updates an existing issue.

**Parameters:**

```typescript
{
  title?: string;
  body?: string;
  state?: 'open' | 'closed';
  labels?: string[];
  assignees?: string[];
}
```

**Example:**

```typescript
await client.updateIssue(42, {
  state: 'closed',
  labels: ['completed'],
});
```

##### `linkIssues(parentNumber: number, childNumber: number): Promise<void>`

Links two issues (parent-child relationship).

**Example:**

```typescript
// Link issue #43 as child of #42
await client.linkIssues(42, 43);
```

##### `addLabels(issueNumber: number, labels: string[]): Promise<void>`

Adds labels to an issue.

**Example:**

```typescript
await client.addLabels(42, ['bug', 'high-priority']);
```

##### `createLabel(options: CreateLabelOptions): Promise<void>`

Creates a new label in the repository.

**Parameters:**

```typescript
{
  name: string;          // Label name
  color: string;         // Hex color (without #)
  description: string;   // Label description
}
```

**Example:**

```typescript
await client.createLabel({
  name: 'priority-critical',
  color: 'FF0000',
  description: 'Critical priority items',
});
```

## Sync API

### Planning Sync

```typescript
import { syncPlanningToGitHub } from '@repo/github-workflow';
```

#### `syncPlanningToGitHub(options: SyncOptions): Promise<SyncResult>`

Syncs a planning session to GitHub Issues.

**Parameters:**

```typescript
{
  sessionPath: string;           // Path to planning session
  githubConfig: GitHubClientConfig;
  trackingPath?: string;         // Path to tracking file
  dryRun?: boolean;             // Preview mode
  updateExisting?: boolean;     // Update existing issues
}
```

**Returns:** `Promise<SyncResult>`

```typescript
{
  success: boolean;
  statistics: {
    totalTasks: number;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
  };
  created: CreatedIssue[];
  updated: UpdatedIssue[];
  skipped: SkippedTask[];
  failed: FailedTask[];
}
```

**Example:**

```typescript
const result = await syncPlanningToGitHub({
  sessionPath: '.claude/sessions/planning/P-001-auth',
  githubConfig: {
    token: process.env.GITHUB_TOKEN!,
    owner: 'hospeda',
    repo: 'main',
  },
  dryRun: false,
  updateExisting: true,
});

console.log(`Created ${result.statistics.created} issues`);
console.log(`Updated ${result.statistics.updated} issues`);
```

### TODO Sync

```typescript
import { syncTodosToGitHub } from '@repo/github-workflow';
```

#### `syncTodosToGitHub(options: TodoSyncOptions): Promise<TodoSyncResult>`

Syncs TODO comments to GitHub Issues.

**Parameters:**

```typescript
{
  projectRoot: string;
  githubConfig: GitHubClientConfig;
  types?: ('TODO' | 'HACK' | 'DEBUG')[];
  excludePaths?: string[];
}
```

**Example:**

```typescript
const result = await syncTodosToGitHub({
  projectRoot: process.cwd(),
  githubConfig,
  types: ['TODO', 'HACK'],
  excludePaths: ['node_modules', 'dist'],
});
```

## Enrichment API

### Issue Enrichment

```typescript
import { enrichIssue } from '@repo/github-workflow/enrichment';
```

#### `enrichIssue(options: EnrichmentOptions): Promise<EnrichmentResult>`

Enriches a GitHub issue with planning context.

**Parameters:**

```typescript
{
  issueNumber: number;
  sessionId: string;           // Planning session ID
  githubConfig: GitHubClientConfig;
  contextLines?: number;       // Lines of context
  agent?: string;              // Claude Code agent
}
```

**Returns:** `Promise<EnrichmentResult>`

```typescript
{
  success: boolean;
  issueNumber: number;
  enriched: boolean;
  context?: string;
  error?: string;
}
```

**Example:**

```typescript
const result = await enrichIssue({
  issueNumber: 42,
  sessionId: 'P-001',
  githubConfig,
  contextLines: 10,
  agent: 'product-technical',
});

if (result.enriched) {
  console.log('Issue enriched successfully');
}
```

### Context Extraction

```typescript
import { extractContext } from '@repo/github-workflow/enrichment';
```

#### `extractContext(options: ContextOptions): Promise<string>`

Extracts relevant context from planning documents.

**Parameters:**

```typescript
{
  sessionPath: string;
  taskCode: string;
  contextLines?: number;
}
```

**Returns:** Context as markdown string

**Example:**

```typescript
const context = await extractContext({
  sessionPath: '.claude/sessions/planning/P-001-auth',
  taskCode: 'T-001-001',
  contextLines: 15,
});

console.log(context);
```

## Configuration API

### Load Configuration

```typescript
import { loadConfig } from '@repo/github-workflow/config';
```

#### `loadConfig(projectRoot?: string): Promise<WorkflowConfig>`

Loads configuration from all sources.

**Parameters:**

- `projectRoot` - Optional project root (defaults to `process.cwd()`)

**Returns:** Complete configuration object

**Example:**

```typescript
const config = await loadConfig();

console.log(config.github.owner);
console.log(config.sync.planning.enabled);
```

### Validate Configuration

```typescript
import { validateConfig } from '@repo/github-workflow/config';
```

#### `validateConfig(config: unknown): WorkflowConfig`

Validates configuration using Zod schema.

**Parameters:**

- `config` - Configuration object to validate

**Returns:** Validated configuration

**Throws:** `ZodError` if validation fails

**Example:**

```typescript
try {
  const config = validateConfig({
    github: {
      token: process.env.GITHUB_TOKEN,
      owner: 'hospeda',
      repo: 'main',
    },
  });
} catch (error) {
  console.error('Invalid config:', error.message);
}
```

## Utilities API

### File Parsing

```typescript
import { parseTodosFile, parsePlanningSession } from '@repo/github-workflow/parsers';
```

#### `parseTodosFile(filePath: string): Promise<TodoTask[]>`

Parses TODOs.md file.

**Returns:** Array of task objects

```typescript
{
  taskCode: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  assignee?: string;
  estimate?: string;
  dependencies?: string[];
}
```

#### `parsePlanningSession(sessionPath: string): Promise<PlanningSession>`

Parses complete planning session.

**Returns:** Planning session object

```typescript
{
  sessionId: string;
  title: string;
  pdr: string;         // PDR content
  techAnalysis: string; // Tech analysis content
  tasks: TodoTask[];
}
```

### Markdown Utilities

```typescript
import { renderTemplate, parseMarkdown } from '@repo/github-workflow/utils';
```

#### `renderTemplate(template: string, data: Record<string, unknown>): string`

Renders markdown template with data.

**Example:**

```typescript
const template = 'Hello {{name}}, your task is: {{task}}';
const rendered = renderTemplate(template, {
  name: 'Developer',
  task: 'Implement auth',
});
// "Hello Developer, your task is: Implement auth"
```

## Type Definitions

### Core Types

```typescript
// GitHub configuration
export type GitHubClientConfig = {
  token: string;
  owner: string;
  repo: string;
};

// Issue creation options
export type CreateIssueOptions = {
  title: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
  milestone?: number;
  projects?: string[];
};

// Issue response
export type IssueResponse = {
  number: number;
  html_url: string;
  state: 'open' | 'closed';
  title: string;
  body: string | null;
  labels: Array<{ name: string }>;
  assignees: Array<{ login: string }>;
};
```

### Sync Types

```typescript
// Sync options
export type SyncOptions = {
  sessionPath: string;
  githubConfig: GitHubClientConfig;
  trackingPath?: string;
  dryRun?: boolean;
  updateExisting?: boolean;
};

// Sync result
export type SyncResult = {
  success: boolean;
  statistics: SyncStatistics;
  created: CreatedIssue[];
  updated: UpdatedIssue[];
  skipped: SkippedTask[];
  failed: FailedTask[];
};

// Sync statistics
export type SyncStatistics = {
  totalTasks: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
};
```

### Configuration Types

```typescript
export type WorkflowConfig = {
  github: GitHubConfig;
  sync?: SyncConfig;
  labels?: LabelsConfig;
  detection?: DetectionConfig;
  enrichment?: EnrichmentConfig;
  hooks?: HooksConfig;
  templates?: TemplatesConfig;
  tracking?: TrackingConfig;
};
```

See [CONFIGURATION.md](./CONFIGURATION.md) for complete configuration type reference.

## Error Handling

All async functions may throw errors. Use try-catch for error handling:

```typescript
import { syncPlanningToGitHub } from '@repo/github-workflow';
import { logger } from '@repo/logger';

try {
  const result = await syncPlanningToGitHub({
    sessionPath: '.claude/sessions/planning/P-001',
    githubConfig,
  });

  logger.info({ result }, 'Planning synced successfully');
} catch (error) {
  logger.error({ error: (error as Error).message }, 'Planning sync failed');
  throw error;
}
```

### Common Errors

```typescript
// Configuration error
class ConfigurationError extends Error {
  name = 'ConfigurationError';
}

// GitHub API error
class GitHubError extends Error {
  name = 'GitHubError';
  statusCode: number;
}

// Parsing error
class ParseError extends Error {
  name = 'ParseError';
  filePath: string;
}
```

## Best Practices

### 1. Always Use TypeScript

```typescript
import type { SyncOptions, SyncResult } from '@repo/github-workflow';

const options: SyncOptions = {
  sessionPath: '.claude/sessions/planning/P-001',
  githubConfig: {
    token: process.env.GITHUB_TOKEN!,
    owner: 'hospeda',
    repo: 'main',
  },
};

const result: SyncResult = await syncPlanningToGitHub(options);
```

### 2. Handle Errors Gracefully

```typescript
try {
  await syncPlanningToGitHub(options);
} catch (error) {
  if (error instanceof ConfigurationError) {
    console.error('Fix your configuration');
  } else if (error instanceof GitHubError) {
    console.error('GitHub API error:', error.statusCode);
  } else {
    console.error('Unknown error:', error);
  }
}
```

### 3. Use Dry Run First

```typescript
// Test first with dry run
const dryRunResult = await syncPlanningToGitHub({
  ...options,
  dryRun: true,
});

console.log(`Would create ${dryRunResult.statistics.created} issues`);

// Then run for real
if (confirm('Proceed?')) {
  await syncPlanningToGitHub(options);
}
```

### 4. Log Operations

```typescript
import { logger } from '@repo/logger';

logger.info({ sessionPath }, 'Starting sync');

const result = await syncPlanningToGitHub(options);

logger.info(
  {
    created: result.statistics.created,
    updated: result.statistics.updated,
  },
  'Sync completed'
);
```

## See Also

- [Setup Guide](./SETUP.md) - Getting started
- [Configuration Reference](./CONFIGURATION.md) - All options
- [Troubleshooting](./TROUBLESHOOTING.md) - Common issues

---

**Questions?** Create an issue or check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
