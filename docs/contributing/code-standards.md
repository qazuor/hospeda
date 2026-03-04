# Code Standards

For the core rules (TypeScript strict, named exports, RO-RO, JSDoc, max 500 lines, Zod validation, async/await, immutability, `import type`), see [CLAUDE.md](../../CLAUDE.md). This document provides expanded examples, explanations, and patterns.

---

## Type Guards Instead of `any`

When dealing with `unknown` data, create reusable type guards:

```typescript
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasProperty<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return isObject(obj) && key in obj;
}

// Usage
function processValue(value: unknown): string {
  if (isString(value)) {
    return value; // TypeScript narrows to string
  }

  if (hasProperty(value, 'name') && isString(value.name)) {
    return value.name;
  }

  throw new Error('Invalid value');
}
```

---

## Inferring Types from Zod Schemas

Types should be inferred from Zod schemas, not defined separately. This ensures validation logic and types stay in sync:

```typescript
// DO: Single source of truth
export const createUserSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  age: z.number().int().positive(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

// DON'T: Separate type and schema (they can drift apart)
export type CreateUserInput = {
  name: string;
  email: string;
  age: number;
};
export const createUserSchema = z.object({
  name: z.string(),
  email: z.string(),
  age: z.number(),
});
```

---

## RO-RO Pattern Expanded

### When RO-RO is NOT Required

Functions with 1-2 parameters where meaning is clear can use positional parameters:

```typescript
export function deleteUser(userId: string): Promise<void> { /* ... */ }
export function multiply(a: number, b: number): number { return a * b; }
```

### Returning Multiple Values

Always return an object when a function produces multiple values:

```typescript
export function parseBookingDates(input: {
  checkIn: string;
  checkOut: string;
}): {
  checkInDate: Date;
  checkOutDate: Date;
  numberOfNights: number;
} {
  const checkInDate = new Date(input.checkIn);
  const checkOutDate = new Date(input.checkOut);
  const numberOfNights = Math.ceil(
    (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  return { checkInDate, checkOutDate, numberOfNights };
}

// Usage: destructure only what you need
const { checkInDate, numberOfNights } = parseBookingDates({
  checkIn: '2024-01-15',
  checkOut: '2024-01-20',
});
```

---

## Splitting Large Files

When a file approaches 500 lines, split by responsibility:

```typescript
// BEFORE: One large file (800 lines)
// user.service.ts
export class UserService {
  async createUser() { /* 200 lines */ }
  async updateUser() { /* 150 lines */ }
  async searchUsers() { /* 200 lines */ }
  async exportUsers() { /* 150 lines */ }
}

// AFTER: Split into modules
// user.service.ts (200 lines) - orchestration
export class UserService {
  constructor(
    private readonly creator: UserCreator,
    private readonly updater: UserUpdater,
    private readonly searcher: UserSearcher
  ) {}

  async createUser(input: CreateUserInput) { return this.creator.create(input); }
  async updateUser(input: UpdateUserInput) { return this.updater.update(input); }
  async searchUsers(input: SearchUsersInput) { return this.searcher.search(input); }
}

// user-creator.ts (150 lines)
// user-updater.ts (150 lines)
// user-searcher.ts (200 lines)
```

---

## Naming Conventions

### Detailed Rules

| Context | Convention | Example |
|---------|-----------|---------|
| Files (utilities) | kebab-case | `booking-price-calculator.ts` |
| Files (components) | PascalCase | `AccommodationCard.tsx` |
| Folders | kebab-case | `api-routes/`, `error-handlers/` |
| Variables, functions | camelCase | `userName`, `calculateTotal()` |
| Classes, types, interfaces | PascalCase | `UserService`, `CreateUserInput` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_UPLOAD_SIZE`, `DEFAULT_PAGE_SIZE` |
| Booleans | is/has/should/can/was prefix | `isAvailable`, `hasPermission` |
| Functions | verb + noun | `getUser()`, `createBooking()` |
| Private members | underscore prefix | `this._model`, `this._cache` |

---

## Import Organization

Imports must be ordered by source, with each group sorted alphabetically:

```typescript
// 1. External packages
import { Hono } from 'hono';
import { z } from 'zod';

// 2. Internal packages
import { UserModel } from '@repo/db/models';
import { logger } from '@repo/logger';
import { createUserSchema } from '@repo/schemas';

// 3. Relative imports
import { formatUserResponse } from '../utils/formatters';
import { validateUserInput } from './validators';

// 4. Type imports
import type { User } from '@repo/db/types';
import type { ServiceContext } from '../types';
```

Biome auto-organizes imports when you run `pnpm lint --fix`.

---

## JSDoc Examples

### Function with Complex Parameters

```typescript
/**
 * Calculate the total price for an accommodation booking
 *
 * Includes nightly rate, cleaning fee, service fee, and applicable taxes.
 * Weekend nights (Friday-Saturday) incur a 20% surcharge.
 *
 * @param input - Booking price calculation parameters
 * @param input.nightlyRate - Base price per night in USD
 * @param input.numberOfNights - Total nights staying
 * @param input.cleaningFee - One-time cleaning fee
 * @param input.serviceFeeRate - Service fee as decimal (e.g., 0.10 for 10%)
 * @returns Total booking price including all fees and taxes
 *
 * @example
 * ```typescript
 * const total = calculateBookingPrice({
 *   nightlyRate: 100,
 *   numberOfNights: 3,
 *   cleaningFee: 50,
 *   serviceFeeRate: 0.10,
 * });
 * // Returns 385 (300 + 50 + 35 service fee)
 * ```
 */
```

### Class JSDoc

```typescript
/**
 * Service for managing user accounts and authentication
 *
 * Handles user CRUD operations, authentication, password management,
 * and user profile updates. Extends BaseCrudService for standard
 * database operations.
 *
 * @extends BaseCrudService
 *
 * @example
 * ```typescript
 * const service = new UserService(ctx);
 * const user = await service.createUser({
 *   name: 'John Doe',
 *   email: 'john@example.com',
 * });
 * ```
 */
```

### Type and Constant JSDoc

```typescript
/**
 * Accommodation availability status
 *
 * - `available` - Accommodation can be booked
 * - `unavailable` - Temporarily unavailable
 * - `maintenance` - Under maintenance
 */
export type AccommodationStatus = 'available' | 'unavailable' | 'maintenance';

/**
 * Maximum file size for image uploads (10MB)
 *
 * Images exceeding this size will be rejected with a 413 error.
 */
export const MAX_IMAGE_SIZE = 1024 * 1024 * 10;
```

---

## Comments: Explain WHY, Not WHAT

```typescript
// DO: Explain reasoning
// Use transaction to ensure both booking and payment are created atomically.
// If payment fails, booking should not exist in database.
return db.transaction(async (trx) => {
  const booking = await createBooking(trx, bookingData);
  const payment = await createPayment(trx, paymentData);
  return { booking, payment };
});

// Saturday and Sunday are considered weekend nights (0 and 6).
// Friday is NOT considered weekend for pricing purposes per business rules.
const isWeekendNight = date.getDay() === 0 || date.getDay() === 6;

// DON'T: Restate the code
// Create booking and payment in transaction
// Check if day is weekend
```

### TODO Comments

TODO comments must include context and assignee:

```typescript
// TODO(john): Implement retry logic for failed payments
//   - Retry up to 3 times with exponential backoff
//   - Log failed attempts to Sentry
//   Issue: #123
```

---

## Error Handling Patterns

### Custom Error Classes

```typescript
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly code: string = 'VALIDATION_ERROR'
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(
    message: string,
    public readonly resource: string,
    public readonly id: string
  ) {
    super(message);
    this.name = 'NotFoundError';
  }
}
```

### Non-Critical vs Critical Errors

```typescript
export async function processBooking(input: CreateBookingInput): Promise<Booking> {
  try {
    const booking = await bookingService.create(input);

    // Non-critical: log but don't fail
    try {
      await notificationService.sendConfirmation(booking);
    } catch (error) {
      logger.error('Failed to send booking confirmation', { error, bookingId: booking.id });
    }

    return booking;
  } catch (error) {
    logger.error('Failed to create booking', { error, input });
    throw error;
  }
}
```

---

## Result Type Pattern

Used by all services in `@repo/service-core`:

```typescript
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

export async function createUser(input: CreateUserInput): Promise<Result<User>> {
  try {
    const user = await userModel.create(input);
    return { success: true, data: user };
  } catch (error) {
    return { success: false, error: error as Error };
  }
}

// Usage
const result = await createUser(input);
if (result.success) {
  console.log('User created:', result.data);
} else {
  console.error('Failed:', result.error);
}
```

---

## Anti-Patterns to Avoid

### Magic Numbers

```typescript
// DON'T
if (file.size > 10485760) { /* ... */ }

// DO
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
if (file.size > MAX_FILE_SIZE) { /* ... */ }
```

### Deep Nesting

```typescript
// DON'T: 5 levels deep
if (input.userId) {
  const user = await userModel.findById({ id: input.userId });
  if (user) {
    if (user.isVerified) { /* ... */ }
  }
}

// DO: Early returns
if (!input.userId) {
  throw new ValidationError('User ID required', 'userId');
}
const user = await userModel.findById({ id: input.userId });
if (!user) {
  throw new NotFoundError('User not found', 'User', input.userId);
}
if (!user.isVerified) {
  throw new ValidationError('User must be verified', 'userId');
}
```

### console.log in Production

```typescript
// DON'T
console.log('Processing payment', input);

// DO
import { logger } from '@repo/logger';
logger.info('Processing payment', { paymentId: input.id, amount: input.amount });
```

### Commented-Out Code

Delete it. Use git history to recover old code if needed.

---

## Further Reading

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Zod Documentation](https://zod.dev)
- [Biome Documentation](https://biomejs.dev)
