# Sync Planning to GitHub

**Purpose**: Synchronizes the current planning session to GitHub Issues, creating a parent issue and sub-issues for all tasks.

## When to Use

- After completing Phase 1: Planning and getting user approval
- When you want to sync planning progress to GitHub for team visibility
- To create trackable issues for the current feature planning
- When working across multiple devices and need centralized tracking

## Process

### Step 1: Identify Planning Session

Ask the user which planning session to sync if not obvious from context.

The session path should be: `.claude/sessions/planning/P-XXX-{feature-name}/`

You can auto-detect the session if the user is currently in a planning directory.

### Step 2: Verify Required Files

Check that the following files exist:

- `PDR.md` - Product Requirements Document
- `TODOs.md` - Tasks breakdown

If files are missing, inform the user and stop.

### Step 3: Get GitHub Configuration

You need the following environment variables:

- `GITHUB_TOKEN` - GitHub Personal Access Token with repo and project permissions
- `GITHUB_OWNER` - Repository owner (e.g., 'hospeda')
- `GITHUB_REPO` - Repository name (e.g., 'main')

Check if these are available in the environment. If not, ask the user to provide them.

### Step 4: Execute Sync

Use the `@repo/github-workflow` package to synchronize:

```typescript
import { executeSyncCommand } from '@repo/github-workflow/commands';

const result = await executeSyncCommand({
  sessionPath: '.claude/sessions/planning/P-XXX-feature-name',
  githubConfig: {
    token: process.env.GITHUB_TOKEN!,
    owner: process.env.GITHUB_OWNER || 'hospeda',
    repo: process.env.GITHUB_REPO || 'main',
  },
  updateExisting: true, // Update existing issues instead of creating duplicates
});
```

### Step 5: Report Results

Present the results to the user in a clear, formatted output:

```
✅ Planning synced to GitHub successfully!

📋 Parent Issue: {result.parentIssue.title}
   URL: {result.parentIssue.url}
   Number: #{result.parentIssue.number}

📊 Statistics:
   • {result.statistics.created} tasks created
   • {result.statistics.updated} tasks updated
   • {result.statistics.skipped} tasks skipped
   • {result.statistics.failed} tasks failed

💡 Next Steps:
   1. TODOs.md has been updated with GitHub issue links
   2. Commit and push the changes (TODOs.md, .github-workflow/tracking.json)
   3. View issues in GitHub: https://github.com/{owner}/{repo}/issues
   4. You can now track progress across all devices
```

### Step 6: Update TODOs.md

The sync process automatically updates `TODOs.md` with GitHub issue links:

```markdown
### T-003-012: Claude Code commands

**Status:** [ ] Pending
**GitHub Issue:** [#123](https://github.com/hospeda/main/issues/123)
```

Inform the user that TODOs.md has been updated and should be committed.

### Step 7: Suggest Next Actions

Remind the user:

1. **Commit changes**: `git add .claude/sessions/planning/P-XXX-* .github-workflow/tracking.json`
2. **Push to remote**: `git push origin main`
3. **View in GitHub**: Issues are now visible in the GitHub Issues tab
4. **Update status**: As you complete tasks, use `/check-completed` to auto-close issues

## Error Handling

### Missing Environment Variables

```
❌ GitHub configuration missing.

Please set the following environment variables:
- GITHUB_TOKEN: Your GitHub Personal Access Token
  → Get it from: https://github.com/settings/tokens
  → Required scopes: repo, project

- GITHUB_OWNER: Repository owner (default: 'hospeda')
- GITHUB_REPO: Repository name (default: 'main')

Add them to your .env file or export them in your shell.
```

### File Not Found

```
❌ Planning files not found at {sessionPath}

Required files:
- PDR.md (Product Requirements Document)
- TODOs.md (Tasks breakdown)

Please ensure you've completed the planning phase first using:
  /start-feature-plan
```

### API Errors

```
❌ Failed to sync with GitHub: {error.message}

Possible causes:
1. Invalid or expired GitHub token
2. Missing repository permissions (need: repo, project)
3. Rate limit exceeded (wait a few minutes)
4. Network connectivity issues

Troubleshooting:
- Verify token: https://github.com/settings/tokens
- Check permissions on repository
- Try again in a few minutes if rate limited
```

### Duplicate Issues

```
⚠️ Some tasks already have GitHub issues.

The sync will UPDATE existing issues instead of creating duplicates.
This is safe and preserves issue history.

Existing issues found:
- T-003-001 → Issue #120
- T-003-002 → Issue #121

Continue with sync? (yes/no)
```

## Advanced Options

### Dry Run Mode

Preview changes without actually creating issues:

```typescript
const result = await executeSyncCommand({
  sessionPath: '...',
  githubConfig: { ... },
  dryRun: true, // Preview only, no actual changes
});
```

### Custom Tracking Path

Use a custom location for tracking data:

```typescript
const result = await executeSyncCommand({
  sessionPath: '...',
  githubConfig: { ... },
  trackingPath: '.custom-tracking/github.json',
});
```

### Skip Existing Issues

Only create new issues, don't update existing ones:

```typescript
const result = await executeSyncCommand({
  sessionPath: '...',
  githubConfig: { ... },
  updateExisting: false, // Skip existing issues
});
```

## Important Notes

- **Idempotent**: You can run sync multiple times safely - existing issues are updated, not duplicated
- **Tracking**: The `.github-workflow/tracking.json` file stores the mapping between tasks and GitHub issues
- **Commit tracking.json**: Always commit this file so syncs work across machines and team members
- **Status sync**: Task status in TODOs.md determines GitHub issue state (open/closed)
- **Enrichment**: Issues are automatically enriched with planning context and implementation hints
- **Labels**: Auto-generated labels based on task type, priority, and phase

## Integration with Other Commands

- **After planning**: Use this command after `/start-feature-plan`
- **Before implementation**: Sync before starting Phase 2: Implementation
- **During work**: Use `/check-completed` after each task completion
- **Code TODOs**: Use `/sync-todos` to sync TODO comments from code
- **Cleanup**: Use `/cleanup-issues` to close stale issues

## Example Workflow

```
User: "I just finished planning P-005 for the AI mockup generation feature. Can you sync it to GitHub?"
Assistant: "I'll sync P-005 to GitHub now."

[Executes sync command]

✅ Planning synced to GitHub successfully\!

📋 Parent Issue: P-005: AI Mockup Generation
   URL: https://github.com/hospeda/main/issues/150
   Number: #150

📊 Statistics:
   • 15 tasks created
   • 0 tasks updated
   • 0 tasks skipped
   • 0 tasks failed

```

---

## Changelog

| Version | Date | Changes | Author | Related |
|---------|------|---------|--------|---------|
| 2.0.0 | 2025-11-01 | GitHub integration (replaces Linear) | @tech-lead | P-003 |
