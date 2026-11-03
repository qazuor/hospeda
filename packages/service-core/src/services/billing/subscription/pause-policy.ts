import type { Clock, VerticalsForBilling } from '@repo/billing-verticals-contract';
import {
    and,
    billingOptions,
    courtesyGrants,
    type DrizzleClient,
    eq,
    getDb,
    gt,
    subscriptions
} from '@repo/db';
import { z } from 'zod';
import { readPauseQuota } from './pause-quota.js';

/** DEC-SUB-010 expresses the pause limits in whole months. */
export const PAUSE_LIMITS = {
    maxPausesPerWindow: 3,
    windowMonths: 12,
    maxMonthsPerPause: 4,
    maxAccumulatedMonths: 8
} as const;

/** A typed reason why a customer-request pause cannot begin. */
export type PauseRefusalReason =
    | 'NOT_PRINCIPAL'
    | 'NOT_ACTIVE'
    | 'MANUAL_PAYER'
    | 'NOT_MONTHLY'
    | 'PLAN_DISALLOWS_PAUSE'
    | 'COURTESY_IN_FORCE'
    | 'MONTHS_OUT_OF_RANGE'
    | 'PAUSE_COUNT_EXHAUSTED'
    | 'MONTHS_EXHAUSTED';

/** The sole eligibility decision for customer-request pauses (INV:23). */
export async function canPause(
    input: {
        readonly subscriptionId: string;
        readonly requestedMonths: number;
        readonly tx?: DrizzleClient;
    },
    ports: { readonly clock: Clock; readonly planPolicy: VerticalsForBilling['planPolicy'] }
): Promise<
    | { readonly allowed: true; readonly quota: Awaited<ReturnType<typeof readPauseQuota>> }
    | {
          readonly allowed: false;
          readonly reason: PauseRefusalReason;
          readonly quota?: Awaited<ReturnType<typeof readPauseQuota>>;
      }
> {
    const value = z
        .strictObject({
            subscriptionId: z.uuid(),
            requestedMonths: z.number(),
            tx: z.custom<DrizzleClient>((candidate) => candidate != null).optional()
        })
        .parse(input);
    const db = value.tx ?? getDb();
    const [row] = await db
        .select({
            class: subscriptions.class,
            status: subscriptions.status,
            paymentMethod: subscriptions.paymentMethod,
            billingOptionId: subscriptions.billingOptionId,
            planVersionId: subscriptions.planVersionId,
            userId: subscriptions.userId,
            vertical: subscriptions.vertical
        })
        .from(subscriptions)
        .where(eq(subscriptions.id, value.subscriptionId))
        .limit(1);
    if (row?.class !== 'PRINCIPAL') return { allowed: false, reason: 'NOT_PRINCIPAL' };
    if (row.status !== 'ACTIVE') return { allowed: false, reason: 'NOT_ACTIVE' };
    if (row.paymentMethod === 'MANUAL') return { allowed: false, reason: 'MANUAL_PAYER' };
    const [option] = row.billingOptionId
        ? await db
              .select({ cycle: billingOptions.cycle })
              .from(billingOptions)
              .where(eq(billingOptions.id, row.billingOptionId))
              .limit(1)
        : [];
    if (option?.cycle !== 'monthly') return { allowed: false, reason: 'NOT_MONTHLY' };
    if (
        !row.planVersionId ||
        !(await ports.planPolicy({ planVersionId: row.planVersionId })).allowsPause
    )
        return { allowed: false, reason: 'PLAN_DISALLOWS_PAUSE' };
    const now = ports.clock.now();
    const [courtesy] = await db
        .select({ id: courtesyGrants.id })
        .from(courtesyGrants)
        .where(
            and(
                eq(courtesyGrants.subscriptionId, value.subscriptionId),
                gt(courtesyGrants.endsAt, now)
            )
        )
        .limit(1);
    if (courtesy) return { allowed: false, reason: 'COURTESY_IN_FORCE' };
    if (
        !Number.isInteger(value.requestedMonths) ||
        value.requestedMonths < 1 ||
        value.requestedMonths > PAUSE_LIMITS.maxMonthsPerPause
    )
        return { allowed: false, reason: 'MONTHS_OUT_OF_RANGE' };
    if (!row.userId || !row.vertical)
        throw new Error('Principal subscription lacks owner or vertical');
    const quota = await readPauseQuota({ tx: db, userId: row.userId, vertical: row.vertical, now });
    if (quota.pausesInWindow >= PAUSE_LIMITS.maxPausesPerWindow)
        return { allowed: false, reason: 'PAUSE_COUNT_EXHAUSTED', quota };
    if (quota.monthsInWindow + value.requestedMonths > PAUSE_LIMITS.maxAccumulatedMonths)
        return { allowed: false, reason: 'MONTHS_EXHAUSTED', quota };
    return { allowed: true, quota };
}
