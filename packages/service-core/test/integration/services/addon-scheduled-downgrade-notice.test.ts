import {
    addonInstances,
    eq,
    planVersionLimits,
    subscriptionScheduledChanges,
    subscriptions
} from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { PUBLICATION_LIMIT_KEYS } from '@repo/verticals';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { previewAddonPurchaseUnderScheduledDowngrade } from '../../../src/services/billing/addon/scheduled-downgrade-addon-notice.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    retireAddonNoticeVersions,
    seedAddonNoticeVersion
} from './support/addon-notice-fixtures.js';
import {
    retirePlanChanges,
    seedPlanChange,
    seedPlanChangeTargetWithLimit
} from './support/plan-change-fixtures.js';
import { seedScheduledChange } from './support/scheduled-change-fixtures.js';

const effectiveAt = new Date('2026-11-11T13:00:00.000Z');
afterEach(async () => {
    await retireAddonNoticeVersions();
    await retirePlanChanges();
});
afterAll(closeServiceTestPool);

async function caseWithBases(
    currentBase: number | null,
    scheduledBase?: number,
    addonValue?: number
) {
    const seed = await seedPlanChange({});
    if (currentBase !== null) {
        const current = await seedPlanChangeTargetWithLimit({
            sourcePlanVersionId: seed.planVersionId,
            targetLimit: currentBase
        });
        await getServiceTestDb()
            .update(subscriptions)
            .set({
                planVersionId: current.planVersionId,
                billingOptionId: current.billingOptionId
            })
            .where(eq(subscriptions.id, seed.predecessor.id));
    }
    const target =
        scheduledBase === undefined
            ? null
            : await seedPlanChangeTargetWithLimit({
                  sourcePlanVersionId: seed.planVersionId,
                  targetLimit: scheduledBase
              });
    const queued = target
        ? await seedScheduledChange({
              subscriptionId: seed.predecessor.id,
              effectiveAt,
              targetPlanVersionId: target.planVersionId,
              targetBillingOptionId: target.billingOptionId
          })
        : null;
    const addon = await seedAddonNoticeVersion(addonValue);
    return { seed, target, queued, addon };
}

async function preview(ids: Awaited<ReturnType<typeof caseWithBases>>) {
    return previewAddonPurchaseUnderScheduledDowngrade({
        subscriptionId: ids.seed.predecessor.id,
        addonVersionId: ids.addon.versionId
    });
}

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B8b:19 AC:B8b:19 addon purchase under scheduled downgrade',
    () => {
        it('(a) reports the queued date, limit after purchase and all three purchased units outside', async () => {
            const ids = await caseWithBases(10, 2, 3);
            expect(await preview(ids)).toEqual({
                notice: 'SCHEDULED_DOWNGRADE',
                effectiveAt: ids.queued!.effectiveAt,
                targetPlanVersionId: ids.target!.planVersionId,
                limits: [
                    {
                        key: PUBLICATION_LIMIT_KEYS.accommodation,
                        addonValue: 3,
                        currentBase: 10,
                        scheduledBase: 2,
                        limitAfter: 5,
                        purchasedOutsideAfter: 3
                    }
                ]
            });
        });
        it('(b) caps the displaced portion at the base reduction', async () => {
            const ids = await caseWithBases(10, 9, 3);
            expect(await preview(ids)).toMatchObject({
                notice: 'SCHEDULED_DOWNGRADE',
                limits: [{ purchasedOutsideAfter: 1, limitAfter: 12 }]
            });
        });
        it('(c) returns NONE when the queued base does not fall', async () => {
            const ids = await caseWithBases(10, 10, 3);
            expect(await preview(ids)).toEqual({ notice: 'NONE' });
        });
        it('(d) returns NONE without a queue', async () => {
            const ids = await caseWithBases(10, undefined, 3);
            expect(await preview(ids)).toEqual({ notice: 'NONE' });
        });
        it('(e) returns NONE for an addon without limits', async () => {
            const ids = await caseWithBases(10, 2);
            expect(await preview(ids)).toEqual({ notice: 'NONE' });
        });
        it('(f) treats an unbounded current base as an entire purchased addon outside', async () => {
            const ids = await caseWithBases(null, 4, 2);
            const [current] = await getServiceTestDb()
                .select({ value: planVersionLimits.value })
                .from(planVersionLimits)
                .where(eq(planVersionLimits.planVersionId, ids.seed.planVersionId));
            expect(current).toBeUndefined();
            expect(await preview(ids)).toMatchObject({
                notice: 'SCHEDULED_DOWNGRADE',
                limits: [
                    {
                        currentBase: null,
                        scheduledBase: 4,
                        addonValue: 2,
                        limitAfter: 6,
                        purchasedOutsideAfter: 2
                    }
                ]
            });
        });
        it('(g) rejects missing and non-principal subscriptions and missing addon versions', async () => {
            const ids = await caseWithBases(10, 2, 3);
            const missing = crypto.randomUUID();
            for (const subscriptionId of [missing]) {
                await expect(
                    previewAddonPurchaseUnderScheduledDowngrade({
                        subscriptionId,
                        addonVersionId: ids.addon.versionId
                    })
                ).rejects.toMatchObject({ code: ServiceErrorCode.NOT_FOUND });
            }
            await expect(
                previewAddonPurchaseUnderScheduledDowngrade({
                    subscriptionId: ids.seed.predecessor.id,
                    addonVersionId: missing
                })
            ).rejects.toMatchObject({ code: ServiceErrorCode.NOT_FOUND });
            await getServiceTestDb()
                .update(subscriptions)
                .set({ class: 'COMPLEMENTO' })
                .where(eq(subscriptions.id, ids.seed.predecessor.id));
            await expect(preview(ids)).rejects.toMatchObject({ code: ServiceErrorCode.NOT_FOUND });
            await getServiceTestDb()
                .update(subscriptions)
                .set({ class: 'PRINCIPAL' })
                .where(eq(subscriptions.id, ids.seed.predecessor.id));
        });
        it('(h) reads without changing the subscription, queue or addon instance population', async () => {
            const ids = await caseWithBases(10, 2, 3);
            const db = getServiceTestDb();
            const subscriptionBefore = await db
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, ids.seed.predecessor.id));
            const instanceBefore = await db
                .select({ id: addonInstances.id })
                .from(addonInstances)
                .where(eq(addonInstances.ownerId, ids.seed.user.id));
            const notice = await preview(ids);
            expect(notice.notice).toBe('SCHEDULED_DOWNGRADE');
            expect(
                await db
                    .select()
                    .from(subscriptions)
                    .where(eq(subscriptions.id, ids.seed.predecessor.id))
            ).toEqual(subscriptionBefore);
            expect(
                await db
                    .select()
                    .from(subscriptionScheduledChanges)
                    .where(eq(subscriptionScheduledChanges.subscriptionId, ids.seed.predecessor.id))
            ).toEqual([ids.queued]);
            expect(
                await db
                    .select({ id: addonInstances.id })
                    .from(addonInstances)
                    .where(eq(addonInstances.ownerId, ids.seed.user.id))
            ).toEqual(instanceBefore);
        });
    }
);
