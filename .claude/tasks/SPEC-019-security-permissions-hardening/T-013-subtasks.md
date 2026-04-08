# T-013: Forced Password Change on First Super Admin Login

## Subtask Breakdown

### T-013a: Extend AdminInfo schema to include passwordChangeRequired flag

**Complexity**: 1
**Phase**: Schema

**What**: Add `passwordChangeRequired` (boolean) and `passwordChangedAt` (ISO date string) fields to the `AdminInfoType` Zod schema.

**Files to modify**:

- `packages/schemas/src/common/admin.schema.ts` - Add fields to AdminInfoSchema

**Steps**:

1. Read the current AdminInfoSchema definition
2. Add `passwordChangeRequired: z.boolean().optional().default(false)`
3. Add `passwordChangedAt: z.string().datetime().optional()` (ISO timestamp of last password change)
4. Ensure the inferred TypeScript type (`AdminInfoType`) includes the new fields
5. Run `pnpm --filter @repo/schemas build` to verify

**Acceptance Criteria**:

- AdminInfoType includes `passwordChangeRequired?: boolean`
- AdminInfoType includes `passwordChangedAt?: string`
- No DB migration needed (JSONB column, additive change)
- Schema builds without errors

---

### T-013b: Set passwordChangeRequired flag in super admin seed

**Complexity**: 1
**Phase**: Seed
**Blocked By**: T-013a

**What**: When the super admin is created by the seeder, set `adminInfo.passwordChangeRequired = true`.

**Files to modify**:

- `packages/seed/src/utils/superAdminLoader.ts` - Set flag when creating super admin

**Steps**:

1. Read superAdminLoader.ts (already modified in T-012 for random password)
2. When building the super admin user object, set `adminInfo: { passwordChangeRequired: true, notes: '', favorite: false }`
3. Add a log message: `[SEED] Super admin created with forced password change on first login`

**Acceptance Criteria**:

- Seeded super admin has `adminInfo.passwordChangeRequired = true`
- Other seeded users are NOT affected
- Existing unit tests pass

---

### T-013c: Expose passwordChangeRequired in /auth/me endpoint

**Complexity**: 1
**Phase**: API
**Blocked By**: T-013a

**What**: Include `passwordChangeRequired` in the `/api/v1/public/auth/me` response so the admin panel can check it.

**Files to modify**:

- `apps/api/src/routes/auth/me.ts` - Add field to actor response

**Steps**:

1. Read the current me.ts endpoint
2. When building the actor response from the user record, include `passwordChangeRequired: user.adminInfo?.passwordChangeRequired ?? false`
3. Ensure the response type/schema reflects the new field

**Acceptance Criteria**:

- GET /auth/me returns `passwordChangeRequired: true` for users with the flag set
- GET /auth/me returns `passwordChangeRequired: false` (or omits it) for normal users
- Unauthenticated requests (GUEST actor) are not affected

---

### T-013d: Create API endpoint to change own password

**Complexity**: 2
**Phase**: API
**Blocked By**: T-013a

**What**: Create a POST `/api/v1/protected/auth/change-password` endpoint that allows an authenticated user to change their own password and clear the `passwordChangeRequired` flag.

**Files to create/modify**:

- `apps/api/src/routes/auth/change-password.ts` - New route file
- `apps/api/src/routes/auth/index.ts` - Register the new route

**Steps**:

1. Create the route accepting `{ currentPassword: string, newPassword: string }`
2. Validate input with Zod schema (min password length, etc.)
3. Use Better Auth's verify-password + set-password flow (or the `changePassword` API if available)
4. On success, update the user's `adminInfo.passwordChangeRequired = false` and `adminInfo.passwordChangedAt = new Date().toISOString()`
5. Return success response
6. Write unit tests for: validation, wrong current password, successful change, flag cleared

**Acceptance Criteria**:

- Authenticated users can change their own password
- `passwordChangeRequired` flag is cleared after successful change
- `passwordChangedAt` is set to current timestamp
- Wrong current password returns 401
- Validation errors return 400
- Unauthenticated requests return 401

---

### T-013e: Create change-password page in admin panel

**Complexity**: 2
**Phase**: Frontend
**Blocked By**: T-013d

**What**: Create a `/change-password` route in the admin panel with a form for current password, new password, and confirmation.

**Files to create**:

- `apps/admin/src/routes/_authed/me/change-password.tsx` - New page

**Steps**:

1. Create the route component with TanStack Router `createFileRoute`
2. Build form with 3 fields: current password, new password, confirm password
3. Client-side validation: new password matches confirmation, minimum length
4. On submit, call POST `/api/v1/protected/auth/change-password`
5. On success, show toast + redirect to dashboard
6. On error, show error message inline
7. Use i18n for all user-facing text
8. Style with shadcn UI components (Input, Button, Card)

**Acceptance Criteria**:

- Page renders at `/me/change-password`
- Form validates all 3 fields
- Successful change redirects to dashboard with success toast
- Error messages displayed inline
- All text is i18n'd

---

### T-013f: Add route guard to redirect when passwordChangeRequired

**Complexity**: 2
**Phase**: Frontend
**Blocked By**: T-013c, T-013e

**What**: In the admin panel's `_authed.tsx` route guard, check if `passwordChangeRequired` is true and redirect to the change-password page.

**Files to modify**:

- `apps/admin/src/routes/_authed.tsx` - Add password change check after auth check
- `apps/admin/src/lib/auth-session.ts` - Include passwordChangeRequired in AuthState

**Steps**:

1. Update `AuthState` interface to include `passwordChangeRequired: boolean`
2. Extract `passwordChangeRequired` from the /auth/me response in `getAuthState()`
3. In `_authed.tsx` `beforeLoad`, after auth + role checks:
   - If `authState.passwordChangeRequired === true` AND current path is NOT `/me/change-password`
   - Then redirect to `/me/change-password`
4. The change-password page itself must NOT trigger the redirect (infinite loop prevention)

**Acceptance Criteria**:

- User with `passwordChangeRequired=true` is redirected to change-password on every page
- After changing password, user can navigate normally
- The change-password page itself is accessible (no redirect loop)
- Normal users (flag=false) are not affected

---

### T-013g: Add skip flag for test/CI environments

**Complexity**: 1
**Phase**: Configuration
**Blocked By**: T-013f

**What**: Add `SKIP_FORCE_PASSWORD_CHANGE=true` environment variable to bypass the forced password change in test/CI environments.

**Files to modify**:

- `apps/api/src/routes/auth/me.ts` - Respect skip flag
- `apps/api/src/utils/env.ts` - Add env var to schema
- `apps/api/.env.example` - Document the variable
- `.env.test` - Set to true

**Steps**:

1. Add `SKIP_FORCE_PASSWORD_CHANGE` to ApiEnvSchema (boolean, default false)
2. In the /auth/me endpoint, if `SKIP_FORCE_PASSWORD_CHANGE=true`, always return `passwordChangeRequired: false`
3. Add to .env.example with comment
4. Set to `true` in .env.test

**Acceptance Criteria**:

- Tests and CI skip the forced password change flow
- Production deploys enforce it by default
- Variable documented in .env.example

---

## Execution Order

```
T-013a (schema) ─┬─→ T-013b (seed)
                  ├─→ T-013c (API /auth/me) ──→ T-013f (route guard)
                  └─→ T-013d (API endpoint) ──→ T-013e (admin page) ──→ T-013f
                                                                         └─→ T-013g (test skip)
```

## Total Complexity: ~10 (was 4, now broken into 7 tasks of 1-2 each)
