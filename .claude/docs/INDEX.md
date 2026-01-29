# Documentation Index

Master index for all Claude Code workflow system documentation.

---

## 🚀 Getting Started

### Quick Start (15 minutes)

**[quick-start.md](quick-start.md)** - Essential onboarding guide

- Prerequisites and setup
- System structure overview
- Choose your workflow level
- First feature walkthrough
- Common tasks reference
- Best practices

**Audience:** New users, developers joining the project

---

## 📖 Reference Documentation

### Glossary

**[glossary.md](glossary.md)** - Comprehensive terminology reference

**Sections:**

- Core Concepts (Agent, Command, Skill, MCP)
- Planning & Organization (Planning Code, Task Code, PDR, Tech Analysis)
- Workflow System (Workflow Level, Phase, Checkpoint)
- Development Practices (TDD, Atomization, RO-RO)
- Quality & Validation (Schema Validation, Code Registry)
- Architecture Patterns (Base Model, Base Service, Factories)
- Conventions (Naming, File Organization, Language Policy)
- Tools & Scripts
- Git & Version Control
- External References

**Audience:** All users, for lookups and clarification

---

## 📊 System Diagrams

**Directory:** [diagrams/](diagrams/)

**[diagrams/README.md](diagrams/README.md)** - Diagram usage guide and conventions

### Available Diagrams

#### 1. Agent Hierarchy

- **File:** [diagrams/agent-hierarchy.mmd](diagrams/agent-hierarchy.mmd)
- **Purpose:** Visual organization of the 13 specialized agents across 6 categories
- **Shows:** tech-lead as coordinator, agent teams (Product, Backend, Frontend, Design, Quality, Specialized)
- **Use when:** Understanding agent responsibilities, assigning tasks

#### 2. Tools Relationship

- **File:** [diagrams/tools-relationship.mmd](diagrams/tools-relationship.mmd)
- **Purpose:** Show how commands, agents, and skills interact
- **Shows:** 3 layers (Commands → Agents → Skills), relationships between tools
- **Use when:** Understanding system architecture, finding which agent uses which skill

#### 3. Documentation Map

- **File:** [diagrams/documentation-map.mmd](diagrams/documentation-map.mmd)
- **Purpose:** Navigate the `.claude/` directory structure
- **Shows:** Main directories, subdirectories, key files, session structures
- **Use when:** Finding specific documentation, understanding directory structure

### Viewing Diagrams

- **GitHub:** Automatically renders `.mmd` files
- **VSCode:** Install "Mermaid Preview" extension
- **Mermaid Live:** [mermaid.live](https://mermaid.live) - Copy/paste for interactive editing
- **Documentation:** Embed in markdown with mermaid code blocks

**All diagrams use consistent theme, colors, and conventions - see [diagrams/README.md](diagrams/README.md)**

---

## 📐 Standards

### Code Standards

**[standards/code-standards.md](standards/code-standards.md)** - Code quality guidelines

**Includes:**

- Language policy (English only)
- TypeScript guidelines (no `any`, use `unknown`)
- Naming conventions
- File size limits (500 lines)
- Export patterns (named only)
- RO-RO pattern
- JSDoc requirements

**Audience:** During implementation (Phase 2)

### Architecture Patterns

**[standards/architecture-patterns.md](standards/architecture-patterns.md)** - System design patterns

**Includes:**

- Layered architecture (Database → Service → API → Frontend)
- Base Model pattern
- Base Service pattern
- Factory patterns (CRUD routes, List routes)
- Validation with Zod
- Error handling

**Audience:** During architecture design

### Testing Standards

**[standards/testing-standards.md](standards/testing-standards.md)** - Testing requirements

**Includes:**

- TDD methodology (Red → Green → Refactor)
- Coverage requirements (90% minimum)
- Test types (Unit, Integration, E2E)
- Test organization (AAA pattern)
- Test file structure

**Audience:** During implementation and validation

### Atomic Commits Policy

**[standards/atomic-commits.md](standards/atomic-commits.md)** - Git commit guidelines

**Includes:**

- Atomic commit definition and benefits
- CRITICAL project policy
- Workflow by level (Quick Fix, Atomic Task, Feature)
- Common patterns and anti-patterns
- Tools and commands
- Pre-commit checklist

**Audience:** All developers, during all phases

---

## 📖 Examples

### End-to-End Workflow Example

**[examples/end-to-end-workflow.md](examples/end-to-end-workflow.md)** - Complete feature implementation

**Feature:** User Favorites for Accommodations

**Demonstrates:**

- **Phase 1**: Planning (PDR, tech-analysis, task breakdown)
- **Phase 2**: Implementation (TDD, atomic commits, 13 tasks)
- **Phase 3**: Validation (E2E tests, quality checks)
- **Phase 4**: Finalization (docs, CHANGELOG, deployment)

**Includes:**

- Real code examples (schemas, models, services, API, components)
- TDD workflow (Red → Green → Refactor)
- Atomic commits (one per task with PB-XXX codes)
- Performance metrics and results
- Lessons learned

**Use when:** Learning the complete workflow, onboarding new developers, understanding best practices

**Audience:** All developers, especially those new to the project

---

---

## 🤖 System Components

### Agents

**Directory:** [../agents/](../agents/)

**Organization:** Specialized agent system with 13 agents organized in 7 categories

**Teams:**

- **Product & Planning (2):** product-functional, product-technical
- **Technical Leadership (1):** tech-lead
- **Backend Development (3):** hono-engineer, db-drizzle-engineer, node-typescript-engineer
- **Frontend Development (3):** astro-engineer, react-senior-dev, tanstack-start-engineer
- **Design & UX (2):** ux-ui-designer, content-writer
- **Quality Assurance (2):** qa-engineer, debugger
- **Specialized (3):** tech-writer, i18n-specialist, seo-ai-specialist

**Total:** 13 agents

**Visual:** See [diagrams/agent-hierarchy.mmd](diagrams/agent-hierarchy.mmd)

**Documentation:** [../agents/README.md](../agents/README.md)

### Commands

**Directory:** [../commands/](../commands/)

**Categories:**

- `git/` - Version control operations
- `formatting/` - Code formatting
- (Root level for other commands)

**Total:** 15 commands

**Documentation:** [../commands/README.md](../commands/README.md)

### Skills

**Directory:** [../skills/](../skills/)

**Categories:**

- **Testing & Quality (6 skills):**
  - web-app-testing, api-app-testing, performance-testing
  - security-testing, tdd-methodology, qa-criteria-validator
- **Development Tools (5 skills):**
  - git-commit-helper, vercel-specialist, shadcn-specialist
  - mermaid-diagram-specialist, add-memory
- **Design & Patterns (3 skills):**
  - brand-guidelines, error-handling-patterns, markdown-formatter
- **Documentation & Utils (2 skills):**
  - pdf-creator-editor, json-data-auditor

**Total:** 16 skills (expanded from 5)

**Visual:** See [diagrams/tools-relationship.mmd](diagrams/tools-relationship.mmd)

**Documentation:** [../skills/README.md](../skills/README.md)

---

## 📊 JSON Schemas

**Directory:** [../schemas/](../schemas/)

**Available schemas:**

- `pdr.schema.json` - Product Design Requirements
- `tech-analysis.schema.json` - Technical Analysis
- `todos.schema.json` - Task Lists
- `problems.schema.json` - Problems & Improvements
- `workflows.schema.json` - Workflow Definitions
- `checkpoint.schema.json` - Workflow Checkpoints

**Total:** 6 schemas

**Validation:** Run `pnpm claude:validate:schemas`

---

## 🔌 MCP Servers

**[mcp-servers.md](mcp-servers.md)** - Model Context Protocol integrations

**Available servers:**

- Context7 (library documentation)
- Serena (code analysis)
- Cloudflare Docs
- Neon (PostgreSQL)
- Mercado Pago (payments)
- GitHub
- Vercel
- And more (15 total)

**Usage:** Automatically available to Claude Code

---

## 🎯 By Role

### Product Manager / Designer

**Essential reading:**

1. [quick-start.md](quick-start.md) - System overview
2. [glossary.md](glossary.md) - Terminology (PDR, User Stories sections)
3. [../agents/product/](../agents/product/) - Product agents

**Common tasks:**

- Create PDR with user stories
- Define acceptance criteria
- Review mockups and designs

### Developer

**Essential reading:**

1. [quick-start.md](quick-start.md) - Onboarding
2. [glossary.md](glossary.md) - Full reference
3. [standards/code-standards.md](standards/code-standards.md) - Coding guidelines
4. [standards/architecture-patterns.md](standards/architecture-patterns.md) - Design patterns
5. [standards/testing-standards.md](standards/testing-standards.md) - Testing requirements

**Common tasks:**

- Implement features following TDD
- Run quality checks
- Create commits
- Review code

### QA Engineer

**Essential reading:**

1. [glossary.md](glossary.md) - Terminology (QA sections)
2. [standards/testing-standards.md](standards/testing-standards.md) - Testing requirements
3. [../skills/qa/](../skills/qa/) - QA skills

**Common tasks:**

- Validate acceptance criteria
- Run test suites
- Perform security audits
- Generate quality reports

### Tech Lead / Architect

**Essential reading:**

1. [standards/architecture-patterns.md](standards/architecture-patterns.md) - System patterns
2. [standards/code-standards.md](standards/code-standards.md) - Code guidelines
3. [glossary.md](glossary.md) - Complete reference

**Common tasks:**

- Review architecture decisions
- Validate design patterns
- Coordinate cross-team efforts
- Set technical standards

---

## 🔍 Quick Links

### Most Referenced

- [quick-start.md](quick-start.md) - 15-minute onboarding
- [glossary.md](glossary.md) - Terminology reference
- [standards/code-standards.md](standards/code-standards.md) - Coding guidelines

### Validation & Tools

- `pnpm claude:validate` - Run all validations
- `pnpm claude:validate:docs` - Validate documentation
- `pnpm claude:validate:schemas` - Validate schemas

### External Resources

- [Claude Code Docs](https://docs.claude.com/claude-code) - Official documentation
- [Hospeda Repository](https://github.com/qazuor/hospeda) - Source code
- [Issue Tracker](https://github.com/qazuor/hospeda/issues) - Report bugs/requests

---

## 📚 Documentation Maintenance

### Adding New Documentation

1. Create file in appropriate directory:
   - Core docs: `.claude/docs/`
   - Standards: `.claude/docs/standards/`

2. Update this INDEX.md with link to new document

3. Add entry to glossary.md if introducing new terms

4. Run validation:

   ```bash
   pnpm claude:validate:docs
   pnpm format:md
   ```

### Updating Existing Documentation

1. Make changes to relevant file(s)

2. Update "Last updated" date at bottom of file

3. If structure changed, update INDEX.md

4. Run validation:

   ```bash
   pnpm claude:validate:docs
   pnpm format:md
   ```

### Documentation Standards

- All docs in English
- Use Markdown format
- Include "Last updated" date
- Link to related documents
- Use proper heading hierarchy
- Add code examples where helpful
- Keep tone professional but friendly

---

## 📅 Document Status

| Document | Status | Last Updated |
|----------|--------|--------------|
| INDEX.md | ✅ Current | 2026-01-29 |
| quick-start.md | ✅ Current | 2026-01-29 |
| glossary.md | ✅ Current | 2025-10-31 |
| mcp-servers.md | ✅ Current | 2025-10-28 |
| **Standards** | | |
| standards/code-standards.md | ✅ Current | 2025-10-28 |
| standards/architecture-patterns.md | ✅ Current | 2025-10-28 |
| standards/testing-standards.md | ✅ Current | 2025-10-28 |
| standards/atomic-commits.md | ✅ Current | 2025-11-03 |
| standards/documentation-standards.md | ✅ Current | 2025-10-28 |
| **Examples** | | |
| examples/end-to-end-workflow.md | ✅ Current | 2025-11-03 |
| **Diagrams** | | |
| diagrams/README.md | ✅ Current | 2026-01-29 |
| diagrams/agent-hierarchy.mmd | ✅ Current | 2025-10-31 |
| diagrams/tools-relationship.mmd | ✅ Current | 2025-10-31 |
| diagrams/documentation-map.mmd | ✅ Current | 2025-10-31 |

---

Last updated: 2026-01-29
