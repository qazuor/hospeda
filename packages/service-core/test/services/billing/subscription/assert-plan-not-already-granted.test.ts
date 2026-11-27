import { describe, expect, it, vi } from 'vitest';
import type { LivePermanentGrantPlan } from '../../../../src/services/billing/grant/permanent-grant-live-plan';
import { assertPlanNotAlreadyGranted } from '../../../../src/services/billing/subscription/assert-plan-not-already-granted';
import { ServiceError } from '../../../../src/types';

const userId = '00000000-0000-4000-8000-000000000001';
const vipPlanId = '00000000-0000-4000-8000-0000000000a1';
const higherPlanId = '00000000-0000-4000-8000-0000000000a2';

function grantOf(planId: string): LivePermanentGrantPlan {
    return {
        planId,
        planVersionId: '00000000-0000-4000-8000-0000000000b1',
        planName: 'Turista VIP',
        since: new Date('2026-11-01T10:00:00.000Z')
    };
}

describe('HOS-2665 S1 refuses a checkout for a plan held through a live permanent grant', () => {
    it('rejects the same plan with 409 ALREADY_EXISTS / PLAN_ALREADY_GRANTED', async () => {
        // Arrange
        const readGrantPlan = vi.fn(async () => ({ plan: grantOf(vipPlanId) }));

        // Act
        const attempt = assertPlanNotAlreadyGranted({
            userId,
            choice: { vertical: 'tourist', planId: vipPlanId },
            readGrantPlan
        });

        // Assert
        await expect(attempt).rejects.toBeInstanceOf(ServiceError);
        await expect(attempt).rejects.toMatchObject({
            code: 'ALREADY_EXISTS',
            reason: 'PLAN_ALREADY_GRANTED'
        });
        expect(readGrantPlan).toHaveBeenCalledWith({ userId, vertical: 'tourist' });
    });

    it('allows an upgrade to a different plan of the granted vertical', async () => {
        const readGrantPlan = vi.fn(async () => ({ plan: grantOf(vipPlanId) }));

        await expect(
            assertPlanNotAlreadyGranted({
                userId,
                choice: { vertical: 'accommodation', planId: higherPlanId },
                readGrantPlan
            })
        ).resolves.toBeUndefined();
    });

    it('allows any plan when no live grant anchors the vertical', async () => {
        const readGrantPlan = vi.fn(async () => ({ plan: null }));

        await expect(
            assertPlanNotAlreadyGranted({
                userId,
                choice: { vertical: 'tourist', planId: vipPlanId },
                readGrantPlan
            })
        ).resolves.toBeUndefined();
    });
});
