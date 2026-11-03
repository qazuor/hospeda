import {
    type Clock,
    VerticalSchema,
    type VerticalsForBilling
} from '@repo/billing-verticals-contract';
import { and, eq, getDb, providerLinks, sql, subscriptionPauses, subscriptions } from '@repo/db';
import { createLogger } from '@repo/logger';
import type { PaymentProvider } from '@repo/payments';
import { z } from 'zod';
import { recordCoverageLossIfUncovered } from '../coverage/coverage-loss.js';
import { type CoverageNotices, unwiredCoverageNotices } from '../payment/payment-ports.js';
import { openReconciliationMark } from '../reconciliation/open-reconciliation-mark.service.js';
import { type PauseComplementsSummary, pauseComplementsS32 } from './complement-pause-s32.js';
import type { ComplementPolicyPorts } from './complement-ports.js';
import { canPause, type PauseRefusalReason } from './pause-policy.js';
import { confirmPrincipalPause } from './pause-subscription-provider.js';

const logger = createLogger('pause-subscription-s8');
const inputSchema = z.strictObject({ subscriptionId: z.uuid(), requestedMonths: z.number() });

/** The result of a customer-request principal pause. */
export type PauseSubscriptionResult =
    | { readonly outcome: 'REFUSED'; readonly reason: PauseRefusalReason | 'NO_PROVIDER_LINK' }
    | { readonly outcome: 'NOT_APPLIED' | 'LOST_RACE' }
    | {
          readonly outcome: 'PAUSED';
          readonly pauseId: string;
          readonly expectedEndAt: Date;
          readonly complements: PauseComplementsSummary;
      };

/** S8 pauses a card principal after a provider reread, then pauses its recurring complements. */
export async function pauseSubscription(
    input: { readonly subscriptionId: string; readonly requestedMonths: number },
    ports: {
        readonly provider: PaymentProvider;
        readonly clock: Clock;
        readonly planPolicy: VerticalsForBilling['planPolicy'];
        readonly complements: ComplementPolicyPorts;
        readonly coverageNotices?: CoverageNotices;
    }
): Promise<PauseSubscriptionResult> {
    const value = inputSchema.parse(input);
    const initial = await canPause(value, ports);
    if (!initial.allowed) return { outcome: 'REFUSED', reason: initial.reason };
    const [link] = await getDb()
        .select({ authorizationId: providerLinks.providerId })
        .from(providerLinks)
        .where(eq(providerLinks.subscriptionId, value.subscriptionId))
        .limit(1);
    if (!link) return { outcome: 'REFUSED', reason: 'NO_PROVIDER_LINK' };
    const confirmation = await confirmPrincipalPause({
        subscriptionId: value.subscriptionId,
        authorizationId: link.authorizationId,
        provider: ports.provider,
        clock: ports.clock
    });
    if (confirmation === 'NOT_APPLIED') return { outcome: 'NOT_APPLIED' };
    const now = ports.clock.now();
    const written = await getDb().transaction(async (tx) => {
        const [owner] = await tx
            .select({ userId: subscriptions.userId, vertical: subscriptions.vertical })
            .from(subscriptions)
            .where(eq(subscriptions.id, value.subscriptionId))
            .limit(1);
        if (!owner?.userId || !owner.vertical) return null;
        // Serialize quota decisions across origin and successor principals of this pair.
        await tx.execute(
            sql`SELECT pg_advisory_xact_lock(hashtextextended(${owner.userId} || ':' || ${owner.vertical} || ':customer-pause', 0))`
        );
        const [locked] = await tx
            .select({ id: subscriptions.id })
            .from(subscriptions)
            .where(eq(subscriptions.id, value.subscriptionId))
            .for('update')
            .limit(1);
        if (!locked) return null;
        const eligible = await canPause({ ...value, tx }, ports);
        if (!eligible.allowed) return null;
        const [row] = await tx
            .update(subscriptions)
            .set({ status: 'PAUSED', updatedAt: now })
            .where(
                and(eq(subscriptions.id, value.subscriptionId), eq(subscriptions.status, 'ACTIVE'))
            )
            .returning({
                id: subscriptions.id,
                userId: subscriptions.userId,
                vertical: subscriptions.vertical
            });
        if (!row) return null;
        if (!row.userId || !row.vertical)
            throw new Error('Principal subscription lacks owner or vertical');
        const expectedEndAt = new Date(now);
        expectedEndAt.setUTCMonth(expectedEndAt.getUTCMonth() + value.requestedMonths);
        const [pause] = await tx
            .insert(subscriptionPauses)
            .values({
                subscriptionId: row.id,
                reason: 'CUSTOMER_REQUEST',
                requestedMonths: value.requestedMonths,
                startsAt: now,
                expectedEndAt
            })
            .returning({ id: subscriptionPauses.id });
        if (!pause) throw new Error('S8 pause insert returned no row');
        await recordCoverageLossIfUncovered({
            tx,
            userId: row.userId,
            vertical: row.vertical,
            lostAt: now,
            clock: { now: () => now }
        });
        return { pauseId: pause.id, expectedEndAt, userId: row.userId, vertical: row.vertical };
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
    const vertical = VerticalSchema.parse(written.vertical);
    try {
        await (ports.coverageNotices ?? unwiredCoverageNotices).emitCoverageChanged({
            userId: written.userId,
            vertical,
            sourceType: 'SUBSCRIPTION',
            change: 'REMOVED'
        });
    } catch (error) {
        logger.error(
            { subscriptionId: value.subscriptionId, error },
            'Coverage notice failed after S8 commit'
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
