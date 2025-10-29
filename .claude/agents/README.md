# Hospeda Project - AI Agents

This directory contains specialized AI agents for the Hospeda tourism platform. Each agent is an expert in specific areas and can be invoked during development workflow.

## Agent Organization

Agents are organized into the following categories:

### Product & Planning

- **product-functional** - Creates PDRs with user stories, acceptance criteria, and mockups
- **product-technical** - Performs technical analysis, architecture design, and risk assessment

### Architecture & Leadership

- **tech-lead** - Overall technical leadership and architecture decisions
- **architecture-validator** - Validates architectural decisions against best practices

### Backend Development

- **hono-engineer** - Hono framework expert for API development
- **db-engineer** - Database design, Drizzle ORM, and migrations
- **backend-reviewer** - Backend code review and quality assurance

### Frontend Development

- **astro-engineer** - Astro framework expert for web app
- **react-dev** - React 19 development and best practices
- **tanstack-engineer** - TanStack Router, Query, Form expert for admin panel
- **frontend-reviewer** - Frontend code review and quality assurance

### Design & UX

- **ui-ux-designer** - UI/UX design, mockups, and user experience

### Quality Assurance

- **qa-engineer** - Testing strategy, test writing, and quality validation
- **debugger** - Bug investigation and troubleshooting

### Specialized Engineering

- **security-engineer** - Security audits, vulnerability assessment
- **performance-engineer** - Performance optimization and monitoring
- **accessibility-engineer** - Accessibility compliance (WCAG)
- **i18n-specialist** - Internationalization and localization
- **payments-specialist** - Mercado Pago integration expert

### DevOps & Infrastructure

- **deployment-engineer** - Deployment strategies and infrastructure
- **cicd-engineer** - CI/CD pipelines and automation

### Documentation & Maintenance

- **tech-writer** - Technical documentation and guides
- **dependency-mapper** - Dependency tracking and updates
- **changelog-specialist** - Changelog generation and release notes
- **prompt-engineer** - AI prompt optimization and engineering

## Usage

Agents are automatically available to Claude Code. They are invoked using the Task tool during the development workflow:

```
Use the Task tool with subagent_type="agent-name"
```

## Agent File Format

Each agent file must include:

1. **YAML Frontmatter** with:
   - `name`: Unique identifier (lowercase with hyphens)
   - `description`: When the agent should be invoked
   - `tools`: (Optional) Comma-separated list of allowed tools
   - `model`: (Optional) sonnet/opus/haiku/inherit

2. **System Prompt** defining:
   - Role and responsibilities
   - Working context
   - Best practices
   - Quality checklists
   - Workflow integration

## Contributing

When adding new agents:

1. Create a new `.md` file in this directory
2. Follow the naming convention: `category-name.md`
3. Include proper YAML frontmatter
4. Write comprehensive system prompt
5. Update this README with agent description
6. Test agent invocation before committing

## Related Documentation

- Workflow: `docs/WORKFLOW.md`
- Commands: `.claude/commands/README.md`
- Skills: `.claude/skills/README.md`
- Main project guide: `CLAUDE.md`
