---
name: env-validation
description: Environment variable validation and typing patterns. Use when managing .env files, ensuring type-safe env access, or catching missing variables at startup.
---

# Environment Variable Validation

## Purpose

Patterns for validating, typing, and managing environment variables. Ensures type-safe env access, catches missing variables at startup, and provides structured .env file management.

## Activation

Use this skill when the user asks about:

- Validating environment variables
- Type-safe env access in TypeScript
- .env file setup and management
- Required vs optional environment variables
- Environment configuration patterns
- Runtime env validation with Zod or similar

## Zod-Based Env Validation

### Basic Setup

```typescript
// src/env.ts
import { z } from "zod";

const envSchema = z.object({
  // Node
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Server
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default("0.0.0.0"),

  // Database
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_SIZE: z.coerce.number().int().positive().default(10),

  // Auth
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("7d"),

  // External Services
  REDIS_URL: z.string().url().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  // Feature Flags
  ENABLE_SIGNUP: z.coerce.boolean().default(true),
  ENABLE_OAUTH: z.coerce.boolean().default(false),

  // Logging
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

// Validate at module load time
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

// Export type for use in other modules
export type Env = z.infer<typeof envSchema>;
```

### Usage

```typescript
import { env } from "./env";

// Fully typed, validated access
const server = createServer({
  port: env.PORT,         // number (not string)
  host: env.HOST,         // string
});

if (env.ENABLE_OAUTH) {  // boolean (not string "true")
  setupOAuth();
}

// TypeScript will error on:
// env.NONEXISTENT_VAR    // Property does not exist
// env.PORT.split(",")    // PORT is number, not string
```

## Next.js Env Validation (T3 Pattern)

### Client and Server Split

```typescript
// src/env.ts
import { z } from "zod";

// Server-side env schema (never exposed to client)
const serverSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  SMTP_HOST: z.string(),
  REDIS_URL: z.string().url().optional(),
});

// Client-side env schema (NEXT_PUBLIC_ prefix required)
const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith("pk_"),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_ENABLE_ANALYTICS: z.coerce.boolean().default(false),
});

// Merge for full validation
const envSchema = serverSchema.merge(clientSchema);

// Only validate server vars on the server
const isServer = typeof window === "undefined";

const parsed = envSchema.safeParse(
  isServer
    ? process.env
    : // On client, only NEXT_PUBLIC_ vars are available
      Object.fromEntries(
        Object.entries(process.env).filter(([key]) =>
          key.startsWith("NEXT_PUBLIC_")
        )
      )
);

if (!parsed.success) {
  const errors = parsed.error.flatten().fieldErrors;
  const message = Object.entries(errors)
    .map(([key, msgs]) => `  ${key}: ${msgs?.join(", ")}`)
    .join("\n");
  throw new Error(`Environment validation failed:\n${message}`);
}

export const env = parsed.data;
```

### Alternative: @t3-oss/env-nextjs

```typescript
// src/env.ts
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    JWT_SECRET: z.string().min(32),
    NODE_ENV: z.enum(["development", "production", "test"]),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
    NEXT_PUBLIC_API_URL: z.string().url(),
  },
  // Destructure all env vars for bundler
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  // Skip validation in certain scenarios
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  // Make empty strings treated as undefined
  emptyStringAsUndefined: true,
});
```

## .env File Management

### File Hierarchy

```
project/
├── .env                    # Shared defaults (committed, no secrets)
├── .env.local              # Local overrides (gitignored, secrets)
├── .env.development        # Development defaults (committed)
├── .env.development.local  # Local dev overrides (gitignored)
├── .env.production         # Production defaults (committed)
├── .env.production.local   # Local prod overrides (gitignored)
├── .env.test               # Test defaults (committed)
├── .env.example            # Template with all vars documented (committed)
└── .gitignore
```

### Loading Priority (Next.js convention)

1. `.env.{NODE_ENV}.local` (highest priority)
2. `.env.local` (not loaded in test)
3. `.env.{NODE_ENV}`
4. `.env` (lowest priority)

### .env.example Template

```bash
# .env.example - Copy to .env.local and fill in values
# DO NOT put real secrets in this file

# ===================
# Server
# ===================
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

# ===================
# Database
# ===================
# PostgreSQL connection string
DATABASE_URL=postgresql://user:password@localhost:5432/myapp
DATABASE_POOL_SIZE=10

# ===================
# Authentication
# ===================
# Minimum 32 characters, generate with: openssl rand -base64 32
JWT_SECRET=
JWT_EXPIRES_IN=7d

# ===================
# External Services (optional)
# ===================
REDIS_URL=redis://localhost:6379

# Stripe
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Email (SMTP)
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# ===================
# Feature Flags
# ===================
ENABLE_SIGNUP=true
ENABLE_OAUTH=false

# ===================
# Client-side (NEXT_PUBLIC_)
# ===================
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_ENABLE_ANALYTICS=false
```

### .gitignore Rules

```gitignore
# Environment files with secrets
.env.local
.env.*.local
.env.development.local
.env.production.local
.env.test.local

# Never ignore these (safe defaults, no secrets)
# .env
# .env.example
# .env.development
# .env.production
# .env.test
```

## Validation Patterns

### Boolean Coercion

Environment variables are always strings. Handle boolean coercion explicitly:

```typescript
// Zod coercion handles: "true", "1", "yes" -> true
const BooleanEnv = z
  .string()
  .transform((val) => {
    const truthy = ["true", "1", "yes", "on"];
    const falsy = ["false", "0", "no", "off", ""];
    const lower = val.toLowerCase();
    if (truthy.includes(lower)) return true;
    if (falsy.includes(lower)) return false;
    throw new Error(`Invalid boolean: ${val}`);
  });

// Or use z.coerce.boolean() for simple cases
// "true" -> true, everything else -> false
```

### URL Validation with Defaults

```typescript
const DatabaseUrl = z.string().url().refine(
  (url) => url.startsWith("postgresql://") || url.startsWith("postgres://"),
  { message: "Must be a PostgreSQL connection string" }
);

const RedisUrl = z.string().url().refine(
  (url) => url.startsWith("redis://") || url.startsWith("rediss://"),
  { message: "Must be a Redis connection string" }
);
```

### Conditional Requirements

```typescript
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  DATABASE_URL: z.string().url(),

  // Only required in production
  SENTRY_DSN: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
}).refine(
  (env) => {
    if (env.NODE_ENV === "production") {
      return !!env.SENTRY_DSN && !!env.REDIS_URL;
    }
    return true;
  },
  {
    message: "SENTRY_DSN and REDIS_URL are required in production",
  }
);
```

### Grouped Validation

```typescript
// SMTP: either all fields or none
const SmtpSchema = z.union([
  z.object({
    SMTP_HOST: z.string(),
    SMTP_PORT: z.coerce.number(),
    SMTP_USER: z.string(),
    SMTP_PASS: z.string(),
  }),
  z.object({
    SMTP_HOST: z.undefined(),
    SMTP_PORT: z.undefined(),
    SMTP_USER: z.undefined(),
    SMTP_PASS: z.undefined(),
  }),
]);
```

## Startup Validation Pattern

```typescript
// src/env.ts
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number().default(3000),
});

function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues.map((issue) => {
      const path = issue.path.join(".");
      return `  - ${path}: ${issue.message}`;
    });

    console.error("\n========================================");
    console.error(" ENVIRONMENT VALIDATION FAILED");
    console.error("========================================");
    console.error(formatted.join("\n"));
    console.error("\nCheck your .env.local file against .env.example");
    console.error("========================================\n");

    process.exit(1);
  }

  return result.data;
}

export const env = validateEnv();
```

## Best Practices

1. **Validate at startup** - Fail fast with clear error messages, not at runtime when a var is first accessed
2. **Use `.env.example`** - Document all variables with descriptions and safe placeholder values
3. **Never commit secrets** - Only `.env.example` and non-secret defaults belong in git
4. **Use `z.coerce`** - Environment variables are always strings; coerce to proper types
5. **Split client/server** - In Next.js, enforce `NEXT_PUBLIC_` prefix for client-safe variables
6. **Group related vars** - Validate that related variables (like SMTP config) are provided together
7. **Default wisely** - Provide defaults for development but require explicit values in production
8. **Type the export** - Export both the validated object and its TypeScript type
9. **No `process.env` elsewhere** - Import from your `env.ts` module exclusively
10. **Handle empty strings** - Treat `""` the same as undefined for optional variables
