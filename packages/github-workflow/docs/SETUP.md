# Setup Guide

Complete guide to setting up and configuring the GitHub Workflow automation package.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [GitHub Configuration](#github-configuration)
- [Project Configuration](#project-configuration)
- [Git Hooks Setup](#git-hooks-setup)
- [Claude Code Integration](#claude-code-integration)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required

- **Node.js**: >= 18.0.0
- **pnpm**: >= 8.0.0
- **Git**: >= 2.40.0
- **GitHub Account**: With repository access
- **GitHub Token**: Personal Access Token with `repo` scope

### Optional

- **VSCode**: For VSCode link integration
- **Claude Code**: For AI-powered enrichment

## Initial Setup

### 1. Install Dependencies

From the monorepo root:

```bash
pnpm install
```

### 2. Build the Package

```bash
# From monorepo root
pnpm --filter=@repo/github-workflow build

# Or from package directory
cd packages/github-workflow
pnpm build
```

### 3. Verify Installation

```bash
pnpm --filter=@repo/github-workflow test
```

All tests should pass.

## GitHub Configuration

### 1. Create Personal Access Token

1. Go to [GitHub Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Give it a descriptive name (e.g., "Hospeda Workflow Automation")
4. Select scopes:
   - ✅ `repo` (Full control of private repositories)
   - ✅ `workflow` (Update GitHub Actions workflows)
5. Click "Generate token"
6. **IMPORTANT**: Copy the token immediately (you won't see it again)

### 2. Configure Environment Variables

Create `.env.local` in your project root:

```bash
# Required
GITHUB_TOKEN=ghp_your_token_here
GH_OWNER=your-github-username
GH_REPO=your-repo-name

# Optional (for project mapping)
GITHUB_PROJECT_GENERAL=Hospeda
GITHUB_PROJECT_API=Hospeda API
GITHUB_PROJECT_ADMIN=Hospeda Admin
GITHUB_PROJECT_WEB=Hospeda Web
```

### 3. Verify GitHub Access

```bash
# Test GitHub connection
node -e "
const { Octokit } = require('@octokit/rest');
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
octokit.rest.users.getAuthenticated().then(({ data }) => {
  console.log('✅ Authenticated as:', data.login);
}).catch(err => {
  console.error('❌ Authentication failed:', err.message);
});
"
```

## Project Configuration

### Configuration File

Create `.github-workflow.config.ts` in your project root:

```typescript
import type { WorkflowConfig } from '@repo/github-workflow';

export default {
  // GitHub configuration
  github: {
    token: process.env.GITHUB_TOKEN!,
    owner: process.env.GH_OWNER || 'hospeda',
    repo: process.env.GH_REPO || 'main',

    // GitHub Projects mapping
    projects: {
      general: 'Hospeda',
      api: 'Hospeda API',
      admin: 'Hospeda Admin',
      web: 'Hospeda Web',
    },

    // Project path mapping
    projectMapping: {
      'apps/api/**': 'api',
      'apps/admin/**': 'admin',
      'apps/web/**': 'web',
      'packages/**': 'general',
    },
  },

  // Planning sync configuration
  sync: {
    planning: {
      enabled: true,
      autoSync: false,  // Manual sync for safety
      projectTemplate: 'Planning: {featureName}',
    },

    todos: {
      enabled: true,
      types: ['TODO', 'HACK', 'DEBUG'],
      excludePaths: [
        'node_modules',
        'dist',
        '.turbo',
        'coverage',
        '*.test.ts',
      ],
    },
  },

  // Label configuration
  labels: {
    universal: 'from:claude-code',

    autoGenerate: {
      type: true,      // task, bug, feature, etc.
      app: true,       // api, admin, web
      priority: true,  // low, medium, high, critical
    },

    // Custom label definitions
    custom: {
      'planning-task': {
        color: '0366d6',
        description: 'Task from planning session',
      },
      'ai-enriched': {
        color: '7057ff',
        description: 'Enriched by AI agent',
      },
    },
  },

  // Completion detection
  detection: {
    autoComplete: true,
    requireTests: true,
    requireCoverage: 90,
  },

  // Issue enrichment
  enrichment: {
    enabled: true,
    contextLines: 10,
    agent: 'general-purpose',  // Claude Code agent to use
  },

  // Git hooks
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

  // Templates
  templates: {
    issue: {
      planningTask: '.github/ISSUE_TEMPLATE/planning-task.md',
      codeTodo: '.github/ISSUE_TEMPLATE/code-todo.md',
      codeHack: '.github/ISSUE_TEMPLATE/code-hack.md',
    },
  },
} satisfies WorkflowConfig;
```

See [CONFIGURATION.md](./CONFIGURATION.md) for all available options.

## Git Hooks Setup

### Automatic Setup (Recommended)

Git hooks are automatically set up when you install dependencies:

```bash
pnpm install
```

This creates:

- `.husky/pre-commit` - Runs linting, type checking, formatting
- `.husky/post-commit` - Detects completed tasks from commit messages
- `.husky/commit-msg` - Validates commit message format

### Manual Setup

If hooks aren't working:

```bash
# Initialize Husky
npx husky install

# Create pre-commit hook
npx husky add .husky/pre-commit "pnpm run pre-commit-checks"

# Create post-commit hook
npx husky add .husky/post-commit "pnpm --filter=@repo/github-workflow run hook:post-commit"

# Make hooks executable
chmod +x .husky/pre-commit .husky/post-commit
```

### Verify Hooks

```bash
# Trigger pre-commit manually
./.husky/pre-commit

# Should run: lint, typecheck, format check
```

## Claude Code Integration

### Setup Claude Code Agent

If you want AI-powered issue enrichment:

1. **Install Claude Code** (if not already)
   - Follow [Claude Code setup guide](https://docs.claude.com/code)

2. **Configure Agent**

   In your `.claude/agents/enrichment-agent.md`:

   ```markdown
   # Enrichment Agent

   Specialized agent for enriching GitHub issues with planning context.

   ## Capabilities

   - Analyze planning documents (PDR, tech-analysis)
   - Extract relevant context and requirements
   - Suggest implementation approach
   - Identify dependencies and risks
   - Estimate effort and complexity

   ## Usage

   This agent is automatically invoked during issue enrichment.
   ```

3. **Test Integration**

   ```bash
   # Enrich a test issue
   pnpm --filter=@repo/github-workflow run test:enrichment
   ```

## Verification

### 1. Verify Configuration

```bash
cd packages/github-workflow
pnpm run verify:config
```

This checks:

- ✅ GitHub token is valid
- ✅ Repository is accessible
- ✅ Configuration file is valid
- ✅ All required fields are present

### 2. Test Planning Sync

```bash
# Dry run (no actual changes)
pnpm planning:sync .claude/sessions/planning/P-001-test --dry-run

# Should show what would be synced
```

### 3. Test Git Hooks

```bash
# Make a test commit
echo "test" >> test.txt
git add test.txt
git commit -m "test: verify hooks"

# Should run:
# - Pre-commit: lint, typecheck
# - Post-commit: completion detection
```

### 4. Run Full Test Suite

```bash
pnpm --filter=@repo/github-workflow test:coverage

# Should have >= 90% coverage
```

## Post-Setup Configuration

### Labels Setup

Ensure required labels exist in your repository:

```bash
pnpm --filter=@repo/github-workflow run setup:labels

# Creates:
# - Planning labels (planning-task, feature, etc.)
# - Type labels (task, bug, enhancement)
# - Priority labels (low, medium, high, critical)
# - App labels (api, admin, web)
# - Status labels (in-progress, completed, blocked)
```

### Issue Templates

Issue templates should be created at:

```
.github/
└── ISSUE_TEMPLATE/
    ├── planning-task.md
    ├── code-todo.md
    └── code-hack.md
```

These are automatically created during setup.

### VSCode Integration

For VSCode links to work:

1. **Configure VSCode protocol handler**

   In your VSCode `settings.json`:

   ```json
   {
     "workbench.editor.enablePreview": false,
     "workbench.editor.revealIfOpen": true
   }
   ```

2. **Test VSCode links**

   Click a link in format: `vscode://file//path/to/file:42`

## Troubleshooting

### GitHub Token Issues

**Problem**: Authentication failed

**Solutions**:

1. Verify token has `repo` scope
2. Check token hasn't expired
3. Ensure token is in `.env.local`
4. Try regenerating token

### Hooks Not Running

**Problem**: Git hooks don't execute

**Solutions**:

1. Run `npx husky install`
2. Check hooks are executable: `ls -la .husky/`
3. Make executable: `chmod +x .husky/*`
4. Verify Husky is installed: `pnpm ls husky`

### Configuration Not Loading

**Problem**: Config file not found

**Solutions**:

1. Check file name: `.github-workflow.config.ts`
2. Verify location: project root
3. Check TypeScript compilation
4. Try JSON format: `.github-workflowrc.json`

### Tests Failing

**Problem**: Test suite fails

**Solutions**:

1. Clean build: `pnpm run clean && pnpm install`
2. Rebuild: `pnpm run build`
3. Check Node version: `node --version` (>= 18)
4. Clear cache: `rm -rf node_modules/.cache`

For more issues, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).

## Next Steps

After setup is complete:

1. ✅ Read [Configuration Guide](./CONFIGURATION.md) for all options
2. ✅ Review [API Reference](./API.md) for programmatic usage
3. ✅ Check [Troubleshooting Guide](./TROUBLESHOOTING.md) for common issues
4. ✅ Start using: Sync your first planning session!

## Support

- **Documentation**: See `packages/github-workflow/docs/`
- **Issues**: Create issue in repository
- **Contact**: Hospeda Development Team

---

**Setup completed? Test it:**

```bash
# Sync a planning session
pnpm planning:sync .claude/sessions/planning/P-001-your-feature

# Should create GitHub issues for all tasks 🎉
```
