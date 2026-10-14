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
import { VerticalEnumSchema } from '@repo/schemas';
import { z } from 'zod';
import { type CoverageNotices, unwiredCoverageNotices } from '../payment/payment-ports.js';
import {
    BEFORE_CANCEL_TEMPLATE_BY_KIND,
    type BeforeCancelNoticeKind
} from '../subscription/before-cancel-notice-kinds.js';
import { billingPeriodEnd } from '../subscription/billing-period-end.js';

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
 * Returns the end of service for R18, using the newest open paid period or the
 * remaining first-charge credit. AC:B7:15; B/03 §10.1 (`04-catalogos.md:2106`)
 * and DEC-SUB-019📌2 require preserving paid service after our cancellation lost
 * its write. The accepted residuals at `04-catalogos.md:2317-2327` remain: the
 * queued notice is the evidence, with the known stale-notice edge. R18-b enters
 * this same transaction after the update in HOS-1562.
 * @param input - Payment period, cadence, optional first-charge credit and fresh read instant
 * @returns The scheduled service end
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
    | { readonly outcome: 'SCHEDULED'; readonly serviceEndsAt: Date }
    | { readonly outcome: 'NOT_OURS' }
    | { readonly outcome: 'LOST_RACE' };

/**
 * Mirrors a cancellation we sent before S5/S2 restored ACTIVE, retaining the
 * paid period. Its row lock, evidence read and conditional write share one
 * transaction; the CHANGED notice is best effort after commit. It never cuts
 * coverage, calls the payment provider or enqueues email. See AC:B7:15 and
 * R18 in B/03 §10.1.
 * @param input - The receiver's already re-read subscription and cadence
 * @param ports - Clock and optional post-commit coverage listener
 * @returns Whether our notice was found and the active row was scheduled
 */
export async function mirrorOurCancellationOnActive(
    input: { readonly subscriptionId: string; readonly readAt: Date; readonly everyMonths: number },
    ports: { readonly clock: Clock; readonly coverageNotices?: CoverageNotices }
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
        return {
            outcome: 'SCHEDULED' as const,
            serviceEndsAt,
            userId: updated.userId,
            vertical: updated.vertical
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
    return { outcome: 'SCHEDULED', serviceEndsAt: result.serviceEndsAt };
}
