# @repo/logger

A powerful, configurable logger for Node.js applications with support for categories, colors, and formatting options.

## Features

- Multiple log levels (LOG, INFO, WARN, ERROR, DEBUG)
- Category support for organization
- Colorized output with icons
- Object expansion with configurable depth
- Text truncation for long messages
- Environment variable configuration
- Custom logging methods for specialized use cases

## Installation

```bash
# If using the monorepo setup
pnpm add @repo/logger

# Or with npm
npm install @repo/logger
```

## Basic Usage

```typescript
import logger from '@repo/logger';

// Basic logging
logger.info('Application started');
logger.warn('Something might be wrong');
logger.error('An error occurred');
logger.debug('Debug information');

// With labels
logger.info('User logged in', 'AUTH');

// With objects
logger.info({ user: { id: 1, name: 'John', roles: ['admin', 'user'] } });
```

## Categories

```typescript
import logger, { LoggerColors } from '@repo/logger';

// Register a category and get a logger for it in one step
const dbLogger = logger.registerCategory('Database', 'DB', {
  color: LoggerColors.BLUE,
  expandObjectLevels: 3
});

// Use the category-specific logger
dbLogger.info('Connected to database');
dbLogger.error('Query failed', 'QUERY');
```

## Configuration

```typescript
import logger, { LogLevel } from '@repo/logger';

// Configure the logger
logger.configure({
  LEVEL: LogLevel.DEBUG,
  INCLUDE_TIMESTAMPS: true,
  USE_COLORS: true,
  EXPAND_OBJECT_LEVELS: 3,
  TRUNCATE_LONG_TEXT: true,
  TRUNCATE_LONG_TEXT_AT: 200
});
```

## Environment Variables

The logger supports configuration through environment variables:

- `LOG_LEVEL` - Default log level (INFO, WARN, ERROR, DEBUG)
- `LOG_DEBUG` - Enable debug logging (true/false)
- `LOG_SAVE` - Save logs to file (true/false)
- `LOG_EXPAND_OBJECT_LEVELS` - How many levels to expand objects
- `LOG_TRUNCATE_LONG_TEXT` - Truncate long text (true/false)
- `LOG_TRUNCATE_LONG_TEXT_AT` - Length at which to truncate text

Category-specific variables:

- `LOG_CATEGORYKEY_LEVEL`
- `LOG_CATEGORYKEY_SAVE`
- `LOG_CATEGORYKEY_EXPAND_OBJECT_LEVELS`
- `LOG_CATEGORYKEY_TRUNCATE_LONG_TEXT`
- `LOG_CATEGORYKEY_TRUNCATE_LONG_TEXT_AT`

## Advanced Options

```typescript
// Log with options
logger.info('Complex object', 'DATA', {
  expandObjectLevels: 5,
  truncateLongText: false,
  category: 'DB'
});
```

## Custom Logger Methods

You can register custom logger methods for specialized logging needs:

```typescript
import logger, { LogLevel } from '@repo/logger';

// Create a database logger
const dbLogger = logger.registerCategory('Database', 'DB', {
  color: LoggerColors.BLUE
});

// Define a type for database queries
interface QueryParams {
  table: string;
  action: string;
  params: Record<string, unknown>;
  result: unknown;
}

// Register a custom method for logging queries
dbLogger.registerLogMethod<QueryParams>('query', LogLevel.INFO, 'SQL');

// Now you can use the custom method
dbLogger.query({
  table: 'users',
  action: 'insert',
  params: { name: 'John', email: 'john@example.com' },
  result: { id: 1, name: 'John', email: 'john@example.com' }
});

// Output will include category, level, timestamp, and formatted parameters
// Database 💡 [INFO] [2023-10-01 12:00:00] [SQL] => { table: "users", action: "insert", ... }
```

## Available Colors

The logger provides a set of predefined colors through the `LoggerColors` enum:

```typescript
import { LoggerColors } from '@repo/logger';

const dbLogger = logger.registerCategory('Database', 'DB', {
  color: LoggerColors.BLUE
});

// Available colors:
// BLACK, RED, GREEN, YELLOW, BLUE, MAGENTA, CYAN, WHITE, GRAY, GREY
// BLACK_BRIGHT, RED_BRIGHT, GREEN_BRIGHT, YELLOW_BRIGHT, BLUE_BRIGHT
// MAGENTA_BRIGHT, CYAN_BRIGHT, WHITE_BRIGHT
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
