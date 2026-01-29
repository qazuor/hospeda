# Setup Guide

## Overview

This guide will walk you through setting up Claude Code for the Hospeda project, from installation to your first interaction. By the end, you'll have a fully configured AI-assisted development environment.

**Estimated Time**: 30 minutes

## Prerequisites

Before installing Claude Code, ensure you have the following:

### Required Software

#### Node.js 20.10.0+

```bash
# Check version
node --version

# If not installed or version < 20.10.0:
# Download from https://nodejs.org/
# Or use nvm:
nvm install 20
nvm use 20
```

#### PNPM 8.15.6+

```bash
# Check version
pnpm --version

# If not installed:
npm install -g pnpm@8.15.6

# Verify installation
pnpm --version
```

#### Verify installation Git

```bash
# Check version
git --version

# If not installed:
# Ubuntu/Debian:
sudo apt-get install git

# macOS:
brew install git

# Windows:
# Download from https://git-scm.com/
```

#### PostgreSQL 15+ (or Docker)

#### Option A: Local PostgreSQL

```bash
# Ubuntu/Debian:
sudo apt-get install postgresql-15

# macOS:
brew install postgresql@15

# Windows:
# Download from https://www.postgresql.org/download/windows/

# Verify installation
psql --version
```

#### Option B: Docker (Recommended)

```bash
# Check Docker installation
docker --version

# If not installed, follow:
# https://docs.docker.com/get-docker/

# Hospeda includes docker-compose for database
cd hospeda
pnpm db:start
```

### Required Accounts

#### Anthropic API Access

1. Sign up at <https://console.anthropic.com/>
2. Generate API key
3. Save for later configuration

#### GitHub Account

- Required for repository access
- Configure SSH keys or personal access token

### Optional but Recommended

#### IDE with TypeScript Support

- **VS Code** (recommended): <https://code.visualstudio.com/>
- **Cursor**: <https://cursor.sh/>
- **WebStorm**: <https://www.jetbrains.com/webstorm/>

#### Recommended VS Code Extensions

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "astro-build.astro-vscode",
    "ms-playwright.playwright",
    "drizzle-team.drizzle-vscode"
  ]
}
```

## Installation

### Step 1: Clone Hospeda Repository

```bash
# Clone repository
git clone https://github.com/hospeda/hospeda.git
cd hospeda

# Or if using SSH:
git clone git@github.com:hospeda/hospeda.git
cd hospeda
```

### Step 2: Install Project Dependencies

```bash
# Install all dependencies (workspace)
pnpm install

# Verify installation
pnpm --version
node --version
```

**Expected Output:**

```text
Progress: resolved X, reused Y, downloaded Z, added W
Done in Xs
```

### Step 3: Install Claude Code CLI

**Note**: Claude Code is currently in beta. Installation method may vary.

#### Option A: NPM Global Install (Recommended)

```bash
npm install -g @anthropic-ai/claude-code

# Verify installation
claude-code --version
```

#### Option B: Via Anthropic CLI

```bash
# Install Anthropic CLI
npm install -g @anthropic-ai/cli

# Initialize Claude Code
anthropic init claude-code
```

#### Option C: From Source (Development)

```bash
# Clone repository
git clone https://github.com/anthropics/claude-code.git
cd claude-code

# Install dependencies
npm install

# Link globally
npm link

# Verify
claude-code --version
```

### Step 4: Configure Anthropic API Key

#### Option A: Environment Variable

```bash
# Add to ~/.bashrc, ~/.zshrc, or ~/.profile
export ANTHROPIC_API_KEY="your-api-key-here"

# Reload shell
source ~/.bashrc  # or ~/.zshrc
```

#### Option B: Config File

```bash
# Create config directory
mkdir -p ~/.config/claude-code

# Create config file
cat > ~/.config/claude-code/config.json << EOF
{
  "apiKey": "your-api-key-here"
}
EOF

# Secure permissions
chmod 600 ~/.config/claude-code/config.json
```

#### Option C: During First Run

```bash
# Start Claude Code
claude-code

# You'll be prompted for API key on first run
# Follow interactive setup
```

### Step 5: Verify Installation

```bash
# Check Claude Code installation
claude-code --version

# Test API connection
claude-code --test

# Expected output:
# ✓ Claude Code v1.x.x
# ✓ API connection successful
# ✓ Token budget: 200,000
```

## Configuration

### Understanding .claude/ Directory

The Hospeda project includes a `.claude/` directory with project-specific configuration:

```text
.claude/
├── agents/              # 14 specialized agents
│   ├── product-functional.md
│   ├── hono-engineer.md
│   ├── qa-engineer.md
│   └── ...
├── commands/            # 16 commands
│   ├── quality-check.md
│   ├── spec.md
│   └── ...
├── skills/              # 19 skills
│   ├── tdd-methodology.md
│   ├── security-audit.md
│   └── ...
├── docs/                # Internal documentation
│   ├── workflows/
│   ├── standards/
│   └── ...
├── sessions/            # Planning sessions
│   └── planning/
└── settings.json        # Project settings
```

### Understanding CLAUDE.md

The project root contains `CLAUDE.md`, the main coordination file:

**Purpose:**

- Primary reference for Claude Code
- Defines project structure
- Lists agents, commands, skills
- Documents workflows
- Contains coding standards

**Key Sections:**

1. **Agent Identity**: Claude's role and responsibilities
2. **Quick Start**: Getting started guide
3. **Project Essentials**: Tech stack, structure
4. **Workflow Overview**: 3 workflow levels
5. **Development Rules**: Coding standards
6. **Recent Learnings**: Latest discoveries

**Best Practice**: Always keep CLAUDE.md open for reference

### Project Settings

#### settings.json

Located at `.claude/settings.json`:

```json
{
  "version": "1.0.0",
  "project": {
    "name": "hospeda",
    "type": "monorepo",
    "packageManager": "pnpm"
  },
  "agents": {
    "directory": ".claude/agents",
    "count": 14
  },
  "commands": {
    "directory": ".claude/commands",
    "count": 16
  },
  "skills": {
    "directory": ".claude/skills",
    "count": 19
  },
  "workflows": {
    "quickFix": {
      "maxTime": "30m",
      "maxFiles": 2
    },
    "atomicTask": {
      "maxTime": "3h",
      "maxFiles": 10
    },
    "featurePlanning": {
      "phases": 4
    }
  },
  "quality": {
    "minCoverage": 90,
    "linting": true,
    "typeChecking": true
  }
}
```

#### settings.local.json (Optional)

Create `.claude/settings.local.json` for personal preferences:

```json
{
  "preferences": {
    "verbose": true,
    "autoFormat": true,
    "autoTest": false
  },
  "editor": "vscode",
  "terminal": "bash"
}
```

**Note**: This file is gitignored for personal customization

### Environment Variables

Create `.env.local` in project root:

```bash
# Copy template
cp .env.example .env.local

# Edit with your values
nano .env.local  # or your preferred editor
```

**Required Variables:**

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/hospeda_dev"

# Authentication (Clerk)
CLERK_SECRET_KEY="sk_test_..."
CLERK_PUBLISHABLE_KEY="pk_test_..."
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."

# API
API_URL="http://localhost:3000"

# Optional: Anthropic API (if not in shell config)
ANTHROPIC_API_KEY="your-api-key-here"
```

**Obtain Clerk Keys:**

1. Sign up at <https://clerk.com/>
2. Create new application
3. Copy API keys from dashboard

## MCP Server Configuration

MCP (Model Context Protocol) servers extend Claude Code's capabilities. Hospeda uses several:

### Context7 (Library Documentation)

**Purpose**: Access documentation for libraries (Astro, React, Hono, etc.)

**Setup:**

```bash
# Install Context7 MCP server
npm install -g @context7/mcp-server

# Configure in Claude Code
claude-code config add-mcp context7

# Test connection
claude-code mcp test context7
```

**Usage:**

```text
"Show me the Astro documentation for islands"
"How do I use TanStack Query with React Server Components?"
```

### Git

**Purpose**: Git operations (status, diff, log, etc.)

**Setup:**

```bash
# Install Git MCP server
npm install -g @anthropic-ai/mcp-git

# Configure
claude-code config add-mcp git

# Test
claude-code mcp test git
```

**Usage:**

```text
"Show git status"
"What changed in the last commit?"
"Show diff for accommodation.service.ts"
```

### GitHub

**Purpose**: Issue tracking, PR management

**Setup:**

```bash
# Install GitHub MCP server
npm install -g @anthropic-ai/mcp-github

# Configure with personal access token
claude-code config add-mcp github --token "ghp_..."

# Test
claude-code mcp test github
```

**Token Permissions Required:**

- `repo` (full repository access)
- `workflow` (update GitHub Actions)

**Usage:**

```text
"Create GitHub issue for bug in booking service"
"Show open PRs"
"List issues labeled 'bug'"
```

### PostgreSQL/Neon

**Purpose**: Database queries and operations

**Setup:**

```bash
# Install PostgreSQL MCP server
npm install -g @anthropic-ai/mcp-postgres

# Configure with connection string
claude-code config add-mcp postgres \
  --url "postgresql://user:password@localhost:5432/hospeda_dev"

# Test
claude-code mcp test postgres
```

**Usage:**

```text
"Show schema for accommodations table"
"Query bookings for last 7 days"
"Count total users"
```

### Docker (Optional)

**Purpose**: Container management

**Setup:**

```bash
# Install Docker MCP server
npm install -g @anthropic-ai/mcp-docker

# Configure
claude-code config add-mcp docker

# Test
claude-code mcp test docker
```

**Usage:**

```text
"List running containers"
"Show logs for postgres container"
"Restart database container"
```

### Vercel (Optional)

**Purpose**: Deployment operations

**Setup:**

```bash
# Install Vercel MCP server
npm install -g @anthropic-ai/mcp-vercel

# Configure with token
claude-code config add-mcp vercel --token "..."

# Test
claude-code mcp test vercel
```

**Usage:**

```text
"List Vercel deployments"
"Deploy to staging"
"Show deployment logs"
```

### Verification

Check all MCP servers:

```bash
# List configured servers
claude-code mcp list

# Expected output:
# ✓ context7    Connected
# ✓ git         Connected
# ✓ github      Connected
# ✓ postgres    Connected
# ✓ docker      Connected (optional)
# ✓ vercel      Connected (optional)

# Test all servers
claude-code mcp test-all
```

## Database Setup

### Option A: Docker (Recommended)

```bash
# Start PostgreSQL container
pnpm db:start

# Wait for container to be ready (~5 seconds)

# Run migrations
pnpm db:migrate

# Seed database
pnpm db:seed

# Verify
pnpm db:studio
# Opens Drizzle Studio in browser
```

### Option B: Local PostgreSQL

```bash
# Create database
createdb hospeda_dev

# Update .env.local with connection string
DATABASE_URL="postgresql://your-username@localhost:5432/hospeda_dev"

# Run migrations
pnpm db:migrate

# Seed database
pnpm db:seed

# Verify
pnpm db:studio
```

### Database Verification

```bash
# Check connection
psql $DATABASE_URL -c "SELECT version();"

# List tables
psql $DATABASE_URL -c "\dt"

# Expected tables:
# - users
# - accommodations
# - bookings
# - reviews
# - etc.

# Check seed data
psql $DATABASE_URL -c "SELECT COUNT(*) FROM accommodations;"
# Should return > 0
```

## First Interaction

### Starting Claude Code

```bash
# Navigate to Hospeda project
cd /path/to/hospeda

# Start Claude Code
claude-code

# You should see:
# Claude Code v1.x.x
# Project: hospeda (monorepo)
# Agents: 14 | Commands: 16 | Skills: 19
# Ready to assist!
```

### Verify Setup

Run these commands to verify everything is configured:

#### 1. Check Help

```bash
/meta:help
```

**Expected Output:**

```text
Available Commands:

Planning & Task Management:
  /spec                  - Create a specification for features or refactoring
  /tasks                 - View task dashboard
  /next-task             - Get next available task
  /new-task              - Create standalone task
  /task-status           - Detailed progress report
  /replan                - Re-plan tasks

Quality:
  /quality-check         - Comprehensive quality validation
  /code-check            - Code quality check (no tests)
  /run-tests             - Run test suites

Development:
  /add-new-entity        - Scaffold new entity
  /update-docs           - Update documentation

Git:
  /commit                - Generate commit messages

Audit:
  /audit:security-audit       - Security scan
  /audit:performance-audit    - Performance analysis
  /audit:accessibility-audit  - Accessibility check

Meta:
  /meta:help             - Show this help
  /meta:create-agent     - Create new agent
  /meta:create-command   - Create new command
  /meta:create-skill     - Create new skill
```

#### 2. Test Agent System

```text
List all available agents
```

**Expected Response:**

```text
Here are the 14 specialized agents:

Product:
- product-functional: Requirements, PDR creation
- product-technical: Technical analysis, architecture

Leadership:
- tech-lead: Coordination, architecture decisions

Backend:
- hono-engineer: Hono API development
- db-drizzle-engineer: Database, models, migrations
- node-typescript-engineer: Shared packages, utilities

Frontend:
- astro-engineer: Astro web app
- react-senior-dev: React components, hooks
- tanstack-start-engineer: Admin dashboard

Quality:
- qa-engineer: Testing, validation
- debugger: Troubleshooting, issue resolution

Design:
- ux-ui-designer: UI/UX, mockups
- content-writer: Content, copywriting

Specialized:
- tech-writer: Documentation, API specs
```

#### 3. Test MCP Servers

```text
Show git status
```

**Expected Response:**

```text
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
```

#### 4. Test Project Understanding

```text
Explain the Hospeda project structure
```

**Expected Response:**

```text
Hospeda is a monorepo organized with:

Apps (3):
- api: Hono backend API
- web: Astro + React public frontend
- admin: TanStack Start admin dashboard

Packages (9+):
- db: Drizzle ORM, schemas, models
- service-core: Business logic services
- schemas: Zod validation schemas
- utils, logger, config, etc.

Architecture:
Database → Models → Services → API → Frontend

Development:
- TDD with 90% coverage minimum
- TypeScript strict mode
- Monorepo managed by TurboRepo + PNPM
```

#### 5. Test Quality Commands

```bash
/code-check
```

**Expected Process:**

```text
Running code quality checks...

1. Linting... ✓
2. Type checking... ✓
3. Format validation... ✓

All checks passed!
```

### Simple Task Example

Let's test with a simple task:

```text
Create a utility function to format currency in packages/utils/src/currency.ts

Requirements:
- Function name: formatCurrency
- Parameters: amount (number), currency code (string, default 'ARS')
- Return: formatted string
- Use Intl.NumberFormat
- Include JSDoc
- Add unit tests
```

**Expected Claude Response:**

```typescript
// Claude will create the file and show:

// packages/utils/src/currency.ts
/**
 * Format currency amount using Intl.NumberFormat
 *
 * @param amount - Numeric amount to format
 * @param currency - ISO 4217 currency code (default: 'ARS')
 * @returns Formatted currency string
 * @example
 * ```typescript
 * formatCurrency(1234.56, 'ARS'); // "$1.234,56"
 * formatCurrency(1234.56, 'USD'); // "$1,234.56"
 * ```
 */
export function formatCurrency(
  amount: number,
  currency: string = 'ARS'
): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
  }).format(amount);
}

// packages/utils/test/currency.test.ts
import { describe, it, expect } from 'vitest';
import { formatCurrency } from '../src/currency';

describe('formatCurrency', () => {
  it('should format ARS currency', () => {
    expect(formatCurrency(1234.56, 'ARS')).toBe('$1.234,56');
  });

  it('should use ARS as default currency', () => {
    expect(formatCurrency(1000)).toContain('$');
  });

  it('should format USD currency', () => {
    expect(formatCurrency(1234.56, 'USD')).toBe('$1,234.56');
  });

  it('should handle zero', () => {
    expect(formatCurrency(0, 'ARS')).toBe('$0,00');
  });

  it('should handle negative amounts', () => {
    expect(formatCurrency(-100, 'ARS')).toContain('-');
  });
});
```

**Run the test:**

```bash
cd packages/utils && pnpm test currency
```

If tests pass, you're all set!

## Common Setup Issues

### Issue: Claude Code not found

**Symptoms:**

```bash
claude-code: command not found
```

**Solutions:**

1. Verify installation:

   ```bash
   npm list -g @anthropic-ai/claude-code
   ```

1. Check PATH:

   ```bash
   echo $PATH
   npm config get prefix
   ```

1. Reinstall:

   ```bash
   npm uninstall -g @anthropic-ai/claude-code
   npm install -g @anthropic-ai/claude-code
   ```

### Issue: API Key Invalid

**Symptoms:**

```text
Error: Invalid API key
```

**Solutions:**

1. Verify API key:

   ```bash
   echo $ANTHROPIC_API_KEY
   ```

1. Check key format (should start with `sk-ant-`)

1. Regenerate key at <https://console.anthropic.com/>

1. Update environment:

   ```bash
   export ANTHROPIC_API_KEY="sk-ant-..."
   source ~/.bashrc
   ```

### Issue: MCP Server Connection Failed

**Symptoms:**

```text
Error: MCP server 'context7' connection failed
```

**Solutions:**

1. Check server installation:

   ```bash
   npm list -g @context7/mcp-server
   ```

1. Reinstall server:

   ```bash
   npm install -g @context7/mcp-server
   ```

1. Reconfigure:

   ```bash
   claude-code config remove-mcp context7
   claude-code config add-mcp context7
   ```

1. Test connection:

   ```bash
   claude-code mcp test context7
   ```

### Issue: Database Connection Failed

**Symptoms:**

```text
Error: Could not connect to database
```

**Solutions:**

1. Check PostgreSQL status:

   ```bash
   # Docker:
   docker ps | grep postgres

   # Local:
   sudo systemctl status postgresql
   ```

1. Verify connection string:

   ```bash
   echo $DATABASE_URL
   ```

1. Test connection:

   ```bash
   psql $DATABASE_URL -c "SELECT 1;"
   ```

1. Restart database:

   ```bash
   # Docker:
   pnpm db:restart

   # Local:
   sudo systemctl restart postgresql
   ```

### Issue: Agents/Commands Not Found

**Symptoms:**

```text
Error: Agent 'hono-engineer' not found
```

**Solutions:**

1. Verify .claude/ directory:

   ```bash
   ls -la .claude/agents/
   ```

1. Check current directory:

   ```bash
   pwd  # Should be in hospeda project root
   ```

1. Reload Claude Code:

   ```bash
   # Exit and restart
   exit
   claude-code
   ```

### Issue: Permission Denied

**Symptoms:**

```text
Error: EACCES: permission denied
```

**Solutions:**

1. Fix npm permissions:

   ```bash
   mkdir ~/.npm-global
   npm config set prefix '~/.npm-global'
   echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
   source ~/.bashrc
   ```

1. Reinstall without sudo:

   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

### Issue: Token Budget Exceeded

**Symptoms:**

```text
Error: Token budget exceeded
```

**Solutions:**

1. Start new conversation:

   ```bash
   exit
   claude-code
   ```

1. Be more specific:

   ```text
   # Instead of "show all files"
   "show packages/db/src/models/accommodation.model.ts"
   ```

1. Use memory for persistent context:

   ```text
   /add-memory "Hospeda uses RO-RO pattern for all functions"
   ```

## IDE Integration

### VS Code Setup

#### Install Extensions

```bash
# Open VS Code in Hospeda directory
code .

# Install recommended extensions (from .vscode/extensions.json)
# Or manually install:
# - ESLint
# - Prettier
# - Tailwind CSS IntelliSense
# - Astro
# - Playwright
# - Drizzle
```

#### Configure Settings

Create/update `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "files.associations": {
    "*.css": "tailwindcss"
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

#### Keyboard Shortcuts (Optional)

Add to `.vscode/keybindings.json`:

```json
[
  {
    "key": "ctrl+shift+t",
    "command": "workbench.action.terminal.new",
    "when": "!terminalFocus"
  },
  {
    "key": "ctrl+shift+c",
    "command": "workbench.action.terminal.sendSequence",
    "args": { "text": "claude-code\n" },
    "when": "terminalFocus"
  }
]
```

### Cursor Setup

Cursor has built-in Claude integration:

1. Install Cursor from <https://cursor.sh/>
2. Open Hospeda project
3. Configure Claude API key in settings
4. Enable "Claude Code" mode

### Terminal Setup

For best experience:

```bash
# Add alias to ~/.bashrc or ~/.zshrc
alias cc="claude-code"
alias ccstart="cd ~/projects/hospeda && claude-code"

# Reload
source ~/.bashrc
```

## Verification Checklist

Before proceeding, verify:

- [ ] Node.js 20.10.0+ installed
- [ ] PNPM 8.15.6+ installed
- [ ] Git configured
- [ ] PostgreSQL running (Docker or local)
- [ ] Claude Code CLI installed
- [ ] Anthropic API key configured
- [ ] Hospeda repository cloned
- [ ] Project dependencies installed
- [ ] Database migrated and seeded
- [ ] .env.local configured
- [ ] MCP servers configured (at least Context7, Git)
- [ ] `/meta:help` command works
- [ ] Agents list displays correctly
- [ ] Git status accessible
- [ ] Simple task completes successfully

## Next Steps

Setup complete! Now:

1. **[Best Practices](./best-practices.md)** - Learn effective AI-assisted development
2. **[Workflows](./workflows.md)** - Master Hospeda-specific workflows
3. **[Introduction](./introduction.md)** - Deeper understanding of Claude Code
4. **[Resources](./resources.md)** - Additional learning materials

## Changelog

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0.0 | 2025-01-15 | Initial setup guide | tech-writer |

---

**Setup complete?** Start with [Best Practices](./best-practices.md).

**Having issues?** Check the [Common Setup Issues](#common-setup-issues) section above.
