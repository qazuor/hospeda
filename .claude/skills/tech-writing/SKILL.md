---
name: tech-writing
description: Documentation patterns for software projects. Use when writing JSDoc, OpenAPI specs, ADRs, READMEs, CHANGELOGs, or API documentation.
---

# Tech Writing

## Purpose

Documentation patterns and standards for software projects. Covers JSDoc, OpenAPI/Swagger, Architecture Decision Records (ADR), README structure, CHANGELOG format, inline code comments, and API documentation best practices.

## Activation

Use this skill when the user asks about:

- Writing documentation (JSDoc, TSDoc, README, etc.)
- OpenAPI/Swagger spec creation
- Architecture Decision Records (ADRs)
- CHANGELOG maintenance
- Code comment standards
- API documentation
- Documentation structure and organization

## JSDoc / TSDoc

### Function Documentation

```typescript
/**
 * Calculates the total price including tax and optional discount.
 *
 * @param items - Array of line items to calculate
 * @param taxRate - Tax rate as a decimal (e.g., 0.08 for 8%)
 * @param options - Optional calculation parameters
 * @returns The calculated total with breakdown
 *
 * @example
 * ```ts
 * const total = calculateTotal(
 *   [{ name: "Widget", price: 9.99, quantity: 2 }],
 *   0.08,
 *   { discount: 0.1 }
 * );
 * // { subtotal: 19.98, tax: 1.60, discount: 2.00, total: 19.58 }
 * ```
 *
 * @throws {ValidationError} If items array is empty
 * @throws {RangeError} If taxRate is negative
 *
 * @see {@link LineItem} for item structure
 * @since 2.1.0
 */
function calculateTotal(
  items: LineItem[],
  taxRate: number,
  options?: CalculateOptions
): TotalBreakdown {
  // ...
}
```

### Interface / Type Documentation

```typescript
/**
 * Configuration for the database connection pool.
 *
 * @remarks
 * The pool automatically manages connections, creating new ones as needed
 * up to {@link PoolConfig.max | max} and reaping idle connections after
 * {@link PoolConfig.idleTimeoutMs | idleTimeoutMs}.
 */
interface PoolConfig {
  /** PostgreSQL connection string */
  connectionString: string;

  /** Minimum number of connections to maintain. @defaultValue 2 */
  min?: number;

  /** Maximum number of connections allowed. @defaultValue 10 */
  max?: number;

  /**
   * Time in milliseconds before an idle connection is closed.
   * Set to 0 to disable.
   * @defaultValue 30000
   */
  idleTimeoutMs?: number;

  /**
   * Called when a connection is established.
   * Use for per-connection setup (e.g., setting search_path).
   */
  onConnect?: (client: PoolClient) => Promise<void>;
}
```

### Module / File Header

```typescript
/**
 * @module auth/jwt
 * @description JWT token generation and verification utilities.
 *
 * Provides functions for creating access/refresh token pairs,
 * verifying tokens, and extracting claims.
 *
 * @example
 * ```ts
 * import { signToken, verifyToken } from "@/auth/jwt";
 *
 * const token = await signToken({ userId: "123", role: "admin" });
 * const claims = await verifyToken(token);
 * ```
 *
 * @packageDocumentation
 */
```

### Enum Documentation

```typescript
/**
 * HTTP status codes used across the API.
 *
 * @remarks
 * Only includes status codes actively used by our endpoints.
 * For the full HTTP spec, see {@link https://httpstatuses.com/}.
 */
enum HttpStatus {
  /** Request succeeded */
  OK = 200,
  /** Resource created successfully */
  Created = 201,
  /** Request accepted for background processing */
  Accepted = 202,
  /** No content to return */
  NoContent = 204,
  /** Invalid request body or parameters */
  BadRequest = 400,
  /** Authentication required */
  Unauthorized = 401,
  /** Authenticated but insufficient permissions */
  Forbidden = 403,
  /** Resource not found */
  NotFound = 404,
  /** Server error */
  InternalServerError = 500,
}
```

## OpenAPI / Swagger

### Basic Structure

```yaml
openapi: 3.1.0
info:
  title: My API
  version: 1.0.0
  description: |
    REST API for managing users, orders, and products.

    ## Authentication
    All endpoints require a Bearer token in the Authorization header
    unless marked as public.

    ## Rate Limiting
    - Authenticated: 1000 requests/minute
    - Public: 100 requests/minute
  contact:
    name: API Support
    email: api@example.com
  license:
    name: MIT

servers:
  - url: https://api.example.com/v1
    description: Production
  - url: https://staging-api.example.com/v1
    description: Staging

tags:
  - name: Users
    description: User management endpoints
  - name: Orders
    description: Order processing endpoints

security:
  - BearerAuth: []
```

### Path Definition

```yaml
paths:
  /users:
    get:
      summary: List users
      description: Returns a paginated list of users. Supports filtering and sorting.
      operationId: listUsers
      tags: [Users]
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            minimum: 1
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 20
        - name: search
          in: query
          description: Search by name or email
          schema:
            type: string
        - name: sort
          in: query
          schema:
            type: string
            enum: [name, email, created_at]
            default: created_at
      responses:
        "200":
          description: Paginated list of users
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/PaginatedUsers"
        "401":
          $ref: "#/components/responses/Unauthorized"

    post:
      summary: Create user
      operationId: createUser
      tags: [Users]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/CreateUserRequest"
            example:
              name: Jane Doe
              email: jane@example.com
              role: user
      responses:
        "201":
          description: User created
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/User"
        "400":
          $ref: "#/components/responses/ValidationError"
        "409":
          description: Email already exists
```

### Schema Components

```yaml
components:
  schemas:
    User:
      type: object
      required: [id, name, email, role, createdAt]
      properties:
        id:
          type: string
          format: uuid
          readOnly: true
        name:
          type: string
          minLength: 1
          maxLength: 100
        email:
          type: string
          format: email
        role:
          type: string
          enum: [admin, user, moderator]
        avatar:
          type: string
          format: uri
          nullable: true
        createdAt:
          type: string
          format: date-time
          readOnly: true

    CreateUserRequest:
      type: object
      required: [name, email]
      properties:
        name:
          type: string
          minLength: 1
          maxLength: 100
        email:
          type: string
          format: email
        role:
          type: string
          enum: [admin, user, moderator]
          default: user

    PaginatedUsers:
      type: object
      properties:
        data:
          type: array
          items:
            $ref: "#/components/schemas/User"
        pagination:
          $ref: "#/components/schemas/Pagination"

    Pagination:
      type: object
      properties:
        page:
          type: integer
        limit:
          type: integer
        total:
          type: integer
        totalPages:
          type: integer

    Error:
      type: object
      required: [code, message]
      properties:
        code:
          type: string
        message:
          type: string
        details:
          type: array
          items:
            type: object
            properties:
              field:
                type: string
              message:
                type: string

  responses:
    Unauthorized:
      description: Authentication required
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/Error"
          example:
            code: UNAUTHORIZED
            message: Bearer token is missing or invalid

    ValidationError:
      description: Request validation failed
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/Error"
          example:
            code: VALIDATION_ERROR
            message: Request body validation failed
            details:
              - field: email
                message: Invalid email format

  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

## Architecture Decision Records (ADR)

### ADR Format

```markdown
# ADR-001: Use PostgreSQL as Primary Database

## Status

Accepted

## Date

2024-06-15

## Context

We need to select a primary database for the application. Key requirements:
- ACID compliance for financial transactions
- Support for complex queries with joins
- JSON column support for flexible metadata
- Strong ecosystem and tooling (ORMs, migration tools)
- Horizontal read scaling via replicas

Candidates evaluated:
1. PostgreSQL
2. MySQL 8
3. MongoDB

## Decision

We will use **PostgreSQL 16** as the primary database.

## Rationale

- Best JSON/JSONB support among relational databases
- Superior query planner and performance for complex queries
- Rich extension ecosystem (PostGIS, pg_trgm, pgvector)
- Strong TypeScript/Node.js support via Prisma and Drizzle
- Built-in full-text search reduces need for Elasticsearch for simple cases
- Row-level security for multi-tenant data isolation

## Consequences

### Positive
- Single database for relational + document-style data
- Mature migration tooling (Prisma Migrate, dbmate)
- Well-understood operational model

### Negative
- Horizontal write scaling requires careful sharding or Citus
- More complex to operate than managed NoSQL
- Team needs PostgreSQL-specific knowledge (EXPLAIN ANALYZE, vacuum, etc.)

### Risks
- Vendor lock-in to PostgreSQL-specific features (JSONB operators, CTEs)
- Need dedicated DBA if data exceeds 1TB

## Alternatives Considered

### MySQL 8
Rejected: Weaker JSON support, less capable query planner.

### MongoDB
Rejected: Lacks ACID transactions across collections (pre-4.0 habits in ecosystem),
harder to enforce schema consistency.
```

### ADR File Naming

```
docs/
└── adr/
    ├── 001-use-postgresql.md
    ├── 002-adopt-typescript.md
    ├── 003-use-pnpm-workspaces.md
    ├── 004-jwt-for-auth.md
    └── template.md
```

## README Structure

### Standard README Template

```markdown
# Project Name

Brief one-line description of what this project does.

## Features

- Feature 1: brief description
- Feature 2: brief description
- Feature 3: brief description

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- PostgreSQL >= 16

### Installation

\```bash
git clone https://github.com/org/project.git
cd project
pnpm install
cp .env.example .env.local
# Edit .env.local with your values
pnpm db:migrate
pnpm dev
\```

### Running Tests

\```bash
pnpm test           # Unit tests
pnpm test:e2e       # End-to-end tests
pnpm test:coverage  # Coverage report
\```

## Project Structure

\```
src/
├── app/          # Next.js app router
├── components/   # React components
├── lib/          # Shared utilities
├── server/       # Server-side code
└── types/        # TypeScript types
\```

## API Reference

Brief description or link to full API docs.

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/users | GET | List users |
| /api/users | POST | Create user |
| /api/users/:id | GET | Get user by ID |

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| DATABASE_URL | Yes | - | PostgreSQL connection string |
| JWT_SECRET | Yes | - | Secret for JWT signing |
| PORT | No | 3000 | Server port |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

[MIT](LICENSE)
```

## CHANGELOG Format

Follow [Keep a Changelog](https://keepachangelog.com/) format:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- User avatar upload endpoint

## [1.2.0] - 2024-07-15

### Added
- Pagination support for list endpoints
- Rate limiting middleware
- OpenAPI documentation auto-generation

### Changed
- Upgraded to Node.js 20 LTS
- Switched from Jest to Vitest for faster tests

### Fixed
- Race condition in concurrent order creation
- Memory leak in WebSocket connection handler

### Security
- Updated jsonwebtoken to 9.x to address CVE-2023-XXXXX

## [1.1.0] - 2024-06-01

### Added
- User registration and login
- JWT authentication
- Basic CRUD for orders

### Deprecated
- `GET /api/v1/users/list` - Use `GET /api/v1/users` instead

## [1.0.0] - 2024-05-01

### Added
- Initial release
- User management API
- Health check endpoint
```

### Categories (use only these)

- **Added** - New features
- **Changed** - Changes in existing functionality
- **Deprecated** - Soon-to-be-removed features
- **Removed** - Removed features
- **Fixed** - Bug fixes
- **Security** - Vulnerability fixes

## Code Comments Best Practices

### When to Comment

```typescript
// GOOD: Explain WHY, not WHAT
// We retry 3 times because the payment gateway has transient 503s
// during their nightly maintenance window (01:00-01:30 UTC).
const MAX_RETRIES = 3;

// GOOD: Document non-obvious business rules
// Orders over $10,000 require manual approval per compliance policy SEC-2024-07
if (order.total > 10_000) {
  await flagForManualReview(order);
}

// GOOD: Warn about gotchas
// WARNING: This function is NOT idempotent. Calling it twice will
// charge the customer twice. Always check payment status first.
async function processPayment(orderId: string) { /* ... */ }

// BAD: Restating the code
// Increment counter by 1
counter += 1;

// BAD: Commented-out code (delete it, git has history)
// const oldValue = calculateLegacy(input);
```

### TODO Format

```typescript
// TODO(username): Brief description of what needs to be done
// Issue: https://github.com/org/repo/issues/123

// FIXME(username): Known bug description
// This fails when input contains unicode characters

// HACK: Temporary workaround for library bug
// Remove when https://github.com/lib/repo/issues/456 is fixed

// NOTE: Non-obvious implementation detail worth highlighting
```

### Section Separators

```typescript
// ============================================================
// Public API
// ============================================================

export function createUser() { /* ... */ }
export function updateUser() { /* ... */ }

// ============================================================
// Internal Helpers
// ============================================================

function validateInput() { /* ... */ }
function hashPassword() { /* ... */ }
```
