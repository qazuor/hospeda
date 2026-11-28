/**
 * Tests for the direct email sender (HOS-2685): `resolveDirectEmailFromEmail` (D1, AC-11)
 * and `sendDirectAppEmail`, which sends with the caller's From address and the
 * deployment marker.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSendEmail = vi.fn();
const mockEnv: Record<string, string | undefined> = {};

vi.mock('@repo/email', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/email')>()),
    sendEmail: mockSendEmail
}));

vi.mock('../../src/utils/env', () => ({
    get env() {
        return mockEnv;
    }
}));

const { resolveDirectEmailFromEmail, sendDirectAppEmail } = await import(
    '../../src/utils/email-sender'
);

const ATTRIBUTION = { medium: 'transactional', templateKey: 'newsletter.direct-email' } as const;

describe('resolveDirectEmailFromEmail', () => {
    beforeEach(() => {
        for (const key of Object.keys(mockEnv)) delete mockEnv[key];
    });

    it('uses the dedicated subdomain address when HOSPEDA_DIRECT_EMAIL_FROM_EMAIL is set', () => {
        // Arrange
        mockEnv.HOSPEDA_DIRECT_EMAIL_FROM_EMAIL = 'contacto@comercial.hospeda.com.ar';
        mockEnv.HOSPEDA_EMAIL_FROM_EMAIL = 'noreply@hospeda.com.ar';

        // Act / Assert
        expect(resolveDirectEmailFromEmail()).toBe('contacto@comercial.hospeda.com.ar');
    });

    it('falls back to the current sender when it is unset (AC-11)', () => {
        mockEnv.HOSPEDA_EMAIL_FROM_EMAIL = 'ops@hospeda.com.ar';
        expect(resolveDirectEmailFromEmail()).toBe('ops@hospeda.com.ar');
    });

    it('falls back to the default sender when nothing is configured', () => {
        expect(resolveDirectEmailFromEmail()).toBe('noreply@hospeda.com.ar');
    });
});

describe('sendDirectAppEmail', () => {
    beforeEach(() => {
        mockSendEmail.mockReset();
        mockSendEmail.mockResolvedValue({ success: true, messageId: '<id@brevo>' });
        for (const key of Object.keys(mockEnv)) delete mockEnv[key];
    });

    const base = {
        client: { apiKey: 'k', baseUrl: 'https://api.example' },
        to: 'a@example.com',
        subject: 'Hola',
        react: {} as never,
        attribution: ATTRIBUTION,
        fromEmail: 'contacto@comercial.hospeda.com.ar',
        fromName: 'Laura de Hospeda',
        replyTo: 'laura@hospeda.com.ar'
    };

    it('passes the caller From address, name and Reply-To through untouched on production', async () => {
        // Arrange
        mockEnv.HOSPEDA_DEPLOY_ENV = 'prod';

        // Act
        const result = await sendDirectAppEmail(base);

        // Assert
        expect(result).toEqual({ success: true, messageId: '<id@brevo>' });
        expect(mockSendEmail).toHaveBeenCalledWith(
            expect.objectContaining({
                fromEmail: 'contacto@comercial.hospeda.com.ar',
                fromName: 'Laura de Hospeda',
                replyTo: 'laura@hospeda.com.ar',
                subject: 'Hola',
                attribution: ATTRIBUTION
            })
        );
    });

    it('marks the subject and the From name on staging', async () => {
        // Arrange
        mockEnv.HOSPEDA_DEPLOY_ENV = 'preview';

        // Act
        await sendDirectAppEmail(base);

        // Assert
        expect(mockSendEmail).toHaveBeenCalledWith(
            expect.objectContaining({
                fromName: 'Laura de Hospeda [STAGING]',
                subject: '[STAGING] Hola'
            })
        );
    });
});
