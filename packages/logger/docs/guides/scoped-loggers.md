# Scoped Loggers Guide

Complete guide to using scoped loggers for organizing logs by module, service, or domain.

## Table of Contents

- [Overview](#overview)
- [What are Scoped Loggers?](#what-are-scoped-loggers)
- [Creating Categories](#creating-categories)
- [Category Options](#category-options)
- [Using Category Loggers](#using-category-loggers)
- [Organizing Categories](#organizing-categories)
- [Category Hierarchy](#category-hierarchy)
- [Environment Overrides](#environment-overrides)
- [Real-World Examples](#real-world-examples)
- [Best Practices](#best-practices)
- [Advanced Patterns](#advanced-patterns)

---

## Overview

Scoped loggers allow you to create focused logging instances for different parts of your application. Each scope (category) can have its own configuration, making it easy to control logging behavior per module without affecting global settings.

**Benefits:**

- **Organization**: Group related logs together
- **Filtering**: Control which logs appear in different environments
- **Debugging**: Enable verbose logging for specific modules
- **Performance**: Disable expensive logging in production selectively
- **Clarity**: Colored, labeled output for easy identification

---

## What are Scoped Loggers?

A scoped logger is a logger instance configured for a specific category or domain of your application.

### Without Scoped Loggers

```typescript
import { logger } from '@repo/logger';

// Generic logging - hard to filter
logger.info('User authenticated');
logger.info('Database query executed');
logger.info('Payment processed');

// Output:
// [INFO] User authenticated
// [INFO] Database query executed
// [INFO] Payment processed
```

### With Scoped Loggers

```typescript
import { logger } from '@repo/logger';

// Create scoped loggers
const authLogger = logger.registerCategory('auth', { color: 'green' });
const dbLogger = logger.registerCategory('db', { color: 'blue' });
const paymentLogger = logger.registerCategory('payment', { color: 'yellow' });

// Clear, categorized logging
authLogger.info('User authenticated');
dbLogger.info('Database query executed');
paymentLogger.info('Payment processed');

// Output (with colors):
// [AUTH] User authenticated
// [DB] Database query executed
// [PAYMENT] Payment processed
```

**Key Differences:**

- Each category has its own label
- Different colors for visual distinction
- Can filter by category in production
- Independent log level control

---

## Creating Categories

Use `registerCategory()` to create scoped loggers.

### Basic Category

```typescript
import { logger } from '@repo/logger';

/**
 * Register a basic category logger
 */
const apiLogger = logger.registerCategory('api');

// Use like normal logger
apiLogger.info('API server started');
apiLogger.error('Request failed');
```

### Category with Options

```typescript
import { logger, LoggerColors } from '@repo/logger';

/**
 * Register category with custom configuration
 */
const dbLogger = logger.registerCategory('db', {
  color: LoggerColors.BLUE,
  level: 'debug',
  save: true,
  expandObjectLevels: 2,
  truncateLongText: true,
});

dbLogger.debug('Query execution plan', {
  sql: 'SELECT * FROM accommodations WHERE city = $1',
  params: ['Concepción'],
  duration: 45,
});
```

### Multiple Categories

```typescript
import { logger, LoggerColors } from '@repo/logger';

/**
 * Register multiple related categories
 */
const authLogger = logger.registerCategory('auth', {
  color: LoggerColors.GREEN,
  level: 'info',
});

const sessionLogger = logger.registerCategory('session', {
  color: LoggerColors.CYAN,
  level: 'debug',
});

const jwtLogger = logger.registerCategory('jwt', {
  color: LoggerColors.MAGENTA,
  level: 'warn',
});

// Use in authentication flow
authLogger.info('Login attempt', { userId: 'user-123' });
sessionLogger.debug('Session created', { sessionId: 'sess-456' });
jwtLogger.warn('Token near expiration', { expiresIn: 300 });
```

---

## Category Options

Complete reference for category configuration options.

### color

Set visual color for category logs.

```typescript
import { logger, LoggerColors } from '@repo/logger';

const logger1 = logger.registerCategory('api', {
  color: LoggerColors.GREEN,
});

const logger2 = logger.registerCategory('db', {
  color: LoggerColors.BLUE,
});

const logger3 = logger.registerCategory('payment', {
  color: LoggerColors.YELLOW,
});
```

**Available Colors:**

```typescript
enum LoggerColors {
  RESET = '\x1b[0m',
  BRIGHT = '\x1b[1m',
  DIM = '\x1b[2m',
  BLACK = '\x1b[30m',
  RED = '\x1b[31m',
  GREEN = '\x1b[32m',
  YELLOW = '\x1b[33m',
  BLUE = '\x1b[34m',
  MAGENTA = '\x1b[35m',
  CYAN = '\x1b[36m',
  WHITE = '\x1b[37m',
  BG_BLACK = '\x1b[40m',
  BG_RED = '\x1b[41m',
  BG_GREEN = '\x1b[42m',
  BG_YELLOW = '\x1b[43m',
  BG_BLUE = '\x1b[44m',
  BG_MAGENTA = '\x1b[45m',
  BG_CYAN = '\x1b[46m',
  BG_WHITE = '\x1b[47m',
}
```

### level

Set minimum log level for the category.

```typescript
import { logger } from '@repo/logger';

/**
 * Development: verbose logging
 */
const devLogger = logger.registerCategory('dev', {
  level: 'debug', // Shows debug, info, warn, error
});

/**
 * Production: minimal logging
 */
const prodLogger = logger.registerCategory('prod', {
  level: 'warn', // Only shows warn and error
});

devLogger.debug('Detailed debug info'); // Shown in dev
devLogger.info('Informational message'); // Shown in dev
devLogger.warn('Warning message'); // Shown in both

prodLogger.debug('Detailed debug info'); // Hidden in prod
prodLogger.info('Informational message'); // Hidden in prod
prodLogger.warn('Warning message'); // Shown in both
```

**Log Levels (in order):**

1. `debug` - Most verbose
2. `info` - Standard information
3. `warn` - Warnings
4. `error` - Errors only

### save

Control whether logs are saved to file.

```typescript
import { logger } from '@repo/logger';

/**
 * Save important logs to file
 */
const auditLogger = logger.registerCategory('audit', {
  save: true, // Logs written to file
  level: 'info',
});

/**
 * Don't save debug logs
 */
const debugLogger = logger.registerCategory('debug', {
  save: false, // Console only
  level: 'debug',
});

auditLogger.info('User login', { userId: 'user-123' }); // Saved to file
debugLogger.debug('Cache hit', { key: 'user:123' }); // Console only
```

### expandObjectLevels

Control how deeply objects are expanded in logs.

```typescript
import { logger } from '@repo/logger';

/**
 * Shallow expansion (level 1)
 */
const shallowLogger = logger.registerCategory('shallow', {
  expandObjectLevels: 1,
});

/**
 * Deep expansion (level 3)
 */
const deepLogger = logger.registerCategory('deep', {
  expandObjectLevels: 3,
});

const complexObject = {
  user: {
    id: 'user-123',
    profile: {
      name: 'Juan Pérez',
      settings: {
        notifications: true,
        theme: 'dark',
      },
    },
  },
};

// Shallow: Shows user.id but not nested profile
shallowLogger.info('User data', complexObject);

// Deep: Shows full nested structure
deepLogger.info('User data', complexObject);
```

**Expansion Levels:**

- `-1`: No expansion (toString)
- `0`: Top level only
- `1`: One level deep
- `2`: Two levels deep
- `3+`: Three or more levels deep

### truncateLongText

Truncate long text in logs to prevent overwhelming output.

```typescript
import { logger } from '@repo/logger';

/**
 * Truncate long text for readability
 */
const truncatedLogger = logger.registerCategory('truncated', {
  truncateLongText: true,
  truncateLongTextAt: 100, // Truncate at 100 characters
});

/**
 * Show full text
 */
const fullLogger = logger.registerCategory('full', {
  truncateLongText: false,
});

const longText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(10);

truncatedLogger.info('Response', { body: longText });
// Output: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Lorem ipsum dolor sit amet, cons..."

fullLogger.info('Response', { body: longText });
// Output: Full text (500+ characters)
```

### truncateLongTextAt

Specify truncation length (requires `truncateLongText: true`).

```typescript
import { logger } from '@repo/logger';

const logger50 = logger.registerCategory('short', {
  truncateLongText: true,
  truncateLongTextAt: 50,
});

const logger200 = logger.registerCategory('medium', {
  truncateLongText: true,
  truncateLongTextAt: 200,
});

const text = 'A'.repeat(300);

logger50.info('Text', { content: text }); // Shows 50 chars + "..."
logger200.info('Text', { content: text }); // Shows 200 chars + "..."
```

### stringifyObjects

Convert objects to JSON strings instead of inspecting.

```typescript
import { logger } from '@repo/logger';

/**
 * Inspect objects (default)
 */
const inspectLogger = logger.registerCategory('inspect', {
  stringifyObjects: false,
});

/**
 * Stringify objects
 */
const stringifyLogger = logger.registerCategory('stringify', {
  stringifyObjects: true,
});

const user = {
  id: 'user-123',
  email: 'juan@example.com',
  createdAt: new Date('2024-01-15'),
};

inspectLogger.info('User', user);
// Output: { id: 'user-123', email: 'juan@example.com', createdAt: 2024-01-15T00:00:00.000Z }

stringifyLogger.info('User', user);
// Output: {"id":"user-123","email":"juan@example.com","createdAt":"2024-01-15T00:00:00.000Z"}
```

---

## Using Category Loggers

Practical examples of using scoped loggers in different contexts.

### In Services

```typescript
import { logger } from '@repo/logger';
import type { Accommodation } from '@repo/db';

/**
 * Accommodation service with scoped logger
 */
export class AccommodationService {
  private logger = logger.registerCategory('service:accommodation', {
    color: LoggerColors.GREEN,
    level: 'info',
  });

  /**
   * Create new accommodation
   */
  async create(input: CreateAccommodationInput): Promise<Accommodation> {
    this.logger.info('Creating accommodation', {
      title: input.title,
      city: input.city,
      ownerId: input.ownerId,
    });

    try {
      const accommodation = await this.model.create(input);

      this.logger.info('Accommodation created', {
        id: accommodation.id,
        title: accommodation.title,
      });

      return accommodation;
    } catch (error) {
      this.logger.error('Failed to create accommodation', {
        error,
        input,
      });
      throw error;
    }
  }

  /**
   * Search accommodations
   */
  async search(filters: SearchFilters): Promise<Accommodation[]> {
    this.logger.debug('Searching accommodations', { filters });

    const results = await this.model.search(filters);

    this.logger.info('Search completed', {
      filters,
      resultCount: results.length,
    });

    return results;
  }
}
```

### In API Routes

```typescript
import { Hono } from 'hono';
import { logger, LoggerColors } from '@repo/logger';

/**
 * API router with scoped logger
 */
const app = new Hono();

const apiLogger = logger.registerCategory('api:accommodations', {
  color: LoggerColors.CYAN,
  level: 'info',
});

/**
 * List accommodations
 */
app.get('/accommodations', async (c) => {
  const query = c.req.query();

  apiLogger.info('GET /accommodations', {
    query,
    requestId: c.get('requestId'),
  });

  try {
    const accommodations = await service.search(query);

    apiLogger.info('Request successful', {
      count: accommodations.length,
      requestId: c.get('requestId'),
    });

    return c.json({ success: true, data: accommodations });
  } catch (error) {
    apiLogger.error('Request failed', {
      error,
      query,
      requestId: c.get('requestId'),
    });

    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});
```

### In Models

```typescript
import { BaseModel } from '@repo/db';
import { logger, LoggerColors } from '@repo/logger';

/**
 * Accommodation model with scoped logger
 */
export class AccommodationModel extends BaseModel<Accommodation> {
  private logger = logger.registerCategory('model:accommodation', {
    color: LoggerColors.BLUE,
    level: 'debug',
  });

  /**
   * Find accommodations by city
   */
  async findByCity(city: string): Promise<Accommodation[]> {
    this.logger.debug('Query: findByCity', { city });

    const startTime = Date.now();

    const results = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.city, city));

    const duration = Date.now() - startTime;

    this.logger.debug('Query completed', {
      city,
      resultCount: results.length,
      duration: `${duration}ms`,
    });

    return results;
  }

  /**
   * Update accommodation
   */
  async update(id: string, data: UpdateData): Promise<Accommodation> {
    this.logger.info('Updating accommodation', { id, fields: Object.keys(data) });

    try {
      const updated = await this.db
        .update(this.table)
        .set(data)
        .where(eq(this.table.id, id))
        .returning();

      this.logger.info('Accommodation updated', { id });

      return updated[0];
    } catch (error) {
      this.logger.error('Update failed', { id, error });
      throw error;
    }
  }
}
```

### In Middleware

```typescript
import { createMiddleware } from 'hono/factory';
import { logger, LoggerColors } from '@repo/logger';

/**
 * Request logging middleware
 */
const requestLogger = logger.registerCategory('middleware:request', {
  color: LoggerColors.MAGENTA,
  level: 'info',
});

export const loggingMiddleware = createMiddleware(async (c, next) => {
  const startTime = Date.now();

  requestLogger.info('Request started', {
    method: c.req.method,
    path: c.req.path,
    requestId: c.get('requestId'),
  });

  await next();

  const duration = Date.now() - startTime;

  requestLogger.info('Request completed', {
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    duration: `${duration}ms`,
    requestId: c.get('requestId'),
  });
});
```

---

## Organizing Categories

Best practices for structuring categories in your application.

### By Layer

```typescript
import { logger, LoggerColors } from '@repo/logger';

/**
 * Data layer loggers
 */
export const dataLoggers = {
  db: logger.registerCategory('db', {
    color: LoggerColors.BLUE,
    level: 'debug',
  }),
  cache: logger.registerCategory('cache', {
    color: LoggerColors.CYAN,
    level: 'info',
  }),
  queue: logger.registerCategory('queue', {
    color: LoggerColors.MAGENTA,
    level: 'info',
  }),
};

/**
 * Service layer loggers
 */
export const serviceLoggers = {
  accommodation: logger.registerCategory('service:accommodation', {
    color: LoggerColors.GREEN,
    level: 'info',
  }),
  booking: logger.registerCategory('service:booking', {
    color: LoggerColors.YELLOW,
    level: 'info',
  }),
  payment: logger.registerCategory('service:payment', {
    color: LoggerColors.RED,
    level: 'warn',
  }),
};

/**
 * API layer loggers
 */
export const apiLoggers = {
  http: logger.registerCategory('api:http', {
    color: LoggerColors.CYAN,
    level: 'info',
  }),
  auth: logger.registerCategory('api:auth', {
    color: LoggerColors.GREEN,
    level: 'info',
  }),
  validation: logger.registerCategory('api:validation', {
    color: LoggerColors.YELLOW,
    level: 'warn',
  }),
};
```

### By Domain

```typescript
import { logger, LoggerColors } from '@repo/logger';

/**
 * Accommodation domain loggers
 */
export const accommodationLoggers = {
  service: logger.registerCategory('accommodation:service', {
    color: LoggerColors.GREEN,
  }),
  model: logger.registerCategory('accommodation:model', {
    color: LoggerColors.BLUE,
  }),
  api: logger.registerCategory('accommodation:api', {
    color: LoggerColors.CYAN,
  }),
};

/**
 * Booking domain loggers
 */
export const bookingLoggers = {
  service: logger.registerCategory('booking:service', {
    color: LoggerColors.YELLOW,
  }),
  model: logger.registerCategory('booking:model', {
    color: LoggerColors.BLUE,
  }),
  api: logger.registerCategory('booking:api', {
    color: LoggerColors.CYAN,
  }),
};

/**
 * Payment domain loggers
 */
export const paymentLoggers = {
  service: logger.registerCategory('payment:service', {
    color: LoggerColors.RED,
  }),
  gateway: logger.registerCategory('payment:gateway', {
    color: LoggerColors.MAGENTA,
  }),
  api: logger.registerCategory('payment:api', {
    color: LoggerColors.CYAN,
  }),
};
```

### By Feature

```typescript
import { logger, LoggerColors } from '@repo/logger';

/**
 * Authentication feature loggers
 */
export const authLoggers = {
  login: logger.registerCategory('auth:login', {
    color: LoggerColors.GREEN,
    level: 'info',
  }),
  register: logger.registerCategory('auth:register', {
    color: LoggerColors.GREEN,
    level: 'info',
  }),
  jwt: logger.registerCategory('auth:jwt', {
    color: LoggerColors.MAGENTA,
    level: 'warn',
  }),
  session: logger.registerCategory('auth:session', {
    color: LoggerColors.CYAN,
    level: 'debug',
  }),
};

/**
 * Search feature loggers
 */
export const searchLoggers = {
  query: logger.registerCategory('search:query', {
    color: LoggerColors.YELLOW,
    level: 'info',
  }),
  filter: logger.registerCategory('search:filter', {
    color: LoggerColors.YELLOW,
    level: 'debug',
  }),
  indexing: logger.registerCategory('search:indexing', {
    color: LoggerColors.BLUE,
    level: 'info',
  }),
};
```

---

## Category Hierarchy

Organize categories in hierarchical namespaces.

### Namespace Pattern

```typescript
import { logger } from '@repo/logger';

/**
 * Top-level category: api
 */
const apiLogger = logger.registerCategory('api', {
  level: 'info',
});

/**
 * Sub-categories: api:*
 */
const apiAccommodationsLogger = logger.registerCategory('api:accommodations', {
  level: 'info',
});

const apiBookingsLogger = logger.registerCategory('api:bookings', {
  level: 'info',
});

const apiPaymentsLogger = logger.registerCategory('api:payments', {
  level: 'warn',
});

/**
 * Deep nesting: api:accommodations:*
 */
const apiAccommodationsCreateLogger = logger.registerCategory(
  'api:accommodations:create',
  { level: 'debug' }
);

const apiAccommodationsSearchLogger = logger.registerCategory(
  'api:accommodations:search',
  { level: 'debug' }
);
```

### Inheritance Pattern

```typescript
import { logger, LoggerColors } from '@repo/logger';

/**
 * Parent logger with base configuration
 */
const baseConfig = {
  save: true,
  truncateLongText: true,
  truncateLongTextAt: 200,
};

/**
 * Create child loggers that inherit base config
 */
const createChildLogger = (name: string, overrides: Partial<LoggerCategoryOptions>) => {
  return logger.registerCategory(name, {
    ...baseConfig,
    ...overrides,
  });
};

/**
 * Child loggers with inherited config
 */
const authLogger = createChildLogger('auth', {
  color: LoggerColors.GREEN,
  level: 'info',
});

const dbLogger = createChildLogger('db', {
  color: LoggerColors.BLUE,
  level: 'debug',
});

const paymentLogger = createChildLogger('payment', {
  color: LoggerColors.YELLOW,
  level: 'warn',
});
```

---

## Environment Overrides

Control category behavior via environment variables.

### Global Log Level Override

```bash
# .env.production
LOG_LEVEL=warn

# All categories respect global level unless overridden
```

```typescript
import { logger } from '@repo/logger';

// Development: level='debug'
// Production: level='warn' (from LOG_LEVEL)
const apiLogger = logger.registerCategory('api', {
  level: 'debug',
});

apiLogger.debug('Debug info'); // Hidden in production
apiLogger.warn('Warning'); // Shown in production
```

### Category-Specific Override

```bash
# .env.development
LOG_LEVEL=info
LOG_LEVEL_DB=debug
LOG_LEVEL_PAYMENT=warn
```

```typescript
import { logger } from '@repo/logger';

// Respects LOG_LEVEL_DB=debug
const dbLogger = logger.registerCategory('db', {
  level: 'info', // Overridden by env var
});

// Respects LOG_LEVEL_PAYMENT=warn
const paymentLogger = logger.registerCategory('payment', {
  level: 'info', // Overridden by env var
});

dbLogger.debug('Query executed'); // Shown (debug enabled)
paymentLogger.debug('Payment details'); // Hidden (warn level)
```

### Save to File Override

```bash
# .env.production
SAVE_LOGS=true
SAVE_LOGS_AUTH=true
SAVE_LOGS_DEBUG=false
```

```typescript
import { logger } from '@repo/logger';

// Saved to file (SAVE_LOGS_AUTH=true)
const authLogger = logger.registerCategory('auth', {
  save: true,
});

// Not saved (SAVE_LOGS_DEBUG=false)
const debugLogger = logger.registerCategory('debug', {
  save: false,
});
```

### Runtime Configuration

```typescript
import { logger } from '@repo/logger';

/**
 * Get log level from environment or default
 */
const getLogLevel = (category: string): LogLevel => {
  const envVar = `LOG_LEVEL_${category.toUpperCase()}`;
  return (process.env[envVar] as LogLevel) || 'info';
};

/**
 * Create logger with environment-aware level
 */
const createCategoryLogger = (category: string, options: LoggerCategoryOptions) => {
  return logger.registerCategory(category, {
    ...options,
    level: getLogLevel(category),
  });
};

const apiLogger = createCategoryLogger('api', {
  color: LoggerColors.CYAN,
});

const dbLogger = createCategoryLogger('db', {
  color: LoggerColors.BLUE,
});
```

---

## Real-World Examples

Complete examples from different parts of the application.

### API Logger

```typescript
import { Hono } from 'hono';
import { logger, LoggerColors } from '@repo/logger';
import type { ServiceContext } from '@repo/service-core';

/**
 * API logger for HTTP requests
 */
const apiLogger = logger.registerCategory('api', {
  color: LoggerColors.CYAN,
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  save: true,
  expandObjectLevels: 2,
  truncateLongText: true,
  truncateLongTextAt: 500,
});

/**
 * Accommodation routes
 */
const app = new Hono();

app.get('/accommodations', async (c) => {
  const query = c.req.query();
  const requestId = c.get('requestId');

  apiLogger.info('GET /accommodations', {
    query,
    requestId,
    userAgent: c.req.header('user-agent'),
  });

  try {
    const startTime = Date.now();
    const accommodations = await service.search(query);
    const duration = Date.now() - startTime;

    apiLogger.info('Search completed', {
      requestId,
      count: accommodations.length,
      duration: `${duration}ms`,
      filters: query,
    });

    return c.json({
      success: true,
      data: accommodations,
      meta: { count: accommodations.length },
    });
  } catch (error) {
    apiLogger.error('Search failed', {
      error,
      query,
      requestId,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return c.json(
      {
        success: false,
        error: 'Failed to search accommodations',
      },
      500
    );
  }
});

app.post('/accommodations', async (c) => {
  const body = await c.req.json();
  const requestId = c.get('requestId');
  const userId = c.get('userId');

  apiLogger.info('POST /accommodations', {
    requestId,
    userId,
    title: body.title,
    city: body.city,
  });

  try {
    const accommodation = await service.create(body, { userId });

    apiLogger.info('Accommodation created', {
      requestId,
      accommodationId: accommodation.id,
      title: accommodation.title,
    });

    return c.json(
      {
        success: true,
        data: accommodation,
      },
      201
    );
  } catch (error) {
    apiLogger.error('Creation failed', {
      error,
      body,
      requestId,
      userId,
    });

    return c.json(
      {
        success: false,
        error: 'Failed to create accommodation',
      },
      500
    );
  }
});

export default app;
```

### Database Logger

```typescript
import { BaseModel } from '@repo/db';
import { logger, LoggerColors } from '@repo/logger';
import { accommodations } from '@repo/db/schemas';
import { eq, like, and } from 'drizzle-orm';

/**
 * Database logger for queries
 */
const dbLogger = logger.registerCategory('db', {
  color: LoggerColors.BLUE,
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  save: false, // Don't save debug logs in dev
  expandObjectLevels: 3,
});

/**
 * Accommodation model with query logging
 */
export class AccommodationModel extends BaseModel<Accommodation> {
  /**
   * Find by ID with logging
   */
  async findById(id: string): Promise<Accommodation | null> {
    dbLogger.debug('Query: findById', { id });

    const startTime = Date.now();

    const result = await this.db
      .select()
      .from(accommodations)
      .where(eq(accommodations.id, id))
      .limit(1);

    const duration = Date.now() - startTime;

    dbLogger.debug('Query completed', {
      query: 'findById',
      id,
      found: result.length > 0,
      duration: `${duration}ms`,
    });

    return result[0] || null;
  }

  /**
   * Search with complex filters
   */
  async search(filters: SearchFilters): Promise<Accommodation[]> {
    dbLogger.debug('Query: search', { filters });

    const conditions = [];

    if (filters.city) {
      conditions.push(eq(accommodations.city, filters.city));
    }

    if (filters.q) {
      conditions.push(like(accommodations.title, `%${filters.q}%`));
    }

    const startTime = Date.now();

    const results = await this.db
      .select()
      .from(accommodations)
      .where(and(...conditions))
      .limit(filters.limit || 20);

    const duration = Date.now() - startTime;

    dbLogger.info('Search completed', {
      filters,
      resultCount: results.length,
      duration: `${duration}ms`,
      conditions: conditions.length,
    });

    return results;
  }

  /**
   * Update with transaction logging
   */
  async update(id: string, data: UpdateData): Promise<Accommodation> {
    dbLogger.info('Starting update transaction', {
      id,
      fields: Object.keys(data),
    });

    try {
      const result = await this.db.transaction(async (tx) => {
        dbLogger.debug('Transaction: updating accommodation', { id });

        const updated = await tx
          .update(accommodations)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(accommodations.id, id))
          .returning();

        dbLogger.debug('Transaction: update complete', {
          id,
          success: updated.length > 0,
        });

        return updated[0];
      });

      dbLogger.info('Update transaction committed', {
        id,
        fields: Object.keys(data),
      });

      return result;
    } catch (error) {
      dbLogger.error('Update transaction failed', {
        error,
        id,
        data,
        stack: error instanceof Error ? error.stack : undefined,
      });

      throw error;
    }
  }
}
```

### Authentication Logger

```typescript
import { logger, LoggerColors } from '@repo/logger';
import { verifyToken, type User } from '@repo/auth-ui';

/**
 * Authentication logger
 */
const authLogger = logger.registerCategory('auth', {
  color: LoggerColors.GREEN,
  level: 'info',
  save: true, // Save auth events for audit
  expandObjectLevels: 1,
});

/**
 * JWT logger for token operations
 */
const jwtLogger = logger.registerCategory('auth:jwt', {
  color: LoggerColors.MAGENTA,
  level: 'warn',
  save: true,
});

/**
 * Authenticate user from request
 */
export async function authenticateUser(token: string): Promise<User | null> {
  authLogger.info('Authentication attempt', {
    tokenPrefix: token.substring(0, 10) + '...',
  });

  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.HOSPEDA_BETTER_AUTH_SECRET,
    });

    authLogger.info('Authentication successful', {
      userId: payload.sub,
      sessionId: payload.sid,
    });

    return payload as User;
  } catch (error) {
    authLogger.warn('Authentication failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      tokenPrefix: token.substring(0, 10) + '...',
    });

    return null;
  }
}

/**
 * Verify JWT token
 */
export async function verifyJWT(token: string): Promise<boolean> {
  jwtLogger.debug('Verifying JWT token');

  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.HOSPEDA_BETTER_AUTH_SECRET,
    });

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = payload.exp;

    if (expiresAt && expiresAt < now) {
      jwtLogger.warn('Token expired', {
        expiresAt: new Date(expiresAt * 1000).toISOString(),
        now: new Date(now * 1000).toISOString(),
      });

      return false;
    }

    // Warn if token expiring soon (within 5 minutes)
    if (expiresAt && expiresAt - now < 300) {
      jwtLogger.warn('Token expiring soon', {
        expiresAt: new Date(expiresAt * 1000).toISOString(),
        expiresIn: `${expiresAt - now}s`,
      });
    }

    return true;
  } catch (error) {
    jwtLogger.error('Token verification failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return false;
  }
}
```

### Payment Logger

```typescript
import { logger, LoggerColors } from '@repo/logger';
import { MercadoPagoConfig, Payment } from 'mercadopago';

/**
 * Payment logger for transaction tracking
 */
const paymentLogger = logger.registerCategory('payment', {
  color: LoggerColors.YELLOW,
  level: 'info',
  save: true, // Critical for audit trail
  expandObjectLevels: 2,
  truncateLongText: true,
  truncateLongTextAt: 300,
});

/**
 * Mercado Pago gateway logger
 */
const gatewayLogger = logger.registerCategory('payment:gateway', {
  color: LoggerColors.RED,
  level: 'warn',
  save: true,
});

/**
 * Process payment
 */
export async function processPayment(input: PaymentInput): Promise<PaymentResult> {
  const { amount, bookingId, userId } = input;

  paymentLogger.info('Processing payment', {
    bookingId,
    userId,
    amount,
    currency: 'ARS',
  });

  try {
    const client = new MercadoPagoConfig({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
    });

    const payment = new Payment(client);

    gatewayLogger.debug('Calling Mercado Pago API', {
      amount,
      bookingId,
    });

    const response = await payment.create({
      body: {
        transaction_amount: amount,
        description: `Booking #${bookingId}`,
        payment_method_id: 'pix',
        payer: {
          email: input.email,
        },
      },
    });

    paymentLogger.info('Payment processed', {
      paymentId: response.id,
      status: response.status,
      bookingId,
      userId,
      amount,
    });

    return {
      success: true,
      paymentId: response.id!,
      status: response.status!,
    };
  } catch (error) {
    gatewayLogger.error('Mercado Pago API error', {
      error,
      bookingId,
      amount,
      stack: error instanceof Error ? error.stack : undefined,
    });

    paymentLogger.error('Payment failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      bookingId,
      userId,
      amount,
    });

    throw error;
  }
}

/**
 * Refund payment
 */
export async function refundPayment(paymentId: string): Promise<RefundResult> {
  paymentLogger.info('Processing refund', { paymentId });

  try {
    const client = new MercadoPagoConfig({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
    });

    const payment = new Payment(client);

    gatewayLogger.debug('Calling Mercado Pago refund API', { paymentId });

    const response = await payment.refund({ id: paymentId });

    paymentLogger.info('Refund processed', {
      paymentId,
      refundId: response.id,
      status: response.status,
    });

    return {
      success: true,
      refundId: response.id!,
      status: response.status!,
    };
  } catch (error) {
    gatewayLogger.error('Mercado Pago refund error', {
      error,
      paymentId,
    });

    paymentLogger.error('Refund failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      paymentId,
    });

    throw error;
  }
}
```

---

## Best Practices

### 1. Use Descriptive Category Names

```typescript
// ❌ Bad: Generic names
const logger1 = logger.registerCategory('data');
const logger2 = logger.registerCategory('api');

// ✅ Good: Specific, hierarchical names
const accommodationModel = logger.registerCategory('model:accommodation');
const accommodationApi = logger.registerCategory('api:accommodations');
```

### 2. Choose Appropriate Colors

```typescript
// ✅ Color coding by purpose
const errorLogger = logger.registerCategory('error', {
  color: LoggerColors.RED,
});

const successLogger = logger.registerCategory('success', {
  color: LoggerColors.GREEN,
});

const infoLogger = logger.registerCategory('info', {
  color: LoggerColors.CYAN,
});

const warnLogger = logger.registerCategory('warn', {
  color: LoggerColors.YELLOW,
});
```

### 3. Set Appropriate Log Levels

```typescript
// ✅ Different levels for different environments
const developmentLogger = logger.registerCategory('dev', {
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
});

// ✅ More restrictive for sensitive operations
const paymentLogger = logger.registerCategory('payment', {
  level: 'warn', // Only warnings and errors
});

// ✅ Verbose for debugging
const debugLogger = logger.registerCategory('debug', {
  level: 'debug',
});
```

### 4. Save Important Logs

```typescript
// ✅ Save audit trail
const auditLogger = logger.registerCategory('audit', {
  save: true,
  level: 'info',
});

// ✅ Don't save debug noise
const debugLogger = logger.registerCategory('debug', {
  save: false,
  level: 'debug',
});
```

### 5. Control Object Expansion

```typescript
// ✅ Shallow for large objects
const largeObjectLogger = logger.registerCategory('large', {
  expandObjectLevels: 1,
  truncateLongText: true,
});

// ✅ Deep for critical debugging
const debugLogger = logger.registerCategory('debug', {
  expandObjectLevels: 3,
});
```

### 6. Create Reusable Logger Factories

```typescript
/**
 * Factory for creating domain loggers
 */
export const createDomainLogger = (domain: string) => ({
  service: logger.registerCategory(`${domain}:service`, {
    color: LoggerColors.GREEN,
    level: 'info',
  }),
  model: logger.registerCategory(`${domain}:model`, {
    color: LoggerColors.BLUE,
    level: 'debug',
  }),
  api: logger.registerCategory(`${domain}:api`, {
    color: LoggerColors.CYAN,
    level: 'info',
  }),
});

// Use factory
const accommodationLoggers = createDomainLogger('accommodation');
const bookingLoggers = createDomainLogger('booking');
```

---

## Advanced Patterns

### Dynamic Category Creation

```typescript
import { logger, LoggerColors } from '@repo/logger';

/**
 * Get or create category logger on demand
 */
const categoryCache = new Map<string, Logger>();

export function getCategoryLogger(category: string): Logger {
  if (!categoryCache.has(category)) {
    const categoryLogger = logger.registerCategory(category, {
      color: LoggerColors.CYAN,
      level: 'info',
    });
    categoryCache.set(category, categoryLogger);
  }

  return categoryCache.get(category)!;
}

// Usage
const userLogger = getCategoryLogger('user');
const adminLogger = getCategoryLogger('admin');
```

### Contextual Loggers

```typescript
import { logger } from '@repo/logger';

/**
 * Logger with request context
 */
export class ContextLogger {
  private logger: Logger;

  constructor(
    category: string,
    private context: { requestId: string; userId?: string }
  ) {
    this.logger = logger.registerCategory(category);
  }

  info(message: string, data?: unknown): void {
    this.logger.info(message, {
      ...data,
      ...this.context,
    });
  }

  error(message: string, error: unknown): void {
    this.logger.error(message, {
      error,
      ...this.context,
    });
  }
}

// Usage
const contextLogger = new ContextLogger('api', {
  requestId: 'req-123',
  userId: 'user-456',
});

contextLogger.info('Processing request'); // Includes requestId and userId
```

### Performance Monitoring

```typescript
import { logger, LoggerColors } from '@repo/logger';

/**
 * Performance logger with timing utilities
 */
const perfLogger = logger.registerCategory('perf', {
  color: LoggerColors.YELLOW,
  level: 'debug',
});

export class PerformanceMonitor {
  private timers = new Map<string, number>();

  start(label: string): void {
    this.timers.set(label, Date.now());
    perfLogger.debug(`Started: ${label}`);
  }

  end(label: string, metadata?: unknown): void {
    const startTime = this.timers.get(label);
    if (!startTime) {
      perfLogger.warn(`No timer found for: ${label}`);
      return;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(label);

    perfLogger.info(`Completed: ${label}`, {
      duration: `${duration}ms`,
      ...metadata,
    });
  }
}

// Usage
const monitor = new PerformanceMonitor();
monitor.start('search');
const results = await service.search(filters);
monitor.end('search', { resultCount: results.length });
```

---

## Related Documentation

- [Quick Start](../quick-start.md) - Get started with logger
- [API Reference](../api/logger.md) - Full API documentation
- [Formatting Guide](./formatting.md) - Log formatting options
- [Configuration](../configuration.md) - Environment configuration

---

**Last updated:** 2024-01-15
