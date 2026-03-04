# ADR-002: Better Auth over Clerk for Authentication

## Status

Accepted

## Context

The platform initially used Clerk for authentication. As the project matured, several concerns emerged:

- **Vendor lock-in** .. Clerk owns the user data, session management, and auth flow. Migrating away requires significant effort.
- **Pricing concerns** .. Clerk's per-MAU pricing becomes expensive at scale, particularly for a platform targeting the Argentine market where revenue per user is lower.
- **Limited Argentina payment integration** .. Clerk's built-in billing features do not support MercadoPago or ARS natively, requiring a separate billing layer regardless.
- **Custom role requirements** .. The platform needs specific roles (HOST, GUEST, ADMIN, EDITOR, SPONSOR) with granular permission-based authorization that was awkward to model in Clerk's role system.
- **Data sovereignty** .. Hosting user data on third-party US servers raises concerns for an Argentina-focused platform.

## Decision

We migrated from Clerk to **Better Auth**, a self-hosted authentication library. Auth data is stored in our own PostgreSQL database alongside the rest of the platform data.

## Consequences

### Positive

- **Full control over auth flow** .. Custom login, registration, password reset, and session management tailored to the platform's needs.
- **No vendor lock-in** .. User data lives in our database. The auth layer can be swapped without losing user accounts.
- **Custom roles and permissions** .. The platform implements five roles (HOST, GUEST, ADMIN, EDITOR, SPONSOR) with fine-grained permission-based authorization using `PermissionEnum` values.
- **No per-user pricing** .. Authentication cost is limited to infrastructure (database, compute), which scales more predictably.
- **Unified data model** .. Auth data coexists with business data in the same PostgreSQL instance, simplifying queries and maintaining referential integrity.

### Negative

- **More maintenance burden** .. The team is responsible for security patches, session management edge cases, and auth infrastructure uptime.
- **Had to build auth UI** .. Clerk provides pre-built UI components. With Better Auth, the team built custom sign-in, sign-up, and account management pages (the `@repo/auth-ui` package).
- **Security responsibility** .. Self-hosted auth means the team must handle password hashing, token rotation, CSRF protection, and other security concerns directly.

### Neutral

- Migration required a one-time effort to move existing Clerk users to the new system.
- Better Auth's TypeScript-first design aligns well with the project's strict TypeScript approach.

## Alternatives Considered

### Clerk (status quo)

Keeping Clerk was considered but rejected due to the vendor lock-in, pricing trajectory, and inability to deeply customize the role and permission system for the platform's multi-role architecture.

### Auth.js (NextAuth)

Auth.js was evaluated but found to have fewer features than Better Auth, particularly around:

- Built-in role and permission management.
- Session handling flexibility.
- TypeScript type safety in the auth configuration.

### Supabase Auth

Supabase Auth would tie the platform to the Supabase ecosystem, creating a different form of vendor lock-in. The platform uses Drizzle ORM with raw PostgreSQL, and adding Supabase solely for auth did not justify the dependency.

### Custom JWT Implementation

Building authentication from scratch with JWT was rejected as too much work and too high a security risk. Better Auth provides a well-tested foundation while still allowing full customization.
