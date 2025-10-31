# Learnings Archive

Documented learnings and best practices discovered during Hospeda development.

---

## Purpose

This directory contains individual learning files extracted from CLAUDE.md's "Recent Learnings" section. Each learning is documented with:

- **Title**: Clear, descriptive name
- **Date**: When the learning was discovered/documented
- **Category**: Classification (e.g., Testing, Architecture, DevOps)
- **Problem**: What issue prompted this learning
- **Solution**: How to handle/solve the problem
- **Impact**: Severity, frequency, scope, prevention
- **Related**: Links to documentation and related learnings

---

## Structure

Each learning is a standalone markdown file with kebab-case naming:

```
learnings/
├── README.md (this file)
├── shell-compatibility-fish.md
├── monorepo-command-execution.md
├── test-organization-structure.md
├── markdown-formatting-standards.md
├── planning-linear-sync-workflow.md
├── common-architectural-patterns.md
├── common-mistakes-to-avoid.md
└── optimization-tips.md
```

---

## Available Learnings

### Shell & Terminal (1)

**[shell-compatibility-fish.md](shell-compatibility-fish.md)**
- **Category:** Shell / Terminal / DevOps
- **Problem:** `for` loops hang Fish shell
- **Solution:** Use `find -exec` or `xargs` alternatives
- **Impact:** High severity, blocks workflow
- **Date:** 2024-10-28

### Monorepo & Build (1)

**[monorepo-command-execution.md](monorepo-command-execution.md)**
- **Category:** Monorepo / PNPM / Development
- **Problem:** Incorrect command execution in monorepo packages
- **Solution:** Always use `cd packageName && pnpm run <command>`
- **Impact:** High severity, causes build failures
- **Date:** 2024-10-28

### Testing (1)

**[test-organization-structure.md](test-organization-structure.md)**
- **Category:** Testing / Project Structure
- **Problem:** Tests in wrong locations cause import/build issues
- **Solution:** Use `test/` folder, mirror `src/` structure
- **Impact:** Medium severity, affects reliability
- **Date:** 2024-10-28

### Documentation (1)

**[markdown-formatting-standards.md](markdown-formatting-standards.md)**
- **Category:** Documentation / Formatting
- **Problem:** Inconsistent markdown fails CI/CD checks
- **Solution:** Run `pnpm format:md` before commits
- **Impact:** Medium severity, blocks CI/CD
- **Date:** 2024-10-28

### Planning & Workflow (1)

**[planning-linear-sync-workflow.md](planning-linear-sync-workflow.md)**
- **Category:** Planning / GitHub / Linear / Workflow
- **Problem:** Manual planning sync loses context
- **Solution:** Sync after approval, commit before completion
- **Impact:** High severity, affects tracking
- **Date:** 2024-10-28

### Architecture & Patterns (2)

**[common-architectural-patterns.md](common-architectural-patterns.md)**
- **Category:** Architecture / Best Practices
- **Problem:** Inconsistent patterns across codebase
- **Solution:** Always use factories, base classes, RO-RO pattern
- **Impact:** High severity, affects maintainability
- **Date:** 2024-10-28

**[common-mistakes-to-avoid.md](common-mistakes-to-avoid.md)**
- **Category:** Best Practices / Code Quality
- **Problem:** Repeated mistakes slow development
- **Solution:** Never use `any`, default exports, skip tests, etc.
- **Impact:** High severity, compounds over time
- **Date:** 2024-10-28

### Optimization (1)

**[optimization-tips.md](optimization-tips.md)**
- **Category:** Performance / Best Practices
- **Problem:** Inefficient development practices
- **Solution:** Use Context7, dependency mapper, batch changes
- **Impact:** Medium severity, improves efficiency
- **Date:** 2024-10-28

---

## Usage

### For Claude

**Latest 10 learnings stay inline in CLAUDE.md** for quick reference.

When adding new learnings:
1. Add to CLAUDE.md "Recent Learnings" section (inline)
2. Create individual file in `.claude/docs/learnings/`
3. If > 10 learnings in CLAUDE.md, move oldest to "Archived Learnings" section (keep file)

**Finding learnings:**
- Check CLAUDE.md for latest 10 (quick reference)
- Check this directory for full archive (detailed information)

### For Developers

**When encountering errors or discovering patterns:**
1. Document immediately in CLAUDE.md "Recent Learnings"
2. Create detailed file in this directory
3. Include problem, solution, impact, related links

**When looking for solutions:**
1. Check CLAUDE.md first (latest 10 learnings)
2. Search this directory by category
3. Review related learnings for context

---

## Categories

Learnings are organized into these categories:

- **Shell / Terminal** - Shell compatibility, command usage
- **Monorepo / Build** - Build system, package management
- **Testing** - Test organization, TDD practices
- **Documentation** - Docs formatting, standards
- **Planning / Workflow** - Project planning, task tracking
- **Architecture / Patterns** - Code architecture, design patterns
- **Best Practices** - General development practices
- **Performance / Optimization** - Development efficiency

---

## Adding New Learnings

### Template

```markdown
# Learning Title

**Date:** YYYY-MM-DD

**Category:** Category / Subcategory

## Problem

[Describe what issue prompted this learning]

## Solution

[Describe how to handle/solve the problem with examples]

## Impact

- **Severity:** High/Medium/Low
- **Frequency:** How often this occurs
- **Scope:** Who is affected
- **Prevention:** How to avoid in future

## Related

- **Documentation:** [Link to relevant docs]
- **Related Learnings:** [Link to related learning files]

---

*Last updated: YYYY-MM-DD*
```

### Naming Convention

Use kebab-case with descriptive names:

- ✅ `shell-compatibility-fish.md`
- ✅ `monorepo-command-execution.md`
- ✅ `test-organization-structure.md`
- ❌ `learning-1.md`
- ❌ `2024-10-shell.md`

---

## Maintenance

### When to Archive

When CLAUDE.md "Recent Learnings" exceeds 10 items:

1. Move oldest learning from inline to "Archived Learnings" section
2. Add link to the individual file in "Archived Learnings"
3. Keep the individual file in this directory (don't delete)

### When to Update

Update learning files when:

- New information discovered about the problem
- Better solutions found
- Impact changes (severity/frequency)
- Related learnings added

**Always update the "Last updated" date at bottom of file.**

---

## Statistics

- **Total Learnings:** 8
- **Categories:** 8
- **Latest Addition:** 2024-10-28
- **Most Critical:** Shell Compatibility, Monorepo Execution, Planning Sync (High severity)

---

*Last updated: 2024-10-31*
