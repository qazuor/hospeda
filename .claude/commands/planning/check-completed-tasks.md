# Check Completed Tasks

**Purpose**: Automatically detect completed tasks from recent git commits and close corresponding GitHub issues.

## When to Use

- After committing code that completes a task
- As part of the post-commit hook (automated)
- To bulk-check completions from recent commits
- When reviewing project progress
- Before project status meetings

## Process

### Step 1: Determine Scan Range

Decide which commits to analyze:

- **Last commit**: Check only the most recent commit
- **Last N commits**: Check recent N commits (e.g., last 10)
- **Since date**: Check all commits since a specific date
- **Commit range**: Check specific range (e.g., `HEAD~5..HEAD`)

Ask the user which range to use if not obvious from context.

### Step 2: Get GitHub Configuration

You need the following environment variables:

- `GITHUB_TOKEN` - GitHub Personal Access Token
- `GITHUB_OWNER` - Repository owner (default: 'hospeda')
- `GITHUB_REPO` - Repository name (default: 'main')

Check if these are available. If not, ask the user to provide them.

### Step 3: Parse Commit Messages

Scan commit messages for task codes matching patterns:

```
feat(api): implement user authentication [T-003-012]
fix(db): resolve connection timeout issue T-005-003
refactor: optimize query performance (T-002-007)
```

Supported formats:

- `[T-XXX-XXX]` - Bracketed task code
- `T-XXX-XXX` - Bare task code
- `(T-XXX-XXX)` - Parenthesized task code

### Step 4: Execute Detection

Use the `@repo/github-workflow` package:

```typescript
import { detectCompletedTasks } from '@repo/github-workflow/sync';

const result = await detectCompletedTasks({
  commitRange: 'HEAD~10..HEAD', // Or specific range
  sessionPath: '.claude/sessions/planning/P-003-*', // Optional: specific session
  githubConfig: {
    token: process.env.GITHUB_TOKEN!,
    owner: process.env.GITHUB_OWNER || 'hospeda',
    repo: process.env.GITHUB_REPO || 'main',
  },
  updateTodos: true, // Update TODOs.md with completion status
  closeIssues: true, // Close corresponding GitHub issues
});
```

### Step 5: Report Results

Present results in a clear format:

```
✅ Completed tasks detected successfully!

📊 Statistics:
   • {result.statistics.detected} tasks detected in commits
   • {result.statistics.completed} tasks marked as completed
   • {result.statistics.closed} GitHub issues closed
   • {result.statistics.failed} failures

✨ Completed Tasks:
   • T-003-012: Claude Code commands
     Commit: feat(commands): add planning sync command (a1b2c3d)
     Issue: #151 (closed)

   • T-003-018: Label management system
     Commit: feat(sync): implement auto-labeling (d4e5f6g)
     Issue: #152 (closed)

📝 Updated Files:
   • .claude/sessions/planning/P-003-*/TODOs.md
   • .github-workflow/tracking.json

💡 Next Steps:
   1. Review closed issues in GitHub
   2. Commit updated TODOs.md with completion markers
   3. Continue with next pending tasks
```

### Step 6: Update TODOs.md

The detection automatically updates task status in `TODOs.md`:

**Before:**

```markdown
### T-003-012: Claude Code commands

**Status:** [ ] Pending
**GitHub Issue:** [#151](https://github.com/hospeda/main/issues/151)
```

**After:**

```markdown
### T-003-012: Claude Code commands

**Status:** [x] Completed
**Completed:** 2025-11-01
**GitHub Issue:** [#151](https://github.com/hospeda/main/issues/151) ✓ Closed
```

### Step 7: Close GitHub Issues

Corresponding GitHub issues are automatically closed with a completion comment:

```
🎉 Task completed!

This task was completed in commit: a1b2c3d
Commit message: feat(commands): add planning sync command

Automatically detected and closed by GitHub Workflow Automation.
```

## Error Handling

### Missing Environment Variables

```
❌ GitHub configuration missing.

Required environment variables:
- GITHUB_TOKEN: GitHub Personal Access Token
- GITHUB_OWNER: Repository owner
- GITHUB_REPO: Repository name

Set these in your .env file.
```

### No Tasks Detected

```
ℹ️  No completed tasks found in commit range: {commitRange}

This could mean:
1. No commits contain task codes
2. All detected tasks were already completed
3. Commit range is empty

Tip: Include task codes in commit messages:
  git commit -m "feat: implement feature [T-XXX-XXX]"
```

### API Errors

```
❌ Failed to close GitHub issues: {error.message}

Tasks were marked as completed in TODOs.md, but GitHub sync failed.
Re-run this command to retry closing issues.
```

### File Not Found

```
❌ Planning session not found for task {taskCode}

The task code was found in commits, but the corresponding
planning session could not be located.

Expected path: .claude/sessions/planning/P-XXX-*/TODOs.md
```

## Advanced Options

### Scan Specific Session

```typescript
const result = await detectCompletedTasks({
  commitRange: 'HEAD~10..HEAD',
  sessionPath: '.claude/sessions/planning/P-003-planning-automation', // Specific session only
  githubConfig: { ... },
});
```

### Dry Run Mode

```typescript
const result = await detectCompletedTasks({
  commitRange: 'HEAD~10..HEAD',
  githubConfig: { ... },
  dryRun: true, // Preview changes without updating files/issues
});
```

### Skip TODOs Update

```typescript
const result = await detectCompletedTasks({
  commitRange: 'HEAD~10..HEAD',
  githubConfig: { ... },
  updateTodos: false, // Only close GitHub issues, don't modify TODOs.md
});
```

### Skip Issue Closure

```typescript
const result = await detectCompletedTasks({
  commitRange: 'HEAD~10..HEAD',
  githubConfig: { ... },
  closeIssues: false, // Only update TODOs.md, don't close GitHub issues
});
```

## Commit Message Best Practices

### Include Task Code

Always include the task code in commits that complete tasks:

```bash
git commit -m "feat(api): implement authentication [T-003-012]"
```

### Conventional Commits Format

Use conventional commits with task codes:

```bash
git commit -m "feat(api): add user endpoints [T-005-001]"
git commit -m "fix(db): resolve connection issue [T-005-002]"
git commit -m "refactor(core): optimize performance [T-005-003]"
```

### Multiple Tasks

If a commit completes multiple tasks:

```bash
git commit -m "feat(api): implement complete auth flow [T-003-012][T-003-013]"
```

### Partial Completion

For partial progress (don't auto-close):

```bash
git commit -m "wip(api): partial auth implementation (T-003-012)"
# Using 'wip' or '(code)' won't trigger auto-completion
```

## Important Notes

- **Automatic detection**: Runs automatically via post-commit hook if configured
- **Idempotent**: Safe to run multiple times - already completed tasks are skipped
- **Validation**: Verifies required files exist before marking task complete
- **Tracking**: Updates `.github-workflow/tracking.json` with completion data
- **Notifications**: Team members get GitHub notifications when issues close
- **Reversible**: Can manually reopen issues if needed
- **Commit linking**: GitHub issues link back to completion commits

## Integration with Other Commands

- **Post-commit hook**: Automatically runs after each commit
- **After sync**: Use after `/sync-planning` to track progress
- **Before meetings**: Run before standup to update team on progress
- **With TODOs**: Complements `/sync-todos` for complete workflow

## Example Workflow

```
User: "I just committed code that completes T-003-012 and T-003-013. Can you check and close the issues?"
Assistant: "I'll check your recent commits for completed tasks."

[Executes detection command]

✅ Completed tasks detected successfully\!

📊 Statistics:
   • 2 tasks detected in commits
   • 2 tasks marked as completed
   • 2 GitHub issues closed

```

---

## Changelog

| Version | Date | Changes | Author | Related |
|---------|------|---------|--------|---------|
| 1.0.0 | 2025-11-01 | Initial version for GitHub integration | @tech-lead | P-003 |
