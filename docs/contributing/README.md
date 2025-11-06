# Contributing to Hospeda

Welcome! We're excited that you're interested in contributing to Hospeda, a modern tourism accommodation platform for Concepción del Uruguay and the Litoral region of Argentina.

This guide will help you get started with your contribution journey.

## Table of Contents

- [Why Contribute to Hospeda?](#why-contribute-to-hospeda)
- [Quick Start for New Contributors](#quick-start-for-new-contributors)
- [Code of Conduct](#code-of-conduct)
- [Contributing Guides](#contributing-guides)
- [Common Tasks Quick Reference](#common-tasks-quick-reference)
- [First Contribution Ideas](#first-contribution-ideas)
- [Getting Help](#getting-help)
- [Recognition and Attribution](#recognition-and-attribution)

## Why Contribute to Hospeda?

Contributing to Hospeda offers unique opportunities:

### Learn Modern Web Development

- **Full-Stack Experience**: Work with cutting-edge technologies
  - Frontend: Astro + React 19, TanStack Start
  - Backend: Hono API, PostgreSQL with Drizzle ORM
  - Infrastructure: Fly.io, Neon, Vercel
- **Real-World Project**: Production-grade codebase with high standards
- **Best Practices**: TDD, type safety, clean architecture
- **Monorepo Experience**: Learn TurboRepo and PNPM workspaces

### Make an Impact

- **Local Tourism**: Help boost tourism in Entre Ríos region
- **Real Users**: Your code will be used by actual tourists and hosts
- **Open Source**: Contribute to the open-source community
- **Portfolio Project**: Showcase your work to potential employers

### Grow Your Skills

- **Code Reviews**: Learn from experienced developers
- **High Standards**: 90% test coverage, strict type safety
- **Documentation**: Comprehensive guides and standards
- **Mentorship**: Supportive community willing to help

## Quick Start for New Contributors

Follow these 5 steps to make your first contribution:

### Step 1: Set Up Your Environment

**Prerequisites:**

- Node.js 20.10.0 or higher
- PNPM 8.15.6 or higher
- PostgreSQL 15 or higher (or Docker)
- Git

**Clone and Install:**

```bash
# Fork the repository on GitHub first

# Clone your fork
git clone https://github.com/YOUR-USERNAME/hospeda.git
cd hospeda

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your values

# Start local database (Docker)
pnpm db:start

# Run migrations and seed
pnpm db:fresh

# Start development servers
pnpm dev
```

**Verify Setup:**

```bash
# Check API health
curl http://localhost:3000/health

# Run tests
pnpm test

# Check types
pnpm typecheck

# Check linting
pnpm lint
```

**Detailed Setup:** See [Development Setup Guide](../getting-started/setup.md)

### Step 2: Find an Issue

**Good First Issues:**

Look for issues labeled:

- `good first issue` - Perfect for newcomers
- `documentation` - Improve docs
- `tests` - Add test coverage
- `bug` - Fix bugs (some are beginner-friendly)

**Where to Look:**

- [GitHub Issues](https://github.com/hospeda/hospeda/issues)
- [Linear Workspace](https://linear.app/hospeda) (if you have access)
- Ask in Discord: "What's a good first issue for me?"

**Not Sure Where to Start?** See [First Contribution Ideas](#first-contribution-ideas)

### Step 3: Create a Branch

```bash
# Always start from latest main
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/bug-description
```

**Branch Naming:**

- `feature/*` - New features
- `fix/*` - Bug fixes
- `docs/*` - Documentation
- `test/*` - Tests only
- `refactor/*` - Code refactoring
- `chore/*` - Maintenance tasks

### Step 4: Make Your Changes

**Follow the Process:**

1. **Read the relevant standards:**
   - [Code Standards](./code-standards.md)
   - [Git Workflow](./git-workflow.md)
2. **Write tests first** (TDD: Red → Green → Refactor)
3. **Implement your changes**
4. **Run quality checks:**
   ```bash
   pnpm test
   pnpm typecheck
   pnpm lint
   ```
5. **Update documentation** if needed
6. **Follow atomic commits policy** (only commit files for THIS task)

**Key Rules:**

- ✅ Write code/comments in **English only**
- ✅ Use **named exports** (no default exports)
- ✅ Follow **RO-RO pattern** (functions with 3+ params)
- ✅ Achieve **90% test coverage minimum**
- ✅ No `any` type - use `unknown` with type guards
- ✅ Add **JSDoc** to all exports
- ✅ Max **500 lines per file** (excluding tests, docs, JSON)

### Step 5: Submit a Pull Request

**Before Submitting:**

- [ ] All tests passing (`pnpm test`)
- [ ] Type checks passing (`pnpm typecheck`)
- [ ] Linting passing (`pnpm lint`)
- [ ] Coverage ≥ 90%
- [ ] Documentation updated
- [ ] Atomic commits (only task-related files)
- [ ] Conventional commit messages

**Submit PR:**

```bash
# Push your branch
git push origin feature/your-feature-name

# Go to GitHub and create Pull Request
# Fill out the PR template
# Link to the issue (e.g., "Closes #123")
# Request reviewers
```

**After Submitting:**

- Monitor CI/CD checks
- Respond to review feedback within 48 hours
- Make requested changes
- Re-request review when ready

**Detailed Process:** See [Pull Request Process](./pull-request-process.md)

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors, regardless of:

- Experience level
- Gender identity and expression
- Sexual orientation
- Disability
- Personal appearance
- Body size
- Race
- Ethnicity
- Age
- Religion
- Nationality

### Our Standards

**Positive Behavior:**

- ✅ Be respectful and considerate
- ✅ Welcome newcomers warmly
- ✅ Give constructive feedback
- ✅ Accept feedback gracefully
- ✅ Focus on what's best for the project
- ✅ Show empathy towards others

**Unacceptable Behavior:**

- ❌ Harassment or discriminatory comments
- ❌ Personal attacks or insults
- ❌ Trolling or inflammatory comments
- ❌ Public or private harassment
- ❌ Publishing others' private information
- ❌ Unprofessional conduct

### Enforcement

Instances of unacceptable behavior may be reported to [conduct@hospeda.com]. All complaints will be reviewed and investigated promptly and fairly.

Project maintainers have the right to remove, edit, or reject comments, commits, code, issues, and other contributions that violate this Code of Conduct.

## Contributing Guides

We have detailed guides to help you contribute effectively:

### Core Guides

1. **[Code Standards](./code-standards.md)** (~1,400 lines)
   - Language policy (English only for code)
   - TypeScript standards (no `any`, strict mode)
   - RO-RO pattern (Receive Object / Return Object)
   - Named exports only
   - File organization (max 500 lines)
   - Naming conventions
   - JSDoc requirements
   - Error handling
   - Code formatting

2. **[Git Workflow](./git-workflow.md)** (~1,200 lines)
   - Branch naming conventions
   - Conventional commits
   - **Atomic commits policy** (🔥 CRITICAL)
   - Commit process step-by-step
   - When to commit / when NOT to commit
   - Git commands reference

3. **[Pull Request Process](./pull-request-process.md)** (~1,100 lines)
   - Before creating a PR checklist
   - PR title and description format
   - PR size guidelines
   - CI/CD checks
   - Responding to feedback
   - Merging process

4. **[Code Review Guidelines](./code-review-guidelines.md)** (~1,000 lines)
   - Why code reviews matter
   - What to review (checklist)
   - How to give feedback
   - Common review comments
   - Handling disagreements

### Additional Documentation

- **[Architecture Documentation](../architecture/overview.md)** - System design
- **[Testing Documentation](../testing/README.md)** - Testing strategy
- **[Security Documentation](../security/README.md)** - Security practices
- **[Performance Documentation](../performance/README.md)** - Performance optimization
- **[API Documentation](../api/README.md)** - API reference

### Standards Reference

For deep dives, see our comprehensive standards:

- [Code Standards (Deep Dive)](.claude/docs/standards/code-standards.md)
- [Atomic Commits Standards](.claude/docs/standards/atomic-commits.md)
- [Architecture Patterns](.claude/docs/standards/architecture-patterns.md)
- [Testing Standards](.claude/docs/standards/testing-standards.md)
- [Documentation Standards](.claude/docs/standards/documentation-standards.md)
- [Design Standards](.claude/docs/standards/design-standards.md)

## Common Tasks Quick Reference

### Development

```bash
# Start all apps
pnpm dev

# Start specific app
pnpm dev --filter=api
pnpm dev --filter=web
pnpm dev --filter=admin

# Run tests
pnpm test                       # All tests
pnpm test:coverage              # With coverage
cd packages/db && pnpm test     # Single package

# Quality checks
pnpm typecheck                  # All packages
pnpm lint                       # All packages
cd apps/api && pnpm lint        # Single app
```

### Database

```bash
# Reset database
pnpm db:fresh                   # Drop, migrate, seed

# Migrations
pnpm db:migrate                 # Run migrations
pnpm db:generate                # Generate migration

# Studio
pnpm db:studio                  # Open Drizzle Studio
```

### Git

```bash
# Create branch
git checkout -b feature/my-feature

# Stage specific files (ATOMIC COMMITS!)
git add path/to/file1.ts
git add path/to/file2.test.ts

# Commit with conventional format
git commit -m "feat(db): add User model with auth fields"

# Push
git push origin feature/my-feature
```

### Formatting

```bash
# Format markdown
pnpm format:md                  # All markdown files
pnpm format:md:claude           # .claude/ docs only
pnpm lint:md                    # Check without fixing

# Format code (Biome)
pnpm lint --fix                 # Fix all issues
```

### Adding New Entity

```bash
# Entity creation order:
# 1. Zod schemas (@repo/schemas)
# 2. Types via z.infer<typeof schema>
# 3. Drizzle schema (@repo/db/schemas)
# 4. Model (@repo/db/models) - extends BaseModel
# 5. Service (@repo/service-core) - extends BaseCrudService
# 6. API routes (apps/api/routes) - use factories
# 7. Tests for each layer
```

### Quality Checks Before PR

```bash
# Run all checks
pnpm typecheck && pnpm lint && pnpm test

# Check coverage
pnpm test:coverage

# Individual package checks
cd packages/db && pnpm run typecheck
cd apps/api && pnpm run lint
```

## First Contribution Ideas

Not sure where to start? Here are some great first contributions:

### Documentation (Easiest)

Perfect for getting familiar with the codebase:

- **Fix typos** in documentation
- **Improve code examples** in guides
- **Add JSDoc** to functions missing documentation
- **Translate docs** to Spanish (for local users)
- **Update README** with clearer instructions
- **Add diagrams** to explain architecture

**Where to Look:**

- Files without JSDoc: Search for `export function` without `/**`
- Incomplete guides: Check `docs/` for TODOs
- Outdated examples: Test examples and update if broken

### Tests (Good for Learning)

Understand the codebase by adding tests:

- **Increase test coverage** (we aim for 90%+)
- **Add edge case tests** to existing test suites
- **Test error conditions** that aren't covered
- **Add integration tests** for API endpoints
- **Add E2E tests** for user flows

**Where to Look:**

- Run `pnpm test:coverage` to see coverage gaps
- Look for files with < 90% coverage
- Check for untested error paths

### Bug Fixes (Intermediate)

Fix bugs to understand how things work:

- **Fix reported bugs** with `bug` label
- **Fix console warnings** in development
- **Fix type errors** when adding strict checks
- **Fix flaky tests** that sometimes fail
- **Fix performance issues** identified in profiling

**Where to Look:**

- GitHub Issues with `bug` label
- Console output when running `pnpm dev`
- Test output when running `pnpm test`

### New Features (Advanced)

Add new functionality:

- **Small features** labeled `good first issue`
- **API endpoints** for new resources
- **UI components** for frontend
- **Service methods** for business logic
- **Database models** for new entities

**Where to Look:**

- GitHub Issues with `feature` label
- Linear issues with `Good First Issue` tag
- Roadmap in project documentation

### Code Quality Improvements

Refactor and improve existing code:

- **Extract magic numbers** to constants
- **Simplify complex functions** (break into smaller ones)
- **Improve error messages** for better debugging
- **Add validation** where inputs aren't validated
- **Optimize queries** that are slow

**Where to Look:**

- Files > 500 lines (need splitting)
- Functions with high cyclomatic complexity
- Code with `TODO` or `FIXME` comments

### Example: Your First Bug Fix

Let's walk through a simple bug fix:

1. **Find a bug:**
   ```bash
   # Look for bugs labeled "good first issue"
   # Example: "Date formatting shows wrong timezone"
   ```

2. **Reproduce it:**
   ```bash
   # Follow steps in the issue
   # Confirm you can see the bug
   ```

3. **Write a failing test:**
   ```typescript
   // packages/utils/test/date-utils.test.ts
   it('should format date in correct timezone', () => {
     const date = new Date('2024-01-15T10:00:00Z');
     const formatted = formatDate(date, 'America/Argentina/Buenos_Aires');
     expect(formatted).toBe('15/01/2024 07:00');
   });
   ```

4. **Fix the bug:**
   ```typescript
   // packages/utils/src/date-utils.ts
   export function formatDate(input: { date: Date; timezone: string }): string {
     // Fix implementation
   }
   ```

5. **Verify tests pass:**
   ```bash
   cd packages/utils && pnpm test
   ```

6. **Commit atomically:**
   ```bash
   git add packages/utils/src/date-utils.ts
   git add packages/utils/test/date-utils.test.ts
   git commit -m "fix(utils): correct timezone handling in date formatting

   - Fix formatDate to respect timezone parameter
   - Add test for timezone edge case

   Closes #123"
   ```

7. **Create PR:**
   ```bash
   git push origin fix/date-timezone
   # Open PR on GitHub
   # Fill out template
   # Link to issue
   ```

## Getting Help

We're here to help! Here's where to get assistance:

### Discord (Fastest)

Join our Discord server: [discord.gg/hospeda]

**Channels:**

- `#general` - General discussion
- `#help` - Ask questions
- `#contributors` - For contributors
- `#code-review` - Discuss PRs
- `#showcase` - Share your work

**Response Time:** Usually within hours during business days

### GitHub Issues

**For:**

- Bug reports
- Feature requests
- Technical questions that benefit others

**Create Issue:** [github.com/hospeda/hospeda/issues/new]

**Response Time:** Within 24-48 hours

### GitHub Discussions

**For:**

- General questions
- Ideas and proposals
- Show and tell
- Q&A

**Start Discussion:** [github.com/hospeda/hospeda/discussions]

### Email

**For:**

- Private matters
- Code of Conduct violations
- Security issues (use security@hospeda.com)

**Contact:** contributors@hospeda.com

**Response Time:** Within 2-3 business days

### What to Include When Asking for Help

**Good Question Format:**

```markdown
**What I'm trying to do:**
[Clear description of your goal]

**What I tried:**
[Steps you've taken]

**What happened:**
[Actual result]

**What I expected:**
[Expected result]

**Environment:**
- Node version: 20.10.0
- PNPM version: 8.15.6
- OS: Ubuntu 22.04

**Code:**
[Minimal code snippet that reproduces issue]

**Error message:**
[Full error message with stack trace]
```

**Tips for Getting Fast Help:**

- ✅ Search existing issues/discussions first
- ✅ Include error messages and stack traces
- ✅ Provide minimal reproducible example
- ✅ Share what you've already tried
- ✅ Be specific about your environment
- ❌ Don't ask "Can I ask a question?" - just ask!
- ❌ Don't share screenshots of code - paste text
- ❌ Don't say "it doesn't work" - be specific

## Recognition and Attribution

We value all contributions, no matter how small!

### How We Recognize Contributors

**GitHub:**

- Listed in [Contributors](https://github.com/hospeda/hospeda/graphs/contributors)
- Mentioned in release notes
- Tagged in relevant issues/PRs

**Project Website:**

- Contributors page with avatars and links
- Featured contributors of the month
- Hall of fame for significant contributions

**Social Media:**

- Shoutouts on Twitter/LinkedIn
- Blog posts about major contributions
- Case studies featuring your work

### Types of Contributions We Value

All contributions are valuable:

- **Code:** Features, bug fixes, refactoring
- **Tests:** Unit, integration, E2E tests
- **Documentation:** Guides, API docs, examples
- **Design:** UI/UX, graphics, branding
- **Reviews:** Code reviews, feedback
- **Support:** Helping others in Discord/GitHub
- **Ideas:** Feature proposals, improvements
- **Bug Reports:** Detailed, reproducible issues
- **Translations:** Spanish translations for users

### Your Contribution Journey

**First Contribution:**

- 🎉 Welcome message in Discord
- 🏷️ "First-time contributor" badge
- 📧 Thank you email from maintainers

**Regular Contributor (5+ merged PRs):**

- 🌟 "Regular contributor" badge
- 📝 Mentioned in monthly newsletter
- 🎁 Hospeda swag (stickers, shirt)

**Core Contributor (20+ merged PRs):**

- ⭐ "Core contributor" badge
- 🗳️ Voice in technical decisions
- 🎤 Invited to present at meetups
- 🏆 Featured on website

**Maintainer:**

- 👑 Repository write access
- 🔑 Merge permissions
- 🎯 Direction setting
- 💼 Job opportunities

### Adding Yourself to Contributors

After your first merged PR, add yourself to our contributors list:

```bash
# Edit CONTRIBUTORS.md
# Add your entry:
- **Your Name** - [GitHub](https://github.com/username) - [Contribution areas]
```

## Next Steps

Now that you understand the basics, here's what to do next:

### 1. Set Up Your Environment

Follow our [Development Setup Guide](../getting-started/setup.md) to get Hospeda running locally.

### 2. Read the Core Guides

Familiarize yourself with our standards:

- [Code Standards](./code-standards.md) - How we write code
- [Git Workflow](./git-workflow.md) - How we use Git
- [Pull Request Process](./pull-request-process.md) - How we review code

### 3. Explore the Codebase

```bash
# Project structure
hospeda/
├── apps/          # API, Web, Admin applications
├── packages/      # Shared packages (db, service-core, schemas)
├── docs/          # Documentation
└── .claude/       # AI agents, commands, standards
```

**Key Files to Read:**

- `README.md` - Project overview
- `CLAUDE.md` - Development guidelines (if using Claude)
- `docs/architecture/overview.md` - Architecture
- `docs/api/README.md` - API documentation

### 4. Find Your First Issue

- Browse [Good First Issues](https://github.com/hospeda/hospeda/labels/good%20first%20issue)
- Or check [First Contribution Ideas](#first-contribution-ideas)

### 5. Join the Community

- Join [Discord](https://discord.gg/hospeda)
- Introduce yourself in `#general`
- Ask questions in `#help`

### 6. Make Your First Contribution

Follow the [Quick Start](#quick-start-for-new-contributors) guide to submit your first PR!

## Questions?

Still have questions? We're here to help!

- 💬 [Discord](https://discord.gg/hospeda) - Fastest response
- 💭 [GitHub Discussions](https://github.com/hospeda/hospeda/discussions) - Q&A
- 📧 [Email](mailto:contributors@hospeda.com) - For private matters

**Welcome to Hospeda!** We can't wait to see your contributions. 🚀

---

*Last updated: 2025-01-15*
