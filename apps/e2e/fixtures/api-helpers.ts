import { randomBytes } from 'node:crypto';
import { execSQL } from './db-helpers.ts';

/**
 * API helpers for E2E tests (SPEC-092 T-031).
 *
 * These helpers create test fixtures by hitting the REAL API endpoints
 * (signup, host-onboarding, accommodation create, etc.) so the full
 * stack — middleware, validation, service-core, DB — runs end to end.
 *
 * Some helpers fall back to direct SQL when the equivalent API endpoint
 * either doesn't exist (e.g. promote a USER to SUPER_ADMIN) or would
 * require complex multi-step setup that the test isn't validating
 * (e.g. seeding billing rows for HOST-03's expired-trial scenario).
 *
 * Every helper returns typed objects with the IDs callers need to drive
 * Playwright contexts. Cleanup is the test's responsibility — use
 * cleanupTestUsers from support/test-cleanup.ts in afterEach.
 */

// Ports match apps/e2e/.env.e2e (SSOT). Override via HOSPEDA_E2E_API_URL / HOSPEDA_E2E_WEB_URL.
const DEFAULT_API_BASE_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';
const DEFAULT_WEB_BASE_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:18321';

export type UserRole = 'USER' | 'HOST' | 'EDITOR' | 'ADMIN' | 'SUPER_ADMIN';

export interface CreatedUser {
    readonly id: string;
    readonly email: string;
    readonly password: string;
    /**
     * The hats the account holds after the fixture ran (HOS-296).
     *
     * Was a single `role: UserRole` mirroring the `users.role` scalar; that
     * column no longer exists, so a scalar here would be a mirror of nothing.
     * Signup always grants the baseline `USER`, so this is `['USER']` for a
     * plain user and `['USER', <requested>]` when `createUser` was asked for a
     * privileged hat.
     */
    readonly roles: readonly UserRole[];
    /** Better Auth session cookie value to attach to subsequent requests. */
    readonly sessionCookie: string;
}

export interface CreatedAccommodation {
    readonly id: string;
    readonly slug: string;
    readonly ownerId: string;
    readonly destinationId: string;
}

export interface ApiHelperConfig {
    readonly apiBaseUrl?: string;
    readonly webBaseUrl?: string;
}

function resolveBaseUrls(config?: ApiHelperConfig): {
    readonly apiBaseUrl: string;
    readonly webBaseUrl: string;
} {
    return {
        apiBaseUrl: config?.apiBaseUrl ?? DEFAULT_API_BASE_URL,
        webBaseUrl: config?.webBaseUrl ?? DEFAULT_WEB_BASE_URL
    };
}

/**
 * Generate a short random hex token. Uses node:crypto (not Math.random) so the
 * test passwords/emails it feeds into the real auth stack are not flagged by
 * CodeQL's `js/insecure-randomness` as cryptographically weak.
 */
function randomToken(byteLength = 8): string {
    return randomBytes(byteLength).toString('hex');
}

function randomEmail(): string {
    const suffix = `${Date.now()}-${randomToken(6)}`;
    return `e2e-${suffix}@hospeda-test.local`;
}

function randomPassword(): string {
    return `Test-${Date.now().toString(36)}-${randomToken(4)}-Aa1!`;
}

interface SignupResponse {
    user?: { id: string; email: string };
    token?: string;
}

/**
 * Signs up a new user via the public Better Auth endpoint and returns the
 * created user with an active session cookie.
 *
 * Flow:
 * 1. POST `/api/auth/sign-up/email` to create the user account.
 * 2. Force-verify the email via SQL so the sign-in step does not block on
 *    the email-verification gate (Better Auth has requireEmailVerification=true).
 * 3. POST `/api/auth/sign-in/email` to mint a real session cookie.
 *
 * Better Auth enforces CSRF protection via the `Origin` header on all
 * state-changing auth endpoints. Direct `fetch()` calls (not from a real
 * browser) do not send Origin automatically, so we must add it explicitly.
 * The value must match a configured trustedOrigin — HOSPEDA_SITE_URL
 * (`http://localhost:18321`) is always in the list for local E2E dev.
 *
 * Note: `createUser()` callers that pass `verifyEmail: false` can safely
 * skip the SQL force-verify step that happens inside this function —
 * `forceVerifyEmail` used in those callers is idempotent.
 */
export async function signupUser(
    options: {
        readonly email?: string;
        readonly password?: string;
        readonly name?: string;
    } = {},
    config?: ApiHelperConfig
): Promise<CreatedUser> {
    const { apiBaseUrl, webBaseUrl } = resolveBaseUrls(config);
    const email = options.email ?? randomEmail();
    const password = options.password ?? randomPassword();
    const name = options.name ?? 'E2E Test User';

    // Common headers required by Better Auth CSRF guard on state-changing
    // auth endpoints. Direct fetch() calls never send Origin automatically.
    const authHeaders = {
        'content-type': 'application/json',
        Origin: webBaseUrl
    } as const;

    // ── 1. Sign up ──────────────────────────────────────────────────────────
    const signupResponse = await fetch(`${apiBaseUrl}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ email, password, name })
    });
    if (!signupResponse.ok) {
        throw new Error(
            `signupUser: sign-up failed ${signupResponse.status} ${signupResponse.statusText} — ${await signupResponse.text()}`
        );
    }
    const signupData = (await signupResponse.json()) as SignupResponse;
    const userId = signupData.user?.id;
    if (!userId) {
        throw new Error('signupUser: sign-up response missing user id');
    }

    // ── 2. Force-verify email via SQL ────────────────────────────────────────
    // Better Auth has requireEmailVerification=true. Even in non-prod where
    // the API auto-verifies the email asynchronously (fire-and-forget), the
    // verification DB write races with the sign-in call below. Forcing it
    // synchronously here eliminates the race and makes tests deterministic.
    // The users table has `email_verified` (boolean) only — no _at column.
    await execSQL('UPDATE users SET email_verified = true WHERE id = $1', [userId]);

    // ── 3. Sign in to get a real session cookie ──────────────────────────────
    const signinResponse = await fetch(`${apiBaseUrl}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ email, password })
    });
    if (!signinResponse.ok) {
        throw new Error(
            `signupUser: sign-in failed ${signinResponse.status} ${signinResponse.statusText} — ${await signinResponse.text()}`
        );
    }
    const sessionCookie = extractSessionCookie(signinResponse.headers.get('set-cookie'));
    if (!sessionCookie) {
        throw new Error('signupUser: sign-in response missing session cookie');
    }

    return {
        id: userId,
        email,
        password,
        // Better Auth's after-create hook grants the baseline USER hat
        // (apps/api/src/lib/auth.ts — HOS-296), and it is the ONE step there
        // that is not swallowed, so a successful signup always holds it.
        roles: ['USER'],
        sessionCookie
    };
}

/**
 * Force-verifies a user's email by setting `emailVerifiedAt = now()` via SQL.
 * Avoids the need to poll Mailpit for tests that don't validate the email
 * delivery flow itself.
 */
export async function forceVerifyEmail(userId: string): Promise<void> {
    // The users table has `email_verified` (boolean) only — no _at column.
    await execSQL('UPDATE users SET email_verified = true WHERE id = $1', [userId]);
}

/**
 * Marks a freshly-created user as having completed onboarding, so the web app
 * lets them reach `/mi-cuenta/*` instead of bouncing them to the profile form.
 *
 * SPEC-113 added a middleware guard that redirects any signed-in user with
 * `profile_completed = false` to `/{locale}/mi-cuenta/completar-perfil/`.
 * `signupUser` leaves the column false, so every UI spec that navigates into the
 * account area lands on the completion form instead of the page under test — the
 * elements it looks for are legitimately absent, and the failure reads as a
 * missing feature rather than a redirect. Call this for any spec that drives the
 * account UI; API-only specs do not need it (the guard is web middleware).
 *
 * This is the E2E counterpart of `pnpm db:seed:ready-user` (SPEC-264), which
 * exists so seeded dev accounts skip the same friction.
 *
 * @param options.userId - The user to mark as onboarded.
 */
export async function markProfileCompleted(options: { readonly userId: string }): Promise<void> {
    await execSQL('UPDATE users SET profile_completed = true WHERE id = $1', [options.userId]);
}

/**
 * Refreshes a user's session by signing in again with their credentials.
 *
 * Better Auth still uses a cookie-based session cache (`better-auth.session_data`,
 * Max-Age=300s), but since HOS-296 **roles no longer travel in it**: `users.role`
 * was dropped, so Better Auth's `additionalFields` (a plain column mapping) has
 * no role source at all, and `actorMiddleware` reads the hats from `user_role`
 * on every request. A role granted a millisecond ago is therefore visible to
 * the very next API call on the SAME cookie — re-signing in is no longer what
 * makes a promotion take effect.
 *
 * The helper is kept because callers may still want a session minted after some
 * other mutation of the `users` row that the cookie cache DOES carry (e.g.
 * `service_suspended`, `banned`, display name). Do not add it to a test purely
 * to "pick up a new role" — that reason expired with the scalar.
 *
 * @param user - The user whose session should be refreshed (needs email + password)
 * @param config - Optional API config override
 * @returns A freshly minted session cookie
 */
export async function refreshSession(
    user: Pick<CreatedUser, 'email' | 'password'>,
    config?: ApiHelperConfig
): Promise<string> {
    const { apiBaseUrl, webBaseUrl } = resolveBaseUrls(config);
    const signinResponse = await fetch(`${apiBaseUrl}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Origin: webBaseUrl },
        body: JSON.stringify({ email: user.email, password: user.password })
    });
    if (!signinResponse.ok) {
        throw new Error(
            `refreshSession: sign-in failed ${signinResponse.status} — ${await signinResponse.text()}`
        );
    }
    const sessionCookie = extractSessionCookie(signinResponse.headers.get('set-cookie'));
    if (!sessionCookie) {
        throw new Error('refreshSession: sign-in response missing session cookie');
    }
    return sessionCookie;
}

/**
 * Creates a USER, force-verifies email, and (optionally) grants one extra hat.
 * The most common one-call test setup helper.
 *
 * When a role other than USER is requested, {@link setUserRole} writes the hat
 * to `user_role` and the returned user holds `['USER', <requested>]` — the
 * baseline hat from signup plus the requested one. Callers that need the
 * account to hold ONLY the requested privileged hat cannot get that: an account
 * with zero roles is a data bug the API logs loudly (see `actorMiddleware`), and
 * every real account holds `USER`.
 *
 * The session is re-minted after the grant. That is NOT what makes the role
 * visible any more (see {@link refreshSession} — roles are resolved per request
 * from `user_role`, not carried in the session cookie); it is kept only because
 * removing it changes the cookie every one of the ~40 calling test files runs
 * with, and that trade cannot be validated without a live e2e run.
 */
export async function createUser(
    options: {
        readonly role?: UserRole;
        readonly verifyEmail?: boolean;
    } = {},
    config?: ApiHelperConfig
): Promise<CreatedUser> {
    const user = await signupUser({}, config);
    if (options.verifyEmail !== false) {
        await forceVerifyEmail(user.id);
    }
    if (options.role && options.role !== 'USER') {
        await setUserRole(user.id, options.role);
        const freshCookie = await refreshSession(user, config);
        return { ...user, roles: ['USER', options.role], sessionCookie: freshCookie };
    }
    return user;
}

/**
 * Forces the user's set of hats to be exactly `{USER, role}` in `user_role`.
 *
 * Bypasses any business rule that would normally produce the hat (host
 * promotion on publish, commerce-lead approval, admin grant) — use only when
 * the test doesn't care about the path that produced it.
 *
 * **Semantics (HOS-296).** Before multi-role this wrote a scalar, so it was a
 * REPLACE: the caller was guaranteed the user held that role AND nothing else.
 * `security/sec-01-host-isolation` leans on both halves of that guarantee — its
 * two hosts must be hosts and nothing more — so a plain additive grant would
 * have been the wrong translation: it would silently leave behind any hat a
 * previous call had granted. This keeps the replace semantics and only carves
 * out the baseline `USER` hat, which every account holds and which `revokeRole`
 * refuses to remove in production (AC-5).
 *
 * Idempotent: the `(user_id, role)` primary key makes the insert a no-op when
 * the hat is already held, and the delete a no-op when there is nothing extra.
 * Insert runs BEFORE delete so the account never momentarily holds zero roles.
 *
 * @param userId - UUID of the user
 * @param role - The single privileged hat the user should end up holding
 */
export async function setUserRole(userId: string, role: UserRole): Promise<void> {
    // SELECT DISTINCT so that `setUserRole(id, 'USER')` does not try to insert
    // the same (user_id, role) pair twice within one statement.
    await execSQL(
        `INSERT INTO user_role (user_id, role, grant_reason)
         SELECT DISTINCT $1::uuid, wanted, 'e2e_fixture'
         FROM unnest(ARRAY[$2::role_enum, 'USER'::role_enum]) AS wanted
         ON CONFLICT (user_id, role) DO NOTHING`,
        [userId, role]
    );
    await execSQL(
        `DELETE FROM user_role
         WHERE user_id = $1 AND role <> $2::role_enum AND role <> 'USER'::role_enum`,
        [userId, role]
    );
}

/**
 * Direct shortcut for the HOST hat. Leaves the user holding `{USER, HOST}`.
 */
export async function promoteToHost(userId: string): Promise<void> {
    await setUserRole(userId, 'HOST');
}

interface MeResponse {
    // The route factory wraps the handler return inside { data: ... }.
    // The /me handler returns { actor: { id, roles, ... }, isAuthenticated, ... }
    // so the full envelope is: { success, data: { actor: { id, roles } }, metadata }.
    //
    // HOS-296: `actor.roles` is an ARRAY. This local type used to declare
    // `role?: string` — a hand-written mirror of a field the API no longer
    // emits, which the compiler cannot catch: the cast succeeds, the field is
    // `undefined`, and `getMe` would have returned `null` for every caller
    // (the `if (!actor.role) return null` guard below), turning every role
    // assertion into an assertion about nothing.
    data?: { actor?: { id: string; roles?: readonly string[] }; isAuthenticated?: boolean };
}

/**
 * Retrieves the actor that the API associates with the given session cookie.
 * Used by tests to assert role transitions after onboarding.
 *
 * @returns The actor id plus the hats it holds, or `null` when the session is
 *   not recognized / the response is not shaped as expected.
 */
export async function getMe(
    sessionCookie: string,
    config?: ApiHelperConfig
): Promise<{ readonly id: string; readonly roles: readonly string[] } | null> {
    const { apiBaseUrl, webBaseUrl } = resolveBaseUrls(config);
    const response = await fetch(`${apiBaseUrl}/api/v1/public/auth/me`, {
        headers: {
            cookie: sessionCookie,
            // Better Auth CSRF guard inspects the Origin header for session validation.
            // Direct fetch() calls do not send Origin automatically.
            Origin: webBaseUrl
        }
    });
    if (!response.ok) return null;
    const data = (await response.json()) as MeResponse;
    const actor = data.data?.actor;
    if (!actor?.id || !Array.isArray(actor.roles)) return null;
    return { id: actor.id, roles: actor.roles.filter((role) => typeof role === 'string') };
}

interface OnboardingStartResponse {
    data?: {
        status: 'created';
        accommodationId?: string;
        accommodationSlug?: string;
    };
}

/**
 * Calls the host-onboarding endpoint (the same one driven by
 * /publicar/nueva on the web app). Used for HOST-01 setups and HOST-07
 * create-always / republish tests. Since BETA-197 the endpoint always
 * returns `status: 'created'` (auto-resume was removed).
 *
 * The API schema (AccommodationCreateDraftHttpSchema) expects:
 *   - `type`: AccommodationTypeEnum value (APARTMENT, HOUSE, etc.) — uppercase.
 *   - `destinationId`: UUID string.
 *
 * This helper accepts both `destinationId` and the legacy `cityDestinationId`
 * alias (for backward compatibility with existing test callers) and maps both
 * to the correct `destinationId` field in the JSON body. The `type` value is
 * uppercased automatically so callers that pass `'house'` still work.
 */
export async function startHostOnboarding(
    options: {
        readonly sessionCookie: string;
        readonly name: string;
        readonly summary: string;
        readonly type: string;
        /** Canonical field name matching AccommodationCreateDraftHttpSchema. */
        readonly destinationId?: string;
        /** @deprecated Use `destinationId` instead. Kept for backward compatibility. */
        readonly cityDestinationId?: string;
    },
    config?: ApiHelperConfig
): Promise<{
    readonly status: 'created';
    readonly accommodationId: string | null;
    readonly accommodationSlug: string | null;
}> {
    const { apiBaseUrl, webBaseUrl } = resolveBaseUrls(config);
    // Support legacy `cityDestinationId` callers — map to `destinationId`.
    const destinationId = options.destinationId ?? options.cityDestinationId;
    // The API enum requires uppercase (HOUSE, APARTMENT, etc.).
    const accommodationType = options.type.toUpperCase();
    const response = await fetch(`${apiBaseUrl}/api/v1/protected/host-onboarding/start`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            // Better Auth CSRF guard inspects the Origin header on ALL requests —
            // including session validation on protected routes. Direct fetch() calls
            // do not send Origin automatically; we must set it explicitly so the
            // auth middleware can reconstruct the session from the cookie.
            Origin: webBaseUrl,
            cookie: options.sessionCookie
        },
        body: JSON.stringify({
            name: options.name,
            summary: options.summary,
            type: accommodationType,
            destinationId
        })
    });
    if (!response.ok) {
        throw new Error(
            `startHostOnboarding failed: ${response.status} — ${await response.text()}`
        );
    }
    const data = (await response.json()) as OnboardingStartResponse;
    if (!data.data) {
        throw new Error('startHostOnboarding: response missing data');
    }
    return {
        status: data.data.status,
        accommodationId: data.data.accommodationId ?? null,
        accommodationSlug: data.data.accommodationSlug ?? null
    };
}

/**
 * Picks a CITY destination from the seeded data. Tests that don't care
 * which city is used can rely on this returning a stable seed entry.
 */
export async function getAnyCityDestinationId(): Promise<string> {
    const rows = await execSQL<{ id: string }>(
        `SELECT id FROM destinations
         WHERE destination_type = 'CITY' AND deleted_at IS NULL
         ORDER BY created_at ASC
         LIMIT 1`
    );
    const id = rows[0]?.id;
    if (!id) {
        throw new Error(
            'getAnyCityDestinationId: no CITY destination found — seed the E2E database first'
        );
    }
    return id;
}

/**
 * Creates a DRAFT accommodation owned by `ownerId` directly via SQL.
 * Use when a test needs an accommodation but doesn't want to drive the
 * full host-onboarding UI flow.
 *
 * `extraInfo` defaults to a COMPLETE capacity payload (`capacity`, `minNights`,
 * `bedrooms`, `bathrooms` all present) so accommodations created through this
 * helper clear `AccommodationService.publish()`'s capacity-completeness guard
 * (HOS-152) and reach the behaviour the calling spec actually targets
 * (subscription-required, qzpay-timeout, tx-compensation, api-down) instead
 * of failing earlier with a capacity `VALIDATION_ERROR`. Pass `extraInfo: {}`
 * (or a partial object) explicitly to test the incomplete-capacity path.
 */
export async function createAccommodation(options: {
    readonly ownerId: string;
    readonly destinationId?: string;
    readonly slugPrefix?: string;
    readonly lifecycleState?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
    readonly extraInfo?: Record<string, unknown>;
}): Promise<CreatedAccommodation> {
    const destinationId = options.destinationId ?? (await getAnyCityDestinationId());
    const slug = `${options.slugPrefix ?? 'e2e-acc'}-${Date.now().toString(36)}-${randomToken(2)}`;
    const lifecycleState = options.lifecycleState ?? 'DRAFT';
    const extraInfo = options.extraInfo ?? {
        capacity: 4,
        minNights: 1,
        bedrooms: 2,
        bathrooms: 1
    };
    const rows = await execSQL<{ id: string }>(
        `INSERT INTO accommodations (
             slug, name, summary, description, type,
             owner_id, destination_id, lifecycle_state,
             visibility, moderation_state, is_featured, extra_info,
             created_at, updated_at
         ) VALUES (
             $1, $2, $3, $4, $5::accommodation_type_enum,
             $6, $7, $8::lifecycle_status_enum,
             'PUBLIC'::visibility_enum, 'APPROVED'::moderation_status_enum, false, $9::jsonb,
             NOW(), NOW()
         ) RETURNING id`,
        [
            slug,
            'E2E Test Accommodation',
            'E2E summary',
            'E2E test accommodation for SPEC-092 fixtures.',
            'HOUSE',
            options.ownerId,
            destinationId,
            lifecycleState,
            JSON.stringify(extraInfo)
        ]
    );
    const id = rows[0]?.id;
    if (!id) throw new Error('createAccommodation: insert returned no id');
    return {
        id,
        slug,
        ownerId: options.ownerId,
        destinationId
    };
}

/**
 * Inserts a billing customer + subscription row for the given user with
 * the requested status. Used to set up trial / active / canceled / expired
 * states without driving the full MP checkout flow.
 *
 * The shape of `billing_subscriptions` and `billing_customers` is owned by
 * @qazuor/qzpay-core; the columns referenced here match the migrations
 * applied at the time of writing. Adjust if the upstream schema evolves.
 */
/**
 * Resolves the billing customer for a user, creating it when absent, and returns
 * its id. Idempotent.
 *
 * Split out of {@link createSubscription} so a test can get a customer WITHOUT
 * also getting a subscription. The resilience suite needs exactly that: it arms a
 * `createSubscription` failure scoped to a `customerId` (the scope key the
 * test-control seam extracts — HOS-171), and that id has to be known BEFORE the
 * checkout that would otherwise create the customer on demand. Scoping matters:
 * an unscoped entry is consumed by whichever parallel worker calls first.
 *
 * Note the id here is `billing_customers.id`, NOT the user id — the two are linked
 * by `external_id`. Arming a failure scoped to a user id silently matches nothing.
 */
export async function ensureBillingCustomer(options: {
    readonly userId: string;
}): Promise<{ readonly customerId: string }> {
    // billing_customers.external_id has no UNIQUE constraint — only a regular btree
    // index. Use SELECT-or-INSERT pattern instead of ON CONFLICT.
    // billing_customers also requires `email` (NOT NULL).
    // Filter by livemode=false to match the E2E sandbox environment.
    const existingCustomer = await execSQL<{ id: string }>(
        'SELECT id FROM billing_customers WHERE external_id = $1 AND livemode = false LIMIT 1',
        [options.userId]
    );
    const existingId = existingCustomer[0]?.id;
    if (existingId) {
        return { customerId: existingId };
    }

    // Derive a placeholder email from the userId for seed/test rows.
    const placeholderEmail = `e2e-billing-${options.userId}@hospeda-test.local`;
    // livemode=false: the E2E environment runs with HOSPEDA_MERCADO_PAGO_SANDBOX=true,
    // so QZPay's livemode=false. The Drizzle adapter filters by livemode, so rows
    // inserted with livemode=true (the column default) are invisible to the adapter.
    const insertedCustomer = await execSQL<{ id: string }>(
        `INSERT INTO billing_customers (external_id, email, segment, livemode, created_at, updated_at)
         VALUES ($1, $2, 'host', false, NOW(), NOW())
         RETURNING id`,
        [options.userId, placeholderEmail]
    );
    const customerId = insertedCustomer[0]?.id;
    if (!customerId) {
        throw new Error('ensureBillingCustomer: customer insert returned no id');
    }
    return { customerId };
}

export async function createSubscription(options: {
    readonly userId: string;
    readonly planId: string;
    readonly status: 'trialing' | 'active' | 'canceled' | 'expired';
    readonly periodEnd?: Date;
}): Promise<{ readonly customerId: string; readonly subscriptionId: string }> {
    // Resolves-or-creates; throws rather than returning an id-less customer.
    const { customerId } = await ensureBillingCustomer({ userId: options.userId });

    const periodEnd = options.periodEnd ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const periodStart = new Date(); // billing_subscriptions.current_period_start is NOT NULL
    // livemode=false: matches the E2E environment's sandbox livemode (see customer insert above).
    const subRows = await execSQL<{ id: string }>(
        `INSERT INTO billing_subscriptions (
             customer_id, plan_id, status,
             billing_interval, interval_count,
             current_period_start, current_period_end,
             livemode, created_at, updated_at
         ) VALUES ($1, $2, $3, 'month', 1, $4, $5, false, NOW(), NOW())
         RETURNING id`,
        [customerId, options.planId, options.status, periodStart, periodEnd]
    );
    const subscriptionId = subRows[0]?.id;
    if (!subscriptionId) throw new Error('createSubscription: subscription insert returned no id');
    return { customerId, subscriptionId };
}

/**
 * Resolves a seeded billing plan id from its slug.
 *
 * The seed stores the plan slug in `billing_plans.name` (see billingPlans.seed.ts),
 * and the E2E sandbox runs with `livemode = false`, so both must be matched — a
 * lookup that ignores `livemode` can return the production-mode row, whose id the
 * QZPay Drizzle adapter then refuses to see.
 *
 * @param options.slug - Plan slug as seeded, e.g. `tourist-plus`.
 * @returns The plan id, or `null` when the plan is not seeded in this environment.
 */
export async function resolvePlanIdBySlug(options: { readonly slug: string }): Promise<{
    readonly planId: string | null;
    readonly limits: Readonly<Record<string, number>> | null;
}> {
    const rows = await execSQL<{ id: string; limits: Record<string, number> | null }>(
        'SELECT id, limits FROM billing_plans WHERE name = $1 AND livemode = false LIMIT 1',
        [options.slug]
    );
    const row = rows[0];
    if (!row) return { planId: null, limits: null };
    return { planId: row.id, limits: row.limits ?? {} };
}

/**
 * Signs in an already-existing user (seeded or previously created) and
 * returns their session cookie. Use this for tests that authenticate as a
 * known seeded account (e.g. the commerce-owner Julieta) rather than
 * creating a fresh user per test.
 *
 * The underlying mechanism is identical to the sign-in step inside
 * `signupUser`: POST to `/api/auth/sign-in/email` with the required Better
 * Auth CSRF `Origin` header.
 *
 * @param options.email    - Existing user's email address.
 * @param options.password - Existing user's password.
 * @returns The session cookie string to use in `cookie` request headers or
 *   `page.context().addCookies()`.
 */
export async function signInExistingUser(
    options: {
        readonly email: string;
        readonly password: string;
    },
    config?: ApiHelperConfig
): Promise<string> {
    const { apiBaseUrl, webBaseUrl } = resolveBaseUrls(config);
    const signinResponse = await fetch(`${apiBaseUrl}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            // Better Auth CSRF guard requires a trusted Origin on state-changing
            // endpoints. Direct fetch() calls do not send Origin automatically.
            Origin: webBaseUrl
        },
        body: JSON.stringify({ email: options.email, password: options.password })
    });
    if (!signinResponse.ok) {
        throw new Error(
            `signInExistingUser: sign-in failed ${signinResponse.status} ${signinResponse.statusText} — ${await signinResponse.text()}`
        );
    }
    const sessionCookie = extractSessionCookie(signinResponse.headers.get('set-cookie'));
    if (!sessionCookie) {
        throw new Error('signInExistingUser: sign-in response missing session cookie');
    }
    return sessionCookie;
}

/**
 * Creates a conversation row for an authenticated guest on a specific accommodation.
 * The host is derived from the accommodation's owner_id — no host column exists.
 * Used by MSG-01 and resilience tests that need a pre-existing conversation.
 *
 * SPEC-105 T-105-04: fixed column drift — conversations table has user_id (guest)
 * and accommodation_id only; host is always resolved via accommodations.owner_id.
 * Valid statuses: PENDING_VERIFICATION | PENDING_OWNER | PENDING_GUEST | OPEN | CLOSED | BLOCKED.
 */
export async function createConversation(options: {
    readonly guestUserId: string;
    readonly accommodationId: string;
    readonly subject?: string;
}): Promise<{ readonly id: string }> {
    const rows = await execSQL<{ id: string }>(
        `INSERT INTO conversations (
             user_id, accommodation_id,
             subject, status, created_at, updated_at
         ) VALUES ($1, $2, $3, 'OPEN', NOW(), NOW())
         RETURNING id`,
        [options.guestUserId, options.accommodationId, options.subject ?? 'E2E test conversation']
    );
    const id = rows[0]?.id;
    if (!id) throw new Error('createConversation: insert returned no id');
    return { id };
}

function extractSessionCookie(setCookieHeader: string | null): string | null {
    if (!setCookieHeader) return null;
    // Better Auth emits TWO cookies: `better-auth.session_token` and
    // `better-auth.session_data`. BOTH must be forwarded — sending only
    // session_token is not enough for the session to be recognized.
    //
    // Node.js fetch returns all Set-Cookie headers joined by `, `. We split
    // on `, ` boundaries before a new cookie name. Cookie names follow the
    // pattern `[word chars].[word chars]` (e.g. `better-auth.session_data`),
    // so the lookahead MUST include `.` in the character class — without it
    // the regex fails to split at `better-auth.session_data=` and only the
    // first cookie is extracted, causing 401 on all subsequent requests.
    //
    // Better Auth URL-encodes cookie values in the Set-Cookie header
    // (e.g. `%3D` for `=`). The Cookie request header accepts the decoded
    // form just fine, so we decode for readability.
    const cookies = setCookieHeader
        .split(/,(?=\s*[A-Za-z0-9_.-]+=)/)
        .map((entry) => {
            const nameValue = entry.split(';')[0]?.trim();
            if (!nameValue) return null;
            const eqIdx = nameValue.indexOf('=');
            if (eqIdx === -1) return nameValue;
            const name = nameValue.slice(0, eqIdx);
            const rawValue = nameValue.slice(eqIdx + 1);
            try {
                return `${name}=${decodeURIComponent(rawValue)}`;
            } catch {
                // Malformed percent-encoding — return raw value as-is.
                return nameValue;
            }
        })
        .filter((entry): entry is string => Boolean(entry));
    return cookies.length > 0 ? cookies.join('; ') : null;
}
