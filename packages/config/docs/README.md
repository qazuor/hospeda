# @repo/config Documentation

Complete documentation for Hospeda's centralized configuration and environment variable management system.

## Overview

`@repo/config` provides a robust, type-safe configuration management solution for the Hospeda platform. It handles environment variable validation, parsing, and access with a focus on security, developer experience, and fail-fast behavior.

### Key Benefits

- **Type Safety**: Full TypeScript support with Zod schema validation
- **Fail Fast**: Startup validators exit immediately on invalid configuration
- **Developer Experience**: Clear error messages, sensible defaults, autocomplete
- **Security**: Sanitized errors, safe frontend exposure, no secret leakage
- **Modularity**: Configuration sections for logical grouping
- **Testing**: Easy mocking and testing support

### Core Concepts

#### 1. Environment Variables vs Configuration

**Environment Variables** are raw string values from `process.env`:

```typescript
process.env.API_PORT; // "3000" (string)
process.env.DEBUG; // "true" (string)
process.env.UNDEFINED_VAR; // undefined
```

**Configuration** is validated, typed, and parsed:

```typescript
const config = validateEnv(schema, 'API');
config.API_PORT; // 3000 (number)
config.DEBUG; // true (boolean)
config.OPTIONAL_VAR; // "default" (with default)
```

#### 2. Schema-Based Validation

All configuration uses Zod schemas for validation:

```typescript
import { z } from 'zod';

const schema = z.object({
  // Required string
  DATABASE_URL: z.string().url(),

  // Optional with default
  API_PORT: z.coerce.number().int().positive().default(3000),

  // Transformed value
  CORS_ORIGINS: z
    .string()
    .transform((val) => val.split(',').map((s) => s.trim())),

  // Refined validation
  TIMEOUT: z.coerce
    .number()
    .int()
    .positive()
    .refine((n) => n >= 1000, {
      message: 'Timeout must be at least 1000ms',
    }),
});
```

#### 3. Configuration Sections

Related configuration is grouped into sections:

```
sections/
├── main.schema.ts      # API server config (port, host, CORS)
├── main.client.ts      # Main config access
├── db.schema.ts        # Database config (URL, pool)
├── logger.schema.ts    # Logger config (level, format)
└── logger.client.ts    # Logger config access
```

Each section has:

- **Schema**: Zod schema defining structure and validation
- **Parser**: Function to validate and return typed config
- **Client** (optional): Convenience functions for common access patterns

#### 4. Type Safety Throughout

Types are inferred from schemas using `z.infer<typeof schema>`:

```typescript
import { z } from 'zod';

const apiSchema = z.object({
  API_PORT: z.coerce.number(),
  API_HOST: z.string().url(),
});

// Type is automatically inferred
type ApiConfig = z.infer<typeof apiSchema>;
// {
//   API_PORT: number;
//   API_HOST: string;
// }

const config: ApiConfig = validateEnv(apiSchema, 'API');
```

#### 5. Startup Validation

Critical configuration should be validated at application startup:

```typescript
// Create validator that exits on failure
const validateConfig = createStartupValidator(schema, 'App');

// Call at startup (before any other initialization)
const config = validateConfig();
// If validation fails, process exits with code 1
// and detailed error message is logged

// Continue with valid configuration
startServer(config);
```

This ensures the application never runs with invalid configuration.

## Package Architecture

```
src/
├── env.ts               # Core validation utilities
│   ├── validateEnv()
│   ├── createStartupValidator()
│   └── EnvValidationError
│
├── client.ts            # Configuration access utilities
│   ├── getEnv()
│   ├── getEnvBoolean()
│   ├── getEnvNumber()
│   └── exposeSharedEnv()
│
├── utils.ts             # Common schemas and helpers
│   └── commonEnvSchemas
│
├── sections/            # Configuration sections
│   ├── main.schema.ts   # Main config schema
│   ├── main.client.ts   # Main config client
│   ├── db.schema.ts     # Database schema
│   ├── logger.schema.ts # Logger schema
│   └── logger.client.ts # Logger config client
│
└── index.ts             # Public API exports
```

### Module Responsibilities

#### `env.ts` - Core Validation

- `validateEnv<T>()` - Validate env vars against schema
- `createStartupValidator<T>()` - Create fail-fast validator
- `EnvValidationError` - Custom error class

#### `client.ts` - Configuration Access

- `getEnv()` - Get raw env var with default
- `getEnvBoolean()` - Parse boolean env var
- `getEnvNumber()` - Parse number env var
- `exposeSharedEnv()` - Expose vars to frontend

#### `utils.ts` - Common Patterns

- `commonEnvSchemas.string()` - String schema with default
- `commonEnvSchemas.number()` - Number schema with coercion
- `commonEnvSchemas.boolean()` - Boolean schema with coercion
- `commonEnvSchemas.port()` - Valid port number (1-65535)
- `commonEnvSchemas.url()` - Valid URL
- `commonEnvSchemas.enum()` - Enum with default

#### `sections/` - Configuration Sections

Pre-configured schemas and parsers for common use cases:

- **Main**: API server configuration (port, host, CORS)
- **Database**: PostgreSQL connection and pooling
- **Logger**: Logging configuration (level, format)

## Quick Start

See **[Quick Start Guide](./quick-start.md)** for a 5-minute tutorial.

## API Reference

### Core Functions

| Function | Description | Documentation |
|----------|-------------|---------------|
| `validateEnv()` | Validate environment variables | [API Reference](./api/config-reference.md#validateenv) |
| `createStartupValidator()` | Create fail-fast validator | [API Reference](./api/config-reference.md#createstartupvalidator) |
| `getEnv()` | Get environment variable | [API Reference](./api/config-reference.md#getenv) |
| `getEnvBoolean()` | Parse boolean env var | [API Reference](./api/config-reference.md#getenvboolean) |
| `getEnvNumber()` | Parse number env var | [API Reference](./api/config-reference.md#getenvnumber) |
| `exposeSharedEnv()` | Expose vars to frontend | [API Reference](./api/config-reference.md#exposesharedenv) |

### Configuration Sections

| Section | Description | Documentation |
|---------|-------------|---------------|
| Main | API server config | [API Reference](./api/config-reference.md#main-configuration) |
| Database | PostgreSQL config | [API Reference](./api/config-reference.md#database-configuration) |
| Logger | Logging config | [API Reference](./api/config-reference.md#logger-configuration) |

### Common Schemas

| Schema | Description | Documentation |
|--------|-------------|---------------|
| `string()` | String with default | [API Reference](./api/config-reference.md#common-schemas) |
| `number()` | Coerced number | [API Reference](./api/config-reference.md#common-schemas) |
| `boolean()` | Coerced boolean | [API Reference](./api/config-reference.md#common-schemas) |
| `port()` | Valid port number | [API Reference](./api/config-reference.md#common-schemas) |
| `url()` | Valid URL | [API Reference](./api/config-reference.md#common-schemas) |
| `enum()` | Enum with default | [API Reference](./api/config-reference.md#common-schemas) |

**Complete API Reference**: [api/config-reference.md](./api/config-reference.md)

## Environment Variables

See **[Environment Variables Reference](./api/env-vars.md)** for complete list of all environment variables used in Hospeda.

Quick overview:

- **API**: Port, host, CORS origins
- **Database**: Connection string, pool settings
- **Logger**: Level, format, enabled flag
- **Better Auth**: Authentication configuration
- **Mercado Pago**: Payment integration keys
- **Cloudinary**: Image storage credentials

## Guides

### Getting Started

- **[Quick Start](./quick-start.md)** - 5-minute introduction
- **[Adding Configuration](./guides/adding-config.md)** - How to add new config
- **[Validation](./guides/validation.md)** - Configuration validation patterns

### Environment Management

- **[Environments](./guides/environments.md)** - Managing dev/test/staging/production
- **[Testing](./guides/testing.md)** - Testing with mocked configuration
- **[Security](./guides/security.md)** - Security best practices

### Examples

- **[New Environment Variable](./examples/new-env-var.ts)** - Complete example
- **[Type-Safe Configuration](./examples/typed-config.ts)** - Type safety patterns
- **[Environment-Specific Config](./examples/environment-specific.ts)** - Per-environment config

## Common Patterns

### 1. Adding New Environment Variable

```typescript
// 1. Define schema
const schema = z.object({
  NEW_VAR: z.string().min(1),
});

// 2. Validate at startup
const validateConfig = createStartupValidator(schema, 'Feature');
const config = validateConfig();

// 3. Use in code
console.log(config.NEW_VAR);
```

See: [Adding Configuration Guide](./guides/adding-config.md)

### 2. Creating Configuration Section

```typescript
// sections/email.schema.ts
export const emailSchema = z.object({
  EMAIL_HOST: z.string(),
  EMAIL_PORT: commonEnvSchemas.port(587),
  EMAIL_USER: z.string().email(),
  EMAIL_PASS: z.string().min(1),
});

export type EmailConfig = z.infer<typeof emailSchema>;

export function parseEmailConfig(): EmailConfig {
  return validateEnv(emailSchema, 'Email');
}

// sections/email.client.ts
export function emailConfig(): EmailConfig {
  return parseEmailConfig();
}
```

See: [Adding Configuration Guide](./guides/adding-config.md)

### 3. Validating at Startup

```typescript
// apps/api/src/server.ts
import { createStartupValidator, mainSchema, dbSchema } from '@repo/config';

// Validate configuration before starting server
const validateMainConfig = createStartupValidator(mainSchema, 'API');
const validateDbConfig = createStartupValidator(dbSchema, 'Database');

const mainConfig = validateMainConfig();
const dbConfig = validateDbConfig();

// Configuration is now validated and typed
const server = createServer(mainConfig);
const db = createDb(dbConfig);
```

See: [Validation Guide](./guides/validation.md)

### 4. Accessing Configuration in Code

```typescript
// In services
import { mainConfig, dbConfig } from '@repo/config';

export class MyService {
  private readonly config = mainConfig();
  private readonly dbConfig = dbConfig();

  async execute() {
    const apiUrl = this.config.API_URL;
    const dbUrl = this.dbConfig.DATABASE_URL;
    // ...
  }
}
```

See: [Type-Safe Configuration Example](./examples/typed-config.ts)

### 5. Testing with Mocked Configuration

```typescript
import { describe, it, beforeEach, afterEach, vi } from 'vitest';

describe('MyService', () => {
  beforeEach(() => {
    // Mock environment variables
    vi.stubEnv('API_PORT', '3000');
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost/test');
  });

  afterEach(() => {
    // Clean up mocks
    vi.unstubAllEnvs();
  });

  it('should use mocked configuration', () => {
    // Test code that uses configuration
  });
});
```

See: [Testing Guide](./guides/testing.md)

## Best Practices

### 1. Validate at Startup

Always validate critical configuration at application startup:

```typescript
// ✅ GOOD: Validate at startup
const validateConfig = createStartupValidator(schema, 'App');
const config = validateConfig();

// ❌ BAD: Validate on first use (may fail in production)
function getConfig() {
  return validateEnv(schema, 'App');
}
```

### 2. Use Common Schemas

Leverage `commonEnvSchemas` for consistency:

```typescript
// ✅ GOOD: Use common schema
const schema = z.object({
  PORT: commonEnvSchemas.port(3000),
});

// ❌ BAD: Custom validation (inconsistent)
const schema = z.object({
  PORT: z.coerce.number().min(1).max(65535).default(3000),
});
```

### 3. Provide Sensible Defaults

Always provide defaults when possible:

```typescript
// ✅ GOOD: Default value
const schema = z.object({
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

// ❌ BAD: No default (breaks if not set)
const schema = z.object({
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']),
});
```

### 4. Group Related Configuration

Create sections for related configuration:

```typescript
// ✅ GOOD: Grouped in section
const emailSchema = z.object({
  EMAIL_HOST: z.string(),
  EMAIL_PORT: commonEnvSchemas.port(),
  EMAIL_USER: z.string(),
  EMAIL_PASS: z.string(),
});

// ❌ BAD: Scattered individual vars
getEnv('EMAIL_HOST');
getEnv('EMAIL_PORT');
getEnv('EMAIL_USER');
getEnv('EMAIL_PASS');
```

### 5. Document All Variables

Update `.env.example` when adding variables:

```bash
# API Configuration
VITE_API_PORT=3000
VITE_API_HOST=http://localhost

# New feature
NEW_FEATURE_ENABLED=true
NEW_FEATURE_TIMEOUT=5000
```

### 6. Never Commit Secrets

Keep `.env` files out of version control:

```gitignore
# .gitignore
.env
.env.local
.env.*.local
```

### 7. Use Type Inference

Infer types from schemas:

```typescript
// ✅ GOOD: Type inferred from schema
const schema = z.object({
  PORT: z.coerce.number(),
});
type Config = z.infer<typeof schema>;

// ❌ BAD: Duplicate type definition
interface Config {
  PORT: number;
}
const schema = z.object({
  PORT: z.coerce.number(),
});
```

### 8. Fail Fast

Validate critical config at startup:

```typescript
// ✅ GOOD: Exit if invalid
const validateConfig = createStartupValidator(schema, 'App');
const config = validateConfig();

// ❌ BAD: Continue with invalid config
try {
  const config = validateEnv(schema, 'App');
} catch (error) {
  console.error('Config invalid, using defaults');
  const config = getDefaults();
}
```

### 9. Sanitize Errors

Don't log sensitive values:

```typescript
// ✅ GOOD: Masked in errors
const schema = z.object({
  API_KEY: z.string().min(1),
});

// Errors don't include actual value:
// "Expected string with minimum length 1"

// ❌ BAD: Logging sensitive value
console.error('Invalid API_KEY:', process.env.API_KEY);
```

### 10. Test Configuration

Mock env vars in tests:

```typescript
// ✅ GOOD: Mock env vars
beforeEach(() => {
  vi.stubEnv('API_PORT', '3000');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ❌ BAD: Use real env vars in tests
```

See: [Security Guide](./guides/security.md)

## Troubleshooting

### Validation Fails at Startup

**Problem**: Application exits immediately with validation error.

**Solution**:

1. Check error message for missing/invalid variable
2. Set variable in `.env.local` or environment
3. Verify variable name matches schema
4. Check default value if provided

```bash
# Error example
Environment validation failed for API configuration:
  - API_PORT: Expected number, received string "abc"

# Solution
VITE_API_PORT=3000  # Set to valid number
```

### Type Errors with Configuration

**Problem**: TypeScript errors when accessing configuration.

**Solution**:

1. Verify schema defines the property
2. Check type inference is working
3. Ensure validator returns typed config

```typescript
// If you get "Property 'PORT' does not exist"
const schema = z.object({
  PORT: z.coerce.number(), // Add missing property
});

type Config = z.infer<typeof schema>; // Verify type
```

### Environment Variable Not Found

**Problem**: `getEnv()` returns undefined.

**Solution**:

1. Check variable is set in environment
2. Verify variable name is correct (case-sensitive)
3. Provide default value if optional

```typescript
// Check if set
console.log(process.env.MY_VAR);

// Provide default
const value = getEnv('MY_VAR', 'default-value');
```

### Frontend Can't Access Environment Variables

**Problem**: Vite frontend shows undefined for env vars.

**Solution**:

1. Prefix with `VITE_` for Vite apps
2. Use `exposeSharedEnv()` in Vite config
3. Restart dev server after changes

```typescript
// vite.config.ts
export default defineConfig({
  define: exposeSharedEnv({
    API_URL: 'VITE_API_URL',
  }),
});
```

## Support

- **Issues**: [GitHub Issues](https://github.com/hospeda/hospeda/issues)
- **Discussions**: [GitHub Discussions](https://github.com/hospeda/hospeda/discussions)
- **Documentation**: This directory

## Related Documentation

- **[@repo/db](../../db/docs/README.md)** - Database configuration usage
- **[@repo/logger](../../logger/docs/README.md)** - Logger configuration usage
- **[API Documentation](../../../apps/api/docs/README.md)** - API configuration

## License

MIT
