# Common Architectural Patterns

**Date:** 2024-10-28

**Category:** Architecture / Best Practices

## Problem

Inconsistent code patterns across the codebase cause:
- Difficult code reviews
- Higher cognitive load for developers
- Harder to onboard new team members
- Bugs from inconsistent implementations

## Solution

**Always Follow These Patterns:**

### 1. Factory Patterns for Routes

```typescript
// ✅ CORRECT - Use createCRUDRoute factory
import { createCRUDRoute } from '@repo/api-factories';

const userRoutes = createCRUDRoute({
  path: '/users',
  service: userService,
  schema: userSchema,
});

// ❌ WRONG - Manual route creation
app.get('/users', async (c) => { /* ... */ });
app.post('/users', async (c) => { /* ... */ });
```

### 2. Extend Base Classes

```typescript
// ✅ CORRECT - Extend BaseModel
export class UserModel extends BaseModel<User> {
  constructor() {
    super('users');
  }
}

// ✅ CORRECT - Extend BaseCrudService
export class UserService extends BaseCrudService<User> {
  constructor() {
    super(userModel);
  }
}

// ❌ WRONG - Custom implementations
export class UserModel { /* manual CRUD */ }
```

### 3. RO-RO Pattern (Receive Object / Return Object)

```typescript
// ✅ CORRECT - RO-RO pattern
export async function createUser({ data, context }: CreateUserParams): Promise<CreateUserResult> {
  return { user, status: 'created' };
}

// ❌ WRONG - Multiple parameters
export async function createUser(email: string, name: string, age: number) {
  return user;
}
```

### 4. Barrel Files (index.ts)

```typescript
// ✅ CORRECT - models/index.ts
export { UserModel } from './user.model.js';
export { BookingModel } from './booking.model.js';

// Import usage
import { UserModel, BookingModel } from '@repo/db/models';
```

### 5. Named Exports Only

```typescript
// ✅ CORRECT - Named export
export const userService = new UserService();
export function validateUser() { /* ... */ }

// ❌ WRONG - Default export
export default userService;
```

### 6. Types from Zod Schemas

```typescript
// ✅ CORRECT - Infer from schema
import { userSchema } from '@repo/schemas';
export type User = z.infer<typeof userSchema>;

// ❌ WRONG - Separate type file
export interface User {
  id: string;
  email: string;
}
```

## Impact

- **Severity:** High - Affects codebase maintainability
- **Frequency:** Every new feature/component
- **Scope:** All developers
- **Prevention:** Follow patterns exactly, use factories and base classes

## Related

- **Full Patterns:** [.claude/docs/standards/architecture-patterns.md](../standards/architecture-patterns.md)
- **Code Standards:** [.claude/docs/standards/code-standards.md](../standards/code-standards.md)
- **Related Learnings:** `common-mistakes-to-avoid.md`

---

*Last updated: 2024-10-28*
