# TODO List: GitHub Actions CI/CD Automation

**Related Documents:**

- [Planning Session Overview](./README.md)
- [Technical Analysis](./tech-analysis.md)
- [Migration Analysis](./migration-analysis.md) - 62-file migration audit
- [Worktree PR Workflow Strategies](./worktree-pr-workflow-strategies.md) - Workflow strategy analysis

**Feature Status**: Not Started
**Start Date**: TBD
**Target Date**: TBD
**Actual Completion**: TBD

---

## Progress Summary

**Overall Progress**: 0% complete

| Priority | Total | Completed | In Progress | Not Started |
|----------|-------|-----------|-------------|-------------|
| **Migration Prerequisites** | | | | |
| P0 (Blocker) | 11 | 0 | 0 | 11 |
| P1 (High) | 22 | 0 | 0 | 22 |
| P2 (Medium) | 18 | 0 | 0 | 18 |
| P3 (Low) | 11 | 0 | 0 | 11 |
| **CI/CD Implementation** | | | | |
| P0 (Critical) | 20 | 0 | 0 | 20 |
| P1 (High) | 11 | 0 | 0 | 11 |
| P2 (Medium) | 3 | 0 | 0 | 3 |
| **Grand Total** | **96** | **0** | **0** | **96** |

**Estimated Total Time**:

- Migration: 56 hours (P0: 16h, P1: 24h, P2: 13h, P3: 3h)
- CI/CD: 19 hours (includes GitHub Projects setup)
- **Total**: 75 hours over 4-5 weeks

**Velocity**: TBD tasks per day (average)

---

## Phase 1: Planning ✅ Completed

### ✅ Planning Tasks

- [x] **[2h]** Create planning session structure and README
  - Completed: 2025-11-01
  - Notes: Session P-006 created with objectives and scope

- [x] **[3h]** Create technical analysis document
  - Completed: 2025-11-01
  - Notes: Comprehensive tech-analysis.md with architecture, risks, and implementation plan

- [x] **[2h]** Break down into atomic tasks
  - Completed: 2025-11-01
  - Notes: TODOs.md with PB-XXX task breakdown

---

## Phase 0: Migration Prerequisites 🔲 Not Started (BLOCKER)

**⚠️ CRITICAL**: This phase MUST complete before any CI/CD implementation begins.

**Overview**: Migrate entire project from commit-to-main to strict PR-based workflow with Git Worktrees enforcement. See [migration-analysis.md](./migration-analysis.md) for complete 62-file audit.

**Duration**: 16-56 hours over 4 weeks
**Timeline**:

- Week 0: P0 Blockers (16h)
- Week 1-2: Soft/Hard Launch + P1 (24h)
- Week 3-4: P2 (13h) + P3 (3h)

**Success Criteria**:

- ✅ Zero direct commits to main possible
- ✅ All agents give correct PR workflow instructions
- ✅ Developers proficient with worktrees
- ✅ Scripts work in worktree environments

---

### PB-000: Migration Prerequisites (Week 0-4)

#### PB-000-001: Critical Blockers - P0 (16h BLOCKER)

**Description**: Implement core enforcement mechanisms and update critical workflow documentation.

**Timeline**: Week 0 (must complete before CI/CD)

##### PB-000-001-001: Update Pre-Commit Hook

- [ ] **[0.5h]** Update `.husky/pre-commit` to block commits to main branch
  - **Dependencies**: None
  - **Assignee**: @nodejs-typescript-engineer
  - **Status**: Not Started
  - **Files**:
    - `.husky/pre-commit` (lines 1-5, add at top after shebang)
  - **Acceptance Criteria**:
    - Hook detects current branch with `git branch --show-current`
    - Exits with error code 1 if branch is `main`
    - Provides helpful error message suggesting worktree creation
    - Shows bypass option (`--no-verify`) with warning
    - Tested in both main and feature branch contexts
  - **Testing**:
    - Try committing in main branch (should fail)
    - Try committing in feature branch (should succeed)
    - Verify error message is clear and actionable
  - **Notes**: This is THE critical enforcement mechanism. Without this, migration fails.

##### PB-000-001-002: Configure GitHub Branch Protection

- [ ] **[0.25h]** Enable branch protection rules for main branch
  - **Dependencies**: None (can be done in parallel with 001)
  - **Assignee**: Repository admin
  - **Status**: Not Started
  - **Configuration**: GitHub Settings → Branches → Add rule for `main`
  - **Acceptance Criteria**:
    - Require pull request before merging: ✅
    - Require approvals: 1
    - Dismiss stale PR approvals: ✅
    - Require status checks to pass: ✅ (will add specific checks later in CI/CD phase)
    - Require linear history: ✅
    - Do not allow bypassing the above settings: ✅ (even for admins)
    - Allow force pushes: ❌
    - Allow deletions: ❌
  - **Testing**:
    - Try pushing directly to main (should fail)
    - Create PR and try merging without approval (should fail)
  - **Notes**: Secondary enforcement layer. Git hook is primary.

##### PB-000-001-003: Update CLAUDE.md

- [ ] **[1h]** Add PR workflow policy to project conventions
  - **Dependencies**: None
  - **Assignee**: @tech-writer
  - **Status**: Not Started
  - **Files**:
    - `CLAUDE.md` (after line ~400 in Git section)
  - **Acceptance Criteria**:
    - New section "Branch & PR Policy" added
    - Documents: NEVER commit to main, ALWAYS use worktrees, ALWAYS create PRs
    - Explains enforcement mechanisms (pre-commit hook + branch protection)
    - Provides workflow examples for Level 2 and Level 3
    - Links to detailed guides
  - **Testing**:
    - Read by team member unfamiliar with new workflow
    - Verify clarity and completeness
  - **Notes**: See tech-analysis.md section 2.8 for content template

##### PB-000-001-004: Update Tech Lead Agent

- [ ] **[2h]** Update tech-lead.md agent with PR workflow guidance
  - **Dependencies**: PB-000-001-003
  - **Assignee**: @tech-lead
  - **Status**: Not Started
  - **Files**:
    - `.claude/agents/engineering/tech-lead.md` (line 1194+, Phase 4 section)
  - **Acceptance Criteria**:
    - Phase 4 section includes PR creation workflow
    - Instructions for verifying not on main branch
    - Push and PR creation steps documented
    - Linear integration explained
    - Deployment notes updated ("Only on PR merge to main")
  - **Testing**:
    - Agent generates correct PR workflow in Phase 4
    - No mentions of direct commits to main remain
  - **Notes**: Critical agent - coordinates all others

##### PB-000-001-005: Update /commit Command

- [ ] **[2h]** Add PR creation workflow to commit command
  - **Dependencies**: PB-000-001-003
  - **Assignee**: @nodejs-typescript-engineer
  - **Status**: Not Started
  - **Files**:
    - `.claude/commands/git/commit.md` (after line 405)
  - **Acceptance Criteria**:
    - New Step 5: Verify Branch (check not on main)
    - New Step 6: Push to Remote
    - New Step 7: Create Pull Request (with gh CLI examples)
    - PR description template provided
    - Linear integration documented
  - **Testing**:
    - Command generates correct workflow steps
    - Examples work when copy-pasted
  - **Notes**: Heavily used command - must be correct

##### PB-000-001-006: Update git-commit-helper Skill

- [ ] **[2h]** Add PR workflow integration to git helper skill
  - **Dependencies**: PB-000-001-005
  - **Assignee**: @nodejs-typescript-engineer
  - **Status**: Not Started
  - **Files**:
    - `.claude/skills/git/git-commit-helper.md` (after line 433)
  - **Acceptance Criteria**:
    - New section "PR Workflow Integration" added
    - Branch verification steps documented
    - Push and PR creation workflow explained
    - PR description template provided
    - Best practices for PR management
  - **Testing**:
    - Skill generates complete PR workflow
    - PR description template is comprehensive
  - **Notes**: Skills are referenced by multiple agents

##### PB-000-001-007: Update /quality-check Command

- [ ] **[2h]** Add PR preparation phase to quality check
  - **Dependencies**: PB-000-001-003
  - **Assignee**: @qa-engineer
  - **Status**: Not Started
  - **Files**:
    - `.claude/commands/quality-check.md` (new Phase 5 at end)
  - **Acceptance Criteria**:
    - New Phase 5: PR Preparation added
    - Step 1: Verify Branch (check not on main)
    - Step 2: Push Changes (with command)
    - Step 3: Reference to /commit command for PR creation
    - Integration with existing quality gates
  - **Testing**:
    - Quality check workflow ends with PR readiness
    - Instructions are clear
  - **Notes**: Quality check is final step before PR

##### PB-000-001-008: Update Atomic Task Protocol

- [ ] **[2h]** Add worktree setup and PR creation to atomic task workflow
  - **Dependencies**: PB-000-001-003
  - **Assignee**: @tech-lead
  - **Status**: Not Started
  - **Files**:
    - `.claude/docs/workflows/atomic-task-protocol.md` (new Step 0 at beginning, new Step 12 at end)
  - **Acceptance Criteria**:
    - New Step 0: Setup (worktree creation)
    - Worktree creation command with examples
    - Updated Step 12: Create Pull Request
    - Push and PR creation workflow
    - CI wait and merge steps
  - **Testing**:
    - Workflow is complete from start to finish
    - No steps missing
  - **Notes**: Most commonly used workflow level

##### PB-000-001-009: Update Phase 2 Implementation Workflow

- [ ] **[1h]** Add Git workflow guidance to Phase 2
  - **Dependencies**: PB-000-001-003
  - **Assignee**: @tech-lead
  - **Status**: Not Started
  - **Files**:
    - `.claude/docs/workflows/phase-2-implementation.md` (new section after existing content)
  - **Acceptance Criteria**:
    - New section "Git Workflow During Implementation"
    - Separate guidance for Level 2 vs Level 3
    - Push frequency recommendations
    - Best practices documented
  - **Testing**:
    - Guidance is clear for both workflow levels
    - Examples provided
  - **Notes**: Phase 2 is where most coding happens

##### PB-000-001-010: Update Phase 4 Finalization Workflow

- [ ] **[2h]** Add PR creation workflow to Phase 4
  - **Dependencies**: PB-000-001-003
  - **Assignee**: @tech-lead
  - **Status**: Not Started
  - **Files**:
    - `.claude/docs/workflows/phase-4-finalization.md` (new Step 4 after documentation)
  - **Acceptance Criteria**:
    - New Step 4: Create Pull Request
    - Prerequisites checklist
    - Push commits substep
    - Generate PR description substep
    - Create PR substep with gh CLI
    - Link to Linear substep
    - Success message template
  - **Testing**:
    - Workflow completes with PR created
    - PR properly linked to Linear
  - **Notes**: Final phase of feature development

##### PB-000-001-011: Update Task Completion Protocol

- [ ] **[1h]** Add push and PR creation to task completion
  - **Dependencies**: PB-000-001-003
  - **Assignee**: @tech-lead
  - **Status**: Not Started
  - **Files**:
    - `.claude/docs/workflows/task-completion-protocol.md` (after line 100)
  - **Acceptance Criteria**:
    - Push to remote section added
    - PR creation section added
    - PR description generation explained
    - Integration with atomic commits rule
  - **Testing**:
    - Task completion workflow is complete
    - No steps missing
  - **Notes**: Used at end of every task

##### PB-000-001-012: Enhance worktree-create.sh Script

- [ ] **[2h]** Add --draft-pr flag support to worktree creation script
  - **Dependencies**: None (script enhancement)
  - **Assignee**: @nodejs-typescript-engineer
  - **Status**: Not Started
  - **Files**:
    - `.claude/scripts/worktree-create.sh` (complete rewrite based on template)
  - **Acceptance Criteria**:
    - Script accepts `--draft-pr` flag
    - Without flag: Creates worktree only (Level 2 workflow)
    - With flag: Creates worktree + draft PR (Level 3 workflow)
    - Initial empty commit created for PR
    - Branch pushed to remote
    - Draft PR created with template
    - Dependencies installed automatically
    - Help text updated with examples
    - Validation checks added (gh CLI, branch exists, etc.)
  - **Testing**:
    - Test without flag (worktree only)
    - Test with flag (worktree + draft PR)
    - Test error cases (no gh CLI, branch exists, etc.)
  - **Notes**: See worktree-pr-workflow-strategies.md for implementation template

**PB-000-001 Validation**:

- [ ] All P0 files updated
- [ ] Test PR created and merged successfully
- [ ] Pre-commit hook blocks main commits
- [ ] Branch protection enforces PR workflow
- [ ] Worktree script works with both modes
- [ ] Team training conducted

---

### P0 - Critical (Must Have) - CI/CD Implementation

**Prerequisites**: PB-000-001 must be complete (migration P0 blockers)

#### PB-001: Foundation & Configuration (2-3h)

##### PB-001-001: Add Bundle Analysis Dependencies

- [ ] **[0.5h]** Add size-limit, bundlewatch, and @lhci/cli to root package.json
  - **Dependencies**: None
  - **Assignee**: @nodejs-typescript-engineer
  - **Status**: Not Started
  - **Files**:
    - `package.json` (root)
  - **Acceptance Criteria**:
    - devDependencies added: `@lhci/cli`, `size-limit`, `@size-limit/preset-app`, `bundlewatch`
    - Run `pnpm install` successfully
    - Lock file updated
  - **Notes**: Use latest stable versions, add to devDependencies

##### PB-001-002: Create Lighthouse CI Configuration

- [ ] **[0.5h]** Create .lighthouserc.json with strict thresholds
  - **Dependencies**: PB-001-001
  - **Assignee**: @nodejs-typescript-engineer
  - **Status**: Not Started
  - **Files**:
    - `.lighthouserc.json` (new)
  - **Acceptance Criteria**:
    - Configuration file created at root
    - Thresholds set: Performance >= 90, A11y >= 95, SEO >= 90, BP >= 90
    - URLs configured for web app (localhost:4321)
    - Number of runs set to 3 for averaging
  - **Notes**: See tech-analysis.md section 10.3 for configuration

##### PB-001-003: Create Size Limit Configuration

- [ ] **[0.5h]** Create size-limit.json with bundle size limits
  - **Dependencies**: PB-001-001
  - **Assignee**: @nodejs-typescript-engineer
  - **Status**: Not Started
  - **Files**:
    - `size-limit.json` (new)
  - **Acceptance Criteria**:
    - Configuration file created at root
    - Limits defined for: Web app client (150KB), Admin app (200KB), API (1MB)
    - Paths configured correctly for each app
  - **Notes**: See tech-analysis.md section 10.2 for configuration

##### PB-001-004: Create Bundlewatch Configuration

- [ ] **[0.5h]** Create bundlewatch.config.json for historical tracking
  - **Dependencies**: PB-001-001
  - **Assignee**: @nodejs-typescript-engineer
  - **Status**: Not Started
  - **Files**:
    - `bundlewatch.config.json` (new)
  - **Acceptance Criteria**:
    - Configuration file created at root
    - Files to track defined for each app
    - Thresholds set: warning at 5%, error at 10%
    - CI integration enabled
  - **Notes**: Complements size-limit with historical comparison

##### PB-001-005: Create Reusable Workflow Template (Setup)

- [ ] **[1h]** Create reusable workflow for Node/pnpm setup with caching
  - **Dependencies**: None
  - **Assignee**: @nodejs-typescript-engineer
  - **Status**: Not Started
  - **Files**:
    - `.github/workflows/reusable-setup.yml` (new)
  - **Acceptance Criteria**:
    - Workflow accepts node-version and pnpm-version as inputs
    - Sets up Node.js and pnpm
    - Configures pnpm store caching with lock file key
    - Runs `pnpm install --frozen-lockfile`
    - Returns outputs: cache-hit, pnpm-store-path
  - **Notes**: Used by all other workflows to DRY setup

---

#### PB-002: Lighthouse CI Workflow (2-3h)

##### PB-002-001: Create Lighthouse CI Workflow File

- [ ] **[0.5h]** Create workflow file with path filters and triggers
  - **Dependencies**: PB-001-005
  - **Assignee**: @nodejs-typescript-engineer
  - **Status**: Not Started
  - **Files**:
    - `.github/workflows/lighthouse-ci.yml` (new)
  - **Acceptance Criteria**:
    - Workflow triggers on PR (only `ready_for_review` and `synchronize`)
    - Path filters: runs only when `apps/web/**` or `packages/**` changes
    - Manual workflow_dispatch enabled for testing
    - Uses reusable setup workflow
  - **Notes**: Start with manual trigger only, enable PR trigger after testing

##### PB-002-002: Implement Lighthouse Build Step

- [ ] **[0.5h]** Add job to build web app for Lighthouse audit
  - **Dependencies**: PB-002-001
  - **Assignee**: @nodejs-typescript-engineer
  - **Status**: Not Started
  - **Files**:
    - `.github/workflows/lighthouse-ci.yml`
  - **Acceptance Criteria**:
    - Job runs `pnpm build --filter=hospeda-web`
    - Build artifacts stored in workspace
    - Preview server started (port 4321)
    - Health check ensures server is ready
  - **Notes**: Use `pnpm preview` to serve build locally

##### PB-002-003: Implement Lighthouse Audit Step

- [ ] **[0.5h]** Add step to run Lighthouse CI with configuration
  - **Dependencies**: PB-002-002
  - **Assignee**: @nodejs-typescript-engineer
  - **Status**: Not Started
  - **Files**:
    - `.github/workflows/lighthouse-ci.yml`
  - **Acceptance Criteria**:
    - Runs `lhci autorun` with `.lighthouserc.json` config
    - Collects results (3 runs, median)
    - Generates JSON and HTML reports
    - Evaluates assertions against thresholds
  - **Notes**: Use `lhci autorun --rc=.lighthouserc.json`

##### PB-002-004: Implement Lighthouse PR Comment

- [ ] **[1h]** Add step to parse results and post formatted PR comment
  - **Dependencies**: PB-002-003
  - **Assignee**: @nodejs-typescript-engineer
  - **Status**: Not Started
  - **Files**:
    - `.github/workflows/lighthouse-ci.yml`
  - **Acceptance Criteria**:
    - Parses Lighthouse JSON report
    - Formats results as markdown table
    - Posts comment to PR with scores and comparison
    - Includes pass/fail status and action items
    - Updates existing comment instead of creating new one
  - **Notes**: Use `actions/github-script@v7` for PR comment API

##### PB-002-005: Test Lighthouse Workflow

- [ ] **[0.5h]** Test workflow manually and validate results
  - **Dependencies**: PB-002-004
  - **Assignee**: @nodejs-typescript-engineer
  - **Status**: Not Started
  - **Files**: N/A
  - **Acceptance Criteria**:
    - Create test PR with web app changes
    - Manually trigger workflow via workflow_dispatch
    - Verify workflow completes successfully
    - Verify PR comment posted with correct format
    - Verify scores match manual Lighthouse run
  - **Notes**: Test with both passing and failing thresholds

---

#### PB-003: Bundle Size Guard Workflow (2-3h)

##### PB-003-001: Create Bundle Size Workflow File

- [ ] **[0.5h]** Create workflow file with path filters
  - **Dependencies**: PB-001-005
  - **Assignee**: @nodejs-typescript-engineer
  - **Status**: Not Started
  - **Files**:
    - `.github/workflows/bundle-size.yml` (new)
  - **Acceptance Criteria**:
    - Workflow triggers on PR
    - Path filters: runs when any app or package changes
    - Manual workflow_dispatch enabled
    - Uses reusable setup workflow
  - **Notes**: Runs on all PRs (not just ready-for-review)

##### PB-003-002: Implement Bundle Build Step

- [ ] **[0.5h]** Add job to build all apps for size measurement
  - **Dependencies**: PB-003-001
  - **Assignee**: @nodejs-typescript-engineer
  - **Status**: Not Started
  - **Files**:
    - `.github/workflows/bundle-size.yml`
  - **Acceptance Criteria**:
    - Builds web, admin, and api apps
    - Uses TurboRepo for parallel builds
    - Build artifacts stored in workspace
    - Build cache leveraged
  - **Notes**: Run `pnpm build` from root (TurboRepo handles all apps)

##### PB-003-003: Implement Size Limit Check

- [ ] **[0.5h]** Add step to run size-limit with configuration
  - **Dependencies**: PB-003-002
  - **Assignee**: @nodejs-typescript-engineer
  - **Status**: Not Started
  - **Files**:
    - `.github/workflows/bundle-size.yml`
  - **Acceptance Criteria**:
    - Runs `pnpm size-limit` from root
    - Reads configuration from `size-limit.json`
    - Measures bundle sizes for all apps
    - Compares with thresholds
    - Outputs size report
  - **Notes**: size-limit will fail if limits exceeded

##### PB-003-004: Implement Bundlewatch Comparison

- [ ] **[0.5h]** Add step to run bundlewatch for historical comparison
  - **Dependencies**: PB-003-002
  - **Assignee**: @nodejs-typescript-engineer
  - **Status**: Not Started
  - **Files**:
    - `.github/workflows/bundle-size.yml`
  - **Acceptance Criteria**:
    - Runs `pnpm bundlewatch` from root
    - Reads configuration from `bundlewatch.config.json`
    - Compares with base branch (main)
    - Generates comparison report
    - Fails if increase exceeds 10%
  - **Notes**: Requires BUNDLEWATCH_GITHUB_TOKEN secret for PR comments

##### PB-003-005: Implement Bundle Size PR Comment

- [ ] **[0.5h]** Add step to create formatted PR comment with size comparison
  - **Dependencies**: PB-003-003, PB-003-004
  - **Assignee**: @nodejs-typescript-engineer
  - **Status**: Not Started
  - **Files**:
    - `.github/workflows/bundle-size.yml`
  - **Acceptance Criteria**:
    - Parses size-limit and bundlewatch output
    - Formats as markdown table with before/after comparison
    - Shows percentage change and pass/fail status
    - Posts to PR (updates existing comment)
    - Includes visual indicators (✅/⚠️/❌)
  - **Notes**: Use `actions/github-script@v7` for PR comment

##### PB-003-006: Test Bundle Size Workflow

- [ ] **[0.5h]** Test workflow with size increases
  - **Dependencies**: PB-003-005
  - **Assignee**: @nodejs-typescript-engineer
  - **Status**: Not Started
  - **Files**: N/A
  - **Acceptance Criteria**:
    - Create test PR with intentional bundle size increase
    - Verify workflow detects increase
    - Verify PR comment shows comparison
    - Verify workflow fails if increase >10%
    - Verify workflow passes if increase <5%
  - **Notes**: Test with both apps/web and apps/admin changes

---

#### PB-004: CodeQL Security Workflow (1-2h)

##### PB-004-001: Create CodeQL Workflow File

- [ ] **[0.5h]** Create workflow file with CodeQL action
  - **Dependencies**: None
  - **Assignee**: @security-engineer
  - **Status**: Not Started
  - **Files**:
    - `.github/workflows/codeql.yml` (new)
  - **Acceptance Criteria**:
    - Workflow triggers on PR and push to main
    - Runs on schedule (weekly: Monday 10 AM)
    - Manual workflow_dispatch enabled
    - Targets JavaScript/TypeScript language
  - **Notes**: Use official `github/codeql-action` (latest version)

##### PB-004-002: Configure CodeQL Analysis

- [ ] **[0.5h]** Configure CodeQL with query suites and exclusions
  - **Dependencies**: PB-004-001
  - **Assignee**: @security-engineer
  - **Status**: Not Started
  - **Files**:
    - `.github/workflows/codeql.yml`
    - `.github/codeql/codeql-config.yml` (new)
  - **Acceptance Criteria**:
    - Uses `security-extended` query suite
    - Excludes generated files (dist/, node_modules/, routeTree.gen.ts)
    - Excludes test files from some queries
    - Configures paths to scan
  - **Notes**: See GitHub CodeQL documentation for query suites

##### PB-004-003: Configure CodeQL Severity Thresholds

- [ ] **[0.5h]** Set up failure thresholds and PR blocking
  - **Dependencies**: PB-004-002
  - **Assignee**: @security-engineer
  - **Status**: Not Started
  - **Files**:
    - `.github/workflows/codeql.yml`
  - **Acceptance Criteria**:
    - Blocks PR on Critical severity (always fail)
    - Blocks PR on High severity (always fail)
    - Warns on Medium severity (doesn't block)
    - Info on Low severity (doesn't block)
    - Results uploaded to Security tab
  - **Notes**: Use `fail-on-severity` option in CodeQL action

##### PB-004-004: Test CodeQL Workflow

- [ ] **[0.5h]** Test workflow with sample vulnerabilities
  - **Dependencies**: PB-004-003
  - **Assignee**: @security-engineer
  - **Status**: Not Started
  - **Files**: N/A
  - **Acceptance Criteria**:
    - Manually trigger workflow
    - Verify analysis completes
    - Verify results appear in Security tab
    - Test with intentional vulnerability (SQL injection pattern)
    - Verify PR blocking on critical/high severity
  - **Notes**: Use test code with known vulnerability patterns

---

#### PB-005: Renovate Configuration (2-3h)

##### PB-005-001: Create Renovate Configuration File

- [ ] **[1h]** Create renovate.json with base configuration
  - **Dependencies**: None
  - **Assignee**: @nodejs-typescript-engineer
  - **Status**: Not Started
  - **Files**:
    - `renovate.json` (new)
  - **Acceptance Criteria**:
    - Configuration file created at root
    - Extends `config:base` preset
    - Timezone set to project timezone
    - Schedule configured (weekdays only)
    - Semantic commit messages enabled
  - **Notes**: See Renovate documentation for base config

##### PB-005-002: Configure Renovate Grouping Rules

- [ ] **[1h]** Set up dependency grouping and auto-merge rules
  - **Dependencies**: PB-005-001
  - **Assignee**: @nodejs-typescript-engineer
  - **Status**: Not Started
  - **Files**:
    - `renovate.json`
  - **Acceptance Criteria**:
    - Group React ecosystem packages
    - Group TanStack packages
    - Group Drizzle packages
    - Group testing packages (vitest, @testing-library)
    - Group Astro packages
    - Group Hono packages
    - Group devDependencies separately from dependencies
  - **Notes**: See tech-analysis.md for grouping strategy

##### PB-005-003: Configure Renovate Auto-Merge Conditions

- [ ] **[0.5h]** Set up conditional auto-merge rules
  - **Dependencies**: PB-005-002
  - **Assignee**: @nodejs-typescript-engineer
  - **Status**: Not Started
  - **Files**:
    - `renovate.json`
  - **Acceptance Criteria**:
    - Auto-merge enabled for: patch updates to devDependencies
    - Auto-merge enabled for: security patches (all deps)
    - Auto-merge requires: passing CI checks
    - Auto-merge requires: 3 days stability (stabilityDays)
    - Manual review required for: major updates, production dependencies
  - **Notes**: Start conservative, expand auto-merge scope gradually

##### PB-005-004: Enable Renovate on Repository

- [ ] **[0.5h]** Activate Renovate bot and validate configuration
  - **Dependencies**: PB-005-003
  - **Assignee**: @nodejs-typescript-engineer
  - **Status**: Not Started
  - **Files**: N/A
  - **Acceptance Criteria**:
    - Renovate app installed on GitHub repository
    - Configuration validated (Renovate creates validation PR)
    - Renovate dashboard accessible
    - First dependency PRs created
    - Verify PR format and grouping
  - **Notes**: Install via GitHub Marketplace, start with dry-run mode

---

#### PB-006: Cron Job Workflows (2-3h)

##### PB-006-001: Create Dependencies Health Cron Job

- [ ] **[0.5h]** Create workflow for daily dependency health checks
  - **Dependencies**: PB-001-005
  - **Assignee**: @nodejs-typescript-engineer
  - **Status**: Not Started
  - **Files**:
    - `.github/workflows/cron-dependencies-health.yml` (new)
  - **Acceptance Criteria**:
    - Runs daily at 8 AM UTC (cron schedule)
    - Manual workflow_dispatch enabled
    - Runs `pnpm audit` for vulnerabilities
    - Runs `pnpm outdated` for outdated packages
    - Checks for deprecated packages
    - Creates GitHub issue if problems found
  - **Notes**: Use `actions/create-issue@v2` for issue creation

##### PB-006-002: Create Docs Validation Cron Job

- [ ] **[0.5h]** Enhance existing docs validation for cron schedule
  - **Dependencies**: None (extends existing workflow)
  - **Assignee**: @nodejs-typescript-engineer
  - **Status**: Not Started
  - **Files**:
    - `.github/workflows/validate-docs.yml` (modify)
  - **Acceptance Criteria**:
    - Add cron schedule: daily at 9 AM UTC
    - Keep existing PR triggers
    - Create GitHub issue on failure (cron only)
    - Issue includes broken links, missing files, validation errors
  - **Notes**: Reuse existing validation logic, add issue creation

##### PB-006-003: Create Database Health Cron Job

- [ ] **[0.5h]** Create workflow for weekly database health checks
  - **Dependencies**: PB-001-005
  - **Assignee**: @db-engineer
  - **Status**: Not Started
  - **Files**:
    - `.github/workflows/cron-database-health.yml` (new)
  - **Acceptance Criteria**:
    - Runs weekly on Monday at 10 AM UTC
    - Manual workflow_dispatch enabled
    - Verifies migrations are up to date
    - Runs `pnpm db:generate` and checks for drift
    - Validates seed data runs successfully
    - Creates GitHub issue if problems found
  - **Notes**: Requires DATABASE_URL secret for test database

##### PB-006-004: Create Bundle Analysis Cron Job

- [ ] **[0.5h]** Create workflow for weekly bundle size reports
  - **Dependencies**: PB-003-002
  - **Assignee**: @nodejs-typescript-engineer
  - **Status**: Not Started
  - **Files**:
    - `.github/workflows/cron-bundle-analysis.yml` (new)
  - **Acceptance Criteria**:
    - Runs weekly on Friday at 6 PM UTC
    - Manual workflow_dispatch enabled
    - Builds all apps
    - Generates detailed bundle composition report
    - Analyzes bundle size trends (last 4 weeks)
    - Creates GitHub issue with report
  - **Notes**: Use webpack-bundle-analyzer or similar for composition

##### PB-006-005: Create E2E Tests Cron Job

- [ ] **[0.5h]** Create workflow for nightly E2E tests (placeholder)
  - **Dependencies**: PB-001-005
  - **Assignee**: @qa-engineer
  - **Status**: Not Started
  - **Files**:
    - `.github/workflows/cron-e2e-tests.yml` (new)
  - **Acceptance Criteria**:
    - Runs nightly at 2 AM UTC
    - Manual workflow_dispatch enabled
    - Currently no-op (adds TODO comment)
    - Creates GitHub issue on failure
    - Ready for E2E suite when available
  - **Notes**: Placeholder workflow, implement when E2E suite exists

##### PB-006-006: Test All Cron Jobs

- [ ] **[0.5h]** Manually trigger and validate all cron workflows
  - **Dependencies**: PB-006-001 through PB-006-005
  - **Assignee**: @nodejs-typescript-engineer
  - **Status**: Not Started
  - **Files**: N/A
  - **Acceptance Criteria**:
    - Trigger each cron job via workflow_dispatch
    - Verify workflows complete successfully
    - Verify GitHub issues created correctly
    - Verify issue format is actionable
    - Test with both success and failure scenarios
  - **Notes**: Use test conditions to simulate failures

---

---

#### PB-007: GitHub Projects Setup (2-3h, P1)

**Description**: Set up GitHub Projects board for CI/CD implementation tracking with automation rules and integration with Linear.

**Timeline**: Week 1 (Phase 1 - Foundation)

##### PB-007-001: Create GitHub Project Board

- [ ] **[0.5h]** Create project board with recommended structure
  - **Dependencies**: None
  - **Assignee**: @tech-lead
  - **Status**: Not Started
  - **Acceptance Criteria**:
    - Project created via GitHub web UI or gh CLI
    - Title: "Hospeda CI/CD Automation"
    - Template: Board view
    - Visibility: Public (or appropriate for repo)
    - Description added explaining purpose
  - **Testing**:
    - Verify project accessible from repository
    - Verify all team members can view
  - **Notes**: See tech-analysis.md section 8.9 for setup instructions

##### PB-007-002: Configure Project Columns and Automation

- [ ] **[1h]** Set up columns and automation rules
  - **Dependencies**: PB-007-001
  - **Assignee**: @tech-lead
  - **Status**: Not Started
  - **Acceptance Criteria**:
    - Columns created: Backlog, Todo, In Progress, In Review, Ready to Merge, Done, Blocked
    - Automation rules configured:
      - Issue opened → Add to Backlog
      - PR opened → Add to In Review
      - PR ready for review → Move to In Review
      - PR converted to draft → Move to In Progress
      - PR merged → Move to Done
      - Issue labeled "blocked" → Move to Blocked
    - Labels created: ci/cd, migration, p0-blocker, p1-high, p2-medium, p3-low, blocked, bug, enhancement
  - **Testing**:
    - Create test issue and verify auto-add to Backlog
    - Create test PR and verify auto-add to In Review
    - Test all automation rules with test items
  - **Notes**: Use Project Settings → Workflows to configure automation

##### PB-007-003: Import Planning Tasks as Issues

- [ ] **[0.5h]** Create GitHub issues from TODOs.md tasks
  - **Dependencies**: PB-007-002
  - **Assignee**: @tech-lead
  - **Status**: Not Started
  - **Acceptance Criteria**:
    - Issues created for all Phase 0 (Migration P0) tasks
    - Issues created for key Phase 2 (CI/CD Implementation) tasks
    - Each issue includes:
      - Title with PB-XXX-YYY format
      - Description from TODOs.md
      - Acceptance criteria as checklist
      - Appropriate labels (priority, category)
      - Estimate in description
      - Linked to project board
    - Issues organized in project board by priority
  - **Testing**:
    - Verify all issues visible in project
    - Verify issue descriptions are clear
    - Verify labels applied correctly
  - **Notes**: Can use gh CLI for bulk creation, see tech-analysis.md section 8.4

##### PB-007-004: Document Project Workflow for Team

- [ ] **[1h]** Create documentation for using GitHub Projects
  - **Dependencies**: PB-007-003
  - **Assignee**: @tech-writer
  - **Status**: Not Started
  - **Files**:
    - `docs/ci-cd/github-projects-workflow.md` (new)
    - `CONTRIBUTING.md` (update)
  - **Acceptance Criteria**:
    - Documentation explains project board structure
    - Developer workflow documented (pick task → create PR → merge)
    - Automation rules explained
    - Best practices documented (linking PRs, using labels)
    - Screenshots/examples included
    - Link added to CONTRIBUTING.md
  - **Testing**:
    - Review by team member unfamiliar with GitHub Projects
    - Verify clarity and completeness
  - **Notes**: Use tech-analysis.md section 8 as reference

##### PB-007-005: Set Up Linear ↔ GitHub Projects Sync (Optional)

- [ ] **[2h]** Configure bi-directional sync between Linear and GitHub
  - **Dependencies**: PB-007-003
  - **Assignee**: @tech-lead
  - **Status**: Not Started (Optional)
  - **Acceptance Criteria**:
    - Linear GitHub integration installed
    - Sync rules configured:
      - Linear task created → GitHub issue created
      - GitHub PR merged → Linear task status "Done"
      - GitHub PR review → Linear task comment
    - Test sync with sample task
    - Verify bi-directional updates work
    - Document sync behavior
  - **Testing**:
    - Create Linear task, verify GitHub issue created
    - Merge GitHub PR, verify Linear task marked done
    - Add GitHub PR comment, verify appears in Linear
  - **Notes**: Optional but recommended for team coordination, see tech-analysis.md section 8.5

**PB-007 Validation**:

- [ ] Project board functional and tracking all tasks
- [ ] Automation rules working correctly
- [ ] Team members trained on workflow
- [ ] Documentation complete and accessible
- [ ] Linear integration working (if enabled)

---

### P1 - High (Should Have)

#### PB-008: Enhanced Workflow Features (2-3h)

##### PB-008-001: Implement Workflow Concurrency Control

- [ ] **[0.5h]** Add concurrency groups to prevent duplicate runs
  - **Dependencies**: All PB-002 through PB-006
  - **Assignee**: @nodejs-typescript-engineer
  - **Status**: Not Started
  - **Files**:
    - All workflow files
  - **Acceptance Criteria**:
    - Concurrency groups added to all PR workflows
    - Group by PR number to cancel outdated runs
    - Previous runs cancelled when new commit pushed
    - Cron jobs run sequentially (no overlap)
  - **Notes**: Saves CI minutes, faster feedback

##### PB-008-002: Add Workflow Failure Notifications

- [ ] **[0.5h]** Configure notifications for workflow failures
  - **Dependencies**: All PB-002 through PB-006
  - **Assignee**: @nodejs-typescript-engineer
  - **Status**: Not Started
  - **Files**:
    - All workflow files
  - **Acceptance Criteria**:
    - PR author notified on workflow failure
    - Team notified on cron job failures (via GitHub Issues)
    - Notifications include workflow name and error summary
    - Links to failed run provided
  - **Notes**: Use GitHub's built-in notifications

##### PB-008-003: Implement Workflow Caching Strategy

- [ ] **[1h]** Optimize caching across all workflows
  - **Dependencies**: PB-001-005
  - **Assignee**: @nodejs-typescript-engineer
  - **Status**: Not Started
  - **Files**:
    - `.github/workflows/reusable-setup.yml`
    - All workflow files
  - **Acceptance Criteria**:
    - pnpm store cached with lock file key
    - TurboRepo cache configured
    - Build artifacts cached between steps
    - Cache cleanup on lock file changes
    - Cache hit rate monitored
  - **Notes**: See tech-analysis.md section 10.1 for strategies

##### PB-008-004: Add Manual Workflow Override Mechanism

- [ ] **[0.5h]** Implement commit message flags to skip workflows
  - **Dependencies**: All PB-002 through PB-006
  - **Assignee**: @nodejs-typescript-engineer
  - **Status**: Not Started
  - **Files**:
    - All workflow files
  - **Acceptance Criteria**:
    - Support `[skip ci]` to skip all workflows
    - Support `[skip lighthouse]` to skip Lighthouse only
    - Support `[skip bundle]` to skip bundle size only
    - Support `[skip codeql]` to skip CodeQL only
    - Document in CONTRIBUTING.md
  - **Notes**: Use `contains(github.event.head_commit.message, '[skip ...]')`

##### PB-008-005: Implement Workflow Telemetry

- [ ] **[0.5h]** Add telemetry to track workflow performance
  - **Dependencies**: All PB-002 through PB-006
  - **Assignee**: @nodejs-typescript-engineer
  - **Status**: Not Started
  - **Files**:
    - All workflow files
  - **Acceptance Criteria**:
    - Record workflow duration for each run
    - Track cache hit rates
    - Track failure rates
    - Export to GitHub Actions Insights
    - Weekly summary in README badge
  - **Notes**: Use built-in GitHub Actions metrics

##### PB-008-006: Create Workflow Testing Documentation

- [ ] **[0.5h]** Document workflow testing procedures
  - **Dependencies**: All PB-002 through PB-006
  - **Assignee**: @tech-writer
  - **Status**: Not Started
  - **Files**:
    - `docs/ci-cd/testing-workflows.md` (new)
  - **Acceptance Criteria**:
    - Document how to test workflows locally (act)
    - Document manual workflow_dispatch testing
    - Document troubleshooting common issues
    - Document rollback procedures
    - Document monitoring and alerts
  - **Notes**: Include examples and screenshots

---

### P2 - Medium (Nice to Have)

#### PB-009: Advanced Features (2-3h)

##### PB-009-001: Set Up Lighthouse CI Server

- [ ] **[1h]** Deploy LHCI server for historical trend analysis
  - **Dependencies**: PB-002-005
  - **Assignee**: @nodejs-typescript-engineer
  - **Status**: Not Started (Deferred to Phase 2)
  - **Files**:
    - LHCI server deployment configuration
    - `.lighthouserc.json` (update with server URL)
  - **Acceptance Criteria**:
    - LHCI server deployed (Vercel/Netlify)
    - Authentication configured
    - Lighthouse workflow uploads results to server
    - Historical trends visible in dashboard
    - PR comments include trend comparison
  - **Notes**: Optional - adds historical analysis capability

##### PB-009-002: Implement Route-Level Bundle Analysis

- [ ] **[1h]** Add per-route bundle size tracking for web app
  - **Dependencies**: PB-003-006
  - **Assignee**: @astro-engineer
  - **Status**: Not Started (Deferred to Phase 2)
  - **Files**:
    - `size-limit.json` (update with route configs)
    - `.github/workflows/bundle-size.yml` (update)
  - **Acceptance Criteria**:
    - Bundle size measured per major route
    - Route size comparison in PR comments
    - Route size trends tracked
    - Alerts on route-specific regressions
  - **Notes**: Requires route-level build analysis

##### PB-009-003: Add Visual Regression Testing

- [ ] **[1h]** Integrate visual regression testing in CI
  - **Dependencies**: PB-002-005
  - **Assignee**: @qa-engineer
  - **Status**: Not Started (Deferred to Phase 2)
  - **Files**:
    - `.github/workflows/visual-regression.yml` (new)
    - Percy/Chromatic configuration
  - **Acceptance Criteria**:
    - Screenshots captured on every PR
    - Visual diffs compared with base branch
    - PR comment shows visual changes
    - Approval workflow for intentional changes
  - **Notes**: Requires Percy or Chromatic account

---

## Phase 3: Validation 🔲 Not Started

### Quality Assurance

#### PB-010: Workflow Validation (2-3h)

##### PB-010-001: End-to-End Workflow Testing

- [ ] **[1h]** Test all workflows in integration
  - **Dependencies**: All implementation tasks
  - **Assignee**: @qa-engineer
  - **Status**: Not Started
  - **Acceptance Criteria**:
    - Create comprehensive test PR touching multiple areas
    - Verify all relevant workflows trigger
    - Verify workflows don't conflict
    - Verify PR comments aggregate correctly
    - Verify status checks report correctly
    - Document any issues or edge cases
  - **Notes**: Test with realistic PR scenarios

##### PB-010-002: Path Filter Validation

- [ ] **[0.5h]** Verify path filters work correctly
  - **Dependencies**: All implementation tasks
  - **Assignee**: @nodejs-typescript-engineer
  - **Status**: Not Started
  - **Acceptance Criteria**:
    - Create PRs with isolated changes (API only, web only, etc.)
    - Verify only relevant workflows run
    - Verify no unnecessary workflow runs
    - Document path filter behavior
  - **Notes**: Create test matrix of change types

##### PB-010-003: Performance Validation

- [ ] **[0.5h]** Verify CI performance meets targets
  - **Dependencies**: PB-010-001
  - **Assignee**: @performance-engineer
  - **Status**: Not Started
  - **Acceptance Criteria**:
    - Measure average workflow duration (<10 min target)
    - Measure cache hit rates (>80% target)
    - Identify performance bottlenecks
    - Verify parallel execution working
    - Document performance metrics
  - **Notes**: Run multiple test PRs for average

##### PB-010-004: False Positive Testing

- [ ] **[0.5h]** Test for false positives in quality gates
  - **Dependencies**: PB-010-001
  - **Assignee**: @qa-engineer
  - **Status**: Not Started
  - **Acceptance Criteria**:
    - Test Lighthouse with identical code (should pass consistently)
    - Test bundle size with no changes (should pass)
    - Test CodeQL with safe code patterns (should pass)
    - Document any false positives
    - Adjust thresholds if needed
  - **Notes**: Run workflows 5+ times for consistency

---

## Phase 4: Finalization 🔲 Not Started

### Documentation

#### PB-011: Documentation & Launch (2-3h)

##### PB-011-001: Create CI/CD Architecture Documentation

- [ ] **[1h]** Document workflow architecture and design decisions
  - **Dependencies**: All implementation tasks
  - **Assignee**: @tech-writer
  - **Status**: Not Started
  - **Files**:
    - `docs/ci-cd/architecture.md` (new)
    - `docs/ci-cd/workflows.md` (new)
  - **Acceptance Criteria**:
    - Document workflow architecture with diagrams
    - Document design decisions and rationale
    - Document path filter strategy
    - Document caching strategy
    - Document reusable workflow patterns
  - **Notes**: Use Mermaid diagrams from tech-analysis.md

##### PB-011-002: Create Troubleshooting Guide

- [ ] **[0.5h]** Document common issues and solutions
  - **Dependencies**: PB-010-004
  - **Assignee**: @tech-writer
  - **Status**: Not Started
  - **Files**:
    - `docs/ci-cd/troubleshooting.md` (new)
  - **Acceptance Criteria**:
    - Document common workflow failures
    - Document how to debug workflow issues
    - Document how to override checks (skip flags)
    - Document rollback procedures
    - Include examples and links
  - **Notes**: Based on actual issues from testing phase

##### PB-011-003: Create Developer Guide

- [ ] **[0.5h]** Document CI/CD workflows for developers
  - **Dependencies**: All implementation tasks
  - **Assignee**: @tech-writer
  - **Status**: Not Started
  - **Files**:
    - `docs/ci-cd/developer-guide.md` (new)
    - `CONTRIBUTING.md` (update)
  - **Acceptance Criteria**:
    - Explain what workflows run on PRs
    - Explain quality gate thresholds
    - Explain how to interpret workflow failures
    - Explain how to use skip flags
    - Explain Renovate auto-merge behavior
  - **Notes**: Developer-focused documentation

##### PB-011-004: Add CI Status Badges to README

- [ ] **[0.5h]** Add workflow status badges and documentation links
  - **Dependencies**: All implementation tasks
  - **Assignee**: @tech-writer
  - **Status**: Not Started
  - **Files**:
    - `README.md` (update)
  - **Acceptance Criteria**:
    - Add badges for: CI status, Lighthouse score, CodeQL status
    - Add link to CI/CD documentation
    - Add link to workflow dashboard
    - Update "Contributing" section with CI info
  - **Notes**: Use GitHub Actions badge URLs

##### PB-011-005: Enable Blocking Mode

- [ ] **[0.5h]** Enable PR blocking for failing quality gates
  - **Dependencies**: PB-010-004
  - **Assignee**: @tech-lead
  - **Status**: Not Started
  - **Files**:
    - All workflow files (update)
  - **Acceptance Criteria**:
    - Enable required status checks in branch protection
    - Lighthouse failures block merge
    - Bundle size failures block merge (>10% increase)
    - CodeQL critical/high failures block merge
    - Test suite failures block merge
    - Document in CONTRIBUTING.md
  - **Notes**: Enable after 1 week of warning-only monitoring

##### PB-011-006: Launch & Monitor

- [ ] **[0.5h]** Enable all workflows and monitor for issues
  - **Dependencies**: PB-011-005
  - **Assignee**: @tech-lead
  - **Status**: Not Started
  - **Files**: N/A
  - **Acceptance Criteria**:
    - All workflows enabled on main branch
    - Monitor workflow runs for 1 week
    - Track false positive rate (<5% target)
    - Track CI duration (<10 min target)
    - Track developer feedback
    - Document lessons learned
  - **Notes**: Monitor closely for first week, adjust as needed

---

## Blockers & Issues

### Active Blockers

| Task | Blocker | Impact | Resolution | Owner |
|------|---------|--------|------------|-------|
| N/A | N/A | N/A | N/A | N/A |

### Resolved Blockers

| Task | Was Blocked By | Resolution | Resolved Date |
|------|----------------|------------|---------------|
| N/A | N/A | N/A | N/A |

---

## Notes & Decisions

### Implementation Notes

**2025-11-01**:

- Initial task breakdown created
- All tasks are atomic (0.5-1h each, max 1h)
- Total estimated time: 12-16 hours across all phases
- Phased rollout approach chosen to minimize risk

### Technical Decisions

**Decision 0**: Implement migration prerequisites before CI/CD

- **Rationale**: CI/CD workflows depend on PR-based workflow. Without enforced PRs, quality gates never run and the entire CI/CD investment is wasted
- **Alternatives**: Implement CI/CD first and migrate later (breaks CI/CD), do them in parallel (causes confusion)
- **Impact**: 56 additional hours, 4-week delay before CI/CD begins
- **Date**: 2025-11-01
- **Status**: Accepted - This is a hard blocker

**Decision 0.1**: Use Hybrid PR strategy (workflow-level aware)

- **Rationale**: Matches existing mental model (workflow levels), optimal CI usage (50% cost savings), risk-appropriate validation
- **Alternatives**: Always draft PR (too much overhead), always sequential (too risky for features), fully automated script (less flexibility)
- **Benefits**: Level 2 tasks use minimal CI, Level 3 features get continuous validation
- **Date**: 2025-11-01
- **Status**: Accepted - Recommended in workflow strategy analysis

**Decision 1**: Start with warning-only mode for quality gates

- **Rationale**: Avoid false positives blocking valid PRs during tuning period
- **Alternatives**: Enable blocking immediately (too risky)
- **Date**: 2025-11-01

**Decision 2**: Use GitHub native CodeQL instead of third-party tools

- **Rationale**: Better integration, free for public repos, maintained by GitHub
- **Alternatives**: SonarCloud, Snyk (more features but paid)
- **Date**: 2025-11-01

**Decision 3**: Use Renovate instead of Dependabot

- **Rationale**: More powerful grouping, better monorepo support, conditional auto-merge
- **Alternatives**: Dependabot (simpler but less flexible)
- **Date**: 2025-11-01

---

## Daily Progress Log

_Progress logs will be added as work begins_

---

## Lessons Learned

_Will be populated during implementation_

---

## Metrics

**Estimated Total Time**: 70 hours (Migration: 56h + CI/CD: 14h)

**Estimated by Phase**:

| Phase | Estimated | Tasks |
|-------|-----------|-------|
| Planning | 7h (completed) | 3 |
| **Phase 0: Migration Prerequisites** | **56h** | **62 files** |
| - P0 Blockers (Critical) | 16h | 12 tasks |
| - P1 High Priority | 24h | 22 files |
| - P2 Medium Priority | 13h | 18 files |
| - P3 Low Priority | 3h | 11 files |
| **Phase 2: CI/CD Implementation** | **14h** | **29 tasks** |
| - Implementation | 10-12h | 20 tasks |
| - Validation | 2-3h | 6 tasks |
| - Finalization | 2-3h | 3 tasks |
| **Grand Total** | **77h** | **94 tasks** |

**Timeline**:

- Week 0: Migration P0 blockers (16h)
- Week 1-2: Migration soft/hard launch + P1 (24h)
- Week 3-4: Migration P2+P3 completion (16h)
- Week 4-5: CI/CD implementation (14h)
- **Total Duration**: 4-5 weeks

**Task Breakdown**:

- Average time per task: 0.82h
- Total tasks: 94 atomic tasks (62 migration + 29 CI/CD + 3 planning)
- Longest task: 2h (multiple agent/workflow updates)
- Shortest task: 0.25h (GitHub configuration)

**Critical Path**:

1. PB-000-001 (Migration P0 blockers) - MUST complete first
2. Soft launch + validation
3. Hard launch (enforcement enabled)
4. PB-001 onwards (CI/CD implementation)

---

**Last Updated**: 2025-11-01
**Status**: Planning Complete with Migration Prerequisites, Ready for Phase 0 Implementation
**Next Review**: After PB-000-001 completion (migration blockers)
