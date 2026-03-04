# @repo/logger

A powerful, configurable logger for Node.js applications with support for categories, colors, and formatting options.

## Features

- **Multiple log levels** (LOG, INFO, WARN, ERROR, DEBUG) with hierarchical visibility
- **Category support** for organizational clarity and scoped logging
- **Colorized output** with icons for better readability
- **Object expansion** with configurable depth for detailed inspection
- **Text truncation** for long messages to improve performance
- **Environment variable configuration** for different environments
- **Custom logging methods** for domain-specific logging needs
- **Full TypeScript support** with comprehensive type definitions
- **Hierarchical configuration** (Global → Category → Log-specific)

## Installation

```bash
# If using the monorepo setup
pnpm add @repo/logger

# Or with npm
npm install @repo/logger
```

## Quick Start

### Basic Usage

```typescript
import { logger } from '@repo/logger';

// Basic logging
logger.info('Application started', { port: 3001, env: 'development' });
logger.warn('Something might be wrong', { issue: 'deprecated-api' });
logger.error('An error occurred', { error: errorObject });
logger.debug('Debug information', { data: debugData });

// With labels
logger.info('User logged in', 'AUTH', { userId: 'user-123' });
```

### Create Scoped Loggers

```typescript
import { logger, LoggerColors } from '@repo/logger';

// Register a category and get a logger for it
const apiLogger = logger.registerCategory('API', 'API', {
  color: LoggerColors.CYAN,
  level: 'INFO'
});

const dbLogger = logger.registerCategory('Database', 'DB', {
  color: LoggerColors.BLUE,
  expandObjectLevels: 3
});

// Use the category-specific loggers
apiLogger.info('Request received', { method: 'POST', path: '/api/accommodations' });
dbLogger.info('Query executed', { table: 'accommodations', duration: 12 });
```

### Configure the Logger

```typescript
import { logger, LogLevel } from '@repo/logger';

// Configure global settings
logger.configure({
  LEVEL: LogLevel.INFO,
  INCLUDE_TIMESTAMPS: true,
  USE_COLORS: true,
  EXPAND_OBJECT_LEVELS: 2,
  TRUNCATE_LONG_TEXT: true,
  TRUNCATE_LONG_TEXT_AT: 100
});
```

## Documentation

📚 **[Complete Documentation](./docs/README.md)** - Full documentation portal

### Quick Links

- **[Quick Start Guide](./docs/quick-start.md)** - Get up and running in 5 minutes
- **[API Reference](./docs/api/logger-reference.md)** - Complete API documentation
- **[Log Levels](./docs/api/log-levels.md)** - Understanding log levels

### Guides

- **[Scoped Loggers](./docs/guides/scoped-loggers.md)** - Organize logs by category
- **[Formatting](./docs/guides/formatting.md)** - Customize log appearance
- **[Structured Logging](./docs/guides/structured-logging.md)** - Log with metadata
- **[Performance](./docs/guides/performance.md)** - Optimize logging
- **[Testing](./docs/guides/testing.md)** - Test code with logging
- **[Monitoring](./docs/guides/monitoring.md)** - Production log management

### Examples

- **[Basic Logging](./docs/examples/basic-logging.ts)** - Core logging patterns
- **[Scoped Logging](./docs/examples/scoped-logging.ts)** - Category-based loggers
- **[Structured Logging](./docs/examples/structured-logging.ts)** - Logging with metadata
- **[Error Logging](./docs/examples/error-logging.ts)** - Error handling patterns

## Environment Variables

The logger supports configuration through environment variables:

### Global Settings

- `LOG_LEVEL` - Default log level (INFO, WARN, ERROR, DEBUG)
- `LOG_SAVE` - Save logs to file (true/false)
- `LOG_EXPAND_OBJECT_LEVELS` - How many levels to expand objects
- `LOG_TRUNCATE_LONG_TEXT` - Truncate long text (true/false)
- `LOG_TRUNCATE_LONG_TEXT_AT` - Length at which to truncate text
- `LOG_TRUNCATE_LONG_TEXT_ON_ERROR` - Truncate error messages (true/false)
- `LOG_STRINGIFY_OBJECTS` - Pretty-print objects (true/false)

### Category-Specific Settings

Category-specific variables use the format: `LOG_{CATEGORY_KEY}_{SETTING}`

```bash
# Database category configuration
LOG_DB_LEVEL=DEBUG
LOG_DB_EXPAND_OBJECT_LEVELS=3
LOG_DB_TRUNCATE_LONG_TEXT=false

# API category configuration
LOG_API_LEVEL=INFO
LOG_API_TRUNCATE_LONG_TEXT_AT=200
```

## Common Use Cases

### Service Logging

```typescript
import { logger, LoggerColors } from '@repo/logger';

export class AccommodationService {
  private logger = logger.registerCategory('AccommodationService', 'ACCOM_SVC', {
    color: LoggerColors.GREEN
  });

  async create(input: CreateAccommodationInput): Promise<Accommodation> {
    this.logger.info('Creating accommodation', { name: input.name });

    try {
      const result = await this.model.create(input);
      this.logger.info('Accommodation created', { id: result.id });
      return result;
    } catch (error) {
      this.logger.error('Failed to create accommodation', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}
```

### API Request Logging

```typescript
import { logger } from '@repo/logger';

const apiLogger = logger.registerCategory('API', 'API', {
  color: LoggerColors.CYAN
});

app.use(async (c, next) => {
  const startTime = Date.now();

  apiLogger.info('Request received', {
    method: c.req.method,
    path: c.req.path,
    requestId: c.get('requestId')
  });

  await next();

  const duration = Date.now() - startTime;
  apiLogger.info('Request completed', {
    status: c.res.status,
    duration: `${duration}ms`
  });
});
```

### Custom Logger Methods

You can register custom logger methods for specialized logging needs:

```typescript
import { logger, LoggerColors, LogLevel } from '@repo/logger';

// Create a database logger
const dbLogger = logger.registerCategory('Database', 'DB', {
  color: LoggerColors.BLUE
});

// Define a type for database queries
interface QueryLog {
  table: string;
  action: string;
  params: Record<string, unknown>;
  result: unknown;
  duration: number;
}

// Register a custom method for logging queries
dbLogger.registerLogMethod<QueryLog>('query', LogLevel.INFO, 'SQL');

// Now you can use the custom method
dbLogger.query({
  table: 'users',
  action: 'insert',
  params: { name: 'John', email: 'john@example.com' },
  result: { id: 1, name: 'John', email: 'john@example.com' },
  duration: 12
});
```

## Available Colors

The logger provides a set of predefined colors through the `LoggerColors` enum:

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

## API Reference

### Log Levels

- `LogLevel.LOG` - Standard log
- `LogLevel.INFO` - Informational
- `LogLevel.WARN` - Warning
- `LogLevel.ERROR` - Error
- `LogLevel.DEBUG` - Debug

### Logger Methods

- `log(value, label?, options?)` - Standard log
- `info(value, label?, options?)` - Info log
- `warn(value, label?, options?)` - Warning log
- `error(value, label?, options?)` - Error log
- `debug(value, label?, options?)` - Debug log
- `registerCategory(name, key, options)` - Register a new category and return a logger for it
- `registerLogMethod<T>(methodName, level, defaultLabel?)` - Register a custom logging method
- `configure(config)` - Configure the logger
- `resetConfig()` - Reset to default configuration

For detailed API documentation, see [API Reference](./docs/api/logger-reference.md).

## Best Practices

1. **Use appropriate log levels** - DEBUG for development, INFO for production events, WARN for potential issues, ERROR for actual errors

2. **Create scoped loggers** - Use categories to organize logs by feature or module

   ```typescript
   const apiLogger = logger.registerCategory('API', 'API', {
     color: LoggerColors.CYAN
   });
   ```

3. **Include context** - Always provide relevant context in your logs

   ```typescript
   logger.info('Order created', {
     orderId: 'order-789',
     userId: 'user-123',
     total: 150.00
   });
   ```

4. **Don't log sensitive data** - Never log passwords, tokens, or other sensitive information

   ```typescript
   // Bad
   logger.info('User login', { password: 'secret123' });

   // Good
   logger.info('User login', { userId: 'user-123' });
   ```

5. **Use structured logging** - Structure your logs for better searchability

   ```typescript
   logger.info('Payment processed', {
     type: 'payment',
     action: 'process',
     paymentId: 'pay-123',
     status: 'success'
   });
   ```

6. **Configure for environment** - Use different log levels for different environments

   ```typescript
   // Development
   logger.configure({ LEVEL: LogLevel.DEBUG });

   // Production
   logger.configure({ LEVEL: LogLevel.INFO });
   ```

## TypeScript Support

The logger is written in TypeScript and provides full type definitions:

```typescript
import { logger, LogLevel, LoggerColors, type ILogger, type LoggerOptions } from '@repo/logger';

// All methods are fully typed
logger.info('Message', { data: 'value' });

// Custom logger methods support generics
interface CustomLog {
  customField: string;
}

dbLogger.registerLogMethod<CustomLog>('custom', LogLevel.INFO);
```

## Contributing

This package is part of the Hospeda monorepo. For contribution guidelines, see the main repository documentation.

## License

This package is part of the Hospeda monorepo and follows the same license.

---

## Related Documentation

- [Sentry Setup Guide](../../docs/monitoring/sentry-setup-guide.md)

**Next Steps:**

- Read the [Quick Start Guide](./docs/quick-start.md) to get started
- Explore the [Complete Documentation](./docs/README.md) for advanced features
- Check out the [Examples](./docs/examples/) for real-world patterns
