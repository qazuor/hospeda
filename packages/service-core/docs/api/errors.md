# Error Handling API Reference

Complete guide to the error handling system in the service layer, including error codes, patterns, and best practices.

## Table of Contents

- [Overview](#overview)
- [ServiceError Class](#serviceerror-class)
- [ServiceErrorCode Enum](#serviceerrorcode-enum)
- [Error Creation](#error-creation)
- [Error Handling Patterns](#error-handling-patterns)
- [HTTP Status Code Mapping](#http-status-code-mapping)
- [Error Logging](#error-logging)
- [Common Scenarios](#common-scenarios)
- [Troubleshooting](#troubleshooting)

## Overview

The Hospeda service layer uses a **Result pattern** for error handling, where services never throw exceptions. Instead, all operations return a `ServiceOutput<T>` type that explicitly represents either success or failure.

**Key Principles:**

- **No Exceptions**: Services return errors as values, not thrown exceptions
- **Type Safety**: TypeScript enforces error handling at compile time
- **Consistent Codes**: All errors use standardized `ServiceErrorCode` enum
- **Rich Context**: Errors include code, message, and optional details
- **Traceable**: All errors are automatically logged with context

## ServiceError Class

### Overview

`ServiceError` is the internal error class used throughout the service layer. It extends JavaScript's native `Error` class and adds structured error information.

### Class Definition

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

### Properties

| Property | Type | Description |
|----------|------|-------------|
| code | ServiceErrorCode | Machine-readable error code from enum |
| message | string | Human-readable error message (inherited from Error) |
| details | unknown | Optional additional context or debugging information |
| name | string | Always 'ServiceError' (inherited from Error) |
| stack | string | Error stack trace (inherited from Error) |

### Usage

```typescript
import { ServiceError, ServiceErrorCode } from '@repo/service-core';

// Basic error
throw new ServiceError(
  ServiceErrorCode.NOT_FOUND,
  'Accommodation not found'
);

// Error with details
throw new ServiceError(
  ServiceErrorCode.VALIDATION_ERROR,
  'Invalid input data',
  {
    field: 'price',
    reason: 'Must be a positive number',
    provided: -100
  }
);

// Error with nested error
try {
  await database.query(sql);
} catch (dbError) {
  throw new ServiceError(
    ServiceErrorCode.INTERNAL_ERROR,
    'Database operation failed',
    dbError // Include original error
  );
}
```

### Notes

- Services automatically catch `ServiceError` and convert it to `ServiceOutput` format
- Never throw `ServiceError` from public service methods - return it via `ServiceOutput`
- Use `ServiceError` in protected/private methods and hooks

## ServiceErrorCode Enum

### Overview

`ServiceErrorCode` is an enum of all possible error codes in the system. Each code represents a specific error condition with a consistent meaning across all services.

### Complete List

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

### Error Code Details

#### VALIDATION_ERROR

**When to use:**

- Input data fails Zod schema validation
- Business rule validation fails
- Invalid field values or combinations
- Required fields missing
- Field format incorrect (email, URL, etc.)

**HTTP Status:** `400 Bad Request`

**Example Scenarios:**

```typescript
// Missing required field
throw new ServiceError(
  ServiceErrorCode.VALIDATION_ERROR,
  'Name is required'
);

// Invalid format
throw new ServiceError(
  ServiceErrorCode.VALIDATION_ERROR,
  'Invalid email format',
  { field: 'email', value: 'not-an-email' }
);

// Business rule violation
throw new ServiceError(
  ServiceErrorCode.VALIDATION_ERROR,
  'Check-out date must be after check-in date',
  {
    checkIn: '2024-01-15',
    checkOut: '2024-01-10'
  }
);

// Zod validation (automatically generated)
const result = createSchema.safeParse(input);
if (!result.success) {
  throw new ServiceError(
    ServiceErrorCode.VALIDATION_ERROR,
    'Validation failed: name: Required; price: Must be positive',
    {
      fieldErrors: result.error.flatten().fieldErrors,
      formErrors: result.error.flatten().formErrors
    }
  );
}
```

---

#### NOT_FOUND

**When to use:**

- Entity does not exist in database
- Resource not found by ID, slug, or other identifier
- Related entity missing

**HTTP Status:** `404 Not Found`

**Example Scenarios:**

```typescript
// Entity not found by ID
const entity = await model.findById(id);
if (!entity) {
  throw new ServiceError(
    ServiceErrorCode.NOT_FOUND,
    'Accommodation not found'
  );
}

// Entity not found by slug
const entity = await model.findBySlug(slug);
if (!entity) {
  throw new ServiceError(
    ServiceErrorCode.NOT_FOUND,
    `Accommodation with slug "${slug}" not found`
  );
}
```

**Notes:**

- Use for missing entities, not missing fields in entities
- Always include the entity type in the message
- Optionally include the identifier in details

---

#### UNAUTHORIZED

**When to use:**

- User is not authenticated
- Authentication token is missing
- Authentication token is invalid or expired
- User identity cannot be verified

**HTTP Status:** `401 Unauthorized`

**Example Scenarios:**

```typescript
// No authentication token
if (!authToken) {
  throw new ServiceError(
    ServiceErrorCode.UNAUTHORIZED,
    'Authentication required'
  );
}

// Invalid token
try {
  const user = await verifyToken(authToken);
} catch (error) {
  throw new ServiceError(
    ServiceErrorCode.UNAUTHORIZED,
    'Invalid or expired authentication token',
    error
  );
}

// Actor validation failed
if (!actor.id) {
  throw new ServiceError(
    ServiceErrorCode.UNAUTHORIZED,
    'Valid actor required for this operation'
  );
}
```

**Note:** `UNAUTHORIZED` means "who are you?" while `FORBIDDEN` means "I know who you are, but you can't do this."

---

#### FORBIDDEN

**When to use:**

- User is authenticated but lacks required permissions
- User attempts to access resource they don't own
- Operation violates access control rules
- Role-based access control denies operation

**HTTP Status:** `403 Forbidden`

**Example Scenarios:**

```typescript
// Missing permission
if (!actor.permissions.includes(PermissionEnum.UPDATE_ACCOMMODATION)) {
  throw new ServiceError(
    ServiceErrorCode.FORBIDDEN,
    'You do not have permission to update accommodations',
    { requiredPermission: PermissionEnum.UPDATE_ACCOMMODATION }
  );
}

// Not resource owner
if (entity.createdById !== actor.id && actor.role !== RoleEnum.ADMIN) {
  throw new ServiceError(
    ServiceErrorCode.FORBIDDEN,
    'You can only update your own accommodations',
    { entityId: entity.id, ownerId: entity.createdById }
  );
}

// Role check failed
if (actor.role !== RoleEnum.ADMIN) {
  throw new ServiceError(
    ServiceErrorCode.FORBIDDEN,
    'Only administrators can perform this action',
    { requiredRole: RoleEnum.ADMIN, userRole: actor.role }
  );
}

// Visibility check
if (entity.visibility === VisibilityEnum.PRIVATE && entity.createdById !== actor.id) {
  throw new ServiceError(
    ServiceErrorCode.FORBIDDEN,
    'This accommodation is private',
    { visibility: entity.visibility }
  );
}
```

---

#### INTERNAL_ERROR

**When to use:**

- Unexpected exceptions occur
- Database errors (connection, query failures)
- External service failures
- Programming errors
- Unrecoverable errors

**HTTP Status:** `500 Internal Server Error`

**Example Scenarios:**

```typescript
// Database error
try {
  await db.insert(data);
} catch (dbError) {
  throw new ServiceError(
    ServiceErrorCode.INTERNAL_ERROR,
    'Failed to create entity in database',
    {
      operation: 'insert',
      table: 'accommodations',
      error: dbError
    }
  );
}

// Unexpected null/undefined
if (!result) {
  throw new ServiceError(
    ServiceErrorCode.INTERNAL_ERROR,
    'Expected operation to return a result, but got null'
  );
}

// Hook failure
try {
  await this._afterCreate(entity, actor);
} catch (error) {
  throw new ServiceError(
    ServiceErrorCode.INTERNAL_ERROR,
    'Error in _afterCreate hook',
    error
  );
}

// External service failure
try {
  await paymentService.charge(amount);
} catch (error) {
  throw new ServiceError(
    ServiceErrorCode.INTERNAL_ERROR,
    'Payment processing failed',
    { service: 'payment', error }
  );
}
```

**Notes:**

- Always log `INTERNAL_ERROR` with full context
- Include original error in `details` for debugging
- Consider alerting/monitoring for these errors

---

#### ALREADY_EXISTS

**When to use:**

- Entity with same unique identifier already exists
- Attempting to create duplicate
- Unique constraint violation
- Conflicting assignment

**HTTP Status:** `409 Conflict`

**Example Scenarios:**

```typescript
// Duplicate slug
const existing = await model.findBySlug(slug);
if (existing) {
  throw new ServiceError(
    ServiceErrorCode.ALREADY_EXISTS,
    `Accommodation with slug "${slug}" already exists`,
    { slug, existingId: existing.id }
  );
}

// Duplicate email
const existing = await userModel.findByEmail(email);
if (existing) {
  throw new ServiceError(
    ServiceErrorCode.ALREADY_EXISTS,
    'User with this email already exists',
    { email }
  );
}

// Duplicate assignment
const existing = await bookingModel.findByRoomAndDate(roomId, date);
if (existing) {
  throw new ServiceError(
    ServiceErrorCode.ALREADY_EXISTS,
    'Room is already booked for this date',
    { roomId, date, existingBookingId: existing.id }
  );
}
```

---

#### INVALID_PAGINATION_PARAMS

**When to use:**

- Page number is invalid (< 1)
- Page size is invalid (< 1 or > max)
- Cursor-based pagination token is invalid

**HTTP Status:** `400 Bad Request`

**Example Scenarios:**

```typescript
// Invalid page
if (page < 1) {
  throw new ServiceError(
    ServiceErrorCode.INVALID_PAGINATION_PARAMS,
    'Page must be >= 1',
    { provided: page }
  );
}

// Invalid page size
if (pageSize < 1 || pageSize > 100) {
  throw new ServiceError(
    ServiceErrorCode.INVALID_PAGINATION_PARAMS,
    'Page size must be between 1 and 100',
    { provided: pageSize, min: 1, max: 100 }
  );
}
```

**Note:** This is a specialized validation error for pagination parameters.

---

#### NOT_IMPLEMENTED

**When to use:**

- Method is a stub not yet implemented
- Feature is planned but not ready
- Endpoint exists but functionality is incomplete

**HTTP Status:** `501 Not Implemented`

**Example Scenarios:**

```typescript
// Stub method
public async advancedSearch(params: AdvancedSearchParams): Promise<ServiceOutput<Entity[]>> {
  return this.runWithLoggingAndValidation({
    methodName: 'advancedSearch',
    input: { actor: params.actor },
    schema: z.object({}),
    execute: async () => {
      throw new ServiceError(
        ServiceErrorCode.NOT_IMPLEMENTED,
        'Advanced search is not yet implemented'
      );
    }
  });
}

// Feature flag
if (!featureFlags.enable_ai_recommendations) {
  throw new ServiceError(
    ServiceErrorCode.NOT_IMPLEMENTED,
    'AI recommendations are not available yet'
  );
}
```

**Notes:**

- Use sparingly - prefer not exposing unimplemented methods
- Always return via `runWithLoggingAndValidation` for consistency
- Remove when feature is implemented

---

## Error Creation

### In Service Methods (Protected/Private)

Services should throw `ServiceError` in protected/private methods and hooks. The base service automatically catches these and converts them to `ServiceOutput` format.

```typescript
protected async _canUpdate(actor: Actor, entity: Accommodation): Promise<void> {
  if (entity.createdById !== actor.id) {
    // Throw ServiceError - will be caught and converted
    throw new ServiceError(
      ServiceErrorCode.FORBIDDEN,
      'You can only update your own accommodations'
    );
  }
}
```

### Returning Errors Directly

In some cases, you may want to return an error directly without throwing:

```typescript
public async customMethod(params: Params): Promise<ServiceOutput<Result>> {
  return this.runWithLoggingAndValidation({
    methodName: 'customMethod',
    input: { actor: params.actor },
    schema: z.object({}),
    execute: async (_, actor) => {
      // Check condition
      if (!condition) {
        // Return error directly
        return {
          error: {
            code: ServiceErrorCode.VALIDATION_ERROR,
            message: 'Condition not met'
          }
        };
      }

      // Continue with success
      const result = await doSomething();
      return { data: result };
    }
  });
}
```

**Note:** Returning errors directly is uncommon. Throwing `ServiceError` is preferred because it provides better stack traces and automatic logging.

## Error Handling Patterns

### Pattern 1: In API Routes (Hono)

Convert `ServiceOutput` errors to HTTP responses:

```typescript
import { Hono } from 'hono';
import { AccommodationService } from '@repo/service-core';

const app = new Hono();

// Helper to map error codes to HTTP status
function getStatusCode(code: ServiceErrorCode): number {
  const map: Record<ServiceErrorCode, number> = {
    [ServiceErrorCode.VALIDATION_ERROR]: 400,
    [ServiceErrorCode.NOT_FOUND]: 404,
    [ServiceErrorCode.UNAUTHORIZED]: 401,
    [ServiceErrorCode.FORBIDDEN]: 403,
    [ServiceErrorCode.ALREADY_EXISTS]: 409,
    [ServiceErrorCode.INVALID_PAGINATION_PARAMS]: 400,
    [ServiceErrorCode.NOT_IMPLEMENTED]: 501,
    [ServiceErrorCode.INTERNAL_ERROR]: 500
  };
  return map[code] ?? 500;
}

app.get('/accommodations/:id', async (c) => {
  const { id } = c.req.param();
  const actor = c.get('actor');

  const service = new AccommodationService(c.get('serviceContext'));
  const result = await service.getById(actor, id);

  if (result.data) {
    return c.json({
      success: true,
      data: result.data
    });
  }

  // Error case
  const status = getStatusCode(result.error.code);

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

### Pattern 2: In Frontend (React)

Handle errors in UI with appropriate messaging:

```typescript
function AccommodationDetail({ id }: { id: string }) {
  const { data: result, isLoading, error } = useQuery({
    queryKey: ['accommodation', id],
    queryFn: async () => {
      const res = await fetch(`/api/accommodations/${id}`);
      return res.json();
    }
  });

  if (isLoading) return <Spinner />;

  // Network/fetch errors
  if (error) {
    return <ErrorAlert message="Failed to load accommodation" />;
  }

  // Service errors
  if (result?.error) {
    switch (result.error.code) {
      case ServiceErrorCode.NOT_FOUND:
        return <NotFoundPage message="Accommodation not found" />;

      case ServiceErrorCode.FORBIDDEN:
        return <ForbiddenPage message="You don't have access to this accommodation" />;

      case ServiceErrorCode.UNAUTHORIZED:
        return <LoginPrompt />;

      default:
        return <ErrorAlert message={result.error.message} />;
    }
  }

  // Success
  return <AccommodationView accommodation={result.data} />;
}
```

### Pattern 3: Error Recovery

Implement retry logic for transient failures:

```typescript
async function createWithRetry(
  actor: Actor,
  data: CreateData,
  maxRetries = 3
): Promise<ServiceOutput<Entity>> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await service.create(actor, data);

    if (result.data) {
      return result; // Success
    }

    // Don't retry certain errors
    const nonRetryable = [
      ServiceErrorCode.VALIDATION_ERROR,
      ServiceErrorCode.FORBIDDEN,
      ServiceErrorCode.UNAUTHORIZED,
      ServiceErrorCode.ALREADY_EXISTS
    ];

    if (nonRetryable.includes(result.error.code)) {
      return result; // Don't retry
    }

    // Last attempt?
    if (attempt === maxRetries) {
      logger.error('All retry attempts failed', {
        attempts: maxRetries,
        error: result.error
      });
      return result;
    }

    // Wait before retry (exponential backoff)
    await sleep(Math.pow(2, attempt - 1) * 1000);
    logger.warn(`Retry attempt ${attempt}/${maxRetries}`, {
      error: result.error
    });
  }

  // This line is unreachable but TypeScript requires it
  throw new Error('Unreachable');
}
```

### Pattern 4: Aggregate Errors

Collect multiple errors when processing batches:

```typescript
async function createMultiple(
  actor: Actor,
  items: CreateData[]
): Promise<{
  succeeded: Entity[];
  failed: Array<{ item: CreateData; error: ServiceErrorCode; message: string }>;
}> {
  const succeeded: Entity[] = [];
  const failed: Array<{ item: CreateData; error: ServiceErrorCode; message: string }> = [];

  for (const item of items) {
    const result = await service.create(actor, item);

    if (result.data) {
      succeeded.push(result.data);
    } else {
      failed.push({
        item,
        error: result.error.code,
        message: result.error.message
      });
    }
  }

  return { succeeded, failed };
}
```

## HTTP Status Code Mapping

Standard mapping of `ServiceErrorCode` to HTTP status codes:

| ServiceErrorCode | HTTP Status | Status Code |
|------------------|-------------|-------------|
| VALIDATION_ERROR | Bad Request | 400 |
| INVALID_PAGINATION_PARAMS | Bad Request | 400 |
| UNAUTHORIZED | Unauthorized | 401 |
| FORBIDDEN | Forbidden | 403 |
| NOT_FOUND | Not Found | 404 |
| ALREADY_EXISTS | Conflict | 409 |
| INTERNAL_ERROR | Internal Server Error | 500 |
| NOT_IMPLEMENTED | Not Implemented | 501 |

**Implementation:**

```typescript
export function getHttpStatusCode(code: ServiceErrorCode): number {
  const statusMap: Record<ServiceErrorCode, number> = {
    [ServiceErrorCode.VALIDATION_ERROR]: 400,
    [ServiceErrorCode.INVALID_PAGINATION_PARAMS]: 400,
    [ServiceErrorCode.UNAUTHORIZED]: 401,
    [ServiceErrorCode.FORBIDDEN]: 403,
    [ServiceErrorCode.NOT_FOUND]: 404,
    [ServiceErrorCode.ALREADY_EXISTS]: 409,
    [ServiceErrorCode.INTERNAL_ERROR]: 500,
    [ServiceErrorCode.NOT_IMPLEMENTED]: 501
  };

  return statusMap[code] ?? 500;
}
```

## Error Logging

### Automatic Logging

All errors are automatically logged by the service base class:

```typescript
// Logged automatically with context:
{
  level: 'error',
  message: 'Service method failed',
  context: {
    service: 'Accommodation',
    method: 'create',
    errorCode: 'VALIDATION_ERROR',
    errorMessage: 'Name is required',
    errorDetails: { field: 'name' },
    actor: { id: 'user-123', role: 'user' },
    input: { /* sanitized input */ }
  }
}
```

### Custom Logging

Add additional logging for important operations:

```typescript
protected async _afterCreate(entity: Accommodation, actor: Actor): Promise<Accommodation> {
  this.logger.info('Accommodation created successfully', {
    accommodationId: entity.id,
    accommodationName: entity.name,
    createdBy: actor.id
  });

  return entity;
}

protected async _canUpdate(actor: Actor, entity: Accommodation): Promise<void> {
  if (entity.createdById !== actor.id) {
    this.logger.warn('Unauthorized update attempt', {
      accommodationId: entity.id,
      ownerId: entity.createdById,
      attemptedBy: actor.id
    });

    throw new ServiceError(
      ServiceErrorCode.FORBIDDEN,
      'You can only update your own accommodations'
    );
  }
}
```

### Sensitive Data

Never log sensitive information:

```typescript
// ❌ BAD - logs password
this.logger.error('Failed to create user', { email, password });

// ✅ GOOD - sanitized
this.logger.error('Failed to create user', { email, passwordLength: password.length });

// ✅ GOOD - no sensitive data
this.logger.error('Failed to create user', { email });
```

## Common Scenarios

### Scenario 1: Entity Not Found

```typescript
const entity = await this.model.findById(id);

if (!entity) {
  throw new ServiceError(
    ServiceErrorCode.NOT_FOUND,
    `${this.entityName} not found`
  );
}
```

### Scenario 2: Permission Denied

```typescript
protected async _canUpdate(actor: Actor, entity: Entity): Promise<void> {
  const canUpdate = (
    entity.createdById === actor.id ||
    actor.permissions.includes(PermissionEnum.UPDATE_ANY)
  );

  if (!canUpdate) {
    throw new ServiceError(
      ServiceErrorCode.FORBIDDEN,
      `You don't have permission to update this ${this.entityName}`,
      {
        entityId: entity.id,
        requiredPermission: PermissionEnum.UPDATE_ANY
      }
    );
  }
}
```

### Scenario 3: Validation Failed

```typescript
const result = schema.safeParse(input);

if (!result.success) {
  const fieldErrors = result.error.flatten().fieldErrors;
  const errorMessages = Object.entries(fieldErrors)
    .map(([field, errors]) => `${field}: ${errors?.join(', ')}`)
    .join('; ');

  throw new ServiceError(
    ServiceErrorCode.VALIDATION_ERROR,
    `Validation failed: ${errorMessages}`,
    { fieldErrors, input }
  );
}
```

### Scenario 4: Duplicate Entry

```typescript
const existing = await this.model.findBySlug(slug);

if (existing) {
  throw new ServiceError(
    ServiceErrorCode.ALREADY_EXISTS,
    `${this.entityName} with slug "${slug}" already exists`,
    {
      slug,
      existingId: existing.id
    }
  );
}
```

### Scenario 5: External Service Failure

```typescript
try {
  const result = await externalApi.call(params);
  return result;
} catch (error) {
  throw new ServiceError(
    ServiceErrorCode.INTERNAL_ERROR,
    'External service call failed',
    {
      service: 'external-api',
      operation: 'call',
      params,
      originalError: error instanceof Error ? error.message : String(error)
    }
  );
}
```

## Troubleshooting

### Issue: Errors Not Being Caught

**Problem:** `ServiceError` thrown but not converted to `ServiceOutput`

**Solution:** Ensure errors are thrown inside the `execute` function passed to `runWithLoggingAndValidation`:

```typescript
// ✅ CORRECT
public async create(...): Promise<ServiceOutput<T>> {
  return this.runWithLoggingAndValidation({
    methodName: 'create',
    input: { actor, ...data },
    schema: this.createSchema,
    execute: async (validData, validActor) => {
      // Throw here - will be caught
      throw new ServiceError(...);
    }
  });
}

// ❌ WRONG
public async create(...): Promise<ServiceOutput<T>> {
  // Thrown outside - won't be caught
  throw new ServiceError(...);

  return this.runWithLoggingAndValidation({...});
}
```

### Issue: Missing Error Details

**Problem:** Error doesn't include helpful debugging information

**Solution:** Always include relevant details:

```typescript
// ❌ BAD - no context
throw new ServiceError(
  ServiceErrorCode.VALIDATION_ERROR,
  'Invalid data'
);

// ✅ GOOD - includes context
throw new ServiceError(
  ServiceErrorCode.VALIDATION_ERROR,
  'Invalid accommodation data: price must be positive',
  {
    field: 'price',
    provided: -100,
    constraint: 'positive number'
  }
);
```

### Issue: Wrong Error Code

**Problem:** Using wrong error code for the situation

**Solution:** Follow the error code guidelines:

- `UNAUTHORIZED` = "Who are you?" (authentication)
- `FORBIDDEN` = "I know who you are, but you can't do this" (authorization)
- `NOT_FOUND` = Entity doesn't exist
- `VALIDATION_ERROR` = Input/business rule validation failed
- `INTERNAL_ERROR` = Unexpected/system errors

### Issue: Errors Not Logged

**Problem:** Errors occur but don't appear in logs

**Solution:** Verify:

1. Service context includes logger: `new Service({ logger })`
2. Logger is configured correctly
3. Error is thrown inside `runWithLoggingAndValidation`

### Issue: Stack Traces Missing

**Problem:** Error logged but no stack trace

**Solution:** Include original error in details:

```typescript
try {
  await operation();
} catch (error) {
  throw new ServiceError(
    ServiceErrorCode.INTERNAL_ERROR,
    'Operation failed',
    error // Include original error with stack
  );
}
```

## See Also

- [ServiceOutput API Reference](./ServiceOutput.md) - Result type documentation
- [BaseCrudService API Reference](./BaseCrudService.md) - Service methods that use errors
- [Service Guide](../guides/services.md) - How to implement services
