# System Maintenance Guide

## Overview

This guide explains how to maintain the Hospeda workflow system, including adding new tools, updating documentation, archiving learnings, and performing routine maintenance tasks.

**Target Audience**: Developers, Tech Leads, DevOps Engineers

**Maintenance Frequency:**

- **Daily**: Check health status
- **Weekly**: Archive old learnings, update metrics
- **Monthly**: Review and optimize system
- **Quarterly**: Major audits and improvements

---

## Table of Contents

1. [Daily Maintenance](#daily-maintenance)
2. [Adding New Tools](#adding-new-tools)
3. [Updating Documentation](#updating-documentation)
4. [Archiving Learnings](#archiving-learnings)
5. [Managing Planning Sessions](#managing-planning-sessions)
6. [System Health Monitoring](#system-health-monitoring)
7. [Troubleshooting](#troubleshooting)

---

## Daily Maintenance

### Morning Checklist

```bash
# 1. Pull latest changes
git pull origin main

# 2. Run health check
pnpm health-check

# 3. Check active planning sessions
find .claude/sessions/planning -name ".checkpoint.json" -exec jq '{session: input_filename, task: .currentTask, progress: .tasksCompleted, total: .totalSteps}' {} \;

# 4. Review recent commits
git log --oneline -10
```

**Expected Output:**

```
✅ Health check PASSED - System is healthy!
📋 Active sessions: 1
   P-004-workflow-optimization: PF004-29 (29/37 - 78%)
```

### Quick Validation

```bash
# Validate documentation structure
pnpm claude:validate:docs

# Validate schemas
pnpm claude:validate:schemas
```

---

## Adding New Tools

### 1. Adding a New Agent

**Location**: `.claude/agents/{category}/{agent-name}.md`

**Steps:**

1. **Create agent file:**

   ```bash
   # Choose category: engineering/, specialized/, management/
   touch .claude/agents/specialized/new-agent.md
   ```

2. **Use template:**

   ```markdown
   # Agent Name

   ## Role
   Brief description

   ## Responsibilities
   - Responsibility 1
   - Responsibility 2

   ## Skills Required
   - Skill 1
   - Skill 2

   ## When to Invoke
   Specific scenarios

   ## Output Format
   What to deliver

   ## Examples
   Usage examples
   ```

3. **Update README:**

   ```bash
   # Edit .claude/agents/README.md
   # Add to appropriate category
   # Update count (13 → 14)
   ```

4. **Update CLAUDE.md:**

   ```bash
   # Edit CLAUDE.md
   # Add to Subagents section
   # Update count in Quick Reference
   ```

5. **Run validation:**

   ```bash
   pnpm health-check
   # Should show: Agents: 14 (expected: 14) ✅
   ```

6. **Commit:**

   ```bash
   git add .claude/agents/specialized/new-agent.md .claude/agents/README.md CLAUDE.md
   git commit -m "feat(agents): add new-agent specialist"
   ```

### 2. Adding a New Command

**Location**: `.claude/commands/{category}/{command-name}.md`

**Steps:**

1. **Create command file:**

   ```bash
   # Choose category: audit/, formatting/, git/, meta/
   touch .claude/commands/audit/new-command.md
   ```

2. **Define command:**

   ```markdown
   # Command: /new-command

   ## Description
   What the command does

   ## Usage
   /new-command [arguments]

   ## Parameters
   - param1: description
   - param2: description

   ## Examples
   /new-command example

   ## Output
   Expected result
   ```

3. **Update README:**

   ```bash
   # Edit .claude/commands/README.md
   # Add to category
   # Update count (18 → 19)
   ```

4. **Test command:**

   ```bash
   # In Claude Code
   /new-command
   ```

5. **Commit:**

   ```bash
   git add .claude/commands/audit/new-command.md .claude/commands/README.md
   git commit -m "feat(commands): add /new-command for X"
   ```

### 3. Adding a New Skill

**Location**: `.claude/skills/{category}/{skill-name}.md`

**Steps:**

1. **Create skill file:**

   ```bash
   # Choose category: brand/, git/, patterns/, tech/, testing/, utils/
   touch .claude/skills/tech/new-skill.md
   ```

2. **Define skill:**

   ```markdown
   # Skill Name

   ## Purpose
   What this skill does

   ## Capabilities
   - Capability 1
   - Capability 2

   ## Usage
   How to use this skill

   ## Examples
   Practical examples
   ```

3. **Update README:**

   ```bash
   # Edit .claude/skills/README.md
   # Add to category
   # Update count (16 → 17)
   ```

4. **Commit:**

   ```bash
   git add .claude/skills/tech/new-skill.md .claude/skills/README.md
   git commit -m "feat(skills): add new-skill capability"
   ```

---

## Updating Documentation

### Main Documentation Files

| File | When to Update | How Often |
|------|----------------|-----------|
| `CLAUDE.md` | Major system changes | As needed |
| `.claude/docs/INDEX.md` | New sections added | Monthly |
| `.claude/docs/quick-start.md` | Onboarding changes | Quarterly |
| `README.md` | Project changes | As needed |

### Documentation Update Process

1. **Make changes:**

   ```bash
   # Edit documentation
   vim .claude/docs/workflows/new-workflow.md
   ```

2. **Format markdown:**

   ```bash
   # Auto-format
   pnpm format:md:claude

   # Check linting
   pnpm lint:md .claude/**/*.md
   ```

3. **Validate links:**

   ```bash
   # Run health check (includes link validation)
   pnpm health-check
   ```

4. **Update INDEX:**

   ```bash
   # If new file, add to INDEX.md
   vim .claude/docs/INDEX.md
   ```

5. **Commit with proper message:**

   ```bash
   git add .
   git commit -m "docs: update workflow documentation"
   ```

---

## Archiving Learnings

### When to Archive

Archive a learning from CLAUDE.md "Recent Learnings" section when:

- More than 10 learnings exist
- Learning is > 30 days old
- Learning is no longer frequently referenced

### Archive Process

1. **Create learning file:**

   ```bash
   # Create file in learnings directory
   touch .claude/docs/learnings/new-learning.md
   ```

2. **Move content:**

   ```markdown
   # Learning Title

   **Date:** YYYY-MM-DD
   **Category:** Category / Subcategory

   ## Problem
   What went wrong

   ## Solution
   How it was fixed

   ## Impact
   - Severity: High/Medium/Low
   - Frequency: Common/Occasional/Rare
   - Scope: All developers / Specific role
   - Prevention: How to avoid

   ## Related
   - Links to docs
   - Related learnings
   ```

3. **Update CLAUDE.md:**

   ```markdown
   ## 9. Archived Learnings

   ### Category
   - [New Learning](.claude/docs/learnings/new-learning.md) - Brief description
   ```

4. **Update learnings/README.md:**

   ```markdown
   ### Category (X)

   **[new-learning.md]** - Brief description
   ```

5. **Commit:**

   ```bash
   git add .claude/docs/learnings/new-learning.md CLAUDE.md .claude/docs/learnings/README.md
   git commit -m "docs(learnings): archive new-learning to structured file"
   ```

---

## Managing Planning Sessions

### Active Session Maintenance

1. **Update checkpoints after each task:**

   ```json
   {
     "currentTask": "PF004-30",
     "previousTaskCompleted": "PF004-29",
     "tasksCompleted": 30,
     "lastUpdated": "2025-10-31T17:00:00.000Z"
   }
   ```

2. **Commit checkpoints:**

   ```bash
   git add .claude/sessions/planning/P-004/.checkpoint.json
   git commit -m "chore(planning): update checkpoint to PF004-30"
   ```

### Closing Completed Sessions

1. **Mark session complete:**

   ```bash
   # Update checkpoint
   jq '.currentPhase = 4 | .currentTask = "COMPLETE"' .checkpoint.json > temp.json
   mv temp.json .checkpoint.json
   ```

2. **Create summary:**

   ```bash
   # Create SUMMARY.md in session folder
   touch .claude/sessions/planning/P-004/SUMMARY.md
   ```

3. **Archive if old:**

   ```bash
   # Move to archive if > 6 months old
   mkdir -p .claude/sessions/archive/2025
   mv .claude/sessions/planning/P-001 .claude/sessions/archive/2025/
   ```

### Sync to GitHub Issues

```bash
# Sync planning session to GitHub
pnpm planning:sync .claude/sessions/planning/P-004-workflow-optimization/
```

---

## System Health Monitoring

### Health Check Command

```bash
# Run comprehensive health check
pnpm health-check
```

**Checks performed:**

1. File counts (agents, commands, skills, learnings, workflows, diagrams)
2. Code registry validation
3. Git hooks configuration
4. Core documentation files
5. Recent learnings count
6. Validation scripts
7. Active planning sessions

### Monitoring Metrics

Track these metrics monthly:

```bash
# Agent count
find .claude/agents -name "*.md" ! -name "README.md" | wc -l

# Command count
find .claude/commands -name "*.md" ! -name "README.md" | wc -l

# Skill count
find .claude/skills -name "*.md" ! -name "README.md" | wc -l

# Total documentation size
du -sh .claude/docs

# Active sessions
find .claude/sessions/planning -name ".checkpoint.json" | wc -l
```

### CI/CD Monitoring

Check GitHub Actions status:

```bash
# Visit
https://github.com/qazuor/hospeda/actions
```

Expected: ✅ Documentation Validation passing

---

## Troubleshooting

### Health Check Failures

**Problem**: File count mismatch

**Solution:**

```bash
# Find actual count
find .claude/agents -name "*.md" ! -name "README.md"

# Update expected count in health-check.sh if correct
vim .claude/scripts/health-check.sh
```

**Problem**: Broken links detected

**Solution:**

```bash
# Find broken links
grep -r "](\.\./" .claude/docs/ | grep -v ".git"

# Fix paths in affected files
vim [file-with-broken-link]
```

### Git Hook Issues

**Problem**: Pre-commit hook fails

**Solution:**

```bash
# Skip hook temporarily
git commit --no-verify -m "message"

# Fix hook
vim .husky/pre-commit
chmod +x .husky/pre-commit
```

### Markdown Formatting Errors

**Problem**: markdownlint failures

**Solution:**

```bash
# Auto-fix
pnpm format:md:claude

# Check specific file
pnpm markdownlint-cli2 .claude/docs/INDEX.md --fix
```

---

## Best Practices

### DO ✅

- **Update checkpoints** after every task completion
- **Run health check** before committing major changes
- **Archive learnings** when > 10 in Recent Learnings
- **Validate links** after adding new documentation
- **Test commands** before committing
- **Keep README files updated** when adding new tools
- **Use conventional commits** for all documentation changes
- **Sync planning to GitHub** for team visibility

### DON'T ❌

- **Skip validation** before committing docs
- **Leave broken links** in documentation
- **Forget to update counts** in README files
- **Commit without formatting** markdown files
- **Archive all learnings** - keep recent ones visible
- **Create orphaned files** - always link in INDEX.md
- **Skip CI checks** - they catch real issues
- **Manually edit code registry** - use sync script

---

## Maintenance Calendar

### Daily

- [ ] Run `pnpm health-check`
- [ ] Check active planning sessions
- [ ] Review CI/CD status

### Weekly

- [ ] Archive old learnings (if > 10)
- [ ] Review and clean up TODOs
- [ ] Update planning checkpoints
- [ ] Check documentation completeness

### Monthly

- [ ] Audit all documentation links
- [ ] Review and optimize workflows
- [ ] Update metrics in dashboards
- [ ] Archive completed planning sessions (> 1 month old)

### Quarterly

- [ ] Major system audit
- [ ] Review and update all READMEs
- [ ] Optimize scripts and tools
- [ ] Conduct team retrospective on workflow effectiveness

---

## Related Documentation

- **Health Check**: `.claude/scripts/health-check.sh`
- **Doc Sync**: `.claude/docs/doc-sync.md`
- **Git Hooks**: `.claude/docs/RECOMMENDED-HOOKS.md`
- **Workflows**: `.claude/docs/workflows/`

---

**Last updated**: 2025-10-31
**Version**: 1.0.0
**Maintained by**: DevOps & Tech Lead team
