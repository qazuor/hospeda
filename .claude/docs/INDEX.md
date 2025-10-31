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

## 🔄 Workflows

### Decision Tree

**[workflows/decision-tree.md](workflows/decision-tree.md)** - Workflow selection framework

**Includes:**

- Interactive Mermaid diagram
- Level 1: Quick Fix (< 1 hour)
- Level 2: Feature/Refactor (1-40 hours)
- Level 3: Major Initiative (> 40 hours)
- Decision factors reference
- Common scenarios
- Visual summary table

**Audience:** Before starting any task

### Workflow Guides

**Directory:** [workflows/](workflows/)

**Available guides:**

- `decision-tree.md` - Workflow selection (see above)
- `task-atomization.md` - Breaking down tasks (0.5-4h rule)
- `task-completion-protocol.md` - Task completion and GitHub sync
- Other workflow-specific guides

**Audience:** During feature development

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

---

## 🛠️ Tools & Scripts

### Validation Tools

**Scripts:**

- `validate-docs.sh` - Documentation structure validation
- `validate-schemas.ts` - JSON schema validation
- `sync-registry.sh` - Code registry synchronization

**Usage:**

```bash
# Validate documentation
pnpm claude:validate:docs

# Validate schemas
pnpm claude:validate:schemas

# Sync code registry
pnpm claude:sync:registry

# Run all validations
pnpm claude:validate
```

**Documentation:** See script headers for detailed usage

---

## 🤖 System Components

### Agents

**Directory:** [../agents/](../agents/)

**Categories:**

- `product/` - Product planning and analysis (2 agents)
- `engineering/` - Development specialists (9 agents)
- `quality/` - QA and debugging (2 agents)
- `design/` - UI/UX design (1 agent)
- `specialized/` - Domain experts (11 agents)

**Total:** 25 agents

**Documentation:** [../agents/README.md](../agents/README.md)

### Commands

**Directory:** [../commands/](../commands/)

**Categories:**

- `git/` - Version control operations
- `formatting/` - Code formatting
- (Root level for other commands)

**Total:** 16 commands

**Documentation:** [../commands/README.md](../commands/README.md)

### Skills

**Directory:** [../skills/](../skills/)

**Categories:**

- `git/` - Git helpers
- `qa/` - QA validators
- `documentation/` - Documentation tools
- `planning/` - Planning utilities

**Total:** 5 skills

**Documentation:** [../skills/README.md](../skills/README.md)

---

## 🗂️ Templates

**Directory:** [templates/](templates/)

**Available templates:**

- Planning session templates
- Document templates
- Schema templates

**Usage:** Reference when creating new planning sessions or documents

---

## 📊 JSON Schemas

**Directory:** [../schemas/](../schemas/)

**Available schemas:**

- `pdr.schema.json` - Product Design Requirements
- `tech-analysis.schema.json` - Technical Analysis
- `todos.schema.json` - Task Lists
- `problems.schema.json` - Problems & Improvements
- `workflows.schema.json` - Workflow Definitions
- `hooks.schema.json` - Claude Code Hooks
- `checkpoint.schema.json` - Workflow Checkpoints
- `code-registry.schema.json` - Code Registry

**Total:** 8 schemas

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

## 📝 Planning Sessions

**Directory:** [../sessions/planning/](../sessions/planning/)

**Structure:**

```
planning/
├── .code-registry.json     # Computed index (regenerate with sync-registry.sh)
└── {session-folder}/
    ├── PDR.md              # Product requirements
    ├── tech-analysis.md    # Technical analysis
    ├── TODOs.md            # Task list (SOURCE OF TRUTH)
    ├── .checkpoint.json    # Progress tracker
    ├── issues-sync.json    # GitHub issues mapping
    └── problems.md         # (Optional) Problems encountered
```

**Current sessions:** Browse directory for active/archived sessions

---

## 🎯 By Role

### Product Manager / Designer

**Essential reading:**

1. [quick-start.md](quick-start.md) - System overview
2. [glossary.md](glossary.md) - Terminology (PDR, User Stories sections)
3. [workflows/decision-tree.md](workflows/decision-tree.md) - Choosing workflow level
4. [../agents/product/](../agents/product/) - Product agents

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
3. [workflows/](workflows/) - All workflow guides
4. [glossary.md](glossary.md) - Complete reference

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
- [workflows/decision-tree.md](workflows/decision-tree.md) - Choose workflow level
- [standards/code-standards.md](standards/code-standards.md) - Coding guidelines

### Validation & Tools

- `pnpm claude:validate` - Run all validations
- `pnpm claude:validate:docs` - Validate documentation
- `pnpm claude:validate:schemas` - Validate schemas
- `pnpm claude:sync:registry` - Sync code registry

### External Resources

- [Claude Code Docs](https://docs.claude.com/claude-code) - Official documentation
- [Hospeda Repository](https://github.com/qazuor/hospeda) - Source code
- [Issue Tracker](https://github.com/qazuor/hospeda/issues) - Report bugs/requests

---

## 📚 Documentation Maintenance

### Adding New Documentation

1. Create file in appropriate directory:
   - Core docs: `.claude/docs/`
   - Workflows: `.claude/docs/workflows/`
   - Standards: `.claude/docs/standards/`
   - Templates: `.claude/docs/templates/`

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
| INDEX.md | ✅ Current | 2025-10-31 |
| quick-start.md | ✅ Current | 2025-10-31 |
| glossary.md | ✅ Current | 2025-10-31 |
| workflows/decision-tree.md | ✅ Current | 2025-10-31 |
| standards/code-standards.md | ✅ Current | 2025-10-28 |
| standards/architecture-patterns.md | ✅ Current | 2025-10-28 |
| standards/testing-standards.md | ✅ Current | 2025-10-28 |
| mcp-servers.md | ✅ Current | 2025-10-28 |

---

*Last updated: 2025-10-31*
