# Git Hooks Documentation

## Overview

This project uses [Husky](https://typicode.github.io/husky/) to manage Git hooks that automate quality checks and maintain code consistency.

## Available Hooks

### 1. Pre-Commit Hook ⚡

**Purpose**: Ensure code quality before committing

**Location**: `.husky/pre-commit`

**What it does**:

1. **Markdown Formatting** (📝)
   - Auto-formats staged `.md` files
   - Uses `pnpm format:md:claude` for `.claude/` directory
   - Uses `pnpm format:md` for other markdown files

2. **Documentation Validation** (🔍)
   - Validates `.claude/` documentation changes
   - Checks for broken links in markdown files
   - Warns about missing referenced files

3. **Code Linting** (🔍)
   - Runs Biome on staged files
   - Auto-fixes formatting and style issues
   - Re-stages fixed files automatically

4. **TODO Sync** (📝)
   - Syncs TODO comments with GitHub issues
   - Updates issue tracking automatically
   - Continues even if sync fails

**Speed**: ~5-15 seconds (depends on number of staged files)

**Can be skipped**: Yes, with `git commit --no-verify`

---

### 2. Commit-Msg Hook ✅

**Purpose**: Enforce conventional commit format

**Location**: `.husky/commit-msg`

**What it does**:

- Validates commit messages against conventional commits format
- Uses [commitlint](https://commitlint.js.org/)
- Ensures consistency in git history

**Format required**:

```
type(scope): description

[optional body]

[optional footer]
```

**Valid types**:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding/updating tests
- `chore`: Maintenance tasks
- `ci`: CI/CD changes
- `build`: Build system changes
- `revert`: Revert previous commit

**Examples**:

```bash
# ✅ Good
git commit -m "feat(api): add user authentication endpoint"
git commit -m "fix(db): resolve connection timeout issue"
git commit -m "docs(readme): update installation instructions"

# ❌ Bad
git commit -m "fixed stuff"
git commit -m "WIP"
git commit -m "updates"
```

**Speed**: <1 second

**Can be skipped**: Yes, with `git commit --no-verify` (not recommended)

---

### 3. Post-Checkout Hook 🔍

**Purpose**: Verify system consistency after branch changes

**Location**: `.husky/post-checkout`

**What it does**:

1. **Registry Validation**
   - Checks if `.code-registry.json` exists
   - Validates JSON format
   - Reports registry metadata

2. **Staleness Check**
   - Warns if registry is older than 7 days
   - Suggests running `pnpm planning:sync`

3. **Active Sessions**
   - Lists active planning sessions
   - Shows checkpoint information

**Speed**: <2 seconds

**Runs**: Only on branch checkouts (not file checkouts)

**Can be skipped**: No (runs automatically, non-blocking)

---

## Hook Configuration

### Global Configuration

Edit `.huskyrc` to enable/disable hooks:

```bash
# Enable/disable individual hooks
HUSKY_PRE_COMMIT=1      # 1=enabled, 0=disabled
HUSKY_COMMIT_MSG=1
HUSKY_POST_CHECKOUT=1

# Disable all hooks
HUSKY=0
```

### Temporary Disable

**Skip hooks for a single commit**:

```bash
git commit --no-verify -m "your message"
# or short form
git commit -n -m "your message"
```

**Disable all hooks temporarily**:

```bash
export HUSKY=0
git commit -m "your message"
unset HUSKY
```

**Disable all hooks for entire session**:

```bash
# Add to your shell profile (~/.bashrc, ~/.zshrc, etc.)
export HUSKY=0
```

---

## Common Scenarios

### Scenario 1: Quick Fix Commits

If you're making a quick fix and hooks are slowing you down:

```bash
# Option 1: Skip verification
git commit --no-verify -m "fix: quick typo correction"

# Option 2: Temporarily disable in .huskyrc
# Edit .huskyrc and set HUSKY_PRE_COMMIT=0
git commit -m "fix: quick typo correction"
# Don't forget to re-enable!
```

### Scenario 2: Working on Documentation Only

Hooks still run markdown formatting, which is usually what you want:

```bash
# This will auto-format markdown files
git add .claude/docs/new-guide.md
git commit -m "docs: add new workflow guide"
# ✅ Markdown formatted automatically
```

### Scenario 3: Large Refactoring

For large refactorings with many files, hooks may take longer:

```bash
# Option 1: Keep hooks (recommended)
git commit -m "refactor: reorganize service layer"
# Takes ~15-30s but ensures quality

# Option 2: Skip if urgent (not recommended)
git commit --no-verify -m "refactor: reorganize service layer"
# Then run quality checks manually:
pnpm typecheck && pnpm lint && pnpm test
```

### Scenario 4: Registry Out of Sync

If post-checkout warns about stale registry:

```bash
# Update registry for specific session
pnpm planning:sync .claude/sessions/planning/P-004-workflow-optimization/

# Or update all sessions
find .claude/sessions/planning -name "TODOs.md" -exec dirname {} \; | \
  xargs -I {} pnpm planning:sync {}
```

---

## Troubleshooting

### Hook fails with "command not found"

**Symptom**: Hook script fails with `command not found`

**Cause**: Missing dependencies or incorrect PATH

**Solution**:

```bash
# Reinstall dependencies
pnpm install

# Verify Husky installation
ls -la .husky

# Verify hook permissions
chmod +x .husky/*
```

### Markdown formatting keeps changing files

**Symptom**: Markdown files keep getting reformatted on every commit

**Cause**: Inconsistent formatting settings or editor conflicts

**Solution**:

1. Run `pnpm format:md` once manually
2. Commit the formatted files
3. Configure editor to use same Prettier settings

### TODO sync fails

**Symptom**: Pre-commit shows "TODO sync failed"

**Cause**: GitHub API not configured or network issues

**Solution**:

1. Check `.env.local` has `GITHUB_TOKEN`
2. Verify network connection
3. Hook continues anyway (non-blocking)

### Commitlint rejects valid message

**Symptom**: Commit-msg hook rejects your message

**Cause**: Message doesn't follow conventional commits format

**Solution**:

```bash
# Check commitlint config
cat .commitlintrc.json

# Use conventional format
git commit -m "type(scope): description"

# Valid types: feat, fix, docs, style, refactor, perf, test, chore, ci, build, revert
```

---

## Performance Tips

### Optimize Hook Speed

1. **Stage only necessary files**

   ```bash
   # Instead of staging everything
   git add .

   # Stage specific files
   git add src/services/user.service.ts
   ```

2. **Use partial staging**

   ```bash
   # Stage specific hunks
   git add -p
   ```

3. **Disable slow checks in .huskyrc**

   ```bash
   # For development, disable TODO sync if not needed
   # (requires modifying pre-commit hook)
   ```

### When to Skip Hooks

✅ **Reasonable to skip**:

- Emergency hotfixes
- WIP commits on feature branch
- Reverting broken commits
- Testing commit message formats

❌ **Not recommended to skip**:

- Commits to main/master
- Pull request commits
- Release commits
- Shared branch commits

---

## Hook Maintenance

### Adding New Hooks

1. Create hook file in `.husky/`
2. Make it executable: `chmod +x .husky/hook-name`
3. Add to `.huskyrc` configuration
4. Update this documentation
5. Test thoroughly

### Modifying Existing Hooks

1. Edit hook file in `.husky/`
2. Test with sample commits
3. Update `.huskyrc` if new options added
4. Update this documentation
5. Communicate changes to team

### Testing Hooks

```bash
# Test pre-commit
git add some-file.ts
.husky/pre-commit

# Test commit-msg
echo "test message" | .husky/commit-msg .git/COMMIT_EDITMSG

# Test post-checkout
.husky/post-checkout HEAD HEAD 1
```

---

## Best Practices

### DO ✅

- Keep hooks fast (< 15 seconds)
- Make hooks optional/skippable
- Provide clear error messages
- Log what hooks are doing
- Auto-fix issues when possible
- Continue on non-critical failures

### DON'T ❌

- Make hooks mandatory without skip option
- Run long-running operations (> 30s)
- Block commits on external service failures
- Modify files without re-staging them
- Fail silently without error messages
- Run hooks on CI/CD (use proper CI instead)

---

## Related Documentation

- **Conventional Commits**: <https://www.conventionalcommits.org/>
- **Husky Documentation**: <https://typicode.github.io/husky/>
- **Commitlint**: <https://commitlint.js.org/>
- **Project Workflows**: `.claude/docs/workflows/`

---

## Getting Help

If hooks are causing issues:

1. **Check this documentation** for troubleshooting tips
2. **Temporarily disable** hooks with `--no-verify` to unblock yourself
3. **Report issues** to team lead or in project discussions
4. **Update documentation** with solutions you find

---

**Last updated**: 2025-10-31
**Version**: 1.0.0
**Maintained by**: DevOps team
