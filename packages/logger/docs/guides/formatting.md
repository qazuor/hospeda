# Log Formatting Guide

Complete guide to formatting log output for optimal readability and functionality.

## Table of Contents

- [Overview](#overview)
- [Timestamps](#timestamps)
- [Log Levels](#log-levels)
- [Colors](#colors)
- [Object Expansion](#object-expansion)
- [Text Truncation](#text-truncation)
- [Object Stringification](#object-stringification)
- [Custom Formatting](#custom-formatting)
- [Environment-Based Formatting](#environment-based-formatting)
- [Examples](#examples)
- [Best Practices](#best-practices)

---

## Overview

The logger provides extensive formatting options to control how logs appear in console and log files. Proper formatting improves readability, debuggability, and log analysis.

**Key Formatting Features:**

- Configurable timestamps
- Color-coded output
- Object expansion control
- Text truncation for large payloads
- JSON vs pretty formatting
- Category-specific formatting

---

## Timestamps

Control timestamp display in log output.

### Enable Timestamps

```typescript
import { logger } from '@repo/logger';

/**
 * Configure global timestamp display
 */
logger.configure({
  INCLUDE_TIMESTAMPS: true,
});

logger.info('Server started', { port: 3001 });
// Output: [2024-01-15T10:30:00.000Z] [INFO] Server started
//   port: 3001
```

### Disable Timestamps

```typescript
import { logger } from '@repo/logger';

/**
 * Disable timestamps for cleaner output
 */
logger.configure({
  INCLUDE_TIMESTAMPS: false,
});

logger.info('Server started', { port: 3001 });
// Output: [INFO] Server started
//   port: 3001
```

### Timestamp Format

```typescript
import { logger } from '@repo/logger';

/**
 * Timestamps use ISO 8601 format
 */
logger.configure({
  INCLUDE_TIMESTAMPS: true,
});

logger.info('Event occurred');
// Output: [2024-01-15T10:30:00.123Z] [INFO] Event occurred

// Timestamp structure:
// YYYY-MM-DDTHH:mm:ss.sssZ
// 2024-01-15T10:30:00.123Z
//
// Components:
// - YYYY: Year (2024)
// - MM: Month (01)
// - DD: Day (15)
// - T: Time separator
// - HH: Hour (10)
// - mm: Minute (30)
// - ss: Second (00)
// - sss: Millisecond (123)
// - Z: UTC timezone
```

### Environment-Based Timestamps

```typescript
import { logger } from '@repo/logger';

/**
 * Show timestamps in production, hide in development
 */
logger.configure({
  INCLUDE_TIMESTAMPS: process.env.NODE_ENV === 'production',
});

// Development:
// [INFO] Server started

// Production:
// [2024-01-15T10:30:00.000Z] [INFO] Server started
```

---

## Log Levels

Control log level display in output.

### Show Log Levels

```typescript
import { logger } from '@repo/logger';

/**
 * Include log level in output (default)
 */
logger.configure({
  INCLUDE_LEVEL: true,
});

logger.debug('Debug message');
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message');

// Output:
// [DEBUG] Debug message
// [INFO] Info message
// [WARN] Warning message
// [ERROR] Error message
```

### Hide Log Levels

```typescript
import { logger } from '@repo/logger';

/**
 * Hide log level for cleaner output
 */
logger.configure({
  INCLUDE_LEVEL: false,
});

logger.info('Server started', { port: 3001 });

// Output (no [INFO] prefix):
// Server started
//   port: 3001
```

### Log Level Colors

```typescript
import { logger } from '@repo/logger';

/**
 * Log levels have default colors
 */
logger.configure({
  INCLUDE_LEVEL: true,
});

logger.debug('Debug message'); // Cyan
logger.info('Info message'); // Green
logger.warn('Warning message'); // Yellow
logger.error('Error message'); // Red

// Default color mapping:
// - debug: CYAN
// - info: GREEN
// - warn: YELLOW
// - error: RED
```

---

## Colors

Use colors to visually distinguish different types of logs.

### Available Colors

```typescript
import { LoggerColors } from '@repo/logger';

/**
 * Complete color palette
 */
enum LoggerColors {
  // Text colors
  RESET = '\x1b[0m',     // Reset to default
  BRIGHT = '\x1b[1m',    // Bright/bold
  DIM = '\x1b[2m',       // Dimmed

  BLACK = '\x1b[30m',    // Black text
  RED = '\x1b[31m',      // Red text
  GREEN = '\x1b[32m',    // Green text
  YELLOW = '\x1b[33m',   // Yellow text
  BLUE = '\x1b[34m',     // Blue text
  MAGENTA = '\x1b[35m',  // Magenta text
  CYAN = '\x1b[36m',     // Cyan text
  WHITE = '\x1b[37m',    // White text

  // Background colors
  BG_BLACK = '\x1b[40m',    // Black background
  BG_RED = '\x1b[41m',      // Red background
  BG_GREEN = '\x1b[42m',    // Green background
  BG_YELLOW = '\x1b[43m',   // Yellow background
  BG_BLUE = '\x1b[44m',     // Blue background
  BG_MAGENTA = '\x1b[45m',  // Magenta background
  BG_CYAN = '\x1b[46m',     // Cyan background
  BG_WHITE = '\x1b[47m',    // White background
}
```

### Using Colors

```typescript
import { logger, LoggerColors } from '@repo/logger';

/**
 * Create colored category loggers
 */
const apiLogger = logger.registerCategory('api', {
  color: LoggerColors.CYAN,
});

const dbLogger = logger.registerCategory('db', {
  color: LoggerColors.BLUE,
});

const errorLogger = logger.registerCategory('error', {
  color: LoggerColors.RED,
});

const successLogger = logger.registerCategory('success', {
  color: LoggerColors.GREEN,
});

apiLogger.info('API request'); // Cyan
dbLogger.info('Query executed'); // Blue
errorLogger.error('Error occurred'); // Red
successLogger.info('Success!'); // Green
```

### Color Combinations

```typescript
import { logger, LoggerColors } from '@repo/logger';

/**
 * Combine colors with log levels
 */
const warnLogger = logger.registerCategory('warning', {
  color: LoggerColors.YELLOW,
});

const criticalLogger = logger.registerCategory('critical', {
  color: LoggerColors.BG_RED + LoggerColors.WHITE, // White text on red background
});

warnLogger.warn('Be careful!'); // Yellow
criticalLogger.error('Critical error!'); // White on red
```

### Color Guidelines

```typescript
import { logger, LoggerColors } from '@repo/logger';

/**
 * Recommended color usage by purpose
 */

// API/HTTP operations
const apiLogger = logger.registerCategory('api', {
  color: LoggerColors.CYAN,
});

// Database operations
const dbLogger = logger.registerCategory('db', {
  color: LoggerColors.BLUE,
});

// Authentication/security
const authLogger = logger.registerCategory('auth', {
  color: LoggerColors.GREEN,
});

// Payments/financial
const paymentLogger = logger.registerCategory('payment', {
  color: LoggerColors.YELLOW,
});

// Errors/warnings
const errorLogger = logger.registerCategory('error', {
  color: LoggerColors.RED,
});

// Debug/development
const debugLogger = logger.registerCategory('debug', {
  color: LoggerColors.MAGENTA,
});

// Background jobs/tasks
const jobLogger = logger.registerCategory('job', {
  color: LoggerColors.DIM,
});
```

### Disabling Colors

```typescript
import { logger } from '@repo/logger';

/**
 * Disable colors for log files or CI
 */
logger.configure({
  NO_COLOR: process.env.CI === 'true',
});

// Or per category
const plainLogger = logger.registerCategory('plain', {
  color: LoggerColors.RESET, // No color
});
```

---

## Object Expansion

Control how deeply nested objects are expanded in log output.

### Expansion Levels

```typescript
import { logger } from '@repo/logger';

/**
 * Level -1: No expansion (toString)
 */
const noExpansion = logger.registerCategory('no-expansion', {
  expandObjectLevels: -1,
});

noExpansion.info('User', { id: 1, profile: { name: 'Juan' } });
// Output: [INFO] User [object Object]

/**
 * Level 0: Top level only
 */
const level0 = logger.registerCategory('level-0', {
  expandObjectLevels: 0,
});

level0.info('User', { id: 1, profile: { name: 'Juan' } });
// Output:
// [INFO] User
//   id: 1
//   profile: [object Object]

/**
 * Level 1: One level deep
 */
const level1 = logger.registerCategory('level-1', {
  expandObjectLevels: 1,
});

level1.info('User', { id: 1, profile: { name: 'Juan' } });
// Output:
// [INFO] User
//   id: 1
//   profile: { name: 'Juan' }

/**
 * Level 2: Two levels deep
 */
const level2 = logger.registerCategory('level-2', {
  expandObjectLevels: 2,
});

level2.info('User', {
  id: 1,
  profile: {
    name: 'Juan',
    settings: {
      theme: 'dark',
    },
  },
});
// Output:
// [INFO] User
//   id: 1
//   profile: {
//     name: 'Juan',
//     settings: { theme: 'dark' }
//   }

/**
 * Level 3+: Three or more levels deep
 */
const level3 = logger.registerCategory('level-3', {
  expandObjectLevels: 3,
});

level3.info('User', {
  id: 1,
  profile: {
    name: 'Juan',
    settings: {
      theme: 'dark',
      notifications: {
        email: true,
      },
    },
  },
});
// Output:
// [INFO] User
//   id: 1
//   profile: {
//     name: 'Juan',
//     settings: {
//       theme: 'dark',
//       notifications: { email: true }
//     }
//   }
```

### Use Cases

```typescript
import { logger } from '@repo/logger';

/**
 * Shallow expansion for large objects (performance)
 */
const performanceLogger = logger.registerCategory('perf', {
  expandObjectLevels: 1,
});

performanceLogger.info('Large dataset', {
  users: largeArray, // Only shows array length
  metadata: complexObject, // Only shows top level
});

/**
 * Deep expansion for debugging
 */
const debugLogger = logger.registerCategory('debug', {
  expandObjectLevels: 5,
});

debugLogger.debug('Full context', {
  request: nestedRequestObject,
  response: nestedResponseObject,
  state: applicationState,
});

/**
 * No expansion for production (performance)
 */
const prodLogger = logger.registerCategory('prod', {
  expandObjectLevels: process.env.NODE_ENV === 'production' ? 0 : 2,
});
```

### Complex Object Example

```typescript
import { logger } from '@repo/logger';

const accommodation = {
  id: 'acc-123',
  title: 'Beach House',
  owner: {
    id: 'user-456',
    name: 'Juan Pérez',
    contact: {
      email: 'juan@example.com',
      phone: {
        country: '+54',
        number: '9123456789',
      },
    },
  },
  amenities: [
    { id: 'am-1', name: 'WiFi', category: { id: 'cat-1', name: 'Tech' } },
    { id: 'am-2', name: 'Pool', category: { id: 'cat-2', name: 'Outdoor' } },
  ],
};

/**
 * Level 1: Shows owner and amenities as objects
 */
const level1Logger = logger.registerCategory('l1', { expandObjectLevels: 1 });
level1Logger.info('Accommodation', accommodation);
// Output:
// id: 'acc-123'
// title: 'Beach House'
// owner: { id: 'user-456', name: 'Juan Pérez', contact: [Object] }
// amenities: [ [Object], [Object] ]

/**
 * Level 2: Shows contact and amenities expanded
 */
const level2Logger = logger.registerCategory('l2', { expandObjectLevels: 2 });
level2Logger.info('Accommodation', accommodation);
// Output:
// id: 'acc-123'
// title: 'Beach House'
// owner: {
//   id: 'user-456',
//   name: 'Juan Pérez',
//   contact: { email: 'juan@example.com', phone: [Object] }
// }
// amenities: [
//   { id: 'am-1', name: 'WiFi', category: [Object] },
//   { id: 'am-2', name: 'Pool', category: [Object] }
// ]

/**
 * Level 3: Shows phone and category expanded
 */
const level3Logger = logger.registerCategory('l3', { expandObjectLevels: 3 });
level3Logger.info('Accommodation', accommodation);
// Output: Full object structure expanded
```

---

## Text Truncation

Truncate long text strings to prevent overwhelming log output.

### Enable Truncation

```typescript
import { logger } from '@repo/logger';

/**
 * Truncate long text at default length (200 chars)
 */
const truncatedLogger = logger.registerCategory('truncated', {
  truncateLongText: true,
});

const longText = 'A'.repeat(500);

truncatedLogger.info('Response', { body: longText });
// Output: [INFO] Response
//   body: AAAAAAAAAA... (truncated at 200 characters)
```

### Custom Truncation Length

```typescript
import { logger } from '@repo/logger';

/**
 * Truncate at custom length
 */
const logger50 = logger.registerCategory('short', {
  truncateLongText: true,
  truncateLongTextAt: 50,
});

const logger500 = logger.registerCategory('long', {
  truncateLongText: true,
  truncateLongTextAt: 500,
});

const text = 'Lorem ipsum dolor sit amet, '.repeat(20);

logger50.info('Short', { text });
// Output: Lorem ipsum dolor sit amet, Lorem ipsum dolor... (50 chars)

logger500.info('Long', { text });
// Output: Full text up to 500 characters...
```

### Disable Truncation

```typescript
import { logger } from '@repo/logger';

/**
 * Show full text (no truncation)
 */
const fullLogger = logger.registerCategory('full', {
  truncateLongText: false,
});

const veryLongText = 'A'.repeat(10000);

fullLogger.info('Complete data', { text: veryLongText });
// Output: Full 10,000 character string
```

### Use Cases

```typescript
import { logger } from '@repo/logger';

/**
 * Truncate API responses
 */
const apiLogger = logger.registerCategory('api', {
  truncateLongText: true,
  truncateLongTextAt: 300,
});

apiLogger.info('API response', {
  body: largeJsonResponse, // Truncated at 300 chars
});

/**
 * Truncate database queries
 */
const dbLogger = logger.registerCategory('db', {
  truncateLongText: true,
  truncateLongTextAt: 100,
});

dbLogger.debug('Query', {
  sql: complexQueryString, // Truncated at 100 chars
});

/**
 * Don't truncate error messages
 */
const errorLogger = logger.registerCategory('error', {
  truncateLongText: false, // Show full error
});

errorLogger.error('Error occurred', {
  stack: error.stack, // Full stack trace
});

/**
 * Environment-based truncation
 */
const smartLogger = logger.registerCategory('smart', {
  truncateLongText: process.env.NODE_ENV === 'production',
  truncateLongTextAt: process.env.NODE_ENV === 'production' ? 100 : 500,
});
```

### Truncation with Object Expansion

```typescript
import { logger } from '@repo/logger';

/**
 * Combine truncation with object expansion
 */
const combinedLogger = logger.registerCategory('combined', {
  expandObjectLevels: 2, // Expand 2 levels
  truncateLongText: true, // Truncate long strings
  truncateLongTextAt: 150, // At 150 characters
});

combinedLogger.info('Complex data', {
  user: {
    id: 'user-123',
    bio: 'A'.repeat(500), // Truncated at 150
    settings: {
      description: 'B'.repeat(500), // Truncated at 150
    },
  },
});

// Output:
// [INFO] Complex data
//   user: {
//     id: 'user-123',
//     bio: 'AAAAAA...' (truncated),
//     settings: { description: 'BBBBBB...' (truncated) }
//   }
```

---

## Object Stringification

Control whether objects are stringified to JSON or inspected.

### Inspect Objects (Default)

```typescript
import { logger } from '@repo/logger';

/**
 * Inspect objects for readable output
 */
const inspectLogger = logger.registerCategory('inspect', {
  stringifyObjects: false, // Default
});

const user = {
  id: 'user-123',
  email: 'juan@example.com',
  createdAt: new Date('2024-01-15'),
};

inspectLogger.info('User', user);
// Output:
// [INFO] User
//   id: 'user-123'
//   email: 'juan@example.com'
//   createdAt: 2024-01-15T00:00:00.000Z
```

### Stringify Objects

```typescript
import { logger } from '@repo/logger';

/**
 * Stringify objects to JSON
 */
const stringifyLogger = logger.registerCategory('stringify', {
  stringifyObjects: true,
});

const user = {
  id: 'user-123',
  email: 'juan@example.com',
  createdAt: new Date('2024-01-15'),
};

stringifyLogger.info('User', user);
// Output:
// [INFO] User {"id":"user-123","email":"juan@example.com","createdAt":"2024-01-15T00:00:00.000Z"}
```

### Use Cases

```typescript
import { logger } from '@repo/logger';

/**
 * Stringify for log aggregation services
 */
const productionLogger = logger.registerCategory('production', {
  stringifyObjects: process.env.NODE_ENV === 'production',
});

// Production: JSON format for parsing
// Development: Inspected format for readability

/**
 * Stringify for API payloads
 */
const apiLogger = logger.registerCategory('api', {
  stringifyObjects: true,
});

apiLogger.info('Request payload', requestBody);
// Output: {"title":"Beach House","city":"Concepción",...}

/**
 * Inspect for debugging
 */
const debugLogger = logger.registerCategory('debug', {
  stringifyObjects: false,
  expandObjectLevels: 3,
});

debugLogger.debug('State', applicationState);
// Output: Readable nested object structure
```

---

## Custom Formatting

Create custom formatting per category.

### Custom Category Format

```typescript
import { logger, LoggerColors } from '@repo/logger';

/**
 * API logger with custom formatting
 */
const apiLogger = logger.registerCategory('api', {
  color: LoggerColors.CYAN,
  level: 'info',
  expandObjectLevels: 1,
  truncateLongText: true,
  truncateLongTextAt: 200,
  stringifyObjects: false,
});

/**
 * Database logger with different formatting
 */
const dbLogger = logger.registerCategory('db', {
  color: LoggerColors.BLUE,
  level: 'debug',
  expandObjectLevels: 2,
  truncateLongText: true,
  truncateLongTextAt: 100,
  stringifyObjects: false,
});

/**
 * Production logger with minimal formatting
 */
const prodLogger = logger.registerCategory('prod', {
  color: LoggerColors.RESET,
  level: 'warn',
  expandObjectLevels: 0,
  truncateLongText: true,
  truncateLongTextAt: 50,
  stringifyObjects: true,
});
```

### Environment-Specific Formatting

```typescript
import { logger, LoggerColors } from '@repo/logger';

/**
 * Development: Verbose, colored, readable
 */
const devConfig = {
  color: LoggerColors.CYAN,
  level: 'debug' as const,
  expandObjectLevels: 3,
  truncateLongText: false,
  stringifyObjects: false,
};

/**
 * Production: Minimal, JSON, efficient
 */
const prodConfig = {
  color: LoggerColors.RESET,
  level: 'warn' as const,
  expandObjectLevels: 0,
  truncateLongText: true,
  truncateLongTextAt: 100,
  stringifyObjects: true,
};

/**
 * Create logger with environment-specific config
 */
const envLogger = logger.registerCategory(
  'app',
  process.env.NODE_ENV === 'production' ? prodConfig : devConfig
);
```

### Factory Pattern for Consistent Formatting

```typescript
import { logger, LoggerColors, type LoggerCategoryOptions } from '@repo/logger';

/**
 * Base configuration for all loggers
 */
const baseConfig: LoggerCategoryOptions = {
  save: true,
  truncateLongText: true,
  truncateLongTextAt: 200,
  expandObjectLevels: 2,
};

/**
 * Create logger with consistent formatting
 */
const createFormattedLogger = (
  name: string,
  overrides: Partial<LoggerCategoryOptions> = {}
) => {
  return logger.registerCategory(name, {
    ...baseConfig,
    ...overrides,
  });
};

/**
 * Create domain-specific loggers
 */
const apiLogger = createFormattedLogger('api', {
  color: LoggerColors.CYAN,
});

const dbLogger = createFormattedLogger('db', {
  color: LoggerColors.BLUE,
  level: 'debug',
});

const authLogger = createFormattedLogger('auth', {
  color: LoggerColors.GREEN,
  level: 'info',
});
```

---

## Environment-Based Formatting

Adjust formatting based on environment.

### Development Formatting

```typescript
import { logger, LoggerColors } from '@repo/logger';

/**
 * Development: Maximum readability
 */
if (process.env.NODE_ENV === 'development') {
  logger.configure({
    INCLUDE_TIMESTAMPS: false, // Less clutter
    INCLUDE_LEVEL: true,
    NO_COLOR: false, // Enable colors
  });

  const devLogger = logger.registerCategory('dev', {
    color: LoggerColors.CYAN,
    level: 'debug', // Verbose
    expandObjectLevels: 3, // Deep expansion
    truncateLongText: false, // Show all
    stringifyObjects: false, // Readable
  });
}
```

### Production Formatting

```typescript
import { logger } from '@repo/logger';

/**
 * Production: Structured, parseable logs
 */
if (process.env.NODE_ENV === 'production') {
  logger.configure({
    INCLUDE_TIMESTAMPS: true, // For log aggregation
    INCLUDE_LEVEL: true,
    NO_COLOR: true, // No ANSI codes in logs
  });

  const prodLogger = logger.registerCategory('prod', {
    level: 'warn', // Minimal
    expandObjectLevels: 0, // Compact
    truncateLongText: true, // Prevent huge logs
    truncateLongTextAt: 100,
    stringifyObjects: true, // JSON format
  });
}
```

### Test Formatting

```typescript
import { logger } from '@repo/logger';

/**
 * Test: Minimal, quiet output
 */
if (process.env.NODE_ENV === 'test') {
  logger.configure({
    INCLUDE_TIMESTAMPS: false,
    INCLUDE_LEVEL: false,
    NO_COLOR: true,
  });

  const testLogger = logger.registerCategory('test', {
    level: 'error', // Only errors
    expandObjectLevels: 1,
    truncateLongText: true,
    truncateLongTextAt: 50,
  });
}
```

### Staging Formatting

```typescript
import { logger, LoggerColors } from '@repo/logger';

/**
 * Staging: Balance between dev and prod
 */
if (process.env.NODE_ENV === 'staging') {
  logger.configure({
    INCLUDE_TIMESTAMPS: true,
    INCLUDE_LEVEL: true,
    NO_COLOR: false,
  });

  const stagingLogger = logger.registerCategory('staging', {
    color: LoggerColors.YELLOW,
    level: 'info',
    expandObjectLevels: 2,
    truncateLongText: true,
    truncateLongTextAt: 200,
    stringifyObjects: false,
  });
}
```

---

## Examples

Complete formatting examples for different scenarios.

### API Request Logging

```typescript
import { logger, LoggerColors } from '@repo/logger';

/**
 * API logger with optimal formatting
 */
const apiLogger = logger.registerCategory('api', {
  color: LoggerColors.CYAN,
  level: 'info',
  expandObjectLevels: 2,
  truncateLongText: true,
  truncateLongTextAt: 300,
  stringifyObjects: false,
});

apiLogger.info('GET /accommodations', {
  query: {
    city: 'Concepción',
    minPrice: 50,
    maxPrice: 200,
  },
  requestId: 'req-123',
  userId: 'user-456',
});

// Output:
// [API] GET /accommodations
//   query: {
//     city: 'Concepción',
//     minPrice: 50,
//     maxPrice: 200
//   }
//   requestId: 'req-123'
//   userId: 'user-456'
```

### Database Query Logging

```typescript
import { logger, LoggerColors } from '@repo/logger';

/**
 * Database logger with query-friendly formatting
 */
const dbLogger = logger.registerCategory('db', {
  color: LoggerColors.BLUE,
  level: 'debug',
  expandObjectLevels: 1,
  truncateLongText: true,
  truncateLongTextAt: 100,
  stringifyObjects: false,
});

dbLogger.debug('Query executed', {
  sql: 'SELECT * FROM accommodations WHERE city = $1 AND price_per_night BETWEEN $2 AND $3',
  params: ['Concepción', 50, 200],
  duration: '45ms',
  rows: 12,
});

// Output:
// [DB] Query executed
//   sql: 'SELECT * FROM accommodations WHERE city = $1 AND price_per_night BETWEEN $2 AND $3'
//   params: ['Concepción', 50, 200]
//   duration: '45ms'
//   rows: 12
```

### Error Logging with Full Context

```typescript
import { logger, LoggerColors } from '@repo/logger';

/**
 * Error logger with full details
 */
const errorLogger = logger.registerCategory('error', {
  color: LoggerColors.RED,
  level: 'error',
  expandObjectLevels: 3, // Deep for debugging
  truncateLongText: false, // Show full error
  stringifyObjects: false,
});

try {
  await processPayment(paymentData);
} catch (error) {
  errorLogger.error('Payment processing failed', {
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
    paymentData: {
      amount: paymentData.amount,
      bookingId: paymentData.bookingId,
      userId: paymentData.userId,
    },
    timestamp: new Date().toISOString(),
  });
}

// Output:
// [ERROR] Payment processing failed
//   error: 'Mercado Pago API timeout'
//   stack: 'Error: Mercado Pago API timeout\n    at processPayment (/app/payment.ts:45:11)\n    ...'
//   paymentData: {
//     amount: 1500,
//     bookingId: 'book-789',
//     userId: 'user-123'
//   }
//   timestamp: '2024-01-15T10:30:00.000Z'
```

### Performance Monitoring

```typescript
import { logger, LoggerColors } from '@repo/logger';

/**
 * Performance logger with timing data
 */
const perfLogger = logger.registerCategory('perf', {
  color: LoggerColors.YELLOW,
  level: 'info',
  expandObjectLevels: 2,
  truncateLongText: true,
  truncateLongTextAt: 200,
  stringifyObjects: false,
});

perfLogger.info('Search performance', {
  operation: 'search',
  filters: {
    city: 'Concepción',
    priceRange: [50, 200],
  },
  metrics: {
    queryTime: '45ms',
    resultCount: 12,
    cacheHit: true,
    totalTime: '52ms',
  },
});

// Output:
// [PERF] Search performance
//   operation: 'search'
//   filters: {
//     city: 'Concepción',
//     priceRange: [50, 200]
//   }
//   metrics: {
//     queryTime: '45ms',
//     resultCount: 12,
//     cacheHit: true,
//     totalTime: '52ms'
//   }
```

### Production JSON Logging

```typescript
import { logger } from '@repo/logger';

/**
 * Production logger with JSON output
 */
const prodLogger = logger.registerCategory('prod', {
  level: 'info',
  expandObjectLevels: 0,
  truncateLongText: true,
  truncateLongTextAt: 100,
  stringifyObjects: true,
});

prodLogger.info('Request processed', {
  method: 'POST',
  path: '/bookings',
  status: 201,
  duration: '234ms',
  userId: 'user-123',
});

// Output (single line JSON):
// [INFO] Request processed {"method":"POST","path":"/bookings","status":201,"duration":"234ms","userId":"user-123"}
```

---

## Best Practices

### 1. Use Appropriate Expansion Levels

```typescript
// ❌ Bad: Too deep for production
const prodLogger = logger.registerCategory('prod', {
  expandObjectLevels: 10, // Huge logs
});

// ✅ Good: Shallow for production
const prodLogger = logger.registerCategory('prod', {
  expandObjectLevels: 1, // Compact
});

// ✅ Good: Deep for debugging
const debugLogger = logger.registerCategory('debug', {
  expandObjectLevels: 3,
});
```

### 2. Truncate in Production

```typescript
// ❌ Bad: No truncation
const apiLogger = logger.registerCategory('api', {
  truncateLongText: false, // Can log huge payloads
});

// ✅ Good: Truncate long text
const apiLogger = logger.registerCategory('api', {
  truncateLongText: true,
  truncateLongTextAt: 200,
});
```

### 3. Use Colors Consistently

```typescript
// ✅ Color scheme
const loggers = {
  api: logger.registerCategory('api', { color: LoggerColors.CYAN }),
  db: logger.registerCategory('db', { color: LoggerColors.BLUE }),
  auth: logger.registerCategory('auth', { color: LoggerColors.GREEN }),
  payment: logger.registerCategory('payment', { color: LoggerColors.YELLOW }),
  error: logger.registerCategory('error', { color: LoggerColors.RED }),
};
```

### 4. Environment-Specific Configuration

```typescript
// ✅ Different configs per environment
const config =
  process.env.NODE_ENV === 'production'
    ? {
        level: 'warn' as const,
        expandObjectLevels: 0,
        truncateLongText: true,
        stringifyObjects: true,
      }
    : {
        level: 'debug' as const,
        expandObjectLevels: 3,
        truncateLongText: false,
        stringifyObjects: false,
      };

const logger = logger.registerCategory('app', config);
```

### 5. Balance Readability and Performance

```typescript
// ✅ Readable in development
const devLogger = logger.registerCategory('dev', {
  expandObjectLevels: 3,
  truncateLongText: false,
  stringifyObjects: false,
});

// ✅ Efficient in production
const prodLogger = logger.registerCategory('prod', {
  expandObjectLevels: 0,
  truncateLongText: true,
  truncateLongTextAt: 100,
  stringifyObjects: true,
});
```

---

## Related Documentation

- [Scoped Loggers](./scoped-loggers.md) - Category-based logging
- [Configuration](../configuration.md) - Global configuration
- [API Reference](../api/logger.md) - Complete API docs

---

**Last updated:** 2024-01-15
