# Migration Checklist: PR-Based Workflow

**Session:** P-006-github-actions-ci-cd
**Total Files:** 62
**Estimated Effort:** 58 hours
**Status:** Not Started

---

## Priority Matrix

| Priority | Files | Hours | Timeline | Description |
|----------|-------|-------|----------|-------------|
| **P0 Blocker** | 11 | 16h | Week 0 | MUST complete before CI/CD |
| **P1 High** | 22 | 24h | Week 1-2 | Core workflow files |
| **P2 Medium** | 18 | 13h | Week 3-4 | Supporting files |
| **P3 Low** | 11 | 5h | Ongoing | Optional polish |
| **TOTAL** | **62** | **58h** | 4-5 weeks | |

---

## P0 - Blocker Files (11 files, 16 hours)

**CRITICAL:** Complete before enabling branch protection

### Git Enforcement (1.5h)

- [ ] `.husky/pre-commit` - Block commits to main (0.5h)
- [ ] GitHub Settings - Branch protection rules (0.25h)
- [ ] `.claude/scripts/start-development.sh` - **NEW** Automated setup (4h)
- [ ] `.claude/scripts/archive-planning.sh` - **NEW** Planning archival (2h)

### Core Documentation (3h)

- [ ] `CLAUDE.md` - Add PR workflow policy (1h)
- [ ] `.claude/agents/engineering/tech-lead.md` - PR workflow instructions (2h)

### Core Commands (5h)

- [ ] `.claude/commands/git/commit.md` - Add PR creation (2h)
- [ ] `.claude/skills/git/git-commit-helper.md` - PR workflow (2h)
- [ ] `.claude/commands/quality-check.md` - Add PR preparation phase (1h)

### Core Workflows (6.5h)

- [ ] `.claude/docs/workflows/atomic-task-protocol.md` - Worktree setup (2h)
- [ ] `.claude/docs/workflows/phase-2-implementation.md` - Git workflow (1h)
- [ ] `.claude/docs/workflows/phase-4-finalization.md` - PR creation (2h)
- [ ] `.claude/docs/workflows/task-completion-protocol.md` - Push/PR (1h)

---

## P1 - High Priority (22 files, 24 hours)

**Complete Week 1-2 after P0**

### Scripts (3h)

- [ ] `.claude/scripts/health-check.sh` - Git root detection (1h)
- [ ] `scripts/planning-sync.ts` - Worktree compatibility (1h)
- [ ] `scripts/planning-complete-task.ts` - Worktree compatibility (1h)

### Engineering Agents (7h)

- [ ] `.claude/agents/engineering/hono-engineer.md` (1h)
- [ ] `.claude/agents/engineering/db-drizzle-engineer.md` (1h)
- [ ] `.claude/agents/engineering/astro-engineer.md` (1h)
- [ ] `.claude/agents/engineering/tanstack-start-engineer.md` (1h)
- [ ] `.claude/agents/engineering/react-senior-dev.md` (1h)
- [ ] `.claude/agents/engineering/node-typescript-engineer.md` (1h)
- [ ] `.claude/agents/product/product-technical.md` (1h)

### Quality Agents (1h)

- [ ] `.claude/agents/quality/qa-engineer.md` (1h)

### Commands (4h)

- [ ] `.claude/commands/start-feature-plan.md` (1h)
- [ ] `.claude/commands/start-refactor-plan.md` (1h)
- [ ] `.claude/commands/sync-planning.md` (1h)
- [ ] `.claude/commands/code-check.md` (1h)

### Workflows (3h)

- [ ] `.claude/docs/workflows/phase-1-planning.md` (1h)
- [ ] `.claude/docs/workflows/phase-3-validation.md` (1h)
- [ ] `.claude/docs/workflows/quick-fix-protocol.md` (1h)

### Standards (2h)

- [ ] `.claude/docs/standards/code-standards.md` (1h)
- [ ] `package.json` - Add worktree aliases (1h)

### Git Config (1h)

- [ ] `.git/config` - Branch merge options (0.5h)
- [ ] `.husky/pre-push` - **NEW** Pre-push checks (0.5h)

### Documentation (3h)

- [ ] `README.md` (root) - Update development workflow (1h)
- [ ] `CONTRIBUTING.md` - **NEW** PR workflow guide (1h)
- [ ] `.claude/docs/guides/pr-workflow.md` - Update with unified workflow (1h)

---

## P2 - Medium Priority (18 files, 13 hours)

**Complete Week 3-4**

### Scripts (2h)

- [ ] `.claude/scripts/worktree-cleanup.sh` - Main branch check (0.5h)
- [ ] `scripts/generate-api-prod-package.ts` - Review (1h)
- [ ] `.claude/tools/format-markdown.sh` - Path review (0.5h)

### Agents (4h)

- [ ] `.claude/agents/product/product-functional.md` (1h)
- [ ] `.claude/agents/specialized/tech-writer.md` (1h)
- [ ] `.claude/agents/quality/debugger.md` (1h)
- [ ] `packages/github-workflow/` agents (1h)

### Commands (2h)

- [ ] `.claude/commands/run-tests.md` (0.5h)
- [ ] `.claude/commands/add-new-entity.md` (0.5h)
- [ ] `.claude/commands/update-docs.md` (0.5h)
- [ ] `.claude/commands/review-*.md` (0.5h)

### Skills (2h)

- [ ] `.claude/skills/qa/*.md` (1h)
- [ ] `.claude/skills/testing/*.md` (0.5h)
- [ ] `.claude/skills/tech/vercel-specialist.md` (0.5h)

### Workflows (1.5h)

- [ ] `.claude/docs/workflows/task-atomization.md` (0.5h)
- [ ] `.claude/docs/workflows/decision-tree.md` (1h)

### Standards (1h)

- [ ] `.claude/docs/standards/testing-standards.md` (1h)

### Config (0.5h)

- [ ] `.gitignore` - Add worktree entries (0.5h)

---

## P3 - Low Priority (11 files, 5 hours)

**Complete ongoing as time permits**

### Agents (2h)

- [ ] `.claude/agents/design/ux-ui-designer.md` (0.5h)
- [ ] `.claude/agents/specialized/i18n-specialist.md` (0.5h)
- [ ] Design agents (1h)

### Commands (1h)

- [ ] `.claude/commands/five-why.md` (0.5h)
- [ ] Other specialized commands (0.5h)

### Skills (1h)

- [ ] `.claude/skills/documentation/markdown-formatter.md` (0.5h)
- [ ] `.claude/skills/patterns/*.md` (0.5h)

### Standards (0.5h)

- [ ] `.claude/docs/standards/architecture-patterns.md` (0.5h)

### Scripts (0.5h)

- [ ] `.claude/scripts/sync-registry.sh` - Review (0.5h)
- [ ] `package.json` scripts - Final review (0h - verification only)

---

## Validation Checklist

### Pre-Migration

- [ ] All P0 files updated in migration branch
- [ ] `start-development.sh` script created and tested
- [ ] `archive-planning.sh` script created and tested
- [ ] Test PR created and successfully merged
- [ ] Pre-commit hook blocks main commits
- [ ] GitHub CLI authenticated and working
- [ ] Team notified and trained

### Post-P0 (Week 2)

- [ ] No direct commits to main possible
- [ ] All PRs trigger CI correctly
- [ ] Agents give correct instructions
- [ ] Commands work in worktree context
- [ ] Developer satisfaction survey > 4/5

### Post-P1 (Week 3)

- [ ] All engineering agents updated
- [ ] All core workflows updated
- [ ] Scripts work in worktrees
- [ ] Documentation is complete

### Final (Week 4+)

- [ ] All P2 items complete
- [ ] P3 items prioritized
- [ ] Migration retrospective conducted
- [ ] Lessons learned documented

---

## Quick Commands

```bash
# Start working (after approval)
./start-development.sh P-006

# Check migration status
grep -r "commit to main" .claude/

# After PR merge
./archive-planning.sh P-006
```

---

**Document Status:** ✅ Ready for Implementation
**Last Updated:** 2025-11-01
**Version:** 1.0

> **📚 Note:** For detailed analysis of each file, see `analysis/migration-audit-full.md`
