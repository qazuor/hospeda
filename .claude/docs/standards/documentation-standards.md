# Documentation Standards

This document defines the documentation standards for the Hospeda project.

---

## Table of Contents

1. [Documentation Philosophy](#documentation-philosophy)
2. [JSDoc Standards](#jsdoc-standards)
3. [API Documentation](#api-documentation)
4. [Component Documentation](#component-documentation)
5. [Architecture Documentation](#architecture-documentation)
6. [README Files](#readme-files)
7. [Code Comments](#code-comments)
8. [Diagrams](#diagrams)
9. [Changelog](#changelog)
10. [Documentation Structure](#documentation-structure)

---

## Documentation Philosophy

### Core Principles

**Code is Documentation:**

- Self-explanatory code > extensive comments
- Good naming > explaining what code does
- Tests document expected behavior

**Documentation is Code:**

- Keep docs close to code
- Update docs with code changes
- Review docs in code reviews

**Audience-First:**

- Write for future developers
- Write for external users
- Write for your future self

**Language:**

- ALL documentation in English
- Technical precision
- Clear and concise

---

## JSDoc Standards

### Required for All Exports

**Every exported function, class, and type MUST have JSDoc.**

### Complete Function Documentation

```typescript
/**

 * Creates a new user account with validation and authorization checks

 *

 * This function performs several operations:
 * 1. Validates the input data against business rules
 * 2. Checks if the email is already in use
 * 3. Hashes the password using bcrypt
 * 4. Creates the user record in the database
 * 5. Sends a welcome email to the new user

 *

 * @param {Object} params - Input parameters object
 * @param {CreateUserInput} params.input - User data to create
 * @param {string} params.input.name - User's full name (1-200 characters)
 * @param {string} params.input.email - User's email (must be unique, valid format)
 * @param {string} params.input.password - User's password (min 8 characters)
 * @param {UserRole} params.input.role - User's role (admin, host, or guest)
 * @param {User} params.currentUser - The authenticated user performing this action

 *

 * @returns {Promise<CreateUserOutput>} Object containing the created user and auth token
 * @returns {User} result.user - The newly created user object
 * @returns {string} result.token - JWT authentication token for the new user

 *

 * @throws {ServiceError} VALIDATION_ERROR - When input validation fails
 * @throws {ServiceError} CONFLICT - When email already exists in database
 * @throws {ServiceError} FORBIDDEN - When current user lacks create permissions
 * @throws {ServiceError} INTERNAL_ERROR - When database operation fails

 *

 * @example Basic usage
 * ```typescript
 * import { UserService } from '@repo/service-core';
 * import type { CreateUserInput } from '@repo/schemas';

 *

 * const service = new UserService(ctx);
 * const result = await service.createUser({
 *   input: {
 *     name: 'John Doe',
 *     email: 'john@example.com',
 *     password: 'SecureP@ssw0rd',
 *     role: 'host'
 *   },
 *   currentUser: adminUser
 * });

 *

 * console.log(result.user.id); // '123e4567-e89b-12d3-a456-426614174000'
 * console.log(result.token); // 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
 * ```

 *

 * @example With error handling
 * ```typescript
 * try {
 *   const result = await service.createUser({ input, currentUser });
 *   console.log('User created:', result.user.id);
 * } catch (error) {
 *   if (error instanceof ServiceError) {
 *     if (error.code === ServiceErrorCode.CONFLICT) {
 *       console.log('Email already exists');
 *     }
 *   }
 * }
 * ```

 *

 * @complexity
 * - Time: O(1) for database insert + O(1) for hash operation
 * - Space: O(1) constant space usage

 *

 * @sideEffects
 * - Creates a new record in the users table
 * - Sends a welcome email to the user's email address
 * - Logs user creation event to audit log
 * - May trigger webhook notifications if configured

 *

 * @see {@link UserService} for other user management operations
 * @see {@link validateUserInput} for detailed validation rules
 * @see {@link hashPassword} for password hashing implementation
 * @see {@link sendWelcomeEmail} for email sending logic

 *

 * @since 1.0.0 - Initial implementation
 * @version 1.2.0 - Added webhook support

 *

 * @author Engineering Team
 * @lastModified 2024-01-15

 */
export const createUser = async ({
  input,
  currentUser,
}: CreateUserParams): Promise<CreateUserOutput> => {
  // implementation
};
```text

### Class Documentation

```typescript
/**

 * Service for managing accommodation listings in the platform

 *

 * This service handles all accommodation-related operations including:
 * - Creating and updating accommodation listings
 * - Search and filtering accommodations
 * - Managing availability and pricing
 * - Handling images and amenities
 * - Enforcing business rules for hosts

 *

 * The service extends BaseCrudService and adds accommodation-specific
 * business logic such as validation of capacity limits, price ranges,
 * and host permissions.

 *

 * @extends BaseCrudService
 * @implements IAccommodationService

 *

 * @example Creating the service
 * ```typescript
 * import { AccommodationService } from '@repo/service-core';

 *

 * const service = new AccommodationService(ctx);
 * ```

 *

 * @example Using the service
 * ```typescript
 * // Create accommodation
 * const result = await service.create({
 *   input: {
 *     name: 'Beach House',
 *     type: 'house',
 *     capacity: 6,
 *     pricePerNight: 150
 *   },
 *   user: hostUser
 * });

 *

 * // Search accommodations
 * const accommodations = await service.findAll({
 *   search: { q: 'beach', type: 'house' },
 *   page: 1,
 *   pageSize: 20
 * });
 * ```

 *

 * @see {@link BaseCrudService} for inherited CRUD operations
 * @see {@link AccommodationModel} for data access layer

 *

 * @since 1.0.0

 */
export class AccommodationService extends BaseCrudService<
  Accommodation,
  AccommodationModel,
  CreateAccommodationInput,
  UpdateAccommodationInput,
  SearchAccommodationInput
> {
  /**

   * Creates a new AccommodationService instance

   *

   * @param {ServiceContext} ctx - Service context with database and logger
   * @param {AccommodationModel} [model] - Optional custom model instance (for testing)

   *

   * @example
   * ```typescript
   * const service = new AccommodationService(ctx);
   * ```

   */
  constructor(ctx: ServiceContext, model?: AccommodationModel) {
    super(ctx, model ?? new AccommodationModel(ctx.db));
  }
}
```text

### Type Documentation

```typescript
/**

 * Represents a user account in the Hospeda platform

 *

 * Users can have one of three roles:
 * - **admin**: Full system access, can manage all resources
 * - **host**: Can create and manage their own accommodations
 * - **guest**: Can search and book accommodations

 *

 * User accounts support soft deletion, meaning deleted users are marked
 * with a deletedAt timestamp but not removed from the database.

 *

 * @property {string} id - Unique identifier (UUID v4 format)
 * @property {string} name - User's full name (1-200 characters)
 * @property {string} email - User's email address (unique, valid format)
 * @property {UserRole} role - User's role (admin | host | guest)
 * @property {string} [phone] - Optional phone number
 * @property {string} [avatar] - Optional avatar URL
 * @property {Date} createdAt - Account creation timestamp (UTC)
 * @property {Date} updatedAt - Last modification timestamp (UTC)
 * @property {Date | null} deletedAt - Soft deletion timestamp (null if active)

 *

 * @example
 * ```typescript
 * const user: User = {
 *   id: '123e4567-e89b-12d3-a456-426614174000',
 *   name: 'John Doe',
 *   email: 'john@example.com',
 *   role: 'host',
 *   phone: '+54 9 11 1234-5678',
 *   avatar: 'https://example.com/avatars/john.jpg',
 *   createdAt: new Date('2024-01-01T00:00:00Z'),
 *   updatedAt: new Date('2024-01-15T10:30:00Z'),
 *   deletedAt: null
 * };
 * ```

 *

 * @see {@link UserRole} for role definitions
 * @see {@link createUserSchema} for validation schema

 */
export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};
```text

### Essential JSDoc Tags

**Required:**

- `@param` - Function parameters (with types)
- `@returns` - Return value (with type)
- `@throws` - Possible errors

**Highly Recommended:**

- `@example` - Working code examples (at least 1)
- `@complexity` - Time/space complexity
- `@sideEffects` - Side effects (database, email, logs, etc.)
- `@see` - Related code/documentation

**Optional:**

- `@since` - Version introduced
- `@version` - Current version
- `@deprecated` - Deprecation info
- `@author` - Author name
- `@lastModified` - Last modification date

---

## API Documentation

### OpenAPI (Swagger) Documentation

**All API endpoints MUST have OpenAPI documentation.**

```typescript
/**

 * @openapi
 * /api/accommodations:
 *   post:
 *     summary: Create a new accommodation listing
 *     description: |
 *       Creates a new accommodation listing for the authenticated host user.
 *       The host must have the 'host' role and 'accommodation:write' permission.

 *

 *       Business rules:
 *       - Name must be unique per host
 *       - Capacity must be between 1 and 50
 *       - Price must be positive
 *       - Host ID is automatically set to the authenticated user

 *

 *     tags:
 *       - Accommodations

 *

 *     security:
 *       - bearerAuth: []

 *

 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateAccommodationInput'
 *           examples:
 *             basic:
 *               summary: Basic accommodation
 *               value:
 *                 name: Beach House
 *                 type: house
 *                 capacity: 6
 *                 pricePerNight: 150
 *             detailed:
 *               summary: Detailed accommodation
 *               value:
 *                 name: Luxury Beach Villa
 *                 type: house
 *                 capacity: 10
 *                 pricePerNight: 500
 *                 description: Stunning ocean view villa
 *                 amenities: [wifi, pool, parking]

 *

 *     responses:
 *       201:
 *         description: Accommodation created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Accommodation'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               validation:
 *                 value:
 *                   success: false
 *                   error:
 *                     code: VALIDATION_ERROR
 *                     message: Invalid input data
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - User is not a host
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Conflict - Accommodation name already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'

 */
app.post('/accommodations', ...);
```text

### API Endpoint Documentation File

**Create separate markdown files for complex APIs:**

```markdown

# Accommodations API

## Overview

The Accommodations API allows hosts to create, manage, and list accommodation properties.

Base URL: `/api/accommodations`

## Authentication

All write operations require authentication with a valid JWT token.

```http

Authorization: Bearer <token>

```text

## Endpoints

### List Accommodations

`GET /api/accommodations`

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| q | string | No | - | Search query (searches name and description) |
| type | string | No | - | Filter by type (house, apartment, room) |
| minCapacity | number | No | - | Minimum capacity |
| maxPrice | number | No | - | Maximum price per night |
| page | number | No | 1 | Page number |
| pageSize | number | No | 20 | Items per page (max 100) |

**Response:**

```json

{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}

```text

### Create Accommodation

`POST /api/accommodations`

**Authentication:** Required (Host role)

**Request Body:**

```json

{
  "name": "Beach House",
  "type": "house",
  "capacity": 6,
  "pricePerNight": 150,
  "description": "Beautiful beach house...",
  "amenities": ["wifi", "pool", "parking"]
}

```text

**Response:** `201 Created`

```json

{
  "success": true,
  "data": {
    "accommodation": {
      "id": "...",
      "name": "Beach House",
      ...
    }
  }
}

```text

**Error Responses:**

- `400` - Validation error
- `401` - Not authenticated
- `403` - Not authorized (must be host)
- `409` - Name already exists

## Rate Limiting

- **Authenticated**: 100 requests per minute
- **Anonymous**: 20 requests per minute

## Error Codes

| Code | Description |
|------|-------------|
| VALIDATION_ERROR | Input validation failed |
| NOT_FOUND | Resource not found |
| CONFLICT | Resource already exists |
| FORBIDDEN | Permission denied |

## Examples

### Search for beach houses

```bash

curl -X GET "https://api.hospeda.com/api/accommodations?q=beach&type=house"

```text

### Create accommodation

```bash

curl -X POST https://api.hospeda.com/api/accommodations \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Beach House",
    "type": "house",
    "capacity": 6,
    "pricePerNight": 150
  }'

```text
```text

---

## Component Documentation

### Component README

**Create README.md for complex components:**

```markdown

# AccommodationCard

Displays accommodation information in a card format with image, title, price, and key details.

## Usage

\`\`\`tsx
import { AccommodationCard } from '@/components/accommodation';

<AccommodationCard
  accommodation={accommodation}
  onSelect={handleSelect}
  variant="detailed"
/>
\`\`\`

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| accommodation | Accommodation | Yes | - | Accommodation data to display |
| onSelect | (id: string) => void | No | - | Callback when card is clicked |
| variant | "compact" \| "detailed" | No | "compact" | Display variant |
| showPrice | boolean | No | true | Whether to show price |
| loading | boolean | No | false | Show loading state |

## Variants

### Compact

Shows essential info: image, name, type, capacity, price

\`\`\`tsx
<AccommodationCard accommodation={data} variant="compact" />
\`\`\`

### Detailed

Shows full info: all compact info + description, amenities, rating

\`\`\`tsx
<AccommodationCard accommodation={data} variant="detailed" />
\`\`\`

## Accessibility

- ✅ Keyboard navigable (Tab, Enter)
- ✅ Screen reader friendly with ARIA labels
- ✅ Focus visible with ring
- ✅ Semantic HTML (article, heading, etc.)
- ✅ Alt text for images

## Styling

Uses Tailwind CSS and Shadcn UI components. Brand guidelines are applied automatically.

**Customization:**

\`\`\`tsx
<AccommodationCard
  accommodation={data}
  className="custom-card-styles"
/>
\`\`\`

## Examples

### Basic usage

\`\`\`tsx
<AccommodationCard accommodation={accommodation} />
\`\`\`

### With selection handler

\`\`\`tsx
<AccommodationCard
  accommodation={accommodation}
  onSelect={(id) => navigate(\`/accommodation/\${id}\`)}
/>
\`\`\`

### Loading state

\`\`\`tsx
<AccommodationCard
  accommodation={accommodation}
  loading={isLoading}
/>
\`\`\`

## Dependencies

- React 19
- Tailwind CSS
- Shadcn UI (Card, Badge, Button)
- Lucide icons

## Related Components

- `AccommodationList` - List of cards
- `AccommodationDetail` - Full detail view
- `AccommodationForm` - Create/edit form

```text

---

## Architecture Documentation

### Architecture Decision Records (ADRs)

**Document important architectural decisions:**

```markdown

# ADR-001: Use Drizzle ORM over Prisma

## Status

Accepted

## Context

We need an ORM for PostgreSQL that provides:

- Type safety
- Good performance
- Developer experience
- Flexibility for complex queries

## Decision

Use Drizzle ORM instead of Prisma.

## Rationale

**Why Drizzle:**

- Better TypeScript integration (types match database exactly)
- More control over queries (closer to SQL)
- Lighter bundle size (~15KB vs ~300KB for Prisma)
- Better performance for complex queries
- More flexible migrations

**Why not Prisma:**

- Less control over generated queries
- Heavier runtime
- Some limitations with complex relationships
- Migration system can be opinionated

## Consequences

### Positive

- Excellent type safety
- Better performance
- More control
- Smaller bundle

### Negative

- Smaller community
- Fewer third-party tools
- Team needs to learn Drizzle syntax
- Less mature ecosystem

### Neutral

- Need to build some utilities ourselves
- More SQL knowledge required

## Alternatives Considered

1. **Prisma**
   - Pros: Mature, large ecosystem, great DX
   - Cons: Less control, heavier, performance concerns

2. **TypeORM**
   - Pros: Mature, feature-rich
   - Cons: Decorator-heavy, less type-safe, heavier

3. **Kysely**
   - Pros: Excellent type safety, lightweight
   - Cons: More verbose, lower-level

## References

- [Drizzle Documentation](https://orm.drizzle.team)
- [Performance Comparison](https://github.com/drizzle-team/drizzle-orm/blob/main/drizzle-vs-prisma.md)

## Review

- **Date**: 2024-01-01
- **Reviewers**: Engineering Team
- **Next Review**: 2024-07-01 (or when pain points arise)

```text

---

## README Files

### Package README Template

```markdown

# @repo/service-core

Business logic layer for Hospeda platform.

## Overview

This package contains all service classes that implement business logic and coordinate between models (data layer) and API routes.

## Installation

\`\`\`bash
pnpm add @repo/service-core
\`\`\`

## Usage

\`\`\`typescript
import { UserService } from '@repo/service-core';

const service = new UserService(ctx);
const result = await service.create({ input, user });
\`\`\`

## Architecture

All services extend `BaseCrudService` which provides:

- `findById` - Get single record
- `findAll` - List with pagination
- `create` - Create record
- `update` - Update record
- `delete` - Soft delete record

## Available Services

- `UserService` - User management
- `AccommodationService` - Accommodation listings
- `BookingService` - Booking management
- `PaymentService` - Payment processing

## Development

\`\`\`bash

# Run tests

pnpm test

# Type check

pnpm typecheck

# Lint

pnpm lint
\`\`\`

## Documentation

See [Service Layer Documentation](../../docs/architecture/service-layer.md)
```text

---

## Code Comments

### When to Comment

**DO comment:**

```typescript
// Use exponential backoff to avoid overwhelming API during high traffic
const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);

// PostgreSQL full-text search with Spanish stemming
const results = await db.execute(sql`
  SELECT * FROM accommodations
  WHERE to_tsvector('spanish', name || ' ' || description)
  @@ plainto_tsquery('spanish', ${query})
`);

// TODO: Optimize with index on (userId, createdAt)
// Current: ~500ms for 10k records, Target: <50ms
const bookings = await db.query.bookings.findMany({
  where: eq(bookings.userId, userId),
  orderBy: desc(bookings.createdAt),
});
```text

**DON'T comment:**

```typescript
// ❌ BAD: Obvious
// Set user name
const userName = 'John';

// ❌ BAD: Redundant
// Loop through users
users.forEach(user => processUser(user));
```text

---

## Diagrams

### Use Mermaid

**Entity Relationships:**

```mermaid
erDiagram
    USER ||--o{ ACCOMMODATION : owns
    ACCOMMODATION ||--o{ BOOKING : has
    BOOKING ||--|| PAYMENT : requires
    USER ||--o{ BOOKING : makes

    USER {
        uuid id PK
        string name
        string email
        string role
    }

    ACCOMMODATION {
        uuid id PK
        uuid hostId FK
        string name
        string type
        int capacity
    }

    BOOKING {
        uuid id PK
        uuid accommodationId FK
        uuid userId FK
        date checkIn
        date checkOut
    }
```text

**Sequence Diagrams:**

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API
    participant Service
    participant Database

    User->>Frontend: Click "Book Now"
    Frontend->>API: POST /api/bookings
    API->>Service: create({ input, user })
    Service->>Database: Check availability
    Database-->>Service: Available
    Service->>Database: Create booking
    Database-->>Service: Booking created
    Service-->>API: { booking }
    API-->>Frontend: 201 Created
    Frontend-->>User: Show confirmation
```text

**Flowcharts:**

```mermaid
flowchart TD
    A[User Request] --> B{Authenticated?}
    B -->|No| C[Return 401]
    B -->|Yes| D{Has Permission?}
    D -->|No| E[Return 403]
    D -->|Yes| F[Validate Input]
    F --> G{Valid?}
    G -->|No| H[Return 400]
    G -->|Yes| I[Execute Business Logic]
    I --> J[Return 200]
```text

---

## Changelog

### Keep a CHANGELOG.md

```markdown

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Search functionality for accommodations

### Changed

- Improved performance of booking queries

## [1.2.0] - 2024-01-15

### Added

- Webhook support for booking notifications
- Email templates for confirmations
- Rate limiting on API endpoints

### Changed

- Updated Drizzle to v0.29.0
- Improved error messages

### Fixed

- Fixed pagination bug in accommodation list
- Fixed timezone handling in bookings

### Security

- Updated dependencies with security patches

## [1.1.0] - 2024-01-01

### Added

- Payment processing with Mercado Pago
- Admin dashboard

### Changed

- Migrated from Prisma to Drizzle ORM

## [1.0.0] - 2023-12-15

### Added

- Initial release
- User management
- Accommodation listings
- Booking system

```text

---

## Documentation Structure

```text
docs/
├── README.md                       # Overview and navigation
├── api/
│   ├── README.md                   # API overview
│   ├── accommodations.md           # Accommodations API
│   ├── bookings.md                 # Bookings API
│   └── users.md                    # Users API
├── architecture/
│   ├── README.md                   # Architecture overview
│   ├── decisions/
│   │   ├── ADR-001-drizzle-orm.md
│   │   └── ADR-002-monorepo.md
│   ├── diagrams/
│   │   ├── system-architecture.md
│   │   └── data-flow.md
│   └── layers/
│       ├── database-layer.md
│       ├── service-layer.md
│       ├── api-layer.md
│       └── frontend-layer.md
├── components/
│   ├── README.md                   # Component library overview
│   ├── AccommodationCard.md
│   └── BookingForm.md
├── deployment/
│   ├── README.md                   # Deployment overview
│   ├── vercel.md                   # Vercel deployment
│   ├── database.md                 # Database setup
│   └── environment.md              # Environment variables
└── guides/
    ├── getting-started.md          # Setup guide
    ├── adding-entity.md            # How to add entities
    ├── testing.md                  # Testing guide
    └── contributing.md             # Contribution guide
```text

---

## Summary Checklist

Before considering documentation complete:

- [ ] All exports have comprehensive JSDoc
- [ ] API endpoints have OpenAPI documentation
- [ ] Complex components have README files
- [ ] Architecture decisions documented (ADRs)
- [ ] Diagrams for complex flows
- [ ] CHANGELOG updated
- [ ] All examples work and are tested
- [ ] All documentation in English
- [ ] No broken links

---

**Documentation is not optional. Undocumented code will be rejected in code review.**

