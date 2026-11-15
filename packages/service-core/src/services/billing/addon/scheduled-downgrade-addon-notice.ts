import {
    addonVersionLimits,
    addonVersions,
    eq,
    getDb,
    planVersionLimits,
    subscriptionScheduledChanges,
    subscriptions
} from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types';

const inputSchema = z.strictObject({ subscriptionId: z.uuid(), addonVersionId: z.uuid() });

/** The limit changes to disclose before an addon purchase under AC:B8b:19 and LOCK:C4. */
export type ScheduledDowngradeAddonNotice =
    | { readonly notice: 'NONE' }
    | {
          readonly notice: 'SCHEDULED_DOWNGRADE';
          readonly effectiveAt: Date;
          readonly targetPlanVersionId: string;
          readonly limits: readonly {
              readonly key: string;
              readonly addonValue: number;
              readonly currentBase: number | null;
              readonly scheduledBase: number;
              readonly limitAfter: number;
              readonly purchasedOutsideAfter: number;
          }[];
      };

/**
 * AC:B8b:19 and LOCK:C4: read the scheduled downgrade and preview purchased addon limits.
 * This read-only notice never rejects an otherwise valid purchase.
 */
export async function previewAddonPurchaseUnderScheduledDowngrade(input: {
    readonly subscriptionId: string;
    readonly addonVersionId: string;
}): Promise<ScheduledDowngradeAddonNotice> {
    const ids = inputSchema.parse(input);
    const db = getDb();
    const [subscription] = await db
        .select({ planVersionId: subscriptions.planVersionId, class: subscriptions.class })
        .from(subscriptions)
        .where(eq(subscriptions.id, ids.subscriptionId))
        .limit(1);
    if (!subscription || subscription.class !== 'PRINCIPAL' || !subscription.planVersionId)
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Subscription not found');
    const [addonVersion] = await db
        .select({ id: addonVersions.id })
        .from(addonVersions)
        .where(eq(addonVersions.id, ids.addonVersionId))
        .limit(1);
    if (!addonVersion)
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Addon version not found');
    const [scheduled] = await db
        .select({
            targetPlanVersionId: subscriptionScheduledChanges.targetPlanVersionId,
            effectiveAt: subscriptionScheduledChanges.effectiveAt
        })
        .from(subscriptionScheduledChanges)
        .where(eq(subscriptionScheduledChanges.subscriptionId, ids.subscriptionId))
        .limit(1);
    if (!scheduled) return { notice: 'NONE' };
    const addonLimits = await db
        .select({ key: addonVersionLimits.key, value: addonVersionLimits.value })
        .from(addonVersionLimits)
        .where(eq(addonVersionLimits.addonVersionId, ids.addonVersionId));
    if (addonLimits.length === 0) return { notice: 'NONE' };
    const [currentLimits, scheduledLimits] = await Promise.all([
        db
            .select({ key: planVersionLimits.key, value: planVersionLimits.value })
            .from(planVersionLimits)
            .where(eq(planVersionLimits.planVersionId, subscription.planVersionId)),
        db
            .select({ key: planVersionLimits.key, value: planVersionLimits.value })
            .from(planVersionLimits)
            .where(eq(planVersionLimits.planVersionId, scheduled.targetPlanVersionId))
    ]);
    const currentByKey = new Map(currentLimits.map((limit) => [limit.key, limit.value]));
    const scheduledByKey = new Map(scheduledLimits.map((limit) => [limit.key, limit.value]));
    const limits = addonLimits.flatMap(({ key, value: addonValue }) => {
        const currentBase = currentByKey.get(key) ?? null;
        const scheduledBase = scheduledByKey.get(key) ?? null;
        if (scheduledBase === null || (currentBase !== null && currentBase <= scheduledBase))
            return [];
        return [
            {
                key,
                addonValue,
                currentBase,
                scheduledBase,
                limitAfter: scheduledBase + addonValue,
                purchasedOutsideAfter:
                    currentBase === null
                        ? addonValue
                        : Math.min(addonValue, Math.max(0, currentBase - scheduledBase))
            }
        ];
    });
    if (limits.length === 0) return { notice: 'NONE' };
    return {
        notice: 'SCHEDULED_DOWNGRADE',
        effectiveAt: scheduled.effectiveAt,
        targetPlanVersionId: scheduled.targetPlanVersionId,
        limits
    };
}
