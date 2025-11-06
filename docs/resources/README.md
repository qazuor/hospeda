# Resources

Welcome to the Hospeda Resources section. This is your hub for all reference materials, troubleshooting guides, and external links needed for development.

## Table of Contents

- [Overview](#overview)
- [What's Included](#whats-included)
- [Quick Links](#quick-links)
- [How to Use This Section](#how-to-use-this-section)
- [Contributing](#contributing)

## Overview

This resources section provides comprehensive reference materials for developers working on the Hospeda project. Whether you're:

- **New to the project**: Start with the [Glossary](./glossary.md) to learn project-specific terminology
- **Facing issues**: Check the [Troubleshooting Guide](./troubleshooting.md) for solutions
- **Have questions**: Browse the [FAQ](./faq.md) for answers to common questions
- **Looking for docs**: See [External Links](./external-links.md) for official documentation

## What's Included

### 1. Glossary

**File**: [glossary.md](./glossary.md)

A comprehensive dictionary of Hospeda-specific technical terms, architecture patterns, and concepts.

**Use when**:

- Learning the codebase terminology
- Understanding architecture patterns (BaseModel, BaseCrudService, RO-RO)
- Looking up database or frontend concepts
- Need clarification on testing terms

**Categories covered**:

- Core Concepts (Accommodation, Destination, Actor, Service)
- Architecture Terms (BaseModel, BaseCrudService, ServiceOutput)
- Database Terms (Drizzle ORM, Migrations, Transactions)
- Frontend Terms (Islands, SSR, TanStack Query)
- Testing Terms (TDD, AAA pattern, Coverage)
- DevOps Terms (Monorepo, TurboRepo, Vercel)

### 2. FAQ (Frequently Asked Questions)

**File**: [faq.md](./faq.md)

Quick answers to common questions organized by development workflow.

**Use when**:

- Setting up the project for the first time
- Creating a new entity, endpoint, or page
- Running tests or working with the database
- Debugging common issues
- Understanding deployment

**Categories covered**:

- Getting Started
- Development (entities, endpoints, pages)
- Testing (running, coverage, strategies)
- Database (migrations, queries, relations)
- Debugging (API, TypeScript, tests, React)
- Deployment
- Common Errors

### 3. Troubleshooting Guide

**File**: [troubleshooting.md](./troubleshooting.md)

Systematic problem diagnosis and step-by-step solutions for common issues.

**Use when**:

- Installation fails
- Database won't connect
- Build errors occur
- Runtime issues appear
- Tests fail unexpectedly
- Development workflow breaks

**Categories covered**:

- Installation Issues (PNPM, Node, dependencies)
- Database Issues (connection, migration, queries)
- Build Issues (TypeScript, Biome, env vars)
- Runtime Issues (API errors, authentication, CORS)
- Test Issues (failures, coverage, Vitest)
- Development Issues (hot reload, ports)

### 4. External Links

**File**: [external-links.md](./external-links.md)

Curated collection of official documentation and learning resources for all technologies used in Hospeda.

**Use when**:

- Need official documentation for a library
- Learning a new technology
- Looking for community resources
- Finding tools and utilities
- Seeking reference materials

**Categories covered**:

- Official Documentation (all tech stack)
- Learning Resources (TypeScript, testing, monorepos)
- Tools & Utilities (Drizzle Studio, VS Code extensions)
- Community (Stack Overflow, Discord)
- Reference (HTTP codes, regex, commits)

## Quick Links

### Essential Resources

| Resource | Description | When to Use |
|----------|-------------|-------------|
| [Glossary](./glossary.md) | Technical terminology | Learning concepts |
| [FAQ](./faq.md) | Quick answers | Common questions |
| [Troubleshooting](./troubleshooting.md) | Problem solutions | Fixing issues |
| [External Links](./external-links.md) | Official docs | Deep learning |

### By Development Phase

**Starting Out:**

1. [Glossary - Core Concepts](./glossary.md#core-concepts)
2. [FAQ - Getting Started](./faq.md#getting-started)
3. [External Links - Official Documentation](./external-links.md#official-documentation)

**Daily Development:**

1. [FAQ - Development](./faq.md#development)
2. [Glossary - Architecture Terms](./glossary.md#architecture-terms)
3. [External Links - Tools & Utilities](./external-links.md#tools--utilities)

**Debugging:**

1. [Troubleshooting Guide](./troubleshooting.md)
2. [FAQ - Debugging](./faq.md#debugging)
3. [FAQ - Common Errors](./faq.md#common-errors)

**Testing:**

1. [FAQ - Testing](./faq.md#testing)
2. [Glossary - Testing Terms](./glossary.md#testing-terms)
3. [Troubleshooting - Test Issues](./troubleshooting.md#test-issues)

## How to Use This Section

### For New Developers

**Week 1 - Foundation:**

1. Read [Glossary - Core Concepts](./glossary.md#core-concepts) to understand business domain
2. Work through [FAQ - Getting Started](./faq.md#getting-started) to set up environment
3. Reference [External Links - Official Documentation](./external-links.md#official-documentation) as you explore

**Week 2 - Development:**

1. Use [FAQ - Development](./faq.md#development) as you create your first entities
2. Keep [Glossary - Architecture Terms](./glossary.md#architecture-terms) handy
3. When stuck, check [Troubleshooting](./troubleshooting.md) first

**Ongoing:**

- Bookmark this README for quick access
- Use browser search (Ctrl+F) within resource files
- Contribute new learnings back to these docs

### For Experienced Developers

- **Quick Reference**: Use FAQ for fast answers
- **Deep Dives**: Check External Links for official documentation
- **Problem Solving**: Troubleshooting guide for systematic debugging
- **Team Knowledge**: Add your learnings to help others

### Search Tips

**In Glossary:**

- Use your browser's find (Ctrl+F / Cmd+F) to search for terms
- Terms are alphabetically organized within categories
- Cross-references point to related concepts

**In FAQ:**

- Questions are organized by workflow phase
- Search for error messages or keywords
- Answers link to detailed documentation

**In Troubleshooting:**

- Search by symptom (e.g., "404", "connection failed")
- Each problem has: Symptoms → Diagnosis → Solution → Prevention
- Solutions are step-by-step and actionable

## Contributing

Help improve these resources! When you:

- **Discover a new pattern**: Add it to the Glossary
- **Solve a problem**: Document it in Troubleshooting
- **Answer a question repeatedly**: Add it to FAQ
- **Find useful resources**: Add them to External Links

### Contribution Guidelines

**1. Glossary Updates:**

- Add new Hospeda-specific terms as they emerge
- Keep definitions clear and concise
- Include code examples where helpful
- Maintain alphabetical order within categories

**2. FAQ Updates:**

- Frame as a question developers actually ask
- Keep answers brief (2-5 sentences max)
- Include code example if applicable
- Link to detailed documentation

**3. Troubleshooting Updates:**

- Document real issues you've encountered
- Follow the format: Symptoms → Diagnosis → Solution → Prevention
- Provide step-by-step solutions
- Include prevention tips

**4. External Links Updates:**

- Only add official or highly-trusted sources
- Include brief description (1-2 sentences)
- Explain relevance to Hospeda
- Keep links organized by category

### How to Contribute

```bash
# 1. Edit the appropriate file
vim docs/resources/faq.md  # or glossary.md, troubleshooting.md, external-links.md

# 2. Follow the existing format and style

# 3. Commit with conventional commit message
git add docs/resources/faq.md
git commit -m "docs(resources): add FAQ entry for database migrations"

# 4. Push and create PR (when working on branches)
```

### Quality Standards

- **Accuracy**: Ensure information is correct and tested
- **Clarity**: Write for developers of all experience levels
- **Completeness**: Provide enough detail to be useful
- **Consistency**: Follow existing formatting and style
- **Currency**: Keep information up-to-date with the codebase

## Related Documentation

### Project Documentation

- [Quick Start Guide](../getting-started/setup.md) - Initial project setup
- [Architecture Overview](../architecture/overview.md) - System architecture
- [Development Guide](../development/guide.md) - Development workflows
- [Testing Guide](../testing/guide.md) - Testing strategies

### Claude Code Documentation

- [CLAUDE.md](../../CLAUDE.md) - Project-wide guidelines
- [Workflows](.claude/docs/workflows/README.md) - Development workflows
- [Standards](.claude/docs/standards/README.md) - Code and architecture standards

### Tech Stack Documentation

See [External Links](./external-links.md) for official documentation of all technologies.

## Support

If you can't find what you're looking for:

1. **Search the codebase**: Use VS Code search or grep
2. **Check Claude Code docs**: See `.claude/docs/`
3. **Ask the team**: Slack, Discord, or GitHub Discussions
4. **Create an issue**: Document the gap for future developers

## Maintenance

These resources are living documents and should be updated regularly:

- **After major changes**: Update relevant sections
- **When adding features**: Add new terms to Glossary
- **When solving issues**: Add to Troubleshooting
- **Quarterly review**: Check for outdated information

---

**Remember**: Good documentation helps everyone. If you found a solution, document it so others don't have to struggle with the same issue.

**Next Steps**:

- If you're new: Start with the [Glossary](./glossary.md)
- If you're stuck: Check the [Troubleshooting Guide](./troubleshooting.md)
- If you have questions: Browse the [FAQ](./faq.md)
- If you need docs: See [External Links](./external-links.md)

---

*Last updated: 2025-11-06*
