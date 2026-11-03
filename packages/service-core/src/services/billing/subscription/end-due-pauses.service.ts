import type { Clock } from '@repo/billing-verticals-contract';
import { and, asc, eq, getDb, isNull, lte, subscriptionPauses, subscriptions } from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { z } from 'zod';
import type { CoverageNotices } from '../payment/payment-ports.js';
import type { ComplementPolicyPorts } from './complement-ports.js';
import { resumeSubscription } from './resume-subscription.service.js';

const inputSchema = z.strictObject({ limit: z.number().int().min(1).max(1000) });

/** Resumes due principal pauses of either domain reason, isolating each failure. */
export async function endDuePauses(
    input: { readonly limit: number },
    ports: {
        readonly provider: PaymentProvider;
        readonly clock: Clock;
        readonly complements: ComplementPolicyPorts;
        readonly coverageNotices?: CoverageNotices;
    }
): Promise<{
    readonly resumed: number;
    readonly notApplied: number;
    readonly notApplicable: number;
    readonly lostRace: number;
    readonly failed: number;
}> {
    const { limit } = inputSchema.parse(input);
    const due = await getDb()
        .select({ subscriptionId: subscriptions.id, reason: subscriptionPauses.reason })
        .from(subscriptionPauses)
        .innerJoin(subscriptions, eq(subscriptionPauses.subscriptionId, subscriptions.id))
        .where(
            and(
                eq(subscriptions.class, 'PRINCIPAL'),
                eq(subscriptions.status, 'PAUSED'),
                isNull(subscriptionPauses.actualEndAt),
                lte(subscriptionPauses.expectedEndAt, ports.clock.now())
            )
        )
        .orderBy(asc(subscriptionPauses.expectedEndAt))
        .limit(limit);
    const counts = { resumed: 0, notApplied: 0, notApplicable: 0, lostRace: 0, failed: 0 };
    for (const row of due) {
        try {
            const result = await resumeSubscription(
                { subscriptionId: row.subscriptionId, cause: 'TERM' },
                ports
            );
            if (result.outcome === 'RESUMED') counts.resumed++;
            else if (result.outcome === 'NOT_APPLIED') counts.notApplied++;
            else if (result.outcome === 'NOT_APPLICABLE') counts.notApplicable++;
            else counts.lostRace++;
        } catch {
            counts.failed++;
        }
    }
    return counts;
}
