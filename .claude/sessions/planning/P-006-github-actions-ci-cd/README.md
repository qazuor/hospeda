# Planning Session: GitHub Actions CI/CD Automation

**Session ID:** P-006-github-actions-ci-cd
**Created:** 2025-11-01
**Status:** 🟡 In Progress - Phase 1: Planning

## Overview

Implementation of comprehensive CI/CD automation using GitHub Actions to ensure code quality, performance, security, and reliability across the Hospeda monorepo.

## Objectives

1. **Quality Gates:** Automated checks on every PR (Lighthouse, tests, lint, typecheck)
2. **Security:** CodeQL static analysis with PR blocking
3. **Performance:** Bundle size monitoring with regression detection
4. **Dependencies:** Automated updates with conditional auto-merge (Renovate)
5. **Health Monitoring:** Scheduled cron jobs for proactive issue detection

## Scope

### 🔄 EXPANDED SCOPE: Migration to PR-Based Workflow

**CRITICAL:** This project includes a comprehensive migration of the entire monorepo from "commit-to-main" workflow to "PR-based + Git Worktrees" workflow.

**Migration Analysis Required:**

1. **Code Analysis:**
   - Scripts assuming single project instance
   - Hardcoded branch names (main/master)
   - Path assumptions that break with worktrees
   - Commands that commit directly to main
   - Git operations that need PR flow

2. **Workflow Analysis:**
   - All `.claude/agents/*.md` - Update instructions for PR workflow
   - All `.claude/commands/*.md` - Adapt for worktrees/PRs
   - All `.claude/skills/*.md` - Check for direct-commit assumptions
   - All `.claude/docs/workflows/*.md` - Update for PR requirement
   - All `.claude/scripts/*.sh` - Verify worktree compatibility

3. **Documentation Analysis:**
   - README files (root + apps + packages)
   - Contributing guidelines
   - Development setup docs
   - Deployment documentation
   - Architecture docs referencing git workflow

4. **Configuration Analysis:**
   - Git hooks (.husky) - Adapt for multiple worktrees
   - Package.json scripts - Ensure worktree-safe
   - CI/CD configs - Already PR-based (validate)
   - Environment setup - Worktree considerations

5. **Agent Instructions Analysis:**
   - Remove "commit directly to main" instructions
   - Add "always work in feature branch" requirements
   - Update commit protocols to mention PR creation
   - Add worktree cleanup instructions

**Deliverables from Migration Analysis:**

- **migration-analysis.md** - Comprehensive audit of all changes needed
- **Updated PDR.md** - Add US-007: Monorepo Migration to PR Workflow
- **Updated tech-analysis.md** - Add migration architecture section
- **Updated TODOs.md** - Add PB-011: Migration tasks (estimated 6-8h)

### CI/CD Workflows (On PR)

- **Lighthouse CI:** Performance, A11y, SEO, Best Practices audits
  - Strict mode: Block PR if scores < thresholds
  - Target: Perf >= 90, A11y >= 95, SEO >= 90, BP >= 90

- **Bundle Size Guard:** Monitor bundle size with Size Limit + bundlewatch
  - Alert: >5% increase
  - Block: >10% increase
  - Historical tracking

- **CodeQL Security:** Static analysis for JS/TS vulnerabilities
  - Block: Critical + High severity
  - Warn: Medium severity
  - Info: Low severity

- **Renovate:** Automated dependency updates
  - Auto-merge: patch devDeps + security fixes
  - Manual review: major updates
  - Grouping: React, TanStack, Drizzle, etc.

### Cron Jobs (Scheduled)

- **Dependencies Health:** Daily (8 AM) - audit, deprecated, outdated
- **Docs Validation:** Daily (9 AM) - structure, links, schemas
- **Database Health:** Weekly (Monday 10 AM) - migrations, schema, seed
- **Bundle Analysis:** Weekly (Friday 6 PM) - composition report
- **E2E Tests:** Nightly (2 AM) - if staging exists

## Success Criteria

- All CI/CD workflows running successfully on PRs
- No false positives blocking valid PRs
- Clear, actionable feedback in PR comments
- Cron jobs reporting to GitHub Issues when issues detected
- Zero regressions in performance/security/bundle size
- Dependencies kept up-to-date automatically

## Documents

- [PDR.md](./PDR.md) - Product Design Requirements
- [tech-analysis.md](./tech-analysis.md) - Technical Analysis
- [TODOs.md](./TODOs.md) - Task Breakdown

## Timeline

- **Phase 1 (Planning):** Session creation + PDR + Tech Analysis
- **Phase 2 (Implementation):** Create workflows + configure tools
- **Phase 3 (Validation):** Test workflows + verify functionality
- **Phase 4 (Finalization):** Documentation + launch

## Related

- [Git Worktrees Guide](../../docs/guides/git-worktrees.md)
- [PR Workflow Guide](../../docs/guides/pr-workflow.md)
- [Phase 1 Planning Workflow](../../docs/workflows/phase-1-planning.md)
