# Code Standards

This document defines TypeScript coding standards for professional projects. All code must follow these rules strictly.

---

## Table of Contents

1. [TypeScript Rules](#typescript-rules)
2. [RO-RO Pattern](#ro-ro-pattern)
3. [File Organization](#file-organization)
4. [Naming Conventions](#naming-conventions)
5. [Import Organization](#import-organization)
6. [JSDoc Requirements](#jsdoc-requirements)
7. [Comments](#comments)
8. [Error Handling](#error-handling)
9. [Validation](#validation)
10. [Async/Await](#asyncawait)
11. [Code Formatting](#code-formatting)

---

## TypeScript Rules

### Type Safety

**Always enable strict mode:**

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true
  }
}
```

### Never Use `any`

```typescript
// BAD: Using any
const processData = (data: any) => {
  return data.value;
};

// GOOD: Use unknown with type guards
const processData = (data: unknown): string => {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return String(data.value);
  }
  throw new Error('Invalid data structure');
};

// GOOD: Define proper types
type DataInput = {
  value: string;
  timestamp: number;
};

const processData = (data: DataInput): string => {
  return data.value;
};
```

### Always Declare Types

```typescript
// GOOD: Explicit types everywhere
type CalculateInput = {
  a: number;
  b: number;
};

type CalculateOutput = {
  result: number;
};

const calculate = ({ a, b }: CalculateInput): CalculateOutput => {
  return { result: a + b };
};
```

### Prefer `type` over `interface`

```typescript
// GOOD: Use type for object shapes
type User = {
  id: string;
  name: string;
  email: string;
};

// BETTER: Use type with intersection for extension
type ExtendedUser = User & {
  role: string;
};
```

### Favor Immutability

```typescript
// GOOD: Use readonly
type Config = {
  readonly apiUrl: string;
  readonly timeout: number;
};

// GOOD: Use as const for literal values
const STATUS = {
  active: 'active',
  inactive: 'inactive',
} as const;
```

### Named Exports Only (No Default Exports)

```typescript
// BAD: Default export
export default class UserService {}

// GOOD: Named export
export class UserService {}
export const calculateTotal = () => {};
```

### Use `import type` for Type-Only Imports

```typescript
// GOOD: Separate type imports
import { createUser } from './user-service';
import type { User, CreateUserInput } from './types';
```

---

## RO-RO Pattern

**All functions MUST use RO-RO (Receive Object / Return Object) pattern.**

```typescript
// BAD: Positional parameters
const createUser = (name: string, email: string, role: string): User => {};

// GOOD: RO-RO pattern
type CreateUserInput = {
  name: string;
  email: string;
  role: string;
};

type CreateUserOutput = {
  user: User;
};

const createUser = ({ name, email, role }: CreateUserInput): CreateUserOutput => {
  return { user };
};
```

### Benefits of RO-RO

1. **Self-documenting**: Parameter names are visible at call site
2. **Easy to extend**: Add new parameters without breaking existing calls
3. **Easy to refactor**: Change parameter order without issues
4. **Better TypeScript support**: Better autocomplete and type checking

---

## File Organization

### File Size Limits

**Maximum 500 lines per file** (excludes tests, documentation, JSON data).

If approaching limit:

- Extract utilities to separate files
- Split components into smaller pieces
- Move types to separate type files
- Create subdirectories for related code

### File Structure

```typescript
// 1. Imports (external, then internal, then types)
import { z } from 'zod';
import { UserService } from '@/services';
import type { User } from '@/types';

// 2. Types (if not in separate file)
type ComponentProps = {
  userId: string;
};

// 3. Constants
const MAX_RETRY_COUNT = 3;

// 4. Helper functions (not exported)
const isValid = (input: string): boolean => {
  return input.length > 0;
};

// 5. Main exports
export const mainFunction = () => {};

// 6. Additional exports
export const helperExport = () => {};
```

---

## Naming Conventions

| Category | Convention | Example |
|----------|-----------|---------|
| Variables & Functions | camelCase | `userName`, `getUserById` |
| Classes & Types | PascalCase | `UserService`, `UserRole` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT`, `API_BASE_URL` |
| Booleans | Verb prefix | `isActive`, `hasPermission`, `canEdit` |
| Files (components) | PascalCase | `UserProfile.tsx` |
| Files (other) | kebab-case | `user-service.ts` |
| Test files | Same name + `.test.ts` | `user-service.test.ts` |

---

## Import Organization

**Always organize imports in this order:**

```typescript
// 1. External dependencies (alphabetically)
import { useState, useEffect } from 'react';
import { z } from 'zod';

// 2. Internal packages (alphabetically)
import { UserService } from '@/services';
import { logger } from '@/utils';

// 3. Relative imports (within module)
import { formatDate } from '../utils/date';
import { Button } from './components/Button';

// 4. Types (use import type)
import type { User } from '@/types';
import type { ServiceContext } from '../types';

// 5. Styles (if applicable)
import './styles.css';
```

---

## JSDoc Requirements

**Every exported function, class, and type MUST have comprehensive JSDoc.**

```typescript
/**
 * Creates a new user account with validation
 *
 * @param {Object} params - Input parameters
 * @param {CreateUserInput} params.input - User data to create
 * @param {User} params.currentUser - The user performing this action
 * @returns {Promise<CreateUserOutput>} Object containing the created user
 * @throws {Error} When input validation fails
 * @throws {Error} When email already exists
 *
 * @example
 * ```typescript
 * const result = await createUser({
 *   input: { name: 'John', email: 'john@example.com' },
 *   currentUser: adminUser,
 * });
 * ```
 */
export const createUser = async ({
  input,
  currentUser,
}: CreateUserParams): Promise<CreateUserOutput> => {
  // implementation
};
```

---

## Comments

**DO comment:**

- **WHY**, not WHAT
- Complex algorithms
- Non-obvious business logic
- Temporary workarounds (with TODO)

**DON'T comment:**

- Obvious code
- What the code does (code should be self-explanatory)

```typescript
// BAD: States the obvious
// Loop through users
users.forEach(user => processUser(user));

// GOOD: Explains WHY
// Process users in registration order to maintain fair queue position
users.forEach(user => processUser(user));
```

---

## Error Handling

### Consistent Error Format

```typescript
type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };
```

### Use Try/Catch with Typed Errors

```typescript
try {
  const result = await service.createUser({ input });
  return { success: true, data: result };
} catch (error) {
  if (error instanceof ValidationError) {
    return { success: false, error: { code: 'VALIDATION_ERROR', message: error.message } };
  }
  throw error;
}
```

---

## Validation

### Always Use Zod (or Equivalent Schema Validation)

```typescript
import { z } from 'zod';

export const createUserSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  role: z.enum(['admin', 'editor', 'viewer']),
});

// Infer types from schema
export type CreateUserInput = z.infer<typeof createUserSchema>;
```

---

## Async/Await

### Always Use Async/Await (Not .then() Chains)

```typescript
// BAD: Using .then()
const fetchUser = (id: string) => {
  return db.findUser(id).then(user => process(user)).catch(handleError);
};

// GOOD: Using async/await
const fetchUser = async (id: string) => {
  try {
    const user = await db.findUser(id);
    return await process(user);
  } catch (error) {
    handleError(error);
    throw error;
  }
};

// GOOD: Parallel execution when possible
const [user, orders, reviews] = await Promise.all([
  fetchUser(userId),
  fetchOrders(userId),
  fetchReviews(userId),
]);
```

---

## Code Formatting

### Use Biome (or ESLint + Prettier)

```bash
# Check formatting and linting
npx biome check .

# Auto-fix issues
npx biome check --apply .
```

### Key Formatting Rules

- Single quotes for strings
- Trailing commas in multiline structures
- 2-space indentation
- Semicolons required
- Maximum 100 characters per line

---

## Summary Checklist

Before committing code, verify:

- [ ] No `any` types used
- [ ] All functions use RO-RO pattern
- [ ] All exports are named (no default)
- [ ] Files under 500 lines
- [ ] Proper naming conventions
- [ ] Imports organized correctly
- [ ] Comprehensive JSDoc on all exports
- [ ] Comments explain WHY, not WHAT
- [ ] Schema validation for all inputs
- [ ] Async/await instead of .then() chains
- [ ] Code formatted with Biome
- [ ] Type safety everywhere

---

**These standards are mandatory. Code that does not follow them will be rejected in code review.**
