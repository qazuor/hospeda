import type { VerticalsForBilling } from '@repo/billing-verticals-contract';
import { CatalogVersionNotFoundError } from '@repo/verticals';
import { describe, expect, it, vi } from 'vitest';
import { assertAnchorFloorsAcceptable } from '../../../../src/services/billing/grant/permanent-grant-floor.js';

const policy = (current: boolean, sellable = false) => ({
    graceDays: 0,
    allowsPause: false,
    current,
    sellable
});
const anchors = ['v1', 'v2'].map((floorPlanVersionId) => ({
    vertical: 'accommodation',
    planId: 'plan',
    floorPlanVersionId
}));

describe('TEST:B9a:11 — permanent grant anchor floor policy', () => {
    it('accepts all current floors and checks each once, in order, with only its version id', async () => {
        const planPolicy = vi.fn(async () => policy(true));
        await expect(
            assertAnchorFloorsAcceptable({ anchors, planPolicy })
        ).resolves.toBeUndefined();
        expect(planPolicy.mock.calls).toEqual([
            [{ planVersionId: 'v1' }],
            [{ planVersionId: 'v2' }]
        ]);
    });

    it('rejects the first non-current floor without querying later anchors', async () => {
        const planPolicy = vi.fn(async ({ planVersionId }: { planVersionId: string }) =>
            policy(planVersionId !== 'v1')
        );
        await expect(assertAnchorFloorsAcceptable({ anchors, planPolicy })).rejects.toMatchObject({
            code: 'VALIDATION_ERROR',
            reason: 'PERMANENT_GRANT_FLOOR_NOT_CURRENT'
        });
        expect(planPolicy).toHaveBeenCalledTimes(1);
    });

    it('maps an absent catalog version to the existing reference rejection', async () => {
        const planPolicy: VerticalsForBilling['planPolicy'] = async () => {
            throw new CatalogVersionNotFoundError({ kind: 'plan_version', id: 'secret-id' });
        };
        await expect(assertAnchorFloorsAcceptable({ anchors, planPolicy })).rejects.toMatchObject({
            reason: 'PERMANENT_GRANT_REFERENCE_NOT_FOUND'
        });
    });

    it('propagates other errors unchanged', async () => {
        const error = new Error('catalog unavailable');
        const planPolicy: VerticalsForBilling['planPolicy'] = async () => {
            throw error;
        };
        await expect(assertAnchorFloorsAcceptable({ anchors, planPolicy })).rejects.toBe(error);
    });

    it('uses current only, accepting current unsellable and rejecting non-current sellable policies', async () => {
        const run = (result: ReturnType<typeof policy>) =>
            assertAnchorFloorsAcceptable({
                anchors: [anchors[0]!],
                planPolicy: async () => result
            });
        await expect(run(policy(true, false))).resolves.toBeUndefined();
        await expect(run(policy(false, true))).rejects.toMatchObject({
            reason: 'PERMANENT_GRANT_FLOOR_NOT_CURRENT'
        });
    });

    it('does not include identifiers in the non-current rejection message', async () => {
        const planPolicy: VerticalsForBilling['planPolicy'] = async () => policy(false);
        try {
            await assertAnchorFloorsAcceptable({ anchors: [anchors[0]!], planPolicy });
            throw new Error('expected rejection');
        } catch (error) {
            expect((error as Error).message).not.toContain('v1');
        }
    });
});
