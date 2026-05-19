# T-001 — Diagnosis of A-1 (admin/users 500)

- **Date**: 2026-05-14
- **Outcome**: ✅ ROOT CAUSE IDENTIFIED

## Reproduction

```
GET /api/v1/admin/users?page=1&pageSize=1
→ 500 INTERNAL_ERROR
   "Response payload does not match declared schema"

GET /api/v1/admin/users/a0000000-0000-4000-8000-000000000001  (SYSTEM user)
→ 500 INTERNAL_ERROR (same error)

GET /api/v1/admin/users/52947192-cb19-49c3-a18c-d1eb04610625  (ADMIN user)
→ 200 ✓

GET /api/v1/admin/users?search=admin
→ 200 ✓ (returns 2 users, SYSTEM excluded by search)
```

## Root cause

The single `SYSTEM` user (`a0000000-0000-4000-8000-000000000001`) breaks the entire list because
its `profile` column in `users` is **NULL** in the DB.

Schema declaration in `packages/schemas/src/entities/user/user.access.schema.ts:57-58`:

```ts
profile: UserProfileSchema.optional(),
settings: UserSettingsSchema.optional(),
```

Zod's `.optional()` permits `undefined` but **rejects `null`**. Drizzle returns `null` for empty
JSONB columns. The SYSTEM user has `profile = NULL` in DB → schema rejects → INTERNAL_ERROR
500 → entire list fails because `createPaginatedResponse` parses each item independently and
throws on the first failure.

```sql
SELECT profile IS NULL FROM users WHERE id = 'a0000000-0000-4000-8000-000000000001';
-- t

SELECT profile IS NULL FROM users WHERE id = '52947192-cb19-49c3-a18c-d1eb04610625';
-- f (has avatar + bio object)
```

## Fix

Change in `packages/schemas/src/entities/user/user.access.schema.ts` (UserProtectedSchema lines 57-58):

```ts
- profile: UserProfileSchema.optional(),
- settings: UserSettingsSchema.optional(),
+ profile: UserProfileSchema.nullish(),
+ settings: UserSettingsSchema.nullish(),
```

`.nullish()` permits both `null` and `undefined`, matching Drizzle's behavior for nullable JSONB
columns.

## Likely related fixes (A-2..A-6 same family)

Audit other admin schemas for `.optional()` on JSONB / nullable columns, applying the same
`.nullish()` rewrite. Candidates from initial inventory:

- `PostAdminSchema` — fields like `seo`, `relations`, `media`, `sponsorship` (likely JSONB).
- `InternalTagAdminSchema`, `PostTagAdminSchema`, `SystemTagAdminSchema` — fields like
  `metadata`, `attributes`, possibly `assignments` (likely JSONB).
- `AccommodationAdminDetailSchema` — fields like `location`, `contact`, `media`, `pricing`,
  `faq`, `seo`, `extraInfo` (all candidates for `.nullish()`).

## Contract test (proposed for T-002)

In `apps/api/test/routes/admin/users/list.test.ts`:

```ts
it('list returns 200 when a user has NULL profile/settings', async () => {
  // Seed a user with profile = null, settings = null (mimic SYSTEM user)
  // Call GET /api/v1/admin/users?page=1&pageSize=10
  // Expect 200 and items[]
  // Parse response.data.items[i] through UserAdminSchema and expect success
});
```

## Acceptance for T-002

- `GET /api/v1/admin/users?page=1&pageSize=25` returns 200.
- Dashboard "Users" counter renders the actual count.
- `/access/users` page shows the user list.
- Contract test added and passing.
