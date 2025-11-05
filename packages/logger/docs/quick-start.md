# Quick Start Guide

Get up and running with `@repo/logger` in 5 minutes.

## Installation

The logger is already available as an internal package in the Hospeda monorepo:

```json
{
  "dependencies": {
    "@repo/logger": "workspace:*"
  }
}
```

## Basic Usage

### Step 1: Import the Logger

```typescript
import { logger } from '@repo/logger';
```

### Step 2: Start Logging

```typescript
// Information - important events
logger.info('Application started', { port: 3001, env: 'development' });

// Warnings - potentially harmful situations
logger.warn('Deprecated API used', { endpoint: '/old-api' });

// Errors - error conditions
logger.error('Database connection failed', { error: connectionError });

// Debug - development details (filtered in production)
logger.debug('Request data', { body: requestBody });

// Standard log - general flow
logger.log('Processing batch', { batchId: 'batch-123' });
```

**Output Example:**

```text
💡 [INFO] [2024-01-15 10:30:00] => Application started
{
  "port": 3001,
  "env": "development"
}

⚠️  [WARN] [2024-01-15 10:30:05] => Deprecated API used
{
  "endpoint": "/old-api"
}
```

## Step 3: Create Scoped Loggers

Organize logs by feature or module using categories:

```typescript
import { logger, LoggerColors } from '@repo/logger';

// Register API logger
const apiLogger = logger.registerCategory('API', 'API', {
  color: LoggerColors.CYAN
});

// Register Database logger
const dbLogger = logger.registerCategory('Database', 'DB', {
  color: LoggerColors.BLUE,
  expandObjectLevels: 3  // Show more object details
});

// Use scoped loggers
apiLogger.info('Request received', {
  method: 'POST',
  path: '/api/accommodations'
});

dbLogger.info('Query executed', {
  table: 'accommodations',
  duration: 12
});
```

**Output Example:**

```text
 API  💡 [INFO] [2024-01-15 10:30:10] => Request received
{
  "method": "POST",
  "path": "/api/accommodations"
}

 DATABASE  💡 [INFO] [2024-01-15 10:30:11] => Query executed
{
  "table": "accommodations",
  "duration": 12
}
```

## Step 4: Configure the Logger

Customize logger behavior globally:

```typescript
import { logger, LogLevel } from '@repo/logger';

logger.configure({
  LEVEL: LogLevel.INFO,           // Minimum log level
  INCLUDE_TIMESTAMPS: true,       // Show timestamps
  USE_COLORS: true,               // Colored output
  EXPAND_OBJECT_LEVELS: 2,        // Object depth
  TRUNCATE_LONG_TEXT: true,       // Truncate long strings
  TRUNCATE_LONG_TEXT_AT: 100      // Truncation length
});
```

### Environment Variable Configuration

You can also configure via environment variables:

```bash
# .env.development
LOG_LEVEL=DEBUG
LOG_EXPAND_OBJECT_LEVELS=3
LOG_TRUNCATE_LONG_TEXT=false

# .env.production
LOG_LEVEL=INFO
LOG_EXPAND_OBJECT_LEVELS=1
LOG_TRUNCATE_LONG_TEXT=true
LOG_TRUNCATE_LONG_TEXT_AT=100
```

## Common Patterns

### Pattern 1: Service Logging

```typescript
import { logger, LoggerColors } from '@repo/logger';

export class AccommodationService {
  private logger = logger.registerCategory('AccommodationService', 'ACCOM_SVC', {
    color: LoggerColors.GREEN
  });

  async create(input: CreateAccommodationInput): Promise<Accommodation> {
    this.logger.info('Creating accommodation', {
      name: input.name,
      city: input.city
    });

    try {
      const result = await this.model.create(input);

      this.logger.info('Accommodation created successfully', {
        id: result.id
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to create accommodation', {
        error: error instanceof Error ? error.message : String(error),
        input
      });

      throw error;
    }
  }
}
```

### Pattern 2: API Request/Response Logging

```typescript
import { logger } from '@repo/logger';

const apiLogger = logger.registerCategory('API', 'API', {
  color: LoggerColors.CYAN
});

app.use(async (c, next) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  // Log incoming request
  apiLogger.info('Request received', {
    requestId,
    method: c.req.method,
    path: c.req.path,
    query: c.req.query()
  });

  await next();

  // Log response
  const duration = Date.now() - startTime;
  apiLogger.info('Request completed', {
    requestId,
    status: c.res.status,
    duration: `${duration}ms`
  });
});
```

### Pattern 3: Database Query Logging

```typescript
import { logger, LoggerColors, LogLevel } from '@repo/logger';

const dbLogger = logger.registerCategory('Database', 'DB', {
  color: LoggerColors.BLUE,
  expandObjectLevels: 3
});

// Register custom query method
interface QueryLog {
  table: string;
  action: string;
  duration: number;
  rowCount: number;
}

dbLogger.registerLogMethod<QueryLog>('query', LogLevel.INFO, 'SQL');

// Use in your model
export class AccommodationModel {
  async findAll(filters: SearchFilters): Promise<Accommodation[]> {
    const startTime = Date.now();

    const results = await db
      .select()
      .from(accommodations)
      .where(/* filters */);

    const duration = Date.now() - startTime;

    // Use custom query method
    dbLogger.query({
      table: 'accommodations',
      action: 'SELECT',
      duration,
      rowCount: results.length
    });

    return results;
  }
}
```

### Pattern 4: Error Logging

```typescript
import { logger } from '@repo/logger';

try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed', {
    operation: 'riskyOperation',
    error: error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : String(error),
    context: {
      userId: currentUserId,
      timestamp: new Date().toISOString()
    }
  });

  throw error;
}
```

## Log Levels Explained

### DEBUG

**When to use:** Temporary debugging, development details

```typescript
logger.debug('Function arguments', {
  args: functionArgs,
  context: executionContext
});
```

**Visibility:** Only shown when `LEVEL: DEBUG` is configured

### LOG

**When to use:** General application flow, routine operations

```typescript
logger.log('Processing batch', {
  batchId: 'batch-123',
  itemCount: 50
});
```

**Visibility:** Shown when `LEVEL: LOG` or `DEBUG` is configured

### INFO

**When to use:** Important events, milestones, business events

```typescript
logger.info('User registered', {
  userId: 'user-456',
  email: 'user@example.com'
});
```

**Visibility:** Shown when `LEVEL: INFO`, `LOG`, or `DEBUG` is configured

### WARN

**When to use:** Potentially harmful situations, deprecations

```typescript
logger.warn('Rate limit approaching', {
  current: 95,
  limit: 100,
  userId: 'user-789'
});
```

**Visibility:** Shown when `LEVEL: WARN`, `INFO`, `LOG`, or `DEBUG` is configured

### ERROR

**When to use:** Error conditions requiring attention

```typescript
logger.error('Payment processing failed', {
  orderId: 'order-123',
  error: paymentError,
  amount: 150.00
});
```

**Visibility:** Always shown (unless `LEVEL` is set higher than ERROR)

## Configuration Options

### Global Configuration

```typescript
import { logger, LogLevel } from '@repo/logger';

logger.configure({
  // Minimum log level to display
  LEVEL: LogLevel.INFO,

  // Include timestamps in logs
  INCLUDE_TIMESTAMPS: true,

  // Include log level in output
  INCLUDE_LEVEL: true,

  // Use colors in output
  USE_COLORS: true,

  // Save logs to file (future feature)
  SAVE: false,

  // How many levels to expand objects
  // -1 = expand all, 0 = don't expand, n = expand n levels
  EXPAND_OBJECT_LEVELS: 2,

  // Truncate long text
  TRUNCATE_LONG_TEXT: true,

  // Length at which to truncate
  TRUNCATE_LONG_TEXT_AT: 100,

  // Truncate error messages
  TRUNCATE_LONG_TEXT_ON_ERROR: false,

  // Pretty-print objects (vs inline JSON)
  STRINGIFY_OBJECTS: true
});
```

### Category Configuration

```typescript
const dbLogger = logger.registerCategory('Database', 'DB', {
  color: LoggerColors.BLUE,           // Category color
  level: 'DEBUG',                      // Minimum level for this category
  expandObjectLevels: 3,               // Object depth for this category
  truncateLongText: false,             // Don't truncate DB logs
  save: true                           // Save this category to file
});
```

### Log-Specific Options

```typescript
// Override configuration for a specific log
logger.info(largeObject, 'DATA', {
  expandObjectLevels: -1,        // Expand all levels for this log
  truncateLongText: false,        // Don't truncate
  category: 'SPECIAL'             // Use specific category
});
```

## Available Colors

```typescript
import { LoggerColors } from '@repo/logger';

// Standard colors
LoggerColors.BLACK
LoggerColors.RED
LoggerColors.GREEN
LoggerColors.YELLOW
LoggerColors.BLUE
LoggerColors.MAGENTA
LoggerColors.CYAN
LoggerColors.WHITE
LoggerColors.GRAY

// Bright variants
LoggerColors.BLACK_BRIGHT
LoggerColors.RED_BRIGHT
LoggerColors.GREEN_BRIGHT
LoggerColors.YELLOW_BRIGHT
LoggerColors.BLUE_BRIGHT
LoggerColors.MAGENTA_BRIGHT
LoggerColors.CYAN_BRIGHT
LoggerColors.WHITE_BRIGHT
```

### Suggested Color Scheme

```typescript
// API - Cyan
const apiLogger = logger.registerCategory('API', 'API', {
  color: LoggerColors.CYAN
});

// Database - Blue
const dbLogger = logger.registerCategory('Database', 'DB', {
  color: LoggerColors.BLUE
});

// Authentication - Yellow
const authLogger = logger.registerCategory('Auth', 'AUTH', {
  color: LoggerColors.YELLOW
});

// Payments - Green
const paymentLogger = logger.registerCategory('Payments', 'PAYMENT', {
  color: LoggerColors.GREEN
});

// Services - Magenta
const serviceLogger = logger.registerCategory('Service', 'SERVICE', {
  color: LoggerColors.MAGENTA
});

// Errors - Red
const errorLogger = logger.registerCategory('Error', 'ERROR', {
  color: LoggerColors.RED
});
```

## Environment-Specific Configuration

### Development

```typescript
// Development: Verbose logging with full details
if (process.env.NODE_ENV === 'development') {
  logger.configure({
    LEVEL: LogLevel.DEBUG,
    EXPAND_OBJECT_LEVELS: -1,      // Expand all levels
    TRUNCATE_LONG_TEXT: false,     // Don't truncate
    USE_COLORS: true,
    INCLUDE_TIMESTAMPS: true
  });
}
```

### Production

```typescript
// Production: Minimal, efficient logging
if (process.env.NODE_ENV === 'production') {
  logger.configure({
    LEVEL: LogLevel.INFO,
    EXPAND_OBJECT_LEVELS: 1,       // Minimal expansion
    TRUNCATE_LONG_TEXT: true,      // Truncate for performance
    TRUNCATE_LONG_TEXT_AT: 100,
    USE_COLORS: false,             // Disable colors in logs
    INCLUDE_TIMESTAMPS: true
  });
}
```

### Testing

```typescript
// Testing: Only errors and warnings
if (process.env.NODE_ENV === 'test') {
  logger.configure({
    LEVEL: LogLevel.WARN,
    USE_COLORS: false,
    INCLUDE_TIMESTAMPS: false
  });
}
```

## Best Practices

### 1. Always Include Context

```typescript
// Bad: No context
logger.info('User created');

// Good: Rich context
logger.info('User created', {
  userId: 'user-123',
  email: 'user@example.com',
  role: 'customer',
  timestamp: new Date().toISOString()
});
```

### 2. Use Appropriate Log Levels

```typescript
// DEBUG: Temporary debugging
logger.debug('Variable state', { myVar });

// INFO: Important business events
logger.info('Order placed', { orderId, total });

// WARN: Potential issues
logger.warn('Low stock', { productId, quantity });

// ERROR: Actual errors
logger.error('Payment failed', { error, orderId });
```

### 3. Create Category Loggers

```typescript
// Create once at module level
const serviceLogger = logger.registerCategory('AccommodationService', 'ACCOM_SVC', {
  color: LoggerColors.GREEN
});

// Use throughout the service
export class AccommodationService {
  async create(input: CreateInput) {
    serviceLogger.info('Creating accommodation', { input });
    // ...
  }
}
```

### 4. Never Log Sensitive Data

```typescript
// Bad: Logs password
logger.info('Login attempt', {
  email: 'user@example.com',
  password: 'secret123'  // DON'T DO THIS
});

// Good: No sensitive data
logger.info('Login attempt', {
  email: 'user@example.com',
  userId: 'user-456',
  ipAddress: '192.168.1.1'
});
```

### 5. Structure Your Logs

```typescript
// Consistent structure for searchability
logger.info('Event occurred', {
  type: 'booking',
  action: 'create',
  entityId: 'booking-123',
  userId: 'user-456',
  status: 'success',
  duration: 45,
  timestamp: new Date().toISOString()
});
```

## Common Issues

### Issue: Logs Not Appearing

**Cause:** Log level is set too high

**Solution:**

```typescript
// Check your configuration
logger.configure({ LEVEL: LogLevel.DEBUG });

// Or via environment variable
// LOG_LEVEL=DEBUG
```

### Issue: Colors Not Working

**Cause:** Colors disabled or terminal doesn't support colors

**Solution:**

```typescript
// Enable colors
logger.configure({ USE_COLORS: true });

// Check terminal support
// Some CI/CD environments don't support colors
```

### Issue: Too Much Information

**Cause:** Object expansion too deep

**Solution:**

```typescript
// Reduce expansion depth
logger.configure({ EXPAND_OBJECT_LEVELS: 1 });

// Or for specific log
logger.info(data, 'LABEL', { expandObjectLevels: 1 });
```

### Issue: Long Logs

**Cause:** Text truncation disabled

**Solution:**

```typescript
// Enable truncation
logger.configure({
  TRUNCATE_LONG_TEXT: true,
  TRUNCATE_LONG_TEXT_AT: 100
});
```

## Next Steps

Now that you've mastered the basics:

1. **[API Reference](./api/logger-reference.md)** - Explore all available methods
2. **[Scoped Loggers Guide](./guides/scoped-loggers.md)** - Advanced category usage
3. **[Structured Logging Guide](./guides/structured-logging.md)** - Best practices for log structure
4. **[Examples](./examples/)** - Real-world usage patterns
5. **[Performance Guide](./guides/performance.md)** - Optimize logging for production

## Quick Reference

```typescript
// Import
import { logger, LoggerColors, LogLevel } from '@repo/logger';

// Basic logging
logger.debug('Debug message', { data });
logger.log('Log message', { data });
logger.info('Info message', { data });
logger.warn('Warning message', { data });
logger.error('Error message', { data });

// Create scoped logger
const apiLogger = logger.registerCategory('API', 'API', {
  color: LoggerColors.CYAN
});

// Configure
logger.configure({
  LEVEL: LogLevel.INFO,
  USE_COLORS: true,
  EXPAND_OBJECT_LEVELS: 2
});

// Custom method
interface QueryLog {
  table: string;
  action: string;
}

dbLogger.registerLogMethod<QueryLog>('query', LogLevel.INFO, 'SQL');
dbLogger.query({ table: 'users', action: 'SELECT' });
```

---

**You're ready to start logging!** 🎉

For questions or issues, refer to the [main documentation](./README.md) or check the [examples](./examples/).
