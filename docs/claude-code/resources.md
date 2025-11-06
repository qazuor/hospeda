# Resources

## Overview

This page provides links to official documentation, learning resources, and references for Claude Code and the technologies used in Hospeda.

## Official Claude Code Documentation

### Anthropic Documentation

#### Anthropic Documentation Claude Code

- **[Claude Code Official Docs](https://docs.anthropic.com/claude-code)** - Complete documentation for Claude Code CLI
- **[Getting Started Guide](https://docs.anthropic.com/claude-code/getting-started)** - Installation and setup
- **[CLI Reference](https://docs.anthropic.com/claude-code/cli-reference)** - Command-line interface documentation
- **[MCP Protocol Spec](https://modelcontextprotocol.io/)** - Model Context Protocol specification

#### Claude API

- **[Claude API Documentation](https://docs.anthropic.com/claude/reference)** - API reference
- **[Model Capabilities](https://docs.anthropic.com/claude/docs/models-overview)** - Overview of Claude models
- **[Prompt Engineering Guide](https://docs.anthropic.com/claude/docs/prompt-engineering)** - Best practices for prompts
- **[Token Limits](https://docs.anthropic.com/claude/docs/models-overview#model-comparison)** - Context windows and token budgets

#### Advanced Topics

- **[Extended Thinking](https://docs.anthropic.com/claude/docs/extended-thinking)** - How Claude reasons about complex problems
- **[Tool Use](https://docs.anthropic.com/claude/docs/tool-use)** - Function calling and tool integration
- **[Vision Capabilities](https://docs.anthropic.com/claude/docs/vision)** - Working with images
- **[Safety Best Practices](https://docs.anthropic.com/claude/docs/safety-best-practices)** - Security and safety guidelines

### GitHub Resources

- **[Claude Code GitHub](https://github.com/anthropics/claude-code)** - Source code and examples
- **[MCP Servers Repository](https://github.com/modelcontextprotocol/servers)** - Official MCP server implementations
- **[Example Projects](https://github.com/anthropics/claude-code/tree/main/examples)** - Sample projects using Claude Code

### Community

- **[Anthropic Discord](https://discord.gg/anthropic)** - Community support and discussions
- **[Claude Code Discussions](https://github.com/anthropics/claude-code/discussions)** - GitHub discussions
- **[Stack Overflow](https://stackoverflow.com/questions/tagged/claude-ai)** - Q&A tagged with claude-ai

## Hospeda-Specific Resources

### Internal Documentation

#### Core Documentation

- **[CLAUDE.md](../../CLAUDE.md)** - Main coordination file and project guide
- **[Quick Start](../../.claude/docs/quick-start.md)** - 15-minute onboarding guide
- **[Glossary](../../.claude/docs/glossary.md)** - Project terminology and definitions
- **[Index](../../.claude/docs/INDEX.md)** - Complete documentation index

#### Workflow Documentation

- **[Workflows Overview](../../.claude/docs/workflows/README.md)** - All workflow guides
- **[Decision Tree](../../.claude/docs/workflows/decision-tree.md)** - Choose the right workflow
- **[Quick Fix Protocol](../../.claude/docs/workflows/quick-fix-protocol.md)** - Level 1 workflow
- **[Atomic Task Protocol](../../.claude/docs/workflows/atomic-task-protocol.md)** - Level 2 workflow
- **[Feature Planning](../../.claude/docs/workflows/phase-1-planning.md)** - Level 3 Phase 1
- **[Implementation](../../.claude/docs/workflows/phase-2-implementation.md)** - Level 3 Phase 2
- **[Validation](../../.claude/docs/workflows/phase-3-validation.md)** - Level 3 Phase 3
- **[Finalization](../../.claude/docs/workflows/phase-4-finalization.md)** - Level 3 Phase 4
- **[Task Atomization](../../.claude/docs/workflows/task-atomization.md)** - Breaking down tasks
- **[Task Completion](../../.claude/docs/workflows/task-completion-protocol.md)** - Finishing tasks

#### Standards Documentation

- **[Code Standards](../../.claude/docs/standards/code-standards.md)** - TypeScript, naming, patterns
- **[Architecture Patterns](../../.claude/docs/standards/architecture-patterns.md)** - System design patterns
- **[Testing Standards](../../.claude/docs/standards/testing-standards.md)** - TDD, coverage, patterns
- **[Git Standards](../../.claude/docs/standards/git-standards.md)** - Branching, commits, versioning
- **[Atomic Commits](../../.claude/docs/standards/atomic-commits.md)** - Commit best practices

#### Project Documentation

- **[Architecture](../architecture/README.md)** - System architecture and design
- **[Security](../security/README.md)** - Security best practices and guidelines
- **[Performance](../performance/README.md)** - Performance optimization strategies
- **[Testing](../testing/README.md)** - Testing strategies and guidelines
- **[API Documentation](../api/README.md)** - API reference and guides

### Agent Documentation

- **[Agents Overview](../../.claude/agents/README.md)** - All 14 agents
- **[Product Functional](../../.claude/agents/product-functional.md)** - PDR creation
- **[Product Technical](../../.claude/agents/product-technical.md)** - Technical analysis
- **[Tech Lead](../../.claude/agents/tech-lead.md)** - Architecture coordination
- **[Hono Engineer](../../.claude/agents/hono-engineer.md)** - API development
- **[DB Drizzle Engineer](../../.claude/agents/db-drizzle-engineer.md)** - Database engineering
- **[Node TypeScript Engineer](../../.claude/agents/node-typescript-engineer.md)** - Shared packages
- **[Astro Engineer](../../.claude/agents/astro-engineer.md)** - Web app development
- **[React Senior Dev](../../.claude/agents/react-senior-dev.md)** - React components
- **[TanStack Start Engineer](../../.claude/agents/tanstack-start-engineer.md)** - Admin dashboard
- **[QA Engineer](../../.claude/agents/qa-engineer.md)** - Testing and QA
- **[Debugger](../../.claude/agents/debugger.md)** - Troubleshooting
- **[UX/UI Designer](../../.claude/agents/ux-ui-designer.md)** - UI/UX design
- **[Content Writer](../../.claude/agents/content-writer.md)** - Content creation
- **[Tech Writer](../../.claude/agents/tech-writer.md)** - Documentation

### Command Documentation

- **[Commands Overview](../../.claude/commands/README.md)** - All 16 commands
- **[Planning Commands](../../.claude/commands/start-feature-plan.md)** - Feature planning
- **[Quality Commands](../../.claude/commands/quality-check.md)** - Quality validation
- **[Development Commands](../../.claude/commands/add-new-entity.md)** - Entity scaffolding
- **[Git Commands](../../.claude/commands/commit.md)** - Commit generation
- **[Audit Commands](../../.claude/commands/audit-security.md)** - Security audits

### Skill Documentation

- **[Skills Overview](../../.claude/skills/README.md)** - All 19 skills
- **[TDD Methodology](../../.claude/skills/tdd-methodology.md)** - Test-driven development
- **[Error Handling Patterns](../../.claude/skills/error-handling-patterns.md)** - Error handling
- **[Security Audit](../../.claude/skills/security-audit.md)** - Security scanning
- **[Performance Audit](../../.claude/skills/performance-audit.md)** - Performance analysis
- **[Accessibility Audit](../../.claude/skills/accessibility-audit.md)** - WCAG compliance

### Diagrams

- **[Diagrams Overview](../../.claude/docs/diagrams/README.md)** - All Mermaid diagrams
- **[Workflow Decision Tree](../../.claude/docs/diagrams/workflow-decision-tree.mmd)** - Choose workflow
- **[Agent Hierarchy](../../.claude/docs/diagrams/agent-hierarchy.mmd)** - Agent organization
- **[Tools Relationship](../../.claude/docs/diagrams/tools-relationship.mmd)** - Tools interaction
- **[Documentation Map](../../.claude/docs/diagrams/documentation-map.mmd)** - Docs structure

### Templates

- **[PDR Template](../../.claude/docs/templates/PDR-template.md)** - Product Design & Requirements
- **[Tech Analysis Template](../../.claude/docs/templates/tech-analysis-template.md)** - Technical analysis
- **[TODOs Template](../../.claude/docs/templates/TODOs-template.md)** - Task breakdown

## MCP Server Documentation

### Official MCP Servers

#### Context7 (Library Documentation)

- **[Context7 Docs](https://context7.com/docs)** - Complete documentation
- **[MCP Server Repo](https://github.com/context7/mcp-server)** - GitHub repository
- **[Supported Libraries](https://context7.com/libraries)** - Available library docs

**Hospeda Uses:**

- Astro documentation
- React documentation
- TanStack (Query, Router, Start) documentation
- Hono documentation
- Drizzle ORM documentation
- Vitest documentation

#### Git

- **[Git MCP Server](https://github.com/modelcontextprotocol/servers/tree/main/src/git)** - Git operations
- **[Git Documentation](https://git-scm.com/doc)** - Official Git docs

**Capabilities:**

- Status, diff, log
- Commit, push, pull
- Branch management
- Conflict resolution

#### GitHub

- **[GitHub MCP Server](https://github.com/modelcontextprotocol/servers/tree/main/src/github)** - GitHub integration
- **[GitHub API Docs](https://docs.github.com/en/rest)** - REST API reference
- **[GitHub GraphQL](https://docs.github.com/en/graphql)** - GraphQL API

**Capabilities:**

- Issue management
- Pull request operations
- Repository management
- Workflow automation

#### Official MCP PostgreSQL

- **[PostgreSQL MCP Server](https://github.com/modelcontextprotocol/servers/tree/main/src/postgres)** - Database operations
- **[PostgreSQL Docs](https://www.postgresql.org/docs/)** - Official PostgreSQL documentation

**Capabilities:**

- Query execution
- Schema introspection
- Table management
- Index optimization

#### Neon

- **[Neon Documentation](https://neon.tech/docs)** - Neon PostgreSQL platform
- **[Neon API](https://neon.tech/docs/reference/api-reference)** - API reference

**Capabilities:**

- Database management
- Branching
- Scaling
- Monitoring

### Optional MCP Servers

#### Docker

- **[Docker MCP Server](https://github.com/modelcontextprotocol/servers/tree/main/src/docker)** - Container management
- **[Docker Docs](https://docs.docker.com/)** - Official Docker documentation

#### Optional MCP Vercel

- **[Vercel Documentation](https://vercel.com/docs)** - Deployment platform
- **[Vercel API](https://vercel.com/docs/rest-api)** - API reference

## Technology Documentation

### Frontend Technologies

#### Astro

- **[Astro Docs](https://docs.astro.build/)** - Complete Astro documentation
- **[Islands Architecture](https://docs.astro.build/en/concepts/islands/)** - Partial hydration
- **[SSR Guide](https://docs.astro.build/en/guides/server-side-rendering/)** - Server-side rendering
- **[Integrations](https://docs.astro.build/en/guides/integrations-guide/)** - React, Tailwind, etc.
- **[Content Collections](https://docs.astro.build/en/guides/content-collections/)** - Type-safe content

**Learning Path:**

1. [Tutorial](https://docs.astro.build/en/tutorial/0-introduction/) - Build your first Astro site
2. [Core Concepts](https://docs.astro.build/en/concepts/why-astro/) - Understanding Astro
3. [Best Practices](https://docs.astro.build/en/guides/best-practices/) - Production tips

#### React 19

- **[React Docs](https://react.dev/)** - Official React documentation
- **[React 19 Features](https://react.dev/blog/2024/04/25/react-19)** - What's new in React 19
- **[Server Components](https://react.dev/reference/react/use-server)** - RSC guide
- **[Hooks Reference](https://react.dev/reference/react)** - All hooks
- **[React Compiler](https://react.dev/learn/react-compiler)** - Automatic optimization

**Learning Path:**

1. [Quick Start](https://react.dev/learn) - Learn React basics
2. [Thinking in React](https://react.dev/learn/thinking-in-react) - Mental model
3. [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect) - Common patterns

#### TanStack

##### TanStack Query

- **[TanStack Query Docs](https://tanstack.com/query/latest)** - Data fetching and caching
- **[React Query Guide](https://tanstack.com/query/latest/docs/react/overview)** - React integration
- **[Server Components](https://tanstack.com/query/latest/docs/react/guides/advanced-ssr)** - SSR with React Server Components

##### TanStack Router

- **[TanStack Router Docs](https://tanstack.com/router/latest)** - Type-safe routing
- **[File-Based Routing](https://tanstack.com/router/latest/docs/framework/react/guide/file-based-routing)** - Convention-based routing
- **[Search Params](https://tanstack.com/router/latest/docs/framework/react/guide/search-params)** - Type-safe search params

##### TanStack Start

- **[TanStack Start Docs](https://tanstack.com/start/latest)** - Full-stack React framework
- **[Getting Started](https://tanstack.com/start/latest/docs/getting-started)** - Setup guide
- **[SSR Guide](https://tanstack.com/start/latest/docs/ssr)** - Server-side rendering
- **[API Routes](https://tanstack.com/start/latest/docs/api-routes)** - Backend endpoints

#### Tailwind CSS

- **[Tailwind Docs](https://tailwindcss.com/docs)** - Utility-first CSS
- **[Configuration](https://tailwindcss.com/docs/configuration)** - Customization
- **[Customizing Colors](https://tailwindcss.com/docs/customizing-colors)** - Theme colors
- **[Responsive Design](https://tailwindcss.com/docs/responsive-design)** - Breakpoints
- **[Dark Mode](https://tailwindcss.com/docs/dark-mode)** - Dark theme support

#### Shadcn UI

- **[Shadcn UI Docs](https://ui.shadcn.com/)** - Component library
- **[Installation](https://ui.shadcn.com/docs/installation)** - Setup guide
- **[Components](https://ui.shadcn.com/docs/components/accordion)** - All components
- **[Theming](https://ui.shadcn.com/docs/theming)** - Customization
- **[CLI](https://ui.shadcn.com/docs/cli)** - Component CLI

### Backend Technologies

#### Hono

- **[Hono Docs](https://hono.dev/)** - Fast web framework
- **[Getting Started](https://hono.dev/getting-started/basic)** - Setup guide
- **[Routing](https://hono.dev/api/routing)** - Route patterns
- **[Middleware](https://hono.dev/api/middleware)** - Built-in middleware
- **[Validation](https://hono.dev/guides/validation)** - Request validation
- **[RPC](https://hono.dev/guides/rpc)** - Type-safe client

**Learning Path:**

1. [Basic Tutorial](https://hono.dev/getting-started/basic) - Hello World
2. [Middleware Guide](https://hono.dev/guides/middleware) - Using middleware
3. [Best Practices](https://hono.dev/guides/best-practices) - Production tips

#### Backend Technologies Drizzle ORM

- **[Drizzle Docs](https://orm.drizzle.team/)** - Type-safe ORM
- **[Quick Start](https://orm.drizzle.team/docs/quick-start)** - Getting started
- **[Schema](https://orm.drizzle.team/docs/schemas)** - Defining schemas
- **[Queries](https://orm.drizzle.team/docs/queries)** - Querying data
- **[Migrations](https://orm.drizzle.team/docs/migrations)** - Database migrations
- **[Drizzle Kit](https://orm.drizzle.team/kit-docs/overview)** - CLI tools
- **[Drizzle Studio](https://orm.drizzle.team/drizzle-studio/overview)** - Database browser

**Learning Path:**

1. [PostgreSQL Tutorial](https://orm.drizzle.team/docs/get-started-postgresql) - Drizzle + PostgreSQL
2. [Relations](https://orm.drizzle.team/docs/rqb) - Relational queries
3. [Performance](https://orm.drizzle.team/docs/performance) - Optimization tips

#### Node.js & TypeScript

- **[Node.js Docs](https://nodejs.org/docs/latest/api/)** - Node.js API reference
- **[TypeScript Docs](https://www.typescriptlang.org/docs/)** - TypeScript handbook
- **[TypeScript Cheatsheet](https://www.typescriptlang.org/cheatsheets)** - Quick reference
- **[tsconfig Reference](https://www.typescriptlang.org/tsconfig)** - Configuration options

#### Zod

- **[Zod Docs](https://zod.dev/)** - TypeScript-first validation
- **[Schema Definition](https://zod.dev/?id=basic-usage)** - Creating schemas
- **[Type Inference](https://zod.dev/?id=type-inference)** - Inferring types
- **[Validation](https://zod.dev/?id=parsing)** - Validating data
- **[Error Handling](https://zod.dev/?id=error-handling)** - Custom errors

### Database

#### Database PostgreSQL

- **[PostgreSQL Docs](https://www.postgresql.org/docs/)** - Official documentation
- **[Tutorial](https://www.postgresql.org/docs/current/tutorial.html)** - PostgreSQL tutorial
- **[SQL Syntax](https://www.postgresql.org/docs/current/sql.html)** - SQL reference
- **[Performance Tips](https://www.postgresql.org/docs/current/performance-tips.html)** - Optimization
- **[Indexes](https://www.postgresql.org/docs/current/indexes.html)** - Index types and usage

### Testing

#### Vitest

- **[Vitest Docs](https://vitest.dev/)** - Fast unit testing
- **[Getting Started](https://vitest.dev/guide/)** - Setup guide
- **[API Reference](https://vitest.dev/api/)** - All APIs
- **[Configuration](https://vitest.dev/config/)** - Config options
- **[Coverage](https://vitest.dev/guide/coverage.html)** - Code coverage
- **[Mocking](https://vitest.dev/guide/mocking.html)** - Mocks and spies

#### Playwright

- **[Playwright Docs](https://playwright.dev/)** - E2E testing
- **[Getting Started](https://playwright.dev/docs/intro)** - Installation
- **[Writing Tests](https://playwright.dev/docs/writing-tests)** - Test basics
- **[Locators](https://playwright.dev/docs/locators)** - Finding elements
- **[Assertions](https://playwright.dev/docs/test-assertions)** - Expectations
- **[Best Practices](https://playwright.dev/docs/best-practices)** - Testing tips

### Development Tools

#### TurboRepo

- **[TurboRepo Docs](https://turbo.build/repo/docs)** - Monorepo management
- **[Getting Started](https://turbo.build/repo/docs/getting-started)** - Setup
- **[Configuration](https://turbo.build/repo/docs/reference/configuration)** - turbo.json
- **[Caching](https://turbo.build/repo/docs/core-concepts/caching)** - Build caching
- **[Pipelines](https://turbo.build/repo/docs/core-concepts/monorepos/running-tasks)** - Task pipelines

#### PNPM

- **[PNPM Docs](https://pnpm.io/)** - Fast package manager
- **[Workspaces](https://pnpm.io/workspaces)** - Monorepo workspaces
- **[CLI Commands](https://pnpm.io/cli/add)** - Command reference
- **[Configuration](https://pnpm.io/npmrc)** - .npmrc options

### Deployment

#### Deployment Vercel

- **[Vercel Docs](https://vercel.com/docs)** - Deployment platform
- **[Deployments](https://vercel.com/docs/deployments/overview)** - Deploy apps
- **[Environment Variables](https://vercel.com/docs/projects/environment-variables)** - Env vars
- **[Edge Functions](https://vercel.com/docs/functions/edge-functions)** - Edge runtime
- **[Vercel CLI](https://vercel.com/docs/cli)** - Command-line tool

## Learning Paths

### For New Developers

**Week 1: Fundamentals**

1. Read [Quick Start Guide](../../.claude/docs/quick-start.md)
2. Complete [Setup Guide](./setup.md)
3. Read [CLAUDE.md](../../CLAUDE.md)
4. Review [Code Standards](../../.claude/docs/standards/code-standards.md)

**Week 2: Claude Code Basics**

1. Read [Introduction](./introduction.md)
2. Study [Best Practices](./best-practices.md)
3. Practice Level 1 workflows
4. Practice Level 2 workflows

**Week 3: Technology Stack**

1. Learn Astro basics
2. Learn React 19 features
3. Learn Hono framework
4. Learn Drizzle ORM

**Week 4: Advanced Topics**

1. Master Level 3 workflows
2. Study [Architecture](../architecture/README.md)
3. Study [Security](../security/README.md)
4. Study [Performance](../performance/README.md)

### For AI-Assisted Development

#### Beginner Level

1. [Prompt Engineering Guide](https://docs.anthropic.com/claude/docs/prompt-engineering)
2. [Best Practices](./best-practices.md) - Effective prompting
3. Practice with simple tasks (Level 1)
4. Learn agent invocation

#### Intermediate Level

1. Master Level 2 workflows
2. Learn TDD with Claude Code
3. Practice code review
4. Learn refactoring patterns

#### Advanced Level

1. Master Level 3 workflows (all 4 phases)
2. Coordinate multiple agents
3. Handle complex architectures
4. Optimize for token efficiency

### For Specific Technologies

#### Astro Development

1. [Astro Tutorial](https://docs.astro.build/en/tutorial/0-introduction/)
2. [Islands Architecture](https://docs.astro.build/en/concepts/islands/)
3. [SSR Guide](https://docs.astro.build/en/guides/server-side-rendering/)
4. [Hospeda Web App](../../apps/web/) - Study our implementation

#### React 19 Development

1. [React Quick Start](https://react.dev/learn)
2. [React 19 Features](https://react.dev/blog/2024/04/25/react-19)
3. [Server Components](https://react.dev/reference/react/use-server)
4. [Hospeda Components](../../packages/) - Study our patterns

#### Hono API Development

1. [Hono Getting Started](https://hono.dev/getting-started/basic)
2. [Middleware Guide](https://hono.dev/guides/middleware)
3. [Validation](https://hono.dev/guides/validation)
4. [Hospeda API](../../apps/api/) - Study our implementation

#### For Specific Drizzle ORM

1. [Drizzle Quick Start](https://orm.drizzle.team/docs/quick-start)
2. [Schema Definition](https://orm.drizzle.team/docs/schemas)
3. [Queries](https://orm.drizzle.team/docs/queries)
4. [Hospeda Models](../../packages/db/) - Study our schemas

## Tools and Extensions

### VS Code Extensions

**Essential:**

- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) - Linting
- [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) - Formatting
- [TypeScript](https://marketplace.visualstudio.com/items?itemName=ms-vscode.vscode-typescript-next) - TypeScript support

**Framework-Specific:**

- [Astro](https://marketplace.visualstudio.com/items?itemName=astro-build.astro-vscode) - Astro support
- [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss) - Tailwind autocomplete

**Database:**

- [Drizzle Kit](https://marketplace.visualstudio.com/items?itemName=drizzle-team.drizzle-vscode) - Drizzle support
- [PostgreSQL](https://marketplace.visualstudio.com/items?itemName=ms-ossdata.vscode-postgresql) - PostgreSQL client

**Testing:**

- [Vitest](https://marketplace.visualstudio.com/items?itemName=ZixuanChen.vitest-explorer) - Vitest runner
- [Playwright](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright) - Playwright support

### CLI Tools

**Development:**

```bash
# Astro CLI
npm install -g astro

# Drizzle Kit
npm install -g drizzle-kit

# Vercel CLI
npm install -g vercel
```

**Quality:**

```bash
# ESLint
npm install -g eslint

# Prettier
npm install -g prettier

# TypeScript
npm install -g typescript
```

### Browser Extensions

**Development:**

- [React DevTools](https://react.dev/learn/react-developer-tools) - React debugging
- [Redux DevTools](https://github.com/reduxjs/redux-devtools) - State debugging (if using Redux)
- [Tailwind CSS DevTools](https://tailwindcss.com/docs/browser-support#chrome-devtools) - Tailwind debugging

**Accessibility:**

- [axe DevTools](https://www.deque.com/axe/devtools/) - Accessibility testing
- [WAVE](https://wave.webaim.org/extension/) - Accessibility evaluation

## Community Resources

### Discord Channels

- **[Anthropic Discord](https://discord.gg/anthropic)** - Claude Code support
- **[Astro Discord](https://astro.build/chat)** - Astro community
- **[TanStack Discord](https://discord.com/invite/tanstack)** - TanStack community
- **[Hono Discord](https://discord.gg/hono)** - Hono community

### Stack Overflow

- [claude-ai](https://stackoverflow.com/questions/tagged/claude-ai) - Claude questions
- [astro](https://stackoverflow.com/questions/tagged/astro) - Astro questions
- [react](https://stackoverflow.com/questions/tagged/react) - React questions
- [drizzle-orm](https://stackoverflow.com/questions/tagged/drizzle-orm) - Drizzle questions
- [hono](https://stackoverflow.com/questions/tagged/hono) - Hono questions

### GitHub Discussions

- [Claude Code Discussions](https://github.com/anthropics/claude-code/discussions)
- [Astro Discussions](https://github.com/withastro/astro/discussions)
- [TanStack Discussions](https://github.com/TanStack/query/discussions)
- [Drizzle Discussions](https://github.com/drizzle-team/drizzle-orm/discussions)

### Blogs and Articles

**Claude Code:**

- [Anthropic Blog](https://www.anthropic.com/research) - Research and updates
- [Claude Code Announcement](https://www.anthropic.com/news/claude-code) - Official announcement

**Technology Stack:**

- [Astro Blog](https://astro.build/blog/) - Astro updates
- [React Blog](https://react.dev/blog) - React announcements
- [TanStack Blog](https://tanstack.com/blog) - TanStack updates

## Video Tutorials

### Claude Code

- [Getting Started with Claude Code](https://www.youtube.com/watch?v=example) - Official tutorial
- [Advanced Claude Code Techniques](https://www.youtube.com/watch?v=example) - Advanced usage

### Technology Stack

- [Astro Crash Course](https://www.youtube.com/watch?v=example) - Astro basics
- [React 19 Features](https://www.youtube.com/watch?v=example) - What's new
- [Drizzle ORM Tutorial](https://www.youtube.com/watch?v=example) - Database with Drizzle
- [Hono Framework](https://www.youtube.com/watch?v=example) - Building APIs

## Books and Courses

### TypeScript

- **[TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)** - Official handbook
- **[Total TypeScript](https://www.totaltypescript.com/)** - Matt Pocock's course

### React

- **[React Documentation](https://react.dev/learn)** - Official learning path
- **[Epic React](https://epicreact.dev/)** - Kent C. Dodds' course

### Testing

- **[Testing JavaScript](https://testingjavascript.com/)** - Kent C. Dodds' course
- **[Playwright Course](https://playwright.dev/docs/intro)** - Official tutorial

## Cheat Sheets

### Claude Code Quick Reference

```bash
# Start Claude Code
claude-code

# Common commands
/meta:help                  # Show help
/start-feature-plan         # Plan feature
/quality-check              # Run checks
/run-tests                  # Run tests
/commit                     # Generate commit

# Agent invocation
Task: Invoke <agent-name> agent to <task>

# Skill usage
Use the <skill-name> skill to <task>
```

### Git Quick Reference

```bash
# Common operations
git status                  # Check status
git add <file>              # Stage file
git commit -m "message"     # Commit
git push                    # Push changes
git pull                    # Pull changes

# Conventional commits
feat: New feature
fix: Bug fix
refactor: Code refactoring
test: Adding tests
docs: Documentation
chore: Maintenance
```

### PNPM Quick Reference

```bash
# Common commands
pnpm install                # Install dependencies
pnpm add <package>          # Add package
pnpm remove <package>       # Remove package
pnpm dev                    # Start dev server
pnpm build                  # Build for production
pnpm test                   # Run tests
pnpm lint                   # Lint code
pnpm typecheck              # Type checking
```

## Additional Resources

### Security

- **[OWASP Top 10](https://owasp.org/www-project-top-ten/)** - Security risks
- **[Security Best Practices](../security/README.md)** - Hospeda security guide

### Performance

- **[Web.dev Performance](https://web.dev/performance/)** - Performance optimization
- **[Performance Best Practices](../performance/README.md)** - Hospeda performance guide

### Accessibility

- **[WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)** - Accessibility standards
- **[A11y Project](https://www.a11yproject.com/)** - Accessibility resources

## Changelog

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0.0 | 2025-01-15 | Initial resources documentation | tech-writer |

---

**Need more resources?** Ask Claude Code or check the community channels!
