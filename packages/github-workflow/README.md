# @repo/github-workflow

GitHub workflow automation package for planning synchronization, TODO generation, and issue enrichment.

## Overview

This package provides comprehensive automation for GitHub workflows in the Hospeda project, including:

- **Planning Sync**: Automatically sync planning sessions to GitHub Issues
- **TODO Generation**: Generate structured TODOs from planning documents
- **Issue Enrichment**: Enrich GitHub Issues with planning context
- **Git Hooks**: Enforce workflow compliance via git hooks

## Installation

This is an internal package in the Hospeda monorepo. It's automatically available to other packages via workspace protocol.

```json
{
  "dependencies": {
    "@repo/github-workflow": "workspace:*"
  }
}
```

## Usage

### GitHub Client

Basic usage of the GitHub API client:

```typescript
import { GitHubClient } from '@repo/github-workflow/core';

// Initialize client
const client = new GitHubClient({
  token: process.env.GITHUB_TOKEN!,
  owner: 'hospeda',
  repo: 'main',
});

// Create an issue
const issueNumber = await client.createIssue({
  title: 'Implement user authentication',
  body: 'Add JWT-based authentication system',
  labels: ['feature', 'priority-high'],
  assignees: ['developer'],
});

// Update an issue
await client.updateIssue(issueNumber, {
  state: 'closed',
});

// Link issues (parent-child)
await client.linkIssues(parentIssueNumber, childIssueNumber);

// Create and add labels
await client.createLabel({
  name: 'priority-high',
  color: 'FF0000',
  description: 'High priority items',
});

await client.addLabels(issueNumber, ['bug', 'needs-review']);
```

### Planning Sync

Sync a planning session to GitHub Issues:

```typescript
import { syncPlanningToGitHub } from '@repo/github-workflow';

const result = await syncPlanningToGitHub({
  sessionPath: '.claude/sessions/planning/P-001-feature-name',
  github: {
    token: process.env.GITHUB_TOKEN,
    owner: 'your-org',
    repo: 'your-repo',
  },
});

console.log(`Synced ${result.synced} issues`);
```

### TODO Generation

Generate TODOs from planning documents:

```typescript
import { generateTodos } from '@repo/github-workflow';

const todos = await generateTodos({
  sessionPath: '.claude/sessions/planning/P-001-feature-name',
  outputDir: '.todoLinear',
});

console.log(`Generated ${todos.length} TODOs`);
```

### Issue Enrichment

Enrich a GitHub Issue with planning context:

```typescript
import { enrichIssue } from '@repo/github-workflow';

const result = await enrichIssue({
  issueNumber: 123,
  sessionId: 'P-001',
  github: {
    token: process.env.GITHUB_TOKEN,
    owner: 'your-org',
    repo: 'your-repo',
  },
});
```

## CLI Commands

The package provides CLI commands for common tasks:

```bash
# Sync planning to GitHub
pnpm planning:sync <session-path>

# Generate TODOs
pnpm planning:generate-todos <session-path>

# Enrich issue
pnpm planning:enrich-issue <issue-number> <session-id>
```

## Configuration

The package uses **cosmiconfig** for flexible configuration loading with **Zod** validation.

### Configuration Sources (Priority Order)

1. **Config File** (highest priority)
2. **Environment Variables**
3. **Defaults** (lowest priority)

### Config File

Create one of these files in your project root:

- `.github-workflow.config.ts` (recommended)
- `.github-workflow.config.js`
- `.github-workflowrc.json`
- `.github-workflowrc.yaml`
- `package.json` (field: `github-workflow`)

**Example:**

```typescript
// .github-workflow.config.ts
import type { WorkflowConfig } from '@repo/github-workflow';

export default {
  github: {
    token: process.env.GITHUB_TOKEN!,
    owner: 'hospeda',
    repo: 'main',
    projects: {
      general: 'Hospeda',
      api: 'Hospeda API',
      admin: 'Hospeda Admin',
      web: 'Hospeda Web',
    },
  },
  sync: {
    planning: {
      enabled: true,
      autoSync: false,
      projectTemplate: 'Planning: {featureName}',
    },
    todos: {
      enabled: true,
      types: ['TODO', 'HACK', 'DEBUG'],
      excludePaths: ['node_modules', 'dist'],
    },
  },
  labels: {
    universal: 'from:claude-code',
    autoGenerate: {
      type: true,
      app: true,
      priority: true,
    },
  },
  detection: {
    autoComplete: true,
    requireTests: true,
    requireCoverage: 90,
  },
  enrichment: {
    enabled: true,
    contextLines: 10,
    agent: 'general-purpose',
  },
} satisfies WorkflowConfig;
```

See [.github-workflow.config.example.ts](.github-workflow.config.example.ts) for complete configuration options.

### Environment Variables

```bash
# Required (if no config file)
GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
GH_OWNER=hospeda
GH_REPO=main
```

### Loading Configuration

```typescript
import { loadConfig } from '@repo/github-workflow/config';

// Load from all sources (file + env + defaults)
const config = await loadConfig();

console.log(config.github.token);
console.log(config.sync?.planning?.enabled); // From defaults if not specified
```

### Validation

All configuration is validated with Zod schemas. Invalid configuration throws detailed errors:

```typescript
import { validateConfig } from '@repo/github-workflow/config';

try {
  const config = validateConfig({
    github: {
      token: '', // Invalid: empty string
      owner: 'hospeda',
      repo: 'main',
    },
  });
} catch (error) {
  console.error(error.message);
  // Configuration validation failed:
  // github.token: GitHub token is required
}
```

### Default Values

See [src/config/defaults.ts](src/config/defaults.ts) for complete list of defaults:

- Planning sync: **enabled**
- TODO sync: **enabled**
- Auto-complete detection: **enabled**
- Test coverage requirement: **90%**
- Enrichment: **enabled**
- Git hooks: **enabled**

## Architecture

```
src/
├── core/          # Core workflow orchestration
├── sync/          # GitHub sync functionality
├── enrichment/    # Issue enrichment
├── config/        # Configuration management
├── commands/      # CLI commands
├── scripts/       # Executable scripts
├── hooks/         # Git hooks
├── types/         # Type definitions
└── utils/         # Utility functions
```

## Development

```bash
# Install dependencies
pnpm install

# Build package
pnpm build

# Type check
pnpm typecheck

# Run tests
pnpm test

# Watch mode
pnpm dev
```

## Testing

The package follows TDD with 90% minimum coverage:

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage
```

## Key Features

### Planning Session Discovery

Automatically discovers planning sessions by scanning for PDR.md, tech-analysis.md, and TODOs.md files.

### Smart Issue Mapping

Maps planning TODOs to GitHub Issues with bidirectional linking and state tracking.

### Context Enrichment

Enriches issues with:

- Planning session links
- Related documents (PDR, tech analysis)
- Dependencies and relationships
- Estimated effort and complexity

### Workflow Validation

Validates workflow compliance:

- Ensures all TODOs have corresponding issues
- Verifies planning documents are complete
- Checks for broken references

## Contributing

This package follows the Hospeda development standards:

- **TDD**: Write tests first
- **90% Coverage**: Minimum requirement
- **TypeScript**: Strict mode enabled
- **Named Exports**: No default exports
- **JSDoc**: All public APIs documented

See [CLAUDE.md](./CLAUDE.md) for detailed development guidelines.

## License

Private - Internal use only

## Related Packages

- `@repo/logger` - Logging functionality
- `@repo/config` - Configuration management

## Documentation

- [CLAUDE.md](./CLAUDE.md) - Package-specific development guide
- [PDR.md](.claude/sessions/planning/P-005-mockup-generation/PDR.md) - Planning document
- [Architecture Docs](../../docs/architecture/) - System architecture

---

**Status**: 🚧 In Development

**Version**: 0.1.0

**Maintained by**: Hospeda Development Team
