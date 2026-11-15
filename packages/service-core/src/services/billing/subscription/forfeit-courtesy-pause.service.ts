import {
    type Clock,
    VerticalSchema,
    type VerticalsForBilling
} from '@repo/billing-verticals-contract';
import {
    and,
    courtesyGrants,
    eq,
    getDb,
    gt,
    isNull,
    sql,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import { createLogger } from '@repo/logger';
import type { PaymentProvider } from '@repo/payments';
import { z } from 'zod';
import { recordCoverageLossIfUncovered } from '../coverage/coverage-loss.js';
import { type CoverageNotices, unwiredCoverageNotices } from '../payment/payment-ports.js';
import { openReconciliationMark } from '../reconciliation/open-reconciliation-mark.service.js';
import { type PauseComplementsSummary, pauseComplementsS32 } from './complement-pause-s32.js';
import type { ComplementPolicyPorts } from './complement-ports.js';
import { canPause, type PauseRefusalReason } from './pause-policy.js';
import { pauseExpectedEndAt } from './pause-subscription.service.js';

const logger = createLogger('forfeit-courtesy-pause-s35');
const inputSchema = z.strictObject({
    subscriptionId: z.uuid(),
    requestedMonths: z.number(),
    courtesyForfeitConfirmed: z.boolean().optional()
});

/** Result of replacing a live courtesy with a customer-request pause. */
export type ForfeitCourtesyPauseResult =
    | {
          readonly outcome: 'REFUSED';
          readonly reason:
              | PauseRefusalReason
              | 'COURTESY_FORFEIT_NOT_CONFIRMED'
              | 'NOT_IN_COURTESY';
      }
    | { readonly outcome: 'LOST_RACE' }
    | {
          readonly outcome: 'PAUSED';
          readonly pauseId: string;
          readonly expectedEndAt: Date;
          readonly complements: PauseComplementsSummary;
      };

/** S35 ends the courtesy and opens the customer's own pause without contacting the principal provider. */
export async function forfeitCourtesyAndPause(
    input: {
        readonly subscriptionId: string;
        readonly requestedMonths: number;
        readonly courtesyForfeitConfirmed?: boolean;
    },
    ports: {
        readonly clock: Clock;
        readonly planPolicy: VerticalsForBilling['planPolicy'];
        readonly provider: PaymentProvider;
        readonly complements: ComplementPolicyPorts;
        readonly coverageNotices?: CoverageNotices;
    }
): Promise<ForfeitCourtesyPauseResult> {
    const value = inputSchema.parse(input);
    if (value.courtesyForfeitConfirmed !== true)
        return { outcome: 'REFUSED', reason: 'COURTESY_FORFEIT_NOT_CONFIRMED' };
    const db = getDb();
    const now = ports.clock.now();
    const [initial] = await db
        .select({ status: subscriptions.status, class: subscriptions.class })
        .from(subscriptions)
        .where(eq(subscriptions.id, value.subscriptionId))
        .limit(1);
    const [open] = await db
        .select({ reason: subscriptionPauses.reason })
        .from(subscriptionPauses)
        .where(
            and(
                eq(subscriptionPauses.subscriptionId, value.subscriptionId),
                isNull(subscriptionPauses.actualEndAt)
            )
        )
        .limit(1);
    if (
        initial?.class !== 'PRINCIPAL' ||
        initial.status !== 'PAUSED' ||
        open?.reason !== 'COURTESY'
    )
        return { outcome: 'REFUSED', reason: 'NOT_IN_COURTESY' };
    const eligible = await canPause(
        {
            subscriptionId: value.subscriptionId,
            requestedMonths: value.requestedMonths,
            courtesyForfeit: true
        },
        ports
    );
    if (!eligible.allowed) return { outcome: 'REFUSED', reason: eligible.reason };
    const written = await db.transaction(async (tx) => {
        const [owner] = await tx
            .select({ userId: subscriptions.userId, vertical: subscriptions.vertical })
            .from(subscriptions)
            .where(eq(subscriptions.id, value.subscriptionId))
            .limit(1);
        if (!owner?.userId || !owner.vertical) return null;
        await tx.execute(
            sql`SELECT pg_advisory_xact_lock(hashtextextended(${owner.userId} || ':' || ${owner.vertical} || ':customer-pause', 0))`
        );
        const [locked] = await tx
            .select({ status: subscriptions.status, class: subscriptions.class })
            .from(subscriptions)
            .where(eq(subscriptions.id, value.subscriptionId))
            .for('update')
            .limit(1);
        if (locked?.class !== 'PRINCIPAL' || locked.status !== 'PAUSED') return null;
        const [pause] = await tx
            .select({ id: subscriptionPauses.id, reason: subscriptionPauses.reason })
            .from(subscriptionPauses)
            .where(
                and(
                    eq(subscriptionPauses.subscriptionId, value.subscriptionId),
                    isNull(subscriptionPauses.actualEndAt)
                )
            )
            .limit(1);
        if (pause?.reason !== 'COURTESY') return null;
        const checked = await canPause(
            {
                subscriptionId: value.subscriptionId,
                requestedMonths: value.requestedMonths,
                courtesyForfeit: true,
                tx
            },
            ports
        );
        if (!checked.allowed) return null;
        const [grant] = await tx
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
        if (!grant) return null;
        await tx
            .update(subscriptionPauses)
            .set({ actualEndAt: now })
            .where(eq(subscriptionPauses.id, pause.id));
        await tx.update(courtesyGrants).set({ endsAt: now }).where(eq(courtesyGrants.id, grant.id));
        const expectedEndAt = pauseExpectedEndAt(now, value.requestedMonths);
        const [created] = await tx
            .insert(subscriptionPauses)
            .values({
                subscriptionId: value.subscriptionId,
                reason: 'CUSTOMER_REQUEST',
                requestedMonths: value.requestedMonths,
                startsAt: now,
                expectedEndAt
            })
            .returning({ id: subscriptionPauses.id });
        if (!created) throw new Error('S35 pause insert returned no row');
        await recordCoverageLossIfUncovered({
            tx,
            userId: owner.userId,
            vertical: owner.vertical,
            lostAt: now,
            clock: { now: () => now }
        });
        return {
            pauseId: created.id,
            expectedEndAt,
            userId: owner.userId,
            vertical: owner.vertical
        };
    });
    if (!written) {
        await openReconciliationMark({
            subject: { kind: 'SUBSCRIPTION', subscriptionId: value.subscriptionId },
            reason: 'TRANSICION_NO_DECLARADA',
            actor: { type: 'job' },
            correlationId: crypto.randomUUID()
        });
        return { outcome: 'LOST_RACE' };
    }
    try {
        await (ports.coverageNotices ?? unwiredCoverageNotices).emitCoverageChanged({
            userId: written.userId,
            vertical: VerticalSchema.parse(written.vertical),
            sourceType: 'SUBSCRIPTION',
            change: 'REMOVED'
        });
    } catch (error) {
        logger.error(
            { subscriptionId: value.subscriptionId, error },
            'Coverage notice failed after S35 commit'
        );
    }
    const complements = await pauseComplementsS32(
        { principalSubscriptionId: value.subscriptionId, trigger: 'PRINCIPAL_PAUSED' },
        { provider: ports.provider, clock: ports.clock, policy: ports.complements }
    );
    return {
        outcome: 'PAUSED',
        pauseId: written.pauseId,
        expectedEndAt: written.expectedEndAt,
        complements
    };
}
