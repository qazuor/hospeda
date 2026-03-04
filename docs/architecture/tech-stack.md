# Technology Stack

For the list of technologies and what to use for each need, see the dependency table in [CLAUDE.md](../../CLAUDE.md). This document explains the reasoning and tradeoffs behind each technology choice.

---

## Frontend

### Astro (Public Website)

**Why chosen over Next.js, Remix, Gatsby:**

- Ships zero JavaScript by default, which is critical for a content-heavy tourism site where SEO and initial load time directly impact conversion
- Islands architecture lets us add interactivity (search bar, booking form) only where needed, keeping most pages as pure HTML
- Framework-agnostic.. we use React for interactive islands but could swap to any framework per-component
- Built-in SSR and static generation allow us to choose rendering strategy per page

**Tradeoffs:**

- Smaller ecosystem than Next.js means fewer third-party integrations
- Islands pattern has a learning curve for developers used to full-SPA frameworks
- Less mature community for troubleshooting edge cases

### TanStack Start (Admin Dashboard)

**Why chosen over Next.js App Router, Remix, plain Vite + React Router:**

- Type-safe routing with TanStack Router catches route parameter errors at compile time, which is valuable for a dashboard with many nested routes
- Tight integration with TanStack Query and TanStack Form reduces boilerplate for the CRUD-heavy admin interface
- Lighter weight than Next.js.. the admin panel does not need the full Next.js feature set (image optimization, ISR, etc.)

**Tradeoffs:**

- Newer framework with a smaller community.. fewer Stack Overflow answers and blog posts
- Less mature than Next.js for production edge cases
- Documentation is still evolving

### Tailwind CSS + Shadcn UI

**Why chosen over CSS Modules, Styled Components, Material UI:**

- Utility-first approach speeds up development and eliminates context-switching between files
- Shadcn UI gives us copy-paste components built on Radix UI primitives.. we own the code and can customize freely without fighting a component library's opinions
- Radix primitives provide accessibility out of the box (focus management, ARIA, keyboard navigation)
- No runtime CSS-in-JS overhead

**Tradeoffs:**

- HTML can be verbose with many utility classes
- Developers must learn Tailwind's utility naming conventions
- Shadcn components require manual updates (no package version bumps)

---

## Backend

### Hono (API Framework)

**Why chosen over Express, Fastify, NestJS:**

- Significantly faster than Express and edge-compatible (works on Vercel Edge Functions, Cloudflare Workers)
- Excellent TypeScript inference for request/response types without decorators or code generation
- Minimal overhead.. small bundle size matters for serverless deployment where cold start time affects latency
- Express-like API makes it approachable for developers familiar with Express

**Tradeoffs:**

- Smaller ecosystem than Express.. fewer middleware packages available
- Less battle-tested in production at scale
- Some Express middleware needs adaptation to work with Hono

---

## Data Layer

### PostgreSQL

**Why chosen over MySQL, MongoDB, SQLite:**

- ACID compliance is essential for booking and payment transactions where data integrity is non-negotiable
- Full-text search built in.. avoids adding Elasticsearch for the accommodation search feature
- JSON column support gives flexibility for semi-structured data (amenity metadata, pricing rules) while keeping relational integrity for core entities
- Mature and battle-tested with excellent tooling

**Tradeoffs:**

- More complex to operate than SQLite or MongoDB for simple use cases
- Vertical scaling has limits (addressed by using Neon Cloud's serverless scaling)

### Drizzle ORM

**Why chosen over Prisma, TypeORM, Kysely:**

- SQL-like query syntax means developers can think in SQL and get TypeScript type safety.. no new query language to learn
- Zero runtime dependencies keeps the bundle small for serverless deployment
- SQL-based migrations give full control over the database schema (unlike Prisma's auto-generated migrations that can be opaque)
- Measurably faster query execution than Prisma in benchmarks

**Tradeoffs:**

- Smaller ecosystem than Prisma.. fewer plugins and community resources
- Less mature tooling (Drizzle Studio is functional but not as polished as Prisma Studio)
- Migration tooling requires more manual SQL knowledge

### Redis

**Why chosen over Memcached, in-memory JS cache:**

- Used for API response caching, session storage, and rate limiting
- In-memory speed for frequently accessed data (accommodation listings, session tokens)
- Pub/Sub capability supports future real-time features (booking notifications)
- Scalable beyond a single process, unlike in-memory JS caching

**Tradeoffs:**

- Additional infrastructure to manage
- Data persistence requires configuration (RDB/AOF)

---

## Infrastructure

### Vercel (Hosting)

**Why chosen over AWS, Netlify, Railway:**

- Git-push-to-deploy workflow with automatic preview deployments per PR
- Edge Functions support for the Hono API
- Automatic scaling with zero configuration
- Strong Astro and TanStack integration

**Tradeoffs:**

- Vendor lock-in for deployment infrastructure
- Cost increases at scale (compute-per-request pricing)
- Limited control over infrastructure compared to AWS

### Neon Cloud (Database Hosting)

**Why chosen over Supabase, PlanetScale, self-hosted:**

- Serverless PostgreSQL with auto-scaling matches our Vercel serverless deployment model
- Database branching enables isolated development environments without provisioning separate instances
- Pay-per-use pricing is cost-effective for a project with variable traffic

**Tradeoffs:**

- Newer service with less production track record
- Less control over database configuration than self-hosted
- Cold start latency on idle databases (mitigated by always-on option)

---

## Tooling

### TurboRepo (Monorepo Build System)

**Why chosen over Nx, Lerna, Yarn Workspaces:**

- Simple configuration compared to Nx (single `turbo.json` vs multiple config files)
- Smart caching with content-based hashing speeds up CI significantly
- Parallel task execution is automatic based on the dependency graph
- Works naturally with pnpm workspaces

**Tradeoffs:**

- Fewer features than Nx (no code generation, no dependency graph visualization)
- Newer than Nx with a smaller community

### pnpm (Package Manager)

**Why chosen over npm, yarn:**

- Content-addressable store shares packages across projects, saving significant disk space in a monorepo
- Strict dependency resolution prevents phantom dependencies (packages that work accidentally because a sibling installed them)
- Faster installation than npm and yarn in benchmarks
- First-class workspace support for monorepos

**Tradeoffs:**

- Less common than npm, which can cause friction with third-party tooling that assumes npm
- Different `node_modules` structure (symlinks) can occasionally cause issues with tools that traverse `node_modules`

### Biome (Linting and Formatting)

**Why chosen over ESLint + Prettier:**

- Single tool replaces both ESLint and Prettier, reducing configuration surface
- Written in Rust.. significantly faster than ESLint + Prettier (noticeable in pre-commit hooks and CI)
- Zero-config defaults that work well out of the box

**Tradeoffs:**

- Smaller plugin ecosystem than ESLint
- Cannot run custom ESLint rules (must use Biome's built-in rules)
- Newer tool, still adding rules that ESLint has had for years

### Vitest (Testing)

**Why chosen over Jest, Mocha:**

- Vite-powered with native TypeScript and ESM support.. no Babel or ts-jest configuration needed
- Jest-compatible API makes migration easy and reduces learning curve
- Fast watch mode with HMR-like instant re-runs
- Built-in coverage reporting

**Tradeoffs:**

- Newer than Jest with a smaller community
- Some Jest plugins do not have Vitest equivalents

---

## Decision Summary

| Category | Choice | Primary Reason | Key Tradeoff |
|----------|--------|----------------|--------------|
| Web Framework | Astro | Zero-JS default for SEO | Smaller ecosystem |
| UI Framework | React 19 | Largest ecosystem, component reuse | Bundle size |
| Admin Framework | TanStack Start | Type-safe routing for CRUD dashboard | Less mature |
| API Framework | Hono | Edge-compatible, fast cold starts | Smaller ecosystem |
| Database | PostgreSQL | ACID + full-text search | Operational complexity |
| ORM | Drizzle | SQL-like syntax, zero runtime | Less mature tooling |
| Cache | Redis | Speed, rate limiting, sessions | Additional infrastructure |
| Validation | Zod | Type inference from schemas | Bundle size |
| Hosting | Vercel | Git-push deploy, auto-scaling | Vendor lock-in |
| DB Hosting | Neon | Serverless Postgres, branching | Newer service |
| Monorepo | TurboRepo | Simple config, smart caching | Fewer features than Nx |
| Package Manager | pnpm | Disk efficiency, strict deps | Less common |
| Linting | Biome | All-in-one, Rust speed | Fewer plugins |
| Testing | Vitest | Native TS/ESM, fast watch | Newer than Jest |

---

## Next Steps

- [Architecture Overview](overview.md) - How the stack components connect
- [Patterns](patterns.md) - Architectural patterns across layers
- [Data Flow](data-flow.md) - Request lifecycle through the stack
