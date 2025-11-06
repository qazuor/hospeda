# Claude Code Documentation

## Overview

Welcome to the Claude Code documentation for the Hospeda project. This guide will help you understand and effectively use AI-assisted development with Claude Code, Anthropic's official CLI tool.

**Claude Code** is an AI-powered coding assistant that helps you build software faster and with higher quality by providing intelligent code generation, refactoring, testing, and documentation capabilities. In Hospeda, we've configured Claude Code with specialized agents, commands, and skills to streamline our development workflow.

### What You'll Find Here

This documentation covers everything you need to know about working with Claude Code in the Hospeda project:

- **Introduction**: Deep dive into Claude Code and AI-assisted development
- **Setup**: Getting started with Claude Code in Hospeda
- **Best Practices**: Effective patterns for AI-assisted development
- **Workflows**: Project-specific workflows for different task types
- **Resources**: Links to official docs and learning materials

## Quick Navigation

### 📚 Main Guides

- **[Introduction](./introduction.md)** - What is Claude Code and how does it work?
- **[Setup Guide](./setup.md)** - Installing and configuring Claude Code for Hospeda
- **[Best Practices](./best-practices.md)** - Effective AI-assisted development patterns
- **[Workflows](./workflows.md)** - Project-specific workflows and processes
- **[Resources](./resources.md)** - Official documentation and learning materials

### 🔗 Related Documentation

- **[Architecture Documentation](../architecture/README.md)** - System design and patterns
- **[Security Documentation](../security/README.md)** - Security best practices
- **[Performance Documentation](../performance/README.md)** - Performance optimization
- **[Testing Documentation](../testing/README.md)** - Testing strategies and guidelines

### 📂 Project Resources

- **[CLAUDE.md](../../CLAUDE.md)** - Main coordination file and project guide
- **[.claude/agents/](../../.claude/agents/)** - Agent definitions and documentation
- **[.claude/commands/](../../.claude/commands/)** - Command definitions and usage
- **[.claude/skills/](../../.claude/skills/)** - Skill definitions and capabilities
- **[.claude/docs/](../../.claude/docs/)** - Internal documentation and workflows

## Getting Started

### Prerequisites Checklist

Before you begin, ensure you have:

- [ ] **Node.js 20.10.0+** installed
- [ ] **PNPM 8.15.6+** installed
- [ ] **Git** configured
- [ ] **PostgreSQL 15+** (or Docker)
- [ ] **Claude Code CLI** installed globally
- [ ] **API access** to Anthropic's Claude API
- [ ] **Project repository** cloned

### Quick Start (5 Minutes)

```bash
# 1. Install Claude Code globally
npm install -g @anthropic-ai/claude-code

# 2. Clone the Hospeda repository
git clone https://github.com/hospeda/hospeda.git
cd hospeda

# 3. Install project dependencies
pnpm install

# 4. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# 5. Start Claude Code
claude-code

# 6. Verify setup
/meta:help
```

### First Steps

1. **Read the [Introduction](./introduction.md)** to understand Claude Code concepts
2. **Follow the [Setup Guide](./setup.md)** to configure your environment
3. **Review [Best Practices](./best-practices.md)** for effective usage
4. **Explore [Workflows](./workflows.md)** to understand our development process

## Key Concepts

### Agents (14 Specialized)

Agents are specialized AI assistants designed for specific tasks. Hospeda uses 14 agents organized in categories:

#### Product Team (2)

- **product-functional** - Requirements, user stories, PDR creation
- **product-technical** - Technical analysis, architecture planning

#### Leadership (1)

- **tech-lead** - Coordination, architecture decisions, team orchestration

#### Backend Engineering (3)

- **hono-engineer** - Hono API development
- **db-drizzle-engineer** - Database schema, models, migrations
- **node-typescript-engineer** - Shared packages, utilities

#### Frontend Engineering (3)

- **astro-engineer** - Astro web app development
- **react-senior-dev** - React components, hooks
- **tanstack-start-engineer** - TanStack Start admin dashboard

#### Quality Assurance (2)

- **qa-engineer** - Testing, validation, quality checks
- **debugger** - Troubleshooting, issue resolution

#### Design Team (2)

- **ux-ui-designer** - UI/UX design, mockups
- **content-writer** - Content creation, copywriting

#### Specialized (1)

- **tech-writer** - Documentation, API specs, guides

**Learn more**: [Introduction - Agent System](./introduction.md#agent-system)

### Commands (16 Available)

Commands are predefined workflows that automate common tasks. They're organized by category:

#### Planning (3)

- `/start-feature-plan` - Initiate Level 3 feature planning workflow
- `/start-refactor-plan` - Plan major refactoring work
- `/sync-planning-github` - Sync planning docs to GitHub/Linear

#### Quality (3)

- `/quality-check` - Run comprehensive quality checks
- `/code-check` - Lint, typecheck, format validation
- `/run-tests` - Execute test suites with coverage

#### Development (2)

- `/add-new-entity` - Scaffold new entity (DB → Service → API)
- `/update-docs` - Update documentation

#### Git (1)

- `/commit` - Generate conventional commit messages

#### Audit (3)

- `/audit:security-audit` - Security vulnerability scan
- `/audit:performance-audit` - Performance analysis
- `/audit:accessibility-audit` - Accessibility compliance check

#### Meta (4)

- `/meta:create-agent` - Create new agent definition
- `/meta:create-command` - Create new command
- `/meta:create-skill` - Create new skill
- `/meta:help` - Show command help

**Learn more**: [Best Practices - Working with Commands](./best-practices.md#working-with-commands)

### Skills (19 Specialized)

Skills are modular capabilities that agents can use to perform specific tasks:

#### Audit Skills (3)

- **accessibility-audit** - WCAG compliance checking
- **performance-audit** - Performance bottleneck analysis
- **security-audit** - Security vulnerability scanning

#### Testing Skills (4)

- **api-app-testing** - API endpoint testing
- **performance-testing** - Load and stress testing
- **security-testing** - Security penetration testing
- **web-app-testing** - Frontend E2E testing

#### Documentation Skills (1)

- **markdown-formatter** - Markdown linting and formatting

#### Git Skills (1)

- **git-commit-helper** - Atomic commit generation

#### Pattern Skills (2)

- **error-handling-patterns** - Error handling best practices
- **tdd-methodology** - Test-driven development guidance

#### QA Skills (1)

- **qa-criteria-validator** - Quality acceptance criteria validation

#### Tech Skills (3)

- **mermaid-diagram-specialist** - Diagram creation and editing
- **shadcn-specialist** - Shadcn UI component expertise
- **vercel-specialist** - Vercel deployment expertise

#### Utility Skills (3)

- **add-memory** - Persistent knowledge management
- **json-data-auditor** - JSON validation and analysis
- **pdf-creator-editor** - PDF generation and manipulation

#### Brand Skills (1)

- **brand-guidelines** - Hospeda brand consistency

**Learn more**: [Introduction - Skill System](./introduction.md#skill-system)

### Workflow Levels (3)

Hospeda uses three workflow levels based on task complexity:

#### Level 1: Quick Fix Protocol

- **Time**: < 30 minutes
- **Files**: 1-2
- **Risk**: Very low
- **Examples**: Typos, formatting, config updates
- **Process**: Direct fix → Verify → Commit

#### Level 2: Atomic Task Protocol

- **Time**: 30 minutes - 3 hours
- **Files**: 2-10
- **Risk**: Low to medium
- **Examples**: Bug fixes, small features, new endpoints
- **Process**: TDD (Red → Green → Refactor) → Quality check → Commit

#### Level 3: Feature Planning (4 Phases)

- **Time**: Multi-day
- **Complexity**: High (architecture, DB changes, cross-team)
- **Phases**:
  1. **Planning**: PDR, mockups, tech-analysis, task breakdown
  2. **Implementation**: TDD implementation with specialized agents
  3. **Validation**: QA validation, code review, testing
  4. **Finalization**: Documentation, commits, deployment

**Learn more**: [Workflows Guide](./workflows.md)

## Quick Reference

### Most Common Commands

```bash
# Start a new feature
/start-feature-plan

# Quality checks before commit
/quality-check

# Generate commit message
/commit

# Run tests
/run-tests

# Get help
/meta:help
```

### Most Common Agent Invocations

```bash
# Create PDR for new feature
Task: Invoke product-functional agent

# Design database schema
Task: Invoke db-drizzle-engineer agent

# Create API endpoint
Task: Invoke hono-engineer agent

# Write tests
Task: Invoke qa-engineer agent

# Update documentation
Task: Invoke tech-writer agent
```

### Common Workflow Patterns

#### Creating a New Entity

```text
1. Define Zod schema (packages/schemas)
2. Create database schema (packages/db/schemas)
3. Create model (packages/db/models)
4. Create service (packages/service-core)
5. Create API routes (apps/api/routes)
6. Add tests (test/ folders)
7. Update documentation
```

#### Common Workflow Fixing a Bug

```text
1. Write failing test (Red)
2. Fix the bug (Green)
3. Refactor if needed
4. Run quality checks
5. Commit with conventional message
```

#### Adding a Feature

```text
1. Level 1/2: Use Atomic Task Protocol
2. Level 3: Use Feature Planning workflow
3. Always TDD: Test → Code → Refactor
4. Quality check before commit
```

### Common Code Patterns

#### RO-RO Pattern (Receive Object, Return Object)

```typescript
// ✅ GOOD: RO-RO pattern
export async function createAccommodation(
  input: CreateAccommodationInput
): Promise<Result<Accommodation>> {
  // Implementation
}

// ❌ BAD: Multiple parameters
export async function createAccommodation(
  title: string,
  description: string,
  price: number
): Promise<Accommodation> {
  // Implementation
}
```

#### Type Inference from Zod

```typescript
// Define Zod schema
export const createAccommodationSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string(),
  pricePerNight: z.number().positive(),
});

// Infer type from schema
export type CreateAccommodationInput = z.infer<typeof createAccommodationSchema>;

// ❌ NEVER: Separate type definition
type CreateAccommodationInput = {
  title: string;
  description: string;
  pricePerNight: number;
};
```

#### Extending Base Classes

```typescript
// Models extend BaseModel
export class AccommodationModel extends BaseModel<Accommodation> {
  constructor() {
    super('accommodations');
  }
}

// Services extend BaseCrudService
export class AccommodationService extends BaseCrudService<
  Accommodation,
  AccommodationModel,
  CreateAccommodationSchema,
  UpdateAccommodationSchema,
  SearchAccommodationSchema
> {
  constructor(ctx: ServiceContext, model?: AccommodationModel) {
    super(ctx, model ?? new AccommodationModel());
  }
}
```

## Common Workflows

### Creating a New Feature

For complex features requiring multiple components:

1. **Start Feature Planning**
   - Run `/start-feature-plan`
   - Provide feature description
   - Review generated PDR, mockups, tech-analysis
   - Approve task breakdown

1. **Implementation Phase**
   - Work through TODOs in order
   - Use TDD for each component
   - Run `/quality-check` frequently

1. **Validation Phase**
   - Run `/run-tests` for full coverage
   - Request code review
   - Address feedback

1. **Finalization Phase**
   - Update documentation with `/update-docs`
   - Generate commits with `/commit`
   - Push and create PR

**Learn more**: [Workflows - Level 3: Feature Planning](./workflows.md#level-3-feature-planning)

### Fixing a Bug

For bug fixes (typically Level 2 workflow):

1. **Reproduce the Bug**
   - Create a failing test that demonstrates the issue
   - Run test to confirm it fails (Red)

1. **Fix the Bug**
   - Implement the fix
   - Run test to confirm it passes (Green)

1. **Refactor**
   - Clean up code if needed
   - Ensure no regressions

1. **Quality Check**
   - Run `/quality-check`
   - Run `/run-tests`

1. **Commit**
   - Run `/commit` to generate message
   - Push changes

**Learn more**: [Workflows - Level 2: Atomic Task Protocol](./workflows.md#level-2-atomic-task-protocol)

### Adding Tests

For improving test coverage:

1. **Identify Gaps**
   - Run `/run-tests` with coverage
   - Review coverage report

1. **Write Tests**
   - Invoke qa-engineer agent for guidance
   - Follow AAA pattern (Arrange, Act, Assert)
   - Use TDD methodology skill

1. **Verify Coverage**
   - Run `/run-tests` again
   - Ensure 90%+ coverage

1. **Commit**
   - Run `/commit`
   - Use "test:" prefix for conventional commits

**Learn more**: [Testing Documentation](../testing/README.md)

### Refactoring Code

For improving code quality:

1. **Plan Refactoring**
   - Run `/start-refactor-plan` for large refactors
   - Define scope and goals

1. **Ensure Test Coverage**
   - Write tests if missing
   - Run `/run-tests` to establish baseline

1. **Refactor**
   - Make incremental changes
   - Run tests after each change

1. **Quality Check**
   - Run `/quality-check`
   - Run `/audit:performance-audit` if performance-related

1. **Commit**
   - Run `/commit` with "refactor:" prefix

**Learn more**: [Workflows - Refactoring](./workflows.md#refactoring-code)

## Troubleshooting

### Common Issues

#### Claude Code Not Responding

**Symptoms**: Claude Code doesn't respond to commands or prompts

**Solutions**:

1. Check internet connection
2. Verify API key is valid
3. Restart Claude Code CLI
4. Check Anthropic API status

#### Agent Not Found

**Symptoms**: "Agent not found" error when invoking agent

**Solutions**:

1. Verify agent name spelling
2. Check `.claude/agents/` directory
3. Ensure agent definition is valid JSON
4. Run `/meta:help` to see available agents

#### Command Not Working

**Symptoms**: Command doesn't execute or shows error

**Solutions**:

1. Verify command syntax
2. Check required parameters
3. Review `.claude/commands/` definition
4. Run `/meta:help` for command list

#### MCP Server Connection Issues

**Symptoms**: "MCP server not connected" or similar errors

**Solutions**:

1. Check `settings.json` configuration
2. Verify server URLs and credentials
3. Restart Claude Code
4. Check server-specific documentation

#### Context Budget Exceeded

**Symptoms**: "Token budget exceeded" or truncated responses

**Solutions**:

1. Start a new conversation
2. Be more concise in prompts
3. Focus on specific files/components
4. Use `/add-memory` for persistent context

### Getting Help

If you encounter issues not covered here:

1. **Check Resources**
   - Review [Resources](./resources.md) for official docs
   - Check [CLAUDE.md](../../CLAUDE.md) for project guidance
   - Search [.claude/docs/](../../.claude/docs/) for relevant guides

1. **Run Help Command**

   ```bash
   /meta:help
   ```

1. **Ask Claude Code**
   - Describe your issue clearly
   - Provide error messages
   - Include relevant context

1. **Team Support**
   - Consult team members
   - Check internal documentation
   - Review similar past issues

## Resources

### Official Documentation

- **[Claude Code Official Docs](https://docs.anthropic.com/claude-code)** - Complete Claude Code documentation
- **[Claude API Reference](https://docs.anthropic.com/claude/reference)** - API documentation
- **[MCP Protocol](https://modelcontextprotocol.io/)** - Model Context Protocol specification

### Hospeda Documentation

- **[CLAUDE.md](../../CLAUDE.md)** - Main coordination file
- **[Quick Start Guide](../../.claude/docs/quick-start.md)** - 15-minute onboarding
- **[Workflow Guides](../../.claude/docs/workflows/)** - Detailed workflow documentation
- **[Standards](../../.claude/docs/standards/)** - Code and architecture standards

### Learning Resources

- **[Anthropic Prompt Engineering](https://docs.anthropic.com/claude/docs/prompt-engineering)** - Effective prompting guide
- **[AI-Assisted Development Best Practices](https://www.anthropic.com/research)** - Research and insights
- **[Claude Code GitHub](https://github.com/anthropics/claude-code)** - Source code and examples

### Technology Documentation

- **[Astro](https://docs.astro.build/)** - Astro framework
- **[TanStack Start](https://tanstack.com/start)** - TanStack Start framework
- **[Hono](https://hono.dev/)** - Hono API framework
- **[Drizzle ORM](https://orm.drizzle.team/)** - Database ORM
- **[React 19](https://react.dev/)** - React library
- **[Vitest](https://vitest.dev/)** - Testing framework

## Next Steps

Now that you understand the basics:

1. **Read the [Introduction](./introduction.md)** for a deep dive into Claude Code
2. **Follow the [Setup Guide](./setup.md)** to configure your environment
3. **Study [Best Practices](./best-practices.md)** to develop effectively
4. **Master [Workflows](./workflows.md)** for different task types
5. **Bookmark [Resources](./resources.md)** for quick reference

## Contributing

Found an issue or want to improve this documentation?

1. Create an issue describing the problem/improvement
2. Or submit a PR with your changes
3. Follow the [contribution guidelines](../../CONTRIBUTING.md)

## Changelog

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0.0 | 2025-01-15 | Initial documentation | tech-writer |

---

**Need help?** Run `/meta:help` or consult the team.

**Want to dive deeper?** Start with the [Introduction](./introduction.md).
