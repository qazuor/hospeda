# Configuration Validation Guide

Comprehensive guide to validating configuration with Zod schemas in the Hospeda project.

## Table of Contents

- [Validation Strategies](#validation-strategies)
- [Zod Schema Patterns](#zod-schema-patterns)
- [Common Validation Patterns](#common-validation-patterns)
- [Error Handling](#error-handling)
- [Testing Validation](#testing-validation)

---

## Validation Strategies

### Startup Validation (Fail Fast)

**Principle:** Validate all configuration at application startup. If validation fails, crash immediately before serving any requests.

**Benefits:**

- Prevents runtime errors from invalid configuration
- Clear error messages during deployment
- Ensures all required variables are present
- Type-safe configuration throughout application

**Implementation:**

```typescript
// src/sections/api.client.ts
import { parseApiSchema } from './api.schema.js';

// Parse immediately when module loads
// If validation fails, application won't start
export const apiConfig = parseApiSchema(process.env);
```

**Usage in Application:**

```typescript
// apps/api/src/index.ts
import { apiConfig } from '@repo/config';
import { Hono } from 'hono';

const app = new Hono();

// Configuration already validated - safe to use
app.listen(apiConfig.API_PORT, () => {
  console.log(`Server running on port ${apiConfig.API_PORT}`);
});
```

### Runtime Validation

**Use Case:** Dynamic configuration changes or user-provided configuration.

**Implementation:**

```typescript
import { ApiSchema } from '@repo/config';

export function updateApiConfig(newConfig: unknown) {
  // Validate at runtime
  const validated = ApiSchema.parse(newConfig);

  // Apply validated configuration
  applyConfig(validated);
}
```

### Type-Level Validation

**Principle:** Use TypeScript's type system to ensure configuration is used correctly.

**Implementation:**

```typescript
import { z } from 'zod';

const ConfigSchema = z.object({
  API_PORT: z.coerce.number(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']),
});

type Config = z.infer<typeof ConfigSchema>;

// Type-safe configuration access
function startServer(config: Config) {
  // TypeScript knows API_PORT is number
  const port = config.API_PORT;

  // TypeScript knows LOG_LEVEL is one of the enum values
  const logLevel = config.LOG_LEVEL;
}
```

---

## Zod Schema Patterns

### Required vs Optional

**Required Fields:**

```typescript
import { z } from 'zod';

const RequiredSchema = z.object({
  DATABASE_URL: z.string(), // REQUIRED - will fail if missing
  API_KEY: z.string().min(1), // REQUIRED and non-empty
});

// ❌ FAILS - missing DATABASE_URL
RequiredSchema.parse({
  API_KEY: 'key123',
});

// ✅ PASSES
RequiredSchema.parse({
  DATABASE_URL: 'postgresql://localhost/db',
  API_KEY: 'key123',
});
```

**Optional Fields:**

```typescript
const OptionalSchema = z.object({
  DATABASE_URL: z.string(), // Required
  DATABASE_POOL_SIZE: z.coerce.number().optional(), // Optional
  DATABASE_TIMEOUT: z.coerce.number().optional(), // Optional
});

// ✅ PASSES - optional fields can be omitted
OptionalSchema.parse({
  DATABASE_URL: 'postgresql://localhost/db',
});

// ✅ PASSES - optional fields can be provided
OptionalSchema.parse({
  DATABASE_URL: 'postgresql://localhost/db',
  DATABASE_POOL_SIZE: 20,
});
```

**Optional with Default:**

```typescript
const DefaultSchema = z.object({
  DATABASE_URL: z.string(),
  DATABASE_POOL_SIZE: z.coerce.number().default(10), // Default if missing
  DATABASE_SSL: z.coerce.boolean().default(true), // Default if missing
});

const config = DefaultSchema.parse({
  DATABASE_URL: 'postgresql://localhost/db',
  // POOL_SIZE and SSL will use defaults
});

console.log(config.DATABASE_POOL_SIZE); // 10
console.log(config.DATABASE_SSL); // true
```

### Coercion

**Number Coercion:**

```typescript
const NumberSchema = z.object({
  API_PORT: z.coerce.number(), // Converts string to number
  MAX_RETRIES: z.coerce.number().min(0).max(10),
});

// ✅ PASSES - strings are coerced to numbers
NumberSchema.parse({
  API_PORT: '3000', // Becomes 3000
  MAX_RETRIES: '5', // Becomes 5
});
```

**Boolean Coercion:**

```typescript
const BooleanSchema = z.object({
  ENABLE_CACHING: z.coerce.boolean(),
  USE_SSL: z.coerce.boolean(),
});

// ✅ All these are coerced to boolean
BooleanSchema.parse({ ENABLE_CACHING: 'true', USE_SSL: '1' });
BooleanSchema.parse({ ENABLE_CACHING: 'false', USE_SSL: '0' });
BooleanSchema.parse({ ENABLE_CACHING: true, USE_SSL: false });
```

**Date Coercion:**

```typescript
const DateSchema = z.object({
  START_DATE: z.coerce.date(),
  END_DATE: z.coerce.date(),
});

// ✅ PASSES - strings are coerced to Date objects
DateSchema.parse({
  START_DATE: '2024-01-01',
  END_DATE: '2024-12-31',
});
```

### Transformations

**String Transformations:**

```typescript
const TransformSchema = z.object({
  EMAIL: z.string().email().toLowerCase(), // Lowercase email
  USERNAME: z.string().trim(), // Remove whitespace
  SLUG: z.string().transform((val) => val.toLowerCase().replace(/\s+/g, '-')),
});

const result = TransformSchema.parse({
  EMAIL: 'USER@EXAMPLE.COM',
  USERNAME: '  john  ',
  SLUG: 'My Blog Post',
});

console.log(result.EMAIL); // 'user@example.com'
console.log(result.USERNAME); // 'john'
console.log(result.SLUG); // 'my-blog-post'
```

**Array Transformations:**

```typescript
const ArraySchema = z.object({
  // Transform comma-separated string to array
  ALLOWED_ORIGINS: z
    .string()
    .transform((val) => val.split(',').map((s) => s.trim()))
    .pipe(z.array(z.string().url())),
});

const config = ArraySchema.parse({
  ALLOWED_ORIGINS: 'http://localhost:3000, https://example.com',
});

console.log(config.ALLOWED_ORIGINS);
// ['http://localhost:3000', 'https://example.com']
```

**Number Transformations:**

```typescript
const NumberTransformSchema = z.object({
  // Round to 2 decimal places
  PRICE: z.coerce.number().transform((val) => Math.round(val * 100) / 100),

  // Ensure positive
  TIMEOUT: z.coerce.number().transform((val) => Math.abs(val)),
});
```

### Refinements

**Custom Validation:**

```typescript
const RefinedSchema = z.object({
  PASSWORD: z
    .string()
    .min(8)
    .refine(
      (val) => /[A-Z]/.test(val),
      { message: 'Password must contain at least one uppercase letter' }
    )
    .refine(
      (val) => /[0-9]/.test(val),
      { message: 'Password must contain at least one number' }
    ),
});

// ❌ FAILS - no uppercase
RefinedSchema.parse({ PASSWORD: 'password123' });

// ✅ PASSES
RefinedSchema.parse({ PASSWORD: 'Password123' });
```

**Conditional Validation:**

```typescript
const ConditionalSchema = z.object({
  USE_REDIS: z.coerce.boolean(),
  REDIS_URL: z.string().optional(),
}).refine(
  (data) => {
    // If USE_REDIS is true, REDIS_URL must be provided
    if (data.USE_REDIS && !data.REDIS_URL) {
      return false;
    }
    return true;
  },
  {
    message: 'REDIS_URL is required when USE_REDIS is true',
    path: ['REDIS_URL'],
  }
);
```

**Cross-Field Validation:**

```typescript
const DateRangeSchema = z.object({
  START_DATE: z.coerce.date(),
  END_DATE: z.coerce.date(),
}).refine(
  (data) => data.END_DATE > data.START_DATE,
  {
    message: 'END_DATE must be after START_DATE',
    path: ['END_DATE'],
  }
);
```

### Unions

**Multiple Valid Formats:**

```typescript
const UnionSchema = z.object({
  // Can be URL or file path
  DATABASE_URL: z.union([
    z.string().url(),
    z.string().startsWith('/'),
  ]),

  // Can be number or string
  PORT: z.union([
    z.number(),
    z.string().regex(/^\d+$/),
  ]).transform((val) => Number(val)),
});

// ✅ Both are valid
UnionSchema.parse({ DATABASE_URL: 'postgresql://localhost/db', PORT: 3000 });
UnionSchema.parse({ DATABASE_URL: '/var/lib/db.sqlite', PORT: '3000' });
```

**Discriminated Unions:**

```typescript
const StorageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('local'),
    path: z.string(),
  }),
  z.object({
    type: z.literal('s3'),
    bucket: z.string(),
    region: z.string(),
  }),
]);

// ✅ Local storage
StorageSchema.parse({
  type: 'local',
  path: '/var/uploads',
});

// ✅ S3 storage
StorageSchema.parse({
  type: 's3',
  bucket: 'my-bucket',
  region: 'us-east-1',
});
```

---

## Common Validation Patterns

### Port Numbers

```typescript
const PortSchema = z.object({
  API_PORT: z.coerce
    .number()
    .min(1, 'Port must be at least 1')
    .max(65535, 'Port must be at most 65535')
    .int('Port must be an integer'),
});

// ✅ Valid ports
PortSchema.parse({ API_PORT: '3000' });
PortSchema.parse({ API_PORT: '8080' });

// ❌ Invalid ports
PortSchema.parse({ API_PORT: '0' }); // Too low
PortSchema.parse({ API_PORT: '99999' }); // Too high
PortSchema.parse({ API_PORT: '3000.5' }); // Not integer
```

### URLs

```typescript
const UrlSchema = z.object({
  // Any valid URL
  API_URL: z.string().url(),

  // Must be HTTP/HTTPS
  WEB_URL: z.string().url().refine(
    (val) => val.startsWith('http://') || val.startsWith('https://'),
    { message: 'URL must use HTTP or HTTPS protocol' }
  ),

  // PostgreSQL connection string
  DATABASE_URL: z.string().url().startsWith('postgresql://'),

  // Redis connection string
  REDIS_URL: z.string().url().startsWith('redis://'),
});
```

### Booleans (Multiple Formats)

```typescript
const BooleanSchema = z.object({
  // Accepts: true, false, 'true', 'false', '1', '0', 'yes', 'no'
  ENABLE_FEATURE: z
    .union([
      z.boolean(),
      z.enum(['true', 'false', '1', '0', 'yes', 'no']),
    ])
    .transform((val) => {
      if (typeof val === 'boolean') return val;
      return val === 'true' || val === '1' || val === 'yes';
    }),
});

// ✅ All valid
BooleanSchema.parse({ ENABLE_FEATURE: true });
BooleanSchema.parse({ ENABLE_FEATURE: 'true' });
BooleanSchema.parse({ ENABLE_FEATURE: '1' });
BooleanSchema.parse({ ENABLE_FEATURE: 'yes' });
```

### Arrays (Comma-Separated Strings)

```typescript
const ArraySchema = z.object({
  // Comma-separated list of URLs
  ALLOWED_ORIGINS: z
    .string()
    .transform((val) => val.split(',').map((s) => s.trim()))
    .pipe(z.array(z.string().url())),

  // Comma-separated list of emails
  ADMIN_EMAILS: z
    .string()
    .transform((val) => val.split(',').map((s) => s.trim()))
    .pipe(z.array(z.string().email())),
});

const config = ArraySchema.parse({
  ALLOWED_ORIGINS: 'http://localhost:3000, https://example.com',
  ADMIN_EMAILS: 'admin@example.com, support@example.com',
});
```

### Enums (Specific Values)

```typescript
const EnumSchema = z.object({
  // Log level
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']),

  // Environment
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']),

  // Database type
  DB_TYPE: z.enum(['postgres', 'mysql', 'sqlite']),
});

// ✅ Valid
EnumSchema.parse({
  LOG_LEVEL: 'info',
  NODE_ENV: 'production',
  DB_TYPE: 'postgres',
});

// ❌ Invalid - not in enum
EnumSchema.parse({
  LOG_LEVEL: 'verbose', // Not in enum
});
```

---

## Error Handling

### EnvValidationError Structure

```typescript
import { ZodError } from 'zod';

export class EnvValidationError extends Error {
  constructor(
    message: string,
    public readonly zodError: ZodError,
    public readonly section: string
  ) {
    super(message);
    this.name = 'EnvValidationError';
  }
}

// Usage in parser
export function parseApiSchema(env: NodeJS.ProcessEnv) {
  try {
    return ApiSchema.parse({
      API_PORT: env.API_PORT,
      API_HOST: env.API_HOST,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      throw new EnvValidationError(
        'API configuration validation failed',
        error,
        'api'
      );
    }
    throw error;
  }
}
```

### Error Messages Formatting

```typescript
import { ZodError } from 'zod';

export function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join('.');
      return `  - ${path}: ${issue.message}`;
    })
    .join('\n');
}

// Usage
try {
  parseApiSchema(process.env);
} catch (error) {
  if (error instanceof EnvValidationError) {
    console.error(`Configuration validation failed (${error.section}):`);
    console.error(formatZodError(error.zodError));
    process.exit(1);
  }
}
```

### Debug Information

```typescript
export function logValidationError(error: EnvValidationError): void {
  console.error('\n❌ Configuration Validation Failed\n');
  console.error(`Section: ${error.section}`);
  console.error(`Message: ${error.message}\n`);
  console.error('Issues:');
  console.error(formatZodError(error.zodError));
  console.error('\nEnvironment variables provided:');

  // Log which variables were present (without values for security)
  error.zodError.issues.forEach((issue) => {
    const envVar = issue.path[0] as string;
    const isPresent = process.env[envVar] !== undefined;
    console.error(`  - ${envVar}: ${isPresent ? '✓ present' : '✗ missing'}`);
  });
}
```

### Exit Codes

```typescript
export enum ExitCode {
  SUCCESS = 0,
  CONFIG_VALIDATION_ERROR = 1,
  DATABASE_CONNECTION_ERROR = 2,
  UNKNOWN_ERROR = 99,
}

// Usage
try {
  const config = parseApiSchema(process.env);
} catch (error) {
  if (error instanceof EnvValidationError) {
    logValidationError(error);
    process.exit(ExitCode.CONFIG_VALIDATION_ERROR);
  }
  console.error('Unknown error:', error);
  process.exit(ExitCode.UNKNOWN_ERROR);
}
```

---

## Testing Validation

### Unit Tests for Schemas

```typescript
import { describe, it, expect } from 'vitest';
import { ApiSchema } from '../sections/api.schema.js';

describe('ApiSchema', () => {
  it('should parse valid configuration', () => {
    const validConfig = {
      API_PORT: '3000',
      API_HOST: 'http://localhost',
    };

    const result = ApiSchema.parse(validConfig);

    expect(result.API_PORT).toBe(3000);
    expect(result.API_HOST).toBe('http://localhost');
  });

  it('should use default values', () => {
    const minimalConfig = {
      API_PORT: '3000',
    };

    const result = ApiSchema.parse(minimalConfig);

    expect(result.API_HOST).toBe('0.0.0.0'); // Default
  });

  it('should coerce port to number', () => {
    const config = {
      API_PORT: '8080',
    };

    const result = ApiSchema.parse(config);

    expect(result.API_PORT).toBe(8080);
    expect(typeof result.API_PORT).toBe('number');
  });
});
```

### Testing Failures

```typescript
import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import { ApiSchema } from '../sections/api.schema.js';

describe('ApiSchema - Validation Errors', () => {
  it('should fail on missing required field', () => {
    const invalidConfig = {
      // Missing API_PORT
      API_HOST: 'http://localhost',
    };

    expect(() => ApiSchema.parse(invalidConfig)).toThrow(ZodError);
  });

  it('should fail on invalid port', () => {
    const invalidConfig = {
      API_PORT: '99999', // Port too high
    };

    expect(() => ApiSchema.parse(invalidConfig)).toThrow(ZodError);
    expect(() => ApiSchema.parse(invalidConfig)).toThrow(/Port must be at most 65535/);
  });

  it('should fail on invalid URL', () => {
    const invalidConfig = {
      API_PORT: '3000',
      API_HOST: 'not-a-url',
    };

    expect(() => ApiSchema.parse(invalidConfig)).toThrow(ZodError);
  });

  it('should provide helpful error messages', () => {
    const invalidConfig = {
      API_PORT: 'abc', // Not a number
    };

    try {
      ApiSchema.parse(invalidConfig);
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError);
      const zodError = error as ZodError;
      expect(zodError.issues[0].message).toContain('Expected number');
    }
  });
});
```

### Mocking Environment

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseApiSchema } from '../sections/api.schema.js';

describe('parseApiSchema', () => {
  beforeEach(() => {
    // Mock environment variables
    vi.stubEnv('API_PORT', '3000');
    vi.stubEnv('API_HOST', 'http://localhost');
  });

  afterEach(() => {
    // Clean up
    vi.unstubAllEnvs();
  });

  it('should read from process.env', () => {
    const config = parseApiSchema(process.env);

    expect(config.API_PORT).toBe(3000);
    expect(config.API_HOST).toBe('http://localhost');
  });

  it('should handle missing optional variables', () => {
    vi.unstubAllEnvs();
    vi.stubEnv('API_PORT', '3000');
    // API_HOST not set

    const config = parseApiSchema(process.env);

    expect(config.API_PORT).toBe(3000);
    expect(config.API_HOST).toBe('0.0.0.0'); // Default
  });
});
```

---

## Best Practices

1. **Validate Early:** Always validate at application startup
2. **Fail Fast:** Crash immediately on invalid configuration
3. **Clear Errors:** Provide helpful error messages
4. **Type Safety:** Use Zod to infer TypeScript types
5. **Defaults:** Provide sensible defaults for optional values
6. **Documentation:** Document all environment variables
7. **Testing:** Test both valid and invalid configurations
8. **Security:** Never log sensitive values in errors

---

## Related Documentation

- [Environment Variables Reference](../api/env-vars.md)
- [Adding Configuration Guide](./adding-config.md)
- [Security Best Practices](./security.md)
- [Testing Configuration Guide](./testing.md)
