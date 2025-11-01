# Troubleshooting Guide

Common issues and their solutions for the GitHub Workflow package.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Configuration Issues](#configuration-issues)
- [GitHub Authentication](#github-authentication)
- [Planning Sync Issues](#planning-sync-issues)
- [Git Hooks Issues](#git-hooks-issues)
- [Performance Issues](#performance-issues)
- [Common Error Messages](#common-error-messages)

## Installation Issues

### Package Not Found

**Problem:** `Cannot find module '@repo/github-workflow'`

**Solutions:**

```bash
# 1. Rebuild the package
cd packages/github-workflow
pnpm build

# 2. Reinstall dependencies
pnpm install

# 3. Clear cache and rebuild
rm -rf node_modules/.cache
pnpm install
pnpm build
```

### TypeScript Errors

**Problem:** Type errors when importing the package

**Solutions:**

```bash
# 1. Regenerate type declarations
pnpm --filter=@repo/github-workflow build

# 2. Restart TypeScript server (in VSCode)
# Cmd/Ctrl + Shift + P → "TypeScript: Restart TS Server"

# 3. Check tsconfig.json includes package
# Should have: "references": [{ "path": "./packages/github-workflow" }]
```

## Configuration Issues

### Config File Not Loading

**Problem:** Configuration file is not being read

**Diagnostic:**

```typescript
import { loadConfig } from '@repo/github-workflow/config';

const config = await loadConfig();
console.log('Config loaded from:', config.filepath);
```

**Solutions:**

1. **Check file name** - Must be exactly:

   ```
   .github-workflow.config.ts
   .github-workflow.config.js
   .github-workflowrc.json
   ```

2. **Check location** - Must be in project root

3. **Verify syntax** - TypeScript files must compile:

   ```bash
   npx tsc --noEmit .github-workflow.config.ts
   ```

4. **Try JSON format** - Simpler, less prone to errors:

   ```json
   {
     "github": {
       "token": "${GITHUB_TOKEN}",
       "owner": "hospeda",
       "repo": "main"
     }
   }
   ```

### Environment Variables Not Working

**Problem:** `GITHUB_TOKEN` or other env vars are undefined

**Solutions:**

```bash
# 1. Check .env.local exists
ls -la .env.local

# 2. Verify variables are loaded
node -e "console.log(process.env.GITHUB_TOKEN)"

# 3. Use dotenv explicitly
npm install dotenv
# Add to script: require('dotenv').config({ path: '.env.local' })

# 4. Export variables manually
export GITHUB_TOKEN=ghp_xxx
export GH_OWNER=hospeda
export GH_REPO=main
```

### Validation Errors

**Problem:** `Configuration validation failed`

**Diagnostic:**

```typescript
import { validateConfig } from '@repo/github-workflow/config';

try {
  validateConfig(yourConfig);
} catch (error) {
  console.error(error.errors); // Zod validation errors
}
```

**Common validation errors:**

| Error | Solution |
|-------|----------|
| `github.token: Required` | Set `GITHUB_TOKEN` env var or config file |
| `github.owner: Required` | Set `GH_OWNER` env var |
| `github.repo: Required` | Set `GH_REPO` env var |
| `Invalid hex color` | Use format: `FF0000` (no #) |
| `Invalid project path` | Use glob patterns: `apps/**` |

## GitHub Authentication

### Invalid Token

**Problem:** `Bad credentials` or `401 Unauthorized`

**Diagnostic:**

```bash
# Test token directly
curl -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/user

# Should return your user info
```

**Solutions:**

1. **Regenerate token**
   - Go to [GitHub Settings → Tokens](https://github.com/settings/tokens)
   - Delete old token
   - Create new token with `repo` scope

2. **Check token expiration**
   - Personal Access Tokens can expire
   - Set expiration to "No expiration" or create new token

3. **Verify token scope**
   - Token MUST have `repo` scope
   - Optionally `workflow` scope for GitHub Actions

4. **Update .env.local**

   ```bash
   # Replace with new token
   GITHUB_TOKEN=ghp_new_token_here
   ```

### Rate Limit Exceeded

**Problem:** `API rate limit exceeded`

**Info:**

- Unauthenticated: 60 requests/hour
- Authenticated: 5000 requests/hour

**Solutions:**

```bash
# 1. Check current rate limit
curl -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/rate_limit

# 2. Wait for reset (shown in response)

# 3. Use authenticated requests (requires token)

# 4. Add delays between operations
# Config option: retry.delay = 2000 (2 seconds)
```

### Permission Denied

**Problem:** `Resource not accessible by integration`

**Solutions:**

1. **Check repository access**
   - Go to repository Settings → Collaborators
   - Ensure your account has write access

2. **Check organization permissions**
   - If repo is in organization
   - Organization may restrict token access
   - Admin must enable token access

3. **Verify token scope**
   - Must have `repo` scope (full control)
   - Not just `public_repo`

## Planning Sync Issues

### Planning Session Not Found

**Problem:** `Planning session not found at path`

**Diagnostic:**

```bash
# Check session structure
ls -la .claude/sessions/planning/P-001-feature/

# Should have:
# - PDR.md
# - tech-analysis.md
# - TODOs.md
```

**Solutions:**

1. **Verify session path**

   ```typescript
   // Must be absolute or relative to project root
   const sessionPath = join(process.cwd(), '.claude/sessions/planning/P-001');
   ```

2. **Check required files**

   ```bash
   # All three files must exist
   touch .claude/sessions/planning/P-001/PDR.md
   touch .claude/sessions/planning/P-001/tech-analysis.md
   touch .claude/sessions/planning/P-001/TODOs.md
   ```

3. **Verify file permissions**

   ```bash
   chmod 644 .claude/sessions/planning/P-001/*.md
   ```

### TODOs.md Parse Error

**Problem:** `Failed to parse TODOs.md`

**Diagnostic:**

```typescript
import { parseTodosFile } from '@repo/github-workflow/parsers';

try {
  await parseTodosFile('path/to/TODOs.md');
} catch (error) {
  console.error('Parse error:', error.message);
}
```

**Solutions:**

1. **Check markdown format**
   - Must use standard task format
   - Each task must have code: `### T-XXX-XXX:`

2. **Validate structure**

   ```markdown
   ### T-001-001: Task title

   **Status:** [ ] Pending
   **Assignee:** username
   **Estimate:** 4 hours

   **Description:**

   Task description here.
   ```

3. **Check for special characters**
   - Avoid unescaped characters in titles
   - Use standard markdown syntax

### Issues Not Created

**Problem:** Issues don't appear in GitHub

**Diagnostic:**

```typescript
const result = await syncPlanningToGitHub({
  sessionPath: '...',
  githubConfig,
  dryRun: false,
});

console.log('Created:', result.statistics.created);
console.log('Failed:', result.failed);
```

**Solutions:**

1. **Check dry run mode**

   ```typescript
   // Must be false to create issues
   dryRun: false
   ```

2. **Review failed tasks**

   ```typescript
   result.failed.forEach(task => {
     console.log(`${task.taskId}: ${task.error}`);
   });
   ```

3. **Verify GitHub permissions**
   - Token must have `repo` write access
   - Check organization settings

4. **Check rate limiting**
   - May need to add delays between requests

## Git Hooks Issues

### Hooks Not Running

**Problem:** Pre-commit or post-commit hooks don't execute

**Diagnostic:**

```bash
# Check hooks exist
ls -la .husky/

# Should show:
# -rwxr-xr-x pre-commit
# -rwxr-xr-x post-commit
```

**Solutions:**

1. **Install Husky**

   ```bash
   npx husky install
   ```

2. **Make hooks executable**

   ```bash
   chmod +x .husky/pre-commit
   chmod +x .husky/post-commit
   chmod +x .husky/commit-msg
   ```

3. **Verify hook content**

   ```bash
   cat .husky/pre-commit

   # Should contain:
   # #!/usr/bin/env sh
   # . "$(dirname -- "$0")/_/husky.sh"
   # pnpm run pre-commit-checks
   ```

4. **Test hook manually**

   ```bash
   ./.husky/pre-commit

   # Should run linting, type checking, etc.
   ```

5. **Check Husky installation**

   ```bash
   # Reinstall
   npm uninstall husky
   npm install husky --save-dev
   npx husky install
   ```

### Hook Failures Block Commits

**Problem:** Pre-commit hook fails and blocks commit

**Solutions:**

1. **Fix the failing check**

   ```bash
   # Run checks manually
   pnpm run lint
   pnpm run typecheck
   pnpm run test

   # Fix issues before committing
   ```

2. **Skip hook temporarily** (use sparingly!)

   ```bash
   git commit --no-verify -m "message"
   ```

3. **Disable specific check**

   ```typescript
   // .github-workflow.config.ts
   hooks: {
     preCommit: {
       enabled: true,
       checks: ['lint', 'typecheck'], // Removed 'test'
     },
   }
   ```

### Post-Commit Hook Slow

**Problem:** Post-commit hook takes too long

**Solutions:**

1. **Reduce commit scan limit**

   ```typescript
   // Only scan last commit
   commitLimit: 1
   ```

2. **Use silent mode**

   ```typescript
   silent: true  // Reduces logging overhead
   ```

3. **Disable if not needed**

   ```typescript
   hooks: {
     postCommit: {
       enabled: false,
     },
   }
   ```

## Performance Issues

### Slow Planning Sync

**Problem:** Planning sync takes too long

**Solutions:**

1. **Enable caching**

   ```typescript
   // Reuse GitHub client
   const client = new GitHubClient(config);
   ```

2. **Reduce API calls**
   - Check for existing issues first
   - Use batch operations
   - Add delays between requests

3. **Optimize parsing**
   - Use smaller planning sessions
   - Split large sessions

### High Memory Usage

**Problem:** Process uses too much memory

**Solutions:**

1. **Process in batches**

   ```typescript
   // Sync sessions one at a time
   for (const session of sessions) {
     await syncPlanningToGitHub({ sessionPath: session, ... });
   }
   ```

2. **Clear caches**

   ```bash
   rm -rf node_modules/.cache
   ```

3. **Increase Node memory**

   ```bash
   NODE_OPTIONS=--max-old-space-size=4096 pnpm run sync
   ```

## Common Error Messages

### `ENOENT: no such file or directory`

**Cause:** File or directory not found

**Solutions:**

- Verify file path exists
- Use absolute paths
- Check file permissions

### `EACCES: permission denied`

**Cause:** Insufficient permissions

**Solutions:**

```bash
# Fix file permissions
chmod 644 file.md

# Fix directory permissions
chmod 755 directory/
```

### `Cannot find module`

**Cause:** Module not installed or built

**Solutions:**

```bash
pnpm install
pnpm build
```

### `Network request failed`

**Cause:** GitHub API unreachable

**Solutions:**

- Check internet connection
- Verify GitHub status: <https://www.githubstatus.com/>
- Check firewall/proxy settings

### `Invalid token`

**Cause:** GitHub token expired or invalid

**Solutions:**

- Regenerate token
- Update `.env.local`
- Verify token scope

## Getting Help

If none of these solutions work:

1. **Check logs**

   ```bash
   # Enable debug logging
   DEBUG=github-workflow:* pnpm run sync
   ```

2. **Create minimal reproduction**
   - Isolate the issue
   - Create small test case
   - Share relevant code

3. **Create issue**
   - Go to repository issues
   - Use issue template
   - Include:
     - Error message
     - Configuration
     - Steps to reproduce
     - Environment info

4. **Contact team**
   - Hospeda Development Team
   - Slack: #github-workflow

## Useful Diagnostic Commands

```bash
# Check Node version
node --version

# Check pnpm version
pnpm --version

# Check package installation
pnpm ls @repo/github-workflow

# Run package tests
pnpm --filter=@repo/github-workflow test

# Check type errors
pnpm --filter=@repo/github-workflow typecheck

# Verify build
pnpm --filter=@repo/github-workflow build

# Clean and rebuild
pnpm --filter=@repo/github-workflow clean
pnpm --filter=@repo/github-workflow build
```

## See Also

- [Setup Guide](./SETUP.md) - Initial setup
- [Configuration Reference](./CONFIGURATION.md) - All options
- [API Reference](./API.md) - Programmatic usage

---

**Still having issues?** Create an issue with detailed error information.
