import { type Clock, VerticalSchema } from '@repo/billing-verticals-contract';
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
import { createLogger } from '@repo/logger';
import type { PaymentProvider } from '@repo/payments';
import { addCalendarMonths } from '@repo/utils';
import { z } from 'zod';
import { hasLivePermanentGrantAnchor } from '../grant/permanent-grant-live-anchors.js';
import { type CoverageNotices, unwiredCoverageNotices } from '../payment/payment-ports.js';
import { openReconciliationMark } from '../reconciliation/open-reconciliation-mark.service.js';
import { confirmPrincipalPause } from './pause-subscription-provider.js';

const logger = createLogger('grant-temporary-courtesy');
const monthsSchema = z.number().int().min(1);
const inputSchema = z.strictObject({
    subscriptionId: z.uuid(),
    months: z.number(),
    grantedBy: z.uuid(),
    reason: z.string().min(1)
});

/** Reasons for refusing a temporary courtesy. */
export type TemporaryCourtesyRefusalReason =
    | 'NOT_PRINCIPAL'
    | 'NOT_MONTHLY'
    | 'MONTHS_INVALID'
    | 'SUBSCRIPTION_PAUSED'
    | 'NOT_ELIGIBLE'
    | 'LIVE_GRANT_ANCHOR'
    | 'NO_PROVIDER_LINK';

/** Result of granting or extending a temporary courtesy. */
export type GrantTemporaryCourtesyResult =
    | {
          readonly outcome: 'GRANTED' | 'EXTENDED';
          readonly courtesyGrantId: string;
          readonly pauseId: string;
          readonly endsAt: Date;
      }
    | { readonly outcome: 'NOT_APPLIED' | 'LOST_RACE' }
    | { readonly outcome: 'REFUSED'; readonly reason: TemporaryCourtesyRefusalReason };

type CourtesyPorts = {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly coverageNotices?: CoverageNotices;
};

async function notifyCoverage(input: {
    readonly userId: string;
    readonly vertical: string;
    readonly subscriptionId: string;
    readonly ports: CourtesyPorts;
}): Promise<void> {
    try {
        await (input.ports.coverageNotices ?? unwiredCoverageNotices).emitCoverageChanged({
            userId: input.userId,
            vertical: VerticalSchema.parse(input.vertical),
            sourceType: 'SUBSCRIPTION',
            change: 'CHANGED'
        });
    } catch (error) {
        logger.error(
            { subscriptionId: input.subscriptionId, error },
            'Courtesy coverage notice failed after commit'
        );
    }
}

async function markLostRace(input: {
    readonly subscriptionId: string;
}): Promise<GrantTemporaryCourtesyResult> {
    await openReconciliationMark({
        subject: { kind: 'SUBSCRIPTION', subscriptionId: input.subscriptionId },
        reason: 'TRANSICION_NO_DECLARADA',
        actor: { type: 'job' },
        correlationId: crypto.randomUUID()
    });
    return { outcome: 'LOST_RACE' };
}

/** Grants S9 on an active monthly principal or extends its live S34 courtesy. */
export async function grantTemporaryCourtesy(
    input: {
        readonly subscriptionId: string;
        readonly months: number;
        readonly grantedBy: string;
        readonly reason: string;
    },
    ports: CourtesyPorts
): Promise<GrantTemporaryCourtesyResult> {
    const value = inputSchema.parse(input);
    if (!monthsSchema.safeParse(value.months).success)
        return { outcome: 'REFUSED', reason: 'MONTHS_INVALID' };
    const db = getDb();
    const now = ports.clock.now();
    const [initial] = await db
        .select({
            id: subscriptions.id,
            class: subscriptions.class,
            status: subscriptions.status,
            paymentMethod: subscriptions.paymentMethod,
            billingOptionId: subscriptions.billingOptionId,
            userId: subscriptions.userId,
            vertical: subscriptions.vertical
        })
        .from(subscriptions)
        .where(eq(subscriptions.id, value.subscriptionId))
        .limit(1);
    if (initial?.class !== 'PRINCIPAL') return { outcome: 'REFUSED', reason: 'NOT_PRINCIPAL' };
    const [option] = initial.billingOptionId
        ? await db
              .select({ cycle: billingOptions.cycle })
              .from(billingOptions)
              .where(eq(billingOptions.id, initial.billingOptionId))
              .limit(1)
        : [];
    if (option?.cycle !== 'monthly') return { outcome: 'REFUSED', reason: 'NOT_MONTHLY' };
    if (!initial.userId || !initial.vertical) return { outcome: 'REFUSED', reason: 'NOT_ELIGIBLE' };
    const [openPause] = await db
        .select({ reason: subscriptionPauses.reason })
        .from(subscriptionPauses)
        .where(
            and(
                eq(subscriptionPauses.subscriptionId, value.subscriptionId),
                isNull(subscriptionPauses.actualEndAt)
            )
        )
        .limit(1);
    if (openPause?.reason === 'CUSTOMER_REQUEST')
        return { outcome: 'REFUSED', reason: 'SUBSCRIPTION_PAUSED' };
    const isS9 = initial.status === 'ACTIVE' && !openPause;
    const isS34 = initial.status === 'PAUSED' && openPause?.reason === 'COURTESY';
    if (!isS9 && !isS34) return { outcome: 'REFUSED', reason: 'NOT_ELIGIBLE' };
    if (isS34) {
        const [live] = await db
            .select({ id: courtesyGrants.id })
            .from(courtesyGrants)
            .where(
                and(
                    eq(courtesyGrants.subscriptionId, value.subscriptionId),
                    isNull(courtesyGrants.balanceMonths),
                    gt(courtesyGrants.endsAt, now)
                )
            )
            .limit(1);
        if (!live) return { outcome: 'REFUSED', reason: 'NOT_ELIGIBLE' };
    }
    if (
        await hasLivePermanentGrantAnchor({
            userId: initial.userId,
            vertical: initial.vertical,
            tx: db
        })
    )
        return { outcome: 'REFUSED', reason: 'LIVE_GRANT_ANCHOR' };

    if (isS34) {
        const written = await db.transaction(async (tx) => {
            const [locked] = await tx
                .select({
                    status: subscriptions.status,
                    userId: subscriptions.userId,
                    vertical: subscriptions.vertical
                })
                .from(subscriptions)
                .where(eq(subscriptions.id, value.subscriptionId))
                .for('update')
                .limit(1);
            if (
                locked?.status !== 'PAUSED' ||
                locked.userId !== initial.userId ||
                locked.vertical !== initial.vertical ||
                !locked.userId ||
                !locked.vertical
            )
                return null;
            if (
                await hasLivePermanentGrantAnchor({
                    userId: locked.userId,
                    vertical: locked.vertical,
                    tx
                })
            )
                return null;
            const [pause] = await tx
                .select({
                    id: subscriptionPauses.id,
                    reason: subscriptionPauses.reason,
                    expectedEndAt: subscriptionPauses.expectedEndAt
                })
                .from(subscriptionPauses)
                .where(
                    and(
                        eq(subscriptionPauses.subscriptionId, value.subscriptionId),
                        isNull(subscriptionPauses.actualEndAt)
                    )
                )
                .limit(1);
            const [grant] = await tx
                .select({
                    id: courtesyGrants.id,
                    endsAt: courtesyGrants.endsAt,
                    months: courtesyGrants.months
                })
                .from(courtesyGrants)
                .where(
                    and(
                        eq(courtesyGrants.subscriptionId, value.subscriptionId),
                        isNull(courtesyGrants.balanceMonths),
                        gt(courtesyGrants.endsAt, now)
                    )
                )
                .limit(1);
            if (pause?.reason !== 'COURTESY' || !pause.expectedEndAt || !grant) return null;
            const endsAt = addCalendarMonths({
                from: grant.endsAt,
                months: value.months,
                dayOverflow: 'clamp'
            });
            const pauseEndsAt = addCalendarMonths({
                from: pause.expectedEndAt,
                months: value.months,
                dayOverflow: 'clamp'
            });
            await tx
                .update(courtesyGrants)
                .set({ endsAt, months: grant.months + value.months })
                .where(eq(courtesyGrants.id, grant.id));
            await tx
                .update(subscriptionPauses)
                .set({ expectedEndAt: pauseEndsAt })
                .where(eq(subscriptionPauses.id, pause.id));
            return { courtesyGrantId: grant.id, pauseId: pause.id, endsAt };
        });
        if (!written) return markLostRace({ subscriptionId: value.subscriptionId });
        await notifyCoverage({
            userId: initial.userId,
            vertical: initial.vertical,
            subscriptionId: value.subscriptionId,
            ports
        });
        return { outcome: 'EXTENDED', ...written };
    }

    if (initial.paymentMethod === 'CARD') {
        const [link] = await db
            .select({ authorizationId: providerLinks.providerId })
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, value.subscriptionId))
            .limit(1);
        if (!link) return { outcome: 'REFUSED', reason: 'NO_PROVIDER_LINK' };
        const confirmed = await confirmPrincipalPause({
            subscriptionId: value.subscriptionId,
            authorizationId: link.authorizationId,
            provider: ports.provider,
            clock: ports.clock
        });
        if (confirmed === 'NOT_APPLIED') return { outcome: 'NOT_APPLIED' };
    }
    const endsAt = addCalendarMonths({ from: now, months: value.months, dayOverflow: 'clamp' });
    const written = await db.transaction(async (tx) => {
        const [locked] = await tx
            .select({
                status: subscriptions.status,
                class: subscriptions.class,
                userId: subscriptions.userId,
                vertical: subscriptions.vertical
            })
            .from(subscriptions)
            .where(eq(subscriptions.id, value.subscriptionId))
            .for('update')
            .limit(1);
        if (
            locked?.status !== 'ACTIVE' ||
            locked.class !== 'PRINCIPAL' ||
            locked.userId !== initial.userId ||
            locked.vertical !== initial.vertical ||
            !locked.userId ||
            !locked.vertical
        )
            return null;
        const [existingPause] = await tx
            .select({ id: subscriptionPauses.id })
            .from(subscriptionPauses)
            .where(
                and(
                    eq(subscriptionPauses.subscriptionId, value.subscriptionId),
                    isNull(subscriptionPauses.actualEndAt)
                )
            )
            .limit(1);
        if (existingPause) return null;
        if (
            await hasLivePermanentGrantAnchor({
                userId: locked.userId,
                vertical: locked.vertical,
                tx
            })
        )
            return null;
        const [paused] = await tx
            .update(subscriptions)
            .set({ status: 'PAUSED' })
            .where(
                and(eq(subscriptions.id, value.subscriptionId), eq(subscriptions.status, 'ACTIVE'))
            )
            .returning({ id: subscriptions.id });
        if (!paused) return null;
        const [grant] = await tx
            .insert(courtesyGrants)
            .values({
                beneficiaryUserId: locked.userId,
                months: value.months,
                startsAt: now,
                endsAt,
                grantedBy: value.grantedBy,
                reason: value.reason,
                subscriptionId: value.subscriptionId,
                balanceMonths: null
            })
            .returning({ id: courtesyGrants.id });
        if (!grant) throw new Error('Temporary courtesy grant insert returned no row');
        const [pause] = await tx
            .insert(subscriptionPauses)
            .values({
                subscriptionId: value.subscriptionId,
                reason: 'COURTESY',
                requestedMonths: value.months,
                startsAt: now,
                expectedEndAt: endsAt
            })
            .returning({ id: subscriptionPauses.id });
        if (!pause) throw new Error('Temporary courtesy pause insert returned no row');
        return { courtesyGrantId: grant.id, pauseId: pause.id, endsAt };
    });
    if (!written) return markLostRace({ subscriptionId: value.subscriptionId });
    await notifyCoverage({
        userId: initial.userId,
        vertical: initial.vertical,
        subscriptionId: value.subscriptionId,
        ports
    });
    return { outcome: 'GRANTED', ...written };
}
