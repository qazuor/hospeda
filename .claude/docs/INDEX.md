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

### Decision Tree & Selection

**[workflows/decision-tree.md](workflows/decision-tree.md)** - Workflow selection framework

**Includes:**

- Interactive Mermaid diagram
- Level 1: Quick Fix (< 30min, 1-2 files)
- Level 2: Atomic Task (30min-3h, 2-10 files)
- Level 3: Feature Planning (Multi-day, architecture changes)
- Decision factors reference
- Common scenarios
- Visual summary table

**Also see:** [diagrams/workflow-decision-tree.mmd](diagrams/workflow-decision-tree.mmd) - Visual flowchart

**Audience:** Before starting any task

### Level 1: Quick Fix Protocol

**[workflows/quick-fix-protocol.md](workflows/quick-fix-protocol.md)** - Trivial changes workflow

**6-Step Process:**

1. Verify Quick Fix Criteria
2. Make the Change
3. Quick Validation
4. Commit with Conventional Message
5. Push or Create PR
6. Done

**Use when:**

- < 30 minutes estimated time
- 1-2 files affected
- Very low risk (typos, formatting, config)
- No architecture changes

**Examples:** Typo fixes, markdown formatting, import organization, environment updates

**Audience:** All developers, for minor fixes

### Level 2: Atomic Task Protocol

**[workflows/atomic-task-protocol.md](workflows/atomic-task-protocol.md)** - Bugfixes and small features

**11-Step TDD Workflow:**

1. Create Atomic Task Session (PB-XXX)
2. Create Simplified Tech Analysis
3. Review & Approve Plan
4. Write Tests First (TDD RED)
5. Implement Solution (GREEN)
6. Refactor (keep tests green)
7. Add Documentation
8. Test Coverage Check (>= 90%)
9. Quality Checks
10. Commit with Conventional Message
11. Update Registry & Close Task

**Use when:**

- 30 minutes to 3 hours estimated time
- 2-10 files affected
- Low to medium risk
- Bugfixes or small features
- No major architecture changes

**Includes:** PB-XXX code system, task registry, tech analysis template, 3 detailed examples

**Audience:** Developers, for most day-to-day work

### Level 3: Feature Planning

**4-Phase Workflow Documentation:**

**Phase 1: Planning**

- **[workflows/phase-1-planning.md](workflows/phase-1-planning.md)** - Comprehensive planning process
- Create PDR (Product Design Requirements)
- Create tech-analysis.md
- Break down into atomic tasks
- Get user approval

**Phase 2: Implementation**

- **[workflows/phase-2-implementation.md](workflows/phase-2-implementation.md)** - TDD implementation
- RED-GREEN-REFACTOR cycle
- Follow existing patterns
- Continuous validation

**Phase 3: Validation**

- **[workflows/phase-3-validation.md](workflows/phase-3-validation.md)** - Quality assurance
- Validate acceptance criteria
- Run quality checks
- Technical review

**Phase 4: Finalization**

- **[workflows/phase-4-finalization.md](workflows/phase-4-finalization.md)** - Documentation and commits
- Update documentation
- Generate commits
- Final checklist

**Use when:**

- Multi-day projects
- Architecture changes required
- Database schema changes
- Multiple team members involved
- High complexity or risk

**Audience:** Tech leads, for complex features

### Supporting Workflows

**[workflows/task-atomization.md](workflows/task-atomization.md)** - Breaking down tasks

- 0.5-4 hour rule
- Dependency mapping
- Granularity guidelines

**[workflows/task-completion-protocol.md](workflows/task-completion-protocol.md)** - Task completion and GitHub sync

- Commit requirements
- Issue synchronization
- Registry updates

---

## 📊 System Diagrams

**Directory:** [diagrams/](diagrams/)

**[diagrams/README.md](diagrams/README.md)** - Diagram usage guide and conventions

### Available Diagrams

**1. Workflow Decision Tree**

- **File:** [diagrams/workflow-decision-tree.mmd](diagrams/workflow-decision-tree.mmd)
- **Purpose:** Visual guide for selecting the appropriate workflow level
- **Shows:** Decision criteria, level characteristics, step counts, color-coded paths
- **Use when:** Starting a new task, uncertain which workflow to use

**2. Agent Hierarchy**

- **File:** [diagrams/agent-hierarchy.mmd](diagrams/agent-hierarchy.mmd)
- **Purpose:** Visual organization of the 13 consolidated agents
- **Shows:** tech-lead as coordinator, 5 teams (Product, Backend, Frontend, Quality, Support)
- **Use when:** Understanding agent responsibilities, assigning tasks

**3. Tools Relationship**

- **File:** [diagrams/tools-relationship.mmd](diagrams/tools-relationship.mmd)
- **Purpose:** Show how commands, agents, and skills interact
- **Shows:** 3 layers (Commands → Agents → Skills), relationships between tools
- **Use when:** Understanding system architecture, finding which agent uses which skill

**4. Documentation Map**

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

**Organization:** Consolidated agent system with 13 specialized agents

**Teams:**

- **Leadership:** tech-lead (Architecture & Coordination)
- **Product:** product-technical (Technical Analysis)
- **Backend Team:** hono-engineer (API), db-engineer (Database)
- **Frontend Team:** astro-engineer (Web), tanstack-engineer (Admin), react-dev (Components)
- **Quality Team:** qa-engineer (Testing), security-engineer (Security), performance-engineer (Performance)
- **Support Team:** tech-writer (Documentation), debugger (Issue Resolution)

**Total:** 13 agents (consolidated from 25)

**Visual:** See [diagrams/agent-hierarchy.mmd](diagrams/agent-hierarchy.mmd)

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
- `checkpoint.schema.json` - Workflow Checkpoints
- `code-registry.schema.json` - Code Registry

**Total:** 7 schemas

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
| mcp-servers.md | ✅ Current | 2025-10-28 |
| **Workflows** | | |
| workflows/decision-tree.md | ✅ Current | 2025-10-31 |
| workflows/quick-fix-protocol.md | ✅ Current | 2025-10-31 |
| workflows/atomic-task-protocol.md | ✅ Current | 2025-10-31 |
| workflows/phase-1-planning.md | ✅ Current | 2025-10-28 |
| workflows/phase-2-implementation.md | ✅ Current | 2025-10-28 |
| workflows/phase-3-validation.md | ✅ Current | 2025-10-28 |
| workflows/phase-4-finalization.md | ✅ Current | 2025-10-28 |
| workflows/task-atomization.md | ✅ Current | 2025-10-28 |
| workflows/task-completion-protocol.md | ✅ Current | 2025-10-28 |
| **Standards** | | |
| standards/code-standards.md | ✅ Current | 2025-10-28 |
| standards/architecture-patterns.md | ✅ Current | 2025-10-28 |
| standards/testing-standards.md | ✅ Current | 2025-10-28 |
| standards/documentation-standards.md | ✅ Current | 2025-10-28 |
| **Diagrams** | | |
| diagrams/README.md | ✅ Current | 2025-10-31 |
| diagrams/workflow-decision-tree.mmd | ✅ Current | 2025-10-31 |
| diagrams/agent-hierarchy.mmd | ✅ Current | 2025-10-31 |
| diagrams/tools-relationship.mmd | ✅ Current | 2025-10-31 |
| diagrams/documentation-map.mmd | ✅ Current | 2025-10-31 |
| **Templates** | | |
| templates/PDR-template.md | ✅ Current | 2025-10-28 |
| templates/tech-analysis-template.md | ✅ Current | 2025-10-28 |
| templates/TODOs-template.md | ✅ Current | 2025-10-28 |

---

*Last updated: 2025-10-31*
