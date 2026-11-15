import type { LiveCommitment } from '@repo/db';
import { describe, expect, it } from 'vitest';
import { resolveLiveCommitmentReuse } from '../../../../src/services/billing/subscription/resolve-live-commitment';

const clock = { now: () => new Date('2026-10-10T12:00:00.000Z') };

describe('HOS-1580 live commitment detail', () => {
    it.each([
        [null, 'LIVE_PRINCIPAL'],
        ['123e4567-e89b-42d3-a456-426614174000', 'SUCCESSOR_PENDING']
    ])('reads succeedsId %s as %s without changing COMMITMENT_TAKEN', async (succeedsId, takenBy) => {
        const commitment = {
            subscription: {
                status: 'PENDING_AUTHORIZATION',
                billingOptionId: 'another-option',
                succeedsId
            },
            idempotencyKey: null,
            providerLink: null
        } as LiveCommitment;
        await expect(
            resolveLiveCommitmentReuse({
                commitment,
                billingOptionId: 'requested-option',
                clock,
                payerEmail: 'payer@example.test'
            })
        ).rejects.toMatchObject({
            reason: 'COMMITMENT_TAKEN',
            details: { takenBy }
        });
    });
});
