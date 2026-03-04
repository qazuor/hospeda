# CLAUDE.md - Config Package

> Main docs: See [README.md](./README.md)
> Project docs: See [root CLAUDE.md](../../CLAUDE.md)

## Overview

Shared configuration constants and environment variable schemas used by all apps in the monorepo. Provides a single source of truth for environment validation, feature flags, and application settings.

## Key Files

```
src/
├── index.ts       # Package entry point (re-exports)
├── env.ts         # Environment variable schemas (Zod)
├── env.test.ts    # Environment validation tests
├── client.ts      # Client-safe config (PUBLIC_* vars only)
├── utils.ts       # Config utility functions
├── sections/      # Section-specific configuration
└── vite-env.d.ts  # Vite environment type declarations
```

## Usage

```typescript
import { getServerConfig, getClientConfig } from '@repo/config';

// Server-side (all env vars available)
const config = getServerConfig();
console.log(config.apiUrl); // HOSPEDA_API_URL

// Client-side (only PUBLIC_* vars)
const clientConfig = getClientConfig();
console.log(clientConfig.siteUrl); // PUBLIC_SITE_URL
```

## Patterns

- All environment variables use the `HOSPEDA_` prefix for server-side vars
- Client-safe variables use the `PUBLIC_` prefix (accessible in browser)
- Zod schemas validate all environment variables at startup
- Never import server config in client-side code
- Configuration is read-only.. use `as const` and `readonly` types
- Add new env vars to both the Zod schema and `.env.example`

## Related Documentation

- `docs/deployment/environments.md` - Environment configuration per deployment target
