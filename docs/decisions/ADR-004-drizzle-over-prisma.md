# ADR-004: Drizzle ORM over Prisma

## Status

Accepted

## Context

The platform needed a TypeScript ORM for PostgreSQL that would:

- Provide strong TypeScript type inference without code generation steps.
- Offer an API that feels familiar to developers who know SQL.
- Be tree-shakeable for minimal bundle impact in serverless deployments.
- Support migrations, schema introspection, and a studio tool for database exploration.
- Avoid heavy binary dependencies or runtime engines.

## Decision

We chose **Drizzle ORM** with PostgreSQL as the database layer, organized in the `@repo/db` package. All database access goes through models extending `BaseModel`, with soft deletes by default.

## Consequences

### Positive

- **SQL-like API** .. Drizzle's query builder closely mirrors SQL syntax, making it intuitive for developers familiar with SQL. No need to learn a proprietary query language.
- **Excellent TypeScript inference** .. Table schemas define types that flow through queries, inserts, and updates without separate type generation steps.
- **Tree-shakeable** .. Drizzle's modular design allows bundlers to eliminate unused code, keeping serverless function sizes small.
- **No binary engine** .. Unlike Prisma, Drizzle does not require a separate binary query engine at runtime, simplifying deployment and reducing container sizes.
- **Fast migrations** .. `drizzle-kit` generates migration SQL from schema changes, with clean push-to-database support for development.
- **Drizzle Studio** .. Built-in database browser for development and debugging.

### Negative

- **Younger ecosystem** .. Less community content, fewer guides, and fewer Stack Overflow answers compared to Prisma.
- **Less abstraction** .. The SQL-like API is an advantage for SQL-savvy developers but can feel lower-level for those accustomed to Prisma's more abstracted client.
- **Evolving API** .. Some Drizzle APIs have changed between versions, requiring occasional migration of query patterns.

### Neutral

- Both Drizzle and Prisma support PostgreSQL with full feature coverage for the platform's needs.
- Drizzle's relational query API provides Prisma-like ergonomics when needed, offering the best of both worlds.

## Alternatives Considered

### Prisma

Prisma is the most popular TypeScript ORM. It was rejected because:

- **Binary engine** .. Prisma requires a platform-specific query engine binary at runtime, adding complexity to Docker builds and serverless deployments.
- **Worse tree-shaking** .. The Prisma client is not tree-shakeable, resulting in larger bundles.
- **String-based schema** .. Prisma uses its own schema language (`.prisma` files) rather than TypeScript, creating a disconnect between schema definition and application code.
- **Generated client** .. Requires a `prisma generate` step after schema changes, adding friction to the development workflow.

### TypeORM

TypeORM was rejected due to:

- Heavy reliance on decorators, which are not standard TypeScript and add complexity.
- Poor TypeScript type inference compared to both Drizzle and Prisma.
- Known issues with complex query performance and connection management.

### Knex.js

Knex is a solid SQL query builder but was rejected because:

- It is a query builder only, not a full ORM. It does not provide schema-to-type inference.
- Would require building model/repository layers from scratch.
- No built-in migration generation from schema definitions.
