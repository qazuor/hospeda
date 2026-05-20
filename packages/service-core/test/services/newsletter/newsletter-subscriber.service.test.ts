/**
 * @file newsletter-subscriber.service.test.ts
 *
 * Unit tests for NewsletterSubscriberService (SPEC-101 T-101-12).
 *
 * All external dependencies are mocked:
 * - `@repo/db`: `getDb()` returns a stub that intercepts `db.execute(sql)`
 *   and responds based on a per-test configuration object.
 * - `NewsletterNotificationDispatcher`: vi.fn() stubs for
 *   `sendVerification` and `sendWelcome`.
 * - Token helpers are NOT mocked (they are pure functions, tested separately).
 *
 * Design trade-off on getEligibleForCampaign:
 * The soft-cap NOT EXISTS subquery cannot be meaningfully unit-tested without
 * a real database because the SQL is dispatched via `db.execute(sql\`...\`)`.
 * The tests for this method verify (1) that the service calls the model/db with
 * the right intent by inspecting the captured SQL string for expected fragments,
 * and (2) that the mapping from DB rows to the output shape is correct.
 *
 * Coverage areas:
 * - subscribe: 4 state transitions + blocked terminal states
 * - verifyToken: happy path, already-active idempotent, expired, invalid, non-pending
 * - unsubscribeByToken: happy path, idempotent (unsubscribed, bounced), invalid token
 * - unsubscribeAuthenticated: owner-only enforcement, happy path, no-row
 * - resendVerification: happy path, wrong status, no row
 * - getStatus: owner-only, found, not found
 * - getEligibleForCampaign: happy path (SQL intent check), empty candidates
 * - adminList: permission guard, basic execution
 * - getStats: permission guard, basic execution
 */

// ---------------------------------------------------------------------------
// Module-level mocks (must be before imports)
// ---------------------------------------------------------------------------

/** Captured SQL calls from db.execute() for inspection in tests. */
let capturedSqlStrings: string[] = [];

/**
 * Per-test DB response configuration.
 *
 * `queryResponses` is a queue: each call to `db.execute` pops the next response.
 * If the queue is exhausted, subsequent calls return `{ rows: [] }`.
 */
let queryResponses: Array<{ rows: unknown[] }> = [];

vi.mock('@repo/db', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/db')>();
    return {
        ...original,
        getDb: vi.fn(() => ({
            execute: vi.fn(async (sqlExpr: { queryChunks?: unknown[]; sql?: string }) => {
                // Capture the SQL string for assertions
                const rawSql =
                    typeof sqlExpr === 'object' && sqlExpr !== null && 'sql' in sqlExpr
                        ? String(sqlExpr.sql)
                        : JSON.stringify(sqlExpr);
                capturedSqlStrings.push(rawSql);

                // Return the next queued response
                if (queryResponses.length > 0) {
                    return queryResponses.shift() as { rows: unknown[] };
                }
                return { rows: [] };
            })
        }))
    };
});

import { NewsletterSourceEnum, PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewsletterSubscriberService } from '../../../src/services/newsletter/newsletter-subscriber.service.js';
import {
    generateUnsubscribeToken,
    generateVerificationToken
} from '../../../src/services/newsletter/newsletter-token.helpers.js';
import type { Actor } from '../../../src/types/index.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const HMAC_SECRET = 'test-hmac-secret-min-32-chars-long!!';
// UUIDs must satisfy Zod v4's strict UUID regex (version digit 1-8, variant a-b in 4th segment)
const SUBSCRIBER_ID = '11111111-1111-4111-a111-111111111111';
const USER_ID = '22222222-2222-4222-b222-222222222222';
const EMAIL = 'user@example.com';

/**
 * Creates an authenticated actor owning USER_ID. Defaults to
 * `emailVerified: true` so the common newsletter subscribe path
 * (direct-to-active for authed verified users) is exercised; tests for the
 * NEWSLETTER_ACCOUNT_EMAIL_UNVERIFIED block override this explicitly.
 */
function makeOwnerActor(id = USER_ID, options: { emailVerified?: boolean } = {}): Actor {
    return {
        id,
        role: RoleEnum.USER,
        permissions: [],
        emailVerified: options.emailVerified ?? true
    };
}

/**
 * Creates an admin actor with NEWSLETTER_SUBSCRIBER_VIEW.
 */
function makeAdminActor(): Actor {
    return {
        id: '33333333-3333-4333-a333-333333333333',
        role: RoleEnum.ADMIN,
        permissions: [PermissionEnum.NEWSLETTER_SUBSCRIBER_VIEW]
    };
}

/**
 * Builds a mock subscriber row (simulates a DB row with camelCase aliases).
 */
function makeSubscriberRow(
    overrides: Partial<{
        id: string;
        userId: string;
        email: string;
        channel: string;
        status: string;
        locale: string;
        source: string;
        subscribedAt: Date;
        verifiedAt: Date | null;
        deletedAt: Date | null;
        unsubscribedAt: Date | null;
        bouncedAt: Date | null;
        complainedAt: Date | null;
        consentIp: string | null;
        consentUa: string | null;
        consentVersion: string | null;
    }> = {}
) {
    return {
        id: SUBSCRIBER_ID,
        userId: USER_ID,
        email: EMAIL,
        channel: 'email',
        status: 'pending_verification',
        locale: 'es',
        source: 'web_footer',
        subscribedAt: new Date('2026-05-01T00:00:00Z'),
        verifiedAt: null,
        deletedAt: null,
        unsubscribedAt: null,
        bouncedAt: null,
        complainedAt: null,
        consentIp: null,
        consentUa: null,
        consentVersion: null,
        ...overrides
    };
}

/**
 * Enqueues one DB query response.
 */
function enqueueResponse(rows: unknown[]) {
    queryResponses.push({ rows });
}

/** No-op dispatcher stubs. */
function makeDispatcher() {
    return {
        sendVerification: vi.fn().mockResolvedValue(undefined) as ReturnType<typeof vi.fn>,
        sendWelcome: vi.fn().mockResolvedValue(undefined) as ReturnType<typeof vi.fn>
    };
}

/** Creates a service instance with the given dispatcher. */
function makeService(dispatcher = makeDispatcher()) {
    return {
        svc: new NewsletterSubscriberService(
            {},
            {
                hmacSecret: HMAC_SECRET,
                notificationDispatcher: dispatcher
            }
        ),
        dispatcher
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
    capturedSqlStrings = [];
    queryResponses = [];
});

afterEach(() => {
    vi.clearAllMocks();
});

// ===========================================================================
// subscribe — state machine
// ===========================================================================

describe('NewsletterSubscriberService.subscribe', () => {
    describe('direct-to-active path (emailVerified=true)', () => {
        it('inserts an active row and sends WELCOME (not verification) when no row exists', async () => {
            const { svc, dispatcher } = makeService();
            const actor = makeOwnerActor();

            // First query: lookup existing (empty). Second: INSERT RETURNING id.
            enqueueResponse([]);
            enqueueResponse([{ id: SUBSCRIBER_ID }]);

            const result = await svc.subscribe(actor, {
                userId: USER_ID,
                email: EMAIL,
                locale: 'es',
                source: NewsletterSourceEnum.WEB_FOOTER
            });

            expect(result.error).toBeUndefined();
            expect(result.data?.status).toBe('active');
            expect(dispatcher.sendWelcome).toHaveBeenCalledOnce();
            expect(dispatcher.sendVerification).not.toHaveBeenCalled();

            // SQL intent: INSERT must persist status=active + verified_at.
            const insertSql = capturedSqlStrings.find((s) =>
                s.includes('INSERT INTO newsletter_subscribers')
            );
            expect(insertSql).toBeDefined();
            expect(insertSql).toContain('verified_at');
        });

        it('flips a pending_verification row to active and sends welcome', async () => {
            const { svc, dispatcher } = makeService();
            const actor = makeOwnerActor();

            enqueueResponse([makeSubscriberRow({ status: 'pending_verification' })]);
            enqueueResponse([]); // UPDATE response

            const result = await svc.subscribe(actor, {
                userId: USER_ID,
                email: EMAIL
            });

            expect(result.error).toBeUndefined();
            expect(result.data?.status).toBe('active');
            expect(dispatcher.sendWelcome).toHaveBeenCalledOnce();
            expect(dispatcher.sendVerification).not.toHaveBeenCalled();

            const updateSql = capturedSqlStrings.find((s) =>
                s.includes('UPDATE newsletter_subscribers')
            );
            expect(updateSql).toContain('verified_at');
        });

        it('reactivates unsubscribed row directly to active and sends welcome', async () => {
            const { svc, dispatcher } = makeService();
            const actor = makeOwnerActor();

            enqueueResponse([makeSubscriberRow({ status: 'unsubscribed' })]);
            enqueueResponse([]); // UPDATE response

            const result = await svc.subscribe(actor, {
                userId: USER_ID,
                email: EMAIL
            });

            expect(result.error).toBeUndefined();
            expect(result.data?.status).toBe('active');
            expect(dispatcher.sendWelcome).toHaveBeenCalledOnce();
            expect(dispatcher.sendVerification).not.toHaveBeenCalled();
        });

        it('returns active (no-op, no email) when row is already active', async () => {
            const { svc, dispatcher } = makeService();
            const actor = makeOwnerActor();

            enqueueResponse([makeSubscriberRow({ status: 'active' })]);

            const result = await svc.subscribe(actor, {
                userId: USER_ID,
                email: EMAIL
            });

            expect(result.error).toBeUndefined();
            expect(result.data?.status).toBe('active');
            expect(dispatcher.sendVerification).not.toHaveBeenCalled();
            expect(dispatcher.sendWelcome).not.toHaveBeenCalled();
        });
    });

    describe('unverified-account-email block (emailVerified !== true)', () => {
        it('blocks with NEWSLETTER_ACCOUNT_EMAIL_UNVERIFIED when no row exists', async () => {
            const { svc, dispatcher } = makeService();
            const actor = makeOwnerActor(USER_ID, { emailVerified: false });

            enqueueResponse([]); // lookup empty

            const result = await svc.subscribe(actor, {
                userId: USER_ID,
                email: EMAIL
            });

            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe('FORBIDDEN');
            expect(result.error?.reason).toBe('NEWSLETTER_ACCOUNT_EMAIL_UNVERIFIED');
            expect(dispatcher.sendVerification).not.toHaveBeenCalled();
            expect(dispatcher.sendWelcome).not.toHaveBeenCalled();
            // Must NOT write anything when the gate fires.
            expect(
                capturedSqlStrings.find((s) => s.startsWith('\n                    INSERT'))
            ).toBeUndefined();
        });

        it('blocks with NEWSLETTER_ACCOUNT_EMAIL_UNVERIFIED when row is pending', async () => {
            const { svc } = makeService();
            const actor = makeOwnerActor(USER_ID, { emailVerified: false });

            enqueueResponse([makeSubscriberRow({ status: 'pending_verification' })]);

            const result = await svc.subscribe(actor, {
                userId: USER_ID,
                email: EMAIL
            });

            expect(result.error?.code).toBe('FORBIDDEN');
            expect(result.error?.reason).toBe('NEWSLETTER_ACCOUNT_EMAIL_UNVERIFIED');
        });

        it('does NOT block when row is already active (active no-op wins over the gate)', async () => {
            const { svc, dispatcher } = makeService();
            const actor = makeOwnerActor(USER_ID, { emailVerified: false });

            enqueueResponse([makeSubscriberRow({ status: 'active' })]);

            const result = await svc.subscribe(actor, {
                userId: USER_ID,
                email: EMAIL
            });

            // Already subscribed — no error, no welcome resend.
            expect(result.error).toBeUndefined();
            expect(result.data?.status).toBe('active');
            expect(dispatcher.sendWelcome).not.toHaveBeenCalled();
        });

        it('treats emailVerified=undefined as not verified (safe default)', async () => {
            const { svc } = makeService();
            // Force-strip emailVerified to mimic a legacy actor.
            const actor: Actor = {
                id: USER_ID,
                role: RoleEnum.USER,
                permissions: []
            };

            enqueueResponse([]);

            const result = await svc.subscribe(actor, {
                userId: USER_ID,
                email: EMAIL
            });

            expect(result.error?.reason).toBe('NEWSLETTER_ACCOUNT_EMAIL_UNVERIFIED');
        });
    });

    describe('terminal blocks (bounced / complained beat every other gate)', () => {
        it('blocks re-subscribe when row is bounced (even with verified email)', async () => {
            const { svc } = makeService();
            const actor = makeOwnerActor();

            enqueueResponse([makeSubscriberRow({ status: 'bounced' })]);

            const result = await svc.subscribe(actor, {
                userId: USER_ID,
                email: EMAIL
            });

            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe('FORBIDDEN');
            expect(result.error?.reason).toBe('NEWSLETTER_SUBSCRIBER_BLOCKED');
        });

        it('blocks re-subscribe when row is complained', async () => {
            const { svc } = makeService();
            const actor = makeOwnerActor();

            enqueueResponse([makeSubscriberRow({ status: 'complained' })]);

            const result = await svc.subscribe(actor, {
                userId: USER_ID,
                email: EMAIL
            });

            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe('FORBIDDEN');
            expect(result.error?.reason).toBe('NEWSLETTER_SUBSCRIBER_BLOCKED');
        });

        it('bounced beats unverified-email gate too', async () => {
            const { svc } = makeService();
            const actor = makeOwnerActor(USER_ID, { emailVerified: false });

            enqueueResponse([makeSubscriberRow({ status: 'bounced' })]);

            const result = await svc.subscribe(actor, {
                userId: USER_ID,
                email: EMAIL
            });

            expect(result.error?.reason).toBe('NEWSLETTER_SUBSCRIBER_BLOCKED');
        });
    });

    describe('ownership enforcement', () => {
        it('returns FORBIDDEN when actor id does not match userId', async () => {
            const { svc } = makeService();
            const actor = makeOwnerActor('44444444-4444-4444-b444-444444444444');

            const result = await svc.subscribe(actor, {
                userId: USER_ID,
                email: EMAIL
            });

            expect(result.error?.code).toBe('FORBIDDEN');
            expect(result.error?.reason).toBe('NEWSLETTER_SUBSCRIBER_NOT_SELF');
        });
    });
});

// ===========================================================================
// verifyToken
// ===========================================================================

describe('NewsletterSubscriberService.verifyToken', () => {
    it('transitions pending_verification to active and sends welcome email', async () => {
        const { svc, dispatcher } = makeService();

        const token = generateVerificationToken({
            subscriberId: SUBSCRIBER_ID,
            channel: 'email',
            secret: HMAC_SECRET
        });

        enqueueResponse([makeSubscriberRow({ status: 'pending_verification' })]);
        // UPDATE response
        enqueueResponse([]);

        const result = await svc.verifyToken(token);

        expect(result.error).toBeUndefined();
        expect(result.data?.subscriberId).toBe(SUBSCRIBER_ID);
        expect(result.data?.status).toBe('active');
        expect(dispatcher.sendWelcome).toHaveBeenCalledOnce();
        expect(dispatcher.sendVerification).not.toHaveBeenCalled();
    });

    it('returns already_active when subscriber is already active (idempotent)', async () => {
        const { svc, dispatcher } = makeService();

        const token = generateVerificationToken({
            subscriberId: SUBSCRIBER_ID,
            channel: 'email',
            secret: HMAC_SECRET
        });

        enqueueResponse([makeSubscriberRow({ status: 'active' })]);

        const result = await svc.verifyToken(token);

        expect(result.error).toBeUndefined();
        expect(result.data?.status).toBe('already_active');
        expect(dispatcher.sendWelcome).not.toHaveBeenCalled();
    });

    it('returns UNAUTHORIZED with NEWSLETTER_TOKEN_EXPIRED for an expired token', async () => {
        const { svc } = makeService();

        // Issue token 73h in the past (default TTL is 72h)
        const issuedAt = new Date(Date.now() - 73 * 60 * 60 * 1000);
        const token = generateVerificationToken({
            subscriberId: SUBSCRIBER_ID,
            channel: 'email',
            secret: HMAC_SECRET,
            issuedAt
        });

        const result = await svc.verifyToken(token);

        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe('UNAUTHORIZED');
        expect(result.error?.reason).toBe('NEWSLETTER_TOKEN_EXPIRED');
    });

    it('returns UNAUTHORIZED with NEWSLETTER_TOKEN_INVALID for a malformed token', async () => {
        const { svc } = makeService();

        const result = await svc.verifyToken('not.a.valid.token');

        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe('UNAUTHORIZED');
        expect(result.error?.reason).toBe('NEWSLETTER_TOKEN_INVALID');
    });

    it('returns ALREADY_EXISTS with NEWSLETTER_SUBSCRIBER_NOT_PENDING when status is unsubscribed', async () => {
        const { svc } = makeService();

        const token = generateVerificationToken({
            subscriberId: SUBSCRIBER_ID,
            channel: 'email',
            secret: HMAC_SECRET
        });

        enqueueResponse([makeSubscriberRow({ status: 'unsubscribed' })]);

        const result = await svc.verifyToken(token);

        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe('ALREADY_EXISTS');
        expect(result.error?.reason).toBe('NEWSLETTER_SUBSCRIBER_NOT_PENDING');
    });

    it('returns NOT_FOUND when subscriber row does not exist', async () => {
        const { svc } = makeService();

        const token = generateVerificationToken({
            subscriberId: SUBSCRIBER_ID,
            channel: 'email',
            secret: HMAC_SECRET
        });

        enqueueResponse([]); // no row found

        const result = await svc.verifyToken(token);

        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe('NOT_FOUND');
    });
});

// ===========================================================================
// unsubscribeByToken
// ===========================================================================

describe('NewsletterSubscriberService.unsubscribeByToken', () => {
    it('transitions active subscriber to unsubscribed', async () => {
        const { svc } = makeService();

        const token = generateUnsubscribeToken({
            subscriberId: SUBSCRIBER_ID,
            channel: 'email',
            secret: HMAC_SECRET
        });

        enqueueResponse([{ id: SUBSCRIBER_ID, status: 'active', deletedAt: null }]);
        enqueueResponse([]); // UPDATE

        const result = await svc.unsubscribeByToken(token);

        expect(result.error).toBeUndefined();
        expect(result.data?.status).toBe('unsubscribed');
    });

    it('returns already_unsubscribed when subscriber is already unsubscribed (idempotent)', async () => {
        const { svc } = makeService();

        const token = generateUnsubscribeToken({
            subscriberId: SUBSCRIBER_ID,
            channel: 'email',
            secret: HMAC_SECRET
        });

        enqueueResponse([{ id: SUBSCRIBER_ID, status: 'unsubscribed', deletedAt: null }]);

        const result = await svc.unsubscribeByToken(token);

        expect(result.error).toBeUndefined();
        expect(result.data?.status).toBe('already_unsubscribed');
    });

    it('returns already_unsubscribed when subscriber is bounced (terminal state)', async () => {
        const { svc } = makeService();

        const token = generateUnsubscribeToken({
            subscriberId: SUBSCRIBER_ID,
            channel: 'email',
            secret: HMAC_SECRET
        });

        enqueueResponse([{ id: SUBSCRIBER_ID, status: 'bounced', deletedAt: null }]);

        const result = await svc.unsubscribeByToken(token);

        expect(result.error).toBeUndefined();
        expect(result.data?.status).toBe('already_unsubscribed');
    });

    it('returns UNAUTHORIZED with NEWSLETTER_TOKEN_INVALID for a bad token', async () => {
        const { svc } = makeService();

        const result = await svc.unsubscribeByToken('invalid.garbage.token');

        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe('UNAUTHORIZED');
        expect(result.error?.reason).toBe('NEWSLETTER_TOKEN_INVALID');
    });
});

// ===========================================================================
// unsubscribeAuthenticated
// ===========================================================================

describe('NewsletterSubscriberService.unsubscribeAuthenticated', () => {
    it('returns FORBIDDEN when actor is not the subscriber owner', async () => {
        const { svc } = makeService();
        const actor = makeOwnerActor('55555555-5555-4555-a555-555555555555');

        const result = await svc.unsubscribeAuthenticated(actor, USER_ID);

        expect(result.error?.code).toBe('FORBIDDEN');
        expect(result.error?.reason).toBe('NEWSLETTER_SUBSCRIBER_NOT_SELF');
    });

    it('transitions active subscriber to unsubscribed', async () => {
        const { svc } = makeService();
        const actor = makeOwnerActor();

        enqueueResponse([{ id: SUBSCRIBER_ID, status: 'active', deletedAt: null }]);
        enqueueResponse([]); // UPDATE

        const result = await svc.unsubscribeAuthenticated(actor, USER_ID);

        expect(result.error).toBeUndefined();
        expect(result.data?.status).toBe('unsubscribed');
    });

    it('returns not_subscribed when no row exists', async () => {
        const { svc } = makeService();
        const actor = makeOwnerActor();

        enqueueResponse([]); // no row

        const result = await svc.unsubscribeAuthenticated(actor, USER_ID);

        expect(result.error).toBeUndefined();
        expect(result.data?.status).toBe('not_subscribed');
    });

    it('returns unsubscribed (idempotent) when already unsubscribed', async () => {
        const { svc } = makeService();
        const actor = makeOwnerActor();

        enqueueResponse([{ id: SUBSCRIBER_ID, status: 'unsubscribed', deletedAt: null }]);

        const result = await svc.unsubscribeAuthenticated(actor, USER_ID);

        expect(result.error).toBeUndefined();
        expect(result.data?.status).toBe('unsubscribed');
    });
});

// ===========================================================================
// resendVerification
// ===========================================================================

describe('NewsletterSubscriberService.resendVerification', () => {
    it('re-sends verification for a pending_verification subscriber', async () => {
        const { svc, dispatcher } = makeService();
        const actor = makeOwnerActor();

        enqueueResponse([makeSubscriberRow({ status: 'pending_verification' })]);
        enqueueResponse([]); // UPDATE

        const result = await svc.resendVerification(actor, USER_ID);

        expect(result.error).toBeUndefined();
        expect(result.data?.sent).toBe(true);
        expect(dispatcher.sendVerification).toHaveBeenCalledOnce();
    });

    it('returns ALREADY_EXISTS with NEWSLETTER_SUBSCRIBER_NOT_PENDING when status is active', async () => {
        const { svc } = makeService();
        const actor = makeOwnerActor();

        enqueueResponse([makeSubscriberRow({ status: 'active' })]);

        const result = await svc.resendVerification(actor, USER_ID);

        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe('ALREADY_EXISTS');
        expect(result.error?.reason).toBe('NEWSLETTER_SUBSCRIBER_NOT_PENDING');
    });

    it('returns NOT_FOUND when subscriber does not exist', async () => {
        const { svc } = makeService();
        const actor = makeOwnerActor();

        enqueueResponse([]); // no row

        const result = await svc.resendVerification(actor, USER_ID);

        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe('NOT_FOUND');
        expect(result.error?.reason).toBe('NEWSLETTER_SUBSCRIBER_NOT_FOUND');
    });

    it('returns FORBIDDEN when actor is not the owner', async () => {
        const { svc } = makeService();
        const actor = makeOwnerActor('66666666-6666-4666-a666-666666666666');

        const result = await svc.resendVerification(actor, USER_ID);

        expect(result.error?.code).toBe('FORBIDDEN');
        expect(result.error?.reason).toBe('NEWSLETTER_SUBSCRIBER_NOT_SELF');
    });
});

// ===========================================================================
// getStatus
// ===========================================================================

describe('NewsletterSubscriberService.getStatus', () => {
    it('returns subscribed:true with timestamps for an active subscriber', async () => {
        const { svc } = makeService();
        const actor = makeOwnerActor();

        const subscribedAt = new Date('2026-05-01T00:00:00Z');
        const verifiedAt = new Date('2026-05-02T00:00:00Z');

        enqueueResponse([
            {
                status: 'active',
                subscribed_at: subscribedAt,
                verified_at: verifiedAt,
                deleted_at: null
            }
        ]);

        const result = await svc.getStatus(actor, USER_ID);

        expect(result.error).toBeUndefined();
        expect(result.data?.subscribed).toBe(true);
        expect(result.data?.status).toBe('active');
        expect(result.data?.subscribedAt).toBe(subscribedAt);
        expect(result.data?.verifiedAt).toBe(verifiedAt);
    });

    it('returns subscribed:false with nulls when no row exists', async () => {
        const { svc } = makeService();
        const actor = makeOwnerActor();

        enqueueResponse([]);

        const result = await svc.getStatus(actor, USER_ID);

        expect(result.error).toBeUndefined();
        expect(result.data?.subscribed).toBe(false);
        expect(result.data?.status).toBeNull();
        expect(result.data?.subscribedAt).toBeNull();
        expect(result.data?.verifiedAt).toBeNull();
    });

    it('returns FORBIDDEN when actor is not the owner', async () => {
        const { svc } = makeService();
        const actor = makeOwnerActor('66666666-6666-4666-a666-666666666666');

        const result = await svc.getStatus(actor, USER_ID);

        expect(result.error?.code).toBe('FORBIDDEN');
        expect(result.error?.reason).toBe('NEWSLETTER_SUBSCRIBER_NOT_SELF');
    });

    // Regression: drizzle's raw `db.execute(sql)` via node-postgres returns
    // `timestamp with time zone` columns as STRINGS (raw pg format), not Date.
    // The service must normalise those strings into JS Date so the public
    // `GetStatusResult.subscribedAt: Date | null` contract holds and the
    // status route handler can safely call `.toISOString()` downstream
    // without throwing "TypeError: ...toISOString is not a function" (500).
    it('coerces string timestamps from the pg driver into JS Date objects', async () => {
        const { svc } = makeService();
        const actor = makeOwnerActor();

        // Mimic the exact raw-pg format observed in dev:
        //   '2026-05-20 06:08:09.805+00'
        enqueueResponse([
            {
                status: 'active',
                subscribed_at: '2026-05-20 06:08:09.805+00',
                verified_at: '2026-05-20 06:10:00.000+00',
                deleted_at: null
            }
        ]);

        const result = await svc.getStatus(actor, USER_ID);

        expect(result.error).toBeUndefined();
        expect(result.data?.subscribed).toBe(true);
        expect(result.data?.subscribedAt).toBeInstanceOf(Date);
        expect(result.data?.verifiedAt).toBeInstanceOf(Date);
        // Round-trip through toISOString to lock the parse target.
        expect(result.data?.subscribedAt?.toISOString()).toBe('2026-05-20T06:08:09.805Z');
        expect(result.data?.verifiedAt?.toISOString()).toBe('2026-05-20T06:10:00.000Z');
    });
});

// ===========================================================================
// updatePreferences
// ===========================================================================

describe('NewsletterSubscriberService.updatePreferences', () => {
    it('merges the partial onto the existing preferences and returns the result', async () => {
        const { svc } = makeService();
        const actor = makeOwnerActor();

        // First query: SELECT row (active subscriber, current prefs)
        enqueueResponse([
            {
                id: SUBSCRIBER_ID,
                status: 'active',
                preferences: {
                    offers: true,
                    events: true,
                    guides: true,
                    productNews: true
                },
                deletedAt: null
            }
        ]);
        // Second query: UPDATE ... RETURNING preferences (server-side merge result)
        enqueueResponse([
            {
                preferences: {
                    offers: false,
                    events: true,
                    guides: true,
                    productNews: true
                }
            }
        ]);

        const result = await svc.updatePreferences(actor, {
            userId: USER_ID,
            preferences: { offers: false }
        });

        expect(result.error).toBeUndefined();
        expect(result.data?.preferences).toEqual({
            offers: false,
            events: true,
            guides: true,
            productNews: true
        });

        // SQL intent: the UPDATE uses JSONB || to merge.
        const updateSql = capturedSqlStrings.find((s) =>
            s.includes('UPDATE newsletter_subscribers')
        );
        expect(updateSql).toBeDefined();
        expect(updateSql).toContain('preferences');
        expect(updateSql).toContain('||');
    });

    it('throws NOT_FOUND when no active subscriber row exists', async () => {
        const { svc } = makeService();
        const actor = makeOwnerActor();

        enqueueResponse([]); // SELECT returns no rows

        const result = await svc.updatePreferences(actor, {
            userId: USER_ID,
            preferences: { offers: false }
        });

        expect(result.error?.code).toBe('NOT_FOUND');
        expect(result.error?.reason).toBe('NEWSLETTER_SUBSCRIBER_NOT_FOUND');
    });

    it('throws FORBIDDEN with NEWSLETTER_SUBSCRIBER_BLOCKED for bounced subscribers', async () => {
        const { svc } = makeService();
        const actor = makeOwnerActor();

        enqueueResponse([
            {
                id: SUBSCRIBER_ID,
                status: 'bounced',
                preferences: { offers: true, events: true, guides: true, productNews: true },
                deletedAt: null
            }
        ]);

        const result = await svc.updatePreferences(actor, {
            userId: USER_ID,
            preferences: { offers: false }
        });

        expect(result.error?.code).toBe('FORBIDDEN');
        expect(result.error?.reason).toBe('NEWSLETTER_SUBSCRIBER_BLOCKED');
        // No UPDATE should have been dispatched after the gate fired.
        expect(
            capturedSqlStrings.find((s) => s.includes('UPDATE newsletter_subscribers'))
        ).toBeUndefined();
    });

    it('throws FORBIDDEN with NEWSLETTER_SUBSCRIBER_BLOCKED for complained subscribers', async () => {
        const { svc } = makeService();
        const actor = makeOwnerActor();

        enqueueResponse([
            {
                id: SUBSCRIBER_ID,
                status: 'complained',
                preferences: { offers: true, events: true, guides: true, productNews: true },
                deletedAt: null
            }
        ]);

        const result = await svc.updatePreferences(actor, {
            userId: USER_ID,
            preferences: { events: false }
        });

        expect(result.error?.code).toBe('FORBIDDEN');
        expect(result.error?.reason).toBe('NEWSLETTER_SUBSCRIBER_BLOCKED');
    });

    it('returns FORBIDDEN when actor is not the owner', async () => {
        const { svc } = makeService();
        const actor = makeOwnerActor('66666666-6666-4666-a666-666666666666');

        const result = await svc.updatePreferences(actor, {
            userId: USER_ID,
            preferences: { offers: false }
        });

        expect(result.error?.code).toBe('FORBIDDEN');
        expect(result.error?.reason).toBe('NEWSLETTER_SUBSCRIBER_NOT_SELF');
    });

    it('rejects empty preferences objects via the input schema refinement', async () => {
        const { svc } = makeService();
        const actor = makeOwnerActor();

        const result = await svc.updatePreferences(actor, {
            userId: USER_ID,
            preferences: {}
        });

        expect(result.error?.code).toBe('VALIDATION_ERROR');
    });
});

// ===========================================================================
// subscribeGuest
// ===========================================================================

describe('NewsletterSubscriberService.subscribeGuest', () => {
    const GUEST_EMAIL = 'guest@example.com';

    it('inserts an anonymous pending row and sends verification when no row exists', async () => {
        const { svc, dispatcher } = makeService();

        enqueueResponse([]); // lookup
        enqueueResponse([{ id: SUBSCRIBER_ID }]); // INSERT RETURNING id

        const result = await svc.subscribeGuest({
            email: GUEST_EMAIL,
            locale: 'es',
            source: NewsletterSourceEnum.WEB_FOOTER
        });

        expect(result.error).toBeUndefined();
        expect(result.data?.status).toBe('pending_verification');
        expect(dispatcher.sendVerification).toHaveBeenCalledOnce();
        expect(dispatcher.sendWelcome).not.toHaveBeenCalled();

        // INSERT must use NULL user_id for the anonymous row.
        const insertSql = capturedSqlStrings.find((s) =>
            s.includes('INSERT INTO newsletter_subscribers')
        );
        expect(insertSql).toBeDefined();
        expect(insertSql).toContain('NULL');
    });

    it('refreshes the anonymous pending row and returns already_pending', async () => {
        const { svc, dispatcher } = makeService();

        enqueueResponse([
            { id: SUBSCRIBER_ID, userId: null, status: 'pending_verification', locale: 'es' }
        ]);
        enqueueResponse([]); // UPDATE response

        const result = await svc.subscribeGuest({ email: GUEST_EMAIL });

        expect(result.data?.status).toBe('already_pending');
        expect(dispatcher.sendVerification).toHaveBeenCalledOnce();
    });

    it('reactivates an anonymous unsubscribed row back to pending_verification', async () => {
        const { svc, dispatcher } = makeService();

        enqueueResponse([
            { id: SUBSCRIBER_ID, userId: null, status: 'unsubscribed', locale: 'es' }
        ]);
        enqueueResponse([]); // UPDATE response

        const result = await svc.subscribeGuest({ email: GUEST_EMAIL });

        expect(result.data?.status).toBe('pending_verification');
        expect(dispatcher.sendVerification).toHaveBeenCalledOnce();
    });

    it('returns active idempotently when an active row already exists', async () => {
        const { svc, dispatcher } = makeService();

        enqueueResponse([{ id: SUBSCRIBER_ID, userId: null, status: 'active', locale: 'es' }]);

        const result = await svc.subscribeGuest({ email: GUEST_EMAIL });

        expect(result.data?.status).toBe('active');
        expect(dispatcher.sendVerification).not.toHaveBeenCalled();
    });

    it('blocks with NEWSLETTER_SUBSCRIBER_BLOCKED on a bounced row', async () => {
        const { svc } = makeService();

        enqueueResponse([{ id: SUBSCRIBER_ID, userId: null, status: 'bounced', locale: 'es' }]);

        const result = await svc.subscribeGuest({ email: GUEST_EMAIL });

        expect(result.error?.code).toBe('FORBIDDEN');
        expect(result.error?.reason).toBe('NEWSLETTER_SUBSCRIBER_BLOCKED');
    });

    // Privacy guard: a row linked to a real user must not be touched by the
    // guest flow — refreshing tokens or reactivating would spam the linked user.
    it('does NOT send email when the matched row is linked to a real user (privacy guard)', async () => {
        const { svc, dispatcher } = makeService();

        enqueueResponse([
            {
                id: SUBSCRIBER_ID,
                userId: USER_ID, // <- linked
                status: 'pending_verification',
                locale: 'es'
            }
        ]);

        const result = await svc.subscribeGuest({ email: GUEST_EMAIL });

        expect(result.data?.status).toBe('already_pending');
        expect(dispatcher.sendVerification).not.toHaveBeenCalled();

        // No UPDATE either — the row stays exactly as it was.
        expect(
            capturedSqlStrings.find((s) => s.includes('UPDATE newsletter_subscribers'))
        ).toBeUndefined();
    });

    it('rejects malformed email via Zod validation', async () => {
        const { svc } = makeService();

        const result = await svc.subscribeGuest({ email: 'not-an-email' });

        expect(result.error?.code).toBe('VALIDATION_ERROR');
    });
});

// ===========================================================================
// linkAnonymousSubscribersToUser
// ===========================================================================

describe('NewsletterSubscriberService.linkAnonymousSubscribersToUser', () => {
    it('returns zero counts and skips the UPDATE when no anonymous rows match', async () => {
        const { svc, dispatcher } = makeService();

        enqueueResponse([]); // lookup returns nothing

        const result = await svc.linkAnonymousSubscribersToUser({
            userId: USER_ID,
            email: EMAIL,
            accountEmailVerified: true
        });

        expect(result.error).toBeUndefined();
        expect(result.data?.linkedCount).toBe(0);
        expect(result.data?.promotedToActiveCount).toBe(0);
        expect(dispatcher.sendWelcome).not.toHaveBeenCalled();

        // Only the SELECT should have run; no UPDATE on an empty match set.
        expect(
            capturedSqlStrings.find((s) => s.includes('UPDATE newsletter_subscribers'))
        ).toBeUndefined();
    });

    it('links anonymous rows and promotes pending_verification rows when account email is verified', async () => {
        const { svc, dispatcher } = makeService();

        // Lookup returns one pending row + one already-active row (e.g. the
        // user had two subscription attempts that both produced anon rows).
        enqueueResponse([
            {
                id: '99999999-9999-4999-a999-999999999991',
                status: 'pending_verification',
                email: EMAIL,
                channel: 'email',
                locale: 'es'
            },
            {
                id: '99999999-9999-4999-a999-999999999992',
                status: 'active',
                email: EMAIL,
                channel: 'email',
                locale: 'es'
            }
        ]);
        // UPDATE response (not consumed beyond captured SQL).
        enqueueResponse([]);

        const result = await svc.linkAnonymousSubscribersToUser({
            userId: USER_ID,
            email: EMAIL,
            accountEmailVerified: true
        });

        expect(result.error).toBeUndefined();
        expect(result.data?.linkedCount).toBe(2);
        // Only the pending row was promoted → one welcome email.
        expect(result.data?.promotedToActiveCount).toBe(1);
        expect(dispatcher.sendWelcome).toHaveBeenCalledOnce();

        // SQL intent: the UPDATE should use the CASE/promotion form.
        const updateSql = capturedSqlStrings.find((s) =>
            s.includes('UPDATE newsletter_subscribers')
        );
        expect(updateSql).toContain('CASE');
        expect(updateSql).toContain('verified_at');
    });

    it('links anonymous rows without promoting when account email is not verified', async () => {
        const { svc, dispatcher } = makeService();

        enqueueResponse([
            {
                id: '99999999-9999-4999-a999-999999999991',
                status: 'pending_verification',
                email: EMAIL,
                channel: 'email',
                locale: 'es'
            }
        ]);
        enqueueResponse([]);

        const result = await svc.linkAnonymousSubscribersToUser({
            userId: USER_ID,
            email: EMAIL,
            accountEmailVerified: false
        });

        expect(result.error).toBeUndefined();
        expect(result.data?.linkedCount).toBe(1);
        expect(result.data?.promotedToActiveCount).toBe(0);
        expect(dispatcher.sendWelcome).not.toHaveBeenCalled();

        // SQL intent: the simpler UPDATE form (no CASE, just user_id +
        // updated_at) — guarantees the row's lifecycle is untouched.
        const updateSql = capturedSqlStrings.find((s) =>
            s.includes('UPDATE newsletter_subscribers')
        );
        expect(updateSql).not.toContain('CASE');
    });

    it('rejects invalid input via Zod validation', async () => {
        const { svc } = makeService();

        const result = await svc.linkAnonymousSubscribersToUser({
            userId: 'not-a-uuid',
            email: EMAIL,
            accountEmailVerified: true
        });

        expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    // Terminal-state policy regression: a bounced / complained anonymous row
    // MUST be linked (owner transfers) without promoting status or sending a
    // welcome. Once linked, every other mutating method on the service trips
    // the terminal block — the email is poisoned regardless of who owns it.
    it('links a bounced anonymous row without promoting it or dispatching welcome', async () => {
        const { svc, dispatcher } = makeService();

        enqueueResponse([
            {
                id: '99999999-9999-4999-a999-999999999991',
                status: 'bounced',
                email: EMAIL,
                channel: 'email',
                locale: 'es'
            }
        ]);
        enqueueResponse([]); // UPDATE response

        const result = await svc.linkAnonymousSubscribersToUser({
            userId: USER_ID,
            email: EMAIL,
            accountEmailVerified: true
        });

        expect(result.error).toBeUndefined();
        expect(result.data?.linkedCount).toBe(1);
        // Bounced does NOT get promoted by the CASE (only pending_verification does).
        expect(result.data?.promotedToActiveCount).toBe(0);
        expect(dispatcher.sendWelcome).not.toHaveBeenCalled();
    });
});

// ===========================================================================
// getEligibleForCampaign
// ===========================================================================

describe('NewsletterSubscriberService.getEligibleForCampaign', () => {
    it('returns eligible ids and soft-capped count', async () => {
        const { svc } = makeService();

        // First query: totalCandidates count
        enqueueResponse([{ total: 5 }]);
        // Second query: eligible ids (2 out of 5 are soft-capped)
        enqueueResponse([{ id: 'id-1' }, { id: 'id-2' }, { id: 'id-3' }]);

        const result = await svc.getEligibleForCampaign({
            localeFilter: 'es',
            softCapWindowDays: 7
        });

        expect(result.error).toBeUndefined();
        expect(result.data?.totalCandidates).toBe(5);
        expect(result.data?.eligibleIds).toHaveLength(3);
        expect(result.data?.softCappedCount).toBe(2);
        expect(result.data?.eligibleIds).toEqual(['id-1', 'id-2', 'id-3']);
    });

    it('returns empty result when there are no candidates', async () => {
        const { svc } = makeService();

        // totalCandidates = 0
        enqueueResponse([{ total: 0 }]);

        const result = await svc.getEligibleForCampaign({
            localeFilter: 'all',
            softCapWindowDays: 7
        });

        expect(result.error).toBeUndefined();
        expect(result.data?.eligibleIds).toHaveLength(0);
        expect(result.data?.softCappedCount).toBe(0);
        expect(result.data?.totalCandidates).toBe(0);
    });

    it('includes NOT EXISTS fragment in the SQL for soft-cap enforcement', async () => {
        const { svc } = makeService();

        enqueueResponse([{ total: 2 }]);
        enqueueResponse([{ id: 'id-1' }, { id: 'id-2' }]);

        await svc.getEligibleForCampaign({
            localeFilter: 'es',
            softCapWindowDays: 7
        });

        // The second captured SQL (eligible query) must contain NOT EXISTS
        const eligibleSql = capturedSqlStrings[1] ?? '';
        expect(eligibleSql.toLowerCase()).toContain('not exists');
    });

    it('adds a COALESCE-defaulted preferences JSONB filter when contentType is provided', async () => {
        const { svc } = makeService();

        enqueueResponse([{ total: 5 }]);
        enqueueResponse([{ id: 'id-1' }, { id: 'id-2' }, { id: 'id-3' }]);

        const result = await svc.getEligibleForCampaign({
            localeFilter: 'es',
            softCapWindowDays: 7,
            contentType: 'offers' as never
        });

        expect(result.error).toBeUndefined();

        // Both the count and the eligible query must carry the preferences filter.
        const countSql = capturedSqlStrings[0] ?? '';
        const eligibleSql = capturedSqlStrings[1] ?? '';
        expect(countSql).toContain('preferences->>');
        expect(countSql).toContain('COALESCE');
        expect(eligibleSql).toContain('preferences->>');
        expect(eligibleSql).toContain('COALESCE');
    });

    it('omits the preferences filter entirely when contentType is not provided', async () => {
        const { svc } = makeService();

        enqueueResponse([{ total: 5 }]);
        enqueueResponse([{ id: 'id-1' }]);

        await svc.getEligibleForCampaign({
            localeFilter: 'es',
            softCapWindowDays: 7
            // no contentType
        });

        const countSql = capturedSqlStrings[0] ?? '';
        const eligibleSql = capturedSqlStrings[1] ?? '';
        expect(countSql).not.toContain('preferences');
        expect(eligibleSql).not.toContain('preferences');
    });

    it('rejects unknown contentType values via Zod validation', async () => {
        const { svc } = makeService();

        const result = await svc.getEligibleForCampaign({
            localeFilter: 'es',
            softCapWindowDays: 7,
            contentType: 'unknown-content-type' as never
        });

        expect(result.error?.code).toBe('VALIDATION_ERROR');
    });
});

// ===========================================================================
// adminList
// ===========================================================================

/** Minimal valid admin search params (required base fields have defaults in practice). */
const BASE_ADMIN_PARAMS = {
    page: 1,
    pageSize: 50,
    sort: 'createdAt:desc',
    status: 'all',
    includeDeleted: false
} as const;

describe('NewsletterSubscriberService.adminList', () => {
    it('returns FORBIDDEN when actor lacks NEWSLETTER_SUBSCRIBER_VIEW', async () => {
        const { svc } = makeService();
        const actor = makeOwnerActor(); // no NEWSLETTER_SUBSCRIBER_VIEW

        const result = await svc.adminList(actor, BASE_ADMIN_PARAMS as never);

        expect(result.error?.code).toBe('FORBIDDEN');
        expect(result.error?.reason).toBe('NEWSLETTER_SUBSCRIBER_PERMISSION_DENIED');
    });

    it('returns paginated list for a valid admin actor', async () => {
        const { svc } = makeService();
        const actor = makeAdminActor();

        enqueueResponse([{ total: 2 }]);
        enqueueResponse([makeSubscriberRow(), makeSubscriberRow({ id: 'aaaa-bbbb' })]);

        const result = await svc.adminList(actor, BASE_ADMIN_PARAMS as never);

        expect(result.error).toBeUndefined();
        expect(result.data?.total).toBe(2);
        expect(result.data?.items).toHaveLength(2);
        expect(result.data?.page).toBe(1);
        expect(result.data?.pageSize).toBe(50);
    });
});

// ===========================================================================
// getStats
// ===========================================================================

describe('NewsletterSubscriberService.getStats', () => {
    it('returns FORBIDDEN when actor lacks NEWSLETTER_SUBSCRIBER_VIEW', async () => {
        const { svc } = makeService();
        const actor = makeOwnerActor(); // no NEWSLETTER_SUBSCRIBER_VIEW

        const result = await svc.getStats(actor);

        expect(result.error?.code).toBe('FORBIDDEN');
        expect(result.error?.reason).toBe('NEWSLETTER_SUBSCRIBER_PERMISSION_DENIED');
    });

    it('returns aggregated counts for a valid admin actor', async () => {
        const { svc } = makeService();
        const actor = makeAdminActor();

        enqueueResponse([
            {
                totalActive: 10,
                totalPending: 3,
                totalUnsubscribed: 5,
                totalBounced: 1,
                totalComplained: 0
            }
        ]);

        const result = await svc.getStats(actor);

        expect(result.error).toBeUndefined();
        expect(result.data?.totalActive).toBe(10);
        expect(result.data?.totalPending).toBe(3);
        expect(result.data?.totalUnsubscribed).toBe(5);
        expect(result.data?.totalBounced).toBe(1);
        expect(result.data?.totalComplained).toBe(0);
    });
});
