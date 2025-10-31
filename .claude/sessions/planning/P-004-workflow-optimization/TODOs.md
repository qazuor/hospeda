# TODO List: Workflow Optimization System

**Related Documents:**

- [PDR (Product Design Requirements)](./PDR.md)
- [Technical Analysis](./tech-analysis.md)

**Feature Code**: PF-004
**Feature Status**: Planning Complete - Ready for Implementation
**Start Date**: 2025-10-30
**Target Date**: 2025-11-13 (14 days)
**Actual Completion**: TBD

---

## Progress Summary

**Overall Progress**: 0% complete (0/37 tasks)

| Priority | Total | Completed | In Progress | Not Started |
|----------|-------|-----------|-------------|-------------|
| P0 (Critical) | 30 | 0 | 0 | 30 |
| P1 (High) | 5 | 0 | 0 | 5 |
| P2 (Medium) | 2 | 0 | 0 | 2 |
| **Total** | **37** | **0** | **0** | **37** |

**Estimated Total Time**: 79 hours (~10-11 days of work)

**Velocity**: TBD (will track after first 3 tasks)

---

## Phase 1: Foundation (2-3 days) 🔲 Not Started

**Goal**: Set up new structure without breaking existing system

**Total Tasks**: 6
**Estimated Time**: 16 hours
**Status**: Not Started

### PF004-1: Create New Directory Structure

- [ ] **[1h]** Create new directory structure
  - **Priority**: P0 (Critical)
  - **Dependencies**: None
  - **Assignee**: @product-technical
  - **Status**: Not Started
  - **Acceptance Criteria**:
    - All new folders created in `.claude/`
    - agents/, commands/, skills/ with category subfolders
    - docs/schemas/, docs/diagrams/, docs/learnings/ folders exist
    - sessions/planning/bugfix-small/ folder exists
    - scripts/ folder for automation scripts
    - Nothing deleted yet (backward compatibility)
  - **Notes**: Use tech-analysis.md Section 4.1 as reference

### PF004-2: Create JSON Schemas

- [ ] **[3h]** Create all 7 JSON schemas
  - **Priority**: P0 (Critical)
  - **Dependencies**: PF004-1
  - **Assignee**: @product-technical
  - **Status**: Not Started
  - **Subtasks**:
    - [ ] PF004-2.1: PDR.schema.json
    - [ ] PF004-2.2: tech-analysis.schema.json
    - [ ] PF004-2.3: TODOs.schema.json
    - [ ] PF004-2.4: agent-definition.schema.json
    - [ ] PF004-2.5: command-definition.schema.json
    - [ ] PF004-2.6: skill-definition.schema.json
    - [ ] PF004-2.7: code-registry.schema.json
  - **Acceptance Criteria**:
    - All schemas follow JSON Schema Draft 07 standard
    - Each schema has description and required fields
    - Schemas validate against example files
    - Frontmatter validation included for agents/commands/skills
  - **Notes**: See tech-analysis.md Section 8 for examples

### PF004-3: Create Code Registry System

- [ ] **[2h]** Implement code registry system
  - **Priority**: P0 (Critical)
  - **Dependencies**: PF004-2 (code-registry.schema.json)
  - **Assignee**: @product-technical
  - **Status**: Not Started
  - **Acceptance Criteria**:
    - `.code-registry.json` created at `.claude/sessions/planning/`
    - Schema validation passes
    - Populated with existing planning sessions (if any)
    - Supports PF-XXX (features), PR-XXX (refactors), PB-XXX (bugfix/small)
    - lastPlanningNumber field tracks increment
  - **Notes**: Registry is computed, TODOs.md is source of truth

### PF004-4: Create Validation Scripts

- [ ] **[4h]** Create validation and sync scripts
  - **Priority**: P0 (Critical)
  - **Dependencies**: PF004-2, PF004-3
  - **Assignee**: @product-technical
  - **Status**: Not Started
  - **Subtasks**:
    - [ ] PF004-4.1: `validate-docs.sh` - Check docs consistency
    - [ ] PF004-4.2: `sync-registry.sh` - Regenerate registry from TODOs
    - [ ] PF004-4.3: `validate-schemas.js` - Validate all docs against schemas
    - [ ] PF004-4.4: Add pnpm scripts to root package.json
  - **Acceptance Criteria**:
    - `validate-docs.sh` checks agent/command/skill counts
    - `validate-docs.sh` validates no broken links
    - `sync-registry.sh` regenerates registry from all TODOs.md
    - `validate-schemas.js` validates all markdown frontmatter
    - Scripts exit with code 0 on success, 1 on failure
    - Scripts run in < 10s on full repo
  - **Notes**: Use ajv for JSON Schema validation

### PF004-5: Create New Documentation

- [ ] **[4h]** Create core documentation files
  - **Priority**: P0 (Critical)
  - **Dependencies**: PF004-1
  - **Assignee**: @tech-writer
  - **Status**: Not Started
  - **Subtasks**:
    - [ ] PF004-5.1: `.claude/docs/INDEX.md` - Master index
    - [ ] PF004-5.2: `.claude/docs/quick-start.md` - 15min onboarding
    - [ ] PF004-5.3: `.claude/docs/glossary.md` - Terminology
    - [ ] PF004-5.4: `.claude/docs/workflows/decision-tree.md` - Workflow selection
  - **Acceptance Criteria**:
    - INDEX.md links to all major docs
    - quick-start.md enables 15-minute onboarding
    - glossary.md defines: agent, command, skill, MCP, planning code, etc.
    - decision-tree.md has Mermaid diagram + prose explanation
    - All files in English
  - **Notes**: Reference PDR Section 5 for content

### PF004-6: Set Up Telemetry System

- [ ] **[2h]** Create telemetry tracking system
  - **Priority**: P0 (Critical)
  - **Dependencies**: PF004-2 (schemas)
  - **Assignee**: @product-technical
  - **Status**: Not Started
  - **Acceptance Criteria**:
    - Schema for `.telemetry.json` created
    - Telemetry file structure defined (agents, commands, skills, workflows)
    - `.telemetry.json` added to `.gitignore`
    - `telemetry-report.js` script generates readable report
    - pnpm script `telemetry:report` added
  - **Notes**: Local only, privacy-first, gitignored

---

## Phase 2: Consolidation (2-3 days) 🔲 Not Started

**Goal**: Reorganize agents, commands, skills

**Total Tasks**: 10
**Estimated Time**: 24 hours
**Status**: Not Started

### PF004-7: Archive Removed Agents

- [ ] **[2h]** Move deprecated agents to archive
  - **Priority**: P0 (Critical)
  - **Dependencies**: PF004-1
  - **Assignee**: @product-technical
  - **Status**: Not Started
  - **Acceptance Criteria**:
    - 12 agent files deleted (not archived - clean removal):
      - architecture-validator.md
      - backend-reviewer.md
      - frontend-reviewer.md
      - dependency-mapper.md
      - changelog-specialist.md
      - prompt-engineer.md
      - security-engineer.md
      - performance-engineer.md
      - accessibility-engineer.md
      - deployment-engineer.md
      - cicd-engineer.md
      - payments-specialist.md
    - Each file contains note explaining reason for removal
    - Consolidation notes added to receiving agents (tech-lead, tech-writer)
  - **Notes**: See PDR Section 5.1 for consolidation rationale

### PF004-8: Update Consolidated Agents

- [ ] **[3h]** Update agents absorbing responsibilities
  - **Priority**: P0 (Critical)
  - **Dependencies**: PF004-7
  - **Assignee**: @product-technical
  - **Status**: Not Started
  - **Subtasks**:
    - [ ] PF004-8.1: Update tech-lead.md (absorb architecture-validator, backend-reviewer, frontend-reviewer)
    - [ ] PF004-8.2: Update tech-writer.md (absorb dependency-mapper, changelog-specialist)
  - **Acceptance Criteria**:
    - tech-lead.md includes architecture validation, backend review, frontend review responsibilities
    - tech-writer.md includes dependency tracking and changelog generation
    - Skills references updated appropriately
    - YAML frontmatter updated with new responsibilities
  - **Notes**: Ensure no overlap, clear separation of concerns

### PF004-9: Rename and Reorganize Agents

- [ ] **[2h]** Rename agents to more specific names
  - **Priority**: P0 (Critical)
  - **Dependencies**: PF004-7, PF004-8
  - **Assignee**: @product-technical
  - **Status**: Not Started
  - **Subtasks**:
    - [ ] PF004-9.1: Rename db-engineer.md → db-drizzle-engineer.md
    - [ ] PF004-9.2: Rename react-dev.md → react-senior-dev.md
    - [ ] PF004-9.3: Rename tanstack-engineer.md → tanstack-start-engineer.md
    - [ ] PF004-9.4: Rename ui-ux-designer.md → ux-ui-designer.md
    - [ ] PF004-9.5: Move agents into category subfolders
  - **Acceptance Criteria**:
    - All 4 agents renamed with more specific names
    - Agents organized into subfolders: product/, engineering/, quality/, design/, specialized/
    - All internal references updated
    - YAML frontmatter updated with new names
  - **Notes**: Category structure from tech-analysis.md Section 4.1

### PF004-10: Update agents/README.md

- [ ] **[1h]** Update agents README with new structure
  - **Priority**: P0 (Critical)
  - **Dependencies**: PF004-7, PF004-8, PF004-9
  - **Assignee**: @tech-writer
  - **Status**: Not Started
  - **Acceptance Criteria**:
    - Count updated to 13 agents
    - All agents listed with new names and categories
    - Categories: Product (2), Leadership (1), Backend (2), Frontend (3), Design (1), Quality (2), Specialized (2)
    - Links to all agent files working
    - Description of each agent updated
  - **Notes**: Follow format from tech-analysis.md Section 4.1

### PF004-11: Archive Removed Commands

- [ ] **[1h]** Delete or move deprecated commands
  - **Priority**: P0 (Critical)
  - **Dependencies**: PF004-1
  - **Assignee**: @product-technical
  - **Status**: Not Started
  - **Acceptance Criteria**:
    - 5 command files deleted (clean removal):
      - review-code.md (redundant with /quality-check)
      - review-security.md (merged into /security-audit)
      - pen-test.md (merged into /security-audit)
      - review-performance.md (merged into /performance-audit)
      - rule2hook.md (removed per user decision)
    - format-md.md renamed to format-markdown.md and moved to formatting/ subfolder
    - Each file contains reason for removal/merge
  - **Notes**: See PDR Section 5.2

### PF004-12: Create New Audit Commands

- [ ] **[3h]** Create audit command replacements
  - **Priority**: P0 (Critical)
  - **Dependencies**: PF004-11
  - **Assignee**: @product-technical
  - **Status**: Not Started
  - **Subtasks**:
    - [ ] PF004-12.1: Create `/security-audit` command
    - [ ] PF004-12.2: Create `/performance-audit` command
    - [ ] PF004-12.3: Create `/accessibility-audit` command
  - **Acceptance Criteria**:
    - Each command has complete markdown file with:
      - YAML frontmatter (name, type, category, description)
      - Purpose, usage, steps, output format
      - Report generation (security-audit-report.md, etc.)
    - Commands placed in commands/audit/ subfolder
    - Validation scripts can parse command files
  - **Notes**: These replace agent-based audits with command-based audits

### PF004-13: Create Meta-Commands

- [ ] **[4h]** Create system extensibility commands
  - **Priority**: P1 (High)
  - **Dependencies**: PF004-2 (schemas), PF004-5
  - **Assignee**: @product-technical
  - **Status**: Not Started
  - **Subtasks**:
    - [ ] PF004-13.1: Create `/create-agent` command
    - [ ] PF004-13.2: Create `/create-command` command
    - [ ] PF004-13.3: Create `/create-skill` command
    - [ ] PF004-13.4: Create `/help` command
  - **Acceptance Criteria**:
    - `/create-agent` scaffolds new agent with template, updates README
    - `/create-command` scaffolds new command with template, updates README
    - `/create-skill` scaffolds new skill with template, updates README
    - `/help` lists all commands, shows details, supports search
    - All meta-commands validate using JSON schemas
    - Commands placed in commands/meta/ subfolder
  - **Notes**: Enable self-extending system

### PF004-14: Update commands/README.md

- [ ] **[1h]** Update commands README with new structure
  - **Priority**: P0 (Critical)
  - **Dependencies**: PF004-11, PF004-12, PF004-13
  - **Assignee**: @tech-writer
  - **Status**: Not Started
  - **Acceptance Criteria**:
    - Count updated to 18 commands
    - Commands categorized: Planning (2), Quality (3), Audit (3), Development (2), Formatting (1), Git (1), Integration (1), Analysis (1), Meta (4)
    - All commands listed with descriptions
    - Links to all command files working
    - Category descriptions clear
  - **Notes**: Follow format from PDR Section 5.2

### PF004-15: Create New Skills

- [ ] **[6h]** Create 11 new specialized skills
  - **Priority**: P1 (High)
  - **Dependencies**: PF004-1
  - **Assignee**: @tech-writer, @product-technical
  - **Status**: Not Started
  - **Subtasks**:
    - [ ] PF004-15.1: `api-app-testing.md` (Testing category)
    - [ ] PF004-15.2: `performance-testing.md` (Testing category)
    - [ ] PF004-15.3: `security-testing.md` (Testing category)
    - [ ] PF004-15.4: `tdd-methodology.md` (Patterns category)
    - [ ] PF004-15.5: `error-handling-patterns.md` (Patterns category)
    - [ ] PF004-15.6: `vercel-specialist.md` (Tech category)
    - [ ] PF004-15.7: `shadcn-specialist.md` (Tech category)
    - [ ] PF004-15.8: `mermaid-diagram-specialist.md` (Tech category)
    - [ ] PF004-15.9: `add-memory.md` (Utils category) - Auto-learning skill
    - [ ] PF004-15.10: `pdf-creator-editor.md` (Utils category)
    - [ ] PF004-15.11: `json-data-auditor.md` (Utils category)
  - **Acceptance Criteria**:
    - Each skill has complete documentation with:
      - YAML frontmatter (name, type, category, usedBy, description)
      - Purpose, methodology, patterns/checklists, examples
      - References to related skills/agents
    - Skills placed in appropriate category subfolders
    - Markdown formatter.md skill deleted (duplicates command)
  - **Notes**: See PDR Section 5.3 for descriptions

### PF004-16: Update skills/README.md

- [ ] **[1h]** Update skills README with new structure
  - **Priority**: P0 (Critical)
  - **Dependencies**: PF004-15
  - **Assignee**: @tech-writer
  - **Status**: Not Started
  - **Acceptance Criteria**:
    - Count updated to 16 skills
    - Skills categorized: Testing (4), QA (1), Design (1), Git (1), Patterns (2), Tech (3), Utils (4)
    - All skills listed with descriptions and "Used By" agents
    - Links to all skill files working
    - Decision matrix: When to create skill vs command vs agent
  - **Notes**: Follow format from PDR Section 5.3

---

## Phase 3: Workflows (1-2 days) 🔲 Not Started

**Goal**: Implement new workflow levels

**Total Tasks**: 4
**Estimated Time**: 9 hours
**Status**: Not Started

### PF004-17: Create Quick Fix Protocol

- [ ] **[2h]** Document Level 1 workflow
  - **Priority**: P0 (Critical)
  - **Dependencies**: PF004-5 (decision-tree.md)
  - **Assignee**: @tech-writer
  - **Status**: Not Started
  - **Acceptance Criteria**:
    - `.claude/docs/workflows/quick-fix-protocol.md` created
    - Criteria for quick fixes clear (< 30 min, 1-2 files, very low risk)
    - Workflow steps documented (6 steps)
    - Examples provided (typos, style tweaks, doc updates)
    - No planning docs required
  - **Notes**: Simplest workflow, minimal overhead

### PF004-18: Create Bugfix/Small Feature Workflow

- [ ] **[3h]** Document Level 2 workflow
  - **Priority**: P0 (Critical)
  - **Dependencies**: PF004-3 (registry), PF004-5
  - **Assignee**: @tech-writer
  - **Status**: Not Started
  - **Acceptance Criteria**:
    - `.claude/docs/workflows/bugfix-small-workflow.md` created
    - Criteria clear (30 min - 3h, 2-10 files, low-medium risk)
    - PB-XXX code system documented
    - Workflow steps documented (11 steps)
    - Simplified tech-analysis.md template (no PDR needed)
    - Examples provided (bugfixes, small features, small refactors)
  - **Notes**: Middle ground between quick fix and full planning

### PF004-19: Create Workflow Diagrams

- [ ] **[2h]** Create Mermaid diagrams
  - **Priority**: P0 (Critical)
  - **Dependencies**: PF004-17, PF004-18
  - **Assignee**: @tech-writer, @ux-ui-designer
  - **Status**: Not Started
  - **Subtasks**:
    - [ ] PF004-19.1: Decision tree diagram (workflow selection)
    - [ ] PF004-19.2: Agent hierarchy diagram
    - [ ] PF004-19.3: Tools relationship diagram (commands → agents → skills)
    - [ ] PF004-19.4: Documentation map diagram
  - **Acceptance Criteria**:
    - All diagrams in `.claude/docs/diagrams/` as .mmd files
    - Diagrams render correctly in markdown viewers
    - Diagrams linked from relevant docs
    - Decision tree is clear and actionable
  - **Notes**: Use mermaid-diagram-specialist skill

### PF004-20: Update Existing Workflow Docs

- [ ] **[2h]** Update Phase 1-4 workflow docs
  - **Priority**: P1 (High)
  - **Dependencies**: PF004-17, PF004-18, PF004-19
  - **Assignee**: @tech-writer
  - **Status**: Not Started
  - **Acceptance Criteria**:
    - phase-1-planning.md references Level 3 workflow
    - phase-2-implementation.md mentions all 3 levels
    - phase-3-validation.md applies to all levels
    - phase-4-finalization.md applies to all levels
    - Cross-references to decision-tree.md added
    - Links to quick-fix-protocol.md and bugfix-small-workflow.md added
  - **Notes**: Maintain consistency across all workflow docs

---

## Phase 4: CLAUDE.md Restructure (1 day) 🔲 Not Started

**Goal**: Slim down and modularize CLAUDE.md

**Total Tasks**: 4
**Estimated Time**: 8 hours
**Status**: Not Started

### PF004-21: Create New CLAUDE.md Structure

- [ ] **[3h]** Restructure main CLAUDE.md
  - **Priority**: P0 (Critical)
  - **Dependencies**: PF004-10, PF004-14, PF004-16 (all READMEs updated)
  - **Assignee**: @tech-writer, @product-technical
  - **Status**: Not Started
  - **Acceptance Criteria**:
    - CLAUDE.md reduced from ~1000 to ~300-400 lines (60% reduction)
    - 10 sections: Identity, Quick Start, Essentials, Workflow, Tools, Rules, Communication, Recent Learnings (max 10), Archived Learnings (links), Important Links
    - Links instead of duplicating content
    - Quick reference tables for agents/commands/skills
    - Decision tree prominently linked
    - Agent identity clear at top
  - **Notes**: See tech-analysis.md Section 10 for structure

### PF004-22: Migrate Learnings

- [ ] **[2h]** Extract learnings to individual files
  - **Priority**: P0 (Critical)
  - **Dependencies**: PF004-1
  - **Assignee**: @tech-writer
  - **Status**: Not Started
  - **Acceptance Criteria**:
    - Existing learnings from CLAUDE.md extracted
    - Each learning as individual file in `.claude/docs/learnings/`
    - Filename format: `{descriptive-title-kebab-case}.md`
    - Each file has structure: Title, Date, Category, Problem, Solution, Impact, Related
    - Keep latest 10 learnings inline in CLAUDE.md
    - All archived learnings linked in "Archived Learnings" section
  - **Notes**: One file per learning, not monthly archives

### PF004-23: Update All Cross-References

- [ ] **[2h]** Fix all links after restructure
  - **Priority**: P0 (Critical)
  - **Dependencies**: PF004-21, PF004-22
  - **Assignee**: @tech-writer
  - **Status**: Not Started
  - **Acceptance Criteria**:
    - All links in CLAUDE.md working
    - All links in agent files updated to new structure
    - All links in command files updated to new structure
    - All links in skill files updated to new structure
    - All links in workflow docs updated
    - No broken links (validate with validate-docs.sh)
  - **Notes**: Use find/replace carefully

### PF004-24: Validate Complete Restructure

- [ ] **[1h]** Run all validation scripts
  - **Priority**: P0 (Critical)
  - **Dependencies**: PF004-21, PF004-22, PF004-23
  - **Assignee**: @tech-lead
  - **Status**: Not Started
  - **Acceptance Criteria**:
    - `pnpm validate:docs` passes (no errors)
    - `pnpm validate:schemas` passes (no errors)
    - All counts match (13 agents, 18 commands, 16 skills)
    - All links validated (no 404s)
    - Code registry valid and in sync
  - **Notes**: Must pass before proceeding to Phase 5

---

## Phase 5: Automation (1 day) 🔲 Not Started

**Goal**: Set up hooks and CI

**Total Tasks**: 4
**Estimated Time**: 8 hours
**Status**: Not Started

### PF004-25: Configure Git Hooks

- [ ] **[2h]** Set up Git hooks with Husky
  - **Priority**: P1 (High)
  - **Dependencies**: PF004-4 (validation scripts)
  - **Assignee**: @product-technical
  - **Status**: Not Started
  - **Acceptance Criteria**:
    - Husky configured in project root
    - `pre-commit` hook: format markdown, validate changed docs, quick lint
    - `commit-msg` hook: validate conventional commit format
    - `post-checkout` hook: check registry consistency, warn if issues
    - `.huskyrc` config file for enable/disable hooks
    - RECOMMENDED-HOOKS.md documentation created
  - **Notes**: Keep hooks fast (< 5s), optional for slow operations

### PF004-26: Create Health Check System

- [ ] **[2h]** Build system health monitoring
  - **Priority**: P1 (High)
  - **Dependencies**: PF004-4 (validation scripts)
  - **Assignee**: @product-technical
  - **Status**: Not Started
  - **Acceptance Criteria**:
    - `health-check.sh` script created in `.claude/scripts/`
    - Checks: validation passes, registry sync, hooks configured, telemetry valid, recent learnings < 10
    - Outputs summary report with warnings/errors
    - Exit codes: 0 (all good), 1 (warnings), 2 (errors)
    - pnpm script `health-check` added
  - **Notes**: Should run at session start

### PF004-27: Set Up CI Validation

- [ ] **[2h]** Create GitHub Actions workflow
  - **Priority**: P0 (Critical)
  - **Dependencies**: PF004-4, PF004-24
  - **Assignee**: @product-technical
  - **Status**: Not Started
  - **Acceptance Criteria**:
    - `.github/workflows/validate-docs.yml` created
    - Runs on push and pull_request
    - Runs `pnpm validate:docs`
    - Runs `pnpm validate:schemas`
    - Runs `pnpm health-check`
    - Fails build if validation errors
    - Badge added to README (optional)
  - **Notes**: Prevent bad commits from merging

### PF004-28: Create Checkpoint System

- [ ] **[2h]** Implement workflow checkpoints
  - **Priority**: P2 (Medium)
  - **Dependencies**: PF004-2 (schemas)
  - **Assignee**: @product-technical
  - **Status**: Not Started
  - **Acceptance Criteria**:
    - Checkpoint schema defined
    - `.checkpoint.json` file structure documented
    - Save/restore logic for workflow state
    - Checkpoints saved in planning session folders
    - Checkpoints tracked in git (NOT gitignored) for cross-device workflow
    - Documentation on checkpoint usage
  - **Notes**: Enables resuming work across sessions and devices

---

## Phase 6: Documentation & Testing (1-2 days) 🔲 Not Started

**Goal**: Complete all docs and validate

**Total Tasks**: 6
**Estimated Time**: 14 hours
**Status**: Not Started

### PF004-29: Create Design Standards

- [ ] **[3h]** Document design system
  - **Priority**: P1 (High)
  - **Dependencies**: PF004-1
  - **Assignee**: @ux-ui-designer, @tech-writer
  - **Status**: Not Started
  - **Acceptance Criteria**:
    - `.claude/docs/standards/design-standards.md` created
    - Color palette documented (primary, secondary, accent, neutrals)
    - Typography system (headings, body, code)
    - Component patterns (buttons, forms, cards, etc.)
    - Spacing system
    - Accessibility guidelines (contrast, focus states)
  - **Notes**: Reference brand-guidelines skill

### PF004-30: Create Maintenance Docs

- [ ] **[2h]** Document system maintenance
  - **Priority**: P0 (Critical)
  - **Dependencies**: PF004-4, PF004-26
  - **Assignee**: @tech-writer
  - **Status**: Not Started
  - **Subtasks**:
    - [ ] PF004-30.1: `system-maintenance.md` - How to maintain the workflow system
    - [ ] PF004-30.2: `doc-sync.md` - Process for keeping docs in sync
  - **Acceptance Criteria**:
    - system-maintenance.md covers: adding tools, updating docs, archiving learnings
    - doc-sync.md covers: validation process, sync scripts, checklist
    - Procedures clear and actionable
    - Links to relevant scripts and commands
  - **Notes**: Critical for long-term maintainability

### PF004-31: Update App/Package CLAUDE.md Files

- [ ] **[2h]** Review and improve consistency
  - **Priority**: P2 (Medium)
  - **Dependencies**: PF004-21 (main CLAUDE.md restructured)
  - **Assignee**: @tech-writer
  - **Status**: Not Started
  - **Acceptance Criteria**:
    - All app and package CLAUDE.md files reviewed
    - Inconsistencies fixed
    - Links to main CLAUDE.md added where appropriate
    - Language consistency (English only)
    - Format consistency
  - **Notes**: apps/web, apps/admin, apps/api, and all packages/

### PF004-32: Create CHANGELOG.md

- [ ] **[2h]** Document all changes
  - **Priority**: P0 (Critical)
  - **Dependencies**: All Phase 1-5 tasks
  - **Assignee**: @tech-writer
  - **Status**: Not Started
  - **Acceptance Criteria**:
    - `.claude/docs/CHANGELOG.md` created
    - All P-004 changes documented with dates
    - Migration guide included (old → new)
    - Breaking changes highlighted
    - Benefits summary
    - "Before and After" comparison
  - **Notes**: Critical for user understanding

### PF004-33: Test Complete System

- [ ] **[3h]** Walk through all workflows
  - **Priority**: P0 (Critical)
  - **Dependencies**: All previous phases
  - **Assignee**: @qa-engineer, @tech-lead
  - **Status**: Not Started
  - **Acceptance Criteria**:
    - Level 1 workflow tested end-to-end
    - Level 2 workflow tested end-to-end
    - Level 3 workflow tested end-to-end
    - All commands tested (at least basic invocation)
    - All validation scripts tested
    - All meta-commands tested
    - No errors or broken links found
  - **Notes**: Critical - must work before user handoff

### PF004-34: User Onboarding Test

- [ ] **[2h]** Validate onboarding experience
  - **Priority**: P0 (Critical)
  - **Dependencies**: PF004-33
  - **Assignee**: @tech-writer, User
  - **Status**: Not Started
  - **Acceptance Criteria**:
    - User follows quick-start.md
    - Time to productivity < 30 minutes
    - User can find needed documentation in < 2 minutes
    - User understands workflow selection
    - Feedback collected and addressed
    - quick-start.md improved based on feedback
  - **Notes**: User involvement critical

---

## Phase 7: Finalization (0.5 day) 🔲 Not Started

**Goal**: Final polish and documentation

**Total Tasks**: 3
**Estimated Time**: 4 hours
**Status**: Not Started

### PF004-35: Final Validation Sweep

- [ ] **[2h]** Complete validation check
  - **Priority**: P0 (Critical)
  - **Dependencies**: All previous phases
  - **Assignee**: @tech-lead
  - **Status**: Not Started
  - **Acceptance Criteria**:
    - All validation scripts pass with 0 errors
    - All links working (no 404s)
    - All schemas validate
    - Registry in perfect sync
    - Counts accurate (13 agents, 18 commands, 16 skills)
    - No TODO or FIXME comments in docs
    - Health check shows all green
  - **Notes**: Final quality gate

### PF004-36: Generate Final Reports

- [ ] **[1h]** Create baseline metrics
  - **Priority**: P0 (Critical)
  - **Dependencies**: PF004-35
  - **Assignee**: @product-technical
  - **Status**: Not Started
  - **Acceptance Criteria**:
    - Telemetry baseline report generated
    - Health check report generated
    - Documentation coverage report
    - Success metrics baseline documented
    - Reports saved in planning session folder
  - **Notes**: Establishes metrics for future comparison

### PF004-37: User Handoff

- [ ] **[1h]** Demo and training
  - **Priority**: P0 (Critical)
  - **Dependencies**: PF004-35, PF004-36
  - **Assignee**: @tech-lead, User
  - **Status**: Not Started
  - **Acceptance Criteria**:
    - Demo of new system to user
    - Walk through major changes
    - Review CHANGELOG.md together
    - Answer user questions
    - Get user sign-off
    - Merge to main branch
  - **Notes**: Project completion milestone

---

## Blockers & Issues

### Active Blockers

None currently.

| Task | Blocker | Impact | Resolution | Owner |
|------|---------|--------|------------|-------|
| - | - | - | - | - |

### Resolved Blockers

None yet.

| Task | Was Blocked By | Resolution | Resolved Date |
|------|----------------|------------|---------------|
| - | - | - | - |

---

## Notes & Decisions

### Implementation Notes

**2025-10-30 - Initial Planning Complete**:

- Task breakdown follows 7-phase approach from tech-analysis.md
- Total 37 tasks (P0: 30, P1: 5, P2: 2)
- Estimated 79 hours total (~10-11 days)
- All tasks 1-3 hours max (atomic)
- Dependencies clearly mapped
- Simplified task naming: PF004-1, PF004-2.1, etc.

### Technical Decisions

**Decision 1**: Use simplified task naming `PF004-X` instead of `PF-004-T-XXX`

- **Rationale**: Shorter, clearer, easier to type in commits
- **Alternatives**: Old format `PF-004-T-001-002`, hierarchical `PF-004/1/2`
- **Date**: 2025-10-30

**Decision 2**: Delete removed agents/commands instead of archiving

- **Rationale**: Clean removal, git history preserves them if needed
- **Alternatives**: Create archive/ folder, keep with "ARCHIVED" marker
- **Date**: 2025-10-30

**Decision 3**: Checkpoint files tracked in git (NOT gitignored)

- **Rationale**: Enable cross-device workflow (work from different machines)
- **Alternatives**: Gitignore checkpoints (local-only workflow)
- **Date**: 2025-10-30

**Decision 4**: One learning file per learning (not monthly archives)

- **Rationale**: Easier to find specific learnings, more granular organization
- **Alternatives**: Monthly archive files like `2025-01.md`
- **Date**: 2025-10-30

---

## Dependencies Map

### Critical Path

```
Phase 1: Foundation
PF004-1 → PF004-2 → PF004-3, PF004-4 → PF004-5, PF004-6
         ↓
Phase 2: Consolidation
PF004-7 → PF004-8 → PF004-9 → PF004-10
PF004-11 → PF004-12 → PF004-14
PF004-15 → PF004-16
         ↓
Phase 3: Workflows
PF004-17, PF004-18 → PF004-19 → PF004-20
         ↓
Phase 4: CLAUDE.md
PF004-21, PF004-22 → PF004-23 → PF004-24
         ↓
Phase 5: Automation
PF004-25, PF004-26, PF004-27, PF004-28 (parallel)
         ↓
Phase 6: Documentation
PF004-29, PF004-30, PF004-31, PF004-32 → PF004-33 → PF004-34
         ↓
Phase 7: Finalization
PF004-35 → PF004-36 → PF004-37
```

### Parallel Work Opportunities

- **Phase 1**: PF004-5 and PF004-6 can be done in parallel with PF004-4
- **Phase 2**: Agent work (7-10), command work (11-14), skill work (15-16) can overlap
- **Phase 3**: All workflow docs can be worked on in parallel
- **Phase 5**: All automation tasks can be done in parallel
- **Phase 6**: PF004-29, 30, 31 can be done in parallel

---

## Success Criteria

### Quantitative

- [x] 37 atomic tasks identified (1-3h each)
- [ ] 0/37 tasks completed (0%)
- [ ] All validation scripts pass
- [ ] CLAUDE.md reduced to 300-400 lines (60% reduction achieved)
- [ ] 13 agents (52% reduction from 25)
- [ ] 18 commands
- [ ] 16 skills
- [ ] 0 broken links
- [ ] 0 desynchronized counts

### Qualitative

- [ ] Decision tree is clear and actionable
- [ ] quick-start.md enables < 30 min onboarding
- [ ] System health check shows all green
- [ ] User satisfied with new structure
- [ ] All docs in English
- [ ] Maintainability improved

---

## Time Tracking

### Estimated vs Actual by Phase

| Phase | Tasks | Estimated | Actual | Variance | Status |
|-------|-------|-----------|--------|----------|--------|
| Phase 1: Foundation | 6 | 16h | TBD | TBD | Not Started |
| Phase 2: Consolidation | 10 | 24h | TBD | TBD | Not Started |
| Phase 3: Workflows | 4 | 9h | TBD | TBD | Not Started |
| Phase 4: CLAUDE.md | 4 | 8h | TBD | TBD | Not Started |
| Phase 5: Automation | 4 | 8h | TBD | TBD | Not Started |
| Phase 6: Documentation | 6 | 14h | TBD | TBD | Not Started |
| Phase 7: Finalization | 3 | 4h | TBD | TBD | Not Started |
| **Total** | **37** | **79h** | **TBD** | **TBD** | **0% Complete** |

### Daily Target

- **Working days available**: 14 days
- **Hours per day**: ~5-6 hours
- **Tasks per day target**: ~3 tasks

---

## Next Steps

1. ✅ TODOs.md created and reviewed
2. [ ] User reviews and approves task breakdown
3. [ ] Sync planning to GitHub Issues (optional)
4. [ ] Begin Phase 1: Task PF004-1 (Create Directory Structure)
5. [ ] Track daily progress in Daily Progress Log section

---

**Last Updated**: 2025-10-30
**Status**: Planning Complete - Awaiting User Approval
**Next Review**: Upon user approval
**Next Action**: User reviews TODOs.md, then begin PF004-1
