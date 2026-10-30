import type { DomainEventActorType, DrizzleClient } from '@repo/db';
import { eq, getDb, SUBSCRIPTION_STATUSES, subscriptions } from '@repo/db';
import { createLogger } from '@repo/logger';
import { ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types';
import { openReconciliationMark } from '../reconciliation/open-reconciliation-mark.service.js';
import type { ReconciliationMarkPayments } from '../reconciliation/reconciliation-mark-payments.port.js';
import {
    findSubscriptionProhibition,
    type SubscriptionProhibitionId,
    type SubscriptionStatus
} from './subscription-prohibited-transitions.js';

const logger = createLogger('subscription-prohibited-transition');

/**
 * Core rule 1 refuses an undeclared transition, records it as a reconciliation
 * mark, and preserves the subscription status; the mark is not a state. This
 * function NEVER writes `subscription`. S2 calls it by id today; S15/HOS-1697
 * and B8b's regret path are the next callers.
 */
export interface RefuseUndeclaredTransitionInput {
    readonly subscriptionId: string;
    readonly to: SubscriptionStatus;
    readonly attemptedBy: string;
    readonly actor: { readonly type: DomainEventActorType; readonly id?: string | null };
    readonly correlationId?: string;
    readonly tx?: DrizzleClient;
}

/** The refusal, non-prohibited pair, or missing-row outcome. */
export type RefuseUndeclaredTransitionResult =
    | {
          readonly outcome: 'REFUSED';
          readonly subscriptionId: string;
          readonly prohibition: SubscriptionProhibitionId;
          readonly from: SubscriptionStatus;
          readonly to: SubscriptionStatus;
          readonly markId: string;
          readonly markOutcome: 'OPENED' | 'ACCUMULATED';
      }
    | {
          readonly outcome: 'NOT_PROHIBITED';
          readonly subscriptionId: string;
          readonly from: string;
          readonly to: SubscriptionStatus;
      }
    | { readonly outcome: 'NOT_FOUND'; readonly subscriptionId: string };

/** Injectable S14 payment handling port. */
export interface RefuseUndeclaredTransitionPorts {
    readonly markPayments?: ReconciliationMarkPayments;
}

/**
 * Refuses a transition listed in PROH:B:1 or PROH:B:2 and records rule 1.
 * Non-prohibited pairs are observed without performing a transition.
 *
 * @param input - The subscription, destination, actor, and optional transaction
 * @param ports - Optional reconciliation payment handling port
 * @returns The refusal, non-prohibited, or not-found result
 * @throws ServiceError for invalid runtime input
 */
export async function refuseUndeclaredSubscriptionTransition(
    input: RefuseUndeclaredTransitionInput,
    ports: RefuseUndeclaredTransitionPorts = {}
): Promise<RefuseUndeclaredTransitionResult> {
    const inputSchema = z.object({
        subscriptionId: z.uuid(),
        to: z.enum(SUBSCRIPTION_STATUSES),
        attemptedBy: z.string().min(1).max(64),
        actor: z.object({
            type: z.enum(['owner', 'admin', 'job', 'provider']),
            id: z.uuid().nullable().optional()
        }),
        correlationId: z.uuid().optional(),
        tx: z.unknown().optional()
    });
    const parsed = inputSchema.safeParse(input);
    const actorRequiresId = parsed.success && ['owner', 'admin'].includes(parsed.data.actor.type);
    if (
        !parsed.success ||
        (actorRequiresId &&
            (parsed.data.actor.id == null || !z.uuid().safeParse(parsed.data.actor.id).success))
    )
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            parsed.success ? 'Person actor id must be a UUID' : parsed.error.message
        );

    const correlationId = parsed.data.correlationId ?? crypto.randomUUID();
    return (input.tx ?? getDb()).transaction(async (tx) => {
        const [row] = await tx
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, input.subscriptionId))
            .limit(1)
            .for('update');
        if (!row) return { outcome: 'NOT_FOUND', subscriptionId: input.subscriptionId };

        const prohibition = findSubscriptionProhibition({ from: row.status, to: input.to });
        if (!prohibition) {
            logger.info(
                { subscriptionId: input.subscriptionId, from: row.status, to: input.to },
                'Subscription transition is not prohibited'
            );
            return {
                outcome: 'NOT_PROHIBITED',
                subscriptionId: input.subscriptionId,
                from: row.status,
                to: input.to
            };
        }

        const opened = await openReconciliationMark(
            {
                subject: { kind: 'SUBSCRIPTION', subscriptionId: input.subscriptionId },
                reason: 'TRANSICION_NO_DECLARADA',
                actor: input.actor,
                correlationId,
                detail: [
                    { field: 'subscription.status', old: row.status, new: input.to },
                    { field: 'subscription.prohibition', new: prohibition },
                    { field: 'subscription.attempted_by', new: input.attemptedBy }
                ],
                tx
            },
            ports.markPayments ? { markPayments: ports.markPayments } : {}
        );
        logger.warn(
            {
                subscriptionId: input.subscriptionId,
                from: row.status,
                to: input.to,
                prohibition,
                correlationId
            },
            'Undeclared subscription transition refused'
        );
        return {
            outcome: 'REFUSED',
            subscriptionId: input.subscriptionId,
            prohibition,
            from: row.status as SubscriptionStatus,
            to: input.to,
            markId: opened.mark.id,
            markOutcome: opened.outcome
        };
    });
}
