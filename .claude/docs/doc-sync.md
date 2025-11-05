# Documentation Sync Process

## Overview

This guide explains how to keep documentation synchronized across the system, validate consistency, and maintain quality standards. It covers the validation process, sync scripts, and a comprehensive checklist for documentation updates.

**Purpose**: Ensure all documentation is accurate, up-to-date, and properly cross-referenced.

---

## Table of Contents

1. [Documentation Structure](#documentation-structure)
2. [Validation Process](#validation-process)
3. [Sync Scripts](#sync-scripts)
4. [Update Checklist](#update-checklist)
5. [Common Sync Issues](#common-sync-issues)
6. [Automation](#automation)

---

## Documentation Structure

### Documentation Hierarchy

```text
.claude/
├── agents/           # 14 agent definitions
│   ├── engineering/
│   ├── specialized/
│   ├── management/
│   └── README.md
├── commands/         # 16 command definitions
│   ├── audit/
│   ├── formatting/
│   ├── git/
│   ├── meta/
│   └── README.md
├── skills/           # 16 skill definitions
│   ├── brand/
│   ├── git/
│   ├── patterns/
│   ├── tech/
│   ├── testing/
│   ├── utils/
│   └── README.md
├── docs/             # Core documentation
│   ├── INDEX.md     # Master index
│   ├── quick-start.md
│   ├── glossary.md
│   ├── RECOMMENDED-HOOKS.md
│   ├── CHECKPOINT-SYSTEM.md
│   ├── system-maintenance.md
│   ├── doc-sync.md  # This file
│   ├── learnings/   # 8 learning documents
│   ├── workflows/   # 9 workflow documents
│   ├── diagrams/    # 4 mermaid diagrams
│   └── standards/   # Standards & guidelines
├── schemas/         # JSON schemas (9 files)
└── sessions/        # Planning sessions
    └── planning/
```text

### Master Documents

Files that must stay synchronized:

| File | Sync With | Update Frequency |
|------|-----------|------------------|
| `CLAUDE.md` | All sections | On major changes |
| `.claude/docs/INDEX.md` | All documentation | When new docs added |
| `README.md` | Project changes | As needed |
| `.claude/agents/README.md` | Agent files | When agents change |
| `.claude/commands/README.md` | Command files | When commands change |
| `.claude/skills/README.md` | Skill files | When skills change |
| `.claude/docs/learnings/README.md` | Learning files | When learnings added |
| `.claude/docs/workflows/README.md` | Workflow files | When workflows change |

---

## Validation Process

### 1. File Count Validation

Verify all file counts match expected values:

```bash
# Run health check
pnpm health-check
```text

**Expected counts:**

- Agents: 14
- Commands: 16
- Skills: 16
- Learnings: 8
- Workflows: 9
- Diagrams: 4

**If counts don't match:**

```bash
# Find actual counts
echo "Agents: $(find .claude/agents -name "*.md" ! -name "README.md" | wc -l)"
echo "Commands: $(find .claude/commands -name "*.md" ! -name "README.md" | wc -l)"
echo "Skills: $(find .claude/skills -name "*.md" ! -name "README.md" | wc -l)"
echo "Learnings: $(find .claude/docs/learnings -name "*.md" ! -name "README.md" | wc -l)"
echo "Workflows: $(find .claude/docs/workflows -name "*.md" ! -name "README.md" | wc -l)"
echo "Diagrams: $(find .claude/docs/diagrams -name "*.mmd" | wc -l)"

# Update health-check.sh with correct counts
vim .claude/scripts/health-check.sh
```text

### 2. Link Validation

Check for broken links across all documentation:

```bash
# Method 1: Via health check
pnpm health-check

# Method 2: Manual grep
for file in $(find .claude -name "*.md" -type f); do
  echo "Checking: $file"
  grep -oP '\]\(\K[^)]+' "$file" 2>/dev/null | while read -r link; do
    # Skip URLs and anchors
    if ! echo "$link" | grep -qE '^(https?:|#)'; then
      # Convert relative path to absolute
      link_dir=$(dirname "$file")
      link_path="$link_dir/$link"
      if [ ! -f "$link_path" ] && [ ! -d "$link_path" ]; then
        echo "  ⚠️  Broken: $link"
      fi
    fi
  done
done
```text

### 3. Cross-Reference Validation

Verify all cross-references are correct:

```bash
# Check CLAUDE.md references
grep -n "\[.*\](.claude/" CLAUDE.md

# Check INDEX.md references
grep -n "\[.*\](./" .claude/docs/INDEX.md

# Check workflow references
grep -rn "\[.*\](./" .claude/docs/workflows/
```text

### 4. Schema Validation

Validate JSON files against schemas:

```bash
# Validate code registry
jq empty .claude/sessions/planning/.code-registry.json

# Validate checkpoints
find .claude/sessions/planning -name ".checkpoint.json" -exec jq empty {} \;

# Run schema validation script (if exists)
pnpm claude:validate:schemas
```text

---

## Sync Scripts

### Available Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| **Health Check** | `pnpm health-check` | Validate entire system |
| **Format Markdown** | `pnpm format:md:claude` | Auto-format .claude/ docs |
| **Lint Markdown** | `pnpm lint:md` | Check markdown quality |
| **Validate Docs** | `pnpm claude:validate:docs` | Run doc validation |
| **Validate Schemas** | `pnpm claude:validate:schemas` | Validate JSON schemas |
| **Planning Sync** | `pnpm planning:sync <path>` | Sync planning to GitHub |

### Manual Sync Process

When adding/modifying documentation:

```bash
# 1. Make changes
vim .claude/docs/new-doc.md

# 2. Format markdown
pnpm format:md:claude

# 3. Validate changes
pnpm health-check

# 4. Update INDEX.md
vim .claude/docs/INDEX.md
# Add: - [New Doc](./new-doc.md) - Description

# 5. Update relevant README
# If it's a learning:
vim .claude/docs/learnings/README.md

# 6. Commit with proper message
git add .
git commit -m "docs: add new-doc documentation"

# 7. Push and verify CI
git push origin main
# Check: https://github.com/qazuor/hospeda/actions
```text

---

## Update Checklist

### When Adding a New Agent

- [ ] Create agent file in `.claude/agents/{category}/`
- [ ] Update `.claude/agents/README.md`
  - [ ] Add to category list
  - [ ] Update count (14 → 15)
- [ ] Update `CLAUDE.md`
  - [ ] Add to Subagents section
  - [ ] Update Quick Reference count
- [ ] Update `.claude/docs/INDEX.md`
  - [ ] Add to Agents section
- [ ] Run `pnpm health-check` (verify count)
- [ ] Commit: `feat(agents): add {name} agent`
- [ ] Push and verify CI

### When Adding a New Command

- [ ] Create command file in `.claude/commands/{category}/`
- [ ] Update `.claude/commands/README.md`
  - [ ] Add to category list
  - [ ] Update count (16 → 17)
- [ ] Update `CLAUDE.md`
  - [ ] Add to Commands section
  - [ ] Update Quick Reference count
- [ ] Update `.claude/docs/INDEX.md`
  - [ ] Add to Commands section
- [ ] Test command in Claude Code
- [ ] Run `pnpm health-check`
- [ ] Commit: `feat(commands): add /{name} command`
- [ ] Push and verify CI

### When Adding a New Skill

- [ ] Create skill file in `.claude/skills/{category}/`
- [ ] Update `.claude/skills/README.md`
  - [ ] Add to category list
  - [ ] Update count (16 → 17)
- [ ] Update `CLAUDE.md`
  - [ ] Add to Skills section (if major)
  - [ ] Update Quick Reference count
- [ ] Update `.claude/docs/INDEX.md`
  - [ ] Add to Skills section
- [ ] Run `pnpm health-check`
- [ ] Commit: `feat(skills): add {name} skill`
- [ ] Push and verify CI

### When Adding a New Learning

- [ ] Create learning file in `.claude/docs/learnings/`
  - [ ] Use proper template (Date, Category, Problem, Solution, Impact, Related)
- [ ] Update `.claude/docs/learnings/README.md`
  - [ ] Add to appropriate category
  - [ ] Update category count
- [ ] Update `CLAUDE.md`
  - [ ] Add to "Archived Learnings" section
- [ ] Update `.claude/docs/INDEX.md`
  - [ ] Verify Learnings section is correct
- [ ] Run `pnpm health-check`
- [ ] Commit: `docs(learnings): add {name} learning`
- [ ] Push and verify CI

### When Adding a New Workflow

- [ ] Create workflow file in `.claude/docs/workflows/`
- [ ] Update `.claude/docs/workflows/README.md`
  - [ ] Add to workflow list
  - [ ] Update count (9 → 10)
- [ ] Update `.claude/docs/INDEX.md`
  - [ ] Add to Workflows section
- [ ] Create/update related diagram (if needed)
- [ ] Update `CLAUDE.md` workflow references
- [ ] Run `pnpm health-check`
- [ ] Commit: `docs(workflows): add {name} workflow`
- [ ] Push and verify CI

### When Updating Core Documents

**CLAUDE.md:**

- [ ] Update relevant sections
- [ ] Verify all links work
- [ ] Keep within recommended size (≤ 600 lines)
- [ ] Update "Last updated" date
- [ ] Run `pnpm format:md`
- [ ] Commit: `docs: update CLAUDE.md - {what changed}`

**INDEX.md:**

- [ ] Add new sections as needed
- [ ] Verify all links point to correct locations
- [ ] Keep structure organized
- [ ] Update counts if changed
- [ ] Run `pnpm health-check`
- [ ] Commit: `docs: update documentation index`

---

## Common Sync Issues

### Issue 1: File Count Mismatch

**Symptom**: Health check shows incorrect counts

**Causes:**

- Added file but forgot to update README
- Deleted file but count not updated
- Duplicate files exist

**Fix:**

```bash
# Find actual count
find .claude/agents -name "*.md" ! -name "README.md" | wc -l

# Update README count
vim .claude/agents/README.md

# Update health-check.sh expected count
vim .claude/scripts/health-check.sh
```text

### Issue 2: Broken Links

**Symptom**: 404s or link validation errors

**Causes:**

- File moved but links not updated
- Incorrect relative path
- File renamed

**Fix:**

```bash
# Find file
find .claude -name "target-file.md"

# Update all references
grep -rl "broken-link.md" .claude/ | xargs sed -i 's|broken-link.md|correct-link.md|g'

# Validate
pnpm health-check
```text

### Issue 3: Markdown Formatting Errors

**Symptom**: Lint errors in CI

**Causes:**

- Missing blank lines
- Incorrect list indentation
- Missing language in code blocks

**Fix:**

```bash
# Auto-fix
pnpm format:md:claude

# Manual check specific file
pnpm markdownlint-cli2 file.md --fix
```text

### Issue 4: Out-of-Sync README

**Symptom**: README lists wrong count or missing items

**Causes:**

- Forgot to update README when adding file
- Manual edit error

**Fix:**

```bash
# Regenerate list
for file in .claude/agents/*/*.md; do
  echo "- [$(basename $file .md)]($(realpath --relative-to=.claude/agents $file))"
done

# Update README manually
vim .claude/agents/README.md
```text

---

## Automation

### Git Hooks

Documentation sync is partially automated via Git hooks:

**Pre-commit hook** (`.husky/pre-commit`):

- Auto-formats markdown files
- Validates .claude documentation
- Checks for broken links (warning)

**Post-checkout hook** (`.husky/post-checkout`):

- Validates code registry
- Checks for stale registry (> 7 days)

### CI/CD Pipeline

GitHub Actions validates documentation on push:

**Workflow**: `.github/workflows/validate-docs.yml`

**Checks:**

1. Documentation structure
2. JSON schemas
3. System health
4. Markdown linting
5. Broken links
6. File counts

**Badge**: [![Documentation Validation](https://github.com/qazuor/hospeda/actions/workflows/validate-docs.yml/badge.svg)](https://github.com/qazuor/hospeda/actions/workflows/validate-docs.yml)

### Scheduled Tasks

**Future automation** (not yet implemented):

- Weekly: Auto-archive learnings > 30 days
- Monthly: Generate documentation metrics
- Quarterly: Suggest outdated documentation for review

---

## Best Practices

### DO ✅

- **Always update README** when adding files
- **Run health check** before committing
- **Format markdown** before committing
- **Validate links** after moving files
- **Use conventional commits** for doc changes
- **Keep counts updated** in all locations
- **Test commands** before documenting
- **Cross-reference** related documents

### DON'T ❌

- **Skip validation** before pushing
- **Leave broken links** unresolved
- **Forget to update INDEX.md** for new docs
- **Commit without formatting** markdown
- **Use absolute paths** (use relative)
- **Duplicate information** across files (link instead)
- **Ignore CI failures** on documentation
- **Manually edit counts** without verifying actual number

---

## Quick Reference

### Common Commands

```bash
# Full validation
pnpm health-check

# Format all .claude markdown
pnpm format:md:claude

# Lint markdown
pnpm lint:md .claude/**/*.md

# Validate schemas
pnpm claude:validate:schemas

# Count files
find .claude/agents -name "*.md" ! -name "README.md" | wc -l

# Find broken links
grep -r "](./" .claude/docs/ | grep -v "http"

# Check file size
du -sh .claude/docs/*.md
```text

### File Locations

```text
Documentation sync checklist: .claude/docs/doc-sync.md (this file)
System maintenance guide: .claude/docs/system-maintenance.md
Health check script: .claude/scripts/health-check.sh
Validation workflow: .github/workflows/validate-docs.yml
Pre-commit hook: .husky/pre-commit
```text

---

## Related Documentation

- **System Maintenance**: `.claude/docs/system-maintenance.md`
- **Health Check System**: `.claude/scripts/health-check.sh`
- **Git Hooks**: `.claude/docs/RECOMMENDED-HOOKS.md`
- **Documentation Index**: `.claude/docs/INDEX.md`

---

**Last updated**: 2025-10-31
**Version**: 1.0.0
**Maintained by**: Documentation team
