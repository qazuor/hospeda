import { describe, expect, it } from 'vitest';
import {
    ProviderWatchAcceptShapeInputSchema,
    ProviderWatchAuthorizeInputSchema,
    ProviderWatchShapeReviewSchema
} from '../../src/entities/providerWatch/provider-watch.schema';

const UUID = '11111111-1111-4111-8111-111111111111';

describe('ProviderWatchAuthorizeInputSchema', () => {
    const valid = { month: '2026-11', maxChargeMinor: 150000, confirmedAccountId: '100000001' };

    it('takes the month, the maximum charge and the account id the owner SAW', () => {
        expect(ProviderWatchAuthorizeInputSchema.safeParse(valid).success).toBe(true);
    });

    it('accepts an amount of 0 for a read-only battery, and never a negative one', () => {
        expect(
            ProviderWatchAuthorizeInputSchema.safeParse({ ...valid, maxChargeMinor: 0 }).success
        ).toBe(true);
        expect(
            ProviderWatchAuthorizeInputSchema.safeParse({ ...valid, maxChargeMinor: -1 }).success
        ).toBe(false);
    });

    it('does not accept an account id of its own: the API stores the one it read', () => {
        const parsed = ProviderWatchAuthorizeInputSchema.parse({ ...valid, accountId: '999' });
        expect(parsed).not.toHaveProperty('accountId');
    });

    it.each([
        ['no confirmed account id', { month: '2026-11', maxChargeMinor: 1 }],
        ['a non-numeric account id', { ...valid, confirmedAccountId: 'abc' }],
        ['a bad month', { ...valid, month: '2026-13' }],
        ['a decimal amount', { ...valid, maxChargeMinor: 1.5 }]
    ])('rejects %s', (_name, value) => {
        expect(ProviderWatchAuthorizeInputSchema.safeParse(value).success).toBe(false);
    });
});

describe('ProviderWatchAcceptShapeInputSchema', () => {
    it('names the account and the run whose observation is accepted', () => {
        expect(
            ProviderWatchAcceptShapeInputSchema.safeParse({ account: 'sandbox', runId: UUID })
                .success
        ).toBe(true);
        expect(
            ProviderWatchAcceptShapeInputSchema.safeParse({ account: 'staging', runId: UUID })
                .success
        ).toBe(false);
        expect(
            ProviderWatchAcceptShapeInputSchema.safeParse({ account: 'sandbox', runId: 'x' })
                .success
        ).toBe(false);
    });
});

describe('ProviderWatchShapeReviewSchema', () => {
    it('accepts a review with no accepted baseline yet', () => {
        expect(
            ProviderWatchShapeReviewSchema.safeParse({
                measurementId: 'M1',
                account: 'sandbox',
                runId: UUID,
                observedAt: '2026-11-17T12:00:00.000Z',
                observed: { create: { $: 'object' } },
                accepted: null,
                acceptedAt: null,
                acceptedBy: null,
                inSync: false,
                differences: []
            }).success
        ).toBe(true);
    });
});
