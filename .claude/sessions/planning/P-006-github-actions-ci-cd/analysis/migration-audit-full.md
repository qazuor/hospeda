# Migration Analysis: Commit-to-Main → PR-Based + Git Worktrees Workflow

> **⚠️ UPDATED STRATEGY (2025-11-01):**
> After user feedback, workflow has been simplified to **Unified Workflow for ALL levels**.
>
> - No Level 1 exception (ALL work goes through PR)
> - `start-development.sh` command for automated setup
> - GitHub Projects only for Level 3
> - See [worktree-pr-workflow-strategies.md](./worktree-pr-workflow-strategies.md) Summary for final decision

## Executive Summary

### Current State

The Hospeda project currently operates with a **mixed workflow**:

- Some documentation exists for PR-based workflow (`.claude/docs/guides/pr-workflow.md`, `.claude/docs/guides/git-worktrees.md`)
- Worktree creation scripts exist (`.claude/scripts/worktree-create.sh`, `.claude/scripts/worktree-cleanup.sh`)
- **However**: Agents, commands, skills, and workflow docs still contain significant references and assumptions about direct commits to main
- No enforcement mechanism exists to prevent direct commits to main
- No PR creation automation in workflows

### Target State

**ALL development through PRs in feature branches using Git Worktrees:**

- Every code change happens in a feature branch worktree
- PRs are created before merging to main
- Automated CI/CD runs on PRs
- Main branch is protected
- Agents understand and instruct PR workflow
- Commands integrate PR creation
- Worktree awareness throughout tooling

### Migration Scope

**Files Requiring Updates:** 100+ files
**Estimated Total Effort:** 24-32 hours
**Risk Level:** Medium-High (can break developer workflow if not done carefully)
**Breaking Changes:** Multiple (scripts, agent instructions, command outputs)

---

## 1. Code & Scripts Analysis

### 1.1 Shell Scripts (`.claude/scripts/`)

#### `.claude/scripts/worktree-create.sh`

**Status:** ✅ Already worktree-aware
**Lines:** 1-64
**Assessment:** Properly creates worktrees, no changes needed

#### `.claude/scripts/worktree-cleanup.sh`

**Status:** ✅ Already worktree-aware
**Lines:** 1-82
**Issues Found:**

- **Line 13-15:** Assumes main branch exists and is tracked
  - **Risk:** Low
  - **Fix Needed:** Add check if `origin/main` exists before pull
  - **Priority:** P2 (Medium)

**Recommended Change:**

```bash
# Line 13-15
echo "📡 Fetching latest changes..."
git fetch origin main
if git show-ref --verify --quiet refs/heads/main; then
  git checkout main
  git pull origin main
else
  echo "⚠️ Main branch not found locally"
fi
```

#### `.claude/scripts/sync-registry.sh`

**Status:** ⚠️ Worktree-compatible but doesn't consider context
**Lines:** 1-41
**Issues:** None critical
**Priority:** P3 (Low)

#### `.claude/scripts/health-check.sh`

**Status:** ⚠️ Assumes single project instance
**Lines:** 48-343
**Issues Found:**

- **Line 49:** `cd "$(dirname "$0")/../.."` - Assumes executed from project root
  - **Risk:** Medium - Will fail if run from worktree
  - **Fix:** Detect git root dynamically
  - **Priority:** P1 (High)

**Recommended Change:**

```bash
# Line 48-49
# Change to git repository root (works in worktrees)
GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -z "$GIT_ROOT" ]; then
  echo "❌ Error: Not in a git repository"
  exit 1
fi
cd "$GIT_ROOT"
```

#### `.claude/hooks/on-notification.sh`

**Status:** ✅ Worktree-compatible
**Lines:** 1-28
**Issues:** None
**Priority:** P3 (Low)

#### `.claude/tools/format-markdown.sh`

**Status:** ⚠️ Path assumptions
**Assessment:** Needs review for worktree compatibility
**Priority:** P2 (Medium)

### 1.2 TypeScript/JavaScript Scripts

#### `scripts/planning-sync.ts`

**Status:** ⚠️ Needs review
**Risk:** Likely uses `process.cwd()` which may not work correctly in worktrees
**Priority:** P1 (High)
**Assessment Needed:** Full file review required

#### `scripts/planning-complete-task.ts`

**Status:** ⚠️ Needs review
**Same issues as planning-sync.ts**
**Priority:** P1 (High)

#### `scripts/generate-api-prod-package.ts`

**Status:** ⚠️ Needs review
**Priority:** P2 (Medium)

#### `packages/github-workflow/` scripts

**Status:** ⚠️ All need review for worktree compatibility
**Files:**

- `packages/github-workflow/examples/parse-planning-session.ts`
- `packages/github-workflow/examples/scan-code-comments.ts`
- `packages/github-workflow/src/parsers/*.ts`
- `packages/github-workflow/src/sync/*.ts`

**Priority:** P1 (High) - These are core workflow tools

### 1.3 Package.json Scripts

**File:** `package.json`
**Lines:** 17-62

#### Scripts That Need Review

**Git-related scripts:** None currently

**Scripts assuming project root:**

- All scripts using relative paths (line 29-46: db:*, line 55-56: planning:*)
- **Issue:** Most use `pnpm --filter` which should work in worktrees
- **Risk:** Low
- **Priority:** P3 (Low)

**Recommendations:**

- Add new scripts for PR workflow:
  - `pr:create` - Create PR from current branch
  - `pr:update` - Update PR description
  - `wt:create` - Alias for worktree-create.sh
  - `wt:cleanup` - Alias for worktree-cleanup.sh
  - `wt:list` - List all worktrees

**Priority:** P1 (High)

---

## 2. Agent Instructions Analysis

### 2.1 Engineering Agents

#### `.claude/agents/engineering/tech-lead.md`

**Lines:** 1194

**Issues Found:**

**Line 1194:** `# Only on main branch`

```yaml
# Line 1192-1197
#### 5. Deployment

```yaml
# Only on main branch
- Deploy to staging
- Run smoke tests
```

**Context:** CI/CD Pipeline section
**Fix Needed:** Change to "Only on merge to main" + add PR workflow instructions
**Priority:** P0 (Blocker)

**Missing Content:**

- No instructions on PR creation workflow (where in Phase 4?)
- No worktree usage guidance
- No instructions on branch naming
- Git operations assume single instance

**Recommended Additions:**

```markdown
### PR-Based Workflow Integration

#### Phase 2 - Implementation

**Before Starting:**

1. Verify you're in a worktree (not main branch)
2. If not, guide user to create worktree:
   ```bash
   ./.claude/scripts/worktree-create.sh <branch-name> main
   ```

#### Phase 4 - Finalization

**Commit & PR Creation:**

1. Generate conventional commits (existing process)
2. Push to remote:

   ```bash
   git push -u origin <branch-name>
   ```

3. Create PR:

   ```bash
   gh pr create --title "{title}" --body "{description}"
   ```

4. Link Linear issues in PR description
5. Request user review before merge

#### Deployment

**Only on PR merge to main:**

- Automated deployment to staging via GitHub Actions
- Run smoke tests
- Deploy to production (on release tags)

```

**Priority:** P0 (Blocker)

#### `.claude/agents/engineering/hono-engineer.md`

**Assessment Needed:** Full file review
**Expected Issues:**

- Likely no PR workflow instructions
- Git operations may assume main branch
- No worktree awareness

**Priority:** P1 (High)

#### `.claude/agents/engineering/db-drizzle-engineer.md`

**Expected Issues:**

- Migration workflow may assume single instance
- No guidance on migrations in feature branches
- No PR workflow for schema changes

**Priority:** P1 (High)

#### `.claude/agents/engineering/astro-engineer.md`

**Priority:** P1 (High)

#### `.claude/agents/engineering/tanstack-start-engineer.md`

**Priority:** P1 (High)

#### `.claude/agents/engineering/react-senior-dev.md`

**Priority:** P1 (High)

#### `.claude/agents/engineering/node-typescript-engineer.md`

**Priority:** P1 (High)

### 2.2 Product Agents

#### `.claude/agents/product/product-functional.md`

**Expected Issues:**

- No guidance on feature branch planning
- May not consider PR review process in planning

**Priority:** P2 (Medium)

#### `.claude/agents/product/product-technical.md`

**Expected Issues:**

- Tech analysis may not consider branching strategy
- No PR review considerations

**Priority:** P1 (High)

### 2.3 Quality Agents

#### `.claude/agents/quality/qa-engineer.md`

**Expected Issues:**

- Test execution may assume main branch
- No guidance on testing in feature branches
- Missing PR pre-merge test requirements

**Priority:** P1 (High)

#### `.claude/agents/quality/debugger.md`

**Priority:** P2 (Medium)

### 2.4 Design & Specialized Agents

#### `.claude/agents/design/ux-ui-designer.md`

**Priority:** P3 (Low) - Less impacted by git workflow

#### `.claude/agents/specialized/tech-writer.md`

**Expected Issues:**

- Documentation workflow may assume direct commits

**Priority:** P2 (Medium)

#### `.claude/agents/specialized/i18n-specialist.md`

**Priority:** P3 (Low)

---

## 3. Command Instructions Analysis

### 3.1 Git Commands

#### `.claude/commands/git/commit.md`

**File:** Full file (437 lines)
**Status:** ⚠️ Critical Update Needed

**Current State:**

- Generates commit suggestions
- Does NOT mention PR creation
- Does NOT mention pushing to remote
- Assumes commits go directly to current branch (could be main)

**Missing Content:**

1. PR workflow integration (Steps 5-7)
2. Push instructions
3. PR creation with `gh pr create`
4. Worktree verification
5. Branch verification (prevent direct commits to main)

**Recommended Addition (after line 405):**

```markdown
## Step 5: Verify Branch (CRITICAL)

**Before committing, verify you're NOT on main:**

```bash
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" = "main" ]; then
  echo "❌ ERROR: Cannot commit directly to main branch"
  echo "Please create a feature branch worktree:"
  echo "  ./.claude/scripts/worktree-create.sh feature/<name> main"
  exit 1
fi
```

## Step 6: Push to Remote

```bash
# Push commits to remote branch
git push -u origin <branch-name>
```

## Step 7: Create Pull Request

```bash
# Create PR using GitHub CLI
gh pr create \
  --title "feat(scope): description" \
  --body "## Summary
- Changes made
- Why needed

## Testing
- [ ] Tests pass
- [ ] Manual testing done

## Linear
Closes: LIN-XXX"

# Or open in browser for manual PR creation
gh pr create --web
```

```

**Priority:** P0 (Blocker) - Commands are frequently used

### 3.2 Planning Commands

#### `.claude/commands/start-feature-plan.md`

**Expected Issues:**

- Planning may not mention feature branch creation
- No worktree creation step
- No PR planning

**Priority:** P1 (High)

#### `.claude/commands/start-refactor-plan.md`

**Same as start-feature-plan.md**
**Priority:** P1 (High)

#### `.claude/commands/sync-planning.md`

**Expected Issues:**

- May not work correctly in worktrees
- Linear sync may not link to PR

**Priority:** P1 (High)

### 3.3 Quality Commands

#### `.claude/commands/quality-check.md`

**Lines:** 500+ lines
**Expected Issues:**

- No verification that checks run in feature branch
- No PR readiness checklist
- No push/PR creation steps

**Priority:** P0 (Blocker)

**Recommended Addition:**

```markdown
## Phase 5: PR Preparation (NEW)

### Step 1: Verify Branch

```bash
if [ "$(git branch --show-current)" = "main" ]; then
  echo "❌ Cannot proceed - you're on main branch"
  exit 1
fi
```

### Step 2: Push Changes

```bash
git push -u origin $(git branch --show-current)
```

### Step 3: Create PR

Use `/commit` command which now includes PR creation.

```

**Priority:** P0 (Blocker)

#### `.claude/commands/code-check.md`

**Priority:** P1 (High)

#### `.claude/commands/run-tests.md`

**Priority:** P2 (Medium)

### 3.4 Other Commands

#### `.claude/commands/add-new-entity.md`

**Priority:** P2 (Medium)

#### `.claude/commands/update-docs.md`

**Priority:** P2 (Medium)

#### `.claude/commands/five-why.md`

**Priority:** P3 (Low) - Less impacted

---

## 4. Skills Analysis

### 4.1 Git Skills

#### `.claude/skills/git/git-commit-helper.md`

**Lines:** 752 lines
**Status:** ⚠️ Critical Update Needed

**Current State:**

- Comprehensive commit message generation
- Excellent conventional commit guidance
- **Missing:** PR workflow integration
- **Missing:** Push instructions
- **Missing:** Branch verification

**Issues Found:**

- Lines 413-433: Only covers commit creation, not push/PR
- No mention of feature branches
- No worktree awareness

**Recommended Additions:**

```markdown
## PR Workflow Integration (NEW SECTION)

### After Committing

1. **Verify Not on Main**
   ```bash
   git branch --show-current  # Should NOT be 'main'
   ```

2. **Push to Remote**

   ```bash
   git push -u origin $(git branch --show-current)
   ```

3. **Create Pull Request**

   ```bash
   gh pr create --title "type(scope): subject" --body "description"
   ```

### PR Description Template

```markdown
## Summary
- Bullet points of changes

## Testing
- [ ] Unit tests pass (90%+ coverage)
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project standards
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
- [ ] Conventional commits used

## Linear
Closes: LIN-XXX
```

```

**Priority:** P0 (Blocker)

### 4.2 Other Skills

#### `.claude/skills/documentation/markdown-formatter.md`

**Priority:** P3 (Low)

#### `.claude/skills/patterns/error-handling-patterns.md`

**Priority:** P3 (Low)

#### `.claude/skills/patterns/tdd-methodology.md`

**Priority:** P3 (Low)

#### `.claude/skills/qa/*.md`

**Priority:** P2 (Medium)

#### `.claude/skills/testing/*.md`

**Priority:** P2 (Medium)

#### `.claude/skills/tech/*.md`

**Expected Issue in `vercel-specialist.md`:**

- Line 120: "Main branch deploys to production"
- Should be: "PRs deploy to preview, main branch deploys to production"

**Priority:** P2 (Medium)

---

## 5. Workflow Documentation Analysis

### 5.1 Core Workflows

#### `.claude/docs/workflows/atomic-task-protocol.md`

**Lines:** 100+ (limited read)
**Expected Issues:**

- Lines 1-100: Protocol describes task execution
- Likely missing: Feature branch creation step
- Likely missing: PR creation step
- Likely missing: Worktree usage

**Required Updates:**

```markdown
## Step 0: Setup (BEFORE all steps)

### Create Feature Branch Worktree

```bash
# From main worktree
cd ~/projects/hospeda
git checkout main
git pull origin main

# Create worktree for this task
./.claude/scripts/worktree-create.sh feature/PB-XXX main

# Navigate to worktree
cd ../hospeda-feature-PB-XXX
```

## Step 5: Finalize (UPDATED)

### Push & Create PR

```bash
# Commit (existing process)
git add <files>
git commit -m "fix(scope): description"

# Push
git push -u origin feature/PB-XXX

# Create PR
gh pr create --title "fix(scope): description" \
  --body "Fixes issue XXX. See PB-XXX for details."
```

```

**Priority:** P0 (Blocker) - Atomic Task is heavily used

#### `.claude/docs/workflows/phase-1-planning.md`

**Expected Issues:**

- Planning doesn't mention feature branch setup
- No worktree creation in planning phase

**Priority:** P1 (High)

#### `.claude/docs/workflows/phase-2-implementation.md`

**Expected Issues:**

- Implementation starts without worktree setup
- No branch verification

**Priority:** P0 (Blocker)

#### `.claude/docs/workflows/phase-3-validation.md`

**Expected Issues:**

- Validation may not verify branch
- No PR readiness check

**Priority:** P1 (High)

#### `.claude/docs/workflows/phase-4-finalization.md`

**Lines:** 100+ (limited read)
**Current State (lines 1-100):**

- Step 1: Invoke Tech Writer
- Step 2: Documentation Process
- **Missing:** PR creation workflow
- **Missing:** Push instructions

**Required Addition (after documentation):**

```markdown
## Step 4: Create Pull Request

### Prerequisites

- All commits prepared (Step 3)
- Documentation complete (Steps 1-2)
- Quality checks pass

### PR Creation Process

**Duration:** 15-30 minutes

#### Substep 1: Push Commits

```bash
# Verify branch
git branch --show-current  # Should NOT be 'main'

# Push all commits
git push -u origin $(git branch --show-current)
```

#### Substep 2: Generate PR Description

**Agent:** `tech-writer` or main coordinator

**Content:**

```markdown
## Summary
High-level description of changes

## Changes Made
- Component/file changes
- New features/fixes

## Testing
- [ ] Unit tests pass (XX% coverage)
- [ ] Integration tests pass
- [ ] Manual testing done

## Documentation
- [ ] API docs updated
- [ ] README updated (if needed)
- [ ] Comments added

## Linear
Closes: LIN-XXX
Related: LIN-YYY
```

#### Substep 3: Create PR

```bash
gh pr create \
  --title "{conventional-commit-format}" \
  --body "{generated-description}" \
  --assignee @me \
  --label "feature" \
  --base main
```

#### Substep 4: Link PR to Linear

Automatically handled by Linear GitHub integration if:

- PR title contains Linear issue code
- PR body contains "Closes: LIN-XXX"

### PR Created - Next Steps

**Present to User:**

```text
✅ Pull Request Created Successfully!

🔗 PR URL: {url}
📋 PR #: {number}
🌿 Branch: {branch}

Next Steps:
1. Review PR checks (CI/CD will run automatically)
2. Address any review comments
3. Wait for approval
4. Merge PR to main

Cleanup after merge:
  cd ~/projects/hospeda
  ./.claude/scripts/worktree-cleanup.sh
```

```

**Priority:** P0 (Blocker)

#### `.claude/docs/workflows/quick-fix-protocol.md`

**Expected Issues:**

- Quick fixes might bypass PR workflow
- Need explicit PR requirement even for small changes

**Priority:** P1 (High)

#### `.claude/docs/workflows/task-completion-protocol.md`

**Lines:** 100+ (limited read)
**Current State (lines 1-100):**

- Lines 1-19: Task completion verification
- Lines 20-88: Atomic commits rule (excellent - keep this)
- Lines 89-100: Commit generation suggestions

**Missing:**

- After line 100: Push to remote
- PR creation step
- PR description generation

**Priority:** P0 (Blocker)

#### `.claude/docs/workflows/task-atomization.md`

**Priority:** P2 (Medium)

#### `.claude/docs/workflows/decision-tree.md`

**Priority:** P2 (Medium) - May need PR workflow branch in decision tree

---

## 6. Standards Documentation Analysis

### 6.1 Architecture Patterns

#### `.claude/docs/standards/architecture-patterns.md`

**Expected Changes:** Minimal
**Priority:** P3 (Low)

### 6.2 Code Standards

#### `.claude/docs/standards/code-standards.md`

**Expected Issues:**

- May need section on PR requirements
- Git workflow section needed

**Recommended Addition:**

```markdown
## Git Workflow Standards

### Branch Requirements

- **NEVER** commit directly to `main` branch
- **ALWAYS** work in feature branch worktrees
- **ALWAYS** create PR before merging

### Feature Branch Naming

- `feature/*` - New features
- `fix/*` - Bug fixes
- `refactor/*` - Code refactoring
- `hotfix/*` - Critical production fixes
- `docs/*` - Documentation
- `chore/*` - Maintenance

### PR Requirements

- Descriptive title (conventional commit format)
- Complete description
- All checks pass (CI/CD)
- 90%+ test coverage
- At least 1 approval
- Linear issue linked
```

**Priority:** P1 (High)

### 6.3 Testing Standards

#### `.claude/docs/standards/testing-standards.md`

**Expected Changes:**

- Add PR testing requirements
- Add feature branch test execution

**Priority:** P2 (Medium)

---

## 7. Git Configuration Analysis

### 7.1 Husky Hooks

#### `.husky/pre-commit`

**Lines:** 85
**Status:** ⚠️ Needs Branch Verification

**Current Behavior:**

- Formats markdown (lines 9-24)
- Validates .claude docs (lines 26-47)
- Runs Biome (lines 49-62)
- Syncs TODOs with Linear (lines 64-82)

**Missing:**

- **CRITICAL:** No check to prevent commits to main branch

**Recommended Addition (line 1, after shebang):**

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# === CRITICAL: Prevent direct commits to main ===
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" = "main" ]; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "❌ ERROR: Direct commits to main are not allowed"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "Please create a feature branch worktree:"
  echo "  ./.claude/scripts/worktree-create.sh feature/<name> main"
  echo ""
  echo "Or if you're fixing a bug:"
  echo "  ./.claude/scripts/worktree-create.sh fix/<name> main"
  echo ""
  echo "To bypass this check (NOT RECOMMENDED):"
  echo "  git commit --no-verify"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 1
fi

# Continue with existing checks...
```

**Priority:** P0 (BLOCKER) - This is the enforcement mechanism

#### `.husky/commit-msg`

**Lines:** 2
**Status:** ✅ OK - commitlint doesn't need changes

**Current:** `pnpm dlx commitlint --edit $1`
**Assessment:** Works correctly in all contexts
**Priority:** P3 (No change needed)

#### `.husky/post-checkout`

**Lines:** 65
**Status:** ⚠️ Needs Update for Worktree Context

**Current Behavior:**

- Checks code registry consistency
- Validates JSON
- Checks staleness

**Issues:**

- Runs on every branch checkout
- In worktree workflow, might trigger unnecessarily
- Should differentiate between worktree checkout vs file checkout

**Current Check (line 11-14):**

```bash
# Only run on branch checkouts (not file checkouts)
if [ "$BRANCH_CHECKOUT" = "0" ]; then
  exit 0
fi
```

**Recommended Addition (after line 14):**

```bash
# Skip for worktree operations (worktrees share .git)
if [ -f .git ] && grep -q "gitdir:" .git 2>/dev/null; then
  # This is a worktree, registry is shared
  echo "ℹ️  Running in worktree - registry checks skipped"
  exit 0
fi
```

**Priority:** P2 (Medium)

#### Missing: `.husky/pre-push`

**Status:** ⚠️ MISSING - Should Exist

**Recommendation:** Create `.husky/pre-push` hook

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Pre-push hook - Final checks before push

echo "🚀 Running pre-push checks..."

# Check 1: Verify not pushing to main directly (if local)
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" = "main" ]; then
  echo "⚠️  Warning: Pushing to main branch"
  echo "   Ensure this is through a merged PR"
fi

# Check 2: Run tests
echo "🧪 Running tests..."
if ! pnpm test; then
  echo "❌ Tests failed - push cancelled"
  exit 1
fi

# Check 3: Check for large files
echo "📦 Checking for large files..."
large_files=$(git diff --cached --name-only --diff-filter=ACM | \
  xargs -I{} git ls-files -z {} | \
  xargs -0 du -b | \
  awk '$1 > 5242880 {print $2}')  # 5MB limit

if [ -n "$large_files" ]; then
  echo "❌ Large files detected (>5MB):"
  echo "$large_files"
  echo "   Consider using Git LFS"
  exit 1
fi

echo "✅ Pre-push checks complete"
```

**Priority:** P1 (High)

### 7.2 Git Config

#### `.gitignore`

**Status:** ⚠️ Needs Worktree Entries

**Current State:** (need to check file)
**Recommended Additions:**

```gitignore
# Git Worktrees
.git/worktrees/
../*hospeda-*/  # Worktree directories at parent level

# Worktree-specific
.worktree-local/
.vscode-workspace-*
```

**Priority:** P2 (Medium)

#### `.git/config`

**Status:** ⚠️ Needs Branch Protection

**Recommended Addition:**

```bash
# Run once during migration
git config branch.main.mergeoptions "--no-ff"
```

**Priority:** P1 (High)

#### Repository Settings (GitHub)

**Not in codebase, but required:**

**Branch Protection Rules for `main`:**

```yaml
main:
  required_reviews: 1
  require_status_checks: true
  required_status_checks:
    - "CI / Quality Checks"
    - "CI / Tests"
    - "CI / Build"
  enforce_admins: true
  require_linear_history: true
  allow_force_pushes: false
  allow_deletions: false
```

**Priority:** P0 (BLOCKER) - Must be configured before enforcing PR workflow

---

## 8. Environment & Setup Analysis

### 8.1 Root README

#### `README.md`

**Expected Issues:**

- Setup instructions likely don't mention worktrees
- Quick start may assume single project instance
- Contributing guidelines likely missing

**Recommended Additions:**

```markdown
## Development Workflow

### Quick Start

```bash
# Clone repository
git clone https://github.com/user/hospeda.git
cd hospeda

# Install dependencies
pnpm install

# Main worktree stays on main branch
git checkout main
```

### Working on Features

```bash
# Create feature branch worktree
./.claude/scripts/worktree-create.sh feature/my-feature main

# Navigate to worktree
cd ../hospeda-feature-my-feature

# Develop, commit, push
git push -u origin feature/my-feature

# Create PR
gh pr create

# After PR merged, cleanup
cd ../hospeda
./.claude/scripts/worktree-cleanup.sh
```

## Contributing

All contributions must:

1. Be developed in feature branch worktrees
2. Follow conventional commit format
3. Include tests (90%+ coverage)
4. Pass all CI checks
5. Be submitted via Pull Request
6. Link to Linear issue

See [Contributing Guide](docs/CONTRIBUTING.md) for details.

```

**Priority:** P1 (High)

### 8.2 CLAUDE.md

**File:** `CLAUDE.md`
**Current State:** Extensive documentation (already read)

**Issues Found:**

**Section "6. Development Rules" > "Git & Commit Rules":**

- Has atomic commits policy (good!)
- Does NOT mention PR requirement
- Does NOT mention feature branch requirement

**Recommended Addition (after line ~400 in Git section):**

```markdown
### Branch & PR Policy

**CRITICAL: PR-Based Workflow**

- **NEVER** commit directly to `main` branch
- **ALWAYS** create feature branch worktree before starting work
- **ALWAYS** create Pull Request before merging to main

**Enforcement:**

- pre-commit hook prevents commits to main
- GitHub branch protection requires PR + review
- CI/CD only runs on PRs and main

**Workflow:**

```bash
# 1. Create feature worktree
./.claude/scripts/worktree-create.sh feature/my-feature main

# 2. Develop in worktree
cd ../hospeda-feature-my-feature

# 3. Commit changes
git add <files>
git commit -m "feat(scope): description"

# 4. Push to remote
git push -u origin feature/my-feature

# 5. Create PR
gh pr create --title "feat(scope): description" \
  --body "description"

# 6. After merge, cleanup
cd ../hospeda
./.claude/scripts/worktree-cleanup.sh
```

```

**Priority:** P0 (BLOCKER)

### 8.3 Package-specific CLAUDE.md Files

#### `apps/api/CLAUDE.md` (if exists)

**Priority:** P2 (Medium)

#### `apps/web/CLAUDE.md` (if exists)

**Priority:** P2 (Medium)

#### `packages/*/CLAUDE.md` (if exist)

**Priority:** P2 (Medium)

---

## 9. Breaking Changes Analysis

### 9.1 CRITICAL: Will Break Immediately

#### 1. Pre-commit Hook Update (`.husky/pre-commit`)

**What Breaks:**

- Developers cannot commit to main anymore
- Existing workflow of `git add . && git commit` on main fails

**Impact:** HIGH
**Users Affected:** ALL
**Workaround:** `git commit --no-verify` (not recommended)
**Timeline:** Must communicate BEFORE merging

#### 2. Atomic Task Protocol Changes

**What Breaks:**

- Current atomic task workflow starts with code changes
- New workflow requires worktree creation first
- Developers following old docs will be confused

**Impact:** MEDIUM
**Users Affected:** Developers using atomic tasks
**Timeline:** Must update docs BEFORE next atomic task

#### 3. Quality Check Command Changes

**What Breaks:**

- `/quality-check` doesn't create PR
- Developers expect complete workflow
- Missing PR creation causes confusion

**Impact:** MEDIUM
**Users Affected:** ALL (using quality-check)
**Timeline:** Update before Phase 3 validations

### 9.2 MEDIUM: Will Break Gradually

#### 4. Agent Instructions Misalignment

**What Breaks:**

- Agents give wrong instructions (commit to main)
- Inconsistent workflow guidance
- Confusion about PR creation

**Impact:** MEDIUM
**Users Affected:** All AI-assisted development
**Timeline:** Fix ASAP after main protection enabled

#### 5. Script Assumptions

**What Breaks:**

- Scripts assuming single instance
- Scripts using relative paths
- Health checks failing in worktrees

**Impact:** LOW-MEDIUM
**Users Affected:** Users running scripts
**Timeline:** Fix within first week

### 9.3 LOW: Edge Cases

#### 6. Husky Hooks in Worktrees

**What Breaks:**

- Hook execution timing
- Registry checks unnecessary in worktrees

**Impact:** LOW
**Users Affected:** Power users with multiple worktrees
**Timeline:** Can fix incrementally

---

## 10. Migration Priority Matrix

### P0 - BLOCKER (Must Fix Before ANY PR Workflow)

**Timeline:** Before enabling branch protection

| Priority | Component | File | Lines | Effort | Risk |
|----------|-----------|------|-------|--------|------|
| P0-1 | Pre-commit Hook | `.husky/pre-commit` | 1-5 | 30min | High |
| P0-2 | GitHub Protection | GitHub Settings | N/A | 15min | High |
| P0-3 | CLAUDE.md | `CLAUDE.md` | ~400 | 1hr | Medium |
| P0-4 | Tech Lead Agent | `.claude/agents/engineering/tech-lead.md` | 1194+ | 2hrs | High |
| P0-5 | Commit Command | `.claude/commands/git/commit.md` | 405+ | 2hrs | High |
| P0-6 | Git Commit Helper Skill | `.claude/skills/git/git-commit-helper.md` | 413+ | 2hrs | High |
| P0-7 | Quality Check Command | `.claude/commands/quality-check.md` | 500+ | 2hrs | High |
| P0-8 | Atomic Task Workflow | `.claude/docs/workflows/atomic-task-protocol.md` | 100+ | 2hrs | High |
| P0-9 | Phase 2 Workflow | `.claude/docs/workflows/phase-2-implementation.md` | N/A | 1hr | High |
| P0-10 | Phase 4 Workflow | `.claude/docs/workflows/phase-4-finalization.md` | 100+ | 2hrs | High |
| P0-11 | Task Completion Protocol | `.claude/docs/workflows/task-completion-protocol.md` | 100+ | 1hr | High |

**Subtotal P0:** 16 hours

### P1 - HIGH (Should Fix in First Week)

**Timeline:** Week 1 after branch protection enabled

| Priority | Component | File | Effort |
|----------|-----------|------|--------|
| P1-1 | Product Technical Agent | `.claude/agents/product/product-technical.md` | 1hr |
| P1-2 | QA Engineer Agent | `.claude/agents/quality/qa-engineer.md` | 1hr |
| P1-3 | Hono Engineer Agent | `.claude/agents/engineering/hono-engineer.md` | 1hr |
| P1-4 | DB Engineer Agent | `.claude/agents/engineering/db-drizzle-engineer.md` | 1hr |
| P1-5 | Astro Engineer Agent | `.claude/agents/engineering/astro-engineer.md` | 1hr |
| P1-6 | TanStack Engineer Agent | `.claude/agents/engineering/tanstack-start-engineer.md` | 1hr |
| P1-7 | React Dev Agent | `.claude/agents/engineering/react-senior-dev.md` | 1hr |
| P1-8 | Node TS Engineer Agent | `.claude/agents/engineering/node-typescript-engineer.md` | 1hr |
| P1-9 | Start Feature Plan Command | `.claude/commands/start-feature-plan.md` | 1hr |
| P1-10 | Start Refactor Plan Command | `.claude/commands/start-refactor-plan.md` | 1hr |
| P1-11 | Sync Planning Command | `.claude/commands/sync-planning.md` | 1hr |
| P1-12 | Code Check Command | `.claude/commands/code-check.md` | 30min |
| P1-13 | Phase 1 Workflow | `.claude/docs/workflows/phase-1-planning.md` | 1hr |
| P1-14 | Phase 3 Workflow | `.claude/docs/workflows/phase-3-validation.md` | 1hr |
| P1-15 | Quick Fix Workflow | `.claude/docs/workflows/quick-fix-protocol.md` | 1hr |
| P1-16 | Code Standards | `.claude/docs/standards/code-standards.md` | 1hr |
| P1-17 | README.md | `README.md` | 1hr |
| P1-18 | Health Check Script | `.claude/scripts/health-check.sh` | 30min |
| P1-19 | Planning Scripts | `scripts/planning-*.ts` | 2hrs |
| P1-20 | GitHub Workflow Scripts | `packages/github-workflow/src/**/*.ts` | 2hrs |
| P1-21 | Pre-push Hook | `.husky/pre-push` (NEW) | 1hr |
| P1-22 | Git Config | `.git/config` | 15min |

**Subtotal P1:** 24 hours

### P2 - MEDIUM (Can Fix Incrementally)

**Timeline:** Weeks 2-4

| Priority | Component | File | Effort |
|----------|-----------|------|--------|
| P2-1 | Product Functional Agent | `.claude/agents/product/product-functional.md` | 30min |
| P2-2 | Tech Writer Agent | `.claude/agents/specialized/tech-writer.md` | 30min |
| P2-3 | Debugger Agent | `.claude/agents/quality/debugger.md` | 30min |
| P2-4 | Add New Entity Command | `.claude/commands/add-new-entity.md` | 30min |
| P2-5 | Update Docs Command | `.claude/commands/update-docs.md` | 30min |
| P2-6 | Run Tests Command | `.claude/commands/run-tests.md` | 30min |
| P2-7 | All QA Skills | `.claude/skills/qa/*.md` | 1hr |
| P2-8 | All Testing Skills | `.claude/skills/testing/*.md` | 1hr |
| P2-9 | Vercel Specialist Skill | `.claude/skills/tech/vercel-specialist.md` | 30min |
| P2-10 | Task Atomization Workflow | `.claude/docs/workflows/task-atomization.md` | 30min |
| P2-11 | Decision Tree Workflow | `.claude/docs/workflows/decision-tree.md` | 1hr |
| P2-12 | Testing Standards | `.claude/docs/standards/testing-standards.md` | 1hr |
| P2-13 | Package.json Scripts | `package.json` | 30min |
| P2-14 | Worktree Cleanup Script | `.claude/scripts/worktree-cleanup.sh` | 30min |
| P2-15 | Post-checkout Hook | `.husky/post-checkout` | 30min |
| P2-16 | Gitignore | `.gitignore` | 15min |
| P2-17 | Generate API Prod Script | `scripts/generate-api-prod-package.ts` | 30min |
| P2-18 | Package CLAUDE.md Files | `apps/*/CLAUDE.md`, `packages/*/CLAUDE.md` | 2hrs |

**Subtotal P2:** 13 hours

### P3 - LOW (Nice to Have, Non-Blocking)

**Timeline:** Ongoing

| Priority | Component | Effort |
|----------|-----------|--------|
| P3-1 | UX UI Designer Agent | 30min |
| P3-2 | i18n Specialist Agent | 15min |
| P3-3 | Five Why Command | 15min |
| P3-4 | Markdown Formatter Skill | 15min |
| P3-5 | Error Handling Patterns Skill | 15min |
| P3-6 | TDD Methodology Skill | 15min |
| P3-7 | Architecture Patterns Docs | 15min |
| P3-8 | On-notification Hook | 0min (no change) |
| P3-9 | Format Markdown Script | 30min |
| P3-10 | Sync Registry Script | 0min (no change) |
| P3-11 | Commit-msg Hook | 0min (no change) |

**Subtotal P3:** 3 hours

---

## 11. Estimated Effort Summary

### By Priority

| Priority | Items | Total Hours | Timeline |
|----------|-------|-------------|----------|
| P0 (Blockers) | 11 | 16 hrs | Before branch protection |
| P1 (High) | 22 | 24 hrs | Week 1 |
| P2 (Medium) | 18 | 13 hrs | Weeks 2-4 |
| P3 (Low) | 11 | 3 hrs | Ongoing |
| **TOTAL** | **62** | **56 hrs** | 1 month |

### By Component Type

| Component | Files | Hours |
|-----------|-------|-------|
| Agents | 15 | 17 hrs |
| Commands | 10 | 13 hrs |
| Skills | 7 | 5 hrs |
| Workflows | 10 | 12 hrs |
| Scripts | 8 | 5 hrs |
| Git Hooks | 3 | 2 hrs |
| Documentation | 5 | 4 hrs |
| Configuration | 4 | 1 hr |
| **TOTAL** | **62** | **59 hrs** |

### By Risk Level

| Risk | Files | Hours | Impact |
|------|-------|-------|--------|
| High | 15 | 22 hrs | Breaking changes |
| Medium | 35 | 28 hrs | Workflow confusion |
| Low | 12 | 9 hrs | Edge cases |
| **TOTAL** | **62** | **59 hrs** | |

---

## 12. Rollout Plan

### Phase 0: Preparation (Week 0 - Before Migration)

**Duration:** 1 week
**Goal:** Test changes in isolation

**Steps:**

1. **Create Migration Branch**
   ```bash
   git checkout -b migration/pr-workflow-enforcement main
   ```

2. **Implement P0 Changes**
   - All P0 items from priority matrix
   - Test in migration branch

3. **Communication**
   - Announce upcoming workflow change to team
   - Share new workflow documentation
   - Schedule training session

4. **Create Test PR**
   - Test entire workflow in migration branch
   - Verify all changes work correctly

**Deliverables:**

- [ ] All P0 changes implemented in migration branch
- [ ] Migration tested with test PR
- [ ] Team notified of changes
- [ ] Documentation reviewed

### Phase 1: Soft Launch (Week 1)

**Duration:** 3-5 days
**Goal:** Merge changes without enforcement

**Steps:**

1. **Merge Migration Branch**

   ```bash
   # Review PR
   gh pr create \
     --title "feat(workflow): implement PR-based workflow with worktrees" \
     --body "See migration-analysis.md for full details"

   # After approval and CI pass
   gh pr merge --squash
   ```

2. **Update Documentation** (Already in PR)
   - CLAUDE.md
   - README.md
   - All workflow docs

3. **No Enforcement Yet**
   - Branch protection NOT enabled
   - Pre-commit hook NOT blocking main
   - Allows testing without breaking workflow

4. **Monitor Adoption**
   - Watch for questions
   - Provide support
   - Fix issues quickly

**Deliverables:**

- [ ] Migration PR merged
- [ ] All docs updated
- [ ] Team using new workflow (voluntarily)
- [ ] No major issues reported

### Phase 2: Hard Launch (Week 2)

**Duration:** 1 day
**Goal:** Enable enforcement

**Steps:**

1. **Enable Pre-commit Hook Enforcement**
   - Update `.husky/pre-commit` to exit 1 (not just warn)
   - Test locally

2. **Enable GitHub Branch Protection**
   - Configure protection rules on main branch
   - Require PR reviews
   - Require status checks

3. **Announce Enforcement**

   ```text
   🚨 IMPORTANT: Branch Protection Now Active

   Starting today:
   - Direct commits to main are BLOCKED
   - All changes must go through PRs
   - Pre-commit hook will prevent main commits

   Questions? See: .claude/docs/guides/pr-workflow.md
   Need help? Ask in #dev-help
   ```

4. **Monitor First Day**
   - Watch for confusion
   - Answer questions quickly
   - Document common issues

**Deliverables:**

- [ ] Branch protection enabled
- [ ] Hook enforcement active
- [ ] Team announcement sent
- [ ] First day monitoring complete

### Phase 3: Stabilization (Weeks 2-4)

**Duration:** 2-3 weeks
**Goal:** Fix issues, optimize workflow

**Steps:**

1. **Implement P1 Changes**
   - Update remaining agents
   - Update remaining commands
   - Update remaining workflows

2. **Collect Feedback**
   - What's working?
   - What's confusing?
   - What's slow?

3. **Optimize**
   - Fix workflow bottlenecks
   - Improve documentation
   - Add shortcuts/aliases

4. **Implement P2 Changes**
   - Update remaining skills
   - Update remaining docs
   - Polish edge cases

**Deliverables:**

- [ ] All P1 changes completed
- [ ] Feedback collected and addressed
- [ ] Workflow optimized
- [ ] Most P2 changes completed

### Phase 4: Completion (Week 4+)

**Duration:** Ongoing
**Goal:** Full migration complete

**Steps:**

1. **Implement P3 Changes**
   - Low priority updates
   - Nice-to-have improvements

2. **Document Learnings**
   - Add to `.claude/docs/learnings/`
   - Update CLAUDE.md recent learnings
   - Share best practices

3. **Final Review**
   - Audit all changes
   - Verify nothing missed
   - Update this document

4. **Close Migration**
   - Mark migration complete
   - Archive migration docs
   - Celebrate! 🎉

**Deliverables:**

- [ ] All changes complete
- [ ] Learnings documented
- [ ] Migration archived
- [ ] Team proficient with new workflow

---

## 13. Validation Checklist

### Pre-Migration Validation

Before starting migration:

- [ ] Read and understand entire migration-analysis.md
- [ ] P0 priority items identified and understood
- [ ] Team notified of upcoming changes
- [ ] Backup/branch created for testing
- [ ] Test environment available

### Post-P0 Implementation Validation

After implementing P0 blockers:

- [ ] Pre-commit hook blocks main commits
- [ ] Pre-commit hook suggests worktree creation
- [ ] GitHub branch protection configured
- [ ] CLAUDE.md updated with PR workflow
- [ ] Tech Lead agent updated
- [ ] Commit command updated
- [ ] Git commit helper skill updated
- [ ] Quality check command updated
- [ ] Atomic task workflow updated
- [ ] Phase 2 workflow updated
- [ ] Phase 4 workflow updated
- [ ] Task completion protocol updated
- [ ] Test PR created successfully
- [ ] Test PR merged successfully
- [ ] Worktree cleanup works

### Post-P1 Implementation Validation

After implementing P1 high priority:

- [ ] All engineering agents updated
- [ ] All planning commands updated
- [ ] Code check command updated
- [ ] Phase 1 workflow updated
- [ ] Phase 3 workflow updated
- [ ] Quick fix workflow updated
- [ ] Code standards updated
- [ ] README.md updated
- [ ] Health check script works in worktrees
- [ ] Planning scripts work in worktrees
- [ ] Pre-push hook works correctly
- [ ] Git config applied

### Post-P2 Implementation Validation

After implementing P2 medium priority:

- [ ] Remaining agents updated
- [ ] Remaining commands updated
- [ ] All skills updated
- [ ] Remaining workflows updated
- [ ] Testing standards updated
- [ ] Package.json scripts updated
- [ ] All scripts work in worktrees
- [ ] All hooks work correctly
- [ ] Gitignore updated
- [ ] Package CLAUDE.md files updated

### Final Migration Validation

Migration complete when:

- [ ] All P0, P1, P2 items completed
- [ ] No direct commits to main possible
- [ ] All PRs go through proper review
- [ ] CI/CD runs on all PRs
- [ ] Worktrees used by all developers
- [ ] No workflow confusion
- [ ] All documentation accurate
- [ ] All scripts work correctly
- [ ] All agents give correct instructions
- [ ] All commands work as expected
- [ ] Team is proficient with workflow
- [ ] No significant issues reported

---

## 14. Risk Mitigation Strategies

### Risk 1: Developers Unable to Work

**Scenario:** Branch protection blocks all work, team stuck

**Probability:** Medium
**Impact:** Critical

**Mitigation:**

1. **Pre-Migration:**
   - Thorough testing in migration branch
   - Clear documentation available
   - Training session conducted

2. **During Migration:**
   - Team lead available for support
   - Slack channel monitored
   - Bypass option documented (`--no-verify`)

3. **Rollback Plan:**

   ```bash
   # Emergency rollback
   # 1. Disable GitHub branch protection
   # 2. Revert pre-commit hook
   git revert <commit-hash>
   git push origin main --no-verify
   ```

### Risk 2: CI/CD Breaks

**Scenario:** GitHub Actions don't trigger on PRs

**Probability:** Low
**Impact:** High

**Mitigation:**

1. **Pre-Migration:**
   - Review all GitHub Actions workflows
   - Ensure triggers include `pull_request`
   - Test with migration PR

2. **During Migration:**
   - Monitor first few PRs closely
   - Verify all checks run
   - Fix issues immediately

3. **Rollback Plan:**
   - Workflow files are version controlled
   - Revert workflow changes if needed

### Risk 3: Worktree Confusion

**Scenario:** Developers don't understand worktrees, make mistakes

**Probability:** High
**Impact:** Medium

**Mitigation:**

1. **Pre-Migration:**
   - Comprehensive documentation (already exists)
   - Training session with examples
   - Quick reference guide

2. **During Migration:**
   - Provide helper scripts (already exist)
   - Create aliases for common operations
   - Support channel for questions

3. **Common Issues Doc:**
   - Document common mistakes
   - Provide solutions
   - Update based on feedback

### Risk 4: Lost Work

**Scenario:** Developer work lost due to worktree issues

**Probability:** Low
**Impact:** Critical

**Mitigation:**

1. **Prevention:**
   - Encourage frequent commits
   - Encourage pushing to remote
   - Git never loses committed work

2. **Recovery:**
   - Git reflog can recover commits
   - Branches never deleted automatically
   - Support for recovery available

3. **Documentation:**
   - Recovery procedures documented
   - Common rescue commands provided

### Risk 5: Performance Issues

**Scenario:** Worktrees cause disk space or performance problems

**Probability:** Low
**Impact:** Medium

**Mitigation:**

1. **Monitoring:**
   - Watch disk space usage
   - Monitor pnpm cache size
   - Track node_modules duplication

2. **Optimization:**
   - pnpm shares packages (already configured)
   - Cleanup script removes old worktrees
   - Guidelines for worktree lifecycle

3. **Limits:**
   - Document recommended max worktrees (3-5)
   - Encourage cleanup after merge
   - Automate cleanup where possible

### Risk 6: Agent Instructions Inconsistent

**Scenario:** Some agents give old instructions, confusion ensues

**Probability:** High
**Impact:** Medium

**Mitigation:**

1. **Systematic Update:**
   - Use priority matrix
   - Update in order (P0 first)
   - Track completion

2. **Verification:**
   - Review each agent after update
   - Test with real scenarios
   - Get feedback from users

3. **Version Markers:**
   - Add "Last Updated" dates to agents
   - Version numbers for major changes
   - Changelog sections

---

## 15. Communication Plan

### Week -1: Pre-Announcement

**Audience:** All developers
**Channel:** Team meeting + Slack

**Message:**

```text
📢 Upcoming Workflow Change: PR-Based Development

Starting <DATE>, we're moving to a PR-based workflow with Git Worktrees.

Why?
- Parallel development of multiple features
- Better code review process
- Automated CI/CD on PRs
- Protected main branch

What changes?
- No more direct commits to main
- All work in feature branch worktrees
- PRs required for all changes

Documentation:
- .claude/docs/guides/pr-workflow.md
- .claude/docs/guides/git-worktrees.md

Training: <DATE> at <TIME>
Questions: #dev-workflow
```

### Week 0: Migration Week

**Day 1 - Soft Launch Announcement:**

```text
✅ PR Workflow Updates Merged

New documentation and scripts are now available:
- Updated CLAUDE.md with PR workflow
- New scripts: worktree-create.sh, worktree-cleanup.sh
- Updated all workflow documentation

Branch protection NOT YET ACTIVE - please start using new workflow voluntarily

Try it out:
  ./.claude/scripts/worktree-create.sh feature/test-pr main
  cd ../hospeda-feature-test-pr
  # make changes
  gh pr create

Feedback: #dev-workflow
```

**Day 3 - Status Update:**

```text
📊 PR Workflow Adoption

✅ <N> developers using worktrees
✅ <N> PRs created with new workflow
⚠️ <N> issues reported (and fixed)

Reminder: Branch protection activates in 2 days
Questions? Ask now in #dev-workflow
```

**Day 5 - Hard Launch Announcement:**

```text
🚨 BRANCH PROTECTION NOW ACTIVE

As of now:
❌ Direct commits to main are BLOCKED
✅ All changes must go through PRs
✅ Pre-commit hook enforces this

If you're on main branch, you'll see:
  ❌ ERROR: Direct commits to main are not allowed
  Please create a feature branch worktree

Emergency bypass (NOT recommended):
  git commit --no-verify

Help needed? #dev-workflow
```

### Week 1-2: Support Period

**Daily Check-ins:**

```text
💬 PR Workflow Check-in - Day <N>

Issues today: <N>
Common questions:
- How to create worktree? → ./.claude/scripts/worktree-create.sh
- How to create PR? → gh pr create
- How to cleanup? → ./.claude/scripts/worktree-cleanup.sh

Still confused? Ask in #dev-workflow
```

### Week 3-4: Stabilization

**Weekly Summary:**

```text
📈 PR Workflow: Week <N> Summary

✅ <N> PRs merged
✅ <N> worktrees active
✅ <N> developers proficient

Top tips:
- Use `wt-create` alias for quick worktree creation
- Remember to run `wt-cleanup` after PR merge
- Link Linear issues in PR body for auto-close

Feedback survey: <link>
```

### Month 1+: Ongoing

**Monthly Retrospective:**

```text
🎉 PR Workflow: Month <N> Retrospective

Stats:
- <N> PRs merged
- <N> issues reported and fixed
- Avg PR review time: <N> hours

What's working well:
- <feedback>

What could improve:
- <feedback>

Keep up the great work! 🚀
```

---

## 16. Success Metrics

### Quantitative Metrics

**Track Weekly:**

| Metric | Target | How to Measure |
|--------|--------|----------------|
| % of changes via PR | 100% | GitHub Insights |
| Direct commits to main | 0 | GitHub commit history |
| Avg PR review time | < 24hrs | GitHub PR data |
| Active worktrees per dev | 1-3 | Survey / `git worktree list` |
| CI/CD success rate on PRs | > 95% | GitHub Actions |
| Test coverage on PRs | > 90% | Coverage reports |

**Track Monthly:**

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Developer satisfaction | > 4/5 | Survey |
| Workflow confusion incidents | < 5/month | Support tickets |
| Lost work incidents | 0 | Support tickets |
| PR-related bugs | < 10/month | Bug tracker |

### Qualitative Metrics

**Track via Surveys:**

- How confident are you with the PR workflow? (1-5)
- How easy is it to create worktrees? (1-5)
- How helpful is the documentation? (1-5)
- What's the biggest pain point?
- What would improve the workflow?

**Track via Observation:**

- Are developers asking questions repeatedly?
- Are there common mistakes?
- Are worktrees being cleaned up?
- Are PRs well-formatted?
- Are CI checks passing?

### Success Criteria

**Migration is successful when:**

- ✅ 100% of changes go through PRs
- ✅ Zero direct commits to main
- ✅ All developers using worktrees
- ✅ No workflow-related incidents
- ✅ Developer satisfaction > 4/5
- ✅ Documentation rated helpful > 4/5
- ✅ CI/CD success rate > 95%
- ✅ All agents give correct instructions
- ✅ All commands work as expected
- ✅ No major issues reported

**Migration is failed if:**

- ❌ Developers bypassing workflow regularly
- ❌ Multiple lost work incidents
- ❌ Developer satisfaction < 3/5
- ❌ High volume of support tickets
- ❌ CI/CD broken
- ❌ Work blocked for >1 day

---

## 17. Appendices

### Appendix A: Quick Reference

#### For Developers

**Creating Feature Branch:**

```bash
./.claude/scripts/worktree-create.sh feature/<name> main
cd ../hospeda-feature-<name>
```

**Committing & Creating PR:**

```bash
git add <files>
git commit -m "feat(scope): description"
git push -u origin feature/<name>
gh pr create
```

**After PR Merged:**

```bash
cd ../hospeda
./.claude/scripts/worktree-cleanup.sh
```

**Emergency Bypass (NOT RECOMMENDED):**

```bash
git commit --no-verify
```

#### For Admins

**Enable Branch Protection:**

GitHub → Settings → Branches → Add rule for `main`

**Disable Branch Protection (Emergency):**

GitHub → Settings → Branches → Delete rule

**Check Who's Blocked:**

Monitor #dev-workflow Slack channel

### Appendix B: Files by Category

#### P0 Blocker Files (11 files)

1. `.husky/pre-commit`
2. GitHub Settings (branch protection)
3. `CLAUDE.md`
4. `.claude/agents/engineering/tech-lead.md`
5. `.claude/commands/git/commit.md`
6. `.claude/skills/git/git-commit-helper.md`
7. `.claude/commands/quality-check.md`
8. `.claude/docs/workflows/atomic-task-protocol.md`
9. `.claude/docs/workflows/phase-2-implementation.md`
10. `.claude/docs/workflows/phase-4-finalization.md`
11. `.claude/docs/workflows/task-completion-protocol.md`

#### P1 High Priority Files (22 files)

12-33. See Priority Matrix section above

#### P2 Medium Priority Files (18 files)

34-51. See Priority Matrix section above

#### P3 Low Priority Files (11 files)

52-62. See Priority Matrix section above

### Appendix C: Git Commands Reference

**Worktree Commands:**

```bash
# Create
git worktree add <path> -b <branch> <base>

# List
git worktree list

# Remove
git worktree remove <path>

# Prune (cleanup deleted)
git worktree prune

# Repair (fix links)
git worktree repair
```

**PR Commands:**

```bash
# Create PR
gh pr create

# Create with details
gh pr create --title "title" --body "body"

# View PR
gh pr view

# Check PR status
gh pr status

# Merge PR
gh pr merge
```

**Branch Commands:**

```bash
# Show current branch
git branch --show-current

# Create branch
git branch <name>

# Delete branch
git branch -d <name>

# Delete remote branch
git push origin --delete <name>
```

### Appendix D: Troubleshooting

**Issue: "Cannot commit to main"**

**Cause:** Pre-commit hook blocking
**Solution:** Create feature worktree

```bash
./.claude/scripts/worktree-create.sh feature/<name> main
cd ../hospeda-feature-<name>
```

**Issue: "Worktree already exists"**

**Cause:** Branch checked out elsewhere
**Solution:** Remove old worktree first

```bash
git worktree list  # Find path
git worktree remove <path>
```

**Issue: "Cannot create PR"**

**Cause:** gh CLI not authenticated
**Solution:** Authenticate

```bash
gh auth login
```

**Issue: "CI checks not running"**

**Cause:** GitHub Actions not configured
**Solution:** Ensure workflow triggers include `pull_request`

**Issue: "Lost changes after switching worktrees"**

**Cause:** Changes not committed
**Solution:** Git never loses committed work

```bash
git reflog  # Find lost commits
git checkout <commit-hash>
```

### Appendix E: Resources

**Internal Documentation:**

- `.claude/docs/guides/pr-workflow.md` - Complete PR workflow guide
- `.claude/docs/guides/git-worktrees.md` - Git worktrees deep dive
- `CLAUDE.md` - Project conventions and rules
- `.claude/docs/workflows/*.md` - Development workflows

**External Resources:**

- [Git Worktrees Official Docs](https://git-scm.com/docs/git-worktree)
- [GitHub CLI Manual](https://cli.github.com/manual/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub Branch Protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)

---

**Migration Analysis Version:** 1.0.0
**Created:** 2025-11-01
**Author:** tech-lead agent
**Related Planning:** P-006-github-actions-ci-cd
**Status:** Ready for Review
