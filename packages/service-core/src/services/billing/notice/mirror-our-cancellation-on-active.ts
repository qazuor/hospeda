import type { Clock } from '@repo/billing-verticals-contract';
import {
    and,
    coveredPeriods,
    emailOutbox,
    eq,
    getDb,
    inArray,
    isNull,
    sql,
    subscriptions
} from '@repo/db';
import { createLogger } from '@repo/logger';
import type { PaymentProvider } from '@repo/payments';
import { VerticalEnumSchema } from '@repo/schemas';
import { z } from 'zod';
import { type CoverageNotices, unwiredCoverageNotices } from '../payment/payment-ports.js';
import {
    BEFORE_CANCEL_TEMPLATE_BY_KIND,
    type BeforeCancelNoticeKind
} from '../subscription/before-cancel-notice-kinds.js';
import { billingPeriodEnd } from '../subscription/billing-period-end.js';
import type { ComplementPolicyPorts } from '../subscription/complement-ports.js';
import {
    cancelComplementsByS11Rule,
    cancelDecidedComplementsAtProvider,
    type DecidedComplementCancellation
} from '../subscription/complement-s11-rule.js';
import { enqueuePaidAfterCancellationNotice } from '../subscription/paid-after-cancellation-notice.js';
import type { BeforeCancelNotice } from '../subscription/start-subscription.service.js';

const logger = createLogger('mirror-our-cancellation-on-active');
export const OUR_CANCELLATION_NOTICE_KINDS = [
    'ARREARS_SUSPENSION',
    'AUTHORIZATION_EXPIRED'
] as const satisfies readonly BeforeCancelNoticeKind[];
const inputSchema = z.strictObject({
    lastPaidPeriodStart: z.date().nullable(),
    everyMonths: z.number().int().min(1).max(12),
    firstChargeAt: z.date().nullable(),
    readAt: z.date()
});
const serviceInputSchema = z.strictObject({
    subscriptionId: z.string().uuid(),
    readAt: z.date(),
    everyMonths: z.number().int().min(1).max(12)
});

/**
 * Computes the service end date for the R18 mirror using the newest open paid
 * period (via `billingPeriodEnd`) or the remaining first-charge credit
 * (`DEC-SUB-006`). Pure function — no database access, no side effects.
 * @param input - Payment period, cadence, optional first-charge credit and fresh read instant
 * @returns The scheduled service end date
 */
export function ourCancellationServiceEnd(input: {
    readonly lastPaidPeriodStart: Date | null;
    readonly everyMonths: number;
    readonly firstChargeAt: Date | null;
    readonly readAt: Date;
}): Date {
    const value = inputSchema.parse(input);
    if (value.lastPaidPeriodStart)
        return billingPeriodEnd({
            periodStart: value.lastPaidPeriodStart,
            everyMonths: value.everyMonths
        }).periodEnd;
    if (value.firstChargeAt && value.firstChargeAt > value.readAt) return value.firstChargeAt;
    return value.readAt;
}

export type MirrorOurCancellationResult =
    | {
          readonly outcome: 'SCHEDULED';
          readonly serviceEndsAt: Date;
          readonly complements?: readonly DecidedComplementCancellation[];
      }
    | { readonly outcome: 'NOT_OURS' }
    | { readonly outcome: 'LOST_RACE' };

/**
 * R18 mirror (AC:B7:15; B/03 §10.1, `04-catalogos.md:2106`; DEC-SUB-019📌2).
 * When `S6` or `S3` cancels our preapproval but a payment (`S5`) or
 * authorization (`S2`) rewrites the row back to ACTIVE, this function locks
 * the row, verifies we enqueued a «before-cancel» notice by `kind` (template)
 * + `payload.subscriptionId` (Coord-522: never the occurrence or dedup_key),
 * computes the service end from the newest open paid period, writes
 * `CANCEL_SCHEDULED` with the computed end, and emits a post-commit `CHANGED`
 * coverage notice. It never opens a `coverage_loss` record, calls the
 * payment provider, enqueues only the paid-after-cancellation notice required by
 * AC:B13a:17 in the same transaction, or touches grace-clock columns.
 *
 * Accepted residuals (`04-catalogos.md:2317-2327`): stale queued notice;
 * subscriber-initiated MP cancellation indistinguishable from provider's;
 * `S6` on a suppressed recipient (hard bounce, no notice).
 *
 * R18-b (the complementary-subscription cancel via `S11` rule) enters this
 * same transaction after the `UPDATE`, in HOS-1562 (B7.5).
 *
 * @param input - The receiver's already re-read subscription and cadence
 * @param ports - Clock and optional post-commit coverage listener
 * @returns Whether our notice was found and the active row was scheduled
 */
export async function mirrorOurCancellationOnActive(
    input: { readonly subscriptionId: string; readonly readAt: Date; readonly everyMonths: number },
    ports: {
        readonly clock: Clock;
        readonly coverageNotices?: CoverageNotices;
        readonly complements?: ComplementPolicyPorts;
        readonly provider?: PaymentProvider;
        readonly beforeCancelNotice?: BeforeCancelNotice;
    }
): Promise<MirrorOurCancellationResult> {
    const value = serviceInputSchema.parse(input);
    const result = await getDb().transaction(async (tx) => {
        const [row] = await tx
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, value.subscriptionId))
            .for('update')
            .limit(1);
        if (!row || row.status !== 'ACTIVE') return { outcome: 'LOST_RACE' as const };
        if (!row.userId) return { outcome: 'NOT_OURS' as const };
        const templates = OUR_CANCELLATION_NOTICE_KINDS.map(
            (kind) => BEFORE_CANCEL_TEMPLATE_BY_KIND[kind]
        );
        const [notice] = await tx
            .select({ id: emailOutbox.id })
            .from(emailOutbox)
            .where(
                and(
                    eq(emailOutbox.recipientUserId, row.userId),
                    inArray(emailOutbox.template, templates),
                    sql`${emailOutbox.payload}->>'subscriptionId' = ${row.id}`
                )
            )
            .limit(1);
        if (!notice) return { outcome: 'NOT_OURS' as const };
        const [period] = await tx
            .select({ periodStart: coveredPeriods.periodStart })
            .from(coveredPeriods)
            .where(
                and(eq(coveredPeriods.subscriptionId, row.id), isNull(coveredPeriods.releasedAt))
            )
            .orderBy(sql`${coveredPeriods.periodStart} DESC`)
            .limit(1);
        const serviceEndsAt = ourCancellationServiceEnd({
            lastPaidPeriodStart: period?.periodStart ?? null,
            everyMonths: value.everyMonths,
            firstChargeAt: row.firstChargeAt,
            readAt: value.readAt
        });
        const [updated] = await tx
            .update(subscriptions)
            .set({ status: 'CANCEL_SCHEDULED', serviceEndsAt, updatedAt: ports.clock.now() })
            .where(and(eq(subscriptions.id, row.id), eq(subscriptions.status, 'ACTIVE')))
            .returning({ userId: subscriptions.userId, vertical: subscriptions.vertical });
        if (!updated) return { outcome: 'LOST_RACE' as const };
        const complements =
            row.class === 'PRINCIPAL' && ports.complements
                ? await cancelComplementsByS11Rule(
                      { tx, principalSubscriptionId: row.id, now: ports.clock.now() },
                      ports.complements
                  )
                : undefined;
        await enqueuePaidAfterCancellationNotice({
            tx,
            subscription: row,
            serviceEndsAt,
            recurringAddonsCut: (complements?.decided.length ?? 0) > 0
        });
        return {
            outcome: 'SCHEDULED' as const,
            serviceEndsAt,
            userId: updated.userId,
            vertical: updated.vertical,
            ...(complements ? { complements: complements.decided } : {})
        };
    });
    if (result.outcome !== 'SCHEDULED') return result;
    const vertical = VerticalEnumSchema.safeParse(result.vertical);
    if (result.userId && vertical.success) {
        try {
            await (ports.coverageNotices ?? unwiredCoverageNotices).emitCoverageChanged({
                userId: result.userId,
                vertical: vertical.data,
                sourceType: 'SUBSCRIPTION',
                change: 'CHANGED'
            });
        } catch (error) {
            logger.error(
                { subscriptionId: value.subscriptionId, error },
                'Coverage changed notice failed after R18 commit'
            );
        }
    } else {
        logger.error(
            {
                subscriptionId: value.subscriptionId,
                userId: result.userId,
                vertical: result.vertical
            },
            'Scheduled subscription has no valid coverage subject to notify'
        );
    }
    if (result.complements?.length && ports.provider && ports.beforeCancelNotice) {
        try {
            await cancelDecidedComplementsAtProvider(
                { decided: result.complements },
                {
                    provider: ports.provider,
                    clock: ports.clock,
                    beforeCancelNotice: ports.beforeCancelNotice
                }
            );
        } catch (error) {
            logger.error(
                { subscriptionId: value.subscriptionId, error },
                'R18 complement provider cancellation failed after commit'
            );
        }
    }
    return {
        outcome: 'SCHEDULED',
        serviceEndsAt: result.serviceEndsAt,
        ...(result.complements ? { complements: result.complements } : {})
    };
}
