# Monorepo Command Execution

**Date:** 2024-10-28

**Category:** Monorepo / PNPM / Development

## Problem

Running package-specific commands (lint, typecheck, test) incorrectly leads to:

- Commands not finding workspace dependencies
- Inconsistent environment setup
- Path resolution errors
- Build failures

## Solution

**ALWAYS run package/app commands from project root** using `cd packageName && pnpm run <command>`

**Examples:**

```bash
# ✅ CORRECT - Lint individual package
cd packages/db && pnpm run lint

# ✅ CORRECT - Test individual app
cd apps/api && pnpm run test

# ✅ CORRECT - TypeCheck individual package
cd packages/db && pnpm run typecheck

# ❌ WRONG - Don't use filters for individual checks
pnpm --filter @repo/db run lint  # Doesn't work as expected

# ❌ WRONG - Don't run from package directory
cd packages/db
pnpm run lint  # May fail due to workspace context
```

**When to use from root:**

```bash
# For entire monorepo checks only
pnpm run lint        # All packages/apps
pnpm run typecheck   # All packages/apps
pnpm run test        # All packages/apps
```

## Impact

- **Severity:** High - Causes build/test failures
- **Frequency:** Very common in monorepo development
- **Scope:** All developers
- **Prevention:** Always use `cd packageName && pnpm run <command>` pattern

## Related

- **Documentation:** [CLAUDE.md](../../../CLAUDE.md#quick-command-reference)
- **Monorepo Structure:** [CLAUDE.md](../../../CLAUDE.md#monorepo-structure-full)
- **Related Learnings:** None yet

---

*Last updated: 2024-10-28*
