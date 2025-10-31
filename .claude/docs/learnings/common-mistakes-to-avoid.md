# Common Mistakes to Avoid

**Date:** 2024-10-28

**Category:** Best Practices / Code Quality

## Problem

Repeated mistakes slow down development and introduce bugs:

- Type safety violations
- Skipped tests leading to bugs
- Pattern violations causing inconsistency
- Quality issues from skipped checks

## Solution

**Never Do These Things:**

### 1. Using `any` Type

```typescript
// ❌ WRONG - Loses all type safety
function processData(data: any) {
  return data.value;  // No autocomplete, no errors
}

// ✅ CORRECT - Use unknown with type guards
function processData(data: unknown) {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return (data as { value: string }).value;
  }
  throw new Error('Invalid data');
}

// ✅ BETTER - Proper typing
interface DataWithValue {
  value: string;
}
function processData(data: DataWithValue) {
  return data.value;
}
```

### 2. Using Default Exports

```typescript
// ❌ WRONG - Default export
export default class UserService { }

// Import becomes inconsistent
import UserService from './user.service';     // Could be named anything
import MyService from './user.service';       // No consistency

// ✅ CORRECT - Named export
export class UserService { }

// Import is consistent
import { UserService } from './user.service';
```

### 3. Skipping Tests in TDD

```typescript
// ❌ WRONG - Implement first
export function calculateTotal(items: Item[]) {
  return items.reduce((sum, item) => sum + item.price, 0);
}
// Then write tests later (often forgotten)

// ✅ CORRECT - Test first (RED)
it('should calculate total of items', () => {
  const items = [{ price: 10 }, { price: 20 }];
  expect(calculateTotal(items)).toBe(30);
});
// Result: FAIL - calculateTotal is not defined

// Then implement (GREEN)
export function calculateTotal(items: Item[]) {
  return items.reduce((sum, item) => sum + item.price, 0);
}
// Result: PASS ✓
```

### 4. Not Running Quality Checks

```bash
# ❌ WRONG - Skip directly to commit
git add .
git commit -m "Add feature"

# ✅ CORRECT - Always run quality checks
pnpm typecheck
pnpm lint
pnpm test
# Then commit if all pass
```

### 5. Making Autonomous Decisions

```typescript
// ❌ WRONG - Choose approach without consulting
// "I'll use Redis for caching"
await redis.set(key, value);

// ✅ CORRECT - Present options
// "I have 3 caching options:
// 1. In-memory (fast, simple, limited)
// 2. Redis (scalable, complex)
// 3. Database (simple, slower)
// Which do you prefer?"
```

### 6. Creating Separate Type Files

```typescript
// ❌ WRONG - Separate type file
// types/user.ts
export interface User {
  id: string;
  email: string;
}

// ✅ CORRECT - Infer from Zod schema
// schemas/user.schema.ts
export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
});

export type User = z.infer<typeof userSchema>;
```

## Impact

- **Severity:** High - Each mistake compounds over time
- **Frequency:** Common for new developers or under time pressure
- **Scope:** All codebase contributors
- **Prevention:** Code reviews, automated checks, following standards

## Related

- **Standards:** [.claude/docs/standards/code-standards.md](../standards/code-standards.md)
- **TDD Guide:** [.claude/skills/patterns/tdd-methodology.md](../../skills/patterns/tdd-methodology.md)
- **Related Learnings:** `common-architectural-patterns.md`

---

*Last updated: 2024-10-28*
