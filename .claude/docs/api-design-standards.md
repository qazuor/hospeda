# API Design Standards (Quick Reference)

> Concise rules for AI agents. Full details: [docs/guides/adding-api-routes.md](../../docs/guides/adding-api-routes.md)

## Route Tiers

| Tier | Pattern | Auth | Consumer |
|------|---------|------|----------|
| Public | `/api/v1/public/*` | None | Web app (public pages) |
| Protected | `/api/v1/protected/*` | User session | Web app (user features) |
| Admin | `/api/v1/admin/*` | Admin + permissions | Admin panel |

### Critical Rules

- Web app: uses `public` + `protected` ONLY. **NEVER** `admin`.
- Admin app: uses `admin` ONLY. Exception: `/api/v1/public/auth/me`.
- Never expose admin functionality through public/protected routes.

## Route Factories

| Factory | Use Case |
|---------|----------|
| `createSimpleRoute` | Basic GET endpoint |
| `createOpenApiRoute` | Route with OpenAPI spec |
| `createListRoute` | Paginated list with filters |
| `createAdminListRoute` | Admin list (auto-merges PaginationQuerySchema) |

### createAdminListRoute Gotchas

- Auto-merges `PaginationQuerySchema` into query schema
- Uses `page` + `pageSize` (NOT `limit`)
- Rejects unknown query parameters
- Billing endpoints from qzpay-hono DO accept `limit` natively

## Response Format

Always use `ResponseFactory`:

- `success(c, data)` - 200
- `created(c, data)` - 201
- `noContent(c)` - 204
- `badRequest(c, message)` - 400
- `unauthorized(c)` - 401
- `forbidden(c)` - 403
- `notFound(c, message)` - 404
- `error(c, error)` - 500

Never use raw `c.json()`.

## Validation

- Use `zValidator('json', Schema)` for request body
- Use `zValidator('param', Schema)` for URL params
- Use `zValidator('query', Schema)` for query strings
- Schemas from `@repo/schemas` only

## Permissions

- ALWAYS: `requirePermission(PermissionEnum.X)`
- NEVER: `if (user.role === 'ADMIN')`

## Route Handler Pattern

- Keep handlers thin (delegate to services)
- No business logic in route files
- Services extend `BaseCrudService` from `@repo/service-core`
- Services return `Result<T>` type
