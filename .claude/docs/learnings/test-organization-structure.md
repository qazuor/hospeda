# Test Organization and Structure

**Date:** 2024-10-28

**Category:** Testing / Project Structure

## Problem

Tests placed incorrectly (e.g., in `src/` alongside source code) cause:

- Import path confusion
- Build artifacts including test files
- Difficulty maintaining test/source separation
- Inconsistent test discovery

## Solution

**Test Organization Rules:**

1. **Tests go in `test/` folder at package/app root** - NOT in `src/`
2. **Mirror source folder structure** - `src/models/user.model.ts` → `test/models/user.model.test.ts`
3. **Use relative imports in tests** - Import from `../src/` not same-folder
4. **Migrate gradually** - When editing a package, move its tests to correct structure

**Example Structure:**

```
packages/db/
├── src/
│   ├── models/
│   │   ├── user.model.ts
│   │   └── booking.model.ts
│   └── services/
│       └── user.service.ts
└── test/
    ├── models/
    │   ├── user.model.test.ts     # Mirrors src/models/
    │   └── booking.model.test.ts
    └── services/
        └── user.service.test.ts   # Mirrors src/services/
```

**Import Example:**

```typescript
// ✅ CORRECT - test/models/user.model.test.ts
import { UserModel } from '../../src/models/user.model.js';

// ❌ WRONG - Don't import from same folder
import { UserModel } from './user.model.js';
```

## Impact

- **Severity:** Medium - Affects build and test reliability
- **Frequency:** Common when creating new packages
- **Scope:** All packages and apps
- **Prevention:** Follow test/ structure from project start

## Related

- **Full Rules:** [.claude/docs/standards/testing-standards.md](../standards/testing-standards.md)
- **Architecture:** [.claude/docs/standards/architecture-patterns.md](../standards/architecture-patterns.md)
- **Related Learnings:** None yet

---

*Last updated: 2024-10-28*
