# Quick Start Guide - @repo/config

Get started with `@repo/config` in 5 minutes. This guide covers the essentials you need to start using type-safe configuration in Hospeda.

## What You'll Learn

1. Understanding the config package
2. Defining your first environment variable
3. Validating configuration at startup
4. Accessing configuration in code
5. Type-safe usage patterns
6. Testing with mocked configuration

## Prerequisites

- Node.js 20+ installed
- TypeScript basics
- Zod schema knowledge (helpful but not required)

## Step 1: Understanding the Config Package

`@repo/config` provides type-safe environment variable management for Hospeda. It uses Zod schemas to validate, parse, and provide typed access to configuration.

**Key Concepts:**

- **Environment Variables**: Raw strings from `process.env`
- **Schemas**: Zod schemas defining validation rules
- **Configuration**: Validated, typed, parsed objects
- **Startup Validators**: Fail-fast validators for critical config

## Step 2: Define Your First Environment Variable

Let's add a new feature flag to the API configuration.

### 2.1. Update the Schema

Open `packages/config/src/sections/main.schema.ts`:

```typescript
import { z } from 'zod';
import { commonEnvSchemas } from '../utils.js';

export const mainSchema = z.object({
  // Existing configuration
  VITE_API_PORT: commonEnvSchemas.port(3000),
  VITE_API_HOST: commonEnvSchemas.string('http://localhost'),
  API_CORS_ALLOWED_ORIGINS: commonEnvSchemas.string('http://localhost:4321'),

  // New feature flag
  FEATURE_EMAIL_ENABLED: commonEnvSchemas.boolean(false),
});

export type MainConfig = z.infer<typeof mainSchema>;
```

**What's happening:**

- `commonEnvSchemas.boolean(false)` creates a boolean schema with default `false`
- Accepts "true", "1", "yes" (case-insensitive) as `true`
- Returns `false` for any other value or if not set

### 2.2. Add to Environment File

Add to `.env.local` (or `.env.example` for documentation):

```bash
# Feature Flags
FEATURE_EMAIL_ENABLED=true
```

### 2.3. Test the Schema

Create a test file `packages/config/test/sections/main.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseMainConfig } from '../../src/sections/main.schema.js';

describe('Main Config', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_PORT', '3000');
    vi.stubEnv('VITE_API_HOST', 'http://localhost');
    vi.stubEnv('API_CORS_ALLOWED_ORIGINS', 'http://localhost:4321');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should parse email feature flag as boolean', () => {
    vi.stubEnv('FEATURE_EMAIL_ENABLED', 'true');

    const config = parseMainConfig();

    expect(config.FEATURE_EMAIL_ENABLED).toBe(true);
  });

  it('should use default value when not set', () => {
    const config = parseMainConfig();

    expect(config.FEATURE_EMAIL_ENABLED).toBe(false);
  });
});
```

**Run the test:**

```bash
cd packages/config
pnpm test
```

## Step 3: Validate Configuration at Startup

Ensure critical configuration is valid before the application starts.

### 3.1. Create Startup Validator

In your API entry point `apps/api/src/index.ts`:

```typescript
import { createStartupValidator, mainSchema } from '@repo/config';

// Create validator that exits on failure
const validateMainConfig = createStartupValidator(mainSchema, 'API');

// Validate configuration (exits if invalid)
const config = validateMainConfig();

console.log('Configuration validated successfully');
console.log('Email feature enabled:', config.FEATURE_EMAIL_ENABLED);

// Continue with application startup
```

**What's happening:**

1. `createStartupValidator()` creates a validator function
2. Calling `validateMainConfig()` validates environment variables
3. If validation fails, process exits with code 1
4. If successful, returns typed configuration object

### 3.2. Test Invalid Configuration

Try running with an invalid port:

```bash
VITE_API_PORT=invalid pnpm --filter=api start
```

**Expected output:**

```
❌ Environment validation failed for API configuration

Issues:
  - VITE_API_PORT: Expected number, received NaN

Fix the configuration and try again.
```

### 3.3. Test Valid Configuration

```bash
VITE_API_PORT=3000 pnpm --filter=api start
```

**Expected output:**

```
✅ Configuration validated successfully
Email feature enabled: false
```

## Step 4: Access Configuration in Code

Use configuration in services, controllers, and routes.

### 4.1. In a Service

```typescript
// apps/api/src/services/email.service.ts
import { mainConfig } from '@repo/config';

export class EmailService {
  private readonly config = mainConfig();

  async sendWelcomeEmail(to: string): Promise<void> {
    // Check feature flag
    if (!this.config.FEATURE_EMAIL_ENABLED) {
      console.log('Email feature disabled, skipping');
      return;
    }

    // Send email
    await this.send({
      to,
      subject: 'Welcome to Hospeda',
      body: 'Thanks for joining!',
    });
  }

  private async send(params: {
    to: string;
    subject: string;
    body: string;
  }): Promise<void> {
    // Email sending logic
  }
}
```

### 4.2. In a Controller/Route

```typescript
// apps/api/src/routes/health.route.ts
import { Hono } from 'hono';
import { mainConfig } from '@repo/config';

const app = new Hono();

app.get('/health', (c) => {
  const config = mainConfig();

  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    features: {
      email: config.FEATURE_EMAIL_ENABLED,
    },
  });
});

export { app as healthRouter };
```

### 4.3. Conditional Logic

```typescript
import { mainConfig } from '@repo/config';

const config = mainConfig();

// Conditional feature initialization
if (config.FEATURE_EMAIL_ENABLED) {
  await emailService.initialize();
  console.log('Email service initialized');
} else {
  console.log('Email service disabled');
}
```

## Step 5: Type-Safe Usage Patterns

Leverage TypeScript for type safety and autocomplete.

### 5.1. Type Inference

Types are automatically inferred from schemas:

```typescript
import { z } from 'zod';

const mySchema = z.object({
  PORT: z.coerce.number(),
  HOST: z.string().url(),
  DEBUG: z.coerce.boolean(),
});

// Type is automatically inferred
type MyConfig = z.infer<typeof mySchema>;
// {
//   PORT: number;
//   HOST: string;
//   DEBUG: boolean;
// }

const config: MyConfig = validateEnv(mySchema, 'My');
```

### 5.2. Autocomplete

With proper types, you get IDE autocomplete:

```typescript
const config = mainConfig();

// Autocomplete suggests all properties
config.FEATURE_EMAIL_ENABLED; // ✅ boolean
config.VITE_API_PORT; // ✅ number
config.VITE_API_HOST; // ✅ string

// TypeScript catches typos
config.FEATURE_EMAIL_ENABLD; // ❌ Property does not exist
```

### 5.3. Type Guards

Handle optional configuration safely:

```typescript
const config = mainConfig();

// Type guard for optional config
if (config.OPTIONAL_FEATURE) {
  // TypeScript knows OPTIONAL_FEATURE is defined here
  console.log('Feature enabled:', config.OPTIONAL_FEATURE);
}
```

## Step 6: Testing with Mocked Configuration

Test components that depend on configuration.

### 6.1. Basic Test Setup

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EmailService } from '../services/email.service.js';

describe('EmailService', () => {
  beforeEach(() => {
    // Mock required environment variables
    vi.stubEnv('VITE_API_PORT', '3000');
    vi.stubEnv('VITE_API_HOST', 'http://localhost');
    vi.stubEnv('API_CORS_ALLOWED_ORIGINS', 'http://localhost:4321');
  });

  afterEach(() => {
    // Clean up mocks
    vi.unstubAllEnvs();
  });

  it('should send email when feature is enabled', async () => {
    // Enable feature for this test
    vi.stubEnv('FEATURE_EMAIL_ENABLED', 'true');

    const service = new EmailService();
    await service.sendWelcomeEmail('user@example.com');

    // Assert email was sent
  });

  it('should skip email when feature is disabled', async () => {
    // Feature disabled (default)
    const service = new EmailService();
    await service.sendWelcomeEmail('user@example.com');

    // Assert email was NOT sent
  });
});
```

### 6.2. Testing Different Environments

```typescript
describe('Config in different environments', () => {
  it('should use production settings', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VITE_API_HOST', 'https://api.hospeda.com');
    vi.stubEnv('VITE_API_PORT', '443');

    const config = mainConfig();

    expect(config.VITE_API_HOST).toBe('https://api.hospeda.com');
    expect(config.VITE_API_PORT).toBe(443);
  });

  it('should use development settings', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('VITE_API_HOST', 'http://localhost');
    vi.stubEnv('VITE_API_PORT', '3000');

    const config = mainConfig();

    expect(config.VITE_API_HOST).toBe('http://localhost');
    expect(config.VITE_API_PORT).toBe(3000);
  });
});
```

### 6.3. Testing Validation Errors

```typescript
import { validateEnv, EnvValidationError } from '@repo/config';
import { z } from 'zod';

describe('Config validation', () => {
  it('should throw error for invalid port', () => {
    vi.stubEnv('VITE_API_PORT', 'invalid');

    const schema = z.object({
      VITE_API_PORT: z.coerce.number(),
    });

    expect(() => {
      validateEnv(schema, 'Test');
    }).toThrow(EnvValidationError);
  });

  it('should provide detailed error message', () => {
    vi.stubEnv('VITE_API_PORT', '-1');

    const schema = z.object({
      VITE_API_PORT: z.coerce.number().int().positive(),
    });

    try {
      validateEnv(schema, 'Test');
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      expect(error.context).toBe('Test');
      expect(error.issues).toHaveLength(1);
    }
  });
});
```

## Complete Example: Adding Email Configuration

Let's add a complete email configuration section from scratch.

### Step 1: Create Schema

Create `packages/config/src/sections/email.schema.ts`:

```typescript
import { z } from 'zod';
import { validateEnv } from '../env.js';
import { commonEnvSchemas } from '../utils.js';

export const emailSchema = z.object({
  EMAIL_HOST: commonEnvSchemas.string('smtp.gmail.com'),
  EMAIL_PORT: commonEnvSchemas.port(587),
  EMAIL_USER: z.string().email(),
  EMAIL_PASS: z.string().min(1),
  EMAIL_FROM: z.string().email(),
  EMAIL_ENABLED: commonEnvSchemas.boolean(false),
});

export type EmailConfig = z.infer<typeof emailSchema>;

export function parseEmailConfig(): EmailConfig {
  return validateEnv(emailSchema, 'Email');
}
```

### Step 2: Create Client

Create `packages/config/src/sections/email.client.ts`:

```typescript
import type { EmailConfig } from './email.schema.js';
import { parseEmailConfig } from './email.schema.js';

let cachedConfig: EmailConfig | null = null;

export function emailConfig(): EmailConfig {
  if (!cachedConfig) {
    cachedConfig = parseEmailConfig();
  }
  return cachedConfig;
}

export function isEmailEnabled(): boolean {
  return emailConfig().EMAIL_ENABLED;
}
```

### Step 3: Export from Index

Update `packages/config/src/index.ts`:

```typescript
// Existing exports
export * from './env.js';
export * from './client.js';
export * from './utils.js';

// Configuration sections
export * from './sections/main.schema.js';
export * from './sections/main.client.js';
export * from './sections/db.schema.js';
export * from './sections/logger.schema.js';
export * from './sections/logger.client.js';

// New email section
export * from './sections/email.schema.js';
export * from './sections/email.client.js';
```

### Step 4: Add Environment Variables

Update `.env.local`:

```bash
# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=noreply@hospeda.com
EMAIL_PASS=your-app-password-here
EMAIL_FROM=noreply@hospeda.com
EMAIL_ENABLED=true
```

### Step 5: Use in Service

```typescript
// apps/api/src/services/email.service.ts
import { emailConfig, isEmailEnabled } from '@repo/config';
import nodemailer from 'nodemailer';

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    if (isEmailEnabled()) {
      this.initializeTransporter();
    }
  }

  private initializeTransporter(): void {
    const config = emailConfig();

    this.transporter = nodemailer.createTransport({
      host: config.EMAIL_HOST,
      port: config.EMAIL_PORT,
      auth: {
        user: config.EMAIL_USER,
        pass: config.EMAIL_PASS,
      },
    });
  }

  async sendEmail(params: {
    to: string;
    subject: string;
    html: string;
  }): Promise<void> {
    if (!isEmailEnabled()) {
      console.log('Email disabled, skipping');
      return;
    }

    const config = emailConfig();

    await this.transporter?.sendMail({
      from: config.EMAIL_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
  }
}
```

### Step 6: Test

```typescript
// packages/config/test/sections/email.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseEmailConfig } from '../../src/sections/email.schema.js';
import { emailConfig, isEmailEnabled } from '../../src/sections/email.client.js';

describe('Email Config', () => {
  beforeEach(() => {
    vi.stubEnv('EMAIL_HOST', 'smtp.test.com');
    vi.stubEnv('EMAIL_PORT', '587');
    vi.stubEnv('EMAIL_USER', 'test@test.com');
    vi.stubEnv('EMAIL_PASS', 'password');
    vi.stubEnv('EMAIL_FROM', 'noreply@test.com');
    vi.stubEnv('EMAIL_ENABLED', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should parse email configuration', () => {
    const config = parseEmailConfig();

    expect(config.EMAIL_HOST).toBe('smtp.test.com');
    expect(config.EMAIL_PORT).toBe(587);
    expect(config.EMAIL_USER).toBe('test@test.com');
    expect(config.EMAIL_ENABLED).toBe(true);
  });

  it('should check if email is enabled', () => {
    expect(isEmailEnabled()).toBe(true);

    vi.stubEnv('EMAIL_ENABLED', 'false');
    expect(isEmailEnabled()).toBe(false);
  });
});
```

## Next Steps

Now that you understand the basics:

1. **Explore API Reference**: [api/config-reference.md](./api/config-reference.md)
2. **Learn Validation Patterns**: [guides/validation.md](./guides/validation.md)
3. **Security Best Practices**: [guides/security.md](./guides/security.md)
4. **Environment Management**: [guides/environments.md](./guides/environments.md)

## Common Patterns

### Pattern 1: Optional Configuration

```typescript
const schema = z.object({
  OPTIONAL_VAR: z.string().optional(),
  WITH_DEFAULT: z.string().default('default-value'),
});
```

### Pattern 2: Transformed Values

```typescript
const schema = z.object({
  CORS_ORIGINS: z
    .string()
    .transform((val) => val.split(',').map((s) => s.trim())),
});
```

### Pattern 3: Refined Validation

```typescript
const schema = z.object({
  TIMEOUT: z.coerce
    .number()
    .refine((n) => n >= 1000, {
      message: 'Timeout must be at least 1000ms',
    }),
});
```

### Pattern 4: Conditional Configuration

```typescript
const config = mainConfig();

if (config.FEATURE_ENABLED) {
  // Initialize feature
}
```

## Troubleshooting

### Issue: Validation fails at startup

**Solution**: Check environment variables match schema requirements.

```bash
# Check variable is set
echo $VITE_API_PORT

# Verify value is valid
VITE_API_PORT=3000  # Must be a number
```

### Issue: Type errors

**Solution**: Ensure schema and type are in sync.

```typescript
// Schema defines property
const schema = z.object({
  MY_VAR: z.string(),
});

// Type is inferred
type Config = z.infer<typeof schema>;
```

### Issue: Can't access env var in frontend

**Solution**: Prefix with `VITE_` and restart dev server.

```bash
# In .env.local
VITE_API_URL=http://localhost:3000

# Restart dev server
pnpm dev
```

## Resources

- **[Full Documentation](./README.md)** - Complete reference
- **[API Reference](./api/config-reference.md)** - All functions and types
- **[Environment Variables](./api/env-vars.md)** - Complete list
- **[Examples](./examples/)** - More code examples

## Support

Need help? Check our documentation or ask in GitHub Discussions.

- **Documentation**: [packages/config/docs](.)
- **Issues**: [GitHub Issues](https://github.com/hospeda/hospeda/issues)
- **Discussions**: [GitHub Discussions](https://github.com/hospeda/hospeda/discussions)
