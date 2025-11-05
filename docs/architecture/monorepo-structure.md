# Monorepo Structure

Complete guide to Hospeda's monorepo organization using TurboRepo and pnpm workspaces.

---

## Overview

Hospeda uses a **monorepo** architecture to organize code:

- **Single repository** - All apps and packages in one place
- **Shared code** - Internal packages (`@repo/*`)
- **Atomic changes** - Update multiple apps together
- **Unified tooling** - Single set of dev tools
- **Fast builds** - TurboRepo caching

---

## Root Structure

```text
hospeda/
├── apps/                   # Applications
│   ├── api/               # Backend API (Hono)
│   ├── web/               # Public website (Astro + React)
│   └── admin/             # Admin dashboard (TanStack Start)
│
├── packages/              # Shared packages
│   ├── db/               # Database layer (Drizzle ORM)
│   ├── service-core/     # Business logic services
│   ├── schemas/          # Zod validation schemas
│   ├── utils/            # Utility functions
│   ├── logger/           # Centralized logging
│   ├── config/           # Environment configuration
│   ├── auth-ui/          # Authentication UI components
│   ├── payments/         # Payment processing (Mercado Pago)
│   └── seed/             # Database seeding
│
├── docs/                 # Project documentation
│   ├── getting-started/  # Setup guides
│   ├── architecture/     # System design docs
│   ├── guides/           # Development guides
│   └── resources/        # Additional resources
│
├── .claude/              # Claude AI configuration
│   ├── sessions/         # Feature planning sessions
│   ├── commands/         # Command definitions
│   ├── agents/           # Agent definitions
│   ├── skills/           # Skill definitions
│   └── docs/             # .claude documentation
│
├── .github/              # GitHub configuration
│   └── workflows/        # CI/CD workflows
│
├── .vscode/              # VSCode configuration
│   ├── extensions.json   # Recommended extensions
│   └── settings.json     # Workspace settings
│
├── .husky/               # Git hooks
│   └── pre-commit        # Pre-commit hook
│
├── scripts/              # Project scripts
│   └── db/               # Database management scripts
│
├── docker-compose.yml    # Local development services
├── turbo.json            # TurboRepo configuration
├── pnpm-workspace.yaml   # pnpm workspace configuration
├── package.json          # Root package.json
├── tsconfig.json         # Base TypeScript config
├── biome.json            # Biome configuration
└── .env.example          # Environment variables template
```

---

## Apps Directory

### API (`apps/api`)

**Purpose**: Backend REST API server

**Technology**: Hono + Node.js

**Structure**:

```text
apps/api/
├── src/
│   ├── index.ts                 # App entry point
│   ├── routes/                  # API routes
│   │   ├── accommodations.ts    # /api/accommodations
│   │   ├── bookings.ts          # /api/bookings
│   │   ├── auth.ts              # /api/auth
│   │   └── index.ts             # Route registration
│   ├── middleware/              # Custom middleware
│   │   ├── auth.ts              # Authentication
│   │   ├── permissions.ts       # Authorization
│   │   ├── validation.ts        # Request validation
│   │   └── error-handler.ts     # Error handling
│   └── utils/                   # API utilities
│       ├── response.ts          # Response helpers
│       └── jwt.ts               # JWT utilities
├── test/                        # API tests
│   ├── routes/                  # Route tests
│   └── middleware/              # Middleware tests
├── docs/                        # API documentation
├── package.json                 # API dependencies
└── tsconfig.json                # API TypeScript config
```

**Key Files**:

- `src/index.ts` - App initialization, middleware setup
- `src/routes/` - Route definitions using factories
- `src/middleware/` - Custom middleware (auth, permissions, validation)

**Dependencies**:

```json
{
  "dependencies": {
    "hono": "^4.x",
    "@hono/node-server": "^1.x",
    "@repo/service-core": "workspace:*",
    "@repo/schemas": "workspace:*",
    "@repo/logger": "workspace:*",
    "@repo/config": "workspace:*"
  }
}
```

---

### Web (`apps/web`)

**Purpose**: Public-facing website

**Technology**: Astro + React 19 + Islands

**Structure**:

```text
apps/web/
├── src/
│   ├── pages/                   # Astro pages (routes)
│   │   ├── index.astro          # Homepage
│   │   ├── accommodations/      # Listing pages
│   │   │   ├── index.astro      # All accommodations
│   │   │   └── [id].astro       # Single accommodation
│   │   └── about.astro          # About page
│   ├── components/              # React components
│   │   ├── layout/              # Layout components
│   │   │   ├── Header.tsx       # Site header
│   │   │   ├── Footer.tsx       # Site footer
│   │   │   └── Navigation.tsx   # Main navigation
│   │   ├── ui/                  # UI components (Shadcn)
│   │   └── features/            # Feature-specific components
│   │       ├── AccommodationCard.tsx
│   │       ├── SearchBar.tsx
│   │       └── BookingForm.tsx
│   ├── layouts/                 # Astro layouts
│   │   └── BaseLayout.astro     # Base page layout
│   ├── styles/                  # Global styles
│   │   └── global.css           # Tailwind imports
│   └── lib/                     # Utilities
│       ├── api-client.ts        # API client
│       └── utils.ts             # Helper functions
├── public/                      # Static assets
│   ├── images/                  # Images
│   ├── fonts/                   # Fonts
│   └── favicon.ico              # Favicon
├── package.json                 # Web dependencies
├── tsconfig.json                # Web TypeScript config
└── astro.config.mjs             # Astro configuration
```

**Key Features**:

- **Static pages** - About, Contact (build-time)
- **SSR pages** - Accommodation details (runtime)
- **Islands** - Interactive components (SearchBar, BookingForm)
- **SEO optimized** - Meta tags, sitemaps, Open Graph

**Dependencies**:

```json
{
  "dependencies": {
    "astro": "^4.x",
    "react": "^19.x",
    "react-dom": "^19.x",
    "@astrojs/react": "^3.x",
    "@astrojs/tailwind": "^5.x",
    "@repo/schemas": "workspace:*",
    "@repo/utils": "workspace:*"
  }
}
```

---

### Admin (`apps/admin`)

**Purpose**: Administrative dashboard

**Technology**: TanStack Start + React 19

**Structure**:

```text
apps/admin/
├── src/
│   ├── routes/                  # TanStack Router routes
│   │   ├── __root.tsx           # Root layout
│   │   ├── index.tsx            # Dashboard home
│   │   ├── accommodations/      # Accommodation management
│   │   │   ├── index.tsx        # List view
│   │   │   ├── create.tsx       # Create form
│   │   │   └── $id.tsx          # Edit form
│   │   ├── bookings/            # Booking management
│   │   └── users/               # User management
│   ├── components/              # React components
│   │   ├── layout/              # Layout components
│   │   ├── forms/               # Form components
│   │   └── tables/              # Table components
│   ├── lib/                     # Utilities
│   │   ├── api-client.ts        # API client
│   │   └── query-client.ts      # TanStack Query config
│   └── styles/                  # Styles
│       └── globals.css          # Global styles
├── package.json                 # Admin dependencies
└── tsconfig.json                # Admin TypeScript config
```

**Key Features**:

- **Type-safe routing** - TanStack Router
- **Data fetching** - TanStack Query
- **Form handling** - TanStack Form
- **Server-side rendering** - SSR support

**Dependencies**:

```json
{
  "dependencies": {
    "@tanstack/react-router": "^1.x",
    "@tanstack/react-query": "^5.x",
    "@tanstack/react-form": "^0.x",
    "react": "^19.x",
    "react-dom": "^19.x",
    "@repo/schemas": "workspace:*",
    "@repo/auth-ui": "workspace:*"
  }
}
```

---

## Packages Directory

### Database (`@repo/db`)

**Purpose**: Database layer with Drizzle ORM

**Structure**:

```text
packages/db/
├── src/
│   ├── schemas/                 # Drizzle table schemas
│   │   ├── accommodation.schema.ts
│   │   ├── booking.schema.ts
│   │   ├── user.schema.ts
│   │   └── index.ts             # Export all schemas
│   ├── models/                  # Data access models
│   │   ├── base.model.ts        # BaseModel class
│   │   ├── accommodation.model.ts
│   │   ├── booking.model.ts
│   │   └── index.ts             # Export all models
│   ├── migrations/              # Drizzle migrations
│   │   └── [timestamp]_*.sql    # Migration files
│   ├── client.ts                # Database connection
│   └── index.ts                 # Package exports
├── test/                        # Database tests
│   └── models/                  # Model tests
├── drizzle.config.ts            # Drizzle configuration
├── package.json                 # DB dependencies
└── tsconfig.json                # DB TypeScript config
```

**Key Exports**:

```typescript
// Database client
export { db } from './client';

// Schemas
export * from './schemas';

// Models
export * from './models';
```

**Dependencies**:

```json
{
  "dependencies": {
    "drizzle-orm": "^0.x",
    "postgres": "^3.x",
    "@repo/schemas": "workspace:*",
    "@repo/config": "workspace:*"
  },
  "devDependencies": {
    "drizzle-kit": "^0.x"
  }
}
```

---

### Service Core (`@repo/service-core`)

**Purpose**: Business logic services

**Structure**:

```text
packages/service-core/
├── src/
│   ├── services/                # Business services
│   │   ├── base-crud.service.ts # BaseCrudService class
│   │   ├── accommodation.service.ts
│   │   ├── booking.service.ts
│   │   ├── user.service.ts
│   │   └── index.ts             # Export all services
│   └── index.ts                 # Package exports
├── test/                        # Service tests
│   └── services/                # Service unit tests
├── package.json                 # Service dependencies
└── tsconfig.json                # Service TypeScript config
```

**Key Exports**:

```typescript
// Base service
export { BaseCrudService } from './services/base-crud.service';

// Services
export * from './services';
```

**Dependencies**:

```json
{
  "dependencies": {
    "@repo/db": "workspace:*",
    "@repo/schemas": "workspace:*",
    "@repo/logger": "workspace:*",
    "zod": "^3.x"
  }
}
```

---

### Schemas (`@repo/schemas`)

**Purpose**: Zod validation schemas and types

**Structure**:

```text
packages/schemas/
├── src/
│   ├── accommodation/           # Accommodation schemas
│   │   ├── accommodation.schema.ts
│   │   ├── amenity.schema.ts
│   │   └── index.ts
│   ├── booking/                 # Booking schemas
│   │   ├── booking.schema.ts
│   │   ├── payment.schema.ts
│   │   └── index.ts
│   ├── user/                    # User schemas
│   │   ├── user.schema.ts
│   │   ├── profile.schema.ts
│   │   └── index.ts
│   ├── common/                  # Common schemas
│   │   ├── pagination.schema.ts
│   │   ├── date-range.schema.ts
│   │   └── index.ts
│   ├── permissions/             # Permission definitions
│   │   ├── actors.ts            # Actor types
│   │   ├── permissions.ts       # Permission mappings
│   │   └── index.ts
│   └── index.ts                 # Package exports
├── test/                        # Schema tests
├── package.json                 # Schema dependencies
└── tsconfig.json                # Schema TypeScript config
```

**Key Pattern**:

```typescript
// Define schema
export const accommodationSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(255),
  // ...
});

// Infer type from schema
export type Accommodation = z.infer<typeof accommodationSchema>;

// Create/Update variants
export const createAccommodationSchema = accommodationSchema.omit({ id: true });
export type CreateAccommodation = z.infer<typeof createAccommodationSchema>;
```

**Dependencies**:

```json
{
  "dependencies": {
    "zod": "^3.x"
  }
}
```

---

### Utils (`@repo/utils`)

**Purpose**: Shared utility functions

**Structure**:

```text
packages/utils/
├── src/
│   ├── string/                  # String utilities
│   │   ├── slugify.ts
│   │   ├── capitalize.ts
│   │   └── index.ts
│   ├── date/                    # Date utilities
│   │   ├── format-date.ts
│   │   ├── date-range.ts
│   │   └── index.ts
│   ├── array/                   # Array utilities
│   │   ├── chunk.ts
│   │   ├── unique.ts
│   │   └── index.ts
│   └── index.ts                 # Package exports
├── test/                        # Utility tests
├── package.json                 # Utils dependencies
└── tsconfig.json                # Utils TypeScript config
```

---

### Other Packages

**Logger (`@repo/logger`)**

- Centralized logging with Pino
- Log levels and formatting
- Request logging middleware

**Config (`@repo/config`)**

- Environment variable validation
- Typed configuration
- Default values

**Auth UI (`@repo/auth-ui`)**

- Authentication components
- Login/Register forms
- Clerk integration

**Payments (`@repo/payments`)**

- Mercado Pago integration
- Payment processing
- Webhook handlers

**Seed (`@repo/seed`)**

- Database seed data
- Required data (actors, permissions)
- Example data (demo accounts, properties)

---

## Package Naming

### Internal Packages

All internal packages use `@repo/*` namespace:

```json
{
  "name": "@repo/db",
  "name": "@repo/service-core",
  "name": "@repo/schemas"
}
```

### Apps

Apps use direct names:

```json
{
  "name": "api",
  "name": "web",
  "name": "admin"
}
```

---

## Workspace Configuration

### pnpm Workspace (`pnpm-workspace.yaml`)

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### TurboRepo (`turbo.json`)

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

**Key Features**:

- **Dependency tracking** - `^build` means "build dependencies first"
- **Caching** - Build outputs cached for speed
- **Parallel execution** - Tasks run in parallel where possible

---

## Dependency Management

### Installing Dependencies

**Root level** (applies to all packages):

```bash
pnpm add -w <package>
```

**Specific package**:

```bash
# Using filter
pnpm add <package> --filter @repo/db

# Or from package directory
cd packages/db && pnpm add <package>
```

**Add internal package**:

```bash
# In apps/api/package.json
{
  "dependencies": {
    "@repo/db": "workspace:*",
    "@repo/schemas": "workspace:*"
  }
}
```

### Updating Dependencies

```bash
# Update all packages
pnpm update

# Update specific package
pnpm update <package-name>

# Check outdated
pnpm outdated
```

---

## Build Order

TurboRepo automatically builds in correct order:

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

    style CONFIG fill:#9C27B0
    style SCHEMAS fill:#9C27B0
    style DB fill:#E91E63
    style SERVICE fill:#F44336
    style API fill:#FF9800
    style WEB fill:#4CAF50
    style ADMIN fill:#2196F3
```

**Build sequence**:

1. `@repo/config`, `@repo/schemas` (no dependencies)
2. `@repo/logger` (depends on config)
3. `@repo/db` (depends on schemas, logger, config)
4. `@repo/service-core` (depends on db, schemas, logger)
5. Apps (depend on service-core, schemas)

---

## Scripts Organization

### Root Scripts (`package.json`)

```json
{
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "test": "turbo test",
    "test:coverage": "turbo test:coverage",

    "db:start": "docker compose up -d",
    "db:stop": "docker compose down",
    "db:fresh": "pnpm db:stop && pnpm db:start && pnpm db:migrate && pnpm db:seed",

    "format:md": "markdownlint-cli2 '**/*.md' --fix",
    "lint:md": "markdownlint-cli2 '**/*.md'"
  }
}
```

### Package Scripts

Each package has standard scripts:

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

## Import Patterns

### Importing Internal Packages

```typescript
// From apps/api
import { accommodationService } from '@repo/service-core';
import { accommodationSchema } from '@repo/schemas';
import { db } from '@repo/db';
import { logger } from '@repo/logger';
```

### Barrel Exports

All packages use barrel exports (`index.ts`):

```typescript
// packages/db/src/index.ts
export { db } from './client';
export * from './schemas';
export * from './models';
```

**Benefits**:

- Clean imports
- Controlled exports
- Easy refactoring

---

## Next Steps

**Understand architectural patterns:**

→ [Patterns](patterns.md)

**Learn data flow:**

→ [Data Flow](data-flow.md)

**Explore specific layers:**

→ [Layers](layers.md)

**Add a new package:**

→ [Adding a Package](../guides/adding-package.md)
