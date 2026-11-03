import { type Clock, VerticalSchema } from '@repo/billing-verticals-contract';
import {
    and,
    billingOptions,
    eq,
    getDb,
    isNull,
    providerLinks,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import { createLogger } from '@repo/logger';
import type { PaymentProvider } from '@repo/payments';
import { BILLING_CYCLE_MONTHS } from '@repo/schemas';
import { z } from 'zod';
import { type CoverageNotices, unwiredCoverageNotices } from '../payment/payment-ports.js';
import { openReconciliationMark } from '../reconciliation/open-reconciliation-mark.service.js';
import type { ComplementPolicyPorts } from './complement-ports.js';
import { type ResumeComplementsSummary, resumeComplementsS33 } from './complement-resume-s33.js';
import { confirmPrincipalResume } from './resume-subscription-provider.js';

const logger = createLogger('resume-subscription-s10');
const inputSchema = z.strictObject({ subscriptionId: z.uuid(), cause: z.enum(['TERM', 'EARLY']) });

/** Outcome of the S10 principal resume transition. */
export type ResumeSubscriptionResult =
    | {
          readonly outcome: 'NOT_APPLICABLE';
          readonly reason: 'NOT_PRINCIPAL' | 'NOT_PAUSED' | 'NO_OPEN_PAUSE' | 'NO_PROVIDER_LINK';
      }
    | { readonly outcome: 'NOT_APPLIED' | 'LOST_RACE' }
    | {
          readonly outcome: 'RESUMED';
          readonly nextChargeAt: Date | null;
          readonly complements: ResumeComplementsSummary;
      };

/** Runs S10 for a due or early principal return, confirming card state before locking the row. */
export async function resumeSubscription(
    input: { readonly subscriptionId: string; readonly cause: 'TERM' | 'EARLY' },
    ports: {
        readonly provider: PaymentProvider;
        readonly clock: Clock;
        readonly complements: ComplementPolicyPorts;
        readonly coverageNotices?: CoverageNotices;
    }
): Promise<ResumeSubscriptionResult> {
    const value = inputSchema.parse(input);
    const db = getDb();
    const [principal] = await db
        .select({
            id: subscriptions.id,
            class: subscriptions.class,
            status: subscriptions.status,
            paymentMethod: subscriptions.paymentMethod,
            nextChargeAt: subscriptions.nextChargeAt
        })
        .from(subscriptions)
        .where(eq(subscriptions.id, value.subscriptionId))
        .limit(1);
    if (principal?.class !== 'PRINCIPAL')
        return { outcome: 'NOT_APPLICABLE', reason: 'NOT_PRINCIPAL' };
    if (principal.status !== 'PAUSED') return { outcome: 'NOT_APPLICABLE', reason: 'NOT_PAUSED' };
    const [openPause] = await db
        .select({ id: subscriptionPauses.id })
        .from(subscriptionPauses)
        .where(
            and(
                eq(subscriptionPauses.subscriptionId, value.subscriptionId),
                isNull(subscriptionPauses.actualEndAt)
            )
        )
        .limit(1);
    if (!openPause) return { outcome: 'NOT_APPLICABLE', reason: 'NO_OPEN_PAUSE' };
    let providerNextChargeAt: Date | null = null;
    if (principal.paymentMethod === 'CARD') {
        const [link] = await db
            .select({ authorizationId: providerLinks.providerId })
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, value.subscriptionId))
            .limit(1);
        if (!link) return { outcome: 'NOT_APPLICABLE', reason: 'NO_PROVIDER_LINK' };
        const confirmed = await confirmPrincipalResume({
            subscriptionId: value.subscriptionId,
            authorizationId: link.authorizationId,
            provider: ports.provider,
            clock: ports.clock
        });
        if (confirmed.outcome === 'NOT_APPLIED') return { outcome: 'NOT_APPLIED' };
        providerNextChargeAt = confirmed.nextChargeAt;
    }
    const now = ports.clock.now();
    const written = await db.transaction(async (tx) => {
        const [locked] = await tx
            .select({
                id: subscriptions.id,
                class: subscriptions.class,
                status: subscriptions.status,
                paymentMethod: subscriptions.paymentMethod,
                nextChargeAt: subscriptions.nextChargeAt,
                billingOptionId: subscriptions.billingOptionId
            })
            .from(subscriptions)
            .where(eq(subscriptions.id, value.subscriptionId))
            .for('update')
            .limit(1);
        if (locked?.class !== 'PRINCIPAL' || locked.status !== 'PAUSED') return null;
        const [pause] = await tx
            .select({ id: subscriptionPauses.id })
            .from(subscriptionPauses)
            .where(
                and(
                    eq(subscriptionPauses.subscriptionId, locked.id),
                    isNull(subscriptionPauses.actualEndAt)
                )
            )
            .limit(1);
        if (!pause) return null;
        let nextChargeAt = providerNextChargeAt;
        if (locked.paymentMethod === 'MANUAL') {
            if (!locked.billingOptionId) throw new Error('Manual principal lacks billing option');
            const [option] = await tx
                .select({ cycle: billingOptions.cycle })
                .from(billingOptions)
                .where(eq(billingOptions.id, locked.billingOptionId))
                .limit(1);
            if (!option) throw new Error('Manual principal lacks billing option');
            const cycle = z
                .enum(['monthly', 'quarterly', 'semiannual', 'annual'])
                .parse(option.cycle);
            nextChargeAt = locked.nextChargeAt;
            while (nextChargeAt && nextChargeAt <= now) {
                const advanced = new Date(nextChargeAt);
                advanced.setUTCMonth(advanced.getUTCMonth() + BILLING_CYCLE_MONTHS[cycle]);
                nextChargeAt = advanced;
            }
        }
        const [row] = await tx
            .update(subscriptions)
            .set({ status: 'ACTIVE', nextChargeAt })
            .where(and(eq(subscriptions.id, locked.id), eq(subscriptions.status, 'PAUSED')))
            .returning({ userId: subscriptions.userId, vertical: subscriptions.vertical });
        if (!row) return null;
        await tx
            .update(subscriptionPauses)
            .set({ actualEndAt: now })
            .where(eq(subscriptionPauses.id, pause.id));
        if (!row.userId || !row.vertical) throw new Error('Principal lacks owner or vertical');
        return { userId: row.userId, vertical: row.vertical, nextChargeAt };
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
            change: 'ADDED'
        });
    } catch (error) {
        logger.error(
            { subscriptionId: value.subscriptionId, error },
            'Coverage notice failed after S10 commit'
        );
    }
    const complements = await resumeComplementsS33(
        { principalSubscriptionId: value.subscriptionId, trigger: 'PRINCIPAL_ACTIVE' },
        { provider: ports.provider, clock: ports.clock, policy: ports.complements }
    );
    return { outcome: 'RESUMED', nextChargeAt: written.nextChargeAt, complements };
}
