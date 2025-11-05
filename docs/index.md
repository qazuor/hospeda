# Hospeda Documentation

**Welcome to the Hospeda monorepo documentation!**

Hospeda is a tourism accommodation platform for Concepción del Uruguay and the Litoral region of Argentina, built with a modern monorepo architecture using Astro, React 19, TanStack, Hono, Drizzle, and PostgreSQL.

---

## 🚀 Quick Start by Role

### 👋 New Developer

**First time here? Start here!**

- [Prerequisites](getting-started/prerequisites.md) - What you need
- [Installation](getting-started/installation.md) - Get set up
- [Development Environment](getting-started/development-environment.md) - Configure your IDE
- [First Contribution](getting-started/first-contribution.md) - Make your first change

⏱️ **Time to first contribution:** ~2 hours

### 💻 Experienced Developer

**Know the codebase? Find what you need:**

- [Architecture Overview](architecture/overview.md) - System design & patterns
- [Monorepo Structure](architecture/monorepo-structure.md) - Project organization
- [Adding a New Entity](guides/adding-new-entity.md) - End-to-end tutorial
- [Testing Strategy](testing/strategy.md) - TDD workflow

### 🔧 Need to Debug Something?

- [Debugging Guide](guides/debugging.md) - Troubleshooting techniques
- [Common Issues](resources/troubleshooting.md) - Known problems & solutions
- [Runbooks](runbooks/README.md) - Operational procedures

### 🚀 Ready to Deploy?

- [Deployment Overview](deployment/overview.md) - Infrastructure & environments
- [CI/CD Pipeline](deployment/ci-cd.md) - Automated workflows
- [API Deployment](deployment/api-deployment.md) - Fly.io setup

---

## 📖 Documentation by Component

### Apps

- 🌐 [API Documentation](../apps/api/docs/README.md) - Hono backend API
- 🎨 [Web Documentation](../apps/web/docs/README.md) - Astro + React frontend
- ⚡ [Admin Documentation](../apps/admin/docs/README.md) - TanStack Start dashboard

### Core Packages (Detailed Docs)

- 🔄 [@repo/service-core](../packages/service-core/docs/README.md) - Business logic layer
- 🗄️ [@repo/db](../packages/db/docs/README.md) - Database models & ORM
- ✅ [@repo/schemas](../packages/schemas/docs/README.md) - Validation schemas
- ⚙️ [@repo/config](../packages/config/docs/README.md) - Configuration management
- 📝 [@repo/logger](../packages/logger/docs/README.md) - Logging system
- 🎨 [@repo/icons](../packages/icons/docs/README.md) - Icon library
- 🌱 [@repo/seed](../packages/seed/docs/README.md) - Database seeding

[View all packages](../packages/README.md)

---

## 📚 Browse by Topic

### Architecture & Patterns

- [System Overview](architecture/overview.md) - High-level architecture
- [Monorepo Structure](architecture/monorepo-structure.md) - Apps & packages
- [Data Flow](architecture/data-flow.md) - Request lifecycle
- [Architectural Patterns](architecture/patterns.md) - BaseModel, BaseCrudService, factories
- [Tech Stack](architecture/tech-stack.md) - Technology decisions

### Guides & Tutorials

- [Adding a New Entity (End-to-End)](guides/adding-new-entity.md) 📝
- [TDD Workflow](guides/tdd-workflow.md) - Red → Green → Refactor
- [Error Handling](guides/error-handling.md) - Error patterns
- [Authentication](guides/authentication.md) - Clerk integration
- [Debugging](guides/debugging.md) - Debugging techniques
- [Database Migrations](guides/database-migrations.md) - Migration workflow
- [Internationalization](guides/internationalization.md) - i18n setup

### Development

- [Code Standards](contributing/code-standards.md) - TypeScript, naming, conventions
- [Git Workflow](contributing/git-workflow.md) - Branching, commits, atomic policy
- [Pull Request Process](contributing/pull-request-process.md) - PR guidelines
- [Code Review Guidelines](contributing/code-review-guidelines.md) - Review checklist

### Operations

- [Runbooks](runbooks/README.md) - Operational procedures
- [Production Bugs](runbooks/production-bugs.md) - Investigating issues
- [Rollback](runbooks/rollback.md) - Rolling back deployments
- [Monitoring](runbooks/monitoring.md) - Monitoring & alerting

### Security & Performance

- [Security Overview](security/overview.md) - Security posture
- [OWASP Top 10](security/owasp-top-10.md) - Prevention strategies
- [Performance Overview](performance/overview.md) - Performance philosophy
- [Database Optimization](performance/database-optimization.md) - Query optimization
- [Caching](performance/caching.md) - Cache strategies

### Working with AI

- [Claude Code Guide](claude-code/README.md) 🤖
- [Introduction](claude-code/introduction.md) - What is Claude Code?
- [Setup](claude-code/setup.md) - Setup for Hospeda
- [Best Practices](claude-code/best-practices.md) - AI-assisted development
- [Workflows](claude-code/workflows.md) - Project-specific workflows

---

## 🔍 Search Documentation

**Using Browser Search:**

- Press `Ctrl+F` (Windows/Linux) or `Cmd+F` (Mac)
- Type your search term
- Navigate through results

**GitHub Search:**

- Visit the repository on GitHub
- Use the search bar to find content across all docs
- Filter by file path pattern: `path:docs/ your-search-term`

**VS Code Search:**

- Open the workspace in VS Code
- Press `Ctrl+Shift+F` (Windows/Linux) or `Cmd+Shift+F` (Mac)
- Search in `docs/`, `apps/*/docs/`, `packages/*/docs/`

---

## 📊 Diagrams & Visual Guides

- [Documentation Map](diagrams/documentation-map.mmd) - Overview of all docs
- [Request Flow](diagrams/request-flow.mmd) - Complete request lifecycle
- [Entity Relationships](diagrams/entity-relationships.mmd) - ERD
- [Package Dependencies](diagrams/package-dependencies.mmd) - Dependency graph
- [Authentication Flow](diagrams/authentication-flow.mmd) - Auth sequence
- [Deployment Architecture](diagrams/deployment-architecture.mmd) - Infrastructure
- [Navigation Flow](diagrams/navigation-flow.mmd) - User navigation paths

---

## 💡 Recently Updated

> 📝 **Note:** This section will be updated as documentation evolves

- 2025-11-04 - [Documentation Infrastructure](../README.md) - Initial setup
- 2025-11-04 - [Main Portal](index.md) - Created documentation hub

---

## 🤝 Contributing

We welcome contributions! Before contributing:

1. Read [Contributing Guidelines](contributing/README.md)
2. Check [Code Standards](contributing/code-standards.md)
3. Follow [Git Workflow](contributing/git-workflow.md)
4. Review [Pull Request Process](contributing/pull-request-process.md)

---

## 📞 Need Help?

- 💬 [GitHub Discussions](https://github.com/qazuor/hospeda/discussions) - Ask questions
- 🐛 [Report Bug](https://github.com/qazuor/hospeda/issues/new) - Found an issue?
- 📖 [FAQ](resources/faq.md) - Common questions
- 🔧 [Troubleshooting](resources/troubleshooting.md) - Common problems & solutions

---

Built with ❤️ by the Hospeda team
