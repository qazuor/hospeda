import { eq, idempotencyKeys, subscriptions } from '@repo/db';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { startSuccession } from '../../../src/services/billing/subscription/start-succession.service';
import { scheduleSuccessorFirstChargeWithCredit } from '../../../src/services/billing/subscription/successor-credit';
import { closeServiceTestPool, getServiceTestDb } from './helpers';
import {
    ensureBillingDeadlineVersion1,
    seedPredecessor,
    seedSuccessionChoice,
    successionClock,
    successionPorts,
    successionReturnUrl
} from './support/succession-fixtures';

afterAll(closeServiceTestPool);
beforeAll(ensureBillingDeadlineVersion1);
afterEach(() => vi.restoreAllMocks());

describe('HOS-2218 successor first-charge second precision', () => {
    it.each([
        'default schedule',
        'credit schedule'
    ] as const)('stores and authorizes a whole-second first charge with the %s', async (scheduleKind) => {
        const choice = await seedSuccessionChoice();
        const seeded = await seedPredecessor({
            userId: choice.user.id,
            planVersionId: choice.planVersionId,
            billingOptionId: choice.predecessorBillingOptionId,
            status: 'ACTIVE',
            providerState: 'active',
            honestAboutM1: true
        });
        vi.spyOn(successionClock, 'now').mockReturnValue(new Date('2026-10-11T13:00:00.318Z'));
        const authorize = vi.spyOn(seeded.fake, 'authorize');
        const ports = successionPorts(seeded.provider);
        const result = await startSuccession(
            {
                userId: choice.user.id,
                predecessorSubscriptionId: seeded.predecessor.id,
                billingOptionId: choice.targetBillingOptionId,
                returnUrl: successionReturnUrl
            },
            scheduleKind === 'default schedule'
                ? ports
                : {
                      ...ports,
                      firstChargeSchedule: async (input) =>
                          scheduleSuccessorFirstChargeWithCredit({
                              authorizationWindowEndsAt: input.authorizationWindowEndsAt,
                              bornAt: seeded.predecessor.createdAt,
                              creditDays: 3
                          })
                  }
        );

        expect(result.checkoutUrl).toBeDefined();
        expect(authorize.mock.calls.at(-1)?.[0].firstChargeAt).toMatch(/\.000Z$/);
        const [successor] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, result.subscriptionId));
        expect(successor?.firstChargeAt?.getUTCMilliseconds()).toBe(0);
        const [key] = await getServiceTestDb()
            .select()
            .from(idempotencyKeys)
            .where(eq(idempotencyKeys.subjectId, result.subscriptionId));
        expect(key?.result).toMatchObject({ applied: true });
    });
});
