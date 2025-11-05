# System Diagrams

This directory contains Mermaid diagrams visualizing the Hospeda workflow system architecture.

## Available Diagrams

### 1. Workflow Decision Tree

**File:** [workflow-decision-tree.mmd](./workflow-decision-tree.mmd)

**Purpose:** Visual guide for selecting the appropriate workflow level

**Shows:**

- Decision criteria for each workflow level
- Level 1 (Quick Fix): < 30min, 1-2 files, very low risk
- Level 2 (Atomic Task): 30min-3h, 2-10 files, low-medium risk
- Level 3 (Feature Planning): Multi-day, architecture, DB changes
- Step counts for each level
- Color-coded paths (green=quick, orange=atomic, blue=feature)

**Use When:**

- Starting a new task
- Uncertain which workflow to use
- Training new team members
- Documenting workflow selection

**View:**

```mermaid
# Paste content from workflow-decision-tree.mmd
```

---

### 2. Agent Hierarchy

**File:** [agent-hierarchy.mmd](./agent-hierarchy.mmd)

**Purpose:** Visual organization of the 14 specialized agents across 6 categories

**Shows:**

- User/Principal Architect at top
- tech-lead as central coordinator
- 6 teams:
  - Product Team (product-functional, product-technical)
  - Backend Team (hono-engineer, db-engineer, node-typescript-engineer)
  - Frontend Team (astro-engineer, tanstack-start-engineer, react-senior-dev)
  - Design & Content (ux-ui-designer, content-writer)
  - Quality Team (qa-engineer, debugger)
  - Specialized Team (tech-writer, i18n-specialist, enrichment-agent, seo-ai-specialist)
- Reporting lines
- Color-coded by team

**Use When:**

- Understanding agent responsibilities
- Assigning tasks to agents
- Documenting team structure
- Planning agent collaboration

**View:**

```mermaid
# Paste content from agent-hierarchy.mmd
```

---

### 3. Tools Relationship

**File:** [tools-relationship.mmd](./tools-relationship.mmd)

**Purpose:** Show how commands, agents, and skills interact

**Shows:**

- 3 layers:
  - Commands Layer (16 commands)
  - Agents Layer (14 agents)
  - Skills Layer (16 skills)
- Flow: Commands → Agents → Skills
- Relationships between specific tools
- Command categories (Quality, Planning, Audit, Meta, Dev)
- Agent groups (Lead, Backend, Frontend, Quality, Support)
- Skill categories (Testing, Development, Design, Utils)

**Use When:**

- Understanding system architecture
- Finding which agent uses which skill
- Documenting tool relationships
- Planning new tools

**View:**

```mermaid
# Paste content from tools-relationship.mmd
```

---

### 4. Documentation Map

**File:** [documentation-map.mmd](./documentation-map.mmd)

**Purpose:** Navigate the `.claude/` directory structure

**Shows:**

- Main directories:
  - `agents/` - Agent definitions (14)
  - `commands/` - Command definitions (16)
  - `skills/` - Skill definitions (16)
  - `docs/` - Documentation
  - `sessions/` - Planning & tasks
- Subdirectories and organization
- Key files (README.md, REGISTRY.md, etc.)
- Session structures (P-004, PB-XXX)
- Color-coded by type

**Use When:**

- Finding specific documentation
- Understanding directory structure
- Adding new documentation
- Navigating the system

**View:**

```mermaid
# Paste content from documentation-map.mmd
```

---

## How to Use These Diagrams

### In Markdown Files

Reference diagrams in documentation:

```markdown
See the [Workflow Decision Tree](../diagrams/workflow-decision-tree.mmd) for workflow selection.
```

### In Mermaid Live Editor

1. Go to [mermaid.live](https://mermaid.live)
2. Copy diagram content
3. Paste into editor
4. View and edit interactively

### In GitHub

GitHub automatically renders `.mmd` files:

- Click on diagram file
- GitHub shows rendered diagram
- Use for reviews and discussions

### In VSCode

Install Mermaid extension:

1. Install "Mermaid Preview" extension
2. Open `.mmd` file
3. Right-click → "Open Preview to the Side"

## Updating Diagrams

When system changes, update relevant diagrams:

1. **Workflow changes** → Update `workflow-decision-tree.mmd`
2. **Agent changes** → Update `agent-hierarchy.mmd`
3. **New commands/skills** → Update `tools-relationship.mmd`
4. **Directory structure** → Update `documentation-map.mmd`

## Diagram Conventions

### Colors

- **Purple** (#8B5CF6): Leadership/Commands/Root
- **Blue** (#3B82F6): Frontend/Agents/Sections
- **Red** (#EF4444): Backend
- **Green** (#10B981): Quality/Skills/Success
- **Orange** (#F59E0B): Support/Utils/Warnings
- **Pink** (#EC4899): Product

### Shapes

- **Rectangle**: Process/Component
- **Diamond**: Decision point
- **Rounded**: Start/End
- **Subgraph**: Grouping/Container

### Arrows

- **Solid** (→): Direct flow
- **Dotted** (-.->): Relationship/Usage
- **Thick**: Primary path
- **Thin**: Secondary path

## Related Documentation

- [Workflow Decision Tree Doc](../workflows/README.md)
- [Agent Documentation](../../agents/README.md)
- [Command Documentation](../../commands/README.md)
- [Skill Documentation](../../skills/README.md)

## Notes

- All diagrams use Mermaid syntax
- Theme configured for consistency
- Colors match brand palette
- Diagrams render in most markdown viewers
- Keep diagrams up to date with system
- Test rendering before committing
