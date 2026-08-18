/**
 * Smoke test for the commerce owner credentials notification port
 * (SPEC-249 T-024, AC-5 — verify-only).
 *
 * Asserts that provisioning a commerce owner delivers the credentials email:
 * the port calls `trySendNotification` with the COMMERCE_OWNER_CREDENTIALS
 * type, the owner's email as recipient, the temporary password, and a
 * change-password URL.
 *
 * It uses `trySendNotification`, not `sendNotification`, because the admin
 * repeats this outcome to the applicant as "las credenciales fueron enviadas".
 * A helper that reports nothing back makes that sentence unverifiable, and the
 * operator ends up chasing a mail nobody sent (H-87 / H-150).
 *
 * @module test/lib/commerce-ports.test
 */

import { NotificationType } from '@repo/notifications';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the notification transport so no real email is sent.
vi.mock('../../src/utils/notification-helper', () => ({
    trySendNotification: vi.fn().mockResolvedValue({ delivered: true })
}));

import { createCommerceOwnerCredentialsNotificationPort } from '../../src/lib/commerce-ports';
import { trySendNotification } from '../../src/utils/notification-helper';

const mockedSend = vi.mocked(trySendNotification);

describe('createCommerceOwnerCredentialsNotificationPort (SPEC-249 T-024, AC-5)', () => {
    beforeEach(() => {
        mockedSend.mockClear();
    });

    it('sends a COMMERCE_OWNER_CREDENTIALS notification with recipient + changePasswordUrl', async () => {
        const port = createCommerceOwnerCredentialsNotificationPort('https://hospeda.com.ar');

        await port.notifyOwnerCredentials({
            email: 'owner@example.com',
            name: 'Lead Owner',
            temporaryPassword: 'temp-pass-abcdef123456',
            leadId: '00000000-0000-4000-a000-0000000000aa'
        });

        expect(mockedSend).toHaveBeenCalledTimes(1);
        const payload = mockedSend.mock.calls[0]?.[0] as unknown as Record<string, unknown>;
        expect(payload.type).toBe(NotificationType.COMMERCE_OWNER_CREDENTIALS);
        expect(payload.recipientEmail).toBe('owner@example.com');
        expect(payload.recipientName).toBe('Lead Owner');
        expect(payload.temporaryPassword).toBe('temp-pass-abcdef123456');
        expect(payload.changePasswordUrl).toBe(
            'https://hospeda.com.ar/mi-cuenta/cambiar-contrasena'
        );
    });

    it('reports the delivery back to the caller', async () => {
        const port = createCommerceOwnerCredentialsNotificationPort('https://hospeda.com.ar');

        const result = await port.notifyOwnerCredentials({
            email: 'owner@example.com',
            name: 'Lead Owner',
            temporaryPassword: 'temp-pass-abcdef123456',
            leadId: '00000000-0000-4000-a000-0000000000aa'
        });

        expect(result).toEqual({ delivered: true });
    });

    it('passes a non-delivery through instead of reporting success', async () => {
        // The provisioning service turns this into `credentialsSent: false`,
        // which is what stops the admin announcing an email that never left.
        mockedSend.mockResolvedValueOnce({ delivered: false });
        const port = createCommerceOwnerCredentialsNotificationPort('https://hospeda.com.ar');

        const result = await port.notifyOwnerCredentials({
            email: 'owner@example.com',
            name: 'Lead Owner',
            temporaryPassword: 'temp-pass-abcdef123456',
            leadId: '00000000-0000-4000-a000-0000000000aa'
        });

        expect(result).toEqual({ delivered: false });
    });
});
