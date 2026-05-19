/**
 * Unit tests for the protected resend-verification + unsubscribe handlers
 * (SPEC-101 T-101-21). Pure handler tests with stubbed services.
 */

import { describe, expect, it, vi } from 'vitest';
import {
    type ResendNewsletterService,
    resendHandler
} from '../../../src/routes/newsletter/protected/resend';
import {
    type UnsubscribeNewsletterService,
    unsubscribeHandler
} from '../../../src/routes/newsletter/protected/unsubscribe';

const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const buildCtx = () =>
    ({
        get: (k: string) =>
            k === 'actor' ? { id: ACTOR_ID, role: 'USER', permissions: [] as string[] } : undefined,
        req: { header: () => undefined }
    }) as unknown as Parameters<typeof resendHandler>[0];

describe('resendHandler', () => {
    it('calls resendVerification with the authenticated actor id', async () => {
        const newsletterService: ResendNewsletterService = {
            resendVerification: vi.fn().mockResolvedValue({ data: { sent: true }, error: null })
        };

        const result = await resendHandler(buildCtx(), { newsletterService });

        expect(result).toEqual({ sent: true });
        expect(newsletterService.resendVerification).toHaveBeenCalledWith(
            expect.objectContaining({ id: ACTOR_ID }),
            ACTOR_ID
        );
    });

    it('propagates service errors', async () => {
        const newsletterService: ResendNewsletterService = {
            resendVerification: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'NOT_FOUND', message: 'no row' }
            })
        };

        await expect(resendHandler(buildCtx(), { newsletterService })).rejects.toThrow(/no row/);
    });
});

describe('unsubscribeHandler', () => {
    it('returns "unsubscribed" when a row was flipped', async () => {
        const newsletterService: UnsubscribeNewsletterService = {
            unsubscribeAuthenticated: vi.fn().mockResolvedValue({
                data: { status: 'unsubscribed' },
                error: null
            })
        };

        const result = await unsubscribeHandler(buildCtx(), { newsletterService });

        expect(result).toEqual({ status: 'unsubscribed' });
        expect(newsletterService.unsubscribeAuthenticated).toHaveBeenCalledWith(
            expect.objectContaining({ id: ACTOR_ID }),
            ACTOR_ID
        );
    });

    it('returns "not_subscribed" when there was no active row', async () => {
        const newsletterService: UnsubscribeNewsletterService = {
            unsubscribeAuthenticated: vi.fn().mockResolvedValue({
                data: { status: 'not_subscribed' },
                error: null
            })
        };

        const result = await unsubscribeHandler(buildCtx(), { newsletterService });

        expect(result).toEqual({ status: 'not_subscribed' });
    });

    it('propagates service errors', async () => {
        const newsletterService: UnsubscribeNewsletterService = {
            unsubscribeAuthenticated: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'FORBIDDEN', message: 'nope' }
            })
        };

        await expect(unsubscribeHandler(buildCtx(), { newsletterService })).rejects.toThrow(/nope/);
    });

    it('throws INTERNAL_ERROR when the service returns no data and no error', async () => {
        const newsletterService: UnsubscribeNewsletterService = {
            unsubscribeAuthenticated: vi.fn().mockResolvedValue({ data: null, error: null })
        };

        await expect(unsubscribeHandler(buildCtx(), { newsletterService })).rejects.toThrow(
            /no data/
        );
    });
});
