# @repo/logger Documentation

Welcome to the comprehensive documentation for the `@repo/logger` package - a powerful, configurable logging utility designed for the Hospeda monorepo with support for scoped categories, rich formatting, and hierarchical configuration.

## Overview

The `@repo/logger` package provides a centralized logging system with:

- **Multiple log levels**: LOG, INFO, WARN, ERROR, DEBUG with configurable visibility
- **Scoped loggers**: Create category-based loggers for different modules (API, DB, Auth, etc.)
- **Rich formatting**: Colored output with icons, timestamps, and customizable formatting
- **Hierarchical configuration**: Global → Category → Log-specific settings
- **Environment-aware**: Configure via environment variables for different environments
- **Object expansion**: Intelligent object inspection with configurable depth
- **Text truncation**: Automatic truncation for long text with customizable limits
- **Custom methods**: Register specialized logger methods for domain-specific logging
- **Type-safe**: Full TypeScript support with comprehensive type definitions

## Core Concepts

### Log Levels

The logger supports five log levels with a hierarchical visibility model:

- **DEBUG**: Most verbose - development details, temporary debugging
- **LOG**: Standard logging - general application flow
- **INFO**: Informational - important events, milestones
- **WARN**: Warning - potentially harmful situations
- **ERROR**: Error - error conditions requiring attention

**Visibility Model**: When you set a threshold (e.g., `LEVEL: INFO`), you'll see:

- `ERROR` threshold: Only ERROR messages
- `WARN` threshold: WARN + ERROR messages
- `INFO` threshold: INFO + WARN + ERROR messages
- `LOG/DEBUG` threshold: All messages (most permissive)

### Categories

Categories allow you to organize logs by feature, module, or domain:

```typescript
// Register categories for different parts of your app
const apiLogger = logger.registerCategory('API', 'API', {
  color: LoggerColors.CYAN,
  level: 'INFO'
});

const dbLogger = logger.registerCategory('Database', 'DB', {
  color: LoggerColors.BLUE,
  expandObjectLevels: 3
});
```

Each category can have its own:

- Display color and styling
- Log level threshold
- Object expansion depth
- Text truncation settings
- Custom configuration options

### Configuration Hierarchy

Logger configuration follows a three-tier hierarchy:

1. **Global Configuration**: Default settings for all logs
2. **Category Configuration**: Override global settings for specific categories
3. **Log-Specific Options**: Override category settings for individual log calls

```typescript
// Global: Truncate at 100 characters
logger.configure({ TRUNCATE_LONG_TEXT_AT: 100 });

// Category: DB logs truncate at 200 characters
const dbLogger = logger.registerCategory('DB', 'DB', {
  color: LoggerColors.BLUE,
  truncateLongTextAt: 200
});

// Log-specific: This specific log doesn't truncate
dbLogger.info(veryLongData, 'QUERY', { truncateLongText: false });
```

## Quick Navigation

### Getting Started

- **[Quick Start Guide](./quick-start.md)** - Get up and running in 5 minutes
- **[Basic Logging](./examples/basic-logging.ts)** - Simple logging patterns
- **[Scoped Logging](./examples/scoped-logging.ts)** - Category-based organization

### API Reference

- **[Logger API](./api/logger-reference.md)** - Complete API documentation
- **[Log Levels](./api/log-levels.md)** - Log level system and configuration

### Guides

- **[Scoped Loggers](./guides/scoped-loggers.md)** - Organize logs by category
- **[Formatting](./guides/formatting.md)** - Customize log appearance
- **[Structured Logging](./guides/structured-logging.md)** - Log with metadata
- **[Performance](./guides/performance.md)** - Optimize logging performance
- **[Testing](./guides/testing.md)** - Test code with logging
- **[Monitoring](./guides/monitoring.md)** - Production log management

### Examples

- **[Basic Logging](./examples/basic-logging.ts)** - Core logging methods
- **[Scoped Logging](./examples/scoped-logging.ts)** - Category-based loggers
- **[Structured Logging](./examples/structured-logging.ts)** - Metadata and context
- **[Error Logging](./examples/error-logging.ts)** - Error handling patterns

## Common Use Cases

### Application Logging

```typescript
import { logger } from '@repo/logger';

// Application startup
logger.info('Application starting', { version: '1.0.0', env: 'production' });

// Important events
logger.info('User registered', { userId: 'user-123', email: 'user@example.com' });

// Warnings
logger.warn('Rate limit approaching', { current: 95, limit: 100 });

// Errors
logger.error('Payment failed', { orderId: 'order-456', error: paymentError });
```

### API Request Logging

```typescript
import { logger } from '@repo/logger';

const apiLogger = logger.registerCategory('API', 'API', {
  color: LoggerColors.CYAN
});

// Request received
apiLogger.info('Request received', {
  method: 'POST',
  path: '/api/accommodations',
  requestId: 'req-789'
});

// Request completed
apiLogger.info('Request completed', {
  method: 'POST',
  path: '/api/accommodations',
  status: 201,
  duration: '45ms',
  requestId: 'req-789'
});
```

### Database Query Logging

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

// Use custom method
dbLogger.query({
  table: 'accommodations',
  action: 'SELECT',
  duration: 12,
  rowCount: 50
});
```

### Service Layer Logging

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

      this.logger.info('Accommodation created', {
        id: result.id,
        name: result.name
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

## Architecture

### Package Structure

```text
packages/logger/
├── src/
│   ├── index.ts           # Main exports
│   ├── types.ts           # TypeScript interfaces and enums
│   ├── logger.ts          # Core logging implementation
│   ├── config.ts          # Configuration management
│   ├── categories.ts      # Category system
│   ├── formatter.ts       # Output formatting
│   └── environment.ts     # Environment variable parsing
├── test/
│   └── ...                # Comprehensive test suite
└── docs/
    ├── README.md          # This file
    ├── quick-start.md     # Getting started guide
    ├── api/               # API reference documentation
    ├── guides/            # Feature guides
    └── examples/          # Working code examples
```

### Key Components

**Logger (`logger.ts`)**

- Core logging methods (log, info, warn, error, debug)
- Custom logger method registration
- Category-based logger creation
- Log level filtering

**Configuration (`config.ts`)**

- Global configuration management
- Default settings
- Configuration merging
- Runtime configuration updates

**Categories (`categories.ts`)**

- Category registration and management
- Category-specific configuration
- Category lookup and validation

**Formatter (`formatter.ts`)**

- Log message formatting
- Color and style application
- Timestamp formatting
- Object expansion and truncation

**Environment (`environment.ts`)**

- Environment variable parsing
- Type-safe configuration extraction
- Global and category-specific variables

## Configuration

### Global Configuration

```typescript
import { logger, LogLevel } from '@repo/logger';

logger.configure({
  LEVEL: LogLevel.INFO,                  // Minimum log level
  INCLUDE_TIMESTAMPS: true,              // Show timestamps
  INCLUDE_LEVEL: true,                   // Show log level
  USE_COLORS: true,                      // Colored output
  EXPAND_OBJECT_LEVELS: 2,               // Object depth
  TRUNCATE_LONG_TEXT: true,              // Truncate long strings
  TRUNCATE_LONG_TEXT_AT: 100,            // Truncation length
  TRUNCATE_LONG_TEXT_ON_ERROR: false,    // Truncate error messages
  STRINGIFY_OBJECTS: true                // Pretty-print objects
});
```

### Environment Variables

**Global Settings:**

- `LOG_LEVEL` - Default log level (INFO, WARN, ERROR, DEBUG)
- `LOG_SAVE` - Save logs to file (true/false)
- `LOG_EXPAND_OBJECT_LEVELS` - Object expansion depth (number)
- `LOG_TRUNCATE_LONG_TEXT` - Enable text truncation (true/false)
- `LOG_TRUNCATE_LONG_TEXT_AT` - Truncation length (number)
- `LOG_TRUNCATE_LONG_TEXT_ON_ERROR` - Truncate errors (true/false)
- `LOG_STRINGIFY_OBJECTS` - Pretty-print objects (true/false)

**Category-Specific Settings:**

Format: `LOG_{CATEGORY_KEY}_{SETTING}`

```bash
# Database category configuration
LOG_DB_LEVEL=DEBUG
LOG_DB_EXPAND_OBJECT_LEVELS=3
LOG_DB_TRUNCATE_LONG_TEXT=false

# API category configuration
LOG_API_LEVEL=INFO
LOG_API_TRUNCATE_LONG_TEXT_AT=200
```

## Best Practices

### 1. Use Appropriate Log Levels

```typescript
// DEBUG: Temporary debugging, development details
logger.debug('Function called', { args: functionArgs });

// LOG: General flow, routine operations
logger.log('Processing started', { batchId: 'batch-123' });

// INFO: Important events, milestones
logger.info('User authenticated', { userId: 'user-456' });

// WARN: Potentially harmful situations
logger.warn('Cache miss', { key: 'user-settings' });

// ERROR: Error conditions
logger.error('Database query failed', { error: dbError });
```

### 2. Create Scoped Loggers

Organize logs by feature or module:

```typescript
// Create once, use throughout module
const authLogger = logger.registerCategory('Authentication', 'AUTH', {
  color: LoggerColors.YELLOW
});

const paymentLogger = logger.registerCategory('Payments', 'PAYMENT', {
  color: LoggerColors.GREEN
});
```

### 3. Include Context

Always provide relevant context:

```typescript
// Good: Includes context
logger.info('Order created', {
  orderId: 'order-789',
  userId: 'user-123',
  total: 150.00,
  items: 3
});

// Bad: No context
logger.info('Order created');
```

### 4. Never Log Sensitive Data

```typescript
// Bad: Logs password
logger.info('User login', { email: 'user@example.com', password: 'secret123' });

// Good: No sensitive data
logger.info('User login', { email: 'user@example.com', userId: 'user-123' });
```

### 5. Use Structured Logging

Structure your logs for better searchability:

```typescript
logger.info('Payment processed', {
  type: 'payment',
  action: 'process',
  paymentId: 'pay-123',
  amount: 150.00,
  currency: 'ARS',
  status: 'success',
  duration: 45
});
```

### 6. Configure for Environment

```typescript
// Development: Verbose logging
if (process.env.NODE_ENV === 'development') {
  logger.configure({
    LEVEL: LogLevel.DEBUG,
    EXPAND_OBJECT_LEVELS: -1  // Expand all levels
  });
}

// Production: Minimal logging
if (process.env.NODE_ENV === 'production') {
  logger.configure({
    LEVEL: LogLevel.INFO,
    TRUNCATE_LONG_TEXT: true
  });
}
```

## Integration with Hospeda

The logger is designed for seamless integration across the Hospeda monorepo:

### In Services

```typescript
import { logger, LoggerColors } from '@repo/logger';

export class BookingService extends BaseCrudService {
  private logger = logger.registerCategory('BookingService', 'BOOKING_SVC', {
    color: LoggerColors.MAGENTA
  });

  async create(input: CreateBookingInput): Promise<Booking> {
    this.logger.info('Creating booking', { input });
    // ... service logic
  }
}
```

### In API Routes

```typescript
import { logger } from '@repo/logger';

const apiLogger = logger.registerCategory('API', 'API', {
  color: LoggerColors.CYAN
});

export const accommodationRoutes = new Hono();

accommodationRoutes.post('/accommodations', async (c) => {
  apiLogger.info('POST /accommodations', { requestId: c.get('requestId') });
  // ... route logic
});
```

### In Models

```typescript
import { logger, LoggerColors } from '@repo/logger';

export class AccommodationModel extends BaseModel {
  private logger = logger.registerCategory('AccommodationModel', 'ACCOM_MODEL', {
    color: LoggerColors.BLUE_BRIGHT
  });

  async findAll(filters: SearchFilters): Promise<Accommodation[]> {
    this.logger.debug('Finding accommodations', { filters });
    // ... model logic
  }
}
```

## Performance Considerations

- **Log level filtering**: Logs below the configured level are filtered early (minimal performance impact)
- **Object expansion**: Deep object expansion can be expensive - configure appropriate depth
- **Text truncation**: Reduces memory usage and improves readability for long strings
- **Production optimization**: Use higher log levels (INFO or WARN) in production

See the [Performance Guide](./guides/performance.md) for detailed optimization strategies.

## Testing

The logger provides utilities for testing code with logging:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { logger } from '@repo/logger';

describe('MyService', () => {
  it('logs service operations', () => {
    const infoSpy = vi.spyOn(console, 'info');

    myService.doSomething();

    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('Operation completed')
    );
  });
});
```

See the [Testing Guide](./guides/testing.md) for comprehensive testing patterns.

## Troubleshooting

### Logs Not Appearing

1. Check your log level configuration
2. Verify category-specific levels
3. Ensure `NODE_ENV` doesn't affect logging

### Colors Not Working

1. Verify `USE_COLORS: true` in configuration
2. Check terminal color support
3. Some CI environments disable colors

### Performance Issues

1. Reduce `EXPAND_OBJECT_LEVELS` for deep objects
2. Enable `TRUNCATE_LONG_TEXT` for long strings
3. Increase log level threshold in production

## Migration from Other Loggers

### From Console

```typescript
// Before
console.log('Message');
console.info('Info');
console.error('Error');

// After
import { logger } from '@repo/logger';

logger.log('Message');
logger.info('Info');
logger.error('Error');
```

### From Winston/Bunyan

```typescript
// Before
const logger = winston.createLogger({ level: 'info' });
logger.info('Message', { meta: 'data' });

// After
import { logger, LogLevel } from '@repo/logger';

logger.configure({ LEVEL: LogLevel.INFO });
logger.info('Message', { meta: 'data' });
```

## Support and Contribution

- **Issues**: Report issues in the main Hospeda repository
- **Documentation**: See this documentation portal
- **Examples**: Check the `examples/` directory for working code
- **Tests**: See `test/` directory for comprehensive test coverage

## License

This package is part of the Hospeda monorepo and follows the same license.

---

**Next Steps:**

1. Read the [Quick Start Guide](./quick-start.md) to get started
2. Explore the [API Reference](./api/logger-reference.md) for detailed API documentation
3. Check out the [Examples](./examples/) for real-world usage patterns
4. Review the [Guides](./guides/) for advanced features and best practices
