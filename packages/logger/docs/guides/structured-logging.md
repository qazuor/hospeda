# Structured Logging Guide

Complete guide to structured logging for better searchability, monitoring, and analysis.

## Table of Contents

- [Overview](#overview)
- [What is Structured Logging?](#what-is-structured-logging)
- [Benefits](#benefits)
- [Core Concepts](#core-concepts)
- [Best Practices](#best-practices)
- [Request Context](#request-context)
- [Error Context](#error-context)
- [Performance Context](#performance-context)
- [Monitoring Integration](#monitoring-integration)
- [Query Patterns](#query-patterns)
- [Real-World Examples](#real-world-examples)
- [Anti-Patterns](#anti-patterns)

---

## Overview

Structured logging is the practice of logging data in a consistent, machine-parseable format with well-defined fields. Instead of free-form text, structured logs use key-value pairs that can be easily searched, filtered, and analyzed.

**Key Principles:**

- Consistent field names across application
- Typed data (not just strings)
- Machine-parseable format
- No sensitive data
- Searchable and filterable
- Integration-ready for monitoring tools

---

## What is Structured Logging?

### Traditional Logging (Unstructured)

```typescript
// ❌ Unstructured: Hard to parse and search
logger.info('User Juan (user-123) logged in from 192.168.1.1 at 2024-01-15 10:30:00');
logger.info('Payment of $150.00 for booking book-456 processed successfully');
logger.error('Database query failed: SELECT * FROM users WHERE id = user-123');
```

**Problems:**

- Hard to extract specific fields
- Inconsistent formats
- Difficult to query
- Not machine-parseable
- No structured search

### Structured Logging

```typescript
// ✅ Structured: Easy to parse and search
logger.info('User login', {
  userId: 'user-123',
  username: 'Juan',
  ipAddress: '192.168.1.1',
  timestamp: new Date().toISOString(),
});

logger.info('Payment processed', {
  amount: 150.0,
  currency: 'USD',
  bookingId: 'book-456',
  paymentId: 'pay-789',
  status: 'success',
});

logger.error('Database query failed', {
  query: 'SELECT * FROM users WHERE id = $1',
  params: ['user-123'],
  error: 'Connection timeout',
  duration: 5000,
});
```

**Benefits:**

- Easy to extract `userId`, `amount`, `error`
- Consistent field names
- Queryable: "Find all payments > $100"
- Machine-parseable
- Structured search

---

## Benefits

### 1. Searchability

```typescript
import { logger } from '@repo/logger';

/**
 * Log with searchable fields
 */
logger.info('Booking created', {
  bookingId: 'book-123',
  userId: 'user-456',
  accommodationId: 'acc-789',
  checkIn: '2024-02-01',
  checkOut: '2024-02-05',
  totalPrice: 600,
  status: 'confirmed',
});

// Easy queries:
// - Find all bookings by user-456
// - Find bookings for accommodation acc-789
// - Find bookings with status=confirmed
// - Find bookings with totalPrice > 500
```

### 2. Monitoring

```typescript
import { logger } from '@repo/logger';

/**
 * Log with monitoring-friendly structure
 */
logger.info('API request', {
  method: 'POST',
  path: '/bookings',
  status: 201,
  duration: 234,
  userId: 'user-123',
  requestId: 'req-456',
});

// Monitoring tools can:
// - Graph request duration over time
// - Alert on status codes (4xx, 5xx)
// - Track requests per user
// - Monitor API endpoint performance
```

### 3. Alerting

```typescript
import { logger } from '@repo/logger';

/**
 * Log with alerting criteria
 */
logger.error('Payment failed', {
  error: 'Gateway timeout',
  paymentId: 'pay-123',
  amount: 1500,
  userId: 'user-456',
  retries: 3,
  severity: 'high',
});

// Alert rules:
// - Alert if severity=high
// - Alert if retries >= 3
// - Alert if payment failures > 5 in 5 minutes
```

### 4. Debugging

```typescript
import { logger } from '@repo/logger';

/**
 * Log with debugging context
 */
logger.debug('Cache miss', {
  key: 'user:123',
  operation: 'get',
  fallbackUsed: true,
  fallbackDuration: 45,
  cacheProvider: 'redis',
});

// Debugging:
// - Find all cache misses for user:123
// - Compare cache vs fallback performance
// - Track cache provider reliability
```

### 5. Analytics

```typescript
import { logger } from '@repo/logger';

/**
 * Log with analytics data
 */
logger.info('Search performed', {
  query: 'beach house',
  filters: {
    city: 'Concepción',
    priceRange: [50, 200],
  },
  resultCount: 12,
  clickedResultId: 'acc-456',
  userId: 'user-123',
  searchDuration: 123,
});

// Analytics:
// - Most popular search queries
// - Average result count by filter
// - Click-through rate
// - Search performance
```

---

## Core Concepts

### Consistent Field Names

```typescript
import { logger } from '@repo/logger';

/**
 * Use consistent field names across application
 */

// ✅ Always use 'userId' (not 'user_id', 'user', 'uid')
logger.info('User action', { userId: 'user-123' });
logger.info('Booking created', { userId: 'user-123' });
logger.info('Payment processed', { userId: 'user-123' });

// ✅ Always use 'requestId' (not 'req_id', 'request_id')
logger.info('Request started', { requestId: 'req-456' });
logger.info('Request completed', { requestId: 'req-456' });

// ✅ Always use 'duration' in milliseconds
logger.info('Query executed', { duration: 45 }); // ms
logger.info('API call completed', { duration: 234 }); // ms
```

### Typed Data

```typescript
import { logger } from '@repo/logger';

/**
 * Use proper types, not just strings
 */

// ❌ Bad: Everything as string
logger.info('Booking created', {
  totalPrice: '150.50', // String
  guests: '2', // String
  isPaid: 'true', // String
});

// ✅ Good: Proper types
logger.info('Booking created', {
  totalPrice: 150.5, // Number
  guests: 2, // Number
  isPaid: true, // Boolean
});

// ✅ Good: ISO dates for timestamps
logger.info('Event occurred', {
  timestamp: new Date().toISOString(), // ISO 8601 string
  scheduledFor: '2024-02-01T10:00:00Z', // ISO 8601 string
});

// ✅ Good: Arrays and objects
logger.info('Search performed', {
  filters: {
    city: 'Concepción',
    priceRange: [50, 200], // Array
  },
  amenities: ['WiFi', 'Pool', 'Kitchen'], // Array
});
```

### Nested Context

```typescript
import { logger } from '@repo/logger';

/**
 * Group related fields in nested objects
 */

// ✅ Group user-related fields
logger.info('Action performed', {
  user: {
    id: 'user-123',
    email: 'juan@example.com',
    role: 'owner',
  },
  action: 'create',
  resource: 'accommodation',
});

// ✅ Group request-related fields
logger.info('API request', {
  request: {
    id: 'req-456',
    method: 'POST',
    path: '/bookings',
    userAgent: 'Mozilla/5.0...',
  },
  response: {
    status: 201,
    duration: 234,
  },
});

// ✅ Group error-related fields
logger.error('Operation failed', {
  error: {
    message: 'Database connection failed',
    code: 'ECONNREFUSED',
    stack: error.stack,
  },
  operation: {
    type: 'query',
    query: 'SELECT...',
    retries: 3,
  },
});
```

### No Sensitive Data

```typescript
import { logger } from '@repo/logger';

/**
 * Never log sensitive information
 */

// ❌ NEVER log passwords, tokens, or PII
logger.info('User login', {
  email: 'juan@example.com',
  password: 'secret123', // ❌ NEVER
  creditCard: '4111111111111111', // ❌ NEVER
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', // ❌ NEVER
});

// ✅ Log identifiers only
logger.info('User login', {
  userId: 'user-123',
  email: 'j***@example.com', // Masked
  ipAddress: '192.168.1.1',
});

// ✅ Log token metadata, not token itself
logger.info('Token verified', {
  userId: 'user-123',
  tokenExpiresAt: '2024-01-15T12:00:00Z',
  tokenIssuer: 'better_auth',
});

// ✅ Log payment metadata, not payment details
logger.info('Payment processed', {
  paymentId: 'pay-789',
  amount: 150.5,
  currency: 'USD',
  last4: '1234', // Last 4 digits only
  userId: 'user-123',
});
```

---

## Best Practices

### 1. Define Field Standards

```typescript
/**
 * Standard field definitions for consistent logging
 */
export const LogFields = {
  // Identity
  userId: (id: string) => ({ userId: id }),
  requestId: (id: string) => ({ requestId: id }),
  sessionId: (id: string) => ({ sessionId: id }),

  // Resources
  accommodationId: (id: string) => ({ accommodationId: id }),
  bookingId: (id: string) => ({ bookingId: id }),
  paymentId: (id: string) => ({ paymentId: id }),

  // Metrics
  duration: (ms: number) => ({ duration: ms }),
  amount: (value: number, currency = 'USD') => ({ amount: value, currency }),
  count: (n: number) => ({ count: n }),

  // Timestamps
  timestamp: () => ({ timestamp: new Date().toISOString() }),
  date: (d: Date) => ({ date: d.toISOString() }),

  // Status
  status: (s: string) => ({ status: s }),
  success: (b: boolean) => ({ success: b }),
  error: (e: Error) => ({
    error: e.message,
    errorType: e.constructor.name,
    stack: e.stack,
  }),
} as const;

// Usage
import { logger } from '@repo/logger';

logger.info('Payment processed', {
  ...LogFields.paymentId('pay-123'),
  ...LogFields.userId('user-456'),
  ...LogFields.amount(150.5),
  ...LogFields.success(true),
  ...LogFields.timestamp(),
});
```

### 2. Use TypeScript Types

```typescript
/**
 * Type-safe logging interfaces
 */
interface BaseLogContext {
  requestId: string;
  userId?: string;
  timestamp: string;
}

interface BookingLogContext extends BaseLogContext {
  bookingId: string;
  accommodationId: string;
  checkIn: string;
  checkOut: string;
  totalPrice: number;
  status: 'pending' | 'confirmed' | 'cancelled';
}

interface PaymentLogContext extends BaseLogContext {
  paymentId: string;
  amount: number;
  currency: string;
  provider: 'mercadopago' | 'stripe';
  status: 'pending' | 'success' | 'failed';
}

// Type-safe logging
function logBookingCreated(context: BookingLogContext): void {
  logger.info('Booking created', context);
}

function logPaymentProcessed(context: PaymentLogContext): void {
  logger.info('Payment processed', context);
}

// Usage (with type checking)
logBookingCreated({
  requestId: 'req-123',
  userId: 'user-456',
  timestamp: new Date().toISOString(),
  bookingId: 'book-789',
  accommodationId: 'acc-012',
  checkIn: '2024-02-01',
  checkOut: '2024-02-05',
  totalPrice: 600,
  status: 'confirmed',
});
```

### 3. Create Logging Utilities

```typescript
import { logger } from '@repo/logger';

/**
 * Logging utilities for common patterns
 */
export const LogUtils = {
  /**
   * Log API request with standard fields
   */
  logRequest: (method: string, path: string, context: Record<string, unknown>) => {
    logger.info(`${method} ${path}`, {
      request: {
        method,
        path,
        timestamp: new Date().toISOString(),
      },
      ...context,
    });
  },

  /**
   * Log API response with timing
   */
  logResponse: (
    method: string,
    path: string,
    status: number,
    duration: number,
    context: Record<string, unknown>
  ) => {
    logger.info(`${method} ${path} ${status}`, {
      response: {
        method,
        path,
        status,
        duration,
      },
      ...context,
    });
  },

  /**
   * Log database query with performance
   */
  logQuery: (query: string, duration: number, context: Record<string, unknown>) => {
    logger.debug('Database query', {
      query: {
        sql: query,
        duration,
      },
      ...context,
    });
  },

  /**
   * Log error with full context
   */
  logError: (error: Error, context: Record<string, unknown>) => {
    logger.error(error.message, {
      error: {
        message: error.message,
        type: error.constructor.name,
        stack: error.stack,
      },
      ...context,
    });
  },
};

// Usage
LogUtils.logRequest('POST', '/bookings', {
  userId: 'user-123',
  requestId: 'req-456',
});

LogUtils.logResponse('POST', '/bookings', 201, 234, {
  userId: 'user-123',
  requestId: 'req-456',
  bookingId: 'book-789',
});
```

### 4. Document Field Conventions

```typescript
/**
 * Logging Field Conventions
 *
 * Standard field names used throughout the application:
 *
 * Identity Fields:
 * - userId: string - User identifier (e.g., 'user-123')
 * - requestId: string - Request identifier (e.g., 'req-456')
 * - sessionId: string - Session identifier (e.g., 'sess-789')
 *
 * Resource Fields:
 * - accommodationId: string - Accommodation identifier
 * - bookingId: string - Booking identifier
 * - paymentId: string - Payment identifier
 * - reviewId: string - Review identifier
 *
 * Temporal Fields:
 * - timestamp: string - ISO 8601 timestamp
 * - duration: number - Duration in milliseconds
 * - checkIn: string - Check-in date (ISO 8601)
 * - checkOut: string - Check-out date (ISO 8601)
 *
 * Monetary Fields:
 * - amount: number - Monetary amount
 * - currency: string - Currency code (ISO 4217)
 * - totalPrice: number - Total price
 * - pricePerNight: number - Price per night
 *
 * Status Fields:
 * - status: string - Status value (pending, confirmed, etc.)
 * - success: boolean - Success indicator
 * - error: string - Error message
 * - errorType: string - Error type/class name
 *
 * HTTP Fields:
 * - method: string - HTTP method (GET, POST, etc.)
 * - path: string - Request path
 * - statusCode: number - HTTP status code
 * - userAgent: string - User agent string
 *
 * Performance Fields:
 * - duration: number - Operation duration (ms)
 * - queryTime: number - Query execution time (ms)
 * - resultCount: number - Number of results
 * - cacheHit: boolean - Cache hit indicator
 */
```

---

## Request Context

Log consistent request context across all HTTP requests.

### Basic Request Context

```typescript
import { logger } from '@repo/logger';
import type { Context } from 'hono';

/**
 * Log incoming request
 */
export function logRequest(c: Context): void {
  logger.info('Request received', {
    request: {
      id: c.get('requestId'),
      method: c.req.method,
      path: c.req.path,
      query: c.req.query(),
      headers: {
        userAgent: c.req.header('user-agent'),
        contentType: c.req.header('content-type'),
      },
    },
    user: {
      id: c.get('userId'),
      ipAddress: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
    },
    timestamp: new Date().toISOString(),
  });
}
```

### Request/Response Logging

```typescript
import { logger } from '@repo/logger';
import { createMiddleware } from 'hono/factory';

/**
 * Request logging middleware
 */
export const requestLogger = createMiddleware(async (c, next) => {
  const startTime = Date.now();
  const requestId = c.get('requestId');

  logger.info('Request started', {
    requestId,
    method: c.req.method,
    path: c.req.path,
    userId: c.get('userId'),
  });

  await next();

  const duration = Date.now() - startTime;

  logger.info('Request completed', {
    requestId,
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    duration,
    userId: c.get('userId'),
  });
});
```

### Full Request Context

```typescript
import { logger } from '@repo/logger';
import type { Context } from 'hono';

/**
 * Create comprehensive request context
 */
export function createRequestContext(c: Context) {
  return {
    request: {
      id: c.get('requestId'),
      method: c.req.method,
      path: c.req.path,
      query: c.req.query(),
      headers: {
        userAgent: c.req.header('user-agent'),
        contentType: c.req.header('content-type'),
        accept: c.req.header('accept'),
        referer: c.req.header('referer'),
      },
    },
    user: {
      id: c.get('userId'),
      sessionId: c.get('sessionId'),
      ipAddress: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
      country: c.req.header('cf-ipcountry'), // Cloudflare
    },
    timestamp: new Date().toISOString(),
  };
}

// Usage in route
app.post('/bookings', async (c) => {
  const context = createRequestContext(c);

  logger.info('Creating booking', {
    ...context,
    body: await c.req.json(),
  });

  // ... handle request

  logger.info('Booking created', {
    ...context,
    bookingId: booking.id,
    status: 'success',
  });

  return c.json({ success: true, data: booking });
});
```

---

## Error Context

Log comprehensive error context for debugging.

### Basic Error Logging

```typescript
import { logger } from '@repo/logger';

/**
 * Log error with context
 */
try {
  await processPayment(paymentData);
} catch (error) {
  logger.error('Payment processing failed', {
    error: {
      message: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined,
    },
    paymentData: {
      amount: paymentData.amount,
      bookingId: paymentData.bookingId,
      userId: paymentData.userId,
    },
  });

  throw error;
}
```

### Detailed Error Context

```typescript
import { logger } from '@repo/logger';

/**
 * Log error with full context
 */
export function logError(error: unknown, context: Record<string, unknown>): void {
  const errorInfo = {
    message: error instanceof Error ? error.message : String(error),
    type: error instanceof Error ? error.constructor.name : typeof error,
    stack: error instanceof Error ? error.stack : undefined,
    code:
      error instanceof Error && 'code' in error ? (error as any).code : undefined,
  };

  logger.error(errorInfo.message, {
    error: errorInfo,
    context,
    timestamp: new Date().toISOString(),
  });
}

// Usage
try {
  await createBooking(bookingData);
} catch (error) {
  logError(error, {
    operation: 'createBooking',
    bookingData: {
      accommodationId: bookingData.accommodationId,
      userId: bookingData.userId,
      checkIn: bookingData.checkIn,
      checkOut: bookingData.checkOut,
    },
    requestId: 'req-123',
  });

  throw error;
}
```

### Error with Retry Context

```typescript
import { logger } from '@repo/logger';

/**
 * Log error with retry information
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number,
  context: Record<string, unknown>
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();

      if (attempt > 1) {
        logger.info('Operation succeeded after retry', {
          ...context,
          attempt,
          maxRetries,
        });
      }

      return result;
    } catch (error) {
      lastError = error;

      logger.warn('Operation failed, retrying', {
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          type: error instanceof Error ? error.constructor.name : typeof error,
        },
        ...context,
        attempt,
        maxRetries,
        willRetry: attempt < maxRetries,
      });

      if (attempt === maxRetries) {
        logger.error('Operation failed after all retries', {
          error: {
            message: error instanceof Error ? error.message : 'Unknown error',
            type: error instanceof Error ? error.constructor.name : typeof error,
            stack: error instanceof Error ? error.stack : undefined,
          },
          ...context,
          attempts: maxRetries,
        });
      }
    }
  }

  throw lastError;
}

// Usage
const booking = await withRetry(
  () => createBooking(bookingData),
  3,
  {
    operation: 'createBooking',
    bookingData,
    userId: 'user-123',
    requestId: 'req-456',
  }
);
```

---

## Performance Context

Log performance metrics for monitoring and optimization.

### Basic Performance Logging

```typescript
import { logger } from '@repo/logger';

/**
 * Log operation performance
 */
export async function withPerformanceLogging<T>(
  operation: string,
  fn: () => Promise<T>,
  context: Record<string, unknown>
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await fn();
    const duration = Date.now() - startTime;

    logger.info('Operation completed', {
      operation,
      duration,
      success: true,
      ...context,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error('Operation failed', {
      operation,
      duration,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      ...context,
    });

    throw error;
  }
}

// Usage
const results = await withPerformanceLogging(
  'searchAccommodations',
  () => service.search(filters),
  {
    filters,
    userId: 'user-123',
  }
);
```

### Database Query Performance

```typescript
import { logger } from '@repo/logger';

/**
 * Log database query performance
 */
export async function logQuery<T>(
  query: string,
  params: unknown[],
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await fn();
    const duration = Date.now() - startTime;

    logger.debug('Query executed', {
      query: {
        sql: query,
        params,
        duration,
      },
      result: {
        rowCount: Array.isArray(result) ? result.length : 1,
      },
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error('Query failed', {
      query: {
        sql: query,
        params,
        duration,
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw error;
  }
}
```

### API Call Performance

```typescript
import { logger } from '@repo/logger';

/**
 * Log external API call performance
 */
export async function logApiCall<T>(
  service: string,
  operation: string,
  fn: () => Promise<T>,
  context: Record<string, unknown>
): Promise<T> {
  const startTime = Date.now();

  logger.debug('External API call started', {
    service,
    operation,
    ...context,
  });

  try {
    const result = await fn();
    const duration = Date.now() - startTime;

    logger.info('External API call succeeded', {
      service,
      operation,
      duration,
      success: true,
      ...context,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error('External API call failed', {
      service,
      operation,
      duration,
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        type: error instanceof Error ? error.constructor.name : typeof error,
      },
      ...context,
    });

    throw error;
  }
}

// Usage
const payment = await logApiCall(
  'mercadopago',
  'createPayment',
  () => mercadoPago.payment.create(paymentData),
  {
    amount: paymentData.amount,
    bookingId: paymentData.bookingId,
    userId: 'user-123',
  }
);
```

---

## Monitoring Integration

Structure logs for easy integration with monitoring tools.

### CloudWatch Logs

```typescript
import { logger } from '@repo/logger';

/**
 * Log in CloudWatch-friendly format
 */
logger.configure({
  stringifyObjects: true, // JSON format
});

const cloudwatchLogger = logger.registerCategory('cloudwatch', {
  stringifyObjects: true,
  expandObjectLevels: 0,
});

cloudwatchLogger.info('Request processed', {
  // CloudWatch dimensions
  service: 'api',
  environment: process.env.NODE_ENV,
  region: process.env.AWS_REGION,

  // Metrics
  method: 'POST',
  path: '/bookings',
  status: 201,
  duration: 234,

  // Context
  requestId: 'req-123',
  userId: 'user-456',
});

// CloudWatch Insights query:
// fields @timestamp, method, path, status, duration
// | filter service = "api" and status >= 500
// | stats avg(duration) by path
```

### Datadog

```typescript
import { logger } from '@repo/logger';

/**
 * Log in Datadog-friendly format
 */
const datadogLogger = logger.registerCategory('datadog', {
  stringifyObjects: true,
});

datadogLogger.info('Payment processed', {
  // Datadog tags
  'dd.service': 'hospeda-api',
  'dd.env': process.env.NODE_ENV,
  'dd.version': process.env.APP_VERSION,

  // Metrics
  'payment.amount': 150.5,
  'payment.currency': 'USD',
  'payment.status': 'success',

  // Context
  userId: 'user-123',
  paymentId: 'pay-456',
});

// Datadog query:
// service:hospeda-api payment.status:success
// | group by payment.currency
// | avg(payment.amount)
```

### ELK Stack (Elasticsearch)

```typescript
import { logger } from '@repo/logger';

/**
 * Log in Elasticsearch-friendly format
 */
const elkLogger = logger.registerCategory('elk', {
  stringifyObjects: true,
  expandObjectLevels: 0,
});

elkLogger.info('Search performed', {
  // Elasticsearch fields
  '@timestamp': new Date().toISOString(),
  service: 'api',
  environment: process.env.NODE_ENV,

  // Event
  event: {
    type: 'search',
    category: 'accommodation',
    outcome: 'success',
  },

  // Search details
  search: {
    query: 'beach house',
    filters: {
      city: 'Concepción',
      priceRange: [50, 200],
    },
    resultCount: 12,
    duration: 123,
  },

  // User
  user: {
    id: 'user-456',
  },
});

// Elasticsearch query:
// GET /logs/_search
// {
//   "query": {
//     "bool": {
//       "must": [
//         { "match": { "event.type": "search" } },
//         { "range": { "search.duration": { "gte": 100 } } }
//       ]
//     }
//   }
// }
```

---

## Query Patterns

Common log query patterns for structured logs.

### Find by User

```typescript
// Log
logger.info('Booking created', {
  userId: 'user-123',
  bookingId: 'book-456',
  accommodationId: 'acc-789',
});

// Query (CloudWatch Insights)
// fields @timestamp, bookingId, accommodationId
// | filter userId = "user-123"
// | sort @timestamp desc
```

### Find by Status

```typescript
// Log
logger.error('Payment failed', {
  paymentId: 'pay-123',
  status: 'failed',
  error: 'Gateway timeout',
});

// Query (CloudWatch Insights)
// fields @timestamp, paymentId, error
// | filter status = "failed"
// | count() by error
```

### Find Slow Requests

```typescript
// Log
logger.info('Request completed', {
  method: 'GET',
  path: '/accommodations',
  duration: 1500,
  status: 200,
});

// Query (CloudWatch Insights)
// fields @timestamp, path, duration
// | filter duration > 1000
// | stats avg(duration), max(duration), count() by path
```

### Find Error Rate

```typescript
// Log
logger.info('API request', {
  method: 'POST',
  path: '/bookings',
  status: 500,
  error: 'Database connection failed',
});

// Query (CloudWatch Insights)
// fields @timestamp
// | stats count() as total_requests,
//         sum(status >= 500) as errors
//   by bin(5m)
// | fields errors / total_requests * 100 as error_rate
```

---

## Real-World Examples

### Booking Flow Logging

```typescript
import { logger } from '@repo/logger';

const bookingLogger = logger.registerCategory('booking', {
  stringifyObjects: true,
});

/**
 * Log complete booking flow
 */
export async function createBookingWithLogging(data: CreateBookingInput) {
  const requestId = generateId();

  bookingLogger.info('Booking flow started', {
    requestId,
    userId: data.userId,
    accommodationId: data.accommodationId,
    checkIn: data.checkIn,
    checkOut: data.checkOut,
  });

  try {
    // Step 1: Validate availability
    const available = await checkAvailability(data);
    bookingLogger.info('Availability checked', {
      requestId,
      available,
      accommodationId: data.accommodationId,
    });

    if (!available) {
      bookingLogger.warn('Booking unavailable', {
        requestId,
        accommodationId: data.accommodationId,
        checkIn: data.checkIn,
        checkOut: data.checkOut,
      });
      throw new Error('Accommodation not available');
    }

    // Step 2: Create booking
    const booking = await bookingService.create(data);
    bookingLogger.info('Booking created', {
      requestId,
      bookingId: booking.id,
      status: booking.status,
      totalPrice: booking.totalPrice,
    });

    // Step 3: Process payment
    const payment = await paymentService.process({
      bookingId: booking.id,
      amount: booking.totalPrice,
    });
    bookingLogger.info('Payment processed', {
      requestId,
      bookingId: booking.id,
      paymentId: payment.id,
      status: payment.status,
    });

    // Step 4: Send confirmation
    await sendConfirmationEmail(booking);
    bookingLogger.info('Confirmation sent', {
      requestId,
      bookingId: booking.id,
      userId: data.userId,
    });

    bookingLogger.info('Booking flow completed', {
      requestId,
      bookingId: booking.id,
      success: true,
    });

    return booking;
  } catch (error) {
    bookingLogger.error('Booking flow failed', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      data,
    });

    throw error;
  }
}
```

### Search Analytics Logging

```typescript
import { logger } from '@repo/logger';

const searchLogger = logger.registerCategory('search', {
  stringifyObjects: true,
});

/**
 * Log search with analytics
 */
export async function searchWithAnalytics(filters: SearchFilters, userId?: string) {
  const searchId = generateId();
  const startTime = Date.now();

  searchLogger.info('Search started', {
    searchId,
    userId,
    filters: {
      query: filters.q,
      city: filters.city,
      priceRange: filters.priceRange,
      amenities: filters.amenities,
    },
  });

  try {
    const results = await accommodationService.search(filters);
    const duration = Date.now() - startTime;

    searchLogger.info('Search completed', {
      searchId,
      userId,
      filters,
      resultCount: results.length,
      duration,
      topResults: results.slice(0, 3).map((r) => ({
        id: r.id,
        title: r.title,
        pricePerNight: r.pricePerNight,
      })),
    });

    return results;
  } catch (error) {
    const duration = Date.now() - startTime;

    searchLogger.error('Search failed', {
      searchId,
      userId,
      filters,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw error;
  }
}
```

---

## Anti-Patterns

### ❌ Inconsistent Field Names

```typescript
// Bad: Different names for same concept
logger.info('User action', { userId: 'user-123' });
logger.info('Payment', { user_id: 'user-123' });
logger.info('Booking', { uid: 'user-123' });

// Good: Consistent naming
logger.info('User action', { userId: 'user-123' });
logger.info('Payment', { userId: 'user-123' });
logger.info('Booking', { userId: 'user-123' });
```

### ❌ Logging Sensitive Data

```typescript
// Bad: Logging passwords and tokens
logger.info('User login', {
  email: 'juan@example.com',
  password: 'secret123', // ❌
  token: 'eyJhbGc...', // ❌
});

// Good: Only log identifiers
logger.info('User login', {
  userId: 'user-123',
  email: 'j***@example.com',
});
```

### ❌ Unstructured Messages

```typescript
// Bad: All data in message string
logger.info(`User user-123 created booking book-456 for $150.50`);

// Good: Structured data
logger.info('Booking created', {
  userId: 'user-123',
  bookingId: 'book-456',
  amount: 150.5,
  currency: 'USD',
});
```

### ❌ Missing Context

```typescript
// Bad: No context
logger.error('Payment failed');

// Good: Full context
logger.error('Payment failed', {
  paymentId: 'pay-123',
  userId: 'user-456',
  amount: 150.5,
  error: 'Gateway timeout',
  retries: 3,
});
```

---

## Related Documentation

- [Scoped Loggers](./scoped-loggers.md) - Category-based logging
- [Monitoring Guide](./monitoring.md) - Integration with monitoring tools
- [API Reference](../api/logger.md) - Complete API docs

---

**Last updated:** 2024-01-15
