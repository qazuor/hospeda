/**
 * Unit tests for the public newsletter guest resend POST handler.
 * Anti-enumeration: handler ALWAYS reports `{ sent: true }` regardless of
 * whether the service decided to actually email.
 */

import { describe, expect, it, vi } from 'vitest';
import {
    type GuestResendBody,
    type GuestResendNewsletterService,
    guestResendHandler
} from '../../../src/routes/newsletter/public/resend';

const buildCtx = () =>
    ({
        get: () => undefined,
        req: { header: () => undefined }
    }) as unknown as Parameters<typeof guestResendHandler>[0];

describe('guestResendHandler', () => {
    it('returns sent:true when the service confirms (matching row)', async () => {
        const svc: GuestResendNewsletterService = {
            resendGuestVerification: vi
                .fn()
                .mockResolvedValue({ data: { sent: true }, error: null })
        };
        const result = await guestResendHandler(
            buildCtx(),
            { email: 'guest@example.com' } as GuestResendBody,
            { newsletterService: svc }
        );
        expect(result).toEqual({ sent: true });
        expect(svc.resendGuestVerification).toHaveBeenCalledWith({
            email: 'guest@example.com'
        });
    });

    it('returns sent:true even when no matching row exists (anti-enumeration parity)', async () => {
        const svc: GuestResendNewsletterService = {
            resendGuestVerification: vi
                .fn()
                .mockResolvedValue({ data: { sent: true }, error: null })
        };
        const result = await guestResendHandler(
            buildCtx(),
            { email: 'never-seen@example.com' } as GuestResendBody,
            { newsletterService: svc }
        );
        expect(result.sent).toBe(true);
    });

    it('re-throws ServiceError when the service rejects', async () => {
        const svc: GuestResendNewsletterService = {
            resendGuestVerification: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'VALIDATION_ERROR' as never, message: 'bad input' }
            })
        };

        await expect(
            guestResendHandler(buildCtx(), { email: 'guest@example.com' } as GuestResendBody, {
                newsletterService: svc
            })
        ).rejects.toThrow('bad input');
    });
});
