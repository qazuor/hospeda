---
spec-id: SPEC-004
title: Clerk to Better Auth Migration
type: infrastructure
complexity: high
status: approved
created: 2026-02-11T23:30:00.000Z
approved: 2026-02-12T02:45:00.000Z
---

## SPEC-004: Clerk to Better Auth Migration

## Part 1 - Functional Specification

### 1. Overview & Goals

#### Goal

Migrate the entire Hospeda authentication system from Clerk (hosted SaaS) to Better Auth (self-hosted, open-source) across all three applications (API, Admin, Web) and shared packages, while creating a centralized email service package for the monorepo.

#### Motivation

- **Cost elimination**: Clerk charges $25/month + $0.02/MAU. Better Auth is MIT-licensed, free forever.
- **Data sovereignty**: All user data stays in our PostgreSQL database. No external auth service dependency.
- **Architectural simplification**: Eliminates the Clerk sync/webhook indirection layer. Better Auth writes directly to our DB.
- **Vendor independence**: No lock-in to Clerk's API, pricing changes, or service availability.
- **Self-hosted alignment**: Matches existing deployment model (Fly.io for API, Vercel for frontends).

#### Success Metrics

- All authentication flows (signup, signin, signout, OAuth) work without Clerk dependencies
- Zero Clerk packages remain in any `package.json`
- Zero Clerk environment variables in any config
- Billing integration works identically (customer creation, trial start, entitlements)
- All existing tests pass with updated mocks (>= 90% coverage maintained)
- Email verification flow works end-to-end via Resend
- Admin plugin features operational (ban, impersonate)
- Auth middleware chain performance equal or better than Clerk (< 50ms overhead)

#### Target Users

- **Accommodation owners (HOST)**: Sign up, manage profile, billing integration with auto-trial
- **Tourists (USER)**: Sign up, browse, manage favorites
- **Administrators (SUPER_ADMIN, ADMIN)**: User management, impersonation, ban/unban
- **Developers**: Clean auth abstraction, testable middleware, documented patterns

### 2. User Stories & Acceptance Criteria

#### US-001: Email/Password Registration

**As a** new visitor,
**I want** to create an account with email and password,
**So that** I can access authenticated features.

**Acceptance Criteria:**

- **Given** a visitor on the signup page
  **When** they enter valid email, password, first name, and last name
  **Then** an account is created in the `users` table with role=USER
  **And** an `account` record is created with providerId="credential"
  **And** a verification email is sent via Resend
  **And** a billing customer is created in QZPay via database hook
  **And** the user is redirected to email verification prompt

- **Given** an email that already exists
  **When** the visitor tries to register
  **Then** an appropriate error is shown (without revealing if email exists for security)

- **Given** a password that doesn't meet requirements (min 8 chars)
  **When** the visitor submits the form
  **Then** a validation error is shown before submission

#### US-002: Email Verification

**As a** newly registered user,
**I want** to verify my email address,
**So that** my account is fully activated.

**Acceptance Criteria:**

- **Given** a user who just registered
  **When** they click the verification link in their email
  **Then** their `emailVerified` field is set to true
  **And** they are redirected to the dashboard/home

- **Given** an expired verification link (> 24 hours)
  **When** the user clicks it
  **Then** they see an error with option to resend verification

#### US-003: Email/Password Sign In

**As a** registered user,
**I want** to sign in with my email and password,
**So that** I can access my account.

**Acceptance Criteria:**

- **Given** valid credentials
  **When** the user submits the sign-in form
  **Then** a session is created in the `session` table
  **And** a session cookie is set (httpOnly, secure, SameSite=lax)
  **And** the user is redirected to dashboard (admin) or previous page (web)

- **Given** invalid credentials
  **When** the user submits the form
  **Then** a generic error is shown ("Invalid email or password")
  **And** no session is created

- **Given** a banned user
  **When** they try to sign in
  **Then** they see a message that their account has been suspended
  **And** the ban reason is shown if available

#### US-004: OAuth Sign In (Google, Facebook)

**As a** visitor or registered user,
**I want** to sign in with Google or Facebook,
**So that** I can use my existing social account.

**Acceptance Criteria:**

- **Given** a visitor clicking "Sign in with Google"
  **When** they authorize the application
  **Then** an `account` record is created with providerId="google"
  **And** if no user exists with that email, a new user is created
  **And** if a user exists with that email (verified), the account is linked
  **And** a session is created
  **And** a billing customer is created via database hook (if new user)

- **Given** an existing user signing in with a new OAuth provider
  **When** account linking is enabled and email matches
  **Then** the new provider account is linked to the existing user
  **And** both providers can be used for future sign-ins

#### US-005: Sign Out

**As a** signed-in user,
**I want** to sign out,
**So that** my session is terminated securely.

**Acceptance Criteria:**

- **Given** a signed-in user
  **When** they click sign out
  **Then** the session is deleted from the `session` table
  **And** the session cookie is cleared
  **And** the user is redirected to the home page

#### US-006: Password Reset

**As a** user who forgot their password,
**I want** to reset it via email,
**So that** I can regain access to my account.

**Acceptance Criteria:**

- **Given** a user requesting password reset
  **When** they enter their email
  **Then** a reset link is sent via Resend (regardless of whether email exists)
  **And** the link contains a time-limited token (1 hour expiry)

- **Given** a valid reset link
  **When** the user enters a new password
  **Then** the password is updated (bcrypt hashed)
  **And** all existing sessions are invalidated
  **And** the user is redirected to sign in

#### US-007: Admin User Management

**As an** administrator,
**I want** to manage users (ban, unban, impersonate),
**So that** I can moderate the platform.

**Acceptance Criteria:**

- **Given** an admin viewing a user profile
  **When** they click "Ban user" and provide a reason
  **Then** the user's `banned` field is set to true
  **And** the `banReason` is stored
  **And** all active sessions for that user are revoked
  **And** the user cannot sign in until unbanned

- **Given** an admin wanting to debug a user issue
  **When** they click "Impersonate"
  **Then** a new session is created as that user
  **And** `impersonatedBy` field stores the admin's user ID
  **And** a visual indicator shows impersonation is active
  **And** the admin can stop impersonation to return to their own session

#### US-008: Billing Integration on Registration

**As a** newly registered user with role HOST,
**I want** my billing account to be automatically created,
**So that** I can start my trial immediately.

**Acceptance Criteria:**

- **Given** a new user is created (any role)
  **When** the database hook fires after user creation
  **Then** a billing customer is created in QZPay with `external_id = user.id`

- **Given** a user with role HOST
  **When** they complete registration
  **Then** a 14-day trial subscription is created on plan "owner-basico"
  **And** entitlements are immediately available

- **Given** billing customer creation fails
  **When** the user registers
  **Then** the user account is still created (non-blocking)
  **And** the error is logged for retry

#### US-009: Protected Routes

**As a** non-authenticated visitor,
**I want** to be redirected to sign-in when accessing protected routes,
**So that** the application is secure.

**Acceptance Criteria:**

- **Given** an unauthenticated request to `/dashboard` (admin)
  **When** the route loads
  **Then** the user is redirected to `/auth/signin` with return URL
  **And** after sign-in, they are redirected back to the original URL

- **Given** an authenticated request to `/auth/signin`
  **When** the route loads
  **Then** the user is redirected to `/dashboard` (already signed in)

### 3. UX Considerations

#### User Flows

**Registration flow:**

```
Visit signup → Fill form → Submit → Email sent → Click verify link → Dashboard
                  OR
Visit signup → Click Google/Facebook → Authorize → Dashboard (auto-verified)
```

**Sign-in flow:**

```
Visit signin → Enter credentials → Dashboard
       OR
Visit signin → Click Google/Facebook → Authorize → Dashboard
```

**Password reset flow:**

```
Visit signin → Click "Forgot password" → Enter email → Check inbox → Click link → New password → Sign in
```

#### Error States

- Network failure during OAuth: "Unable to connect. Please try again."
- Invalid/expired verification link: "This link has expired. [Resend verification email]"
- Account banned: "Your account has been suspended. Reason: {reason}. Contact support."
- Rate limited: "Too many attempts. Please try again in {time}."

#### Loading States

- OAuth redirect: "Redirecting to {provider}..."
- Form submission: Button shows spinner, inputs disabled
- Session check: Skeleton UI until session resolves

#### Accessibility

- All forms have proper labels, aria attributes, and error announcements
- OAuth buttons have descriptive text (not just icons)
- Keyboard navigation works for all auth flows
- Focus management on route changes and error states

### 4. Out of Scope

- **Two-Factor Authentication (2FA)**: Can be added later via BA plugin
- **Magic Links**: Can be added later via BA plugin
- **Phone number authentication**: Not needed currently
- **Organization plugin**: Not needed (no multi-tenant requirement)
- **Data migration from Clerk**: No real users exist (clean slate)
- **Billing system changes**: QZPay, MercadoPago, plans, entitlements, limits, addons remain unchanged
- **Mobile app authentication**: No mobile apps exist
- **API key / machine-to-machine auth**: Out of scope, can add bearer plugin later
- **Custom OAuth provider**: Hospeda as OAuth provider is not needed
- **SSO / SAML**: Enterprise features not needed

---

## Part 2 - Technical Analysis

### 1. Architecture

#### Pattern

Better Auth runs as an embedded auth handler within the Hono API server. It mounts on `/api/auth/*` and handles all auth endpoints (signin, signup, signout, OAuth callbacks, email verification, password reset, session management).

Frontend apps (admin, web) use the Better Auth React client SDK (`createAuthClient`) to interact with the auth endpoints.

#### Components

```
packages/
├── email/              # NEW: Centralized email service (Resend + React Email)
├── auth-ui/            # REWRITE: Auth components using BA client SDK
├── db/
│   ├── schemas/
│   │   ├── user/
│   │   │   ├── user.dbschema.ts          # MODIFY: Align with BA schema
│   │   │   ├── user_identity.dbschema.ts # DEPRECATE: Replaced by BA account table
│   │   │   ├── session.dbschema.ts       # NEW: BA session table
│   │   │   ├── account.dbschema.ts       # NEW: BA account table
│   │   │   └── verification.dbschema.ts  # NEW: BA verification table
│   │   └── ...
│   └── ...
├── config/
│   └── src/env.ts                        # MODIFY: Replace Clerk vars with BA vars
└── ...

apps/
├── api/
│   ├── src/
│   │   ├── lib/
│   │   │   └── auth.ts                   # NEW: Better Auth config (core file)
│   │   ├── middlewares/
│   │   │   ├── auth.ts                   # REWRITE: BA session-based auth
│   │   │   ├── actor.ts                  # MODIFY: Use BA session instead of Clerk
│   │   │   └── ...                       # billing/entitlement middlewares UNCHANGED
│   │   ├── routes/
│   │   │   └── auth/
│   │   │       ├── handler.ts            # NEW: BA catch-all handler
│   │   │       ├── sync.ts              # DELETE: No longer needed
│   │   │       ├── webhook.ts           # DELETE: No longer needed
│   │   │       └── signout.ts           # DELETE: BA handles this
│   │   ├── utils/
│   │   │   └── user-cache.ts            # SIMPLIFY or DELETE
│   │   └── services/
│   │       └── billing-customer-sync.ts  # MODIFY: Called from BA hooks
│   └── ...
├── admin/
│   ├── src/
│   │   ├── lib/
│   │   │   └── auth-client.ts            # NEW: BA React client
│   │   ├── routes/
│   │   │   ├── __root.tsx                # MODIFY: Replace ClerkProvider
│   │   │   ├── _authed.tsx               # MODIFY: BA session check
│   │   │   ├── auth.tsx                  # MODIFY: BA session check
│   │   │   └── auth/
│   │   │       ├── signin.tsx            # REWRITE: Use auth-ui SignInForm
│   │   │       ├── signup.tsx            # REWRITE: Use auth-ui SignUpForm
│   │   │       └── callback.tsx          # DELETE: BA handles callbacks internally
│   │   ├── integrations/clerk/           # DELETE: Entire directory
│   │   ├── hooks/use-auth-sync.ts        # DELETE: No longer needed
│   │   └── contexts/auth-context.tsx     # REWRITE: Use BA session
│   └── ...
└── web/
    ├── src/
    │   ├── middleware.ts                  # REWRITE: BA session check
    │   ├── pages/api/auth/[...all].ts    # NEW: BA catch-all for Astro
    │   └── components/auth/
    │       ├── ClerkRoot.tsx              # DELETE
    │       ├── AuthProvider.tsx           # REWRITE: BA client provider
    │       ├── SignInFormWrapper.tsx       # REWRITE: Use auth-ui
    │       ├── SignUpFormWrapper.tsx       # REWRITE: Use auth-ui
    │       └── UserNav.tsx                # REWRITE: Use auth-ui UserMenu
    └── ...
```

#### Data Flow

```
1. SIGN UP (Email/Password):
   Client → POST /api/auth/sign-up/email → Better Auth
   → Creates user in DB (users table)
   → databaseHooks.user.create.after fires:
     → billingCustomerSyncService.ensureCustomerExists()
     → If role=HOST: trialService.startTrial()
   → Sends verification email via Resend
   → Creates session → Returns session cookie

2. SIGN IN:
   Client → POST /api/auth/sign-in/email → Better Auth
   → Verifies credentials (bcrypt)
   → Creates session in DB → Returns session cookie

3. AUTHENTICATED REQUEST:
   Client → GET /api/v1/accommodations (with session cookie)
   → authMiddleware: auth.api.getSession(headers) → session + user
   → actorMiddleware: Creates Actor from session.user
   → billingCustomerMiddleware: getByExternalId(user.id) → UNCHANGED
   → entitlementMiddleware: loadEntitlements(customerId) → UNCHANGED
   → Route handler: uses Actor with entitlements

4. OAUTH:
   Client → GET /api/auth/sign-in/social?provider=google
   → Redirect to Google → User authorizes
   → GET /api/auth/callback/google → Better Auth
   → Creates/links account → Creates session → Redirect to app
```

#### Integration Points

- **Hono API**: BA handler mounted on `/api/auth/*`, middleware for session extraction
- **TanStack Start Admin**: BA React client for auth state, `beforeLoad` for route protection
- **Astro Web**: BA API route for SSR, React client for islands
- **Drizzle ORM**: BA Drizzle adapter manages auth tables directly
- **QZPay Billing**: Connected via BA database hooks (user.create.after)
- **Resend Email**: Connected via BA `sendVerificationEmail` and email package

### 2. Data Model Changes

#### Modified Table: `users`

Align with Better Auth's expected schema while keeping custom fields:

```typescript
// BEFORE (Clerk-oriented):
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  authProvider: text('auth_provider').$type<AuthProviderEnum>().default('CLERK'),
  authProviderUserId: text('auth_provider_user_id'),
  displayName: text('display_name'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  // ...
});

// AFTER (Better Auth compatible):
export const users = pgTable('users', {
  // BA required fields
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),                              // BA: maps to displayName
  email: text('email').notNull(),                   // BA: extracted from contactInfo
  emailVerified: boolean('email_verified').default(false), // BA: new
  image: text('image'),                             // BA: avatar URL

  // BA Admin plugin fields
  role: text('role').notNull().default('USER'),     // BA Admin: stores RoleEnum values
  banned: boolean('banned').default(false),          // BA Admin: new
  banReason: text('ban_reason'),                     // BA Admin: new
  banExpires: timestamp('ban_expires', { withTimezone: true }), // BA Admin: new

  // Custom fields (via additionalFields)
  slug: text('slug').notNull().unique(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  birthDate: timestamp('birth_date', { withTimezone: true }),
  contactInfo: jsonb('contact_info').$type<ContactInfo>(),
  location: jsonb('location').$type<FullLocationType>(),
  socialNetworks: jsonb('social_networks').$type<SocialNetwork>(),
  profile: jsonb('profile').$type<UserProfile>(),
  settings: jsonb('settings').$type<UserSettings>().notNull(),
  visibility: VisibilityPgEnum('visibility').default('PUBLIC'),
  lifecycleState: LifecycleStatusPgEnum('lifecycle_state').default('ACTIVE'),
  adminInfo: jsonb('admin_info'),

  // Audit fields
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdById: uuid('created_by_id'),
  updatedById: uuid('updated_by_id'),
});
```

**Changes:**

- ADD: `email` (text, not null) - extracted from contactInfo.email
- ADD: `emailVerified` (boolean, default false)
- ADD: `image` (text, nullable) - avatar URL
- ADD: `banned`, `banReason`, `banExpires` (BA Admin plugin)
- RENAME: `displayName` → `name` (BA field mapping)
- CHANGE: `role` from RolePgEnum to text (BA Admin uses string)
- REMOVE: `authProvider` (no longer needed - BA manages accounts)
- REMOVE: `authProviderUserId` (no longer needed - BA uses account table)
- REMOVE: unique index on `(authProvider, authProviderUserId)`

#### New Table: `session`

```typescript
export const session = pgTable('session', {
  id: text('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  impersonatedBy: text('impersonated_by'), // BA Admin plugin
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

#### New Table: `account`

```typescript
export const account = pgTable('account', {
  id: text('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(), // "credential", "google", "facebook"
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  idToken: text('id_token'),
  password: text('password'), // bcrypt hash for credential accounts
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

#### New Table: `verification`

```typescript
export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(), // email address
  value: text('value').notNull(),           // token
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
```

#### Deprecated Table: `user_auth_identities`

This table is replaced by Better Auth's `account` table. Drop it in migration after verifying no other code references it.

#### Migration Strategy

Since there are zero real users, the migration is clean:

1. Create new tables (session, account, verification)
2. Alter `users` table (add columns, remove Clerk columns)
3. Drop `user_auth_identities` table
4. Drop unique index on (authProvider, authProviderUserId)
5. No data migration needed

### 3. API Design

#### Better Auth Endpoints (auto-generated by BA)

All mounted under `/api/auth/*`:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/sign-up/email` | Email/password registration |
| POST | `/api/auth/sign-in/email` | Email/password sign in |
| POST | `/api/auth/sign-out` | Sign out (delete session) |
| GET | `/api/auth/sign-in/social?provider=google` | Initiate Google OAuth |
| GET | `/api/auth/sign-in/social?provider=facebook` | Initiate Facebook OAuth |
| GET | `/api/auth/callback/google` | Google OAuth callback |
| GET | `/api/auth/callback/facebook` | Facebook OAuth callback |
| POST | `/api/auth/forget-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password with token |
| POST | `/api/auth/verify-email` | Verify email with token |
| GET | `/api/auth/get-session` | Get current session |
| POST | `/api/auth/update-user` | Update user profile |
| POST | `/api/auth/change-password` | Change password |
| POST | `/api/auth/admin/ban-user` | Ban user (admin only) |
| POST | `/api/auth/admin/unban-user` | Unban user (admin only) |
| POST | `/api/auth/admin/impersonate-user` | Start impersonation |
| POST | `/api/auth/admin/stop-impersonation` | Stop impersonation |
| POST | `/api/auth/admin/list-users` | List all users |
| POST | `/api/auth/admin/remove-user` | Delete user |
| POST | `/api/auth/admin/set-role` | Change user role |

#### Removed Endpoints

| Method | Path | Reason |
|--------|------|--------|
| POST | `/api/v1/public/auth/sync` | BA writes directly to DB |
| POST | `/api/v1/public/auth/webhook` | No external service to send webhooks |
| POST | `/api/v1/public/auth/signout` | BA handles sign-out |
| GET | `/api/v1/public/auth/status` | BA `get-session` replaces this |

### 4. Dependencies

#### New Packages

| Package | Version | Purpose |
|---------|---------|---------|
| `better-auth` | `^1.4.0` | Core auth framework |
| `@daveyplate/better-auth-ui` | - | NOT used (custom auth-ui rewrite instead) |
| `resend` | `^4.0.0` | Email sending service |
| `@react-email/components` | `^0.0.30` | Email template components |
| `react-email` | `^3.0.0` | Email template dev server |
| `bcryptjs` | `^2.4.3` | Password hashing (Clerk compatibility) |

#### Removed Packages

| Package | App | Reason |
|---------|-----|--------|
| `@clerk/backend` | api | Replaced by better-auth |
| `@hono/clerk-auth` | api | Replaced by better-auth |
| `svix` | api | No webhooks needed |
| `@clerk/clerk-react` | admin, web, auth-ui | Replaced by better-auth/react |
| `@clerk/tanstack-react-start` | admin | Replaced by better-auth/react |
| `@clerk/astro` | web | Replaced by API route handler |

#### New Package: `@repo/email`

Centralized email service for the entire monorepo:

```
packages/email/
├── src/
│   ├── index.ts              # Main exports
│   ├── client.ts             # Resend client singleton
│   ├── send.ts               # Generic send function
│   └── templates/
│       ├── verify-email.tsx   # Email verification template
│       ├── reset-password.tsx # Password reset template
│       └── base-layout.tsx   # Shared layout component
├── package.json
└── tsconfig.json
```

### 5. Risks & Mitigations

| # | Risk | Probability | Impact | Mitigation |
|---|------|-------------|--------|------------|
| 1 | UUID vs text ID incompatibility in BA | Medium | Critical | Configure `generateId: () => crypto.randomUUID()` and use uuid columns in schema |
| 2 | Users table migration breaks existing FKs | Low | Critical | Add new columns first, migrate data, then remove old columns. All FKs reference `users.id` which doesn't change |
| 3 | OAuth callback URL misconfiguration | Medium | High | Document exact URLs. Test in staging before production |
| 4 | Better Auth Drizzle adapter edge cases | Medium | High | Test with exact PostgreSQL version. Pin BA version |
| 5 | Cookie-based auth vs JWT differences | Low | Medium | BA cookies work cross-origin with proper CORS config |
| 6 | Session table grows unbounded | Low | Medium | Add cron job to clean expired sessions weekly |
| 7 | Resend email deliverability | Low | Medium | Configure SPF/DKIM/DMARC for domain. Monitor bounce rates |
| 8 | BA Admin plugin conflicts with custom roles | Low | Medium | BA Admin `role` field is a string. Store RoleEnum values directly |
| 9 | Test suite breakage during migration | High | Low | Update all mocks systematically. Track with test checklist |
| 10 | CORS issues with cookie auth | Medium | Medium | Configure BA with `trustedOrigins` for all app domains |

### 6. Performance Considerations

#### Session Verification

- **Cookie caching enabled**: Session data cached in signed cookie (5-min TTL)
- First request: DB query to verify session (~2-5ms with index)
- Subsequent requests (within TTL): Cookie verification only (~0.1ms)
- **Net effect**: Faster than Clerk (which made external API calls)

#### Database Impact

- New `session` table: ~1 row per active user session
- Needs index on `token` (unique) and `userId` for lookups
- Expired session cleanup: Weekly cron job
- Estimated overhead: Negligible for < 10k concurrent sessions

#### Middleware Chain

```
BEFORE (Clerk):
  clerkMiddleware (JWT verify, ~10-50ms external)
  → actorMiddleware (UserCache lookup, ~1-5ms)
  → billingCustomerMiddleware (~1ms cache hit)
  → entitlementMiddleware (~1ms cache hit)
  Total: ~15-60ms

AFTER (Better Auth):
  authMiddleware (cookie cache hit, ~0.1ms | DB query ~2-5ms)
  → actorMiddleware (direct from session, ~0ms)
  → billingCustomerMiddleware (~1ms cache hit, UNCHANGED)
  → entitlementMiddleware (~1ms cache hit, UNCHANGED)
  Total: ~2-8ms
```

**Performance improvement: 3-10x faster** due to eliminating external Clerk API calls.

---

## Testing Strategy

### Unit Tests

| Component | Test Focus | Priority |
|-----------|-----------|----------|
| `apps/api/src/lib/auth.ts` | BA config, plugins, hooks registration | High |
| `apps/api/src/middlewares/auth.ts` | Session extraction, unauthenticated handling | High |
| `apps/api/src/middlewares/actor.ts` | Actor creation from BA session, guest fallback | High |
| `packages/email/src/send.ts` | Email sending, template rendering, error handling | High |
| `packages/auth-ui/src/sign-in-form.tsx` | Form validation, submission, error states | Medium |
| `packages/auth-ui/src/sign-up-form.tsx` | Registration flow, validation | Medium |
| `packages/auth-ui/src/user-menu.tsx` | Menu rendering, sign-out action | Medium |
| `packages/auth-ui/src/sign-out-button.tsx` | Sign-out action, redirect | Medium |

### Integration Tests

| Flow | Test Scenario | Priority |
|------|--------------|----------|
| Registration → Billing | Sign up → verify billing customer created in QZPay | Critical |
| Registration → Trial | Sign up as HOST → verify trial subscription started | Critical |
| Sign in → Session | Sign in → verify session cookie set → verify get-session works | Critical |
| OAuth → Account Link | Google sign in → verify account record → verify user created | High |
| Sign out → Cleanup | Sign out → verify session deleted → verify cookie cleared | High |
| Ban → Block | Admin bans user → verify user cannot sign in | High |
| Password reset | Request reset → verify email sent → reset → verify login works | Medium |
| Email verification | Register → verify email sent → verify link works | Medium |

### Regression Tests

| Area | What to Verify | Priority |
|------|---------------|----------|
| Billing middleware chain | Entitlements load correctly after auth change | Critical |
| Protected routes (admin) | All `/_authed/*` routes still require auth | Critical |
| Protected routes (web) | Authenticated features still work | High |
| Actor permissions | SUPER_ADMIN gets all permissions, GUEST gets none | High |
| Billing customer sync | Customer still created with correct external_id | Critical |

### Test Mock Updates

All 30+ test files that mock `@hono/clerk-auth` or `@clerk/clerk-react` must be updated to mock Better Auth instead. Create shared test utilities:

```typescript
// test/helpers/auth-mock.ts
export const createMockSession = (overrides?: Partial<Session>) => ({
  user: { id: 'test-user-uuid', email: 'test@example.com', role: 'USER', ...overrides?.user },
  session: { id: 'sess_test', token: 'tok_test', ...overrides?.session }
});

export const mockAuthMiddleware = (session: Session | null) => {
  // Mock Better Auth session resolution
};
```

---

## Implementation Approach

### Phase 1: Setup (Foundation)

1. Install Better Auth and dependencies
2. Create `@repo/email` package with Resend
3. Create Better Auth config file (`apps/api/src/lib/auth.ts`)
4. Generate and review BA Drizzle schema
5. Create DB migration for new tables and users table changes
6. Configure BA with Drizzle adapter, bcrypt, UUID generation

### Phase 2: Core Backend

7. Rewrite auth middleware (BA session-based)
8. Update actor middleware (use BA session directly)
9. Simplify/remove user cache
10. Create BA handler route (`/api/auth/*`)
11. Implement database hooks (billing customer creation, trial start)
12. Delete Clerk-specific routes (sync, webhook, signout)
13. Update env config and validation

### Phase 3: Core Frontend

14. Create BA React client for admin
15. Rewrite admin auth routes (signin, signup)
16. Update admin root layout (replace ClerkProvider)
17. Update admin route protection (_authed.tsx)
18. Create BA integration for Astro web
19. Rewrite web auth components
20. Update web middleware

### Phase 4: Auth UI Package

21. Rewrite SignInForm using BA client SDK
22. Rewrite SignUpForm using BA client SDK
23. Rewrite UserMenu using BA session
24. Rewrite SimpleUserMenu
25. Rewrite SignOutButton
26. Add password reset components
27. Add email verification components

### Phase 5: Integration

28. Update BillingCustomerSyncService metadata
29. Update seed scripts (super admin)
30. Update CI/CD env vars documentation
31. Configure OAuth providers (Google, Facebook) with new callback URLs

### Phase 6: Testing

32. Create shared auth test utilities
33. Update API test mocks (30+ files)
34. Update admin test mocks
35. Update auth-ui test mocks
36. Write integration tests for full auth flow
37. Write regression tests for billing integration
38. Verify coverage >= 90%

### Phase 7: Cleanup

39. Remove all Clerk package dependencies
40. Remove Clerk env vars from all configs
41. Delete unused files (clerk integrations, old auth routes)
42. Update documentation (CLAUDE.md files, AUTH_IMPLEMENTATION.md)
43. Clean up AuthProviderEnum (remove CLERK value)
44. Final typecheck and lint pass
