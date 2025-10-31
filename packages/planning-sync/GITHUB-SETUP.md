# GitHub Sync Setup Guide

## 1. GitHub Token Configuration

### Required Scopes

Para usar todas las funcionalidades de GitHub sync (Projects v2 y Relationships), tu token necesita estos scopes:

- ✅ `repo` - Full control of private repositories
- ✅ `read:project` - Read access to Projects v2
- ✅ `write:project` - Write access to Projects v2

### How to Update Your Token

1. **Go to GitHub Token Settings**:
   - Navigate to: <https://github.com/settings/tokens>
   - Or: Profile → Settings → Developer settings → Personal access tokens → Tokens (classic)

2. **Create New Token or Edit Existing**:
   - If creating new: Click "Generate new token (classic)"
   - If editing: Click on your existing token → "Regenerate token"

3. **Configure Scopes**:
   - ✅ Check `repo` (this enables all repo sub-scopes)
   - ✅ Scroll down to "project" section
   - ✅ Check `read:project`
   - ✅ Check `write:project`

4. **Generate/Regenerate Token**:
   - Set expiration (recommended: 90 days or custom)
   - Click "Generate token" or "Regenerate token"
   - **IMPORTANT**: Copy the token immediately (you won't see it again)

5. **Update Environment Variable**:

   ```bash
   # In your .env.local file
   GITHUB_TOKEN=ghp_your_new_token_here
   GITHUB_REPO=owner/repo-name
   ```

### Verify Token Permissions

Test your token has correct permissions:

```bash
# Check token scopes
curl -H "Authorization: token YOUR_TOKEN" \
  https://api.github.com/user \
  -I | grep x-oauth-scopes
```

Should show: `repo, read:project, write:project`

---

## 2. Running Sync Command

### ✅ Correct Command (Use This)

From project root:

```bash
export GITHUB_TOKEN="your_token_here" && \
export GITHUB_REPO="owner/repo" && \
node --import tsx/esm packages/planning-sync/src/scripts/planning-sync.ts \
  /absolute/path/to/.claude/sessions/planning/P-XXX-feature-name \
  github
```

**Example**:

```bash
export GITHUB_TOKEN="ghp_abc123..." && \
export GITHUB_REPO="qazuor/hospeda" && \
node --import tsx/esm packages/planning-sync/src/scripts/planning-sync.ts \
  /home/qazuor/projects/WEBS/hospeda/.claude/sessions/planning/P-004-testing-workflow-improvements \
  github
```

### Key Points

1. **Use absolute paths**: Relative paths cause "ENOENT" errors
2. **Use `node --import tsx/esm`**: Other methods (`pnpm exec tsx`, `tsx`) have issues
3. **Export env vars first**: Token and repo must be set before running
4. **Platform parameter**: Add `github` at the end

### ❌ Common Errors to Avoid

**Error 1: Relative paths**

```bash
# ❌ DON'T DO THIS
node --import tsx/esm ... .claude/sessions/planning/P-004...
```

**Error 2: Using pnpm exec tsx**

```bash
# ❌ DON'T DO THIS
pnpm exec tsx packages/planning-sync/...
```

**Error 3: Wrong working directory**

```bash
# ❌ DON'T DO THIS
cd packages/planning-sync && pnpm run planning:sync ...
```

---

## 3. Cleanup Issues (Testing)

### Using GitHub CLI (Recommended)

**Delete all issues** (for testing):

```bash
gh issue list --state all --limit 1000 --json number -q '.[].number' | \
  xargs -I {} gh issue delete {} --yes
```

**Delete only open issues**:

```bash
gh issue list --state open --limit 1000 --json number -q '.[].number' | \
  xargs -I {} gh issue delete {} --yes
```

**Close all issues** (without deleting):

```bash
gh issue list --state open --limit 1000 --json number -q '.[].number' | \
  xargs -I {} gh issue close {}
```

### Using Script (Alternative)

```bash
export GITHUB_TOKEN="your_token" && \
export GITHUB_REPO="owner/repo" && \
pnpm run planning:cleanup true
```

**Note**: Script only closes issues, doesn't delete them (GitHub API limitation).

---

## 4. Complete Workflow

### Initial Setup (Once)

1. Create/update GitHub token with required scopes
2. Add to `.env.local`:

   ```bash
   GITHUB_TOKEN=ghp_your_token
   GITHUB_REPO=owner/repo
   ```

### Testing Workflow

1. **Clean up previous issues**:

   ```bash
   gh issue list --state all --limit 1000 --json number -q '.[].number' | \
     xargs -I {} gh issue delete {} --yes
   ```

2. **Delete sync file** (optional, for fresh sync):

   ```bash
   rm .claude/sessions/planning/P-XXX-feature/.linear-sync.json
   ```

3. **Run sync**:

   ```bash
   export GITHUB_TOKEN="ghp_..." && \
   export GITHUB_REPO="owner/repo" && \
   node --import tsx/esm packages/planning-sync/src/scripts/planning-sync.ts \
     /absolute/path/to/.claude/sessions/planning/P-XXX-feature \
     github
   ```

4. **Verify in GitHub**:
   - Check parent issue has tasklist
   - Check sub-issues link to parent
   - Check issues assigned to project
   - Check labels are applied

---

## 5. Troubleshooting

### Error: "Your token has not been granted the required scopes"

**Cause**: Token missing `read:project` or `write:project` scopes.

**Fix**: Update token scopes (see section 1).

### Error: "ENOENT: no such file or directory"

**Cause**: Using relative path instead of absolute path.

**Fix**: Use absolute path starting with `/home/...` or full path.

### Error: "Could not create/get project: Projects (classic) has been deprecated"

**Cause**: Code is using old Projects Classic API instead of Projects v2.

**Fix**: Ensure you're using latest code with GraphQL implementation.

### Warning: "Could not create GraphQL relationship"

**Cause**: Token permissions insufficient for relationship mutations.

**Fix**:

- Verify token has `repo` scope (full access)
- May need additional scopes (GitHub is unclear about this)
- Falls back to tasklist method (works but less integrated)

---

## 6. Features Status

| Feature | Status | Requirements |
|---------|--------|--------------|
| Create issues | ✅ Working | `repo` scope |
| Auto-detect labels | ✅ Working | `repo` scope |
| Rich summaries | ✅ Working | `repo` scope |
| Projects v2 | ✅ Working | `read:project`, `write:project` scopes |
| Relationships | ⚠️ Partial | `repo` scope (may need more) |
| Tasklist fallback | ✅ Working | `repo` scope |

**Note**: If Projects v2 or Relationships fail, the script uses fallback methods and still creates all issues successfully.

---

## Questions?

Check the main README for more details or create an issue in the repo.
