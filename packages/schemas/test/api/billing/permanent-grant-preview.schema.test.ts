import { describe, expect, it } from 'vitest';
import {
    LivePermanentGrantParamsSchema,
    LivePermanentGrantResponseSchema,
    PermanentGrantPreviewResponseSchema,
    PermanentGrantRevocationPreviewResponseSchema
} from '../../../src/api/billing/permanent-grant-preview.schema.js';

const ID = '7a1f4c2e-3b5d-4e6f-8a9b-0c1d2e3f4a5b';
const emptyEffects = {
    stoppedCharges: [],
    endingCourtesies: [],
    closedDeferredBalances: [],
    convertedAddons: []
};

describe('AC:B13a:6 (support) — permanent grant preview contracts', () => {
    it('accepts the real effects shape and empty arrays', () => {
        expect(PermanentGrantPreviewResponseSchema.safeParse(emptyEffects).success).toBe(true);
        expect(
            PermanentGrantPreviewResponseSchema.safeParse({
                stoppedCharges: [
                    {
                        subscriptionId: ID,
                        vertical: 'accommodation',
                        status: 'ACTIVE',
                        providerEmail: true
                    }
                ],
                endingCourtesies: [
                    {
                        subscriptionId: ID,
                        vertical: 'accommodation',
                        endsAt: '2026-11-07T00:00:00.000Z',
                        providerEmail: true
                    }
                ],
                closedDeferredBalances: [
                    { courtesyGrantId: ID, vertical: 'accommodation', balanceMonths: 3 }
                ],
                convertedAddons: [
                    {
                        addonInstanceId: ID,
                        addonName: 'Addon',
                        complementSubscriptionId: ID,
                        providerEmail: true
                    }
                ]
            }).success
        ).toBe(true);
    });

    it('requires the fixed revocation facts', () => {
        const preview = {
            permanentGrantId: ID,
            verticalsLosingService: ['accommodation'],
            addonsTurnedOff: [],
            trialReturns: false,
            oldDebitResumes: false
        };
        expect(PermanentGrantRevocationPreviewResponseSchema.safeParse(preview).success).toBe(true);
        expect(
            PermanentGrantRevocationPreviewResponseSchema.safeParse({
                ...preview,
                trialReturns: true
            }).success
        ).toBe(false);
    });

    it('accepts a null live grant and validates beneficiary UUID', () => {
        expect(LivePermanentGrantResponseSchema.safeParse({ grant: null }).success).toBe(true);
        expect(
            LivePermanentGrantResponseSchema.safeParse({
                grant: {
                    permanentGrantId: ID,
                    includesAddons: false,
                    createdAt: '2026-11-07T00:00:00.000Z',
                    anchors: [{ vertical: 'venue', planId: ID, floorPlanVersionId: ID }]
                }
            }).success
        ).toBe(true);
        expect(LivePermanentGrantParamsSchema.safeParse({ userId: 'bad' }).success).toBe(false);
    });
});
