# CLAUDE.md - Logger Package

> **📚 Main Documentation**: For project-wide guidelines, workflows, and standards, see [CLAUDE.md](../../CLAUDE.md) in the project root.


This file provides guidance for working with the Logger package (`@repo/logger`).

## Overview

Centralized logging utility providing consistent log formatting, levels, and context across all apps and packages in the monorepo. Supports structured logging with metadata.

## Key Commands

```bash
# Testing
pnpm test              # Run all tests
pnpm test:watch        # Watch mode

# Code Quality
pnpm typecheck         # TypeScript validation
pnpm lint              # Biome linting
pnpm format            # Format code
```

## Usage

### Basic Logging

```ts
import { logger } from '@repo/logger';

logger.info('Server started', { port: 3001 });
logger.error('Database connection failed', error);
logger.warn('Deprecated API endpoint used', { endpoint: '/old-api' });
logger.debug('Request received', { method: 'GET', path: '/api/users' });
```

### Log Levels

```ts
logger.debug('Debug message');     // Development details
logger.info('Info message');       // General information
logger.warn('Warning message');    // Warning conditions
logger.error('Error message');     // Error conditions
logger.fatal('Fatal message');     // Critical errors
```

### Creating Scoped Loggers

```ts
import { createLogger } from '@repo/logger';

// Create logger for specific module/feature
const apiLogger = createLogger('api');
const dbLogger = createLogger('database');
const authLogger = createLogger('auth');

apiLogger.info('API request received', { endpoint: '/users' });
dbLogger.error('Query failed', { query: 'SELECT ...' });
authLogger.warn('Invalid login attempt', { userId: 'user-123' });
```

### Structured Logging

```ts
logger.info('User created', {
  userId: 'user-123',
  email: 'user@example.com',
  role: 'admin',
  timestamp: new Date().toISOString(),
});

// Logs output:
// [INFO] [2024-01-15T10:30:00.000Z] User created
//   userId: user-123
//   email: user@example.com
//   role: admin
//   timestamp: 2024-01-15T10:30:00.000Z
```

### Error Logging

```ts
try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    operation: 'riskyOperation',
  });
}
```

### Request Logging (API)

```ts
import { apiLogger } from '@repo/logger';

app.use(async (c, next) => {
  const start = Date.now();

  apiLogger.info('Request received', {
    method: c.req.method,
    path: c.req.path,
    requestId: c.get('requestId'),
  });

  await next();

  const duration = Date.now() - start;

  apiLogger.info('Request completed', {
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    duration: `${duration}ms`,
    requestId: c.get('requestId'),
  });
});
```

## Configuration

### Environment Variables

```env
# Log level (debug, info, warn, error, fatal)
LOG_LEVEL=info

# Log format (pretty, json)
LOG_FORMAT=pretty

# Enable/disable logging
ENABLE_LOGGING=true
```

### Log Levels by Environment

```ts
// Development
LOG_LEVEL=debug

// Production
LOG_LEVEL=info

// Testing
LOG_LEVEL=error
```

## Log Formats

### Pretty Format (Development)

```
[INFO] [2024-01-15T10:30:00.000Z] [api] Server started
  port: 3001
  env: development
```

### JSON Format (Production)

```json
{
  "level": "info",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "scope": "api",
  "message": "Server started",
  "port": 3001,
  "env": "production"
}
```

## Best Practices

1. **Use appropriate log levels**
   - `debug`: Development details
   - `info`: Normal operations
   - `warn`: Potentially harmful situations
   - `error`: Error events
   - `fatal`: Critical errors requiring immediate attention

2. **Create scoped loggers** for different modules

   ```ts
   const logger = createLogger('user-service');
   ```

3. **Include context** in log messages

   ```ts
   logger.info('Action performed', {
     userId: user.id,
     action: 'create',
     resource: 'accommodation',
   });
   ```

4. **Don't log sensitive data**

   ```ts
   // Bad
   logger.info('User login', { password: 'secret123' });

   // Good
   logger.info('User login', { userId: 'user-123' });
   ```

5. **Use structured logging** for better searchability

   ```ts
   logger.error('Database query failed', {
     query: sql,
     error: error.message,
     duration: queryDuration,
   });
   ```

## Integration Examples

### In Services

```ts
import { createLogger } from '@repo/logger';

export class AccommodationService {
  private logger = createLogger('accommodation-service');

  async create(data: CreateAccommodation) {
    this.logger.info('Creating accommodation', {
      name: data.name,
      city: data.city,
    });

    try {
      const result = await this.model.create(data);

      this.logger.info('Accommodation created', {
        id: result.id,
        name: result.name,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to create accommodation', {
        error: error instanceof Error ? error.message : String(error),
        data: JSON.stringify(data),
      });

      throw error;
    }
  }
}
```

### In API Routes

```ts
import { createLogger } from '@repo/logger';

const logger = createLogger('routes:accommodations');

export const createAccommodationRoute = createRoute({
  method: 'post',
  path: '/accommodations',
  handler: async (c) => {
    logger.info('Creating accommodation', {
      userId: c.get('userId'),
      requestId: c.get('requestId'),
    });

    // Handler logic...

    logger.info('Accommodation created successfully', {
      id: result.id,
    });

    return c.json(result);
  },
});
```

## Key Features

- **Consistent formatting** across all apps/packages
- **Scoped loggers** for better organization
- **Structured metadata** for searchability
- **Environment-aware** log levels
- **TypeScript support** with full type safety
- **Zero dependencies** (uses Node.js built-in console)

## Dependencies

None - uses Node.js built-in `console` module.

## Notes

- Logger output goes to stdout/stderr
- In production, pipe logs to external service (e.g., CloudWatch, Datadog)
- Log rotation is handled by external tools, not by logger itself
- Performance impact is minimal due to simple implementation
