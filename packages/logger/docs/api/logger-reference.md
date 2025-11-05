# Logger API Reference

Complete API documentation for the `@repo/logger` package.

## Table of Contents

- [Logger Interface](#logger-interface)
- [Core Logging Methods](#core-logging-methods)
- [Category Management](#category-management)
- [Configuration](#configuration)
- [Custom Logger Methods](#custom-logger-methods)
- [Types and Interfaces](#types-and-interfaces)

## Logger Interface

The main logger instance exported from the package.

### Import

```typescript
import { logger } from '@repo/logger';
// or
import logger from '@repo/logger';
```

### Interface Definition

```typescript
interface ILogger {
  log(value: unknown, label?: string, options?: LoggerOptions): void;
  info(value: unknown, label?: string, options?: LoggerOptions): void;
  warn(value: unknown, label?: string, options?: LoggerOptions): void;
  error(value: unknown, label?: string, options?: LoggerOptions): void;
  debug(value: unknown, label?: string, options?: LoggerOptions): void;
  registerCategory(name: string, key: string, options: LoggerCategoryOptions): ILogger;
  configure(config: LoggerConfig): void;
  resetConfig(): void;
  createLogger(categoryKey: string): ILogger;
  registerLogMethod<T>(methodName: string, level: LogLevel, defaultLabel?: string): ILogger;
  [key: string]: unknown;  // Dynamic properties for custom methods
}
```

## Core Logging Methods

### log()

Log a standard message.

**Signature:**

```typescript
log(value: unknown, label?: string, options?: LoggerOptions): void
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| value | `unknown` | Yes | Value to log (string, object, array, etc.) |
| label | `string` | No | Optional label/title for the log |
| options | `LoggerOptions` | No | Optional logging configuration |

**Examples:**

```typescript
// Simple message
logger.log('Application processing');

// With label
logger.log('Processing batch', 'BATCH');

// With object
logger.log({ batchId: 'batch-123', items: 50 });

// With label and object
logger.log({ userId: 'user-456', action: 'update' }, 'USER');

// With options
logger.log(largeData, 'DATA', {
  expandObjectLevels: 3,
  truncateLongText: false
});
```

**Output:**

```text
📝 [LOG] [2024-01-15 10:30:00] => Application processing

📝 [LOG] [2024-01-15 10:30:01] [BATCH] => Processing batch

📝 [LOG] [2024-01-15 10:30:02] => {
  "batchId": "batch-123",
  "items": 50
}
```

---

### info()

Log an informational message.

**Signature:**

```typescript
info(value: unknown, label?: string, options?: LoggerOptions): void
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| value | `unknown` | Yes | Value to log |
| label | `string` | No | Optional label/title |
| options | `LoggerOptions` | No | Optional configuration |

**Examples:**

```typescript
// Application events
logger.info('Server started', { port: 3001, env: 'production' });

// User actions
logger.info('User registered', 'AUTH', {
  userId: 'user-123',
  email: 'user@example.com'
});

// Business events
logger.info({
  type: 'order',
  action: 'created',
  orderId: 'order-456',
  total: 150.00
});
```

**Output:**

```text
💡 [INFO] [2024-01-15 10:30:00] => Server started
{
  "port": 3001,
  "env": "production"
}

💡 [INFO] [2024-01-15 10:30:01] [AUTH] => User registered
{
  "userId": "user-123",
  "email": "user@example.com"
}
```

---

### warn()

Log a warning message.

**Signature:**

```typescript
warn(value: unknown, label?: string, options?: LoggerOptions): void
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| value | `unknown` | Yes | Value to log |
| label | `string` | No | Optional label/title |
| options | `LoggerOptions` | No | Optional configuration |

**Examples:**

```typescript
// Deprecation warnings
logger.warn('Deprecated API endpoint used', {
  endpoint: '/old-api',
  userId: 'user-789',
  suggestion: 'Use /v2/api instead'
});

// Performance warnings
logger.warn('Slow query detected', 'DATABASE', {
  query: 'SELECT * FROM accommodations',
  duration: 5000,
  threshold: 1000
});

// Resource warnings
logger.warn('Memory usage high', {
  current: '950MB',
  limit: '1GB',
  percentage: 95
});
```

**Output:**

```text
⚠️  [WARN] [2024-01-15 10:30:00] => Deprecated API endpoint used
{
  "endpoint": "/old-api",
  "userId": "user-789",
  "suggestion": "Use /v2/api instead"
}
```

---

### error()

Log an error message.

**Signature:**

```typescript
error(value: unknown, label?: string, options?: LoggerOptions): void
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| value | `unknown` | Yes | Value to log (often Error objects) |
| label | `string` | No | Optional label/title |
| options | `LoggerOptions` | No | Optional configuration |

**Examples:**

```typescript
// Simple error
logger.error('Database connection failed');

// Error with context
logger.error('Payment processing failed', 'PAYMENT', {
  orderId: 'order-123',
  amount: 150.00,
  error: paymentError.message
});

// Error object
try {
  await riskyOperation();
} catch (error) {
  logger.error({
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    operation: 'riskyOperation',
    context: { userId: 'user-456' }
  }, 'ERROR');
}
```

**Output:**

```text
❌ [ERROR] [2024-01-15 10:30:00] => Database connection failed

❌ [ERROR] [2024-01-15 10:30:01] [PAYMENT] => Payment processing failed
{
  "orderId": "order-123",
  "amount": 150.00,
  "error": "Insufficient funds"
}
```

---

### debug()

Log a debug message.

**Signature:**

```typescript
debug(value: unknown, label?: string, options?: LoggerOptions): void
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| value | `unknown` | Yes | Value to log |
| label | `string` | No | Optional label/title |
| options | `LoggerOptions` | No | Optional configuration |

**Examples:**

```typescript
// Function debugging
logger.debug('Function called', 'DEBUG', {
  functionName: 'calculatePrice',
  args: { basePrice: 100, tax: 0.21 }
});

// State debugging
logger.debug({
  state: currentState,
  previousState: prevState,
  action: 'UPDATE_USER'
});

// Execution flow
logger.debug('Entering loop', {
  iteration: 0,
  totalItems: items.length
});
```

**Output:**

```text
🐛 [DEBUG] [2024-01-15 10:30:00] [DEBUG] => Function called
{
  "functionName": "calculatePrice",
  "args": {
    "basePrice": 100,
    "tax": 0.21
  }
}
```

**Note:** Debug logs are typically filtered out in production by setting a higher log level.

---

## Category Management

### registerCategory()

Register a new logger category and return a logger instance for that category.

**Signature:**

```typescript
registerCategory(
  name: string,
  key: string,
  options: LoggerCategoryOptions
): ILogger
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| name | `string` | Yes | Display name for the category |
| key | `string` | Yes | Unique key (used in env vars) |
| options | `LoggerCategoryOptions` | Yes | Category-specific configuration |

**Returns:** `ILogger` - A logger instance scoped to this category

**Options:**

```typescript
interface LoggerCategoryOptions {
  color: LoggerColorType;                    // Required: Display color
  save?: boolean;                            // Save logs to file
  expandObjectLevels?: number;               // Object expansion depth
  truncateLongText?: boolean;                // Enable text truncation
  truncateLongTextAt?: number;               // Truncation length
  truncateLongTextOnError?: boolean;         // Truncate errors
  level?: LogLevelType;                      // Minimum log level
  stringifyObj?: boolean;                    // Pretty-print objects
}
```

**Examples:**

```typescript
import { logger, LoggerColors } from '@repo/logger';

// API logger
const apiLogger = logger.registerCategory('API', 'API', {
  color: LoggerColors.CYAN,
  level: 'INFO'
});

// Database logger with custom expansion
const dbLogger = logger.registerCategory('Database', 'DB', {
  color: LoggerColors.BLUE,
  expandObjectLevels: 3,
  truncateLongText: false
});

// Service logger
const serviceLogger = logger.registerCategory('AccommodationService', 'ACCOM_SVC', {
  color: LoggerColors.GREEN,
  level: 'DEBUG'
});

// Use the scoped loggers
apiLogger.info('Request received', { path: '/api/accommodations' });
dbLogger.info('Query executed', { table: 'accommodations', duration: 12 });
serviceLogger.debug('Processing input', { input });
```

**Output:**

```text
 API  💡 [INFO] [2024-01-15 10:30:00] => Request received
{
  "path": "/api/accommodations"
}

 DATABASE  💡 [INFO] [2024-01-15 10:30:01] => Query executed
{
  "table": "accommodations",
  "duration": 12
}
```

**Environment Configuration:**

Category-specific settings can be configured via environment variables:

```bash
# Global database settings
LOG_DB_LEVEL=DEBUG
LOG_DB_EXPAND_OBJECT_LEVELS=3
LOG_DB_TRUNCATE_LONG_TEXT=false

# Global API settings
LOG_API_LEVEL=INFO
LOG_API_TRUNCATE_LONG_TEXT_AT=200
```

---

### createLogger()

Create a logger with a predefined category (legacy method).

**Signature:**

```typescript
createLogger(categoryKey: string): ILogger
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| categoryKey | `string` | Yes | Key of an already registered category |

**Returns:** `ILogger` - A logger instance scoped to the category

**Deprecation Note:** This method is deprecated. Use `registerCategory()` instead, which both registers the category and returns a logger instance.

**Example:**

```typescript
// Old way (deprecated)
registerCategoryInternal('API', 'API', { color: LoggerColors.CYAN });
const apiLogger = logger.createLogger('API');

// New way (recommended)
const apiLogger = logger.registerCategory('API', 'API', {
  color: LoggerColors.CYAN
});
```

---

## Configuration

### configure()

Configure global logger settings.

**Signature:**

```typescript
configure(config: LoggerConfig): void
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| config | `LoggerConfig` | Yes | Partial configuration object |

**Configuration Options:**

```typescript
interface LoggerConfig {
  LEVEL?: LogLevelType;                      // Minimum log level
  INCLUDE_TIMESTAMPS?: boolean;              // Show timestamps
  INCLUDE_LEVEL?: boolean;                   // Show log level
  USE_COLORS?: boolean;                      // Colored output
  SAVE?: boolean;                            // Save logs to file
  EXPAND_OBJECT_LEVELS?: number;             // Object expansion depth
  TRUNCATE_LONG_TEXT?: boolean;              // Enable truncation
  TRUNCATE_LONG_TEXT_AT?: number;            // Truncation length
  TRUNCATE_LONG_TEXT_ON_ERROR?: boolean;     // Truncate errors
  STRINGIFY_OBJECTS?: boolean;               // Pretty-print objects
}
```

**Examples:**

```typescript
import { logger, LogLevel } from '@repo/logger';

// Basic configuration
logger.configure({
  LEVEL: LogLevel.INFO,
  USE_COLORS: true
});

// Development configuration
logger.configure({
  LEVEL: LogLevel.DEBUG,
  EXPAND_OBJECT_LEVELS: -1,      // Expand all levels
  TRUNCATE_LONG_TEXT: false,
  INCLUDE_TIMESTAMPS: true
});

// Production configuration
logger.configure({
  LEVEL: LogLevel.INFO,
  EXPAND_OBJECT_LEVELS: 1,
  TRUNCATE_LONG_TEXT: true,
  TRUNCATE_LONG_TEXT_AT: 100,
  USE_COLORS: false
});

// Minimal configuration
logger.configure({
  INCLUDE_TIMESTAMPS: false,
  INCLUDE_LEVEL: false,
  USE_COLORS: false
});
```

**Default Values:**

```typescript
{
  LEVEL: LogLevel.LOG,
  INCLUDE_TIMESTAMPS: true,
  INCLUDE_LEVEL: true,
  USE_COLORS: true,
  SAVE: false,
  EXPAND_OBJECT_LEVELS: 2,
  TRUNCATE_LONG_TEXT: true,
  TRUNCATE_LONG_TEXT_AT: 100,
  TRUNCATE_LONG_TEXT_ON_ERROR: false,
  STRINGIFY_OBJECTS: true
}
```

---

### resetConfig()

Reset logger configuration to default values.

**Signature:**

```typescript
resetConfig(): void
```

**Example:**

```typescript
// Configure custom settings
logger.configure({
  LEVEL: LogLevel.DEBUG,
  USE_COLORS: false
});

// Later, reset to defaults
logger.resetConfig();

// Logger now uses default configuration
```

---

## Custom Logger Methods

### registerLogMethod()

Register a custom logger method for domain-specific logging.

**Signature:**

```typescript
registerLogMethod<T>(
  methodName: string,
  level: LogLevel,
  defaultLabel?: string
): ILogger
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| methodName | `string` | Yes | Name of the custom method |
| level | `LogLevel` | Yes | Log level for this method |
| defaultLabel | `string` | No | Default label for logs |

**Type Parameter:**

- `T` - The type of parameters the custom logger accepts

**Returns:** `ILogger` - The logger instance (for chaining)

**Examples:**

```typescript
import { logger, LoggerColors, LogLevel } from '@repo/logger';

// Create database logger
const dbLogger = logger.registerCategory('Database', 'DB', {
  color: LoggerColors.BLUE
});

// Define query log structure
interface QueryLog {
  table: string;
  action: string;
  params: Record<string, unknown>;
  result: unknown;
  duration: number;
}

// Register custom query method
dbLogger.registerLogMethod<QueryLog>('query', LogLevel.INFO, 'SQL');

// Use the custom method
dbLogger.query({
  table: 'accommodations',
  action: 'insert',
  params: { name: 'Beach House', city: 'Concepción' },
  result: { id: 1 },
  duration: 12
});
```

**Output:**

```text
 DATABASE  💡 [INFO] [2024-01-15 10:30:00] [SQL] => {
  "table": "accommodations",
  "action": "insert",
  "params": {
    "name": "Beach House",
    "city": "Concepción"
  },
  "result": {
    "id": 1
  },
  "duration": 12
}
```

**Advanced Example:**

```typescript
// API request logger
interface RequestLog {
  method: string;
  path: string;
  status: number;
  duration: number;
  requestId: string;
}

const apiLogger = logger.registerCategory('API', 'API', {
  color: LoggerColors.CYAN
});

apiLogger.registerLogMethod<RequestLog>('request', LogLevel.INFO, 'REQUEST');

// Use it
apiLogger.request({
  method: 'POST',
  path: '/api/accommodations',
  status: 201,
  duration: 45,
  requestId: 'req-123'
});

// Payment logger
interface PaymentLog {
  paymentId: string;
  amount: number;
  currency: string;
  status: 'success' | 'failed';
  provider: string;
}

const paymentLogger = logger.registerCategory('Payments', 'PAYMENT', {
  color: LoggerColors.GREEN
});

paymentLogger.registerLogMethod<PaymentLog>('payment', LogLevel.INFO, 'PAYMENT');

paymentLogger.payment({
  paymentId: 'pay-456',
  amount: 150.00,
  currency: 'ARS',
  status: 'success',
  provider: 'MercadoPago'
});
```

---

## Types and Interfaces

### LoggerOptions

Options for individual log calls.

```typescript
interface LoggerOptions {
  category?: string;                         // Category key
  level?: LogLevelType;                      // Override log level
  debug?: boolean;                           // Force debug output
  save?: boolean;                            // Save to file
  expandObjectLevels?: number;               // Object depth
  truncateLongText?: boolean;                // Enable truncation
  truncateLongTextAt?: number;               // Truncation length
  truncateLongTextOnError?: boolean;         // Truncate errors
  stringifyObj?: boolean;                    // Pretty-print
}
```

### LoggerCategoryOptions

Options for category registration.

```typescript
interface LoggerCategoryOptions {
  color: LoggerColorType;                    // Required: Display color
  save?: boolean;                            // Save logs to file
  expandObjectLevels?: number;               // Object expansion depth
  truncateLongText?: boolean;                // Enable text truncation
  truncateLongTextAt?: number;               // Truncation length
  truncateLongTextOnError?: boolean;         // Truncate errors
  level?: LogLevelType;                      // Minimum log level
  stringifyObj?: boolean;                    // Pretty-print objects
}
```

### LoggerConfig

Global logger configuration.

```typescript
interface LoggerConfig {
  LEVEL?: LogLevelType;
  INCLUDE_TIMESTAMPS?: boolean;
  INCLUDE_LEVEL?: boolean;
  USE_COLORS?: boolean;
  SAVE?: boolean;
  EXPAND_OBJECT_LEVELS?: number;
  TRUNCATE_LONG_TEXT?: boolean;
  TRUNCATE_LONG_TEXT_AT?: number;
  TRUNCATE_LONG_TEXT_ON_ERROR?: boolean;
  STRINGIFY_OBJECTS?: boolean;
}
```

### LogLevel

Log level enumeration.

```typescript
enum LogLevel {
  LOG = 'LOG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG'
}

type LogLevelType = keyof typeof LogLevel;
```

### LoggerColors

Available colors for categories.

```typescript
enum LoggerColors {
  BLACK = 'BLACK',
  RED = 'RED',
  GREEN = 'GREEN',
  YELLOW = 'YELLOW',
  BLUE = 'BLUE',
  MAGENTA = 'MAGENTA',
  CYAN = 'CYAN',
  WHITE = 'WHITE',
  GRAY = 'GRAY',
  BLACK_BRIGHT = 'BLACK_BRIGHT',
  RED_BRIGHT = 'RED_BRIGHT',
  GREEN_BRIGHT = 'GREEN_BRIGHT',
  YELLOW_BRIGHT = 'YELLOW_BRIGHT',
  BLUE_BRIGHT = 'BLUE_BRIGHT',
  MAGENTA_BRIGHT = 'MAGENTA_BRIGHT',
  CYAN_BRIGHT = 'CYAN_BRIGHT',
  WHITE_BRIGHT = 'WHITE_BRIGHT'
}

type LoggerColorType = keyof typeof LoggerColors;
```

### CustomLoggerMethod

Type for custom logger methods.

```typescript
type CustomLoggerMethod<T> = (params: T, options?: LoggerOptions) => void;
```

---

## Usage Examples

### Complete Service Example

```typescript
import { logger, LoggerColors, LogLevel } from '@repo/logger';

export class AccommodationService {
  // Create scoped logger for this service
  private logger = logger.registerCategory('AccommodationService', 'ACCOM_SVC', {
    color: LoggerColors.GREEN,
    level: 'INFO'
  });

  async create(input: CreateAccommodationInput): Promise<Accommodation> {
    // Log method entry
    this.logger.info('Creating accommodation', {
      name: input.name,
      city: input.city
    });

    try {
      // Business logic
      const result = await this.model.create(input);

      // Log success
      this.logger.info('Accommodation created successfully', {
        id: result.id,
        name: result.name
      });

      return result;
    } catch (error) {
      // Log error
      this.logger.error('Failed to create accommodation', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        input
      });

      throw error;
    }
  }

  async update(id: string, input: UpdateAccommodationInput): Promise<Accommodation> {
    this.logger.info('Updating accommodation', { id, changes: input });

    try {
      const result = await this.model.update({ id }, input);

      this.logger.info('Accommodation updated', { id, changes: input });

      return result;
    } catch (error) {
      this.logger.error('Failed to update accommodation', {
        id,
        error: error instanceof Error ? error.message : String(error)
      });

      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    this.logger.warn('Deleting accommodation', { id });

    try {
      await this.model.delete({ id });

      this.logger.info('Accommodation deleted', { id });
    } catch (error) {
      this.logger.error('Failed to delete accommodation', {
        id,
        error: error instanceof Error ? error.message : String(error)
      });

      throw error;
    }
  }
}
```

### Complete API Middleware Example

```typescript
import { logger, LoggerColors } from '@repo/logger';
import type { Context, Next } from 'hono';

const apiLogger = logger.registerCategory('API', 'API', {
  color: LoggerColors.CYAN
});

export async function requestLogger(c: Context, next: Next) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  // Set request ID in context
  c.set('requestId', requestId);

  // Log incoming request
  apiLogger.info('Request received', {
    requestId,
    method: c.req.method,
    path: c.req.path,
    query: c.req.query(),
    headers: {
      userAgent: c.req.header('user-agent'),
      contentType: c.req.header('content-type')
    }
  });

  try {
    await next();

    // Log successful response
    const duration = Date.now() - startTime;
    apiLogger.info('Request completed', {
      requestId,
      status: c.res.status,
      duration: `${duration}ms`
    });
  } catch (error) {
    // Log error
    const duration = Date.now() - startTime;
    apiLogger.error('Request failed', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      duration: `${duration}ms`
    });

    throw error;
  }
}
```

---

## See Also

- [Log Levels API](./log-levels.md) - Detailed log level documentation
- [Quick Start Guide](../quick-start.md) - Get started quickly
- [Scoped Loggers Guide](../guides/scoped-loggers.md) - Advanced category usage
- [Examples](../examples/) - Working code examples
