# Sync Code TODOs to GitHub

**Purpose**: Scans the codebase for TODO/HACK/DEBUG comments and synchronizes them to GitHub Issues for team visibility and tracking.

## When to Use

- Before committing code with new TODO/HACK/DEBUG comments
- To convert technical debt markers into trackable issues
- When you want team visibility on code-level tasks
- As part of the pre-commit hook (automated)
- When reviewing technical debt across the codebase

## Process

### Step 1: Identify Scan Scope

Determine what to scan:

- **Full codebase**: Scan all files for TODO comments
- **Specific directory**: Scan only a package/app (e.g., `packages/github-workflow`)
- **Changed files**: Scan only git-modified files (recommended for pre-commit)

Ask the user which scope to use if not obvious from context.

### Step 2: Get GitHub Configuration

You need the following environment variables:

- `GITHUB_TOKEN` - GitHub Personal Access Token
- `GITHUB_OWNER` - Repository owner (default: 'hospeda')
- `GITHUB_REPO` - Repository name (default: 'main')

Check if these are available. If not, ask the user to provide them.

### Step 3: Scan for TODOs

Scan the codebase for comments matching these patterns:

```typescript
// TODO: Description of task
// TODO(username): Assigned task
// TODO[HIGH]: High priority task
// TODO: #bug Task with label
// HACK: Temporary workaround
// DEBUG: Remove before production
```

### Step 4: Execute Sync

Use the `@repo/github-workflow` package to synchronize:

```typescript
import { syncTodosToGitHub } from '@repo/github-workflow/sync';

const result = await syncTodosToGitHub({
  scanPath: process.cwd(), // Or specific directory
  githubConfig: {
    token: process.env.GITHUB_TOKEN!,
    owner: process.env.GITHUB_OWNER || 'hospeda',
    repo: process.env.GITHUB_REPO || 'main',
  },
  updateComments: true, // Add GitHub issue links to TODO comments
  closeRemoved: true, // Close issues for removed TODOs
});
```

### Step 5: Report Results

Present results to user in a clear format:

```
✅ TODOs synced to GitHub successfully!

📊 Statistics:
   • {result.statistics.created} new issues created
   • {result.statistics.updated} issues updated
   • {result.statistics.closed} issues closed (TODOs removed)
   • {result.statistics.skipped} issues skipped (no changes)
   • {result.statistics.failed} failures

📝 Created Issues:
   • Issue #151: Fix authentication error handling (TODO in auth.ts:42)
   • Issue #152: Optimize database query (HACK in user.model.ts:78)
   • Issue #153: Remove debug logging (DEBUG in logger.ts:120)

🔗 Updated Comments:
   Comments have been updated with GitHub issue links:
   // TODO: Fix auth error handling
   // GitHub: https://github.com/hospeda/main/issues/151

💡 Next Steps:
   1. Review created issues in GitHub
   2. Commit updated files (comments now have issue links)
   3. Use /check-completed when TODOs are resolved
```

### Step 6: Update Code Comments

The sync process automatically adds GitHub issue links to TODO comments:

**Before:**

```typescript
// TODO: Fix authentication error handling
function authenticate() { ... }
```

**After:**

```typescript
// TODO: Fix authentication error handling
// GitHub: https://github.com/hospeda/main/issues/151
function authenticate() { ... }
```

### Step 7: Handle Removed TODOs

When TODOs are removed from code, the sync automatically closes corresponding GitHub issues:

```
🔒 Closed Issues (TODOs removed):
   • Issue #148: Old TODO that was completed
   • Issue #149: HACK that was refactored
```

## Error Handling

### Missing Environment Variables

```
❌ GitHub configuration missing.

Required environment variables:
- GITHUB_TOKEN: Your GitHub Personal Access Token
- GITHUB_OWNER: Repository owner (default: 'hospeda')
- GITHUB_REPO: Repository name (default: 'main')

Get token from: https://github.com/settings/tokens
Required scopes: repo, project
```

### No TODOs Found

```
ℹ️  No TODO/HACK/DEBUG comments found in scan path: {scanPath}

This could mean:
1. Codebase is clean (no technical debt markers)
2. Scan path is incorrect
3. Comments don't match expected patterns

Expected patterns:
- // TODO: Description
- // HACK: Description
- // DEBUG: Description
```

### API Errors

```
❌ Failed to sync TODOs to GitHub: {error.message}

Troubleshooting:
- Verify GitHub token is valid
- Check repository permissions
- Ensure rate limits not exceeded
- Verify network connectivity
```

### Parse Errors

```
⚠️ Failed to parse some files:

Files with errors:
- packages/api/broken.ts (line 45): Syntax error
- packages/db/invalid.ts: Invalid encoding

TODOs in these files were skipped.
Fix syntax errors and re-run sync.
```

## Advanced Options

### Scan Specific Directory

```typescript
const result = await syncTodosToGitHub({
  scanPath: 'packages/github-workflow', // Only scan this package
  githubConfig: { ... },
});
```

### Dry Run Mode

```typescript
const result = await syncTodosToGitHub({
  scanPath: process.cwd(),
  githubConfig: { ... },
  dryRun: true, // Preview changes without creating issues
});
```

### Custom File Patterns

```typescript
const result = await syncTodosToGitHub({
  scanPath: process.cwd(),
  githubConfig: { ... },
  include: ['**/*.ts', '**/*.tsx'], // Only TypeScript files
  exclude: ['**/node_modules/**', '**/dist/**'], // Exclude patterns
});
```

### Preserve Manual Edits

```typescript
const result = await syncTodosToGitHub({
  scanPath: process.cwd(),
  githubConfig: { ... },
  updateComments: false, // Don't modify code comments
});
```

## Important Notes

- **Automatic labels**: Issues are auto-labeled based on comment type (TODO, HACK, DEBUG)
- **Priority detection**: `[HIGH]`, `[MEDIUM]`, `[LOW]` markers become priority labels
- **Assignment**: `TODO(username)` auto-assigns the issue to that user
- **Labels**: `#bug`, `#feature` markers become issue labels
- **Context**: Issues include code snippet, file path, and line number
- **Tracking**: Uses `.github-workflow/tracking.json` to map comments to issues
- **Safe updates**: Existing issues are updated, not duplicated
- **Auto-close**: Issues auto-close when TODOs are removed from code

## Comment Format Guidelines

### Basic TODO

```typescript
// TODO: Add input validation
```

### With Priority

```typescript
// TODO[HIGH]: Fix critical security issue
```

### With Assignment

```typescript
// TODO(john): Review and optimize this query
```

### With Labels

```typescript
// TODO: #bug #security Fix SQL injection vulnerability
```

### Combined

```typescript
// TODO[HIGH](maria): #feature Add authentication middleware
```

### HACK Comments

```typescript
// HACK: Temporary workaround until API v2 is ready
// This should be refactored when we upgrade
```

### DEBUG Comments

```typescript
// DEBUG: Remove this console.log before production
console.log('User data:', user);
```

## Integration with Other Commands

- **Pre-commit hook**: Automatically sync on commit (see `/husky-hooks`)
- **After coding**: Run manually after adding TODOs
- **With planning**: Complements `/sync-planning` for complete task tracking
- **Before cleanup**: Run before `/cleanup-issues` to update status

## Example Workflow

```
User: "I added some TODOs in the authentication code. Can you sync them to GitHub?"
Assistant: "I'll scan for TODOs in the authentication module."

[Executes sync command]

✅ TODOs synced to GitHub successfully\!

📊 Statistics:
   • 3 new issues created
   • 1 issue updated
   • 0 issues closed

```

---

## Changelog

| Version | Date | Changes | Author | Related |
|---------|------|---------|--------|---------|
| 1.0.0 | 2025-11-01 | Initial version for GitHub integration | @tech-lead | P-003 |
