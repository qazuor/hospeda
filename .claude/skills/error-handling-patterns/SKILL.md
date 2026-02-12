---
name: error-handling-patterns
description: Standardized error handling patterns for all application layers. Use when designing error hierarchies, recovery strategies, or error boundaries.
---

# Error Handling Patterns

## Purpose

Provide standardized error handling patterns for consistent, informative, and secure error management across all application layers. This skill defines error class hierarchies, layer-specific handling strategies, error boundaries, recovery patterns, and best practices for building robust applications that fail gracefully.

## When to Use

- When implementing error handling in new features
- When designing API error response formats
- When creating custom error classes
- When adding error boundaries in frontend code
- When refactoring inconsistent error handling
- When building middleware for centralized error processing

## Patterns

### Error Class Hierarchy

Define a base error class and extend it for domain-specific errors:

```typescript
// Base application error
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this);
  }
}

// Validation errors (400)
export class ValidationError extends AppError {
  constructor(
    message: string,
    public fields?: Record<string, string>
  ) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

// Not found errors (404)
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      `${resource}${id ? ` with id ${id}` : ''} not found`,
      404,
      'NOT_FOUND'
    );
  }
}

// Authentication errors (401)
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

// Authorization errors (403)
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

// Conflict errors (409)
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

// Rate limit errors (429)
export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'RATE_LIMITED');
  }
}
```

### Database Layer Error Handling

Catch database-specific errors and translate them into domain errors:

```typescript
try {
  const record = await db.resources.findFirst({
    where: { id },
  });

  if (!record) {
    throw new NotFoundError('Resource', id);
  }

  return record;
} catch (error) {
  // Re-throw known application errors
  if (error instanceof AppError) throw error;

  // Translate database-specific errors
  if (error.code === '23505') {
    // Unique constraint violation
    throw new ConflictError('Resource already exists');
  }

  if (error.code === '23503') {
    // Foreign key violation
    throw new ValidationError('Referenced resource does not exist');
  }

  // Unexpected database error (non-operational)
  throw new AppError(
    'Database operation failed',
    500,
    'DATABASE_ERROR',
    false
  );
}
```

### Service Layer Error Handling

Validate business rules and wrap unexpected failures:

```typescript
export class OrderService {
  async create(data: CreateOrderInput): Promise<Order> {
    // Validate business rules early
    if (data.items.length === 0) {
      throw new ValidationError('Order must contain at least one item', {
        items: 'At least one item is required',
      });
    }

    if (data.total < 0) {
      throw new ValidationError('Order total cannot be negative', {
        total: 'Must be zero or positive',
      });
    }

    // Check resource availability
    const isAvailable = await this.checkInventory(data.items);
    if (!isAvailable) {
      throw new ConflictError('One or more items are out of stock');
    }

    try {
      return await this.repository.create(data);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        'Failed to create order',
        500,
        'CREATE_FAILED',
        false
      );
    }
  }
}
```

### API Layer Error Handling

Centralize error formatting with a global error handler:

```typescript
// Global error handler middleware
export const errorHandler = async (err: Error, c: Context) => {
  // Log non-operational errors for investigation
  if (err instanceof AppError && !err.isOperational) {
    logger.error('Non-operational error:', { error: err, stack: err.stack });
  }

  // Handle known application errors
  if (err instanceof AppError) {
    return c.json(
      {
        error: {
          code: err.code,
          message: err.message,
          ...(err instanceof ValidationError && err.fields
            ? { fields: err.fields }
            : {}),
        },
      },
      err.statusCode
    );
  }

  // Handle schema validation errors (e.g., Zod)
  if (err.name === 'ZodError') {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          fields: err.flatten?.().fieldErrors ?? {},
        },
      },
      400
    );
  }

  // Unknown errors -- do not leak internal details
  logger.error('Unexpected error:', { error: err, stack: err.stack });
  return c.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    },
    500
  );
};

// Register the handler
app.onError(errorHandler);
```

### Frontend Error Boundaries

Catch rendering errors and display fallback UI:

```typescript
// React Error Boundary
export class ErrorBoundary extends React.Component<Props, State> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Report to error tracking service
    errorTracker.captureException(error, { extra: errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          onRetry={() => this.setState({ hasError: false, error: null })}
        />
      );
    }

    return this.props.children;
  }
}
```

### Async Data Fetching Error Handling

Handle errors from API calls with retry logic:

```typescript
const { data, error, isLoading } = useQuery({
  queryKey: ['orders'],
  queryFn: async () => {
    const response = await fetch('/api/orders');

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to load orders');
    }

    return response.json();
  },
  retry: (failureCount, error) => {
    // Do not retry client errors (4xx)
    if (error.message.includes('400')) return false;
    if (error.message.includes('401')) return false;
    if (error.message.includes('403')) return false;
    if (error.message.includes('404')) return false;

    // Retry server errors up to 3 times
    return failureCount < 3;
  },
});

if (error) {
  return <Alert variant="error">{error.message}</Alert>;
}
```

### Error Response Format

All API errors should follow a consistent structure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable error description",
    "fields": {
      "email": "Must be a valid email address",
      "age": "Must be at least 18"
    }
  }
}
```

Standard error codes:

| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 400 | Invalid input data |
| UNAUTHORIZED | 401 | Authentication required |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource does not exist |
| CONFLICT | 409 | Resource conflict |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Unexpected server error |

### Operational vs. Programming Errors

Distinguish between errors that are expected and those that indicate bugs:

**Operational errors** (isOperational = true):

- Invalid user input
- Resource not found
- Authentication failure
- Rate limit exceeded
- Network timeout

**Programming errors** (isOperational = false):

- Null reference exceptions
- Type errors
- Assertion failures
- Unhandled promise rejections
- Database connection failures

Operational errors are handled gracefully. Programming errors should be logged, alerted on, and investigated.

## Best Practices

1. **Use custom error classes** -- create domain-specific errors for clarity
2. **Fail fast** -- validate inputs early and throw errors immediately
3. **Preserve stack traces** -- use Error.captureStackTrace
4. **Never leak internal details** -- sanitize error messages in production
5. **Log unexpected errors** -- all non-operational errors need investigation
6. **Use type-safe errors** -- leverage TypeScript for error class typing
7. **Consistent response format** -- standardize error JSON structure across all endpoints
8. **Distinguish error types** -- separate operational from programming errors
9. **Only catch what you can handle** -- do not swallow errors silently
10. **Use error boundaries** -- catch rendering errors in frontend frameworks
11. **Implement retry logic** -- retry transient failures with exponential backoff
12. **Monitor error rates** -- track error frequency and types in production
13. **Test error paths** -- every error scenario should have a corresponding test
14. **Use HTTP status codes correctly** -- match the code to the actual error type

## Notes

- Never expose stack traces in production responses
- Always log unexpected errors with full context for debugging
- Error messages should be user-friendly and actionable
- Errors are part of the API contract and should be documented
- Consider internationalization of error messages for user-facing text
