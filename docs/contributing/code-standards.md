# Code Standards

This guide provides practical coding standards for contributing to Hospeda. Following these standards ensures consistency, maintainability, and quality across the codebase.

## Table of Contents

- [Why Standards Matter](#why-standards-matter)
- [Language Policy](#language-policy)
- [TypeScript Standards](#typescript-standards)
- [Named Exports Only](#named-exports-only)
- [RO-RO Pattern](#ro-ro-pattern)
- [File Organization](#file-organization)
- [Naming Conventions](#naming-conventions)
- [Import Organization](#import-organization)
- [JSDoc Requirements](#jsdoc-requirements)
- [Comments](#comments)
- [Error Handling](#error-handling)
- [Validation](#validation)
- [Async/Await](#asyncawait)
- [Code Formatting](#code-formatting)
- [Common Patterns](#common-patterns)
- [What to Avoid](#what-to-avoid)

## Why Standards Matter

Code standards are crucial for:

- **Consistency**: Code looks like it was written by one person
- **Maintainability**: Future developers can understand code quickly
- **Quality**: Standards catch common mistakes early
- **Collaboration**: Everyone knows what to expect
- **Onboarding**: New contributors can learn patterns quickly

**Remember**: Standards are not about personal preference—they're about team efficiency and code quality.

## Language Policy

### Rule: English ONLY for Code and Comments

**All code, comments, and documentation MUST be in English.**

This includes:

- Variable names
- Function names
- Class names
- Type names
- Constants
- Comments
- JSDoc
- README files
- Code documentation
- Commit messages

**Exception**: Chat responses to users are in Spanish (but not code).

### ✅ DO

```typescript
/**
 * Calculate the total price for an accommodation booking
 */
export function calculateBookingPrice(input: {
  nightlyRate: number;
  numberOfNights: number;
}): number {
  // Apply weekend surcharge for Saturday and Sunday
  const total = input.nightlyRate * input.numberOfNights;
  return total;
}
```

### ❌ DON'T

```typescript
/**
 * Calcula el precio total de una reserva de alojamiento
 */
export function calcularPrecioReserva(input: {
  tarifaNocturna: number;
  numeroNoches: number;
}): number {
  // Aplicar recargo de fin de semana
  const total = input.tarifaNocturna * input.numeroNoches;
  return total;
}
```

### Why English?

- **Global collaboration**: Open source project, international contributors
- **Technical ecosystem**: Libraries, frameworks, docs all in English
- **Professional standard**: Industry best practice
- **Consistency**: Avoids mixing languages in codebase
- **Tooling**: Better IDE support and linter integration

## TypeScript Standards

### Rule: No `any` Type

**Never use `any`. Use `unknown` with type guards instead.**

`any` disables TypeScript's type checking and defeats the purpose of using TypeScript.

### ✅ DO

```typescript
function processData(data: unknown): string {
  if (typeof data === 'string') {
    return data.toUpperCase();
  }

  if (typeof data === 'object' && data !== null && 'value' in data) {
    return String(data.value);
  }

  throw new Error('Invalid data structure');
}
```

### ❌ DON'T

```typescript
function processData(data: any): string {
  return data.value.toUpperCase(); // No type safety!
}
```

### Type Guard Helpers

```typescript
// Create reusable type guards
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
    return value; // TypeScript knows it's a string
  }

  if (hasProperty(value, 'name') && isString(value.name)) {
    return value.name;
  }

  throw new Error('Invalid value');
}
```

### Rule: Strict Mode Always Enabled

**TypeScript strict mode must be enabled** in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
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

### Rule: Type Annotations Required

**All function parameters and return types must have explicit type annotations.**

### ✅ DO

```typescript
export function createUser(input: {
  name: string;
  email: string;
  age: number;
}): User {
  // Implementation
}
```

### ❌ DON'T

```typescript
export function createUser(input) { // Missing type annotation
  // Implementation
}
```

### Rule: Infer Types from Zod Schemas

**Types should be inferred from Zod schemas using `z.infer`, not defined separately.**

### ✅ DO

```typescript
// packages/schemas/src/user.schema.ts
import { z } from 'zod';

export const createUserSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  age: z.number().int().positive(),
});

// Infer type from schema
export type CreateUserInput = z.infer<typeof createUserSchema>;
```

### ❌ DON'T

```typescript
// Don't define types separately from schemas
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

**Why?** Single source of truth - validation and types stay in sync.

## Named Exports Only

### Rule: No Default Exports

**Always use named exports. Never use default exports.**

### ✅ DO

```typescript
// user.service.ts
export class UserService {
  // Implementation
}

export function validateUser(input: { email: string }): boolean {
  // Implementation
}

// Import
import { UserService, validateUser } from './user.service';
```

### ❌ DON'T

```typescript
// user.service.ts
export default class UserService {
  // Implementation
}

// Import (unclear what you're importing)
import UserService from './user.service';
import WhatIsThis from './user.service'; // Can rename arbitrarily
```

### Why Named Exports?

- **Consistency**: Same name everywhere
- **Refactoring**: IDEs can rename safely
- **Clarity**: Clear what you're importing
- **Tree-shaking**: Better for bundlers
- **Multiple exports**: Can export multiple items from one file

### Barrel Exports

Use `index.ts` files to re-export from folders:

```typescript
// models/index.ts
export { UserModel } from './user.model';
export { AccommodationModel } from './accommodation.model';
export { BookingModel } from './booking.model';

// Usage
import { UserModel, AccommodationModel } from '@repo/db/models';
```

## RO-RO Pattern

### Rule: Receive Object / Return Object

**Functions with 3 or more parameters MUST use the RO-RO pattern.**

RO-RO means:

- **Receive Object**: Function receives a single object parameter
- **Return Object**: Function returns an object (when returning multiple values)

### ✅ DO

```typescript
// Function with multiple parameters - use object
export function calculateBookingPrice(input: {
  nightlyRate: number;
  numberOfNights: number;
  guestCount: number;
  cleaningFee: number;
}): number {
  // Implementation
}

// Usage
const price = calculateBookingPrice({
  nightlyRate: 100,
  numberOfNights: 3,
  guestCount: 2,
  cleaningFee: 50,
});
```

### ❌ DON'T

```typescript
// Multiple positional parameters (hard to remember order)
export function calculateBookingPrice(
  nightlyRate: number,
  numberOfNights: number,
  guestCount: number,
  cleaningFee: number
): number {
  // Implementation
}

// Usage (what do these numbers mean?)
const price = calculateBookingPrice(100, 3, 2, 50);
```

### When RO-RO is NOT Required

**Functions with 1-2 parameters** can use positional parameters:

```typescript
// OK: Single parameter
export function deleteUser(userId: string): Promise<void> {
  // Implementation
}

// OK: Two parameters (clear meaning)
export function multiply(a: number, b: number): number {
  return a * b;
}
```

### Returning Multiple Values

When returning multiple values, return an object:

```typescript
// ✅ DO: Return object
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

// Usage
const { checkInDate, numberOfNights } = parseBookingDates({
  checkIn: '2024-01-15',
  checkOut: '2024-01-20',
});
```

### Benefits of RO-RO

- **Named parameters**: Self-documenting code
- **Order independent**: Can't mix up parameter order
- **Optional parameters**: Easy to add/remove
- **Destructuring**: Can pick what you need
- **Refactoring**: Easy to add new parameters

## File Organization

### Rule: Max 500 Lines per File

**No file should exceed 500 lines of code** (excluding tests, docs, JSON).

### Why?

- **Maintainability**: Easier to understand
- **Testing**: Smaller surface area
- **Refactoring**: Less risky to change
- **Collaboration**: Fewer merge conflicts

### How to Split Large Files

**Example: Large Service File**

```typescript
// ❌ DON'T: One large file (800 lines)
// user.service.ts

export class UserService {
  async createUser() { /* 200 lines */ }
  async updateUser() { /* 150 lines */ }
  async deleteUser() { /* 100 lines */ }
  async searchUsers() { /* 200 lines */ }
  async exportUsers() { /* 150 lines */ }
}
```

**Split into logical modules:**

```typescript
// ✅ DO: Split by responsibility

// user.service.ts (200 lines) - Main orchestration
export class UserService {
  constructor(
    private readonly creator: UserCreator,
    private readonly updater: UserUpdater,
    private readonly searcher: UserSearcher
  ) {}

  async createUser(input: CreateUserInput) {
    return this.creator.create(input);
  }

  async updateUser(input: UpdateUserInput) {
    return this.updater.update(input);
  }

  async searchUsers(input: SearchUsersInput) {
    return this.searcher.search(input);
  }
}

// user-creator.ts (150 lines)
export class UserCreator {
  async create(input: CreateUserInput): Promise<User> {
    // Creation logic
  }
}

// user-updater.ts (150 lines)
export class UserUpdater {
  async update(input: UpdateUserInput): Promise<User> {
    // Update logic
  }
}

// user-searcher.ts (200 lines)
export class UserSearcher {
  async search(input: SearchUsersInput): Promise<User[]> {
    // Search logic with filters
  }
}

// index.ts - Barrel export
export { UserService } from './user.service';
export { UserCreator } from './user-creator';
export { UserUpdater } from './user-updater';
export { UserSearcher } from './user-searcher';
```

### Rule: One Component/Class per File

**Each file should export one primary component, class, or function.**

### ✅ DO

```typescript
// user.model.ts
export class UserModel extends BaseModel<User> {
  // Implementation
}

// accommodation.model.ts
export class AccommodationModel extends BaseModel<Accommodation> {
  // Implementation
}
```

### ❌ DON'T

```typescript
// models.ts - Multiple unrelated classes
export class UserModel extends BaseModel<User> { }
export class AccommodationModel extends BaseModel<Accommodation> { }
export class BookingModel extends BaseModel<Booking> { }
```

**Exception**: Related helpers can be in the same file:

```typescript
// user-helpers.ts
export function formatUserName(input: { firstName: string; lastName: string }): string {
  return `${input.firstName} ${input.lastName}`;
}

export function validateUserAge(age: number): boolean {
  return age >= 18 && age <= 120;
}
```

## Naming Conventions

### File Names: kebab-case

```text
✅ DO:
user-service.ts
accommodation-model.ts
create-booking-route.ts
booking-price-calculator.ts

❌ DON'T:
UserService.ts
accommodationModel.ts
CreateBookingRoute.ts
booking_price_calculator.ts
```

### Folder Names: kebab-case

```text
✅ DO:
src/
├── api-routes/
├── business-logic/
├── data-access/
└── error-handlers/

❌ DON'T:
src/
├── ApiRoutes/
├── businessLogic/
├── data_access/
└── ErrorHandlers/
```

### Variables and Functions: camelCase

```typescript
// ✅ DO:
const userName = 'John';
const bookingPrice = 100;
function calculateTotal() { }
function getUserById() { }

// ❌ DON'T:
const UserName = 'John';          // PascalCase
const booking_price = 100;        // snake_case
function CalculateTotal() { }     // PascalCase
function get_user_by_id() { }     // snake_case
```

### Classes and Types: PascalCase

```typescript
// ✅ DO:
class UserService { }
class AccommodationModel { }
type CreateUserInput = { };
interface BookingResponse { }

// ❌ DON'T:
class userService { }             // camelCase
class accommodation_model { }     // snake_case
type createUserInput = { };       // camelCase
interface booking_response { }    // snake_case
```

### Constants: SCREAMING_SNAKE_CASE

```typescript
// ✅ DO:
const MAX_UPLOAD_SIZE = 1024 * 1024 * 10; // 10MB
const DEFAULT_PAGE_SIZE = 20;
const API_BASE_URL = 'https://api.hospeda.com';
const WEEKEND_SURCHARGE_RATE = 1.2;

// ❌ DON'T:
const maxUploadSize = 1024 * 1024 * 10;
const defaultPageSize = 20;
const ApiBaseUrl = 'https://api.hospeda.com';
```

### Boolean Variables: is/has/should Prefix

```typescript
// ✅ DO:
const isAvailable = true;
const hasPermission = false;
const shouldValidate = true;
const canEdit = true;
const wasSuccessful = false;

// ❌ DON'T:
const available = true;           // Unclear if boolean
const permission = false;         // Unclear if boolean
const validate = true;            // Looks like a function
```

### Functions: Verb + Noun

```typescript
// ✅ DO:
function getUser() { }
function createBooking() { }
function updateAccommodation() { }
function deleteReview() { }
function validateInput() { }
function calculatePrice() { }
function formatDate() { }

// ❌ DON'T:
function user() { }               // Not a verb
function booking() { }            // Unclear action
function accommodation() { }      // Unclear action
```

### Private Members: Underscore Prefix

```typescript
class UserService {
  // ✅ DO: Private members prefixed with underscore
  private readonly _model: UserModel;
  private _cache: Map<string, User>;

  constructor(model: UserModel) {
    this._model = model;
    this._cache = new Map();
  }

  // Public members without prefix
  public async getUser(id: string): Promise<User> {
    return this._model.findById({ id });
  }

  private _clearCache(): void {
    this._cache.clear();
  }
}
```

## Import Organization

### Rule: Organize Imports by Source

**Imports should be organized in this order:**

1. External packages (from `node_modules`)
2. Internal packages (from `@repo/*`)
3. Relative imports (same package)
4. Type imports (last)

**Within each group, sort alphabetically.**

### ✅ DO

```typescript
// 1. External packages
import { Hono } from 'hono';
import { z } from 'zod';

// 2. Internal packages
import { UserModel } from '@repo/db/models';
import { createUserSchema } from '@repo/schemas';
import { logger } from '@repo/logger';

// 3. Relative imports
import { validateUserInput } from './validators';
import { formatUserResponse } from '../utils/formatters';

// 4. Type imports
import type { User } from '@repo/db/types';
import type { ServiceContext } from '../types';
```

### ❌ DON'T

```typescript
// Mixed order, hard to find imports
import { formatUserResponse } from '../utils/formatters';
import type { User } from '@repo/db/types';
import { Hono } from 'hono';
import { UserModel } from '@repo/db/models';
import { validateUserInput } from './validators';
import { z } from 'zod';
import type { ServiceContext } from '../types';
```

### Biome Auto-Formatting

Biome will auto-organize imports when you run:

```bash
pnpm lint --fix
```

## JSDoc Requirements

### Rule: All Exports Must Have JSDoc

**Every exported function, class, type, and constant must have JSDoc.**

### Minimum JSDoc Structure

```typescript
/**
 * Brief one-line description
 *
 * @param paramName - Description
 * @returns Description
 */
```

### Function JSDoc Example

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
 * console.log(total); // 385 (300 + 50 + 35 service fee)
 * ```
 */
export function calculateBookingPrice(input: {
  nightlyRate: number;
  numberOfNights: number;
  cleaningFee: number;
  serviceFeeRate: number;
}): number {
  const subtotal = input.nightlyRate * input.numberOfNights + input.cleaningFee;
  const serviceFee = subtotal * input.serviceFeeRate;
  return subtotal + serviceFee;
}
```

### Class JSDoc Example

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
export class UserService extends BaseCrudService<
  User,
  UserModel,
  CreateUserSchema,
  UpdateUserSchema
> {
  /**
   * Create a new user account
   *
   * Validates input, hashes password, and creates user record.
   * Sends welcome email after successful creation.
   *
   * @param input - User creation data
   * @returns Created user object
   * @throws {ValidationError} If input validation fails
   * @throws {ConflictError} If email already exists
   */
  async createUser(input: CreateUserInput): Promise<User> {
    // Implementation
  }
}
```

### Type JSDoc Example

```typescript
/**
 * Input parameters for creating a new accommodation
 *
 * All fields are required except `amenities` which defaults to empty array.
 */
export type CreateAccommodationInput = z.infer<typeof createAccommodationSchema>;

/**
 * Accommodation availability status
 *
 * - `available` - Accommodation can be booked
 * - `unavailable` - Temporarily unavailable
 * - `maintenance` - Under maintenance
 */
export type AccommodationStatus = 'available' | 'unavailable' | 'maintenance';
```

### Constant JSDoc Example

```typescript
/**
 * Maximum file size for image uploads (10MB)
 *
 * Images exceeding this size will be rejected with a 413 error.
 */
export const MAX_IMAGE_SIZE = 1024 * 1024 * 10;

/**
 * Default pagination page size
 *
 * Used when client doesn't specify page size in request.
 */
export const DEFAULT_PAGE_SIZE = 20;
```

## Comments

### Rule: Explain WHY, Not WHAT

**Comments should explain the reasoning behind code, not describe what the code does.**

### ✅ DO

```typescript
// Use transaction to ensure both booking and payment are created atomically
// If payment fails, booking should not exist in database
return db.transaction(async (trx) => {
  const booking = await createBooking(trx, bookingData);
  const payment = await createPayment(trx, paymentData);
  return { booking, payment };
});

// Saturday and Sunday are considered weekend nights (0 and 6)
// Friday is NOT considered weekend for pricing purposes per business rules
const isWeekendNight = date.getDay() === 0 || date.getDay() === 6;

// Soft delete to maintain audit trail and allow recovery
// Hard delete would break referential integrity with bookings
await model.softDelete({ id });
```

### ❌ DON'T

```typescript
// Create booking and payment in transaction
return db.transaction(async (trx) => {
  const booking = await createBooking(trx, bookingData);
  const payment = await createPayment(trx, paymentData);
  return { booking, payment };
});

// Check if day is weekend
const isWeekendNight = date.getDay() === 0 || date.getDay() === 6;

// Soft delete
await model.softDelete({ id });
```

### TODO Comments

**TODO comments must include context and assignee:**

```typescript
// ✅ DO: TODO with context
// TODO(john): Implement retry logic for failed payments
//   - Retry up to 3 times with exponential backoff
//   - Log failed attempts to Sentry
//   - Notify user on final failure
//   Issue: #123

// ❌ DON'T: Vague TODO
// TODO: fix this
```

### Complex Logic Comments

For complex algorithms, explain the approach:

```typescript
/**
 * Calculate dynamic pricing based on demand and seasonality
 *
 * Algorithm:
 * 1. Start with base price from accommodation settings
 * 2. Apply seasonal multiplier (high/low season from calendar)
 * 3. Calculate occupancy rate for next 30 days
 * 4. If occupancy > 70%, apply demand multiplier
 * 5. Apply weekend surcharge if applicable
 * 6. Round to nearest 10 for psychological pricing
 *
 * Example:
 * Base: $100
 * High season (×1.3) = $130
 * 80% occupancy (×1.15) = $149.50
 * Weekend (×1.2) = $179.40
 * Rounded = $180
 */
export function calculateDynamicPrice(input: DynamicPricingInput): number {
  let price = input.basePrice;

  // Step 1: Apply seasonal multiplier
  const seasonMultiplier = getSeasonMultiplier(input.date);
  price *= seasonMultiplier;

  // Step 2: Apply demand multiplier based on occupancy
  const occupancyRate = calculateOccupancyRate(input.accommodationId);
  if (occupancyRate > 0.7) {
    // Linear increase: 70% = 1.0×, 100% = 1.5×
    const demandMultiplier = 1 + ((occupancyRate - 0.7) * 0.5 / 0.3);
    price *= demandMultiplier;
  }

  // Step 3: Apply weekend surcharge
  if (isWeekend(input.date)) {
    price *= WEEKEND_SURCHARGE_RATE;
  }

  // Step 4: Round to nearest 10 for psychological pricing
  // $179.40 becomes $180, $181 becomes $180
  return Math.round(price / 10) * 10;
}
```

## Error Handling

### Rule: Never Swallow Errors

**Always handle errors appropriately. Never catch and ignore.**

### ✅ DO

```typescript
try {
  await sendEmail(user.email, 'Welcome');
} catch (error) {
  // Log error and re-throw or handle gracefully
  logger.error('Failed to send welcome email', { error, userId: user.id });

  // Decide: Is this critical?
  // If yes: re-throw
  throw new EmailDeliveryError('Failed to send welcome email', { cause: error });

  // If no: continue but track
  // (User created successfully, email can be retried)
}
```

### ❌ DON'T

```typescript
try {
  await sendEmail(user.email, 'Welcome');
} catch (error) {
  // Silently ignore - BAD!
}

try {
  await sendEmail(user.email, 'Welcome');
} catch (error) {
  console.log('Error'); // No context, swallowed
}
```

### Rule: Use Custom Error Classes

**Create custom error classes for different error types:**

```typescript
// error-classes.ts
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

export class ConflictError extends Error {
  constructor(
    message: string,
    public readonly field: string
  ) {
    super(message);
    this.name = 'ConflictError';
  }
}

// Usage
if (!user) {
  throw new NotFoundError('User not found', 'User', userId);
}

if (existingEmail) {
  throw new ConflictError('Email already exists', 'email');
}
```

### Rule: Meaningful Error Messages

**Error messages should be clear and actionable:**

```typescript
// ✅ DO: Specific, actionable
throw new ValidationError(
  'Email must be a valid email address',
  'email'
);

throw new ValidationError(
  'Price must be between $10 and $10,000',
  'pricePerNight'
);

// ❌ DON'T: Vague, not helpful
throw new Error('Invalid input');
throw new Error('Something went wrong');
```

## Validation

### Rule: Use Zod Schemas

**All input validation must use Zod schemas:**

```typescript
// ✅ DO: Zod schema validation
import { z } from 'zod';

const createUserSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  age: z.number().int().positive().max(120),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export function createUser(input: unknown): User {
  // Validate and parse input
  const validatedInput = createUserSchema.parse(input);

  // Now TypeScript knows the exact type
  return {
    id: generateId(),
    name: validatedInput.name,
    email: validatedInput.email,
    age: validatedInput.age,
  };
}
```

### Rule: Validate at Boundaries

**Validate data at system boundaries (API endpoints, external services):**

```typescript
// API route
app.post('/users', async (c) => {
  const body = await c.req.json();

  // Validate at boundary
  const input = createUserSchema.parse(body);

  // Now safe to use
  const user = await userService.createUser(input);
  return c.json({ success: true, data: user });
});
```

### Rule: Never Trust Input

**Always validate external data, even from "trusted" sources:**

```typescript
// ✅ DO: Validate external API response
const externalDataSchema = z.object({
  userId: z.string(),
  status: z.enum(['active', 'inactive']),
  updatedAt: z.string().datetime(),
});

const response = await fetch('https://external-api.com/user');
const rawData = await response.json();

// Validate before using
const data = externalDataSchema.parse(rawData);
```

## Async/Await

### Rule: Prefer async/await Over Promises

**Use async/await instead of `.then()` chains:**

```typescript
// ✅ DO: async/await
export async function getUserWithBookings(userId: string): Promise<UserWithBookings> {
  const user = await userModel.findById({ id: userId });

  if (!user) {
    throw new NotFoundError('User not found', 'User', userId);
  }

  const bookings = await bookingModel.findByUserId({ userId });

  return { ...user, bookings };
}

// ❌ DON'T: Promise chains
export function getUserWithBookings(userId: string): Promise<UserWithBookings> {
  return userModel.findById({ id: userId })
    .then(user => {
      if (!user) {
        throw new NotFoundError('User not found', 'User', userId);
      }
      return bookingModel.findByUserId({ userId })
        .then(bookings => ({ ...user, bookings }));
    });
}
```

### Rule: Handle Errors with try/catch

```typescript
// ✅ DO: try/catch for error handling
export async function processBooking(input: CreateBookingInput): Promise<Booking> {
  try {
    const booking = await bookingService.create(input);

    // Non-critical: log but don't fail
    try {
      await notificationService.sendConfirmation(booking);
    } catch (error) {
      logger.error('Failed to send booking confirmation', { error, bookingId: booking.id });
      // Continue - booking was created successfully
    }

    return booking;
  } catch (error) {
    logger.error('Failed to create booking', { error, input });
    throw error;
  }
}
```

### Rule: No Floating Promises

**Always await promises or explicitly handle them:**

```typescript
// ✅ DO: Await the promise
await sendEmail(user.email, 'Welcome');

// ✅ DO: Explicitly fire-and-forget with void
void sendEmail(user.email, 'Welcome'); // Non-critical, don't wait

// ❌ DON'T: Floating promise (unhandled)
sendEmail(user.email, 'Welcome'); // TypeScript will warn
```

## Code Formatting

### Biome Configuration

Hospeda uses **Biome** for linting and formatting.

### Key Formatting Rules

```typescript
// Indentation: 2 spaces
function example() {
  const value = 'test';
  if (value) {
    console.log(value);
  }
}

// Single quotes for strings
const name = 'John';

// Trailing commas (multi-line only)
const obj = {
  name: 'John',
  age: 30, // Trailing comma
};

// Max line length: 100 characters
const longString =
  'This is a very long string that exceeds 100 characters and should be ' +
  'split across multiple lines';

// Arrow function parentheses (always)
const fn = (x) => x * 2;

// Semicolons: Always required
const x = 5;
const y = 10;

// Object literal spacing
const obj = { name: 'John', age: 30 };

// Array spacing
const arr = [1, 2, 3, 4];
```

### Running Biome

```bash
# Check formatting and linting
pnpm lint

# Auto-fix issues
pnpm lint --fix

# Check specific file
pnpm lint path/to/file.ts
```

### Pre-commit Hooks

Biome runs automatically on commit via Husky hooks. If formatting fails, the commit will be rejected.

To bypass hooks for documentation commits:

```bash
git commit --no-verify -m "docs: update README"
```

## Common Patterns

### Pattern: Result Type for Error Handling

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

### Pattern: Service Context

```typescript
export interface ServiceContext {
  actor: {
    id: string;
    role: string;
  };
  logger: Logger;
}

export class UserService {
  constructor(private readonly ctx: ServiceContext) {}

  async createUser(input: CreateUserInput): Promise<User> {
    this.ctx.logger.info('Creating user', { actorId: this.ctx.actor.id });
    // Implementation
  }
}
```

### Pattern: Factory Functions for Routes

```typescript
// ✅ DO: Use factory pattern for routes
export function createUserRoutes(app: Hono): Hono {
  app.post('/users', async (c) => {
    // Handler
  });

  app.get('/users/:id', async (c) => {
    // Handler
  });

  return app;
}
```

## What to Avoid

### Anti-Pattern: Magic Numbers

```typescript
// ❌ DON'T: Magic numbers
if (user.age < 18) {
  // What is 18?
}

if (file.size > 10485760) {
  // What is 10485760?
}

// ✅ DO: Named constants
const MINIMUM_AGE = 18;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

if (user.age < MINIMUM_AGE) {
  throw new ValidationError(`Must be at least ${MINIMUM_AGE} years old`, 'age');
}

if (file.size > MAX_FILE_SIZE) {
  throw new ValidationError(`File must be less than ${MAX_FILE_SIZE} bytes`, 'file');
}
```

### Anti-Pattern: Mutable Global State

```typescript
// ❌ DON'T: Mutable global state
let currentUser: User | null = null;

export function setCurrentUser(user: User) {
  currentUser = user;
}

// ✅ DO: Dependency injection
export class UserService {
  constructor(private readonly ctx: ServiceContext) {}

  getCurrentUser(): User {
    return this.ctx.actor;
  }
}
```

### Anti-Pattern: Commented Code

```typescript
// ❌ DON'T: Leave commented code
export function calculatePrice(input: PriceInput): number {
  const base = input.nightlyRate * input.nights;
  // const discount = base * 0.1;
  // const tax = base * 0.15;
  // return base - discount + tax;
  return base;
}

// ✅ DO: Delete commented code (use git history)
export function calculatePrice(input: PriceInput): number {
  return input.nightlyRate * input.nights;
}
```

### Anti-Pattern: Deep Nesting

```typescript
// ❌ DON'T: Deep nesting
export async function processBooking(input: CreateBookingInput): Promise<Booking> {
  if (input.userId) {
    const user = await userModel.findById({ id: input.userId });
    if (user) {
      if (user.isVerified) {
        const accommodation = await accommodationModel.findById({ id: input.accommodationId });
        if (accommodation) {
          if (accommodation.isAvailable) {
            // 5 levels deep!
            return bookingModel.create(input);
          }
        }
      }
    }
  }
  throw new Error('Invalid booking');
}

// ✅ DO: Early returns
export async function processBooking(input: CreateBookingInput): Promise<Booking> {
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

  const accommodation = await accommodationModel.findById({ id: input.accommodationId });
  if (!accommodation) {
    throw new NotFoundError('Accommodation not found', 'Accommodation', input.accommodationId);
  }

  if (!accommodation.isAvailable) {
    throw new ValidationError('Accommodation not available', 'accommodationId');
  }

  return bookingModel.create(input);
}
```

### Anti-Pattern: console.log in Production

```typescript
// ❌ DON'T: Use console.log
export function processPayment(input: PaymentInput) {
  console.log('Processing payment', input); // Bad!
  // Implementation
}

// ✅ DO: Use logger
import { logger } from '@repo/logger';

export function processPayment(input: PaymentInput) {
  logger.info('Processing payment', {
    paymentId: input.id,
    amount: input.amount,
    // Don't log sensitive data!
  });
  // Implementation
}
```

---

## Summary Checklist

Before submitting code, verify:

- [ ] All code and comments in English
- [ ] No `any` types (use `unknown` with guards)
- [ ] Named exports only (no default exports)
- [ ] RO-RO pattern for functions with 3+ params
- [ ] Files under 500 lines
- [ ] Proper naming conventions (camelCase, PascalCase, kebab-case)
- [ ] Imports organized by source
- [ ] JSDoc on all exports
- [ ] Comments explain WHY, not WHAT
- [ ] Custom error classes used
- [ ] Zod validation at boundaries
- [ ] async/await (not promise chains)
- [ ] No floating promises
- [ ] Biome formatting applied (`pnpm lint --fix`)
- [ ] No magic numbers
- [ ] No commented code
- [ ] No `console.log` (use logger)
- [ ] Early returns (avoid deep nesting)

---

## Further Reading

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Zod Documentation](https://zod.dev)
- [Biome Documentation](https://biomejs.dev)
- [Architecture Patterns](.claude/docs/standards/architecture-patterns.md)
- [Testing Standards](.claude/docs/standards/testing-standards.md)

---

*Last updated: 2025-01-15*
