# Configuration API Reference

Complete API reference for `@repo/config` package.

## Core Functions

### `validateEnv<T>(schema, context)`

Validate environment variables against a Zod schema.

**Type Signature:**

```typescript
function validateEnv<T extends ZodType>(
  schema: T,
  context: string
): z.infer<T>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `schema` | `ZodType` | Zod schema defining validation rules |
| `context` | `string` | Context name for error messages |

**Returns:**

- **Type**: `z.infer<T>` - Typed configuration object
- **Description**: Validated and parsed configuration matching the schema

**Throws:**

- **`EnvValidationError`**: When validation fails with detailed error information

**Example:**

```typescript
import { validateEnv } from '@repo/config';
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  API_PORT: z.coerce.number().int().positive(),
});

const config = validateEnv(schema, 'Database');
// config: { DATABASE_URL: string; API_PORT: number }

console.log(config.DATABASE_URL); // "postgresql://localhost/db"
console.log(config.API_PORT); // 3000
```

**Error Handling:**

```typescript
try {
  const config = validateEnv(schema, 'API');
} catch (error) {
  if (error instanceof EnvValidationError) {
    console.error('Context:', error.context);
    console.error('Issues:', error.issues);
  }
}
```

---

### `createStartupValidator<T>(schema, context)`

Create a validator function that exits the process on validation failure.

**Type Signature:**

```typescript
function createStartupValidator<T extends ZodType>(
  schema: T,
  context: string
): () => z.infer<T>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `schema` | `ZodType` | Zod schema defining validation rules |
| `context` | `string` | Context name for error messages |

**Returns:**

- **Type**: `() => z.infer<T>` - Validator function
- **Description**: Function that validates config and exits on failure

**Behavior:**

- On **success**: Returns validated configuration
- On **failure**: Logs error and exits with `process.exit(1)`

**Example:**

```typescript
import { createStartupValidator } from '@repo/config';
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  API_PORT: z.coerce.number().int().positive(),
});

// Create validator
const validateConfig = createStartupValidator(schema, 'API');

// Validate at application startup
const config = validateConfig();
// If validation fails, process exits immediately

// If successful, continue with configuration
console.log('Config validated:', config);
```

**Use Case:**

```typescript
// apps/api/src/index.ts
import { createStartupValidator, mainSchema, dbSchema } from '@repo/config';

// Validate critical configuration before any initialization
const validateMain = createStartupValidator(mainSchema, 'API');
const validateDb = createStartupValidator(dbSchema, 'Database');

const mainConfig = validateMain();
const dbConfig = validateDb();

// Now safe to initialize application
const app = createApp(mainConfig);
const db = connectDatabase(dbConfig);
```

---

### `getEnv(key, defaultValue?)`

Get environment variable with optional default value.

**Type Signature:**

```typescript
function getEnv(key: string, defaultValue?: string): string | undefined
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | `string` | Environment variable name |
| `defaultValue` | `string` (optional) | Default value if variable not set |

**Returns:**

- **Type**: `string | undefined`
- **Description**: Variable value or default, or `undefined` if not set

**Example:**

```typescript
import { getEnv } from '@repo/config';

// With default
const port = getEnv('PORT', '3000');
console.log(port); // "3000" if not set

// Without default
const host = getEnv('HOST');
console.log(host); // undefined if not set

// Required variable
const apiKey = getEnv('API_KEY');
if (!apiKey) {
  throw new Error('API_KEY is required');
}
```

**Use Case:**

```typescript
// Simple configuration without validation
const config = {
  port: getEnv('PORT', '3000'),
  host: getEnv('HOST', 'localhost'),
  debug: getEnv('DEBUG', 'false') === 'true',
};
```

---

### `getEnvBoolean(key, defaultValue?)`

Parse boolean environment variable.

**Type Signature:**

```typescript
function getEnvBoolean(key: string, defaultValue?: boolean): boolean
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | `string` | Environment variable name |
| `defaultValue` | `boolean` (optional) | Default value if variable not set |

**Returns:**

- **Type**: `boolean`
- **Description**: Parsed boolean value

**Truthy Values** (case-insensitive):

- `"true"`
- `"1"`
- `"yes"`

**Falsy Values**: All other values

**Example:**

```typescript
import { getEnvBoolean } from '@repo/config';

// With default
const debug = getEnvBoolean('DEBUG', false);
console.log(debug); // false if not set

// Truthy values
process.env.DEBUG = 'true';
console.log(getEnvBoolean('DEBUG')); // true

process.env.DEBUG = '1';
console.log(getEnvBoolean('DEBUG')); // true

process.env.DEBUG = 'yes';
console.log(getEnvBoolean('DEBUG')); // true

// Falsy values
process.env.DEBUG = 'false';
console.log(getEnvBoolean('DEBUG')); // false

process.env.DEBUG = '0';
console.log(getEnvBoolean('DEBUG')); // false
```

**Use Case:**

```typescript
// Feature flags
const features = {
  email: getEnvBoolean('FEATURE_EMAIL', false),
  payment: getEnvBoolean('FEATURE_PAYMENT', true),
  analytics: getEnvBoolean('FEATURE_ANALYTICS', false),
};

if (features.email) {
  initializeEmailService();
}
```

---

### `getEnvNumber(key, defaultValue?)`

Parse number environment variable.

**Type Signature:**

```typescript
function getEnvNumber(key: string, defaultValue?: number): number | undefined
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | `string` | Environment variable name |
| `defaultValue` | `number` (optional) | Default value if variable not set |

**Returns:**

- **Type**: `number | undefined`
- **Description**: Parsed number value or undefined if invalid

**Example:**

```typescript
import { getEnvNumber } from '@repo/config';

// With default
const port = getEnvNumber('PORT', 3000);
console.log(port); // 3000 if not set

// Valid number
process.env.PORT = '8080';
console.log(getEnvNumber('PORT')); // 8080

// Invalid number
process.env.PORT = 'invalid';
console.log(getEnvNumber('PORT', 3000)); // 3000 (fallback to default)

// Float numbers
process.env.TIMEOUT = '2.5';
console.log(getEnvNumber('TIMEOUT')); // 2.5
```

**Use Case:**

```typescript
// Numeric configuration
const config = {
  port: getEnvNumber('PORT', 3000),
  timeout: getEnvNumber('TIMEOUT', 5000),
  maxConnections: getEnvNumber('MAX_CONNECTIONS', 100),
  retryDelay: getEnvNumber('RETRY_DELAY', 1000),
};

console.log(`Server will listen on port ${config.port}`);
```

---

### `exposeSharedEnv(mappings)`

Expose environment variables to frontend (Vite).

**Type Signature:**

```typescript
function exposeSharedEnv(
  mappings: Record<string, string>
): Record<string, string>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `mappings` | `Record<string, string>` | Object mapping frontend keys to env var names |

**Returns:**

- **Type**: `Record<string, string>`
- **Description**: Object for Vite `define` config

**Example:**

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { exposeSharedEnv } from '@repo/config';

export default defineConfig({
  define: exposeSharedEnv({
    'import.meta.env.API_URL': 'VITE_API_URL',
    'import.meta.env.APP_ENV': 'VITE_APP_ENV',
    'import.meta.env.ENABLE_ANALYTICS': 'VITE_ENABLE_ANALYTICS',
  }),
});
```

**Frontend Usage:**

```typescript
// In frontend code
console.log(import.meta.env.API_URL); // Value from VITE_API_URL
console.log(import.meta.env.APP_ENV); // Value from VITE_APP_ENV
```

**Security Note:**

Only expose non-sensitive configuration to the frontend. Never expose:

- API keys
- Database credentials
- Secret tokens
- Internal URLs

---

## Configuration Sections

### Main Configuration

API server configuration including port, host, and CORS settings.

**Schema:**

```typescript
const mainSchema = z.object({
  VITE_API_PORT: commonEnvSchemas.port(3000),
  VITE_API_HOST: commonEnvSchemas.string('http://localhost'),
  API_CORS_ALLOWED_ORIGINS: commonEnvSchemas.string('http://localhost:4321'),
});
```

**Type:**

```typescript
type MainConfig = {
  VITE_API_PORT: number;
  VITE_API_HOST: string;
  API_CORS_ALLOWED_ORIGINS: string;
};
```

**Client Function:**

```typescript
import { mainConfig } from '@repo/config';

const config = mainConfig();
console.log(config.VITE_API_PORT); // 3000
console.log(config.VITE_API_HOST); // "http://localhost"
```

**Environment Variables:**

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `VITE_API_PORT` | number | 3000 | API server port |
| `VITE_API_HOST` | string | "<http://localhost>" | API host URL |
| `API_CORS_ALLOWED_ORIGINS` | string | "<http://localhost:4321>" | Comma-separated allowed origins |

---

### Database Configuration

PostgreSQL connection and pooling configuration.

**Schema:**

```typescript
const dbSchema = z.object({
  DATABASE_URL: z.string().url(),
  DB_POOL_MIN: commonEnvSchemas.number(2),
  DB_POOL_MAX: commonEnvSchemas.number(10),
});
```

**Type:**

```typescript
type DbConfig = {
  DATABASE_URL: string;
  DB_POOL_MIN: number;
  DB_POOL_MAX: number;
};
```

**Client Function:**

```typescript
import { dbConfig } from '@repo/config';

const config = dbConfig();
console.log(config.DATABASE_URL); // "postgresql://..."
console.log(config.DB_POOL_MIN); // 2
console.log(config.DB_POOL_MAX); // 10
```

**Environment Variables:**

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `DATABASE_URL` | string | *required* | PostgreSQL connection string |
| `DB_POOL_MIN` | number | 2 | Minimum pool connections |
| `DB_POOL_MAX` | number | 10 | Maximum pool connections |

---

### Logger Configuration

Logging configuration including level and format.

**Schema:**

```typescript
const loggerSchema = z.object({
  LOG_LEVEL: commonEnvSchemas.enum(
    ['debug', 'info', 'warn', 'error'],
    'info'
  ),
  LOG_FORMAT: commonEnvSchemas.enum(['json', 'pretty'], 'json'),
  LOG_ENABLED: commonEnvSchemas.boolean(true),
});
```

**Type:**

```typescript
type LoggerConfig = {
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
  LOG_FORMAT: 'json' | 'pretty';
  LOG_ENABLED: boolean;
};
```

**Client Functions:**

```typescript
import { loggerConfig, getLogLevel, isLogEnabled } from '@repo/config';

// Full configuration
const config = loggerConfig();
console.log(config.LOG_LEVEL); // "info"
console.log(config.LOG_FORMAT); // "json"

// Convenience functions
const level = getLogLevel(); // "info"
const enabled = isLogEnabled(); // true
```

**Environment Variables:**

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `LOG_LEVEL` | enum | "info" | Log level: debug, info, warn, error |
| `LOG_FORMAT` | enum | "json" | Format: json or pretty |
| `LOG_ENABLED` | boolean | true | Enable/disable logging |

---

## Common Schemas

Reusable Zod schemas for common validation patterns.

### `commonEnvSchemas.string(defaultValue?)`

String schema with optional default value.

**Type Signature:**

```typescript
function string(defaultValue?: string): ZodString | ZodDefault<ZodString>
```

**Example:**

```typescript
import { commonEnvSchemas } from '@repo/config';
import { z } from 'zod';

const schema = z.object({
  // Required string
  API_KEY: commonEnvSchemas.string(),

  // Optional with default
  BASE_URL: commonEnvSchemas.string('http://localhost'),
});
```

---

### `commonEnvSchemas.number(defaultValue?)`

Number schema with coercion from string.

**Type Signature:**

```typescript
function number(defaultValue?: number): ZodNumber | ZodDefault<ZodNumber>
```

**Example:**

```typescript
const schema = z.object({
  // Required number
  TIMEOUT: commonEnvSchemas.number(),

  // Optional with default
  RETRY_COUNT: commonEnvSchemas.number(3),
});
```

---

### `commonEnvSchemas.boolean(defaultValue?)`

Boolean schema with coercion from string.

**Type Signature:**

```typescript
function boolean(defaultValue?: boolean): ZodBoolean | ZodDefault<ZodBoolean>
```

**Truthy Values**: "true", "1", "yes" (case-insensitive)

**Example:**

```typescript
const schema = z.object({
  // Required boolean
  FEATURE_ENABLED: commonEnvSchemas.boolean(),

  // Optional with default
  DEBUG: commonEnvSchemas.boolean(false),
});
```

---

### `commonEnvSchemas.port(defaultValue?)`

Valid port number (1-65535).

**Type Signature:**

```typescript
function port(defaultValue?: number): ZodNumber | ZodDefault<ZodNumber>
```

**Example:**

```typescript
const schema = z.object({
  // Required port
  API_PORT: commonEnvSchemas.port(),

  // Optional with default
  METRICS_PORT: commonEnvSchemas.port(9090),
});
```

---

### `commonEnvSchemas.url(defaultValue?)`

Valid URL string.

**Type Signature:**

```typescript
function url(defaultValue?: string): ZodString | ZodDefault<ZodString>
```

**Example:**

```typescript
const schema = z.object({
  // Required URL
  API_URL: commonEnvSchemas.url(),

  // Optional with default
  WEBHOOK_URL: commonEnvSchemas.url('http://localhost/webhook'),
});
```

---

### `commonEnvSchemas.enum(values, defaultValue?)`

Enum schema with optional default.

**Type Signature:**

```typescript
function enum<T extends readonly [string, ...string[]]>(
  values: T,
  defaultValue?: T[number]
): ZodEnum<T> | ZodDefault<ZodEnum<T>>
```

**Example:**

```typescript
const schema = z.object({
  // Required enum
  ENVIRONMENT: commonEnvSchemas.enum(['dev', 'staging', 'production']),

  // Optional with default
  LOG_LEVEL: commonEnvSchemas.enum(
    ['debug', 'info', 'warn', 'error'],
    'info'
  ),
});
```

---

## Error Handling

### `EnvValidationError`

Custom error class for environment validation failures.

**Class Definition:**

```typescript
class EnvValidationError extends Error {
  constructor(
    context: string,
    issues: Array<{
      path: Array<string | number>;
      message: string;
      code: string;
    }>
  )
}
```

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `name` | string | "EnvValidationError" |
| `message` | string | Error message including context |
| `context` | string | Context name from validation |
| `issues` | array | Detailed validation issues |

**Issue Structure:**

```typescript
interface ValidationIssue {
  path: Array<string | number>; // Path to invalid field
  message: string; // Human-readable error message
  code: string; // Zod error code
}
```

**Example:**

```typescript
import { validateEnv, EnvValidationError } from '@repo/config';

try {
  const config = validateEnv(schema, 'API');
} catch (error) {
  if (error instanceof EnvValidationError) {
    console.error(`Validation failed for ${error.context}`);

    error.issues.forEach((issue) => {
      console.error(`- ${issue.path.join('.')}: ${issue.message}`);
    });

    // Example output:
    // Validation failed for API
    // - API_PORT: Expected number, received string
    // - DATABASE_URL: Invalid url
  }
}
```

**Common Error Codes:**

| Code | Description |
|------|-------------|
| `invalid_type` | Wrong type (e.g., string instead of number) |
| `invalid_string` | Invalid string format (e.g., not a URL) |
| `too_small` | Value below minimum |
| `too_big` | Value above maximum |
| `invalid_enum_value` | Value not in allowed enum values |

---

## Type Definitions

### Inferred Types

All types are inferred from Zod schemas using `z.infer<typeof schema>`:

```typescript
import { z } from 'zod';

const mySchema = z.object({
  PORT: z.coerce.number(),
  HOST: z.string(),
  DEBUG: z.coerce.boolean(),
});

// Type is automatically inferred
type MyConfig = z.infer<typeof mySchema>;
// {
//   PORT: number;
//   HOST: string;
//   DEBUG: boolean;
// }
```

### Configuration Types

```typescript
// Main configuration
type MainConfig = z.infer<typeof mainSchema>;

// Database configuration
type DbConfig = z.infer<typeof dbSchema>;

// Logger configuration
type LoggerConfig = z.infer<typeof loggerSchema>;
```

---

## Best Practices

### 1. Always Use Startup Validators for Critical Config

```typescript
// ✅ GOOD
const validateDb = createStartupValidator(dbSchema, 'Database');
const dbConfig = validateDb();

// ❌ BAD
function getDbConfig() {
  return validateEnv(dbSchema, 'Database');
}
```

### 2. Leverage Common Schemas

```typescript
// ✅ GOOD
const schema = z.object({
  PORT: commonEnvSchemas.port(3000),
});

// ❌ BAD
const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
});
```

### 3. Provide Sensible Defaults

```typescript
// ✅ GOOD
const schema = z.object({
  TIMEOUT: commonEnvSchemas.number(5000),
});

// ❌ BAD (breaks if not set)
const schema = z.object({
  TIMEOUT: commonEnvSchemas.number(),
});
```

### 4. Group Related Configuration

```typescript
// ✅ GOOD: Grouped in section
const emailSchema = z.object({
  EMAIL_HOST: z.string(),
  EMAIL_PORT: commonEnvSchemas.port(),
  EMAIL_USER: z.string(),
});

// ❌ BAD: Scattered
getEnv('EMAIL_HOST');
getEnv('EMAIL_PORT');
```

---

## Related Documentation

- **[Quick Start Guide](../quick-start.md)** - Get started in 5 minutes
- **[Environment Variables](./env-vars.md)** - Complete list of env vars
- **[Validation Guide](../guides/validation.md)** - Validation patterns
- **[Security Guide](../guides/security.md)** - Security best practices
