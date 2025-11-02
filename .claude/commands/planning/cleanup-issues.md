# Cleanup GitHub Issues

**Purpose**: Clean up stale, closed, or orphaned GitHub issues created by the workflow automation system.

## When to Use

- After completing a major feature or planning session
- To remove stale issues that are no longer relevant
- When cleaning up after cancelled features
- During project maintenance and organization
- Before project milestones or releases

## Process

### Step 1: Identify Cleanup Scope

Determine what to clean up:

- **Closed issues**: Remove issues that have been closed for X days
- **Orphaned issues**: Issues with no corresponding planning session or TODO
- **Stale issues**: Issues with no activity for X days
- **Specific session**: Clean up issues from a specific planning session
- **All issues**: Full cleanup (requires confirmation)

Ask the user which scope to use.

### Step 2: Get GitHub Configuration

You need the following environment variables:

- `GITHUB_TOKEN` - GitHub Personal Access Token
- `GITHUB_OWNER` - Repository owner (default: 'hospeda')
- `GITHUB_REPO` - Repository name (default: 'main')

Check if these are available. If not, ask the user to provide them.

### Step 3: Scan for Cleanup Candidates

Scan GitHub and local tracking for cleanup candidates:

```typescript
import { cleanupGitHubIssues } from '@repo/github-workflow/commands';

const candidates = await cleanupGitHubIssues({
  githubConfig: {
    token: process.env.GITHUB_TOKEN!,
    owner: process.env.GITHUB_OWNER || 'hospeda',
    repo: process.env.GITHUB_REPO || 'main',
  },
  closedDays: 30, // Issues closed >30 days ago
  staleDays: 90, // Issues with no activity for 90 days
  includeOrphaned: true, // Include orphaned issues
  dryRun: true, // Preview first
});
```

### Step 4: Preview Cleanup

Show the user what will be cleaned up:

```
🔍 Cleanup Preview

Issues to be cleaned up:
   • 15 closed issues (closed >30 days ago)
   • 3 stale issues (no activity for >90 days)
   • 2 orphaned issues (no planning session)

📋 Details:

Closed Issues:
   • #120: T-001-005 - Old task from P-001
     Closed: 2024-10-01 (31 days ago)
   • #121: T-001-006 - Completed feature
     Closed: 2024-09-15 (47 days ago)

Stale Issues:
   • #145: TODO in old file (no updates for 92 days)
   • #146: HACK comment (no updates for 95 days)

Orphaned Issues:
   • #150: Task with deleted planning session
   • #151: TODO from removed code

⚠️  WARNING: This will permanently remove issue references from tracking.
The GitHub issues themselves will remain in the repository (can be manually deleted).

Continue with cleanup? (yes/no)
```

### Step 5: Execute Cleanup

If user confirms, proceed with cleanup:

```typescript
const result = await cleanupGitHubIssues({
  githubConfig: { ... },
  closedDays: 30,
  staleDays: 90,
  includeOrphaned: true,
  dryRun: false, // Actually perform cleanup
  archiveIssues: true, // Archive instead of delete
});
```

### Step 6: Report Results

Present cleanup results:

```
✅ Cleanup completed successfully!

📊 Statistics:
   • {result.statistics.removed} issue references removed from tracking
   • {result.statistics.archived} issues archived
   • {result.statistics.skipped} issues skipped
   • {result.statistics.failed} failures

📝 Updated Files:
   • .github-workflow/tracking.json (updated)
   • .github-workflow/tracking-archive.json (archived references)

💡 Next Steps:
   1. Review archived references in tracking-archive.json
   2. Manually delete GitHub issues if needed
   3. Commit updated tracking files
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

### No Issues Found

```
ℹ️  No issues match cleanup criteria.

Criteria used:
- Closed >30 days ago
- No activity for >90 days
- Orphaned issues

Your issue tracker is clean!
```

### Confirmation Required

```
⚠️  Destructive operation requires confirmation.

This will remove {count} issue references from tracking.
Type 'yes' to confirm or 'no' to cancel.

User confirmation: __
```

### API Errors

```
❌ Failed to cleanup issues: {error.message}

Some issues may have been cleaned up before the error.
Check tracking.json for current state.

Troubleshooting:
- Verify GitHub token permissions
- Check network connectivity
- Review error details above
```

## Advanced Options

### Cleanup Specific Session

```typescript
const result = await cleanupGitHubIssues({
  githubConfig: { ... },
  sessionPath: '.claude/sessions/planning/P-001-old-feature',
  force: true, // Skip confirmation
});
```

### Archive Instead of Delete

```typescript
const result = await cleanupGitHubIssues({
  githubConfig: { ... },
  closedDays: 30,
  archiveIssues: true, // Move to archive instead of delete
});
```

### Custom Time Ranges

```typescript
const result = await cleanupGitHubIssues({
  githubConfig: { ... },
  closedDays: 7, // More aggressive cleanup
  staleDays: 60, // Shorter stale threshold
});
```

### Delete GitHub Issues

```typescript
const result = await cleanupGitHubIssues({
  githubConfig: { ... },
  closedDays: 30,
  deleteFromGitHub: true, // Actually delete issues from GitHub
  requireConfirmation: true, // Confirm each deletion
});
```

## Cleanup Strategies

### Conservative Cleanup

For projects with important issue history:

```typescript
const result = await cleanupGitHubIssues({
  githubConfig: { ... },
  closedDays: 180, // 6 months
  staleDays: 365, // 1 year
  includeOrphaned: false, // Keep orphaned issues
  archiveIssues: true, // Archive, don't delete
});
```

### Aggressive Cleanup

For active projects with frequent cleanups:

```typescript
const result = await cleanupGitHubIssues({
  githubConfig: { ... },
  closedDays: 14, // 2 weeks
  staleDays: 30, // 1 month
  includeOrphaned: true,
  deleteFromGitHub: true, // Actually remove from GitHub
});
```

### Orphan-Only Cleanup

Clean up only orphaned issues:

```typescript
const result = await cleanupGitHubIssues({
  githubConfig: { ... },
  orphanedOnly: true, // Only clean orphaned issues
});
```

## Important Notes

- **Dry run first**: Always preview with `dryRun: true` before cleanup
- **Archive by default**: References are archived, not permanently deleted
- **GitHub issues remain**: GitHub issues themselves are not deleted unless specified
- **Recoverable**: Archived references can be restored from `tracking-archive.json`
- **Safe operation**: Will not delete issues with recent activity
- **Backup first**: Consider backing up tracking.json before major cleanups
- **Team coordination**: Coordinate with team before cleaning shared issues

## What Gets Cleaned

### Closed Issues

Issues that meet ALL criteria:

- Issue is closed
- Closed more than X days ago (configurable)
- No recent comments or updates
- Not pinned or locked

### Stale Issues

Issues that meet ALL criteria:

- Issue is open
- No activity for X days (configurable)
- Not labeled as `keep` or `important`
- Not assigned to active milestone

### Orphaned Issues

Issues that meet ANY criteria:

- Planning session no longer exists
- TODO comment removed from code
- Tracking reference corrupted
- Source file deleted

## Integration with Other Commands

- **After completion**: Run after project completion
- **Before milestones**: Clean up before releases
- **With sync**: Run after `/sync-planning` or `/sync-todos` to remove old issues
- **Maintenance**: Regular cleanup as part of project maintenance

## Example Workflow

```
User: "The P-001 feature is complete and deployed. Can you clean up the old issues?"
Assistant: "I'll analyze the P-001 issues and clean up closed/stale ones."

[Executes cleanup with dry-run first]

🔍 Found 12 issues to clean up:
   • 10 closed >30 days ago
   • 2 orphaned (session deleted)

Proceed with cleanup? (yes/no)

User: "yes"

[Executes cleanup]

✅ Cleanup completed successfully\!

📊 Statistics:
   • 12 issue references removed from tracking
   • 12 references archived

```

---

## Changelog

| Version | Date | Changes | Author | Related |
|---------|------|---------|--------|---------|
| 1.0.0 | 2025-11-01 | Initial version for GitHub integration | @tech-lead | P-003 |
