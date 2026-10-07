/**
 * HOS-1627 (AC:U2:12) — the idempotency key and the write of a provider
 * hard-bounce event. The DB half (one row per event, suppression afterwards)
 * is TEST:U2:14 in `apps/api/test/integration/webhooks/brevo-hard-bounce.test.ts`.
 */

import { describe, expect, it, vi } from 'vitest';
import {
    buildProviderHardBounceKey,
    recordProviderHardBounce
} from '../../../src/services/outbox/email-provider-bounce';

describe('buildProviderHardBounceKey', () => {
    it('keys on provider, lower-cased address and message id', () => {
        // Act
        const { idempotencyKey } = buildProviderHardBounceKey({
            provider: 'brevo',
            recipient: '  User@Example.COM ',
            messageId: '<abc@relay>'
        });

        // Assert
        expect(idempotencyKey).toBe('brevo:hard_bounce:user@example.com:<abc@relay>');
    });

    it('falls back to the address alone without a message id', () => {
        // Act
        const withoutId = buildProviderHardBounceKey({ provider: 'brevo', recipient: 'a@b.co' });
        const blankId = buildProviderHardBounceKey({
            provider: 'brevo',
            recipient: 'A@B.co',
            messageId: '  '
        });

        // Assert
        expect(withoutId.idempotencyKey).toBe('brevo:hard_bounce:a@b.co');
        expect(blankId.idempotencyKey).toBe('brevo:hard_bounce:a@b.co');
    });

    it('distinguishes two messages to the same address', () => {
        // Act
        const first = buildProviderHardBounceKey({
            provider: 'brevo',
            recipient: 'a@b.co',
            messageId: 'm1'
        });
        const second = buildProviderHardBounceKey({
            provider: 'brevo',
            recipient: 'a@b.co',
            messageId: 'm2'
        });

        // Assert
        expect(first.idempotencyKey).not.toBe(second.idempotencyKey);
    });
});

describe('recordProviderHardBounce', () => {
    it('writes the bounce through the log model with the event key', async () => {
        // Arrange
        const log = { recordProviderHardBounce: vi.fn().mockResolvedValue({ inserted: true }) };
        const at = new Date('2026-10-07T12:00:00.000Z');

        // Act
        const result = await recordProviderHardBounce({
            log,
            provider: 'brevo',
            recipient: ' user@example.com ',
            messageId: 'm1',
            reason: 'mailbox does not exist',
            at
        });

        // Assert
        expect(result).toEqual({
            inserted: true,
            idempotencyKey: 'brevo:hard_bounce:user@example.com:m1'
        });
        expect(log.recordProviderHardBounce).toHaveBeenCalledWith({
            recipient: 'user@example.com',
            provider: 'brevo',
            idempotencyKey: 'brevo:hard_bounce:user@example.com:m1',
            at,
            providerMessageId: 'm1',
            reason: 'mailbox does not exist'
        });
    });
});
