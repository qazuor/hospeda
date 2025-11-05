# Log Levels API Reference

Complete guide to log levels in `@repo/logger`.

## Table of Contents

- [Overview](#overview)
- [Log Level Enum](#log-level-enum)
- [Visibility Model](#visibility-model)
- [When to Use Each Level](#when-to-use-each-level)
- [Configuration](#configuration)
- [Level Filtering](#level-filtering)
- [Examples](#examples)

## Overview

The logger supports five hierarchical log levels, each designed for specific types of messages. Log levels control both the **type** of message and its **visibility** based on configuration.

### The Five Levels

| Level | Priority | Use Case | Icon | Color |
|-------|----------|----------|------|-------|
| **DEBUG** | Lowest | Development debugging, temporary logs | 🐛 | Magenta |
| **LOG** | Low | General application flow, routine operations | 📝 | White |
| **INFO** | Medium | Important events, business milestones | 💡 | Cyan |
| **WARN** | High | Potentially harmful situations | ⚠️ | Yellow |
| **ERROR** | Highest | Error conditions requiring attention | ❌ | Red |

## Log Level Enum

### LogLevel

```typescript
enum LogLevel {
  LOG = 'LOG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG'
}
```

### LogLevelType

```typescript
type LogLevelType = keyof typeof LogLevel;
// Type: 'LOG' | 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'
```

### Import

```typescript
import { LogLevel } from '@repo/logger';
import type { LogLevelType } from '@repo/logger';
```

### Usage

```typescript
import { logger, LogLevel } from '@repo/logger';

// Set minimum log level
logger.configure({ LEVEL: LogLevel.INFO });

// Use in category registration
const dbLogger = logger.registerCategory('Database', 'DB', {
  color: LoggerColors.BLUE,
  level: 'DEBUG'  // or LogLevel.DEBUG
});
```

## Visibility Model

The logger uses a **threshold-based visibility model**: when you set a minimum log level, you see that level and all higher-priority levels.

### Hierarchy

```text
ERROR (highest priority)
  ↓
WARN
  ↓
INFO
  ↓
LOG / DEBUG (lowest priority, most permissive)
```

### Visibility Rules

| Configured Level | Visible Levels |
|-----------------|----------------|
| `ERROR` | ERROR only |
| `WARN` | WARN, ERROR |
| `INFO` | INFO, WARN, ERROR |
| `LOG` | ALL (LOG, INFO, WARN, ERROR, DEBUG) |
| `DEBUG` | ALL (LOG, INFO, WARN, ERROR, DEBUG) |

### Examples

```typescript
import { logger, LogLevel } from '@repo/logger';

// Configure to show only errors
logger.configure({ LEVEL: LogLevel.ERROR });

logger.debug('Debug message');  // NOT shown
logger.log('Log message');      // NOT shown
logger.info('Info message');    // NOT shown
logger.warn('Warning message'); // NOT shown
logger.error('Error message');  // SHOWN ✓

// Configure to show warnings and errors
logger.configure({ LEVEL: LogLevel.WARN });

logger.debug('Debug message');  // NOT shown
logger.log('Log message');      // NOT shown
logger.info('Info message');    // NOT shown
logger.warn('Warning message'); // SHOWN ✓
logger.error('Error message');  // SHOWN ✓

// Configure to show info, warnings, and errors
logger.configure({ LEVEL: LogLevel.INFO });

logger.debug('Debug message');  // NOT shown
logger.log('Log message');      // NOT shown
logger.info('Info message');    // SHOWN ✓
logger.warn('Warning message'); // SHOWN ✓
logger.error('Error message');  // SHOWN ✓

// Configure to show all logs (most permissive)
logger.configure({ LEVEL: LogLevel.LOG });
// or
logger.configure({ LEVEL: LogLevel.DEBUG });

logger.debug('Debug message');  // SHOWN ✓
logger.log('Log message');      // SHOWN ✓
logger.info('Info message');    // SHOWN ✓
logger.warn('Warning message'); // SHOWN ✓
logger.error('Error message');  // SHOWN ✓
```

## When to Use Each Level

### DEBUG

**Purpose:** Temporary debugging, development details, verbose information

**Use Cases:**

- Function entry/exit points
- Variable state inspection
- Loop iterations
- Conditional branch tracking
- Development troubleshooting

**Characteristics:**

- Most verbose
- Typically disabled in production
- Should be temporary (removed after debugging)
- Never truncates text (always shows full content)

**Examples:**

```typescript
// Function debugging
logger.debug('calculatePrice called', {
  basePrice: 100,
  taxRate: 0.21,
  discountPercent: 10
});

// State inspection
logger.debug('Current state', {
  user: currentUser,
  cart: shoppingCart,
  session: sessionData
});

// Loop iteration
for (let i = 0; i < items.length; i++) {
  logger.debug(`Processing item ${i}`, {
    item: items[i],
    progress: `${i + 1}/${items.length}`
  });
}

// Conditional tracking
if (condition) {
  logger.debug('Condition met', { condition, value });
}
```

**Best Practices:**

- Use for temporary debugging
- Remove or comment out after fixing issues
- Set `LEVEL: DEBUG` only in development
- Include detailed context

---

### LOG

**Purpose:** General application flow, routine operations

**Use Cases:**

- Application startup/shutdown
- Background task execution
- Batch processing progress
- Routine operations
- General flow tracking

**Characteristics:**

- Standard logging
- Suitable for development and staging
- Less verbose than DEBUG
- Shows routine operations

**Examples:**

```typescript
// Application lifecycle
logger.log('Application starting', {
  version: '1.0.0',
  env: process.env.NODE_ENV,
  port: 3001
});

logger.log('Database connection established');

logger.log('Application ready');

// Background tasks
logger.log('Scheduled task starting', {
  task: 'cleanup-old-bookings',
  schedule: '0 2 * * *'
});

// Batch processing
logger.log('Processing batch', {
  batchId: 'batch-123',
  totalItems: 1000,
  processed: 250,
  remaining: 750
});

// Routine operations
logger.log('Cache updated', {
  key: 'user-settings',
  ttl: 3600
});
```

**Best Practices:**

- Use for routine operations
- Include relevant context
- Don't overuse (avoid noise)
- Suitable for development/staging

---

### INFO

**Purpose:** Important events, business milestones, significant operations

**Use Cases:**

- User actions (registration, login, purchases)
- Business events (order created, payment processed)
- Important system events
- Configuration changes
- Successful major operations

**Characteristics:**

- Informational messages
- Production-appropriate
- Signals important events
- Suitable for monitoring

**Examples:**

```typescript
// User events
logger.info('User registered', {
  userId: 'user-123',
  email: 'user@example.com',
  role: 'customer'
});

logger.info('User logged in', {
  userId: 'user-456',
  ipAddress: '192.168.1.1',
  device: 'mobile'
});

// Business events
logger.info('Order created', {
  orderId: 'order-789',
  userId: 'user-123',
  total: 150.00,
  items: 3
});

logger.info('Payment processed', {
  paymentId: 'pay-456',
  orderId: 'order-789',
  amount: 150.00,
  status: 'success'
});

// System events
logger.info('Configuration updated', {
  setting: 'maxConnections',
  oldValue: 100,
  newValue: 200
});

logger.info('Feature flag enabled', {
  feature: 'newCheckout',
  enabledFor: 'all'
});
```

**Best Practices:**

- Use for significant events
- Include business context
- Suitable for production
- Good for monitoring and analytics
- Structure for searchability

---

### WARN

**Purpose:** Potentially harmful situations, deprecations, recoverable errors

**Use Cases:**

- Deprecated API usage
- Resource limits approaching
- Fallback behavior triggered
- Retryable failures
- Configuration issues (non-fatal)

**Characteristics:**

- Indicates potential problems
- Doesn't stop execution
- Requires investigation
- Production-safe

**Examples:**

```typescript
// Deprecation warnings
logger.warn('Deprecated method used', {
  method: 'oldCreateBooking',
  replacement: 'createBooking',
  userId: 'user-123',
  deprecatedSince: '2024-01-01'
});

// Resource limits
logger.warn('Memory usage high', {
  current: '950MB',
  limit: '1GB',
  percentage: 95,
  action: 'monitoring'
});

logger.warn('Rate limit approaching', {
  userId: 'user-456',
  currentRequests: 95,
  limit: 100,
  window: '1 minute'
});

// Fallback behavior
logger.warn('Cache miss, querying database', {
  cacheKey: 'user-settings-123',
  fallback: 'database'
});

logger.warn('Primary service unavailable, using backup', {
  primaryService: 'payment-api-primary',
  backupService: 'payment-api-backup'
});

// Configuration issues
logger.warn('Missing optional configuration', {
  key: 'OPTIONAL_FEATURE_FLAG',
  default: false,
  impact: 'Feature disabled'
});
```

**Best Practices:**

- Use for potential issues
- Include mitigation taken
- Don't overuse for normal flow
- Include context for investigation
- Production-safe

---

### ERROR

**Purpose:** Error conditions requiring attention, failures

**Use Cases:**

- Caught exceptions
- Failed operations
- Integration failures
- Data validation errors
- Critical system errors

**Characteristics:**

- Highest priority
- Requires immediate attention
- Often includes stack traces
- Always shown (unless explicitly filtered)
- Can optionally truncate (configurable)

**Examples:**

```typescript
// Caught exceptions
try {
  await processPayment(paymentData);
} catch (error) {
  logger.error('Payment processing failed', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    paymentId: paymentData.id,
    amount: paymentData.amount
  });
}

// Failed operations
logger.error('Database query failed', {
  query: 'SELECT * FROM accommodations',
  error: dbError.message,
  retries: 3,
  lastAttempt: new Date().toISOString()
});

// Integration failures
logger.error('External API call failed', {
  service: 'MercadoPago',
  endpoint: '/v1/payments',
  statusCode: 500,
  error: response.error,
  requestId: 'req-123'
});

// Validation errors
logger.error('Data validation failed', {
  entity: 'Accommodation',
  errors: validationErrors,
  input: sanitizedInput
});

// System errors
logger.error('File system error', {
  operation: 'write',
  path: '/tmp/uploads/image.jpg',
  error: fsError.message,
  diskSpace: '0MB'
});
```

**Best Practices:**

- Always include error message
- Include stack trace when available
- Add operation context
- Include IDs for traceability
- Consider sensitive data (don't log passwords)
- Use structured format for monitoring

---

## Configuration

### Global Configuration

Set minimum log level globally:

```typescript
import { logger, LogLevel } from '@repo/logger';

// Development: Show all logs
logger.configure({ LEVEL: LogLevel.DEBUG });

// Staging: Show all except debug
logger.configure({ LEVEL: LogLevel.LOG });

// Production: Show info, warnings, and errors
logger.configure({ LEVEL: LogLevel.INFO });

// Production (conservative): Show only warnings and errors
logger.configure({ LEVEL: LogLevel.WARN });

// Production (errors only): Show only errors
logger.configure({ LEVEL: LogLevel.ERROR });
```

### Category-Specific Configuration

Override level for specific categories:

```typescript
import { logger, LoggerColors, LogLevel } from '@repo/logger';

// Global: INFO level
logger.configure({ LEVEL: LogLevel.INFO });

// Database: DEBUG level (more verbose)
const dbLogger = logger.registerCategory('Database', 'DB', {
  color: LoggerColors.BLUE,
  level: 'DEBUG'  // Override global
});

// API: INFO level (inherits global)
const apiLogger = logger.registerCategory('API', 'API', {
  color: LoggerColors.CYAN
  // No level specified, uses global INFO
});

// Errors: ERROR level only (less verbose)
const errorLogger = logger.registerCategory('Errors', 'ERROR', {
  color: LoggerColors.RED,
  level: 'ERROR'  // Override global
});
```

### Environment Variable Configuration

#### Global Level

```bash
# .env.development
LOG_LEVEL=DEBUG

# .env.staging
LOG_LEVEL=INFO

# .env.production
LOG_LEVEL=WARN
```

#### Category-Specific Level

```bash
# Database logs: DEBUG level
LOG_DB_LEVEL=DEBUG

# API logs: INFO level
LOG_API_LEVEL=INFO

# Payment logs: WARN level
LOG_PAYMENT_LEVEL=WARN
```

### Log-Specific Override

Force a specific level for individual logs:

```typescript
// Force debug output even if global level is higher
logger.info('Important debug data', 'DEBUG', {
  debug: true  // Always show this log
});

// Override level for specific log
logger.log('Special message', 'LABEL', {
  level: 'ERROR'  // Log as ERROR level
});
```

## Level Filtering

### How Filtering Works

The logger filters logs in the `shouldLog()` function before rendering:

```typescript
// Simplified filtering logic
function shouldLog(level: LogLevel, options?: LoggerOptions): boolean {
  // 1. Check debug override
  if (options?.debug === true) {
    return true;  // Always show
  }

  // 2. Get configured level (options > category > global)
  const configLevel = options?.level ||
                      categoryLevel ||
                      globalLevel;

  // 3. Apply visibility rules
  switch (configLevel) {
    case 'ERROR':
      return level === LogLevel.ERROR;
    case 'WARN':
      return level === LogLevel.WARN || level === LogLevel.ERROR;
    case 'INFO':
      return level === LogLevel.INFO || level === LogLevel.WARN || level === LogLevel.ERROR;
    case 'LOG':
    case 'DEBUG':
    default:
      return true;  // Show all
  }
}
```

### Performance

- Filtering happens **before** formatting
- Filtered logs have minimal performance impact
- No string formatting for filtered logs
- No object expansion for filtered logs

### Examples

```typescript
import { logger, LogLevel } from '@repo/logger';

// Configure to INFO level
logger.configure({ LEVEL: LogLevel.INFO });

// These are NOT processed (filtered early)
logger.debug('Debug');  // Filtered before formatting
logger.log('Log');      // Filtered before formatting

// These ARE processed
logger.info('Info');    // ✓ Formatted and displayed
logger.warn('Warn');    // ✓ Formatted and displayed
logger.error('Error');  // ✓ Formatted and displayed

// Force debug to always show
logger.debug('Important debug', { debug: true });  // ✓ Shows even with INFO level
```

## Examples

### Environment-Based Configuration

```typescript
import { logger, LogLevel } from '@repo/logger';

function configureLoggerForEnvironment() {
  const env = process.env.NODE_ENV;

  switch (env) {
    case 'development':
      logger.configure({
        LEVEL: LogLevel.DEBUG,
        EXPAND_OBJECT_LEVELS: -1,  // Expand all
        TRUNCATE_LONG_TEXT: false,
        USE_COLORS: true
      });
      break;

    case 'staging':
      logger.configure({
        LEVEL: LogLevel.INFO,
        EXPAND_OBJECT_LEVELS: 2,
        TRUNCATE_LONG_TEXT: true,
        USE_COLORS: true
      });
      break;

    case 'production':
      logger.configure({
        LEVEL: LogLevel.WARN,
        EXPAND_OBJECT_LEVELS: 1,
        TRUNCATE_LONG_TEXT: true,
        TRUNCATE_LONG_TEXT_AT: 100,
        USE_COLORS: false
      });
      break;

    case 'test':
      logger.configure({
        LEVEL: LogLevel.ERROR,  // Only errors in tests
        USE_COLORS: false,
        INCLUDE_TIMESTAMPS: false
      });
      break;
  }
}

// Call at application startup
configureLoggerForEnvironment();
```

### Module-Specific Levels

```typescript
import { logger, LoggerColors, LogLevel } from '@repo/logger';

// Core modules: INFO level
const coreLogger = logger.registerCategory('Core', 'CORE', {
  color: LoggerColors.WHITE,
  level: 'INFO'
});

// Database: DEBUG level (verbose for troubleshooting)
const dbLogger = logger.registerCategory('Database', 'DB', {
  color: LoggerColors.BLUE,
  level: 'DEBUG'
});

// API: INFO level (standard)
const apiLogger = logger.registerCategory('API', 'API', {
  color: LoggerColors.CYAN,
  level: 'INFO'
});

// Third-party: WARN level (reduce noise)
const thirdPartyLogger = logger.registerCategory('ThirdParty', 'THIRD_PARTY', {
  color: LoggerColors.GRAY,
  level: 'WARN'
});

// Use them
coreLogger.debug('Core debug');     // NOT shown (INFO level)
coreLogger.info('Core info');       // SHOWN ✓

dbLogger.debug('DB debug');         // SHOWN ✓ (DEBUG level)
dbLogger.info('DB info');           // SHOWN ✓

apiLogger.debug('API debug');       // NOT shown (INFO level)
apiLogger.info('API info');         // SHOWN ✓

thirdPartyLogger.info('3rd info');  // NOT shown (WARN level)
thirdPartyLogger.warn('3rd warn');  // SHOWN ✓
```

### Dynamic Level Adjustment

```typescript
import { logger, LogLevel } from '@repo/logger';

// Start with conservative level
logger.configure({ LEVEL: LogLevel.WARN });

// Enable verbose logging for troubleshooting
function enableDebugLogging(duration: number = 60000) {
  logger.configure({ LEVEL: LogLevel.DEBUG });
  logger.info('Debug logging enabled', { duration: `${duration}ms` });

  setTimeout(() => {
    logger.configure({ LEVEL: LogLevel.WARN });
    logger.info('Debug logging disabled');
  }, duration);
}

// Trigger via admin endpoint or CLI
enableDebugLogging(30000);  // Enable for 30 seconds
```

---

## See Also

- [Logger API Reference](./logger-reference.md) - Complete API documentation
- [Quick Start Guide](../quick-start.md) - Get started quickly
- [Configuration Guide](../guides/formatting.md) - Formatting options
- [Examples](../examples/) - Working code examples
