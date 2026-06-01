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

const DEFAULT_API_BASE_URL = 'http://localhost:3001';
const DEFAULT_WEB_BASE_URL = 'http://localhost:4321';

export type UserRole = 'USER' | 'HOST' | 'ADMIN' | 'SUPER_ADMIN';

export interface CreatedUser {
    readonly id: string;
    readonly email: string;
    readonly password: string;
    readonly role: UserRole;
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

function randomEmail(): string {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return `e2e-${suffix}@hospeda-test.local`;
}

function randomPassword(): string {
    return `Test-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-Aa1!`;
}

interface SignupResponse {
    user?: { id: string; email: string };
    token?: string;
}

/**
 * Signs up a new user via the public Better Auth endpoint and returns the
 * created user with an active session cookie.
 *
 * Better Auth issues a `__Secure-better-auth.session_token` (or unprefixed
 * during HTTP-only dev) cookie on signup; we capture it from the
 * `set-cookie` response header so callers can attach it to subsequent
 * requests.
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

    // Better Auth enforces CSRF via the Origin header on state-changing auth
    // routes. The web base URL is in the API's trustedOrigins on every stack
    // (e2e launcher sets API_CORS_ORIGINS to the web+admin URLs; dev/staging
    // include it too), so sending it is accepted everywhere. Omitting it is
    // rejected with MISSING_OR_NULL_ORIGIN when the API enforces origin.
    const response = await fetch(`${apiBaseUrl}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: webBaseUrl },
        body: JSON.stringify({ email, password, name })
    });
    if (!response.ok) {
        throw new Error(
            `signupUser failed: ${response.status} ${response.statusText} — ${await response.text()}`
        );
    }
    const data = (await response.json()) as SignupResponse;
    const sessionCookie = extractSessionCookie(response.headers.get('set-cookie'));
    const userId = data.user?.id;
    if (!userId || !sessionCookie) {
        throw new Error('signupUser: response missing user id or session cookie');
    }
    return {
        id: userId,
        email,
        password,
        role: 'USER',
        sessionCookie
    };
}

/**
 * Force-verifies a user's email by setting `emailVerifiedAt = now()` via SQL.
 * Avoids the need to poll Mailpit for tests that don't validate the email
 * delivery flow itself.
 */
export async function forceVerifyEmail(userId: string): Promise<void> {
    await execSQL(
        'UPDATE users SET email_verified_at = NOW(), email_verified = true WHERE id = $1',
        [userId]
    );
}

/**
 * Creates a USER, force-verifies email, and (optionally) promotes role.
 * The most common one-call test setup helper.
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
        return { ...user, role: options.role };
    }
    return user;
}

/**
 * Updates the user's `role` column directly. Bypasses any business rules
 * (e.g. host promotion via accommodation publish) — use only when the test
 * doesn't care about the path that produced the role.
 */
export async function setUserRole(userId: string, role: UserRole): Promise<void> {
    await execSQL('UPDATE users SET role = $1 WHERE id = $2', [role, userId]);
}

/**
 * Direct shortcut for HOST role.
 */
export async function promoteToHost(userId: string): Promise<void> {
    await setUserRole(userId, 'HOST');
}

interface MeResponse {
    data?: { id: string; role?: string };
}

/**
 * Retrieves the actor that the API associates with the given session cookie.
 * Used by tests to assert role transitions after onboarding.
 */
export async function getMe(
    sessionCookie: string,
    config?: ApiHelperConfig
): Promise<{ readonly id: string; readonly role: string } | null> {
    const { apiBaseUrl } = resolveBaseUrls(config);
    const response = await fetch(`${apiBaseUrl}/api/v1/public/auth/me`, {
        headers: { cookie: sessionCookie }
    });
    if (!response.ok) return null;
    const data = (await response.json()) as MeResponse;
    if (!data.data?.id || !data.data.role) return null;
    return { id: data.data.id, role: data.data.role };
}

interface OnboardingStartResponse {
    data?: {
        status: 'created' | 'resumed' | 'already_host';
        accommodationId?: string;
        accommodationSlug?: string;
    };
}

/**
 * Calls the host-onboarding endpoint (the same one driven by
 * /publicar/nueva on the web app). Used for HOST-01 setups and HOST-07
 * idempotency / republish tests.
 */
export async function startHostOnboarding(
    options: {
        readonly sessionCookie: string;
        readonly name: string;
        readonly summary: string;
        readonly type: string;
        readonly cityDestinationId: string;
    },
    config?: ApiHelperConfig
): Promise<{
    readonly status: 'created' | 'resumed' | 'already_host';
    readonly accommodationId: string | null;
    readonly accommodationSlug: string | null;
}> {
    const { apiBaseUrl } = resolveBaseUrls(config);
    const response = await fetch(`${apiBaseUrl}/api/v1/protected/host-onboarding/start`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            cookie: options.sessionCookie
        },
        body: JSON.stringify({
            name: options.name,
            summary: options.summary,
            type: options.type,
            cityDestinationId: options.cityDestinationId
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
 */
export async function createAccommodation(options: {
    readonly ownerId: string;
    readonly destinationId?: string;
    readonly slugPrefix?: string;
    readonly lifecycleState?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
}): Promise<CreatedAccommodation> {
    const destinationId = options.destinationId ?? (await getAnyCityDestinationId());
    const slug = `${options.slugPrefix ?? 'e2e-acc'}-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;
    const lifecycleState = options.lifecycleState ?? 'DRAFT';
    const rows = await execSQL<{ id: string }>(
        `INSERT INTO accommodations (
             slug, name, summary, description, type,
             owner_id, destination_id, lifecycle_state,
             visibility, moderation_state, is_featured,
             created_at, updated_at
         ) VALUES (
             $1, $2, $3, $4, $5,
             $6, $7, $8::lifecycle_status,
             'PUBLIC', 'APPROVED', false,
             NOW(), NOW()
         ) RETURNING id`,
        [
            slug,
            'E2E Test Accommodation',
            'E2E summary',
            'E2E test accommodation for SPEC-092 fixtures.',
            'house',
            options.ownerId,
            destinationId,
            lifecycleState
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
export async function createSubscription(options: {
    readonly userId: string;
    readonly planId: string;
    readonly status: 'trialing' | 'active' | 'canceled' | 'expired';
    readonly periodEnd?: Date;
}): Promise<{ readonly customerId: string; readonly subscriptionId: string }> {
    const customerRows = await execSQL<{ id: string }>(
        `INSERT INTO billing_customers (external_id, segment, created_at, updated_at)
         VALUES ($1, 'host', NOW(), NOW())
         ON CONFLICT (external_id) DO UPDATE SET updated_at = NOW()
         RETURNING id`,
        [options.userId]
    );
    const customerId = customerRows[0]?.id;
    if (!customerId) throw new Error('createSubscription: customer upsert returned no id');

    const periodEnd = options.periodEnd ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const subRows = await execSQL<{ id: string }>(
        `INSERT INTO billing_subscriptions (
             customer_id, plan_id, status, current_period_end,
             created_at, updated_at
         ) VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING id`,
        [customerId, options.planId, options.status, periodEnd]
    );
    const subscriptionId = subRows[0]?.id;
    if (!subscriptionId) throw new Error('createSubscription: subscription insert returned no id');
    return { customerId, subscriptionId };
}

/**
 * Creates a conversation row linking guest and host on a specific
 * accommodation. Used by MSG-01 and resilience tests that need a
 * pre-existing conversation.
 */
export async function createConversation(options: {
    readonly guestUserId: string;
    readonly hostUserId: string;
    readonly accommodationId: string;
    readonly subject?: string;
}): Promise<{ readonly id: string }> {
    const rows = await execSQL<{ id: string }>(
        `INSERT INTO conversations (
             guest_user_id, host_user_id, accommodation_id,
             subject, status, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, 'ACTIVE', NOW(), NOW())
         RETURNING id`,
        [
            options.guestUserId,
            options.hostUserId,
            options.accommodationId,
            options.subject ?? 'E2E test conversation'
        ]
    );
    const id = rows[0]?.id;
    if (!id) throw new Error('createConversation: insert returned no id');
    return { id };
}

function extractSessionCookie(setCookieHeader: string | null): string | null {
    if (!setCookieHeader) return null;
    // Better Auth may emit multiple cookies (session, csrf). We forward all
    // of them as a single Cookie header for subsequent requests.
    const cookies = setCookieHeader
        .split(/,(?=\s*[A-Za-z0-9_-]+=)/)
        .map((entry) => entry.split(';')[0]?.trim())
        .filter((entry): entry is string => Boolean(entry));
    return cookies.length > 0 ? cookies.join('; ') : null;
}
