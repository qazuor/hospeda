import { and, asc, eq, getDb, inArray, subscriptions } from '@repo/db';
import { createLogger } from '@repo/logger';
import { alias } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import {
    type CancelSuccessionPredecessorPorts,
    type CancelSuccessionPredecessorResult,
    cancelSuccessionPredecessor
} from './cancel-succession-predecessor.service.js';

const inputSchema = z.strictObject({ limit: z.number().int().min(1).max(200) });
const logger = createLogger('reevaluate-succession-predecessors');
const S17_PREDECESSOR_STATUSES = [
    'ACTIVE',
    'GRACE_PERIOD',
    'CANCEL_SCHEDULED',
    'PAUSED',
    'SUSPENDED'
] as const;

/** Counts each S17 outcome produced by one bounded reevaluation. */
export interface ReevaluateSuccessionPredecessorsResult {
    readonly selected: number;
    readonly cancelled: number;
    readonly deferred: number;
    readonly notApplicable: number;
    readonly lostRace: number;
}

/** Reevaluates live predecessors with ACTIVE principal successors in id order, serially. */
export async function reevaluateSuccessionPredecessors(
    input: { readonly limit: number },
    ports: CancelSuccessionPredecessorPorts & {
        readonly afterCancelled?: (input: {
            readonly successorSubscriptionId: string;
        }) => Promise<void>;
    }
): Promise<ReevaluateSuccessionPredecessorsResult> {
    const { limit } = inputSchema.parse(input);
    const predecessor = alias(subscriptions, 's17_predecessor');
    const selected = await getDb()
        .select({ successorId: subscriptions.id, predecessorId: subscriptions.succeedsId })
        .from(subscriptions)
        .innerJoin(
            predecessor,
            and(
                eq(subscriptions.succeedsId, predecessor.id),
                inArray(predecessor.status, S17_PREDECESSOR_STATUSES)
            )
        )
        .where(and(eq(subscriptions.class, 'PRINCIPAL'), eq(subscriptions.status, 'ACTIVE')))
        .orderBy(asc(subscriptions.id))
        .limit(limit);
    const candidates = selected.map((row) => row.successorId);
    const results: CancelSuccessionPredecessorResult[] = [];
    for (const successorSubscriptionId of candidates) {
        const result = await cancelSuccessionPredecessor({ successorSubscriptionId }, ports);
        results.push(result);
        if (result.outcome === 'CANCELLED' && ports.afterCancelled) {
            try {
                await ports.afterCancelled({ successorSubscriptionId });
            } catch (error) {
                logger.error(
                    { successorSubscriptionId, error },
                    'S9 retry failed after S17 cancellation'
                );
            }
        }
    }
    return {
        selected: candidates.length,
        cancelled: results.filter((result) => result.outcome === 'CANCELLED').length,
        deferred: results.filter((result) => result.outcome === 'DEFERRED').length,
        notApplicable: results.filter((result) => result.outcome === 'NOT_APPLICABLE').length,
        lostRace: results.filter((result) => result.outcome === 'LOST_RACE').length
    };
}
