# CLAUDE.md - GitHub Workflow Package

> **📚 Main Documentation**: For project-wide guidelines, workflows, and standards, see [CLAUDE.md](../../CLAUDE.md) in the project root.

This file provides guidance for working with the GitHub Workflow package (`@repo/github-workflow`).

## Overview

Automation package for GitHub workflows including planning sync, TODO generation, and issue enrichment. Integrates planning sessions with GitHub Issues for seamless project management.

## Key Commands

```bash
# Build & Development
pnpm build             # Build package
pnpm dev               # Watch mode
pnpm typecheck         # Type checking
pnpm lint              # Code linting

# Testing
pnpm test              # Run tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # Coverage report (90% minimum)

# Workflow Commands (from project root)
pnpm planning:sync <session-path>              # Sync to GitHub
pnpm planning:generate-todos <session-path>    # Generate TODOs
pnpm planning:enrich-issue <issue> <session>   # Enrich issue
```

## Package Structure

```
src/
├── core/              # Workflow orchestration
│   ├── orchestrator.ts
│   ├── state-manager.ts
│   └── index.ts
├── sync/              # GitHub synchronization
│   ├── issue-sync.ts
│   ├── todo-sync.ts
│   └── index.ts
├── enrichment/        # Issue enrichment
│   ├── context-enricher.ts
│   ├── template-engine.ts
│   └── index.ts
├── config/            # Configuration
│   ├── validator.ts
│   ├── loader.ts
│   └── index.ts
├── commands/          # CLI commands
│   ├── sync-command.ts
│   ├── generate-command.ts
│   └── index.ts
├── scripts/           # Executable scripts
│   └── planning-sync.ts
├── hooks/             # Git hooks
│   ├── pre-commit.ts
│   └── index.ts
├── types/             # Type definitions
│   ├── config.ts
│   ├── github.ts
│   ├── workflow.ts
│   └── index.ts
└── utils/             # Utilities
    ├── file-parser.ts
    ├── markdown-parser.ts
    └── index.ts
```

## Core Concepts

### Planning Session

A planning session is a directory containing:

- `PDR.md` - Product Requirements Document
- `tech-analysis.md` - Technical analysis
- `TODOs.md` - Task breakdown

**Example structure:**

```
.claude/sessions/planning/P-001-user-auth/
├── PDR.md
├── tech-analysis.md
└── TODOs.md
```

### TODO Item

A structured task with:

- **ID**: Unique identifier (e.g., PB-001)
- **Title**: Brief description
- **Description**: Detailed requirements
- **Estimate**: Hours/points
- **Dependencies**: Related tasks
- **Labels**: Category tags

### Sync Result

Outcome of a sync operation:

- **Success status**: Boolean
- **Synced count**: Number of items
- **Created issues**: Issue numbers
- **Errors**: Failure messages

## Usage Patterns

### Basic Planning Sync

```typescript
import { syncPlanningToGitHub } from '@repo/github-workflow';

async function syncPlanning() {
  const result = await syncPlanningToGitHub({
    sessionPath: '.claude/sessions/planning/P-001-user-auth',
    github: {
      token: process.env.GITHUB_TOKEN!,
      owner: 'hospeda',
      repo: 'main',
    },
  });

  if (result.success) {
    console.log(`✅ Synced ${result.synced} issues`);
    console.log(`Created: ${result.created.join(', ')}`);
  } else {
    console.error(`❌ Sync failed: ${result.errors.join(', ')}`);
  }
}
```

### TODO Generation

```typescript
import { generateTodos } from '@repo/github-workflow';

async function generateTaskList() {
  const todos = await generateTodos({
    sessionPath: '.claude/sessions/planning/P-001-user-auth',
    outputDir: '.todoLinear',
  });

  console.log(`Generated ${todos.length} TODOs`);

  for (const todo of todos) {
    console.log(`- [${todo.id}] ${todo.title}`);
  }
}
```

### Issue Enrichment

```typescript
import { enrichIssue } from '@repo/github-workflow';

async function enrichWithContext() {
  const result = await enrichIssue({
    issueNumber: 42,
    sessionId: 'P-001',
    github: {
      token: process.env.GITHUB_TOKEN!,
      owner: 'hospeda',
      repo: 'main',
    },
  });

  if (result.success && result.enriched) {
    console.log(`✅ Issue #${result.issueNumber} enriched`);
  }
}
```

## Configuration

### Environment Variables

```bash
# GitHub authentication
GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
GITHUB_OWNER=hospeda
GITHUB_REPO=main

# Planning paths
PLANNING_SESSIONS_DIR=.claude/sessions/planning
TODO_OUTPUT_DIR=.todoLinear

# Features
AUTO_SYNC_ENABLED=true
AUTO_ENRICH_ENABLED=true
```

### Config File

```typescript
// .github-workflow.config.ts
import type { WorkflowConfig } from '@repo/github-workflow';

export default {
  github: {
    token: process.env.GITHUB_TOKEN,
    owner: 'hospeda',
    repo: 'main',
  },
  planning: {
    sessionsDir: '.claude/sessions/planning',
    pdrPattern: '**/PDR.md',
    techAnalysisPattern: '**/tech-analysis.md',
    todosPattern: '**/TODOs.md',
  },
  todos: {
    outputDir: '.todoLinear',
    autoSync: true,
  },
  enrichment: {
    autoEnrich: true,
    triggerLabels: ['planning-sync', 'feature'],
  },
} satisfies WorkflowConfig;
```

## Testing

### Test Structure

```
test/
├── core/
│   ├── orchestrator.test.ts
│   └── state-manager.test.ts
├── sync/
│   ├── issue-sync.test.ts
│   └── todo-sync.test.ts
├── config/
│   └── validator.test.ts
└── utils/
    ├── file-parser.test.ts
    └── markdown-parser.test.ts
```

### Example Test

```typescript
import { describe, it, expect } from 'vitest';
import { syncPlanningToGitHub } from '../src/sync';

describe('syncPlanningToGitHub', () => {
  it('should sync planning session successfully', async () => {
    // Arrange
    const mockSession = {
      sessionPath: '.claude/sessions/planning/P-001-test',
      github: {
        token: 'test-token',
        owner: 'test-owner',
        repo: 'test-repo',
      },
    };

    // Act
    const result = await syncPlanningToGitHub(mockSession);

    // Assert
    expect(result.success).toBe(true);
    expect(result.synced).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle missing planning files', async () => {
    // Arrange
    const mockSession = {
      sessionPath: '.claude/sessions/planning/INVALID',
      github: {
        token: 'test-token',
        owner: 'test-owner',
        repo: 'test-repo',
      },
    };

    // Act
    const result = await syncPlanningToGitHub(mockSession);

    // Assert
    expect(result.success).toBe(false);
    expect(result.errors).toContain('Planning files not found');
  });
});
```

## Best Practices

### 1. Always Validate Configuration

```typescript
import { validateConfig } from '@repo/github-workflow/config';

const config = loadConfig();
const validation = validateConfig(config);

if (!validation.valid) {
  throw new Error(`Invalid config: ${validation.errors.join(', ')}`);
}
```

### 2. Use Dry Run for Testing

```typescript
const result = await syncPlanningToGitHub({
  sessionPath: '...',
  github: { /* ... */ },
  dryRun: true, // No actual changes
});
```

### 3. Handle Errors Gracefully

```typescript
try {
  const result = await syncPlanningToGitHub(config);

  if (!result.success) {
    logger.error('Sync failed', { errors: result.errors });
    // Handle partial success
  }
} catch (error) {
  logger.error('Fatal sync error', { error });
  // Handle complete failure
}
```

### 4. Log Operations

```typescript
import { logger } from '@repo/logger';

logger.info('Starting planning sync', {
  sessionPath: config.sessionPath,
  dryRun: config.dryRun,
});

const result = await syncPlanningToGitHub(config);

logger.info('Sync completed', {
  success: result.success,
  synced: result.synced,
  failed: result.failed,
});
```

## Common Patterns

### Session Discovery

```typescript
import { discoverPlanningSessions } from '@repo/github-workflow/utils';

const sessions = await discoverPlanningSessions({
  baseDir: '.claude/sessions/planning',
  includeArchived: false,
});

for (const session of sessions) {
  console.log(`Found session: ${session.id} - ${session.title}`);
}
```

### Batch Sync

```typescript
import { batchSyncSessions } from '@repo/github-workflow/sync';

const results = await batchSyncSessions({
  sessions: ['P-001', 'P-002', 'P-003'],
  github: { /* ... */ },
  parallel: true,
});

console.log(`Synced ${results.filter(r => r.success).length} sessions`);
```

### Issue Linking

```typescript
import { linkIssueToSession } from '@repo/github-workflow/enrichment';

await linkIssueToSession({
  issueNumber: 42,
  sessionId: 'P-001',
  linkType: 'implements',
});
```

## Integration Points

### With @repo/logger

All operations use centralized logging:

```typescript
import { logger } from '@repo/logger';

logger.info('Operation started', { context });
logger.error('Operation failed', { error });
```

### With Planning Sessions

Reads from `.claude/sessions/planning/` structure:

- Discovers sessions automatically
- Parses PDR.md, tech-analysis.md, TODOs.md
- Extracts metadata and structure

### With GitHub API

Interacts with GitHub via REST API:

- Creates/updates issues
- Manages labels and milestones
- Links related issues

## Troubleshooting

### Common Issues

**1. GitHub API Rate Limiting**

```typescript
// Solution: Use authenticated requests
const result = await syncPlanningToGitHub({
  github: {
    token: process.env.GITHUB_TOKEN, // Increases rate limit
  },
});
```

**2. Planning Files Not Found**

```typescript
// Solution: Verify session path
import { validateSessionPath } from '@repo/github-workflow/utils';

const isValid = await validateSessionPath(sessionPath);
if (!isValid) {
  console.error(`Invalid session path: ${sessionPath}`);
}
```

**3. Duplicate Issues Created**

```typescript
// Solution: Check existing issues first
const result = await syncPlanningToGitHub({
  // ...
  skipDuplicates: true, // Prevents duplicates
});
```

## Key Dependencies

- `@repo/logger` - Logging functionality
- `glob` - File pattern matching
- `zod` - Schema validation

## Notes

- All operations are idempotent (safe to retry)
- Supports dry-run mode for testing
- Automatic error recovery and retry logic
- Comprehensive logging for debugging

## Related Documentation

- [Planning Workflow](.claude/docs/workflows/phase-1-planning.md)
- [Task Completion Protocol](.claude/docs/workflows/task-completion-protocol.md)
- [GitHub Integration Guide](../../docs/github-integration.md)

---

**Next Steps:**

1. Implement core orchestration (`src/core/`)
2. Add GitHub sync functionality (`src/sync/`)
3. Build enrichment features (`src/enrichment/`)
4. Create CLI commands (`src/commands/`)
5. Add comprehensive tests (90% coverage)
