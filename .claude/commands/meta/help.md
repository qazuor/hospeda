---
name: help
type: meta
category: system
description: Interactive help system providing guidance on commands, agents, skills, workflow, and project structure
---

# Help Command

## Purpose

Provides comprehensive, context-aware help for the Hospeda project workflow system. This command offers interactive assistance on commands, agents, skills, workflow phases, and project structure, helping developers quickly find the information they need.

## When to Use

- **Getting Started**: When first working with the project
- **Command Discovery**: When looking for a specific command
- **Agent Information**: When wanting to know which agent to invoke
- **Workflow Guidance**: When unsure about workflow phases
- **Troubleshooting**: When encountering issues or errors

## Usage

```bash
/help [topic] [options]
```

### Topics

- `commands` - List and search commands
- `agents` - Browse agents by category
- `skills` - View available skills
- `workflow` - Understand workflow phases
- `quick-start` - Get started quickly
- `architecture` - Project structure overview
- `glossary` - Terminology and concepts

### Options

- `--search <query>`: Search across all documentation
- `--category <cat>`: Filter by category
- `--details`: Show detailed information
- `--examples`: Show usage examples

### Examples

```bash
/help                                    # Interactive help menu
/help commands                           # List all commands
/help commands --search test             # Search test-related commands
/help agents --category engineering      # Show engineering agents
/help workflow --details                 # Detailed workflow guide
/help quick-start                        # Quick start guide
```

## Help System Structure

### Main Help Menu

```
🎯 Hospeda Project - Help System
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Welcome to the Hospeda project workflow system!

📚 Available Topics:

  1. commands   - Available slash commands (13 commands)
  2. agents     - Specialized AI agents (13 agents)
  3. skills     - Reusable workflows (4 skills)
  4. workflow   - Development workflow phases
  5. quick-start - 15-minute getting started guide
  6. architecture - Project structure overview
  7. glossary   - Terminology and concepts

🔍 Search: /help --search <query>
📖 Documentation: .claude/docs/
🆘 Issues: https://github.com/qazuor/hospeda/issues

Select topic (1-7) or press Enter for quick start:
```

### Commands Help

```
📜 Available Commands (13)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔧 Development & Workflow (3)
  /add-new-entity       Create complete CRUD entity (db, service, API, UI)
  /code-check           Run linting and type checking
  /run-tests            Execute test suite with coverage

📋 Planning & Project Management (2)
  /start-feature-plan   Initialize Level 2 feature planning
  /start-refactor-plan  Initialize Level 2 refactor planning

✅ Quality & Validation (1)
  /quality-check        Comprehensive quality validation

🔍 Audit (3)
  /security-audit       Security vulnerability assessment
  /performance-audit    Performance optimization analysis
  /accessibility-audit  WCAG 2.1 AA compliance validation

⚙️ Meta & System (4)
  /create-agent         Create new specialized AI agent
  /create-command       Create new slash command
  /create-skill         Create new skill workflow
  /help                 Interactive help system

📝 Git Operations (1)
  /commit               Generate conventional commit messages

📚 Documentation (1)
  /update-docs          Update project documentation

Use /help commands <name> for detailed information
Example: /help commands security-audit
```

### Agents Help

```
🤖 Available Agents (13)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 Product & Planning (2)
  product-functional    Creates PDRs with user stories
  product-technical     Performs technical analysis

👔 Technical Leadership (1)
  tech-lead            Architectural oversight, reviews, security, performance

🛠️ Backend Development (2)
  hono-engineer        API routes and middleware with Hono
  db-drizzle-engineer  Database schemas and Drizzle models

🎨 Frontend Development (3)
  astro-engineer       Public web app with Astro
  react-senior-dev     React 19 components and hooks
  tanstack-start-engineer  Admin dashboard with TanStack Start

🎯 Design & UX (1)
  ux-ui-designer       UI design and user flows

✅ Quality Assurance (2)
  qa-engineer          Testing and acceptance validation
  debugger             Bug investigation and root cause analysis

🔧 Specialized (2)
  tech-writer          Documentation, dependencies, changelogs
  i18n-specialist      Internationalization and translations

Use /help agents <name> for detailed information
Example: /help agents tech-lead
```

### Skills Help

```
🎯 Available Skills (4)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🧪 Testing
  web-app-testing         E2E testing workflow for web applications

🔧 Development
  git-commit-helper       Git commit message generation

✅ Validation
  qa-criteria-validator   Validate against PDR acceptance criteria

🎨 Design
  brand-guidelines        Brand consistency validation

Use /help skills <name> for detailed information
Example: /help skills qa-criteria-validator
```

### Workflow Help

```
🔄 Development Workflow
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Phase 1: Planning
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Goal: Create comprehensive, atomic plan

Steps:
1. Initialize planning session
   Command: /start-feature-plan
   Creates: .claude/sessions/planning/{feature-name}/

2. Create Product Design Requirements
   Agent: product-functional
   Deliverable: PDR.md (user stories, mockups, acceptance criteria)

3. Create Technical Analysis
   Agent: product-technical
   Deliverable: tech-analysis.md (architecture, stack, risks)

4. Break down into atomic tasks
   Deliverable: TODOs.md (1-2 hour tasks with dependencies)

5. Get user approval

⏱️ Time: 2-4 hours
📄 Deliverables: PDR.md, tech-analysis.md, TODOs.md

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🛠️ Phase 2: Implementation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Goal: Implement feature following TDD

Process:
1. Review PDR.md and tech-analysis.md
2. For each task:
   - RED: Write failing test
   - GREEN: Implement minimum code
   - REFACTOR: Improve while tests green
3. Continuous verification:
   - /code-check (lint + typecheck)
   - /run-tests
4. Update TODOs.md progress

Agents Used:
- db-drizzle-engineer (database layer)
- hono-engineer (API layer)
- react-senior-dev (components)
- astro-engineer (pages)
- tanstack-start-engineer (admin)

⏱️ Time: Varies by feature
📄 Deliverables: Working code + tests

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Phase 3: Validation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Goal: Ensure quality standards

Steps:
1. QA validation
   Agent: qa-engineer
   Skill: qa-criteria-validator

2. Quality checks
   Command: /quality-check
   Includes: lint, typecheck, tests, reviews

3. Audits (as needed)
   Commands:
   - /security-audit
   - /performance-audit
   - /accessibility-audit

4. Tech lead review
   Agent: tech-lead

5. User approval

⏱️ Time: 1-2 hours
📄 Deliverables: Validation reports

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 Phase 4: Finalization
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Goal: Document and prepare commits

Steps:
1. Update documentation
   Agent: tech-writer
   Command: /update-docs

2. Generate commits
   Command: /commit

3. User reviews and stages commits

4. Final checklist verification

⏱️ Time: 30-60 minutes
📄 Deliverables: Documentation + commits

Use /help workflow --details for comprehensive guide
```

## Detailed Help Output

### Command Details

```
Command: /security-audit
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Type: audit
Category: quality

Description:
Comprehensive security audit combining vulnerability assessment,
penetration testing, and security best practices validation.

When to Use:
- Before Production Deployment
- After Security-Related Changes
- Regular Security Reviews (Quarterly)
- Post-Incident Analysis

Usage:
  /security-audit [options]

Options:
  --scope <area>     Focus on: auth, api, database, frontend, all
  --depth <level>    Analysis depth: quick, standard, thorough
  --report           Generate detailed security-audit-report.md
  --fix-suggestions  Include automated fix suggestions

Examples:
  /security-audit
  /security-audit --scope auth --depth thorough --report
  /security-audit --scope api --fix-suggestions

Audit Areas: 8
- Authentication & Authorization
- Input Validation & Sanitization
- Data Protection & Privacy
- API Security
- Infrastructure & Configuration
- Code Security Patterns
- Frontend Security
- Penetration Testing Simulation

Output:
- Terminal report with categorized issues
- Optional: .claude/reports/security-audit-report.md

Related Commands:
- /quality-check
- /performance-audit
- /accessibility-audit

Documentation:
- .claude/commands/audit/security-audit.md
- .claude/docs/standards/security-standards.md
```

### Agent Details

```
Agent: tech-lead
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Category: Technical Leadership
Model: Claude 3.5 Sonnet

Description:
Provides architectural oversight, coordinates technical decisions,
ensures code quality standards, performs security audits, validates
performance, manages CI/CD, and oversees deployments.

Primary Responsibilities:
1. Architectural Oversight & Validation
2. Code Quality Leadership & Review
3. Security & Vulnerability Management
4. Performance Optimization & Monitoring
5. Deployment & Infrastructure Management
6. CI/CD Pipeline Management
7. Technical Coordination
8. Risk Management

Tools: Read, Write, Edit, Glob, Grep, Bash, Task

Phases: All Phases

Invocation Examples:
"Use the tech-lead to review the overall architecture"
"Invoke tech-lead for final code quality review"
"Call tech-lead to validate deployment strategy"

Works With:
- All agents (provides oversight)
- product-technical (architecture decisions)
- qa-engineer (quality validation)

Documentation:
- .claude/agents/engineering/tech-lead.md
- CLAUDE.md (Team Organization section)
```

## Search Functionality

### Search Across All Documentation

```bash
/help --search "testing"
```

**Output:**

```
🔍 Search Results for "testing"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📜 Commands (1)
  /run-tests - Execute test suite with coverage

🤖 Agents (1)
  qa-engineer - Testing and acceptance validation

🎯 Skills (1)
  web-app-testing - E2E testing workflow

📚 Documentation (3)
  .claude/docs/standards/testing-standards.md
  .claude/docs/workflows/testing-workflow.md
  CLAUDE.md (Testing Strategy section)

Use /help <type> <name> for details
```

## Quick Start

### Interactive Quick Start

```bash
/help quick-start
```

**Output:**

```
🚀 Quick Start Guide (15 minutes)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Welcome to Hospeda! This guide gets you productive in 15 minutes.

Step 1: Understand the Structure (5 min)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This is a TurboRepo monorepo with:
- apps/ - 3 applications (web, admin, api)
- packages/ - 10 shared packages
- .claude/ - Workflow system (agents, commands, skills)

Key Files:
- CLAUDE.md - Main project guide
- .claude/agents/README.md - Agent system
- .claude/commands/README.md - Available commands
- .claude/docs/quick-start.md - Full quick start

Step 2: Basic Commands (5 min)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Essential commands:
  /help              - This help system
  /help commands     - List all commands
  /code-check        - Lint + typecheck
  /run-tests         - Run tests
  /quality-check     - Full quality validation

Try now:
  /help commands

Step 3: Understand Workflow (5 min)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4 Phases:
1. Planning     - Create PDR and tech analysis
2. Implementation - Build with TDD
3. Validation   - Quality checks
4. Finalization - Documentation and commits

Start a feature:
  /start-feature-plan

View workflow details:
  /help workflow

Next Steps:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Read CLAUDE.md for comprehensive overview
✓ Explore .claude/docs/ for detailed guides
✓ Review existing features in .claude/sessions/
✓ Try creating a simple feature

Ready to start? Use /start-feature-plan
```

## Architecture Overview

```bash
/help architecture
```

**Output:**

```
🏗️ Project Architecture
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Monorepo Structure:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

hospeda/
├── apps/
│   ├── api/          # Hono backend API
│   ├── web/          # Astro + React public site
│   └── admin/        # TanStack Start admin
├── packages/
│   ├── db/           # Drizzle ORM + models
│   ├── service-core/ # Business logic
│   ├── schemas/      # Zod validation
│   └── [7 more...]
└── .claude/
    ├── agents/       # AI specialists
    ├── commands/     # Slash commands
    ├── skills/       # Reusable workflows
    └── docs/         # Documentation

Tech Stack:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Frontend:
- Astro (web) + TanStack Start (admin)
- React 19
- Tailwind CSS + Shadcn UI
- TanStack Query + Form

Backend:
- Hono (Node.js)
- Drizzle ORM
- PostgreSQL (Neon)

DevOps:
- PNPM + TurboRepo
- Vitest
- GitHub Actions
- Vercel

Architecture Patterns:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Layers: Database → Service → API → Frontend
Models: Extend BaseModel<T>
Services: Extend BaseCrudService
Routes: Use factory patterns
Validation: Zod schemas (types via z.infer)

Documentation:
- .claude/docs/standards/architecture-patterns.md
- .claude/docs/standards/code-standards.md
```

## Glossary

```bash
/help glossary
```

**Output:**

```
📖 Glossary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Agent
  Specialized AI persona with specific expertise and responsibilities.
  Invoked during workflow to perform tasks.
  Example: db-drizzle-engineer, tech-lead

Command
  User-invoked action via slash notation (e.g., /help).
  Triggers specific workflow or tooling.
  Example: /quality-check, /security-audit

Skill
  Reusable workflow invoked by agents.
  Codifies specialized procedures and best practices.
  Example: qa-criteria-validator, web-app-testing

PDR (Product Design Requirements)
  Document containing user stories, mockups, acceptance criteria.
  Created in Phase 1 by product-functional agent.
  Location: .claude/sessions/planning/{feature}/PDR.md

Tech Analysis
  Technical architecture and implementation plan.
  Created in Phase 1 by product-technical agent.
  Location: .claude/sessions/planning/{feature}/tech-analysis.md

TODOs
  Atomic task breakdown with dependencies and estimates.
  Created in Phase 1, updated during Phase 2.
  Location: .claude/sessions/planning/{feature}/TODOs.md

TDD (Test-Driven Development)
  RED → GREEN → REFACTOR cycle.
  Minimum 90% coverage required.
  Write tests first, then implementation.

RO-RO Pattern
  Receive Object / Return Object.
  All function parameters and returns are objects.
  Improves extensibility and readability.

[View full glossary]
  .claude/docs/glossary.md
```

## Error Messages

When help topic not found:

```
❌ Help Topic Not Found
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Topic "xyz" not found.

Available topics:
- commands
- agents
- skills
- workflow
- quick-start
- architecture
- glossary

Try:
  /help                  - Main help menu
  /help --search xyz     - Search all documentation
```

## Integration with Workflow

The `/help` command is available at all times and integrates with:

- **Onboarding**: First command new developers should use
- **Discovery**: Finding the right command/agent for a task
- **Troubleshooting**: Understanding errors and issues
- **Learning**: Understanding workflow and patterns

## Best Practices

1. **Start with /help quick-start**: Get oriented quickly
2. **Use search**: /help --search is powerful
3. **Explore categories**: Browse commands and agents by category
4. **Read details**: Use /help {type} {name} for comprehensive info
5. **Reference docs**: Help points to detailed documentation

## Related Commands

- `/create-agent` - Create new agent
- `/create-command` - Create new command
- `/create-skill` - Create new skill

## Notes

- **Context-Aware**: Help adapts to user experience level
- **Search**: Full-text search across all documentation
- **Examples**: Every help topic includes examples
- **Links**: Direct links to relevant documentation files
- **Interactive**: Guided navigation through help topics
- **Up-to-Date**: Auto-generated from actual agent/command/skill files

This comprehensive help system ensures developers can quickly find the information they need, understand the workflow, and be productive from day one.

---

## Changelog

| Version | Date | Changes | Author | Related |
|---------|------|---------|--------|---------|
| 1.0.0 | 2025-10-31 | Initial version | @tech-lead | P-004 |
