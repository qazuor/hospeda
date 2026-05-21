/**
 * Unit tests for the protected newsletter subscribe + status handlers
 * (SPEC-101 T-101-20).
 *
 * Tests the PURE handlers directly with stubbed services. No initApp, no
 * real DB, no auth middleware — that wiring is exercised by Phase 5 E2E
 * tests (T-101-52).
 */

import { NewsletterSubscriberStatusEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import {
    type StatusNewsletterService,
    statusHandler
} from '../../../src/routes/newsletter/protected/status';
import {
    type SubscribeBody,
    type SubscribeNewsletterService,
    type SubscribeUserService,
    subscribeHandler
} from '../../../src/routes/newsletter/protected/subscribe';

const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const buildActor = () => ({
    id: ACTOR_ID,
    role: 'USER',
    permissions: [] as string[]
});

const buildCtx = (opts: {
    headers?: Record<string, string>;
}) => {
    const actor = buildActor();
    const headers = opts.headers ?? {};
    return {
        get: (key: string) => (key === 'actor' ? actor : undefined),
        req: {
            header: (name: string) => headers[name.toLowerCase()]
        }
    } as unknown as Parameters<typeof subscribeHandler>[0];
};

// ---------------------------------------------------------------------------
// subscribeHandler
// ---------------------------------------------------------------------------

describe('subscribeHandler', () => {
    const buildUserSvc = (
        email: string | null = 'subscriber@example.com'
    ): SubscribeUserService => ({
        getById: vi.fn().mockResolvedValue({ data: { id: ACTOR_ID, email }, error: null })
    });

    const buildNewsletterSvc = (
        status: 'pending_verification' | 'active' | 'already_pending' = 'pending_verification'
    ): SubscribeNewsletterService => ({
        subscribe: vi.fn().mockResolvedValue({ data: { status }, error: null })
    });

    it('resolves the email from the user record and calls subscribe with consent fingerprint', async () => {
        const userService = buildUserSvc('me@example.com');
        const newsletterService = buildNewsletterSvc('pending_verification');

        const ctx = buildCtx({
            headers: {
                'cf-connecting-ip': '203.0.113.42',
                'user-agent': 'Mozilla/5.0 (Test)'
            }
        });
        const body: SubscribeBody = { locale: 'es', source: 'web_footer' };

        const result = await subscribeHandler(ctx, body, {
            userService,
            newsletterService
        });

        expect(result).toEqual({ status: 'pending_verification' });
        expect(newsletterService.subscribe).toHaveBeenCalledWith(
            expect.objectContaining({ id: ACTOR_ID }),
            expect.objectContaining({
                userId: ACTOR_ID,
                email: 'me@example.com',
                locale: 'es',
                source: 'web_footer',
                consentIp: '203.0.113.42',
                consentUa: 'Mozilla/5.0 (Test)',
                consentVersion: 'spec-101-v1'
            })
        );
    });

    it('falls back to x-forwarded-for and trims the first hop', async () => {
        const userService = buildUserSvc();
        const newsletterService = buildNewsletterSvc();

        const ctx = buildCtx({
            headers: {
                'x-forwarded-for': '198.51.100.1, 70.41.3.18, 150.172.238.178',
                'user-agent': 'curl/8'
            }
        });

        await subscribeHandler(ctx, {}, { userService, newsletterService });

        expect(newsletterService.subscribe).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ consentIp: '198.51.100.1', consentUa: 'curl/8' })
        );
    });

    it('defaults source to account_preferences when not provided', async () => {
        const userService = buildUserSvc();
        const newsletterService = buildNewsletterSvc();

        const ctx = buildCtx({});
        await subscribeHandler(ctx, {}, { userService, newsletterService });

        expect(newsletterService.subscribe).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ source: 'account_preferences' })
        );
    });

    it('passes through "active" status unchanged when the subscriber is already verified', async () => {
        const userService = buildUserSvc();
        const newsletterService = buildNewsletterSvc('active');

        const ctx = buildCtx({});
        const result = await subscribeHandler(
            ctx,
            {},
            {
                userService,
                newsletterService
            }
        );

        expect(result).toEqual({ status: 'active' });
    });

    it('passes through "already_pending" status unchanged', async () => {
        const userService = buildUserSvc();
        const newsletterService = buildNewsletterSvc('already_pending');

        const ctx = buildCtx({});
        const result = await subscribeHandler(
            ctx,
            {},
            {
                userService,
                newsletterService
            }
        );

        expect(result).toEqual({ status: 'already_pending' });
    });

    it('throws when the user record has no email', async () => {
        const userService = buildUserSvc(null);
        const newsletterService = buildNewsletterSvc();

        const ctx = buildCtx({});

        await expect(subscribeHandler(ctx, {}, { userService, newsletterService })).rejects.toThrow(
            /no email/i
        );
        expect(newsletterService.subscribe).not.toHaveBeenCalled();
    });

    it('propagates user-service errors via ServiceError', async () => {
        const userService: SubscribeUserService = {
            getById: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'NOT_FOUND', message: 'gone' }
            })
        };
        const newsletterService = buildNewsletterSvc();

        const ctx = buildCtx({});

        await expect(subscribeHandler(ctx, {}, { userService, newsletterService })).rejects.toThrow(
            /gone/
        );
    });

    it('propagates newsletter-service errors', async () => {
        const userService = buildUserSvc();
        const newsletterService: SubscribeNewsletterService = {
            subscribe: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'FORBIDDEN', message: 'blocked email' }
            })
        };

        const ctx = buildCtx({});

        await expect(subscribeHandler(ctx, {}, { userService, newsletterService })).rejects.toThrow(
            /blocked email/
        );
    });
});

// ---------------------------------------------------------------------------
// statusHandler
// ---------------------------------------------------------------------------

describe('statusHandler', () => {
    it('returns the subscription snapshot serialised as ISO strings', async () => {
        const subscribedAt = new Date('2026-05-12T15:00:00.000Z');
        const verifiedAt = new Date('2026-05-12T15:05:00.000Z');
        const preferences = {
            offers: true,
            events: true,
            guides: false,
            productNews: true
        };
        const newsletterService: StatusNewsletterService = {
            getStatus: vi.fn().mockResolvedValue({
                data: {
                    subscribed: true,
                    status: NewsletterSubscriberStatusEnum.ACTIVE,
                    subscribedAt,
                    verifiedAt,
                    preferences
                },
                error: null
            })
        };

        const ctx = buildCtx({});
        const result = await statusHandler(ctx, { newsletterService });

        expect(result).toEqual({
            subscribed: true,
            status: NewsletterSubscriberStatusEnum.ACTIVE,
            subscribedAt: subscribedAt.toISOString(),
            verifiedAt: verifiedAt.toISOString(),
            preferences
        });
        expect(newsletterService.getStatus).toHaveBeenCalledWith(
            expect.objectContaining({ id: ACTOR_ID }),
            ACTOR_ID
        );
    });

    it('returns null timestamps and null preferences when the user has no subscription row', async () => {
        const newsletterService: StatusNewsletterService = {
            getStatus: vi.fn().mockResolvedValue({
                data: {
                    subscribed: false,
                    status: null,
                    subscribedAt: null,
                    verifiedAt: null,
                    preferences: null
                },
                error: null
            })
        };

        const ctx = buildCtx({});
        const result = await statusHandler(ctx, { newsletterService });

        expect(result).toEqual({
            subscribed: false,
            status: null,
            subscribedAt: null,
            verifiedAt: null,
            preferences: null
        });
    });

    it('propagates errors from the service', async () => {
        const newsletterService: StatusNewsletterService = {
            getStatus: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'FORBIDDEN', message: 'no peeking' }
            })
        };

        const ctx = buildCtx({});

        await expect(statusHandler(ctx, { newsletterService })).rejects.toThrow(/no peeking/);
    });
});
