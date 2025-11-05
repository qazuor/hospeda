# ServiceOutput API Reference

Complete API documentation for the `ServiceOutput<T>` type and Result pattern used throughout the service layer.

## Table of Contents

- [Overview](#overview)
- [Why Result Pattern](#why-result-pattern)
- [Type Definitions](#type-definitions)
- [Usage Patterns](#usage-patterns)
- [Type Guards](#type-guards)
- [Best Practices](#best-practices)
- [Examples](#examples)

## Overview

`ServiceOutput<T>` is a discriminated union type that represents the result of any service operation. It ensures type-safe error handling without throwing exceptions, making error cases explicit and forcing consumers to handle them.

**Key Benefits:**

- **No Exceptions**: Services never throw - all errors are returned as values
- **Type Safety**: TypeScript enforces error handling at compile time
- **Explicit Errors**: Error cases are visible in the type signature
- **Consistent API**: All service methods follow the same pattern
- **Better DX**: IDE autocomplete and type checking for error cases

## Why Result Pattern

### Traditional Exception Handling (❌ Don't Use)

```typescript
// Problems:
// 1. Errors are invisible in the type signature
// 2. Easy to forget error handling
// 3. Try-catch blocks are verbose
// 4. No type safety for error cases

try {
  const accommodation = await service.create(data);
  console.log(accommodation.id); // What if this throws?
} catch (error) {
  // What type is error?
  // How do I know what errors can occur?
  console.error(error);
}
```

### Result Pattern (✅ Use This)

```typescript
// Benefits:
// 1. Errors are explicit in the return type
// 2. TypeScript forces you to handle errors
// 3. No try-catch needed
// 4. Full type safety

const result = await service.create(data);

if (result.data) {
  // TypeScript knows result.data is Accommodation
  console.log(result.data.id);
} else {
  // TypeScript knows result.error exists
  console.error(result.error.code, result.error.message);
}
```

## Type Definitions

### ServiceOutput<T>

Main result type that all service methods return.

```typescript
export type ServiceOutput<T> =
  | {
      /** The success data */
      data: T;
      /** Error is never present in success case */
      error?: never;
    }
  | {
      /** Data is never present in error case */
      data?: never;
      /** The error information */
      error: {
        /** Error code */
        code: ServiceErrorCode;
        /** Error message */
        message: string;
        /** Optional additional details for debugging or context */
        details?: unknown;
      };
    };
```

**Type Parameters:**

| Parameter | Description |
|-----------|-------------|
| T | The type of data returned on success |

**Properties (Success Case):**

| Property | Type | Description |
|----------|------|-------------|
| data | T | The successful result data |
| error | never | Explicitly undefined in success case |

**Properties (Error Case):**

| Property | Type | Description |
|----------|------|-------------|
| data | never | Explicitly undefined in error case |
| error | ErrorObject | Error information |
| error.code | ServiceErrorCode | Machine-readable error code |
| error.message | string | Human-readable error message |
| error.details | unknown | Optional additional error context |

### ServiceError

Error class used internally by services.

```typescript
export class ServiceError extends Error {
  constructor(
    public code: ServiceErrorCode,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}
```

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| code | ServiceErrorCode | Error code from ServiceErrorCode enum |
| message | string | Human-readable error message |
| details | unknown | Optional additional details for debugging |
| name | string | Always 'ServiceError' |

### ServiceErrorCode

Enum of all possible error codes.

```typescript
export enum ServiceErrorCode {
  /** Input validation failed */
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  /** Entity not found */
  NOT_FOUND = 'NOT_FOUND',

  /** User is not authenticated */
  UNAUTHORIZED = 'UNAUTHORIZED',

  /** User is not authorized to perform the action */
  FORBIDDEN = 'FORBIDDEN',

  /** Unexpected internal error */
  INTERNAL_ERROR = 'INTERNAL_ERROR',

  /** Entity or assignment already exists */
  ALREADY_EXISTS = 'ALREADY_EXISTS',

  /** Invalid pagination parameters provided */
  INVALID_PAGINATION_PARAMS = 'INVALID_PAGINATION_PARAMS',

  /** Method is not implemented */
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED'
}
```

See [Error Handling Guide](./errors.md) for detailed documentation on each error code.

### ServiceInput<T>

Type for service method inputs that include an actor.

```typescript
export type ServiceInput<T> = {
  /** The actor performing the action */
  actor: Actor;
} & T;
```

**Example:**

```typescript
type CreateAccommodationInput = ServiceInput<{
  name: string;
  description: string;
  city: string;
}>;

// Equivalent to:
type CreateAccommodationInput = {
  actor: Actor;
  name: string;
  description: string;
  city: string;
};
```

### Actor

Represents a user or system performing an action.

```typescript
export type Actor = {
  /** Unique identifier of the actor */
  id: string;
  /** Role of the actor in the system */
  role: RoleEnum;
  /** Permissions assigned to the actor (direct + by role) */
  permissions: PermissionEnum[];
};
```

## Usage Patterns

### Basic Success/Error Handling

```typescript
const result = await service.create(actor, data);

if (result.data) {
  // Success case - TypeScript knows result.data is defined
  console.log('Created:', result.data.id);
} else {
  // Error case - TypeScript knows result.error is defined
  console.error('Failed:', result.error.code, result.error.message);
}
```

### Handling Specific Error Codes

```typescript
const result = await service.getById(actor, id);

if (result.data) {
  console.log('Found:', result.data);
} else if (result.error.code === ServiceErrorCode.NOT_FOUND) {
  console.log('Entity does not exist');
} else if (result.error.code === ServiceErrorCode.FORBIDDEN) {
  console.error('Access denied');
} else {
  console.error('Unexpected error:', result.error.message);
}
```

### Switch Statement Pattern

```typescript
const result = await service.update(actor, id, data);

if (result.data) {
  return result.data;
}

switch (result.error.code) {
  case ServiceErrorCode.NOT_FOUND:
    throw new NotFoundError('Entity not found');

  case ServiceErrorCode.FORBIDDEN:
    throw new ForbiddenError('Access denied');

  case ServiceErrorCode.VALIDATION_ERROR:
    return { validationErrors: result.error.details };

  default:
    throw new InternalError(result.error.message);
}
```

### Early Return Pattern

```typescript
async function processAccommodation(id: string) {
  const result = await service.getById(actor, id);

  if (!result.data) {
    // Early return on error
    return { error: result.error };
  }

  // Continue with success case
  const accommodation = result.data;
  console.log(accommodation.name);

  // Process accommodation...
}
```

### Chaining Operations

```typescript
async function createAndPublish(data: CreateData) {
  // Create
  const createResult = await service.create(actor, data);
  if (!createResult.data) {
    return createResult; // Propagate error
  }

  // Publish
  const publishResult = await service.updateVisibility(
    actor,
    createResult.data.id,
    VisibilityEnum.PUBLIC
  );

  if (!publishResult.data) {
    // Rollback?
    await service.softDelete(actor, createResult.data.id);
    return publishResult; // Propagate error
  }

  return { data: publishResult.data };
}
```

### Collecting Multiple Results

```typescript
async function getMultipleEntities(ids: string[]) {
  const results = await Promise.all(
    ids.map(id => service.getById(actor, id))
  );

  // Separate successes and failures
  const successes = results
    .filter(r => r.data !== undefined)
    .map(r => r.data!);

  const failures = results
    .filter(r => r.error !== undefined)
    .map(r => r.error!);

  return {
    found: successes,
    errors: failures
  };
}
```

### Transforming Results

```typescript
async function getAccommodationSummary(id: string) {
  const result = await service.getById(actor, id);

  if (!result.data) {
    return result; // Propagate error with same type
  }

  // Transform success data
  return {
    data: {
      id: result.data.id,
      name: result.data.name,
      summary: `${result.data.name} in ${result.data.city}`
    }
  };
}
```

## Type Guards

### isSuccess

Check if result is a success.

```typescript
function isSuccess<T>(result: ServiceOutput<T>): result is { data: T; error?: never } {
  return result.data !== undefined;
}

// Usage
const result = await service.create(actor, data);

if (isSuccess(result)) {
  console.log(result.data.id); // TypeScript knows data exists
}
```

### isError

Check if result is an error.

```typescript
function isError<T>(result: ServiceOutput<T>): result is { data?: never; error: { code: ServiceErrorCode; message: string; details?: unknown } } {
  return result.error !== undefined;
}

// Usage
const result = await service.create(actor, data);

if (isError(result)) {
  console.error(result.error.code); // TypeScript knows error exists
}
```

### hasErrorCode

Check if result has a specific error code.

```typescript
function hasErrorCode<T>(
  result: ServiceOutput<T>,
  code: ServiceErrorCode
): boolean {
  return result.error?.code === code;
}

// Usage
const result = await service.getById(actor, id);

if (hasErrorCode(result, ServiceErrorCode.NOT_FOUND)) {
  console.log('Entity does not exist');
}
```

## Best Practices

### ✅ Do: Always Handle Both Cases

```typescript
// GOOD: Explicitly handle success and error
const result = await service.create(actor, data);

if (result.data) {
  processSuccess(result.data);
} else {
  handleError(result.error);
}
```

### ❌ Don't: Assume Success

```typescript
// BAD: Assumes success without checking
const result = await service.create(actor, data);
console.log(result.data.id); // Runtime error if result.error!
```

### ✅ Do: Use Type Guards for Clarity

```typescript
// GOOD: Explicit type guard
const result = await service.create(actor, data);

if (isSuccess(result)) {
  return result.data;
}

throw new Error(result.error.message);
```

### ❌ Don't: Use Non-null Assertions

```typescript
// BAD: Forces type without checking
const result = await service.create(actor, data);
const data = result.data!; // Dangerous!
```

### ✅ Do: Propagate Errors

```typescript
// GOOD: Let caller handle errors
async function wrapper(id: string): Promise<ServiceOutput<Entity>> {
  const result = await service.getById(actor, id);

  if (!result.data) {
    return result; // Propagate error
  }

  // Process and return
  return { data: processEntity(result.data) };
}
```

### ✅ Do: Handle Errors at the Right Level

```typescript
// GOOD: API layer converts to HTTP responses
app.post('/accommodations', async (c) => {
  const result = await service.create(actor, data);

  if (result.data) {
    return c.json({ success: true, data: result.data }, 201);
  }

  // Convert service errors to HTTP status codes
  const statusCode = getHttpStatusCode(result.error.code);
  return c.json({
    success: false,
    error: {
      code: result.error.code,
      message: result.error.message
    }
  }, statusCode);
});
```

### ✅ Do: Log Errors Appropriately

```typescript
// GOOD: Log with context
const result = await service.update(actor, id, data);

if (!result.data) {
  logger.error('Failed to update accommodation', {
    entityId: id,
    actorId: actor.id,
    errorCode: result.error.code,
    errorMessage: result.error.message,
    errorDetails: result.error.details
  });

  return result; // Still propagate for caller to handle
}
```

### ✅ Do: Provide Helpful Error Details

```typescript
// GOOD: Include validation errors in details
if (!result.data && result.error.code === ServiceErrorCode.VALIDATION_ERROR) {
  return c.json({
    success: false,
    error: {
      code: result.error.code,
      message: 'Validation failed',
      fields: result.error.details // { name: ['Required'], price: ['Must be positive'] }
    }
  }, 400);
}
```

## Examples

### Example 1: API Route Handler

```typescript
import { Hono } from 'hono';
import { AccommodationService } from '@repo/service-core';

const app = new Hono();

app.post('/accommodations', async (c) => {
  const actor = c.get('actor'); // From auth middleware
  const data = await c.req.json();

  const service = new AccommodationService({ logger: c.get('logger') });
  const result = await service.create(actor, data);

  if (result.data) {
    return c.json({
      success: true,
      data: result.data
    }, 201);
  }

  // Map error codes to HTTP status codes
  const statusMap: Record<ServiceErrorCode, number> = {
    [ServiceErrorCode.VALIDATION_ERROR]: 400,
    [ServiceErrorCode.UNAUTHORIZED]: 401,
    [ServiceErrorCode.FORBIDDEN]: 403,
    [ServiceErrorCode.NOT_FOUND]: 404,
    [ServiceErrorCode.ALREADY_EXISTS]: 409,
    [ServiceErrorCode.INTERNAL_ERROR]: 500,
    [ServiceErrorCode.INVALID_PAGINATION_PARAMS]: 400,
    [ServiceErrorCode.NOT_IMPLEMENTED]: 501
  };

  const status = statusMap[result.error.code] ?? 500;

  return c.json({
    success: false,
    error: {
      code: result.error.code,
      message: result.error.message,
      ...(result.error.details && { details: result.error.details })
    }
  }, status);
});
```

### Example 2: Frontend Data Fetching

```typescript
// React Query example
import { useQuery } from '@tanstack/react-query';
import type { ServiceOutput } from '@repo/service-core';
import type { Accommodation } from '@repo/types';

async function fetchAccommodation(id: string): Promise<ServiceOutput<Accommodation>> {
  const response = await fetch(`/api/accommodations/${id}`);
  return response.json();
}

export function useAccommodation(id: string) {
  return useQuery({
    queryKey: ['accommodations', id],
    queryFn: () => fetchAccommodation(id),
    select: (result) => {
      if (result.data) {
        return { data: result.data, error: null };
      }
      return { data: null, error: result.error };
    }
  });
}

// Usage in component
function AccommodationDetail({ id }: { id: string }) {
  const { data: result, isLoading } = useAccommodation(id);

  if (isLoading) return <div>Loading...</div>;

  if (!result?.data) {
    if (result?.error.code === ServiceErrorCode.NOT_FOUND) {
      return <div>Accommodation not found</div>;
    }
    return <div>Error: {result?.error.message}</div>;
  }

  return <div>{result.data.name}</div>;
}
```

### Example 3: Service Composition

```typescript
export class BookingService {
  constructor(
    private accommodationService: AccommodationService,
    private paymentService: PaymentService
  ) {}

  async createBooking(
    actor: Actor,
    data: CreateBookingData
  ): Promise<ServiceOutput<Booking>> {
    // Verify accommodation exists and is available
    const accommodationResult = await this.accommodationService.getById(
      actor,
      data.accommodationId
    );

    if (!accommodationResult.data) {
      return accommodationResult; // Propagate error
    }

    const accommodation = accommodationResult.data;

    // Check availability
    if (!accommodation.isAvailable) {
      return {
        error: {
          code: ServiceErrorCode.VALIDATION_ERROR,
          message: 'Accommodation is not available',
          details: { accommodationId: accommodation.id }
        }
      };
    }

    // Create payment
    const paymentResult = await this.paymentService.create(actor, {
      amount: accommodation.price * data.nights,
      currency: 'USD'
    });

    if (!paymentResult.data) {
      return paymentResult; // Propagate error
    }

    // Create booking
    const bookingResult = await this.bookingModel.create({
      ...data,
      paymentId: paymentResult.data.id,
      status: 'confirmed'
    });

    return { data: bookingResult };
  }
}
```

### Example 4: Error Recovery

```typescript
async function createAccommodationWithRetry(
  actor: Actor,
  data: CreateData,
  maxRetries = 3
): Promise<ServiceOutput<Accommodation>> {
  let lastError: ServiceOutput<Accommodation>['error'] | undefined;

  for (let i = 0; i < maxRetries; i++) {
    const result = await service.create(actor, data);

    if (result.data) {
      return result; // Success
    }

    // Don't retry validation or permission errors
    if (
      result.error.code === ServiceErrorCode.VALIDATION_ERROR ||
      result.error.code === ServiceErrorCode.FORBIDDEN ||
      result.error.code === ServiceErrorCode.UNAUTHORIZED
    ) {
      return result; // Return immediately
    }

    // Store error and retry
    lastError = result.error;
    await sleep(Math.pow(2, i) * 1000); // Exponential backoff
  }

  // All retries failed
  return {
    error: {
      code: ServiceErrorCode.INTERNAL_ERROR,
      message: `Failed after ${maxRetries} retries`,
      details: lastError
    }
  };
}
```

## See Also

- [BaseCrudService API Reference](./BaseCrudService.md) - Service methods that return ServiceOutput
- [Error Handling Guide](./errors.md) - Detailed error code documentation
- [Service Guide](../guides/services.md) - How to create and use services
