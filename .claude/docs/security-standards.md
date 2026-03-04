# Security Standards (Quick Reference)

> Concise rules for AI agents. Full details: [docs/security/](../../docs/security/)

## Authentication

- NEVER check roles directly (`if (user.role === 'ADMIN')`)
- ALWAYS use `PermissionEnum` (`requirePermission(PermissionEnum.X)`)
- Sessions: HTTP-only cookies, server-side validation
- Three-tier API auth: public (none), protected (session), admin (session + permissions)

## Input Validation

- Zod validation on ALL inputs (body, params, query)
- Use `zValidator` middleware in Hono routes
- Sanitize HTML output to prevent XSS
- Never trust client-side validation alone

## API Security

- CORS: explicit origins only, no wildcards (`API_CORS_ORIGINS` env var)
- Rate limiting: Redis-based with in-memory fallback
- Web app: uses `/public/` and `/protected/` ONLY, never `/admin/`
- Admin app: uses `/admin/` ONLY (exception: `/api/v1/public/auth/me`)

## Database

- Drizzle ORM only, no raw SQL queries
- Parameterized queries (automatic with Drizzle)
- Soft delete by default (never hard delete user data)

## Secrets

- Environment variables validated with Zod schema at startup
- Use `HOSPEDA_` prefix for server-side secrets
- Use `PUBLIC_` prefix only for client-safe values
- Never hardcode secrets, tokens, or API keys
- Never commit `.env` files

## Dependencies

- Keep dependencies updated (security patches)
- Audit with `pnpm audit` regularly
- Prefer `@repo/*` internal packages over external ones

## Common Vulnerabilities to Avoid

- SQL injection: use Drizzle ORM (parameterized)
- XSS: sanitize user-generated HTML
- CSRF: SameSite cookies + CORS
- IDOR: permission checks on every resource access
- Mass assignment: Zod schemas whitelist allowed fields
