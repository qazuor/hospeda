# Configuration Reference

Complete reference for all configuration options in the GitHub Workflow package.

## Table of Contents

- [Configuration Sources](#configuration-sources)
- [GitHub Configuration](#github-configuration)
- [Sync Configuration](#sync-configuration)
- [Label Configuration](#label-configuration)
- [Detection Configuration](#detection-configuration)
- [Enrichment Configuration](#enrichment-configuration)
- [Hooks Configuration](#hooks-configuration)
- [Templates Configuration](#templates-configuration)
- [Advanced Configuration](#advanced-configuration)

## Configuration Sources

The package uses **cosmiconfig** for flexible configuration loading:

### Priority Order (Highest to Lowest)

1. **Config File** - `.github-workflow.config.ts` (or other formats)
2. **Environment Variables** - `GITHUB_TOKEN`, `GH_OWNER`, etc.
3. **Defaults** - Built-in defaults

### Supported File Formats

```
.github-workflow.config.ts      (TypeScript, recommended)
.github-workflow.config.js      (JavaScript)
.github-workflow.config.mjs     (ES Module)
.github-workflow.config.cjs     (CommonJS)
.github-workflowrc.json         (JSON)
.github-workflowrc.yaml         (YAML)
.github-workflowrc.yml          (YAML)
package.json                    (field: "github-workflow")
```

## GitHub Configuration

```typescript
{
  github: {
    // Required: GitHub authentication token
    token: string;

    // Required: Repository owner
    owner: string;

    // Required: Repository name
    repo: string;

    // Optional: GitHub Projects mapping
    projects?: {
      general: string;    // General project name
      api: string;        // API project name
      admin: string;      // Admin project name
      web: string;        // Web project name
    };

    // Optional: File path to project mapping
    projectMapping?: Record<string, string>;
  }
}
```

### Example

```typescript
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

  projectMapping: {
    'apps/api/**': 'api',
    'apps/admin/**': 'admin',
    'apps/web/**': 'web',
    'packages/**': 'general',
  },
}
```

### Environment Variables

```bash
GITHUB_TOKEN=ghp_xxx  # Required
GH_OWNER=hospeda      # Required
GH_REPO=main          # Required

# Optional projects
GITHUB_PROJECT_GENERAL=Hospeda
GITHUB_PROJECT_API="Hospeda API"
GITHUB_PROJECT_ADMIN="Hospeda Admin"
GITHUB_PROJECT_WEB="Hospeda Web"
```

## Sync Configuration

```typescript
{
  sync: {
    // Planning sync configuration
    planning: {
      // Enable planning sync
      enabled: boolean;  // default: true

      // Auto-sync on planning changes
      autoSync: boolean;  // default: false

      // Project template for planning sessions
      projectTemplate: string;  // default: 'Planning: {featureName}'
    };

    // TODO sync configuration
    todos: {
      // Enable TODO sync
      enabled: boolean;  // default: true

      // TODO comment types to track
      types: string[];  // default: ['TODO', 'HACK', 'DEBUG']

      // Paths to exclude from scanning
      excludePaths: string[];  // default: ['node_modules', 'dist']
    };
  }
}
```

### Example

```typescript
sync: {
  planning: {
    enabled: true,
    autoSync: false,  // Manual sync for safety
    projectTemplate: 'P-{sessionId}: {featureName}',
  },

  todos: {
    enabled: true,
    types: ['TODO', 'HACK', 'DEBUG', 'FIXME'],
    excludePaths: [
      'node_modules',
      'dist',
      '.turbo',
      'coverage',
      '*.test.ts',
      '*.spec.ts',
    ],
  },
}
```

## Label Configuration

```typescript
{
  labels: {
    // Universal label added to all issues
    universal: string;  // default: 'from:claude-code'

    // Auto-generate labels
    autoGenerate: {
      type: boolean;      // task, bug, feature, etc.
      app: boolean;       // api, admin, web
      priority: boolean;  // low, medium, high, critical
    };

    // Custom label definitions
    custom: Record<string, {
      color: string;        // Hex color (without #)
      description: string;  // Label description
    }>;
  }
}
```

### Example

```typescript
labels: {
  universal: 'from:claude-code',

  autoGenerate: {
    type: true,
    app: true,
    priority: true,
  },

  custom: {
    'planning-task': {
      color: '0366d6',
      description: 'Task from planning session',
    },
    'ai-enriched': {
      color: '7057ff',
      description: 'Enriched by AI agent',
    },
    'needs-review': {
      color: 'fbca04',
      description: 'Requires code review',
    },
    'blocked': {
      color: 'd73a4a',
      description: 'Blocked by dependency',
    },
  },
}
```

### Auto-Generated Labels

#### Type Labels

- `task` - Implementation task
- `bug` - Bug fix
- `feature` - New feature
- `enhancement` - Improvement
- `refactor` - Code refactoring
- `docs` - Documentation
- `chore` - Maintenance

#### App Labels

- `app:api` - Backend API
- `app:admin` - Admin dashboard
- `app:web` - Public web app
- `app:shared` - Shared packages

#### Priority Labels

- `priority:low` - Low priority
- `priority:medium` - Medium priority
- `priority:high` - High priority
- `priority:critical` - Critical priority

## Detection Configuration

```typescript
{
  detection: {
    // Auto-detect completed tasks from commits
    autoComplete: boolean;  // default: true

    // Require tests for completion
    requireTests: boolean;  // default: true

    // Minimum test coverage required
    requireCoverage: number;  // default: 90
  }
}
```

### Example

```typescript
detection: {
  autoComplete: true,
  requireTests: true,
  requireCoverage: 90,  // 90% minimum
}
```

## Enrichment Configuration

```typescript
{
  enrichment: {
    // Enable issue enrichment
    enabled: boolean;  // default: true

    // Number of context lines to include
    contextLines: number;  // default: 10

    // Claude Code agent to use
    agent: string;  // default: 'general-purpose'
  }
}
```

### Example

```typescript
enrichment: {
  enabled: true,
  contextLines: 15,  // More context
  agent: 'product-technical',  // Use specialized agent
}
```

### Available Agents

- `general-purpose` - General-purpose agent
- `product-technical` - Technical analysis
- `product-functional` - Functional requirements
- `tech-lead` - Architecture oversight
- `hono-engineer` - API implementation
- `react-senior-dev` - React components
- `db-engineer` - Database design

## Hooks Configuration

```typescript
{
  hooks: {
    // Pre-commit hook
    preCommit: {
      // Enable pre-commit hook
      enabled: boolean;  // default: true

      // Checks to run
      checks: string[];  // default: ['lint', 'typecheck', 'test']
    };

    // Post-commit hook
    postCommit: {
      // Enable post-commit hook
      enabled: boolean;  // default: true

      // Detect completed tasks
      detectCompletedTasks: boolean;  // default: true
    };
  }
}
```

### Example

```typescript
hooks: {
  preCommit: {
    enabled: true,
    checks: [
      'lint',       // Run linter
      'typecheck',  // Type checking
      'test',       // Run tests
      'format',     // Check formatting
    ],
  },

  postCommit: {
    enabled: true,
    detectCompletedTasks: true,
  },
}
```

## Templates Configuration

```typescript
{
  templates: {
    issue: {
      // Planning task template
      planningTask: string;  // Path to template file

      // Code TODO template
      codeTodo: string;  // Path to template file

      // Code HACK template
      codeHack: string;  // Path to template file
    };
  }
}
```

### Example

```typescript
templates: {
  issue: {
    planningTask: '.github/ISSUE_TEMPLATE/planning-task.md',
    codeTodo: '.github/ISSUE_TEMPLATE/code-todo.md',
    codeHack: '.github/ISSUE_TEMPLATE/code-hack.md',
  },
}
```

### Template Format

Issue templates use GitHub-flavored markdown with frontmatter:

```markdown
---
name: Planning Task
about: Task from planning session
title: "[TASK] "
labels: ["planning-task", "task"]
assignees: []
---

## Description

<!-- Task description -->

## Planning Session

<!-- Link to planning session -->

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Related Files

<!-- Files that will be modified -->
```

## Advanced Configuration

### Tracking Path

```typescript
{
  tracking: {
    // Path to tracking file
    path: string;  // default: '.github-workflow/tracking.json'
  }
}
```

### Completion Configuration

```typescript
{
  completion: {
    // Enable completion detection
    enabled: boolean;  // default: true

    // Commit patterns to detect
    patterns: string[];  // default: ['^(feat|fix|refactor)\\(.*\\):.*T-\\d+-\\d+']
  }
}
```

### Retry Configuration

```typescript
{
  retry: {
    // Max retry attempts
    maxAttempts: number;  // default: 3

    // Retry delay in ms
    delay: number;  // default: 1000

    // Exponential backoff
    backoff: boolean;  // default: true
  }
}
```

## Complete Example

```typescript
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
    projectMapping: {
      'apps/api/**': 'api',
      'apps/admin/**': 'admin',
      'apps/web/**': 'web',
      'packages/**': 'general',
    },
  },

  sync: {
    planning: {
      enabled: true,
      autoSync: false,
      projectTemplate: 'P-{sessionId}: {featureName}',
    },
    todos: {
      enabled: true,
      types: ['TODO', 'HACK', 'DEBUG', 'FIXME'],
      excludePaths: [
        'node_modules',
        'dist',
        '.turbo',
        'coverage',
        '*.test.ts',
        '*.spec.ts',
      ],
    },
  },

  labels: {
    universal: 'from:claude-code',
    autoGenerate: {
      type: true,
      app: true,
      priority: true,
    },
    custom: {
      'planning-task': {
        color: '0366d6',
        description: 'Task from planning session',
      },
      'ai-enriched': {
        color: '7057ff',
        description: 'Enriched by AI agent',
      },
      'needs-review': {
        color: 'fbca04',
        description: 'Requires code review',
      },
      'blocked': {
        color: 'd73a4a',
        description: 'Blocked by dependency',
      },
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

  hooks: {
    preCommit: {
      enabled: true,
      checks: ['lint', 'typecheck', 'test'],
    },
    postCommit: {
      enabled: true,
      detectCompletedTasks: true,
    },
  },

  templates: {
    issue: {
      planningTask: '.github/ISSUE_TEMPLATE/planning-task.md',
      codeTodo: '.github/ISSUE_TEMPLATE/code-todo.md',
      codeHack: '.github/ISSUE_TEMPLATE/code-hack.md',
    },
  },

  tracking: {
    path: '.github-workflow/tracking.json',
  },

  completion: {
    enabled: true,
    patterns: [
      '^(feat|fix|refactor)\\(.*\\):.*T-\\d+-\\d+',
      '^(feat|fix|refactor):\\s*.*\\(T-\\d+-\\d+\\)',
    ],
  },

  retry: {
    maxAttempts: 3,
    delay: 1000,
    backoff: true,
  },
} satisfies WorkflowConfig;
```

## Validation

All configuration is validated using Zod schemas. Invalid configuration will throw detailed errors:

```typescript
import { validateConfig } from '@repo/github-workflow/config';

try {
  const config = validateConfig(yourConfig);
  console.log('✅ Configuration valid');
} catch (error) {
  console.error('❌ Configuration invalid:', error.message);
}
```

## Environment Variable Reference

### Required

```bash
GITHUB_TOKEN=ghp_xxx    # GitHub Personal Access Token
GH_OWNER=hospeda        # Repository owner
GH_REPO=main            # Repository name
```

### Optional

```bash
# GitHub Projects
GITHUB_PROJECT_GENERAL=Hospeda
GITHUB_PROJECT_API="Hospeda API"
GITHUB_PROJECT_ADMIN="Hospeda Admin"
GITHUB_PROJECT_WEB="Hospeda Web"

# Tracking
TRACKING_PATH=.github-workflow/tracking.json

# Features
AUTO_COMPLETE=true
REQUIRE_TESTS=true
REQUIRE_COVERAGE=90

# Enrichment
ENRICHMENT_ENABLED=true
ENRICHMENT_CONTEXT_LINES=10
ENRICHMENT_AGENT=general-purpose
```

## TypeScript Support

Full TypeScript support with type inference:

```typescript
import type { WorkflowConfig } from '@repo/github-workflow';

// Config is fully typed
const config: WorkflowConfig = {
  github: {
    token: process.env.GITHUB_TOKEN!,
    owner: 'hospeda',
    repo: 'main',
  },
  // ... IDE autocomplete available
};
```

## See Also

- [Setup Guide](./SETUP.md) - Initial setup instructions
- [API Reference](./API.md) - Programmatic API
- [Troubleshooting](./TROUBLESHOOTING.md) - Common issues

---

**Need help?** See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) or create an issue.
