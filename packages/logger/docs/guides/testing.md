# Testing with Logger Guide

Complete guide to testing code that uses the logger, including mocking, assertions, and best practices.

## Table of Contents

- [Overview](#overview)
- [Mocking Logger](#mocking-logger)
- [Testing with Different Log Levels](#testing-with-different-log-levels)
- [Capturing Log Output](#capturing-log-output)
- [Asserting Log Calls](#asserting-log-calls)
- [Testing Custom Logger Methods](#testing-custom-logger-methods)
- [Vitest Integration](#vitest-integration)
- [Testing Category Behavior](#testing-category-behavior)
- [Testing Configuration](#testing-configuration)
- [Testing Error Logging](#testing-error-logging)
- [Mock Strategies](#mock-strategies)
- [Best Practices](#best-practices)

---

## Overview

Testing code that uses logging requires proper mocking and assertion strategies to ensure logs are called correctly without polluting test output.

**Testing Goals:**

- Verify logs are called with correct data
- Test conditional logging logic
- Ensure sensitive data is not logged
- Validate log levels are appropriate
- Test error handling and logging
- Mock logger to prevent console spam

---

## Mocking Logger

Different approaches to mocking the logger in tests.

### Basic Mock

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from '@repo/logger';

describe('UserService', () => {
  beforeEach(() => {
    // Mock all logger methods
    vi.spyOn(logger, 'info').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    vi.spyOn(logger, 'debug').mockImplementation(() => {});
  });

  it('should log user creation', async () => {
    const service = new UserService();

    await service.createUser({
      email: 'juan@example.com',
      name: 'Juan Pérez',
    });

    expect(logger.info).toHaveBeenCalledWith('User created', {
      email: 'juan@example.com',
      name: 'Juan Pérez',
    });
  });
});
```

### Mock with Return Values

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from '@repo/logger';

describe('Service', () => {
  beforeEach(() => {
    // Mock with return value for chaining
    vi.spyOn(logger, 'info').mockReturnValue(undefined);
    vi.spyOn(logger, 'error').mockReturnValue(undefined);
  });

  it('should handle logging', () => {
    logger.info('Test message');
    expect(logger.info).toHaveBeenCalled();
  });
});
```

### Restore Original After Each Test

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '@repo/logger';

describe('Service', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original implementation
    vi.restoreAllMocks();
  });

  it('should log correctly', () => {
    logger.info('Test');
    expect(logger.info).toHaveBeenCalled();
  });
});
```

---

## Testing with Different Log Levels

Test behavior at different log levels.

### Testing Level Filtering

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from '@repo/logger';

describe('Logger level filtering', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'debug').mockImplementation(() => {});
    vi.spyOn(logger, 'info').mockImplementation(() => {});
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  it('should filter debug logs at info level', () => {
    logger.configure({ level: 'info' });

    logger.debug('Debug message');
    logger.info('Info message');

    expect(logger.debug).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalled();
  });

  it('should show all logs at debug level', () => {
    logger.configure({ level: 'debug' });

    logger.debug('Debug message');
    logger.info('Info message');

    expect(logger.debug).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalled();
  });

  it('should only show errors at error level', () => {
    logger.configure({ level: 'error' });

    logger.debug('Debug message');
    logger.info('Info message');
    logger.warn('Warning message');
    logger.error('Error message');

    expect(logger.debug).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });
});
```

### Testing Environment-Based Levels

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from '@repo/logger';

describe('Environment-based logging', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.spyOn(logger, 'debug').mockImplementation(() => {});
    vi.spyOn(logger, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('should use debug level in development', () => {
    process.env.NODE_ENV = 'development';

    logger.configure({
      level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
    });

    logger.debug('Debug message');
    expect(logger.debug).toHaveBeenCalled();
  });

  it('should use warn level in production', () => {
    process.env.NODE_ENV = 'production';

    logger.configure({
      level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
    });

    logger.debug('Debug message');
    logger.info('Info message');

    expect(logger.debug).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });
});
```

---

## Capturing Log Output

Capture and inspect log output in tests.

### Capture with Mock Implementation

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from '@repo/logger';

describe('Log capture', () => {
  const logCalls: Array<{ level: string; message: string; data?: unknown }> = [];

  beforeEach(() => {
    logCalls.length = 0;

    vi.spyOn(logger, 'info').mockImplementation((message, data) => {
      logCalls.push({ level: 'info', message, data });
    });

    vi.spyOn(logger, 'error').mockImplementation((message, data) => {
      logCalls.push({ level: 'error', message, data });
    });
  });

  it('should capture all log calls', async () => {
    const service = new UserService();

    await service.createUser({ email: 'juan@example.com' });

    expect(logCalls).toHaveLength(2);
    expect(logCalls[0]).toEqual({
      level: 'info',
      message: 'Creating user',
      data: { email: 'juan@example.com' },
    });
    expect(logCalls[1]).toEqual({
      level: 'info',
      message: 'User created',
      data: { id: expect.any(String) },
    });
  });
});
```

### Capture Console Output

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Console capture', () => {
  let consoleOutput: string[] = [];
  let originalConsoleLog: typeof console.log;

  beforeEach(() => {
    consoleOutput = [];
    originalConsoleLog = console.log;

    console.log = vi.fn((...args) => {
      consoleOutput.push(args.join(' '));
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  it('should capture console output', () => {
    logger.info('Test message', { data: 'value' });

    expect(consoleOutput).toContain(expect.stringContaining('Test message'));
    expect(consoleOutput).toContain(expect.stringContaining('data: value'));
  });
});
```

---

## Asserting Log Calls

Verify logger is called with correct arguments.

### Basic Assertions

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from '@repo/logger';

describe('Log assertions', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'info').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});
  });

  it('should log with message only', () => {
    logger.info('Simple message');

    expect(logger.info).toHaveBeenCalledWith('Simple message', undefined);
  });

  it('should log with message and data', () => {
    logger.info('User created', { userId: 'user-123' });

    expect(logger.info).toHaveBeenCalledWith('User created', {
      userId: 'user-123',
    });
  });

  it('should log error with error object', () => {
    const error = new Error('Test error');

    logger.error('Operation failed', { error });

    expect(logger.error).toHaveBeenCalledWith('Operation failed', {
      error: expect.objectContaining({
        message: 'Test error',
      }),
    });
  });
});
```

### Partial Matching

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from '@repo/logger';

describe('Partial log assertions', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'info').mockImplementation(() => {});
  });

  it('should match partial data', () => {
    logger.info('User action', {
      userId: 'user-123',
      action: 'login',
      timestamp: new Date().toISOString(),
      metadata: { /* complex object */ },
    });

    expect(logger.info).toHaveBeenCalledWith(
      'User action',
      expect.objectContaining({
        userId: 'user-123',
        action: 'login',
      })
    );
  });

  it('should match any string', () => {
    logger.info('Request completed', {
      requestId: 'req-abc123',
      duration: 234,
    });

    expect(logger.info).toHaveBeenCalledWith(
      'Request completed',
      expect.objectContaining({
        requestId: expect.any(String),
        duration: expect.any(Number),
      })
    );
  });
});
```

### Call Count Assertions

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from '@repo/logger';

describe('Call count assertions', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'info').mockImplementation(() => {});
    vi.spyOn(logger, 'debug').mockImplementation(() => {});
  });

  it('should call logger once', () => {
    logger.info('Test');

    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it('should call logger multiple times', () => {
    logger.info('First');
    logger.info('Second');
    logger.info('Third');

    expect(logger.info).toHaveBeenCalledTimes(3);
  });

  it('should not call debug logger', () => {
    logger.info('Test');

    expect(logger.debug).not.toHaveBeenCalled();
  });
});
```

### Call Order Assertions

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from '@repo/logger';

describe('Call order assertions', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'info').mockImplementation(() => {});
  });

  it('should log in correct order', () => {
    logger.info('First');
    logger.info('Second');
    logger.info('Third');

    expect(logger.info).toHaveBeenNthCalledWith(1, 'First', undefined);
    expect(logger.info).toHaveBeenNthCalledWith(2, 'Second', undefined);
    expect(logger.info).toHaveBeenNthCalledWith(3, 'Third', undefined);
  });

  it('should log request flow in order', async () => {
    const service = new BookingService();

    await service.createBooking({
      accommodationId: 'acc-123',
      userId: 'user-456',
    });

    expect(logger.info).toHaveBeenNthCalledWith(
      1,
      'Creating booking',
      expect.any(Object)
    );
    expect(logger.info).toHaveBeenNthCalledWith(
      2,
      'Booking created',
      expect.any(Object)
    );
  });
});
```

---

## Testing Custom Logger Methods

Test custom logging functionality.

### Testing Scoped Loggers

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from '@repo/logger';

describe('Scoped logger', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'registerCategory').mockReturnValue({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    } as any);
  });

  it('should create scoped logger', () => {
    const apiLogger = logger.registerCategory('api');

    expect(logger.registerCategory).toHaveBeenCalledWith('api');
    expect(apiLogger).toBeDefined();
  });

  it('should log with category', () => {
    const apiLogger = logger.registerCategory('api', {
      color: 'cyan',
    });

    apiLogger.info('Test message');

    expect(apiLogger.info).toHaveBeenCalledWith('Test message', undefined);
  });
});
```

### Testing Custom Log Methods

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from '@repo/logger';

/**
 * Custom logger with helper methods
 */
class CustomLogger {
  logRequest(method: string, path: string, data: Record<string, unknown>): void {
    logger.info(`${method} ${path}`, data);
  }

  logError(error: Error, context: Record<string, unknown>): void {
    logger.error(error.message, {
      error: {
        message: error.message,
        stack: error.stack,
      },
      ...context,
    });
  }
}

describe('CustomLogger', () => {
  let customLogger: CustomLogger;

  beforeEach(() => {
    customLogger = new CustomLogger();
    vi.spyOn(logger, 'info').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});
  });

  it('should log request', () => {
    customLogger.logRequest('POST', '/bookings', {
      userId: 'user-123',
    });

    expect(logger.info).toHaveBeenCalledWith('POST /bookings', {
      userId: 'user-123',
    });
  });

  it('should log error with context', () => {
    const error = new Error('Test error');

    customLogger.logError(error, {
      userId: 'user-123',
      operation: 'createBooking',
    });

    expect(logger.error).toHaveBeenCalledWith(
      'Test error',
      expect.objectContaining({
        error: expect.objectContaining({
          message: 'Test error',
          stack: expect.any(String),
        }),
        userId: 'user-123',
        operation: 'createBooking',
      })
    );
  });
});
```

---

## Vitest Integration

Complete Vitest setup for testing with logger.

### Test Setup File

```typescript
// vitest.setup.ts
import { beforeEach, vi } from 'vitest';
import { logger } from '@repo/logger';

/**
 * Global test setup
 */
beforeEach(() => {
  // Mock all logger methods globally
  vi.spyOn(logger, 'debug').mockImplementation(() => {});
  vi.spyOn(logger, 'info').mockImplementation(() => {});
  vi.spyOn(logger, 'warn').mockImplementation(() => {});
  vi.spyOn(logger, 'error').mockImplementation(() => {});
});

afterEach(() => {
  // Restore all mocks after each test
  vi.restoreAllMocks();
});
```

### Vitest Config

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/*.test.ts'],
    },
  },
});
```

### Complete Test Example

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from '@repo/logger';
import { AccommodationService } from './accommodation.service';

describe('AccommodationService', () => {
  let service: AccommodationService;

  beforeEach(() => {
    service = new AccommodationService();
    vi.spyOn(logger, 'info').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});
  });

  describe('create', () => {
    it('should log creation', async () => {
      const input = {
        title: 'Beach House',
        city: 'Concepción',
        pricePerNight: 150,
      };

      await service.create(input);

      expect(logger.info).toHaveBeenCalledWith('Creating accommodation', {
        title: input.title,
        city: input.city,
      });
    });

    it('should log success', async () => {
      const input = {
        title: 'Beach House',
        city: 'Concepción',
        pricePerNight: 150,
      };

      const result = await service.create(input);

      expect(logger.info).toHaveBeenCalledWith('Accommodation created', {
        id: result.id,
        title: result.title,
      });
    });

    it('should log error on failure', async () => {
      const input = {
        title: 'Beach House',
        city: 'Concepción',
        pricePerNight: 150,
      };

      // Mock service to throw error
      vi.spyOn(service as any, 'model').mockRejectedValue(
        new Error('Database error')
      );

      await expect(service.create(input)).rejects.toThrow('Database error');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to create accommodation',
        expect.objectContaining({
          error: expect.any(Error),
          input,
        })
      );
    });
  });
});
```

---

## Testing Category Behavior

Test category-specific logging behavior.

### Testing Category Configuration

```typescript
import { describe, it, expect, vi } from 'vitest';
import { logger, LoggerColors } from '@repo/logger';

describe('Logger categories', () => {
  it('should create category with config', () => {
    const apiLogger = logger.registerCategory('api', {
      color: LoggerColors.CYAN,
      level: 'info',
    });

    expect(apiLogger).toBeDefined();
  });

  it('should use category-specific level', () => {
    const debugLogger = logger.registerCategory('debug', {
      level: 'debug',
    });

    const warnLogger = logger.registerCategory('warn', {
      level: 'warn',
    });

    vi.spyOn(debugLogger, 'debug').mockImplementation(() => {});
    vi.spyOn(warnLogger, 'debug').mockImplementation(() => {});

    debugLogger.debug('Debug message');
    warnLogger.debug('Debug message');

    expect(debugLogger.debug).toHaveBeenCalled();
    expect(warnLogger.debug).not.toHaveBeenCalled();
  });
});
```

### Testing Category Isolation

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from '@repo/logger';

describe('Category isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not affect other categories', () => {
    const apiLogger = logger.registerCategory('api');
    const dbLogger = logger.registerCategory('db');

    vi.spyOn(apiLogger, 'info').mockImplementation(() => {});
    vi.spyOn(dbLogger, 'info').mockImplementation(() => {});

    apiLogger.info('API message');

    expect(apiLogger.info).toHaveBeenCalledWith('API message', undefined);
    expect(dbLogger.info).not.toHaveBeenCalled();
  });
});
```

---

## Testing Configuration

Test logger configuration changes.

### Testing Configuration Updates

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { logger } from '@repo/logger';

describe('Logger configuration', () => {
  const originalConfig = { ...logger.config };

  beforeEach(() => {
    logger.configure(originalConfig);
  });

  it('should update log level', () => {
    logger.configure({ level: 'error' });
    expect(logger.level).toBe('error');
  });

  it('should update timestamp setting', () => {
    logger.configure({ INCLUDE_TIMESTAMPS: false });
    expect(logger.config.INCLUDE_TIMESTAMPS).toBe(false);
  });

  it('should update multiple settings', () => {
    logger.configure({
      level: 'warn',
      INCLUDE_TIMESTAMPS: true,
      INCLUDE_LEVEL: false,
    });

    expect(logger.level).toBe('warn');
    expect(logger.config.INCLUDE_TIMESTAMPS).toBe(true);
    expect(logger.config.INCLUDE_LEVEL).toBe(false);
  });
});
```

---

## Testing Error Logging

Test error logging scenarios.

### Testing Error Objects

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from '@repo/logger';

describe('Error logging', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'error').mockImplementation(() => {});
  });

  it('should log Error instance', () => {
    const error = new Error('Test error');

    logger.error('Operation failed', { error });

    expect(logger.error).toHaveBeenCalledWith('Operation failed', {
      error: expect.objectContaining({
        message: 'Test error',
      }),
    });
  });

  it('should log error stack', () => {
    const error = new Error('Test error');

    logger.error('Operation failed', {
      error: {
        message: error.message,
        stack: error.stack,
      },
    });

    expect(logger.error).toHaveBeenCalledWith(
      'Operation failed',
      expect.objectContaining({
        error: expect.objectContaining({
          message: 'Test error',
          stack: expect.any(String),
        }),
      })
    );
  });

  it('should log custom error properties', () => {
    class CustomError extends Error {
      constructor(
        message: string,
        public code: string,
        public statusCode: number
      ) {
        super(message);
      }
    }

    const error = new CustomError('Not found', 'NOT_FOUND', 404);

    logger.error('Request failed', {
      error: {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
      },
    });

    expect(logger.error).toHaveBeenCalledWith(
      'Request failed',
      expect.objectContaining({
        error: expect.objectContaining({
          message: 'Not found',
          code: 'NOT_FOUND',
          statusCode: 404,
        }),
      })
    );
  });
});
```

---

## Mock Strategies

Different strategies for mocking logger.

### Full Mock

```typescript
import { vi } from 'vitest';

/**
 * Full mock replaces all methods
 */
const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  registerCategory: vi.fn(),
  configure: vi.fn(),
};

vi.mock('@repo/logger', () => ({
  logger: mockLogger,
}));
```

### Spy Mock (Recommended)

```typescript
import { vi } from 'vitest';
import { logger } from '@repo/logger';

/**
 * Spy mock wraps existing methods
 */
vi.spyOn(logger, 'info').mockImplementation(() => {});
vi.spyOn(logger, 'error').mockImplementation(() => {});

// Restore originals when needed
vi.restoreAllMocks();
```

### Partial Mock

```typescript
import { vi } from 'vitest';

/**
 * Partial mock only mocks specific methods
 */
vi.mock('@repo/logger', async () => {
  const actual = await vi.importActual<typeof import('@repo/logger')>('@repo/logger');

  return {
    ...actual,
    logger: {
      ...actual.logger,
      info: vi.fn(),
      error: vi.fn(),
    },
  };
});
```

---

## Best Practices

### 1. Always Mock in Tests

```typescript
// ✅ Mock to prevent console spam
beforeEach(() => {
  vi.spyOn(logger, 'info').mockImplementation(() => {});
});

// ❌ Don't let logs pollute test output
it('should work', () => {
  logger.info('Test'); // Logs to console!
});
```

### 2. Use Partial Matching

```typescript
// ✅ Match important fields only
expect(logger.info).toHaveBeenCalledWith(
  'User created',
  expect.objectContaining({
    userId: 'user-123',
  })
);

// ❌ Avoid exact matching with timestamps
expect(logger.info).toHaveBeenCalledWith('User created', {
  userId: 'user-123',
  timestamp: '2024-01-15T10:30:00.000Z', // Will fail due to time
});
```

### 3. Test Log Behavior, Not Implementation

```typescript
// ✅ Test what is logged
it('should log user creation', () => {
  service.createUser({ email: 'test@example.com' });

  expect(logger.info).toHaveBeenCalledWith(
    expect.stringContaining('User created'),
    expect.objectContaining({ email: 'test@example.com' })
  );
});

// ❌ Don't test internal logger details
it('should call console.log', () => {
  expect(console.log).toHaveBeenCalled(); // Too low-level
});
```

### 4. Clean Up After Tests

```typescript
// ✅ Restore mocks
afterEach(() => {
  vi.restoreAllMocks();
});

// ✅ Reset configuration
afterEach(() => {
  logger.configure(originalConfig);
});
```

### 5. Test Sensitive Data Filtering

```typescript
it('should not log passwords', () => {
  service.login({ email: 'test@example.com', password: 'secret' });

  expect(logger.info).toHaveBeenCalledWith(
    expect.any(String),
    expect.not.objectContaining({ password: expect.any(String) })
  );
});
```

---

## Related Documentation

- [API Reference](../api/logger.md) - Logger API documentation
- [Scoped Loggers](./scoped-loggers.md) - Category-based logging
- [Best Practices](../best-practices.md) - General best practices

---

**Last updated:** 2024-01-15
