/**
 * Smoke test for the commerce owner credentials notification port
 * (SPEC-249 T-024, AC-5 — verify-only).
 *
 * Asserts that provisioning a commerce owner delivers the credentials email:
 * the port calls `sendNotification` with the COMMERCE_OWNER_CREDENTIALS type,
 * the owner's email as recipient, the temporary password, and a
 * change-password URL. The template + send path already exist (SPEC-239) —
 * this only asserts the contract.
 *
 * @module test/lib/commerce-ports.test
 */

import { NotificationType } from '@repo/notifications';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the notification transport so no real email is sent.
vi.mock('../../src/utils/notification-helper', () => ({
    sendNotification: vi.fn().mockResolvedValue(undefined)
}));

import { createCommerceOwnerCredentialsNotificationPort } from '../../src/lib/commerce-ports';
import { sendNotification } from '../../src/utils/notification-helper';

const mockedSend = vi.mocked(sendNotification);

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
});
