/**
 * Unit tests for the public newsletter guest subscribe POST handler.
 *
 * Tests the PURE handler directly with stubbed services. Auth middleware,
 * rate limiting, and routing are exercised by the E2E test in Phase 7.
 */

import { NewsletterSourceEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import {
    type GuestSubscribeBody,
    type GuestSubscribeNewsletterService,
    guestSubscribeHandler
} from '../../../src/routes/newsletter/public/subscribe';

const buildCtx = (headers: Record<string, string> = {}) =>
    ({
        get: () => undefined,
        req: { header: (name: string) => headers[name.toLowerCase()] }
    }) as unknown as Parameters<typeof guestSubscribeHandler>[0];

describe('guestSubscribeHandler', () => {
    it('forwards the parsed body to subscribeGuest with consent metadata from headers', async () => {
        const svc: GuestSubscribeNewsletterService = {
            subscribeGuest: vi
                .fn()
                .mockResolvedValue({ data: { status: 'pending_verification' }, error: null })
        };

        const body: GuestSubscribeBody = {
            email: 'guest@example.com',
            locale: 'es',
            source: 'web_footer'
        };
        const ctx = buildCtx({
            'cf-connecting-ip': '203.0.113.10',
            'user-agent': 'Mozilla/5.0 (test)'
        });

        const result = await guestSubscribeHandler(ctx, body, { newsletterService: svc });

        expect(result).toEqual({ status: 'pending_verification' });
        expect(svc.subscribeGuest).toHaveBeenCalledWith({
            email: 'guest@example.com',
            locale: 'es',
            source: NewsletterSourceEnum.WEB_FOOTER,
            consentIp: '203.0.113.10',
            consentUa: 'Mozilla/5.0 (test)',
            consentVersion: 'spec-101-v1'
        });
    });

    it('falls back to x-forwarded-for when cf-connecting-ip is absent', async () => {
        const svc: GuestSubscribeNewsletterService = {
            subscribeGuest: vi
                .fn()
                .mockResolvedValue({ data: { status: 'pending_verification' }, error: null })
        };

        const ctx = buildCtx({
            'x-forwarded-for': '198.51.100.7, 70.41.3.18',
            'user-agent': 'Mozilla/5.0'
        });

        await guestSubscribeHandler(ctx, { email: 'g@example.com' } as GuestSubscribeBody, {
            newsletterService: svc
        });

        expect(svc.subscribeGuest).toHaveBeenCalledWith(
            expect.objectContaining({ consentIp: '198.51.100.7' })
        );
    });

    it('passes through the active status when the email is already subscribed', async () => {
        const svc: GuestSubscribeNewsletterService = {
            subscribeGuest: vi.fn().mockResolvedValue({ data: { status: 'active' }, error: null })
        };

        const result = await guestSubscribeHandler(
            buildCtx(),
            { email: 'already-active@example.com' } as GuestSubscribeBody,
            { newsletterService: svc }
        );

        expect(result.status).toBe('active');
    });

    it('re-throws ServiceError when the service rejects (e.g. blocked terminal state)', async () => {
        const svc: GuestSubscribeNewsletterService = {
            subscribeGuest: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'FORBIDDEN' as never, message: 'blocked' }
            })
        };

        await expect(
            guestSubscribeHandler(
                buildCtx(),
                { email: 'bounced@example.com' } as GuestSubscribeBody,
                { newsletterService: svc }
            )
        ).rejects.toThrow('blocked');
    });
});
