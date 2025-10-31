---
name: error-handling-patterns
category: patterns
description: Comprehensive error handling patterns for database, API, and frontend layers with type-safe error hierarchies
usage: Use when implementing error handling to ensure consistent, informative error responses across the application
input: Error scenarios, application layers (DB, API, frontend), error types
output: Error handling code, custom error classes, error documentation
---

# Error Handling Patterns

## Overview

**Purpose**: Standardized error handling patterns ensuring consistent, informative, and secure error management

**Category**: Patterns
**Primary Users**: All engineers

## Error Class Hierarchy

```typescript
// Base Error
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

// Domain-specific Errors
export class ValidationError extends AppError {
  constructor(message: string, public fields?: Record<string, string>) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      `${resource}${id ? ` with id ${id}` : ''} not found`,
      404,
      'NOT_FOUND'
    );
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}
```

## Database Layer Errors

```typescript
try {
  const booking = await db.bookings.findFirst({ 
    where: eq(bookings.id, id) 
  });
  
  if (!booking) {
    throw new NotFoundError('Booking', id);
  }
  
  return booking;
} catch (error) {
  if (error instanceof AppError) throw error;
  
  // PostgreSQL unique violation
  if (error.code === '23505') {
    throw new ConflictError('Resource already exists');
  }
  
  // PostgreSQL foreign key violation
  if (error.code === '23503') {
    throw new ValidationError('Referenced resource does not exist');
  }
  
  // Unexpected database error
  throw new AppError('Database operation failed', 500, 'DATABASE_ERROR', false);
}
```

## Service Layer Errors

```typescript
export class BookingService {
  async create(data: CreateBookingInput): Promise<Booking> {
    // Validate business rules
    if (data.checkIn >= data.checkOut) {
      throw new ValidationError('Check-out must be after check-in', {
        checkIn: 'Must be before check-out',
        checkOut: 'Must be after check-in'
      });
    }
    
    // Check accommodation availability
    const isAvailable = await this.checkAvailability(data);
    if (!isAvailable) {
      throw new ConflictError('Accommodation not available for selected dates');
    }
    
    try {
      return await this.model.create(data);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to create booking', 500, 'CREATE_FAILED', false);
    }
  }
}
```

## API Layer Error Handling

```typescript
// Global error handler middleware
export const errorHandler = async (err: Error, c: Context) => {
  // Log error
  if (err instanceof AppError && !err.isOperational) {
    console.error('Non-operational error:', err);
  }
  
  // Operational errors
  if (err instanceof AppError) {
    return c.json({
      error: {
        code: err.code,
        message: err.message,
        ...(err instanceof ValidationError && { fields: err.fields })
      }
    }, err.statusCode);
  }
  
  // Zod validation errors
  if (err instanceof ZodError) {
    return c.json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        fields: err.flatten().fieldErrors
      }
    }, 400);
  }
  
  // Unknown errors (don't leak details)
  console.error('Unexpected error:', err);
  return c.json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }
  }, 500);
};

// Usage in routes
app.post('/api/bookings', async (c) => {
  try {
    const data = await c.req.json();
    const booking = await bookingService.create(data);
    return c.json(booking, 201);
  } catch (error) {
    throw error; // Caught by global error handler
  }
});

// Register error handler
app.onError(errorHandler);
```

## Frontend Error Handling

```typescript
// React Error Boundary
export class ErrorBoundary extends React.Component<Props, State> {
  state = { hasError: false, error: null };
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    
    return this.props.children;
  }
}

// TanStack Query error handling
const { data, error } = useQuery({
  queryKey: ['bookings'],
  queryFn: async () => {
    const response = await fetch('/api/bookings');
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error.message);
    }
    
    return response.json();
  },
  retry: (failureCount, error) => {
    // Don't retry client errors
    if (error.message.includes('400')) return false;
    if (error.message.includes('404')) return false;
    
    // Retry server errors up to 3 times
    return failureCount < 3;
  }
});

// Display errors
if (error) {
  return <Alert variant="destructive">{error.message}</Alert>;
}
```

## Best Practices

1. **Use Custom Error Classes**: Create domain-specific errors
2. **Fail Fast**: Validate early, throw errors immediately
3. **Preserve Stack Traces**: Use Error.captureStackTrace
4. **Don't Leak Internals**: Sanitize errors in production
5. **Log Unexpected Errors**: Log non-operational errors
6. **Type-Safe Errors**: Use TypeScript for error types
7. **Consistent Format**: Standard error response structure
8. **Operational vs Programming**: Distinguish error types
9. **Don't Catch Everything**: Only catch what you can handle
10. **Use Error Boundaries**: React error boundaries for UI errors

## Related Skills

- `tdd-methodology` - Test error scenarios
- `api-app-testing` - Test error responses

## Notes

- Never expose stack traces in production
- Always log unexpected errors for debugging
- Error messages should be user-friendly
- Use HTTP status codes correctly
- Errors are part of API contract
