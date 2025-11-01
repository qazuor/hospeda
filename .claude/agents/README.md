# Hospeda Project - AI Agents

This directory contains **14 specialized AI agents** for the Hospeda tourism platform. Each agent is an expert in specific areas and can be invoked during development workflow.

## Agent Organization

Agents are organized into the following categories:

### Product & Planning (2 agents)

- **[product-functional](product/product-functional.md)** - Creates Product Design Requirements (PDRs) with user stories, acceptance criteria, mockups, and functional specifications during Phase 1 Planning
- **[product-technical](product/product-technical.md)** - Performs technical analysis, architecture design, creates tech-analysis.md with implementation plans during Phase 1 Planning

### Technical Leadership (1 agent)

- **[tech-lead](engineering/tech-lead.md)** - Provides architectural oversight, coordinates technical decisions, ensures code quality standards, performs security audits, validates performance, manages CI/CD, and oversees deployments across all phases
  - **Consolidated from**: architecture-validator, backend-reviewer, frontend-reviewer, security-engineer, performance-engineer, deployment-engineer, cicd-engineer

### Backend Development (2 agents)

- **[hono-engineer](engineering/hono-engineer.md)** - Designs and implements API routes, middleware, and server-side logic using Hono framework during Phase 2 Implementation
- **[db-drizzle-engineer](engineering/db-drizzle-engineer.md)** - Designs and implements database schemas, manages migrations, and builds Drizzle models during Phase 2 Implementation

### Frontend Development (3 agents)

- **[astro-engineer](engineering/astro-engineer.md)** - Designs and implements public web app using Astro with React islands, SSR, and static generation during Phase 2 Implementation
- **[react-senior-dev](engineering/react-senior-dev.md)** - Builds reusable React 19 components with hooks and state management for Astro and TanStack Start during Phase 2 Implementation
- **[tanstack-start-engineer](engineering/tanstack-start-engineer.md)** - Implements admin dashboard with TanStack Start, Router, Query, and Form for type-safe development during Phase 2 Implementation

### Design & UX (1 agent)

- **[ux-ui-designer](design/ux-ui-designer.md)** - Designs user interfaces, creates user flows, ensures accessibility, and validates design standards during Phase 1 and Phase 3

### Quality Assurance (2 agents)

- **[qa-engineer](quality/qa-engineer.md)** - Ensures quality through testing, validates acceptance criteria, and verifies features meet standards during Phase 3 Validation
  - **Consolidated from**: accessibility-engineer
- **[debugger](quality/debugger.md)** - Investigates bugs, diagnoses issues, identifies root causes, and proposes fixes using systematic debugging during Phase 3 and issue resolution

### Specialized (3 agents)

- **[tech-writer](specialized/tech-writer.md)** - Creates comprehensive documentation for code, APIs, architecture, processes, manages dependency tracking and updates, and generates changelogs following Keep a Changelog format during Phase 4 Finalization and all phases
  - **Consolidated from**: dependency-mapper, changelog-specialist
- **[i18n-specialist](specialized/i18n-specialist.md)** - Designs and maintains internationalization system, manages translations, and ensures multi-language support during all phases
- **[enrichment-agent](specialized/enrichment-agent.md)** - Analyzes planning sessions and enriches GitHub issues with relevant planning context, technical decisions, and task relationships during planning sync and issue creation

## Agent Consolidation

This structure reflects a consolidation from 25 agents to 14 agents, absorbing specialized responsibilities into core agents:

### tech-lead absorbed

- architecture-validator (architectural validation)
- backend-reviewer (backend code review)
- frontend-reviewer (frontend code review)
- security-engineer (security audits)
- performance-engineer (performance optimization)
- deployment-engineer (deployment strategies)
- cicd-engineer (CI/CD pipelines)

### qa-engineer absorbed

- accessibility-engineer (WCAG compliance)

### tech-writer absorbed

- dependency-mapper (dependency tracking)
- changelog-specialist (changelog generation)

### Removed (functionality handled by MCP)

- payments-specialist (Mercado Pago MCP server)

### Removed (general expertise)

- prompt-engineer (integrated into general expertise)

## Usage

Agents are automatically available to Claude Code. They are invoked using the Task tool during the development workflow:

```
Use the Task tool with subagent_type="agent-name"
```

**Example invocations:**

```
"Invoke the product-functional agent to create the PDR"
"Use the tech-lead agent to review architectural decisions"
"Call the db-drizzle-engineer to design the database schema"
"Invoke the qa-engineer to validate test coverage"
```

## Agent File Format

Each agent file must include:

1. **YAML Frontmatter** with:
   - `name`: Unique identifier (lowercase with hyphens)
   - `description`: When the agent should be invoked
   - `tools`: (Optional) Comma-separated list of allowed tools
   - `model`: (Optional) sonnet/opus/haiku/inherit
   - `responsibilities`: (Optional) List of key responsibilities

2. **System Prompt** defining:
   - Role and responsibilities
   - Working context
   - Best practices
   - Quality checklists
   - Workflow integration

## Directory Structure

```
.claude/agents/
├── README.md                           # This file
├── product/                            # Product & Planning (2)
│   ├── product-functional.md
│   └── product-technical.md
├── engineering/                        # Leadership + Backend + Frontend (6)
│   ├── tech-lead.md
│   ├── hono-engineer.md
│   ├── db-drizzle-engineer.md
│   ├── astro-engineer.md
│   ├── react-senior-dev.md
│   └── tanstack-start-engineer.md
├── quality/                            # Quality Assurance (2)
│   ├── qa-engineer.md
│   └── debugger.md
├── design/                             # Design & UX (1)
│   └── ux-ui-designer.md
└── specialized/                        # Specialized (3)
    ├── tech-writer.md
    ├── i18n-specialist.md
    └── enrichment-agent.md
```

## Contributing

When adding new agents:

1. Create a new `.md` file in the appropriate category subfolder
2. Follow the naming convention: `kebab-case-name.md`
3. Include proper YAML frontmatter with all required fields
4. Write comprehensive system prompt with:
   - Clear role definition
   - Specific responsibilities
   - Working context
   - Best practices
   - Quality standards
5. Update this README with agent description and category
6. Test agent invocation before committing
7. Ensure no overlap with existing agent responsibilities

## Related Documentation

- **Workflow**: `docs/WORKFLOW.md`
- **Commands**: `.claude/commands/README.md`
- **Skills**: `.claude/skills/README.md`
- **Main project guide**: `CLAUDE.md`
- **Agent Documentation**: `.claude/docs/glossary.md` (see "Agent" section)
- **Quick Start**: `.claude/docs/quick-start.md` (see "Agents" section)

## Statistics

- **Total Agents**: 14
- **Product & Planning**: 2
- **Technical Leadership**: 1
- **Backend Development**: 2
- **Frontend Development**: 3
- **Design & UX**: 1
- **Quality Assurance**: 2
- **Specialized**: 3
- **Consolidated from**: 25 agents (11 removed, responsibilities absorbed)
