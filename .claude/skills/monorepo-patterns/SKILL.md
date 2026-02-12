---
name: monorepo-patterns
description: Monorepo architecture patterns with modern tooling. Use when setting up Turborepo, pnpm workspaces, Nx, or managing shared packages.
---

# Monorepo Patterns

## Purpose

Guide architecture decisions for monorepo setups using modern tooling. Covers Turborepo, pnpm workspaces, Nx, shared packages, build caching, dependency management, and scaling strategies.

## Activation

Use this skill when the user asks about:

- Setting up a monorepo
- Configuring workspaces (pnpm, npm, yarn)
- Turborepo or Nx configuration
- Sharing code between packages
- Build caching and optimization
- Dependency management across packages
- CI/CD for monorepos

## Project Structure

### Recommended Layout

```
monorepo/
├── apps/
│   ├── web/                 # Next.js frontend
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   ├── api/                 # Express/Fastify backend
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   └── docs/                # Documentation site
│       ├── package.json
│       └── src/
├── packages/
│   ├── ui/                  # Shared React components
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   ├── config-eslint/       # Shared ESLint config
│   │   ├── package.json
│   │   └── index.js
│   ├── config-typescript/   # Shared TSConfig
│   │   ├── package.json
│   │   ├── base.json
│   │   ├── nextjs.json
│   │   └── node.json
│   ├── shared/              # Shared utilities and types
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   └── database/            # Prisma schema and client
│       ├── package.json
│       ├── prisma/
│       └── src/
├── tooling/
│   ├── scripts/             # Shared build/deploy scripts
│   └── docker/              # Shared Dockerfiles
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── .npmrc
└── tsconfig.json
```

## pnpm Workspaces

### pnpm-workspace.yaml

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "tooling/*"
```

### Root package.json

```json
{
  "name": "monorepo",
  "private": true,
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev",
    "lint": "turbo lint",
    "test": "turbo test",
    "typecheck": "turbo typecheck",
    "clean": "turbo clean",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,md,json}\""
  },
  "devDependencies": {
    "prettier": "^3.0.0",
    "turbo": "^2.0.0"
  },
  "packageManager": "pnpm@9.0.0",
  "engines": {
    "node": ">=20.0.0"
  }
}
```

### .npmrc

```ini
auto-install-peers=true
strict-peer-dependencies=false
link-workspace-packages=true
```

### Internal Package References

In a consuming package's `package.json`:

```json
{
  "dependencies": {
    "@repo/ui": "workspace:*",
    "@repo/shared": "workspace:*",
    "@repo/database": "workspace:*"
  }
}
```

## Turborepo Configuration

### turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [
    "**/.env.*local",
    "**/.env"
  ],
  "globalEnv": [
    "NODE_ENV",
    "CI"
  ],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "tsconfig.json", "package.json"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"],
      "env": ["DATABASE_URL", "NEXT_PUBLIC_*"]
    },
    "dev": {
      "dependsOn": ["^build"],
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", ".eslintrc*", "eslint.config.*"]
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "tsconfig.json"]
    },
    "test": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "tests/**", "vitest.config.*"],
      "outputs": ["coverage/**"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

### Key Concepts

- **`^build`** means "run build in all dependencies first" (topological ordering)
- **`inputs`** define what files affect the cache hash
- **`outputs`** define what gets cached
- **`persistent`** marks long-running tasks like dev servers
- **`cache: false`** disables caching for tasks with side effects

### Filtering

```bash
# Run only for a specific package
turbo build --filter=@repo/web

# Run for a package and its dependencies
turbo build --filter=@repo/web...

# Run for packages that changed since main
turbo build --filter=[main]

# Run for packages in apps/ directory
turbo build --filter=./apps/*

# Combine filters
turbo build --filter=@repo/web... --filter=!@repo/docs
```

## Shared Package Patterns

### Shared TypeScript Config

`packages/config-typescript/base.json`:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "exclude": ["node_modules", "dist"]
}
```

`packages/config-typescript/nextjs.json`:

```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "ES2022"],
    "module": "ESNext",
    "jsx": "preserve",
    "plugins": [{ "name": "next" }],
    "noEmit": true
  }
}
```

### Shared UI Package

`packages/ui/package.json`:

```json
{
  "name": "@repo/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./button": {
      "types": "./dist/components/button.d.ts",
      "import": "./dist/components/button.js"
    }
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@repo/config-typescript": "workspace:*",
    "tsup": "^8.0.0",
    "typescript": "^5.5.0"
  }
}
```

`packages/ui/tsup.config.ts`:

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/components/*.tsx"],
  format: ["esm"],
  dts: true,
  splitting: true,
  clean: true,
  external: ["react", "react-dom"],
});
```

### Shared Utilities Package

`packages/shared/package.json`:

```json
{
  "name": "@repo/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./types": {
      "types": "./dist/types/index.d.ts",
      "import": "./dist/types/index.js"
    },
    "./utils": {
      "types": "./dist/utils/index.d.ts",
      "import": "./dist/utils/index.js"
    }
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch"
  }
}
```

## Build Caching

### Remote Caching with Vercel

```bash
# Login to Vercel remote cache
npx turbo login
npx turbo link
```

Or via environment variables in CI:

```bash
TURBO_TOKEN=your_token
TURBO_TEAM=your_team
```

### Custom Remote Cache

In `turbo.json`:

```json
{
  "remoteCache": {
    "enabled": true,
    "signature": true
  }
}
```

### Cache Debugging

```bash
# Check what turbo will run (dry run)
turbo build --dry-run

# Show verbose output for cache hits/misses
turbo build --verbosity=2

# Force ignore cache
turbo build --force

# Show task graph
turbo build --graph
```

## Dependency Management

### Version Alignment

Use `pnpm` catalog feature or `syncpack` to keep versions aligned:

`pnpm-workspace.yaml` with catalog:

```yaml
packages:
  - "apps/*"
  - "packages/*"

catalog:
  react: "^18.3.0"
  react-dom: "^18.3.0"
  typescript: "^5.5.0"
  vitest: "^2.0.0"
  zod: "^3.23.0"
```

Then in any `package.json`:

```json
{
  "dependencies": {
    "react": "catalog:",
    "react-dom": "catalog:"
  }
}
```

### Dependency Rules

1. **Shared dependencies** go in root only if they are dev tools (prettier, turbo)
2. **Each package declares its own dependencies** - never rely on hoisting
3. **Internal packages use `workspace:*`** for linking
4. **Pin exact versions** for critical dependencies in production apps
5. **Use `peerDependencies`** for shared libraries that consumers must provide (React, etc.)

## Scaling Patterns

### When the Monorepo Grows

| Scale | Strategy |
|---|---|
| < 10 packages | Standard Turborepo setup |
| 10-50 packages | Add remote caching, strict task inputs |
| 50-200 packages | Consider Nx for fine-grained caching |
| 200+ packages | Custom tooling, Bazel, or split into multiple repos |

### Code Ownership

Use `CODEOWNERS` to assign package owners:

```
# .github/CODEOWNERS
/apps/web/          @frontend-team
/apps/api/          @backend-team
/packages/ui/       @design-system-team
/packages/shared/   @platform-team
/packages/database/ @backend-team
```

### Common Mistakes

| Mistake | Impact | Fix |
|---|---|---|
| No `inputs` in turbo.json | Caching is ineffective | Define precise inputs per task |
| Importing from `src/` of other packages | Fragile, no build step | Use `exports` field and built output |
| Shared `node_modules` assumptions | Works locally, fails in CI | Each package declares its deps |
| No `.npmrc` config | Phantom dependencies | Set `strict-peer-dependencies` |
| Giant shared package | Everything depends on everything | Split into focused packages |
| No typecheck task | Type errors caught late | Add `typecheck` to pipeline |
