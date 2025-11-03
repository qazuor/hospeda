# CI/CD Lite Documentation

## Overview

CI/CD Lite is a minimal continuous integration setup designed for single-developer projects in pre-alpha stage. It focuses on automated quality checks without the overhead of complex collaboration workflows.

## Components

### 1. GitHub Actions CI Workflow

**File:** `.github/workflows/ci.yml`

**Triggers:**

- Push to `main` branch
- Pull requests to `main` branch

**Checks:**

1. **Type Check** - `pnpm typecheck`
2. **Lint** - `pnpm lint`
3. **Tests** - `pnpm test:coverage`
4. **Coverage Threshold** - Validates ≥90% coverage for all packages

**Coverage Validation:**

The workflow automatically discovers all `coverage-summary.json` files across the monorepo and validates each package independently. It provides:

- Per-package coverage report
- Global average coverage
- Fails if any package falls below 90% threshold

**Runtime:** ~5-10 minutes depending on test suite size

### 2. Renovate Dependency Updates

**File:** `renovate.json`

**Configuration:**

- Runs every weekend
- Creates PRs for dependency updates
- Requires manual review (automerge disabled)
- Groups updates by type (minor, patch, major)
- Limits concurrent PRs to 5

**Setup Required:**

1. Enable Renovate bot in GitHub repository settings
2. Authorize Renovate to access your repository
3. Renovate will automatically pick up the config file

**GitHub Setup:**

```bash
# Go to: https://github.com/apps/renovate
# Click "Configure"
# Select your repository
# Grant permissions
```

### 3. Pre-commit Hooks

**File:** `.husky/pre-commit`

**Configuration:** `package.json` → `lint-staged` section

**Automated Checks:**

1. **TypeScript/TSX files** - Biome check & format
2. **JSON/Markdown files** - Biome format
3. **.claude documentation** - Link validation

**What it does:**

- Runs `lint-staged` on staged files only
- Automatically formats code before commit
- Validates internal documentation links
- Syncs TODO comments with Linear (if configured)

**Installation:**

Already configured via `husky` package. Run once after cloning:

```bash
pnpm install  # Automatically sets up hooks via "prepare" script
```

## Usage

### Running CI Locally

Before pushing, run the same checks that CI will run:

```bash
# Full check suite (what CI runs)
pnpm typecheck && pnpm lint && pnpm test:coverage

# Individual checks
pnpm typecheck        # Type checking
pnpm lint             # Linting
pnpm test             # Tests without coverage
pnpm test:coverage    # Tests with coverage report
```

### Checking Coverage

After running `pnpm test:coverage`, coverage reports are generated in `<package>/coverage/`:

```bash
# View HTML report (opens in browser)
open packages/db/coverage/index.html

# View terminal summary
cat packages/db/coverage/coverage-summary.json
```

### Pre-commit Hook Testing

Test the pre-commit hook without committing:

```bash
# Stage some files
git add <files>

# Run lint-staged manually
pnpm exec lint-staged

# Or run the pre-commit script directly
.husky/pre-commit
```

### Updating Dependencies (Renovate)

When Renovate creates a PR:

1. Review the changes in the PR
2. Check if any breaking changes are noted
3. Run tests locally if needed: `pnpm install && pnpm test`
4. Approve and merge if all checks pass

## Configuration

### Adjusting Coverage Threshold

If you need to temporarily lower the threshold (not recommended):

**Option 1: Individual Package**

Edit `vitest.config.ts` in the package:

```typescript
coverage: {
  thresholds: {
    lines: 85,  // Changed from 90
    // ...
  }
}
```

**Option 2: CI Workflow**

Edit `.github/workflows/ci.yml`, line with `if (( $(echo "$COVERAGE < 90" | bc -l) ));`:

```bash
if (( $(echo "$COVERAGE < 85" | bc -l) )); then  # Changed from 90
```

### Customizing Pre-commit Hooks

Edit `package.json` → `lint-staged` section:

```json
"lint-staged": {
  "*.{ts,tsx}": [
    "biome check --write --no-errors-on-unmatched",
    "pnpm test --related"  // Add: run related tests
  ],
  "*.{json,md}": [
    "biome format --write"
  ]
}
```

### Adjusting Renovate Schedule

Edit `renovate.json`:

```json
{
  "schedule": ["every weekday"],  // Changed from "every weekend"
  "prConcurrentLimit": 10         // Changed from 5
}
```

## Troubleshooting

### CI Workflow Fails

**1. Type Check Failures**

```bash
# Run locally to see errors
pnpm typecheck

# Common fix: update types
pnpm install
```

**2. Lint Failures**

```bash
# Run locally
pnpm lint

# Auto-fix most issues
pnpm check
```

**3. Test Failures**

```bash
# Run tests with verbose output
pnpm test

# Run specific package tests
cd packages/db && pnpm test
```

**4. Coverage Below Threshold**

```bash
# Identify missing coverage
pnpm test:coverage

# View detailed report
open coverage/index.html

# Add tests for uncovered code
```

### Pre-commit Hook Issues

**Hook doesn't run:**

```bash
# Reinstall hooks
pnpm install
```

**Hook runs but fails:**

```bash
# Run manually to see errors
pnpm exec lint-staged

# Skip hook temporarily (not recommended)
git commit --no-verify
```

**lint-staged not found:**

```bash
# Install dependencies
pnpm install
```

### Renovate Issues

**No PRs created:**

- Verify Renovate is enabled in GitHub settings
- Check repository has `renovate.json`
- Wait for scheduled time (weekends by default)

**Too many PRs:**

- Adjust `prConcurrentLimit` in `renovate.json`
- Use `packageRules` to group updates

## Best Practices

### For Developers

1. **Run checks locally before pushing**

   ```bash
   pnpm typecheck && pnpm lint && pnpm test:coverage
   ```

2. **Review Renovate PRs promptly** - Security updates should be merged ASAP

3. **Don't skip pre-commit hooks** - They catch issues early

4. **Maintain 90%+ coverage** - Write tests as you code

5. **Fix CI failures immediately** - Don't let them accumulate

### For Maintainers

1. **Monitor CI workflow execution time** - Optimize if > 10 minutes

2. **Review coverage trends** - Ensure quality doesn't degrade

3. **Keep dependencies updated** - Merge Renovate PRs regularly

4. **Adjust thresholds carefully** - Document reasons for changes

5. **Update documentation** - Keep this README current

## Migration from CI/CD Lite to Full CI/CD

When project grows beyond single developer:

1. **Add branch protection rules**

   - Require PR reviews
   - Require status checks to pass
   - No direct pushes to main

2. **Add deployment workflows**

   - Staging deployment on PR
   - Production deployment on merge
   - Rollback procedures

3. **Expand test matrix**

   - Test on multiple Node versions
   - Test on multiple OS (Ubuntu, Windows, macOS)

4. **Add performance benchmarks**

   - Lighthouse CI
   - Bundle size checks

5. **Add security scanning**
   - CodeQL analysis
   - Dependency vulnerability scanning
   - SAST/DAST tools

## Resources

- [GitHub Actions Documentation](https://docs.github.com/actions)
- [Renovate Documentation](https://docs.renovatebot.com/)
- [Husky Documentation](https://typicode.github.io/husky/)
- [lint-staged Documentation](https://github.com/okonet/lint-staged)
- [Vitest Coverage](https://vitest.dev/guide/coverage.html)

## Changelog

| Date       | Change                                   | Author  |
| ---------- | ---------------------------------------- | ------- |
| 2025-11-03 | Initial CI/CD Lite setup                 | @qazuor |
| 2025-11-03 | Added coverage validation to CI workflow | @qazuor |
| 2025-11-03 | Configured Renovate for dependency mgmt  | @qazuor |
| 2025-11-03 | Simplified pre-commit hooks              | @qazuor |
