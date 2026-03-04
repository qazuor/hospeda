# Dependency Policy

> Single source of truth for which libraries and tools to use in the Hospeda monorepo.

## Why This Exists

Consistency across a monorepo with 15+ packages requires strict dependency governance. This document prevents duplication, reduces bundle size, and ensures all developers (human and AI) make the same choices.

## Rules

### Icons

- **Use**: `@repo/icons` (Phosphor Icons wrappers)
- **Never**: Import `phosphor-react` directly, inline `<svg>` elements (except decorative illustrations in 404/500 pages)
- **Reason**: Consistent icon API, tree-shakeable, centralized updates

### Validation

- **Use**: Zod via `@repo/schemas`
- **Never**: yup, joi, class-validator, manual validation
- **Reason**: Single source of truth for types, runtime + compile-time safety

### UI - Admin

- **Use**: Shadcn UI components
- **Never**: Material UI, Ant Design, Chakra UI, other component libraries
- **Reason**: Headless, customizable, Tailwind-native

### UI - Web

- **Use**: Astro components by default, React islands only for interactivity
- **Never**: Full React pages, Vue, Svelte in web app
- **Reason**: Minimal JS, islands architecture

### Forms

- **Use (Admin)**: React Hook Form + Zod resolver
- **Use (Web)**: Native HTML forms with Astro
- **Never**: Formik, final-form, custom form state management
- **Reason**: Type-safe, performant, integrates with Zod schemas

### Tables

- **Use**: TanStack Table
- **Never**: ag-grid, react-table v7, custom table implementations
- **Reason**: Headless, type-safe, feature-complete

### Data Fetching (Admin)

- **Use**: TanStack Query
- **Never**: SWR, axios directly, custom fetch wrappers
- **Reason**: Cache management, optimistic updates, devtools

### Routing (Admin)

- **Use**: TanStack Router (file-based)
- **Never**: react-router, wouter, custom routing
- **Reason**: Type-safe, file-based, integrated with TanStack ecosystem

### Styling

- **Use**: Tailwind CSS v4
- **Never**: CSS modules, styled-components, emotion, Sass
- **Reason**: Utility-first, consistent design tokens, dark mode support

### Testing

- **Use**: Vitest + @testing-library/react
- **Never**: Jest, Mocha, Cypress for unit tests, Enzyme
- **Reason**: Fast, ESM-native, compatible with monorepo

### Linting/Formatting

- **Use**: Biome
- **Never**: ESLint, Prettier
- **Reason**: Single tool, fast, consistent

### Logging

- **Use**: `@repo/logger`
- **Never**: console.log in apps, winston, pino directly
- **Reason**: Structured logging, consistent format, Sentry integration

### Internationalization

- **Use**: `@repo/i18n` with useI18n()
- **Never**: i18next directly, react-intl, hardcoded strings
- **Reason**: Centralized translations, type-safe keys

### Database

- **Use**: Drizzle ORM via `@repo/db`
- **Never**: Raw SQL, Knex, TypeORM, Prisma, direct pg client
- **Reason**: Type-safe queries, migration system, centralized schema

### Schemas/Types

- **Use**: `@repo/schemas` as single source of truth
- **Never**: Define standalone TypeScript interfaces for entities, duplicate Zod schemas
- **Reason**: One place for all entity types, shared across apps

### Business Logic

- **Use**: Extend `BaseCrudService` from `@repo/service-core`
- **Never**: Business logic in API routes, duplicate service logic
- **Reason**: Consistent error handling, permission checks, logging

### Email

- **Use**: `@repo/email` (when available)
- **Never**: Nodemailer directly, SendGrid SDK directly
- **Reason**: Centralized email templates, consistent sender config

### Notifications

- **Use**: `@repo/notifications`
- **Never**: Custom notification implementations
- **Reason**: Centralized notification channels

### Configuration

- **Use**: `@repo/config`
- **Never**: Duplicate constants across packages
- **Reason**: Single source of truth for shared config

### Authentication

- **Use**: Better Auth via `@repo/auth-ui`
- **Never**: Custom auth implementation, Clerk, Auth.js
- **Reason**: Self-hosted, role-based, permission system

### Monetary Values

- **Use**: Integer (centavos) in database
- **Never**: numeric(), float, string for money
- **Reason**: See ADR-006. Avoids JS string/float issues

### HTTP Client

- **Use**: Native fetch
- **Never**: axios (unless already in dependencies), got, superagent
- **Reason**: Built-in, no extra dependency, works in edge

### State Management (Web)

- **Use**: Nano stores or signals for minimal state
- **Never**: Redux, Zustand, MobX in web app
- **Reason**: Astro islands architecture, minimal JS

### Package Manager

- **Use**: pnpm 9.x with workspaces
- **Never**: npm, yarn, bun
- **Reason**: Fast, disk-efficient, good monorepo support

## Adding New Dependencies

Before adding a new dependency:

1. Check this document for an existing approved alternative
2. Check if an internal package (`@repo/*`) already covers the need
3. If neither exists, propose the dependency in a PR with justification
4. Update this document after approval

## Related

- [Architecture Patterns](../architecture/patterns.md)
- [Code Standards](../contributing/code-standards.md)
