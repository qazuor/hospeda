/**
 * Tests for `sendAppEmail`, the wrapper that applies the deployment marker to
 * every `@repo/email` send.
 *
 * These live in their own file because they mock `@repo/email` and the env
 * module, which the pure-decoration tests in `email-sender.test.ts`
 * deliberately do not.
 *
 * The `@repo/email` mock is partial (`importOriginal`) so that adding another
 * import from that package to the module under test cannot silently resolve to
 * `undefined` and leave these assertions passing over a no-op.
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

const { sendAppEmail } = await import('../../src/utils/email-sender');

describe('sendAppEmail', () => {
    beforeEach(() => {
        mockSendEmail.mockReset();
        mockSendEmail.mockResolvedValue({ success: true, messageId: '<id@brevo>' });
        for (const key of Object.keys(mockEnv)) {
            delete mockEnv[key];
        }
    });

    it('marks the subject and the sender name on staging', async () => {
        // Arrange
        mockEnv.HOSPEDA_DEPLOY_ENV = 'preview';

        // Act
        await sendAppEmail({
            client: {} as never,
            to: 'user@example.com',
            subject: 'Restablece tu contraseña de Hospeda',
            react: {} as never
        });

        // Assert
        expect(mockSendEmail).toHaveBeenCalledTimes(1);
        const [input] = mockSendEmail.mock.calls[0] as [Record<string, unknown>];
        expect(input.subject).toBe('[STAGING] Restablece tu contraseña de Hospeda');
        expect(input.fromName).toBe('Hospeda [STAGING]');
    });

    it('sends production email unmarked', async () => {
        // Arrange
        mockEnv.HOSPEDA_DEPLOY_ENV = 'prod';

        // Act
        await sendAppEmail({
            client: {} as never,
            to: 'user@example.com',
            subject: 'Restablece tu contraseña de Hospeda',
            react: {} as never
        });

        // Assert
        const [input] = mockSendEmail.mock.calls[0] as [Record<string, unknown>];
        expect(input.subject).toBe('Restablece tu contraseña de Hospeda');
        expect(input.fromName).toBe('Hospeda');
    });

    it('honours a configured sender identity while adding the marker', async () => {
        // Arrange
        mockEnv.HOSPEDA_DEPLOY_ENV = 'preview';
        mockEnv.HOSPEDA_EMAIL_FROM_EMAIL = 'avisos@hospeda.com.ar';
        mockEnv.HOSPEDA_EMAIL_FROM_NAME = 'Hospeda Avisos';

        // Act
        await sendAppEmail({
            client: {} as never,
            to: 'user@example.com',
            subject: 'Aviso',
            react: {} as never
        });

        // Assert
        const [input] = mockSendEmail.mock.calls[0] as [Record<string, unknown>];
        expect(input.fromEmail).toBe('avisos@hospeda.com.ar');
        expect(input.fromName).toBe('Hospeda Avisos [STAGING]');
    });

    it('returns the provider result unchanged', async () => {
        // Arrange
        mockEnv.HOSPEDA_DEPLOY_ENV = 'prod';
        mockSendEmail.mockResolvedValue({ success: false, error: 'provider down' });

        // Act
        const result = await sendAppEmail({
            client: {} as never,
            to: 'user@example.com',
            subject: 'Aviso',
            react: {} as never
        });

        // Assert
        expect(result).toEqual({ success: false, error: 'provider down' });
    });
});
