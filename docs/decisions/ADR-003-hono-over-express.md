# ADR-003: Hono over Express for REST API

## Status

Accepted

## Context

The platform needed a REST API framework for the `apps/api` service that would:

- Be TypeScript-first with strong type inference across routes, middleware, and validation.
- Support Zod schema validation natively for request/response validation.
- Generate OpenAPI documentation from route definitions.
- Be lightweight and edge-compatible for potential deployment on serverless/edge runtimes.
- Integrate cleanly with the monorepo's shared schemas package (`@repo/schemas`).

## Decision

We chose **Hono** as the REST API framework, combined with `@hono/zod-openapi` for schema validation and OpenAPI specification generation.

## Consequences

### Positive

- **TypeScript-first design** .. Hono is built in TypeScript, providing excellent type inference for route handlers, middleware, and context objects.
- **Tiny bundle size** .. Hono's core is under 14KB, making it significantly lighter than Express and its ecosystem of middleware.
- **Edge compatible** .. Hono runs on Cloudflare Workers, Vercel Edge Functions, Deno, Bun, and Node.js, providing deployment flexibility.
- **Built-in Zod validation** .. The `zValidator` middleware validates request bodies, query parameters, and path parameters using Zod schemas from `@repo/schemas`.
- **OpenAPI generation** .. Route definitions automatically produce OpenAPI 3.1 specifications, keeping API documentation in sync with implementation.
- **Web Standards** .. Hono uses the Fetch API `Request`/`Response` interface, aligning with modern web standards.

### Negative

- **Smaller community** .. Fewer Stack Overflow answers, tutorials, and third-party middleware compared to Express.
- **Fewer middleware options** .. While Hono has growing middleware support, it does not match Express's extensive ecosystem of community middleware.
- **Less familiarity** .. Express is the de facto Node.js API framework. Hono requires developers to learn new patterns.

### Neutral

- The three-tier route architecture (public, protected, admin) maps cleanly to Hono's route grouping.
- Route factory functions (`createSimpleRoute`, `createOpenApiRoute`, `createListRoute`) abstract away Hono-specific boilerplate.

## Alternatives Considered

### Express

Express is the most widely used Node.js API framework. It was rejected because:

- No native TypeScript support. Type definitions are maintained separately and often incomplete.
- Large dependency tree and bundle size for what the platform needs.
- No built-in Zod or OpenAPI integration. Would require additional packages and manual wiring.

### Fastify

Fastify offers good performance and TypeScript support. It was considered a strong contender but rejected because:

- Heavier than Hono with more complex plugin architecture.
- JSON Schema-based validation is less ergonomic than Zod for a project already using Zod throughout.
- Not designed for edge runtimes.

### tRPC

tRPC provides excellent TypeScript type safety between client and server. It was rejected because:

- The platform needs a REST API, not an RPC-style API. REST is required for the public API, third-party integrations, and OpenAPI documentation.
- tRPC works best in a single-framework monorepo (e.g., all Next.js). The Hospeda platform has three distinct apps consuming the API.
