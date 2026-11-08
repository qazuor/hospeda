import type { Clock } from '@repo/billing-verticals-contract';
import {
    and,
    billingOptions,
    courtesyGrants,
    eq,
    getDb,
    gt,
    isNull,
    providerLinks,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import { BILLING_CYCLE_MONTHS } from '@repo/schemas';
import { addCalendarMonths } from '@repo/utils';
import { z } from 'zod';
import { hasLivePermanentGrantAnchor } from '../grant/permanent-grant-live-anchors.js';
import { computeCourtesyBalanceMonths } from './courtesy-balance.js';
import type { TemporaryCourtesyRefusalReason } from './grant-temporary-courtesy.service.js';

const grantInputSchema = z.strictObject({ subscriptionId: z.uuid(), months: z.number() });
const revokeInputSchema = z.strictObject({ subscriptionId: z.uuid() });
const cycleSchema = z.enum(['monthly', 'quarterly', 'semiannual', 'annual']);

type LiveCourtesy = {
    readonly courtesyGrantId: string;
    readonly endsAt: Date;
    readonly remainingMonths: number;
};

type Base = {
    readonly subscriptionId: string;
    readonly status: string | null;
    readonly cycle: z.infer<typeof cycleSchema> | null;
    readonly liveCourtesy: LiveCourtesy | null;
};

async function readBase(subscriptionId: string, now: Date) {
    const db = getDb();
    const [subscription] = await db
        .select({
            class: subscriptions.class,
            status: subscriptions.status,
            userId: subscriptions.userId,
            vertical: subscriptions.vertical,
            paymentMethod: subscriptions.paymentMethod,
            billingOptionId: subscriptions.billingOptionId,
            nextChargeAt: subscriptions.nextChargeAt
        })
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId))
        .limit(1);
    const [option] = subscription?.billingOptionId
        ? await db
              .select({ cycle: billingOptions.cycle })
              .from(billingOptions)
              .where(eq(billingOptions.id, subscription.billingOptionId))
              .limit(1)
        : [];
    const [pause] = await db
        .select({ reason: subscriptionPauses.reason })
        .from(subscriptionPauses)
        .where(
            and(
                eq(subscriptionPauses.subscriptionId, subscriptionId),
                isNull(subscriptionPauses.actualEndAt)
            )
        )
        .limit(1);
    const [grant] = await db
        .select({
            id: courtesyGrants.id,
            startsAt: courtesyGrants.startsAt,
            endsAt: courtesyGrants.endsAt
        })
        .from(courtesyGrants)
        .where(
            and(
                eq(courtesyGrants.subscriptionId, subscriptionId),
                isNull(courtesyGrants.balanceMonths),
                gt(courtesyGrants.endsAt, now)
            )
        )
        .limit(1);
    const liveCourtesy: LiveCourtesy | null = grant
        ? {
              courtesyGrantId: grant.id,
              endsAt: grant.endsAt,
              remainingMonths: computeCourtesyBalanceMonths({
                  startsAt: grant.startsAt,
                  endsAt: grant.endsAt,
                  now
              }).months
          }
        : null;
    const cycle = cycleSchema.safeParse(option?.cycle);
    const base: Base = {
        subscriptionId,
        status: subscription?.status ?? null,
        cycle: cycle.success ? cycle.data : null,
        liveCourtesy
    };
    return { db, subscription, pause, base };
}

/** Read the result that S9 or S34 would offer without changing billing state. */
export async function previewTemporaryCourtesyGrant(
    input: { readonly subscriptionId: string; readonly months: number },
    ports: { readonly clock: Clock }
) {
    const { subscriptionId, months } = grantInputSchema.parse(input);
    const now = ports.clock.now();
    const { db, subscription, pause, base } = await readBase(subscriptionId, now);
    const endsAt = addCalendarMonths({
        from: base.liveCourtesy?.endsAt ?? now,
        months: Math.max(1, Number.isInteger(months) ? months : 1),
        dayOverflow: 'clamp'
    });
    let reason: TemporaryCourtesyRefusalReason | undefined;
    if (!Number.isInteger(months) || months < 1) reason = 'MONTHS_INVALID';
    else if (subscription?.class !== 'PRINCIPAL') reason = 'NOT_PRINCIPAL';
    else if (base.cycle !== 'monthly') reason = 'NOT_MONTHLY';
    else if (!subscription.userId || !subscription.vertical) reason = 'NOT_ELIGIBLE';
    else if (pause?.reason === 'CUSTOMER_REQUEST') reason = 'SUBSCRIPTION_PAUSED';
    else if (
        !(subscription.status === 'ACTIVE' && !pause) &&
        !(subscription.status === 'PAUSED' && pause?.reason === 'COURTESY' && base.liveCourtesy)
    )
        reason = 'NOT_ELIGIBLE';
    else if (
        await hasLivePermanentGrantAnchor({
            userId: subscription.userId,
            vertical: subscription.vertical,
            tx: db
        })
    )
        reason = 'LIVE_GRANT_ANCHOR';
    else if (subscription.status === 'ACTIVE' && subscription.paymentMethod === 'CARD') {
        const [link] = await db
            .select({ id: providerLinks.id })
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, subscriptionId))
            .limit(1);
        if (!link) reason = 'NO_PROVIDER_LINK';
    }
    return {
        ...base,
        months,
        endsAt,
        offered: reason === undefined,
        ...(reason ? { reason } : {}),
        ...(reason === 'NOT_MONTHLY'
            ? { alternatives: ['PERMANENT_GRANT', 'RENEWAL_PROMO'] as const }
            : {})
    };
}

/** Read the live S10 courtesy and predicted next charge date for confirmation. */
export async function previewTemporaryCourtesyRevoke(
    input: { readonly subscriptionId: string },
    ports: { readonly clock: Clock }
) {
    const { subscriptionId } = revokeInputSchema.parse(input);
    const now = ports.clock.now();
    const { subscription, pause, base } = await readBase(subscriptionId, now);
    const inForce =
        base.status === 'PAUSED' && pause?.reason === 'COURTESY' && base.liveCourtesy !== null;
    let predictedNextChargeAt = subscription?.nextChargeAt ?? base.liveCourtesy?.endsAt ?? null;
    if (base.cycle) {
        while (predictedNextChargeAt && predictedNextChargeAt <= now) {
            const advanced = new Date(predictedNextChargeAt);
            advanced.setUTCMonth(advanced.getUTCMonth() + BILLING_CYCLE_MONTHS[base.cycle]);
            predictedNextChargeAt = advanced;
        }
    }
    return {
        subscriptionId,
        status: base.status,
        cycle: base.cycle,
        inForce,
        courtesy: inForce ? base.liveCourtesy : null,
        predictedNextChargeAt: inForce ? predictedNextChargeAt : null,
        ...(inForce ? {} : { reason: 'COURTESY_NOT_IN_FORCE' as const })
    };
}
