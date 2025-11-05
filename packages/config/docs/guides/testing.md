# Testing Configuration Guide

Comprehensive guide to testing configuration with mocked environment variables in the Hospeda project.

## Table of Contents

- [Mock Strategies](#mock-strategies)
- [Vitest Setup](#vitest-setup)
- [Testing Patterns](#testing-patterns)
- [Integration Testing](#integration-testing)
- [Test Examples](#test-examples)

---

## Mock Strategies

### process.env Mocking with Vitest

**Basic Mocking:**

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Configuration Tests', () => {
  beforeEach(() => {
    // Mock environment variables before each test
    vi.stubEnv('API_PORT', '3000');
    vi.stubEnv('API_HOST', 'http://localhost');
  });

  afterEach(() => {
    // Clean up after each test
    vi.unstubAllEnvs();
  });

  it('should use mocked environment variables', () => {
    expect(process.env.API_PORT).toBe('3000');
    expect(process.env.API_HOST).toBe('http://localhost');
  });
});
```

**Mocking Multiple Variables:**

```typescript
beforeEach(() => {
  vi.stubEnv('API_PORT', '3000');
  vi.stubEnv('API_HOST', 'http://localhost');
  vi.stubEnv('DATABASE_URL', 'postgresql://localhost/test');
  vi.stubEnv('LOG_LEVEL', 'debug');
  vi.stubEnv('ENABLE_DEBUG', 'true');
});
```

**Selective Mocking:**

```typescript
describe('Database Configuration', () => {
  it('should handle missing optional variables', () => {
    // Only mock required variables
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost/test');
    // DATABASE_POOL_SIZE not mocked - should use default

    const config = parseDatabaseSchema(process.env);

    expect(config.DATABASE_URL).toBe('postgresql://localhost/test');
    expect(config.DATABASE_POOL_SIZE).toBe(10); // Default value
  });
});
```

### Schema Mocking

**Mock Entire Schema:**

```typescript
import { vi } from 'vitest';
import type { z } from 'zod';
import type { ApiSchema } from '@repo/config';

type ApiConfig = z.infer<typeof ApiSchema>;

const mockApiConfig: ApiConfig = {
  API_PORT: 3000,
  API_HOST: 'http://localhost',
};

// Mock the config module
vi.mock('@repo/config', () => ({
  apiConfig: mockApiConfig,
}));
```

**Partial Mock:**

```typescript
import { apiConfig } from '@repo/config';

const mockConfig = {
  ...apiConfig,
  API_PORT: 9999, // Override specific value
};
```

### Client Mocking

**Mock Configuration Client:**

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('Service with Config', () => {
  it('should use mocked configuration', async () => {
    // Mock the config module
    vi.mock('@repo/config', () => ({
      apiConfig: {
        API_PORT: 3000,
        API_HOST: 'http://localhost',
      },
    }));

    // Import after mock
    const { createServer } = await import('./server.js');

    const server = createServer();
    expect(server.port).toBe(3000);
  });
});
```

---

## Vitest Setup

### Global Test Setup

**vitest.config.ts:**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/node_modules/**', '**/test/**'],
    },
  },
});
```

**test/setup.ts:**

```typescript
import { beforeEach, afterEach, vi } from 'vitest';

// Set default environment to test
process.env.NODE_ENV = 'test';

// Mock common environment variables
beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('API_PORT', '3000');
  vi.stubEnv('DATABASE_URL', 'postgresql://localhost/test');
  vi.stubEnv('LOG_LEVEL', 'warn');
});

afterEach(() => {
  vi.unstubAllEnvs();
});
```

### Test-Specific Setup

**Per-Suite Setup:**

```typescript
import { describe, it, beforeEach, afterEach, vi } from 'vitest';

describe('API Configuration', () => {
  beforeEach(() => {
    vi.stubEnv('API_PORT', '3000');
    vi.stubEnv('API_HOST', 'http://localhost');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // Tests...
});

describe('Database Configuration', () => {
  beforeEach(() => {
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost/test');
    vi.stubEnv('DATABASE_SSL', 'false');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // Tests...
});
```

**Per-Test Setup:**

```typescript
describe('API Configuration', () => {
  it('should handle development environment', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('API_PORT', '3000');

    const config = parseApiSchema(process.env);
    expect(config.API_PORT).toBe(3000);

    vi.unstubAllEnvs();
  });

  it('should handle production environment', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('API_PORT', '8080');

    const config = parseApiSchema(process.env);
    expect(config.API_PORT).toBe(8080);

    vi.unstubAllEnvs();
  });
});
```

---

## Testing Patterns

### Valid Configuration Tests

**Test Valid Input:**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { parseApiSchema } from '../sections/api.schema.js';

describe('parseApiSchema - Valid Configuration', () => {
  it('should parse valid configuration', () => {
    vi.stubEnv('API_PORT', '3000');
    vi.stubEnv('API_HOST', 'http://localhost');

    const config = parseApiSchema(process.env);

    expect(config.API_PORT).toBe(3000);
    expect(config.API_HOST).toBe('http://localhost');
  });

  it('should parse minimal configuration with defaults', () => {
    vi.stubEnv('API_PORT', '3000');
    // API_HOST not set - should use default

    const config = parseApiSchema(process.env);

    expect(config.API_PORT).toBe(3000);
    expect(config.API_HOST).toBe('0.0.0.0'); // Default
  });

  it('should coerce string to number', () => {
    vi.stubEnv('API_PORT', '8080');

    const config = parseApiSchema(process.env);

    expect(config.API_PORT).toBe(8080);
    expect(typeof config.API_PORT).toBe('number');
  });
});
```

### Invalid Configuration Tests

**Test Validation Failures:**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { ZodError } from 'zod';
import { parseApiSchema } from '../sections/api.schema.js';

describe('parseApiSchema - Invalid Configuration', () => {
  it('should fail on missing required field', () => {
    // Missing API_PORT
    vi.stubEnv('API_HOST', 'http://localhost');

    expect(() => parseApiSchema(process.env)).toThrow(ZodError);
  });

  it('should fail on invalid port', () => {
    vi.stubEnv('API_PORT', '99999'); // Too high

    expect(() => parseApiSchema(process.env)).toThrow(ZodError);
    expect(() => parseApiSchema(process.env)).toThrow(/Port must be at most 65535/);
  });

  it('should fail on invalid URL', () => {
    vi.stubEnv('API_PORT', '3000');
    vi.stubEnv('API_HOST', 'not-a-url');

    expect(() => parseApiSchema(process.env)).toThrow(ZodError);
  });

  it('should fail on invalid type', () => {
    vi.stubEnv('API_PORT', 'abc'); // Not a number

    expect(() => parseApiSchema(process.env)).toThrow(ZodError);
  });
});
```

### Validation Error Tests

**Test Error Messages:**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { ZodError } from 'zod';
import { parseApiSchema } from '../sections/api.schema.js';

describe('parseApiSchema - Error Messages', () => {
  it('should provide helpful error message for missing field', () => {
    try {
      parseApiSchema(process.env);
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError);
      const zodError = error as ZodError;
      expect(zodError.issues[0].path).toContain('API_PORT');
      expect(zodError.issues[0].message).toContain('Required');
    }
  });

  it('should provide helpful error message for invalid value', () => {
    vi.stubEnv('API_PORT', 'abc');

    try {
      parseApiSchema(process.env);
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError);
      const zodError = error as ZodError;
      expect(zodError.issues[0].message).toContain('Expected number');
    }
  });
});
```

### Default Value Tests

**Test Default Values:**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { parseApiSchema } from '../sections/api.schema.js';

describe('parseApiSchema - Default Values', () => {
  it('should use default for API_HOST when not provided', () => {
    vi.stubEnv('API_PORT', '3000');

    const config = parseApiSchema(process.env);

    expect(config.API_HOST).toBe('0.0.0.0');
  });

  it('should override default when value provided', () => {
    vi.stubEnv('API_PORT', '3000');
    vi.stubEnv('API_HOST', 'http://example.com');

    const config = parseApiSchema(process.env);

    expect(config.API_HOST).toBe('http://example.com');
  });
});
```

### Transformation Tests

**Test Value Transformations:**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { parseDatabaseSchema } from '../sections/database.schema.js';

describe('parseDatabaseSchema - Transformations', () => {
  it('should transform comma-separated origins to array', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost/db');
    vi.stubEnv('ALLOWED_ORIGINS', 'http://localhost, https://example.com');

    const config = parseDatabaseSchema(process.env);

    expect(config.ALLOWED_ORIGINS).toEqual([
      'http://localhost',
      'https://example.com',
    ]);
  });

  it('should trim whitespace in array elements', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost/db');
    vi.stubEnv('ALLOWED_ORIGINS', '  http://localhost  ,  https://example.com  ');

    const config = parseDatabaseSchema(process.env);

    expect(config.ALLOWED_ORIGINS).toEqual([
      'http://localhost',
      'https://example.com',
    ]);
  });
});
```

---

## Integration Testing

### Startup Validators

**Test Startup Validation:**

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('Application Startup', () => {
  it('should start successfully with valid configuration', async () => {
    vi.stubEnv('API_PORT', '3000');
    vi.stubEnv('API_HOST', 'http://localhost');
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost/test');

    // Import after mocking
    const { startServer } = await import('./server.js');

    expect(() => startServer()).not.toThrow();
  });

  it('should fail to start with invalid configuration', async () => {
    vi.stubEnv('API_PORT', 'invalid'); // Invalid port

    // Import after mocking
    const { startServer } = await import('./server.js');

    expect(() => startServer()).toThrow();
  });
});
```

### Configuration in Services

**Test Services Using Config:**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccommodationService } from './accommodation.service.js';

describe('AccommodationService', () => {
  beforeEach(() => {
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost/test');
    vi.stubEnv('DATABASE_POOL_SIZE', '10');
  });

  it('should use database configuration', () => {
    const service = new AccommodationService();

    expect(service.poolSize).toBe(10);
  });
});
```

### Environment Switching

**Test Different Environments:**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { getEnvironment } from './environment.js';

describe('Environment Detection', () => {
  it('should detect development environment', () => {
    vi.stubEnv('NODE_ENV', 'development');

    const env = getEnvironment();

    expect(env).toBe('development');
  });

  it('should detect production environment', () => {
    vi.stubEnv('NODE_ENV', 'production');

    const env = getEnvironment();

    expect(env).toBe('production');
  });

  it('should default to development', () => {
    vi.unstubAllEnvs(); // No NODE_ENV set

    const env = getEnvironment();

    expect(env).toBe('development');
  });
});
```

---

## Test Examples

### Testing API Config

**Complete API Configuration Tests:**

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseApiSchema, ApiSchema } from '../sections/api.schema.js';
import { ZodError } from 'zod';

describe('API Configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('Valid Configuration', () => {
    it('should parse complete configuration', () => {
      vi.stubEnv('API_PORT', '3000');
      vi.stubEnv('API_HOST', 'http://localhost');

      const config = parseApiSchema(process.env);

      expect(config).toMatchObject({
        API_PORT: 3000,
        API_HOST: 'http://localhost',
      });
    });

    it('should use defaults for optional fields', () => {
      vi.stubEnv('API_PORT', '3000');

      const config = parseApiSchema(process.env);

      expect(config.API_HOST).toBe('0.0.0.0');
    });

    it('should coerce port from string to number', () => {
      vi.stubEnv('API_PORT', '8080');

      const config = parseApiSchema(process.env);

      expect(config.API_PORT).toBe(8080);
      expect(typeof config.API_PORT).toBe('number');
    });
  });

  describe('Invalid Configuration', () => {
    it('should fail on missing API_PORT', () => {
      vi.stubEnv('API_HOST', 'http://localhost');

      expect(() => parseApiSchema(process.env)).toThrow(ZodError);
    });

    it('should fail on invalid port (too high)', () => {
      vi.stubEnv('API_PORT', '99999');

      expect(() => parseApiSchema(process.env)).toThrow(/Port must be at most 65535/);
    });

    it('should fail on invalid port (too low)', () => {
      vi.stubEnv('API_PORT', '0');

      expect(() => parseApiSchema(process.env)).toThrow(/Port must be at least 1/);
    });

    it('should fail on non-numeric port', () => {
      vi.stubEnv('API_PORT', 'abc');

      expect(() => parseApiSchema(process.env)).toThrow(ZodError);
    });
  });

  describe('Schema Validation', () => {
    it('should validate against schema directly', () => {
      const validConfig = {
        API_PORT: 3000,
        API_HOST: 'http://localhost',
      };

      const result = ApiSchema.safeParse(validConfig);

      expect(result.success).toBe(true);
    });

    it('should reject invalid schema', () => {
      const invalidConfig = {
        API_PORT: 'not-a-number',
      };

      const result = ApiSchema.safeParse(invalidConfig);

      expect(result.success).toBe(false);
    });
  });
});
```

### Testing DB Config

**Complete Database Configuration Tests:**

```typescript
import { describe, it, expect, afterEach, vi } from 'vitest';
import { parseDatabaseSchema } from '../sections/database.schema.js';
import { ZodError } from 'zod';

describe('Database Configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('Valid Configuration', () => {
    it('should parse PostgreSQL URL', () => {
      vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@localhost:5432/db');

      const config = parseDatabaseSchema(process.env);

      expect(config.DATABASE_URL).toBe('postgresql://user:pass@localhost:5432/db');
    });

    it('should use default pool size', () => {
      vi.stubEnv('DATABASE_URL', 'postgresql://localhost/db');

      const config = parseDatabaseSchema(process.env);

      expect(config.DATABASE_POOL_SIZE).toBe(10); // Default
    });

    it('should override default pool size', () => {
      vi.stubEnv('DATABASE_URL', 'postgresql://localhost/db');
      vi.stubEnv('DATABASE_POOL_SIZE', '20');

      const config = parseDatabaseSchema(process.env);

      expect(config.DATABASE_POOL_SIZE).toBe(20);
    });

    it('should coerce SSL to boolean', () => {
      vi.stubEnv('DATABASE_URL', 'postgresql://localhost/db');
      vi.stubEnv('DATABASE_SSL', 'true');

      const config = parseDatabaseSchema(process.env);

      expect(config.DATABASE_SSL).toBe(true);
      expect(typeof config.DATABASE_SSL).toBe('boolean');
    });
  });

  describe('Invalid Configuration', () => {
    it('should fail on missing DATABASE_URL', () => {
      expect(() => parseDatabaseSchema(process.env)).toThrow(ZodError);
    });

    it('should fail on invalid URL', () => {
      vi.stubEnv('DATABASE_URL', 'not-a-url');

      expect(() => parseDatabaseSchema(process.env)).toThrow(ZodError);
    });

    it('should fail on wrong protocol', () => {
      vi.stubEnv('DATABASE_URL', 'http://localhost/db');

      expect(() => parseDatabaseSchema(process.env)).toThrow(/must start with "postgresql:\/\/"/);
    });
  });
});
```

### Testing Validation Errors

**Complete Error Handling Tests:**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { parseApiSchema } from '../sections/api.schema.js';
import { ZodError } from 'zod';

describe('Configuration Validation Errors', () => {
  it('should provide detailed error information', () => {
    vi.stubEnv('API_PORT', 'invalid');

    try {
      parseApiSchema(process.env);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError);

      const zodError = error as ZodError;
      expect(zodError.issues).toHaveLength(1);
      expect(zodError.issues[0].path).toContain('API_PORT');
      expect(zodError.issues[0].message).toContain('Expected number');
    }
  });

  it('should report multiple errors', () => {
    vi.stubEnv('API_PORT', 'invalid');
    vi.stubEnv('API_HOST', 'not-a-url');

    try {
      parseApiSchema(process.env);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError);

      const zodError = error as ZodError;
      expect(zodError.issues.length).toBeGreaterThan(1);
    }
  });

  it('should use safeParse for graceful error handling', () => {
    vi.stubEnv('API_PORT', 'invalid');

    const result = ApiSchema.safeParse(process.env);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ZodError);
      expect(result.error.issues[0].path).toContain('API_PORT');
    }
  });
});
```

### Testing Type Safety

**Type Safety Tests:**

```typescript
import { describe, it, expect, expectTypeOf } from 'vitest';
import { ApiSchema } from '../sections/api.schema.js';
import type { z } from 'zod';

type ApiConfig = z.infer<typeof ApiSchema>;

describe('API Configuration Types', () => {
  it('should infer correct types', () => {
    const config: ApiConfig = {
      API_PORT: 3000,
      API_HOST: 'http://localhost',
    };

    expectTypeOf(config.API_PORT).toBeNumber();
    expectTypeOf(config.API_HOST).toBeString();
  });

  it('should enforce required fields at type level', () => {
    // @ts-expect-error - API_PORT is required
    const invalidConfig: ApiConfig = {
      API_HOST: 'http://localhost',
    };
  });
});
```

---

## Best Practices

1. **Always clean up:** Use `afterEach(() => vi.unstubAllEnvs())`
2. **Mock per test:** Keep tests isolated
3. **Test both valid and invalid:** Cover success and failure cases
4. **Test defaults:** Verify default values work
5. **Test transformations:** Ensure coercion works correctly
6. **Test error messages:** Verify helpful error messages
7. **Use safeParse:** For graceful error handling tests
8. **Type safety:** Test TypeScript type inference

---

## Related Documentation

- [Configuration Validation](./validation.md)
- [Environment Variables Reference](../api/env-vars.md)
- [Testing Standards](../../../../.claude/docs/standards/testing-standards.md)
