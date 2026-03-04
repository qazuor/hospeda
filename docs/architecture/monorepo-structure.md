# Monorepo Structure

For the directory tree and package listing, see [CLAUDE.md](../../CLAUDE.md). This document covers TurboRepo pipeline configuration, dependency strategy, and build order.

---

## TurboRepo Pipeline

### Configuration (`turbo.json`)

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "outputs": []
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    }
  }
}
```

### Key Pipeline Behaviors

- **`^build` dependency**: The `^` prefix means "build my dependencies first". When you run `turbo build` on `@repo/service-core`, TurboRepo first builds `@repo/db`, `@repo/schemas`, and `@repo/logger` because they are listed as dependencies.
- **Caching**: Build outputs are cached in `.turbo/` based on file hashes. If no source files changed, the build is skipped entirely. The `dev` task disables caching since it runs a persistent server.
- **Parallel execution**: Independent tasks run in parallel automatically. For example, `@repo/config` and `@repo/schemas` build simultaneously since neither depends on the other.
- **Persistent tasks**: Tasks marked `persistent: true` (like `dev`) run indefinitely and do not block other tasks.

---

## Build Order

```mermaid
graph TD
    CONFIG[@repo/config] --> LOGGER[@repo/logger]
    CONFIG --> SCHEMAS[@repo/schemas]

    SCHEMAS --> DB[@repo/db]
    LOGGER --> DB

    DB --> SERVICE[@repo/service-core]
    SCHEMAS --> SERVICE
    LOGGER --> SERVICE

    SERVICE --> API[api]
    SCHEMAS --> API

    SCHEMAS --> WEB[web]
    SCHEMAS --> ADMIN[admin]
```

**Build sequence**:

1. **Leaf packages** (no internal dependencies): `@repo/config`, `@repo/schemas`
2. **Second tier**: `@repo/logger` (depends on config)
3. **Third tier**: `@repo/db` (depends on schemas, logger, config)
4. **Fourth tier**: `@repo/service-core` (depends on db, schemas, logger)
5. **Apps** (depend on service-core, schemas)

If you add a new package, its position in this graph is determined by what it lists under `dependencies` in its `package.json`.

---

## Dependency Strategy

### Internal Packages

All internal packages use the `@repo/*` namespace and `workspace:*` version specifier:

```json
{
  "dependencies": {
    "@repo/db": "workspace:*",
    "@repo/schemas": "workspace:*"
  }
}
```

The `workspace:*` specifier tells pnpm to resolve the package from the local workspace rather than the npm registry. This is automatic.. no manual linking needed.

### Adding Dependencies

```bash
# Add to root (shared devDependencies like TypeScript)
pnpm add -wD <package>

# Add to specific package
pnpm add <package> --filter @repo/db

# Add internal package (edit package.json directly)
# In apps/api/package.json:
"@repo/db": "workspace:*"
```

### Dependency Rules

- **Packages never depend on apps**: `@repo/db` must not import from `apps/api`
- **Apps can depend on any package**: `apps/api` can use `@repo/db`, `@repo/schemas`, etc.
- **Avoid circular dependencies**: If A depends on B, B must not depend on A. TurboRepo will error on circular dependencies at build time.
- **Shared devDependencies go in root**: TypeScript, Vitest, and Biome configs are hoisted to the root `package.json`

### Workspace Configuration (`pnpm-workspace.yaml`)

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

---

## Import Patterns

### Barrel Exports

All packages use barrel exports (`index.ts`) to control their public API:

```typescript
// packages/db/src/index.ts
export { db } from './client';
export * from './schemas';
export * from './models';
```

This means consumers import from the package name, not internal paths:

```typescript
// From apps/api
import { accommodationService } from '@repo/service-core';
import { accommodationSchema } from '@repo/schemas';
import { db } from '@repo/db';
import { logger } from '@repo/logger';
```

### Standard Package Scripts

Each package exposes the same script interface for TurboRepo to invoke:

```json
{
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "lint": "biome check .",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "test:coverage": "vitest --coverage"
  }
}
```

---

## Next Steps

- [Architecture Overview](overview.md) - How the pieces fit together
- [Patterns](patterns.md) - Architectural patterns used across the codebase
- [Data Flow](data-flow.md) - Request lifecycle from client to database
