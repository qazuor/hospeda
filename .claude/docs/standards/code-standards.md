# Code Standards

This document defines the coding standards for the Hospeda project. All code must follow these rules strictly.

---

## Table of Contents

1. [Language Policy](#language-policy)
2. [TypeScript Rules](#typescript-rules)
3. [RO-RO Pattern](#ro-ro-pattern)
4. [File Organization](#file-organization)
5. [Naming Conventions](#naming-conventions)
6. [Import Organization](#import-organization)
7. [JSDoc Requirements](#jsdoc-requirements)
8. [Comments](#comments)
9. [Error Handling](#error-handling)
10. [Validation](#validation)
11. [Async/Await](#asyncawait)
12. [Code Formatting](#code-formatting)

---

## Language Policy

### Critical Rule: English Only

**ALL code, comments, variable names, function names, JSDoc, and error messages MUST be in English.**

**Never write in Spanish in:**

- Code
- Comments
- Variable names
- Function names
- Type names
- JSDoc
- Error messages
- Commit messages
- Documentation

**Exception:**

- Chat responses to user: Spanish
- User-facing UI text: Spanish (in i18n files only)

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
```text

### Never Use `any`

```typescript
// ❌ BAD: Using any
const processData = (data: any) => {
  return data.value;
};

// ✅ GOOD: Use unknown with type guards
const processData = (data: unknown): string => {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return String(data.value);
  }
  throw new Error('Invalid data structure');
};

// ✅ GOOD: Define proper types
type DataInput = {
  value: string;
  timestamp: number;
};

const processData = (data: DataInput): string => {
  return data.value;
};
```text

### Always Declare Types

```typescript
// ❌ BAD: No type annotations
const calculate = (a, b) => {
  return a + b;
};

// ✅ GOOD: Explicit types everywhere
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
```text

### Prefer `type` over `interface`

```typescript
// ✅ GOOD: Use type for object shapes
type User = {
  id: string;
  name: string;
  email: string;
};

// ⚠️ ACCEPTABLE: Use interface only when extending
interface ExtendedUser extends User {
  role: string;
}

// ✅ BETTER: Use type with intersection
type ExtendedUser = User & {
  role: string;
};
```text

### Use Literal and Union Types

```typescript
// ✅ GOOD: Literal types for constants
type Status = 'pending' | 'approved' | 'rejected';

type UserRole = 'admin' | 'host' | 'guest';

// ✅ GOOD: Union types for alternatives
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ✅ GOOD: Discriminated unions
type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'square'; size: number }
  | { kind: 'rectangle'; width: number; height: number };
```text

### Favor Immutability

```typescript
// ✅ GOOD: Use readonly
type Config = {
  readonly apiUrl: string;
  readonly timeout: number;
};

// ✅ GOOD: Use as const for literal values
const COLORS = {
  primary: '#007bff',
  secondary: '#6c757d',
} as const;

// ✅ GOOD: Readonly arrays
type ReadonlyUsers = readonly User[];

// ✅ GOOD: Use Readonly utility type
type ImmutableUser = Readonly<User>;
```text

### Use `import type` for Type-Only Imports

```typescript
// ✅ GOOD: Separate type imports
import { createUser } from './user-service';
import type { User, CreateUserInput } from './types';

// ❌ BAD: Mixed imports
import { createUser, User, CreateUserInput } from './user-service';
```text

### Named Exports Only (No Default Exports)

```typescript
// ❌ BAD: Default export
export default class UserService {}

// ✅ GOOD: Named export
export class UserService {}

// ❌ BAD: Default export for function
export default function calculateTotal() {}

// ✅ GOOD: Named export
export const calculateTotal = () => {};
```text

---

## RO-RO Pattern

**All functions MUST use RO-RO (Receive Object / Return Object) pattern.**

### Basic Example

```typescript
// ❌ BAD: Positional parameters
const createUser = (name: string, email: string, role: string): User => {
  // implementation
};

// ✅ GOOD: RO-RO pattern
type CreateUserInput = {
  name: string;
  email: string;
  role: string;
};

type CreateUserOutput = {
  user: User;
};

const createUser = ({ name, email, role }: CreateUserInput): CreateUserOutput => {
  // implementation
  return { user };
};
```text

### With Async Functions

```typescript
// ✅ GOOD: Async RO-RO
type FetchUserInput = {
  id: string;
};

type FetchUserOutput = {
  user: User;
  metadata: Metadata;
};

const fetchUser = async ({ id }: FetchUserInput): Promise<FetchUserOutput> => {
  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  const metadata = await getMetadata(user);
  return { user, metadata };
};
```text

### With Optional Parameters

```typescript
// ✅ GOOD: Optional fields in input object
type SearchUsersInput = {
  query?: string;
  page?: number;
  pageSize?: number;
  orderBy?: string;
};

type SearchUsersOutput = {
  users: User[];
  pagination: PaginationInfo;
};

const searchUsers = ({
  query,
  page = 1,
  pageSize = 20,
  orderBy = 'createdAt'
}: SearchUsersInput): SearchUsersOutput => {
  // implementation
};
```text

### Benefits of RO-RO

1. **Self-documenting**: Parameter names are visible at call site
2. **Easy to extend**: Add new parameters without breaking existing calls
3. **Easy to refactor**: Change parameter order without issues
4. **Better TypeScript support**: Better autocomplete and type checking
5. **Consistent patterns**: Same pattern across entire codebase

---

## File Organization

### File Size Limits

**Maximum 500 lines per file** (excludes tests, documentation, JSON data)

If approaching limit:

- Extract utilities to separate files
- Split components into smaller pieces
- Move types to separate type files
- Create subdirectories for related code

### File Structure

**Typical file structure:**

```typescript
// 1. Imports (external, then internal, then types)
import { useState, useEffect } from 'react';
import { UserService } from '@repo/service-core';
import type { User } from '@repo/schemas';

// 2. Types (if not in separate file)
type ComponentProps = {
  userId: string;
};

// 3. Constants
const MAX_RETRY_COUNT = 3;

// 4. Helper functions (not exported)
const isValidUser = (user: User): boolean => {
  return user.email.includes('@');
};

// 5. Main exports
export const UserComponent = ({ userId }: ComponentProps) => {
  // implementation
};

// 6. Additional exports
export const useUserData = (id: string) => {
  // implementation
};
```text

### Directory Structure

```text
feature/
├── index.ts              # Barrel file (exports only)
├── types.ts              # Type definitions
├── constants.ts          # Constants
├── utils.ts              # Utility functions
├── feature.component.tsx # Main component
├── feature.service.ts    # Business logic
└── feature.test.ts       # Tests
```text

---

## Naming Conventions

### Variables and Functions: camelCase

```typescript
// ✅ GOOD
const userName = 'John';
const isActive = true;
const getUserById = (id: string) => {};
const calculateTotal = () => {};
```text

### Classes and Types: PascalCase

```typescript
// ✅ GOOD
class UserService {}
type UserRole = 'admin' | 'host';
interface IUserRepository {}
```text

### Constants: UPPER_SNAKE_CASE

```typescript
// ✅ GOOD
const MAX_RETRY_COUNT = 3;
const API_BASE_URL = 'https://api.example.com';
const DEFAULT_PAGE_SIZE = 20;
```text

### Booleans: Verb Prefixes

```typescript
// ✅ GOOD
const isActive = true;
const hasPermission = false;
const canEdit = true;
const shouldUpdate = false;

// ❌ BAD
const active = true;
const permission = false;
```text

### Private Class Members: Leading Underscore

```typescript
// ✅ GOOD
class UserService {
  private _cache: Map<string, User>;

  private _clearCache(): void {
    this._cache.clear();
  }
}
```text

### Files

**Components**: PascalCase

```text
UserProfile.tsx
AccommodationCard.tsx
```text

**Others**: kebab-case

```text
user-service.ts
format-date.ts
api-client.ts
```text

**Tests**: Same name + `.test.ts`

```text
user-service.test.ts
format-date.test.ts
```text

---

## Import Organization

**Always organize imports in this order:**

```typescript
// 1. External dependencies (alphabetically)
import { useState, useEffect } from 'react';
import { z } from 'zod';

// 2. Internal packages (@repo/*) (alphabetically)
import { UserService } from '@repo/service-core';
import { logger } from '@repo/logger';
import { userSchema } from '@repo/schemas';

// 3. Relative imports (within package)
import { formatDate } from '../utils/date';
import { Button } from './components/Button';

// 4. Types (use import type)
import type { User } from '@repo/schemas';
import type { ServiceContext } from '../types';

// 5. Styles (if applicable)
import './styles.css';
```text

### Import Rules

```typescript
// ✅ GOOD: Import from barrel files
import { UserModel, AccommodationModel } from '@repo/db';

// ❌ BAD: Direct file imports for public API
import { UserModel } from '@repo/db/src/models/user.model';

// ✅ GOOD: Type-only imports
import type { User } from '@repo/schemas';

// ❌ BAD: Mixing value and type imports
import { User, createUser } from './user';
```text

---

## JSDoc Requirements

**EVERY exported function, class, and type MUST have comprehensive JSDoc in English.**

### Function Documentation Template

```typescript
/**

 * Creates a new user account with validation and authorization checks

 *

 * This function validates the input data, checks if the email is already in use,
 * hashes the password, and creates a new user record in the database.

 *

 * @param {Object} params - Input parameters
 * @param {CreateUserInput} params.input - User data to create
 * @param {string} params.input.name - User's full name
 * @param {string} params.input.email - User's email address (must be unique)
 * @param {string} params.input.password - User's password (will be hashed)
 * @param {UserRole} params.input.role - User's role (admin, host, or guest)
 * @param {User} params.currentUser - The user performing this action
 * @returns {Promise<CreateUserOutput>} Object containing the created user and auth token

 *

 * @throws {ServiceError} VALIDATION_ERROR - When input validation fails
 * @throws {ServiceError} CONFLICT - When email already exists
 * @throws {ServiceError} FORBIDDEN - When current user lacks permissions

 *

 * @example
 * ```typescript
 * import { UserService } from '@repo/service-core';
 * import type { CreateUserInput } from '@repo/schemas';

 *

 * const service = new UserService(ctx);
 * const result = await service.createUser({
 *   input: {
 *     name: 'John Doe',
 *     email: 'john@example.com',
 *     password: 'SecureP@ssw0rd',
 *     role: 'host'
 *   },
 *   currentUser: adminUser
 * });

 *

 * console.log(result.user.id); // '123e4567-e89b-12d3-a456-426614174000'
 * console.log(result.token); // 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
 * ```

 *

 * @complexity O(1) database insert + O(1) hash operation
 * @sideEffects
 * - Creates database record in users table
 * - Sends welcome email to user
 * - Logs user creation event

 *

 * @see {@link UserService} for related operations
 * @see {@link validateUserInput} for validation logic
 * @see {@link hashPassword} for password hashing

 *

 * @since 1.0.0
 * @version 1.2.0

 */
export const createUser = async ({
  input,
  currentUser,
}: CreateUserParams): Promise<CreateUserOutput> => {
  // implementation
};
```text

### Class Documentation

```typescript
/**

 * Service for managing user accounts and authentication

 *

 * This service handles all user-related operations including:
 * - User creation and registration
 * - User profile updates
 * - Authentication and authorization
 * - Password management
 * - User search and listing

 *

 * @extends BaseCrudService
 * @implements IUserService

 *

 * @example
 * ```typescript
 * import { UserService } from '@repo/service-core';

 *

 * const service = new UserService(ctx);
 * const user = await service.findById({ id: '123' });
 * ```

 *

 * @see {@link BaseCrudService} for base CRUD operations

 */
export class UserService extends BaseCrudService<
  User,
  UserModel,
  CreateUserSchema,
  UpdateUserSchema,
  SearchUserSchema
> {
  /**

   * Creates a new UserService instance

   *

   * @param {ServiceContext} ctx - Service context with database connection
   * @param {UserModel} [model] - Optional custom model instance

   */
  constructor(ctx: ServiceContext, model?: UserModel) {
    super(ctx, model ?? new UserModel(ctx.db));
  }
}
```text

### Type Documentation

```typescript
/**

 * Represents a user account in the system

 *

 * Users can have one of three roles:
 * - admin: Full system access
 * - host: Can create and manage accommodations
 * - guest: Can book accommodations

 *

 * @property {string} id - Unique user identifier (UUID v4)
 * @property {string} name - User's full name
 * @property {string} email - User's email address (unique)
 * @property {UserRole} role - User's role in the system
 * @property {Date} createdAt - Account creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 * @property {Date | null} deletedAt - Soft deletion timestamp (null if active)

 *

 * @example
 * ```typescript
 * const user: User = {
 *   id: '123e4567-e89b-12d3-a456-426614174000',
 *   name: 'John Doe',
 *   email: 'john@example.com',
 *   role: 'host',
 *   createdAt: new Date('2024-01-01'),
 *   updatedAt: new Date('2024-01-01'),
 *   deletedAt: null
 * };
 * ```

 */
export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};
```text

### JSDoc Tags to Use

**Required:**

- `@param` - Function parameters
- `@returns` - Return value
- `@throws` - Possible errors

**Recommended:**

- `@example` - Working code examples
- `@complexity` - Time/space complexity
- `@sideEffects` - Any side effects
- `@see` - Related code/docs

**Optional:**

- `@since` - Version introduced
- `@deprecated` - If deprecated
- `@version` - Current version
- `@author` - Author name

---

## Comments

### When to Comment

**DO comment:**

- **WHY**, not WHAT
- Complex algorithms
- Non-obvious business logic
- Temporary workarounds (with TODO)
- Performance optimizations

**DON'T comment:**

- Obvious code
- What the code does (code should be self-explanatory)
- Redundant information

### Good vs Bad Comments

```typescript
// ❌ BAD: Obvious comment
// Set the user name to John
const userName = 'John';

// ✅ GOOD: Explains WHY
// Default to 'John' when name is not provided by OAuth provider
const userName = oauthName ?? 'John';

// ❌ BAD: States the obvious
// Loop through users
users.forEach(user => processUser(user));

// ✅ GOOD: Explains non-obvious business logic
// Process users in order of registration to maintain fair queue position
// Newer users should not be able to jump ahead of existing waitlist
users.forEach(user => processUser(user));
```text

### TODO Comments

```typescript
// ✅ GOOD: TODO with context
// TODO: Optimize this query with an index on (userId, createdAt)
// Current performance: ~500ms for 10k records
// Target performance: <50ms
const results = await db.query.bookings.findMany({
  where: eq(bookings.userId, userId),
  orderBy: desc(bookings.createdAt),
});

// TODO: Verify if we need timezone conversion here
// Current assumption: All dates are UTC
const timestamp = new Date().toISOString();
```text

---

## Error Handling

### Use ServiceError

```typescript
import { ServiceError, ServiceErrorCode } from '@repo/service-core';

// ✅ GOOD: Descriptive error with context
if (!user) {
  throw new ServiceError(
    'User not found',
    ServiceErrorCode.NOT_FOUND,
    { userId }
  );
}

// ✅ GOOD: Validation error with details
if (!input.email.includes('@')) {
  throw new ServiceError(
    'Invalid email format',
    ServiceErrorCode.VALIDATION_ERROR,
    { email: input.email }
  );
}
```text

### API Error Responses

```typescript
// ✅ GOOD: Consistent error format
type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

// In route handler
try {
  const result = await service.createUser({ input, currentUser });
  return c.json({ success: true, data: result });
} catch (error) {
  if (error instanceof ServiceError) {
    return c.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      },
      error.statusCode
    );
  }
  throw error; // Let global error handler catch
}
```text

---

## Validation

### Always Use Zod

```typescript
import { z } from 'zod';

// ✅ GOOD: Define schema
export const createUserSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  role: z.enum(['admin', 'host', 'guest']),
});

// ✅ GOOD: Infer types from schema
export type CreateUserInput = z.infer<typeof createUserSchema>;

// ✅ GOOD: Validate in route
app.post(
  '/users',
  zValidator('json', createUserSchema),
  async (c) => {
    const input = c.req.valid('json');
    // input is now typed and validated
  }
);
```text

### Never Inline Validation

```typescript
// ❌ BAD: Inline validation
app.post('/users', async (c) => {
  const body = await c.req.json();
  if (!body.name || !body.email) {
    return c.json({ error: 'Invalid input' }, 400);
  }
  // ...
});

// ✅ GOOD: Use Zod schema from @repo/schemas
import { createUserSchema } from '@repo/schemas';

app.post(
  '/users',
  zValidator('json', createUserSchema),
  async (c) => {
    const input = c.req.valid('json');
    // ...
  }
);
```text

---

## Async/Await

### Always Use Async/Await (Not Promises)

```typescript
// ❌ BAD: Using .then()
const fetchUser = (id: string) => {
  return db.query.users.findFirst({ where: eq(users.id, id) })
    .then(user => processUser(user))
    .then(result => result)
    .catch(error => handleError(error));
};

// ✅ GOOD: Using async/await
const fetchUser = async (id: string) => {
  try {
    const user = await db.query.users.findFirst({ where: eq(users.id, id) });
    const result = await processUser(user);
    return result;
  } catch (error) {
    handleError(error);
    throw error;
  }
};
```text

### Parallel Execution When Possible

```typescript
// ❌ BAD: Sequential when could be parallel
const user = await fetchUser(userId);
const bookings = await fetchBookings(userId);
const reviews = await fetchReviews(userId);

// ✅ GOOD: Parallel execution
const [user, bookings, reviews] = await Promise.all([
  fetchUser(userId),
  fetchBookings(userId),
  fetchReviews(userId),
]);
```text

---

## Code Formatting

### Use Biome

```bash

# Check formatting and linting

pnpm check

# Auto-fix issues

pnpm check --apply
```text

### Key Formatting Rules

```typescript
// ✅ GOOD: Single quotes
const name = 'John';

// ✅ GOOD: Trailing commas
const obj = {
  name: 'John',
  age: 30,
};

// ✅ GOOD: 2 space indentation
const fn = () => {
  if (condition) {
    doSomething();
  }
};

// ✅ GOOD: Semicolons
const x = 5;

// ✅ GOOD: Line length max 100 characters
const longString =
  'This is a very long string that would exceed 100 characters so we break it';
```text

---

## Summary Checklist

Before committing code, verify:

- [ ] All code, comments, and JSDoc in English
- [ ] No `any` types used
- [ ] All functions use RO-RO pattern
- [ ] All exports are named (no default)
- [ ] Files under 500 lines
- [ ] Proper naming conventions
- [ ] Imports organized correctly
- [ ] Comprehensive JSDoc on all exports
- [ ] Comments explain WHY, not WHAT
- [ ] Zod validation for all inputs
- [ ] Async/await instead of promises
- [ ] Code formatted with Biome
- [ ] Type safety everywhere

---

**These standards are mandatory. Code that doesn't follow them will be rejected in code review.**

