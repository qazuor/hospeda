# @repo/config

Centralized configuration and environment variable management for Hospeda platform.

## Features

- **Type-Safe Configuration**: Schema-based validation with Zod
- **Environment Variable Management**: Parse and validate env vars
- **Startup Validation**: Fail-fast on invalid configuration
- **Configuration Sections**: Modular config (main, db, logger)
- **Common Schemas**: Reusable validation patterns
- **Frontend Exposure**: Safely expose env vars to client
- **Error Handling**: Detailed validation errors with context

## Installation

```bash
pnpm add @repo/config
```

## Quick Start

```typescript
import { validateEnv, getEnv, createStartupValidator } from '@repo/config';
import { z } from 'zod';

// Define schema
const schema = z.object({
  API_PORT: z.coerce.number().int().positive(),
  API_HOST: z.string().url(),
});

// Validate at startup (exits on failure)
const validator = createStartupValidator(schema, 'API');
const config = validator();

// Use configuration
console.log(`Server starting on ${config.API_HOST}:${config.API_PORT}`);

// Access individual env vars
const port = getEnv('API_PORT', '3000');
```

## Core Functions

### `validateEnv<T>(schema, context)`

Validate environment variables against a Zod schema.

```typescript
import { validateEnv } from '@repo/config';
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url(),
});

const config = validateEnv(schema, 'Database');
// config: { DATABASE_URL: string }
```

### `createStartupValidator<T>(schema, context)`

Create a validator that exits the process on validation failure.

```typescript
import { createStartupValidator } from '@repo/config';
import { z } from 'zod';

const schema = z.object({
  REQUIRED_VAR: z.string().min(1),
});

const validator = createStartupValidator(schema, 'App');
const config = validator(); // Exits if validation fails
```

### `getEnv(key, defaultValue)`

Get environment variable with optional default value.

```typescript
import { getEnv } from '@repo/config';

const port = getEnv('PORT', '3000');
const host = getEnv('HOST'); // undefined if not set
```

### `getEnvBoolean(key, defaultValue)`

Parse boolean environment variable.

```typescript
import { getEnvBoolean } from '@repo/config';

const debug = getEnvBoolean('DEBUG', false);
// Accepts: 'true', '1', 'yes' (case-insensitive)
```

### `getEnvNumber(key, defaultValue)`

Parse number environment variable.

```typescript
import { getEnvNumber } from '@repo/config';

const timeout = getEnvNumber('TIMEOUT', 5000);
```

### `exposeSharedEnv(mappings)`

Expose environment variables to frontend (Vite).

```typescript
import { exposeSharedEnv } from '@repo/config';

export default defineConfig({
  define: exposeSharedEnv({
    API_URL: 'VITE_API_URL',
    APP_ENV: 'VITE_APP_ENV',
  }),
});
```

## Common Schemas

Reusable validation schemas for common patterns:

```typescript
import { commonEnvSchemas } from '@repo/config';

const schema = z.object({
  // String with optional default
  API_KEY: commonEnvSchemas.string('default-key'),

  // Required string
  DATABASE_URL: commonEnvSchemas.string(),

  // Number (coerced from string)
  PORT: commonEnvSchemas.number(3000),

  // Boolean (coerced from string)
  DEBUG: commonEnvSchemas.boolean(false),

  // Valid port number (1-65535)
  API_PORT: commonEnvSchemas.port(3000),

  // Valid URL
  API_URL: commonEnvSchemas.url('http://localhost:3000'),

  // Enum
  LOG_LEVEL: commonEnvSchemas.enum(['debug', 'info', 'warn', 'error'], 'info'),
});
```

## Configuration Sections

Pre-configured sections for common use cases:

### Main Configuration

```typescript
import { mainConfig } from '@repo/config';

const config = mainConfig();
// {
//   API_PORT: number;
//   API_HOST: string;
//   API_URL: string;
//   CORS: {
//     allowedOrigins: string[];
//   };
// }
```

### Database Configuration

```typescript
import { dbConfig } from '@repo/config';

const config = dbConfig();
// {
//   DATABASE_URL: string;
//   poolMin: number;
//   poolMax: number;
// }
```

### Logger Configuration

```typescript
import { loggerConfig } from '@repo/config';

const config = loggerConfig();
// {
//   level: 'debug' | 'info' | 'warn' | 'error';
//   format: 'json' | 'pretty';
//   enabled: boolean;
// }
```

### Exchange Rate Configuration

```typescript
import { parseExchangeRateSchema } from '@repo/config';

const config = parseExchangeRateSchema(process.env);
// {
//   HOSPEDA_EXCHANGE_RATE_API_KEY?: string;
//   HOSPEDA_DOLAR_API_BASE_URL: string;
//   HOSPEDA_EXCHANGE_RATE_API_BASE_URL: string;
// }
```

## Error Handling

### EnvValidationError

Thrown when environment validation fails:

```typescript
import { EnvValidationError } from '@repo/config';

try {
  validateEnv(schema, 'App');
} catch (error) {
  if (error instanceof EnvValidationError) {
    console.error('Validation failed:', error.context);
    console.error('Issues:', error.issues);
  }
}
```

Error structure:

```typescript
{
  name: 'EnvValidationError',
  message: 'Environment validation failed for App configuration',
  context: 'App',
  issues: [
    {
      path: ['API_PORT'],
      message: 'Expected number, received string',
      code: 'invalid_type',
    }
  ]
}
```

## Best Practices

1. **Validate at Startup**: Use `createStartupValidator` for required configuration
2. **Use Common Schemas**: Leverage `commonEnvSchemas` for consistency
3. **Provide Defaults**: Always provide sensible defaults when possible
4. **Group Related Config**: Create sections for related configuration
5. **Document Variables**: Update `.env.example` when adding new variables
6. **Never Commit Secrets**: Keep `.env` files out of version control
7. **Type Safety**: Use `z.infer<typeof schema>` for TypeScript types
8. **Fail Fast**: Validate critical configuration at application startup
9. **Sanitize Errors**: Don't log sensitive values in error messages
10. **Test Configuration**: Mock env vars in tests with `vi.stubEnv()`

## Environment Variables

All environment variables used in Hospeda:

### API

- `VITE_API_PORT` - API server port (default: 3000)
- `VITE_API_HOST` - API host URL (default: <http://localhost>)
- `API_CORS_ALLOWED_ORIGINS` - Comma-separated allowed origins

### Database

- `DATABASE_URL` - PostgreSQL connection string (required)
- `DB_POOL_MIN` - Minimum pool connections (default: 2)
- `DB_POOL_MAX` - Maximum pool connections (default: 10)

### Logger

- `LOG_LEVEL` - Log level: debug|info|warn|error (default: info)
- `LOG_FORMAT` - Log format: json|pretty (default: json)
- `LOG_ENABLED` - Enable logging (default: true)

### Authentication (Better Auth)

- `HOSPEDA_BETTER_AUTH_SECRET` - Better Auth secret key (required)
- `HOSPEDA_BETTER_AUTH_URL` - Better Auth URL (required)

### Payments (Mercado Pago)

- `MERCADOPAGO_ACCESS_TOKEN` - Mercado Pago access token (required)
- `MERCADOPAGO_PUBLIC_KEY` - Mercado Pago public key (required)

### Services

- `CLOUDINARY_CLOUD_NAME` - Cloudinary cloud name (required)
- `CLOUDINARY_API_KEY` - Cloudinary API key (required)
- `CLOUDINARY_API_SECRET` - Cloudinary API secret (required)

### Exchange Rate APIs

- `HOSPEDA_EXCHANGE_RATE_API_KEY` - ExchangeRate-API key (optional for dev)
- `HOSPEDA_DOLAR_API_BASE_URL` - DolarApi.com base URL (default: <https://dolarapi.com/v1>)
- `HOSPEDA_EXCHANGE_RATE_API_BASE_URL` - ExchangeRate-API base URL (default: <https://v6.exchangerate-api.com/v6>)

## Testing

Mock environment variables in tests:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validateEnv } from '@repo/config';
import { z } from 'zod';

describe('Config', () => {
  beforeEach(() => {
    vi.stubEnv('API_PORT', '3000');
    vi.stubEnv('API_HOST', 'http://localhost');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should validate configuration', () => {
    const schema = z.object({
      API_PORT: z.coerce.number(),
      API_HOST: z.string().url(),
    });

    const config = validateEnv(schema, 'Test');

    expect(config.API_PORT).toBe(3000);
    expect(config.API_HOST).toBe('http://localhost');
  });
});
```

## Documentation

📚 **[Complete Documentation](./docs/README.md)** - Comprehensive guides, API reference, and examples

**Quick Links**:

- [Quick Start Guide](./docs/quick-start.md) - Get started in 5 minutes
- [Config Reference](./docs/api/config-reference.md) - All configuration options
- [Environment Variables](./docs/api/env-vars.md) - Complete env var list
- [Security Best Practices](./docs/guides/security.md) - Secure config handling

## License

MIT
