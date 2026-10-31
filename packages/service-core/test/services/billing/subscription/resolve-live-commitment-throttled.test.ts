import type { LiveCommitment } from '@repo/db';
import { describe, expect, it } from 'vitest';
import {
    rejectedCreationResult,
    resolveLiveCommitmentReuse,
    throttledCreationResult
} from '../../../../src/services/billing/subscription/resolve-live-commitment';

const clock = { now: () => new Date('2026-10-30T12:00:00.000Z') };

function commitmentWith(result: Record<string, unknown>): LiveCommitment {
    return {
        subscription: {
            id: 'sub-1',
            status: 'PENDING_AUTHORIZATION',
            billingOptionId: 'opt-1',
            authorizationWindowEndsAt: new Date('2026-10-31T12:00:00.000Z')
        },
        idempotencyKey: {
            key: 'key-1',
            completedAt: new Date('2026-10-30T11:59:00.000Z'),
            result
        },
        providerLink: null
    } as unknown as LiveCommitment;
}

describe('HOS-1976 throttled creation result', () => {
    it('is distinct from a provider rejection', () => {
        expect(throttledCreationResult()).toEqual({
            outcome: 'THROTTLED_BY_PROVIDER',
            code: 'RATE_LIMITED'
        });
        expect(throttledCreationResult()).not.toEqual(rejectedCreationResult());
    });

    it.each([
        ['rejected', rejectedCreationResult()],
        ['throttled', throttledCreationResult()]
    ])('recreates on the same row after a %s creation', async (_label, result) => {
        const decision = await resolveLiveCommitmentReuse({
            commitment: commitmentWith(result),
            billingOptionId: 'opt-1',
            clock,
            payerEmail: 'payer@example.test'
        });
        expect(decision).toEqual({ kind: 'RECREATE', rejectedKey: 'key-1' });
    });
});
