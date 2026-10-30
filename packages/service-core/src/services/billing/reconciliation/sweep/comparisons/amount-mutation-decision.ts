import {
    and,
    type DomainEventActorType,
    type DomainEventChange,
    type DrizzleClient,
    desc,
    domainEvent,
    domainEventModel,
    eq,
    getDb
} from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../../../types/index.js';
import type { AmountMutationDecisions } from './amount-mutation-decisions.port.js';

const TRANSITIONS = ['S30', 'S37', 'S10'] as const;
const recordSchema = z.object({
    subscriptionId: z.uuid(),
    transition: z.enum(TRANSITIONS),
    decidedAt: z.date(),
    actor: z.object({
        type: z.enum(['owner', 'admin', 'job', 'provider']),
        id: z.uuid().nullable().optional()
    }),
    correlationId: z.uuid(),
    changes: z
        .array(
            z.object({
                field: z.string(),
                old: z.unknown().optional(),
                new: z.unknown().optional()
            })
        )
        .optional(),
    tx: z.custom<DrizzleClient>((value) => value !== undefined && value !== null)
});

/** Records the amount decision in the same transaction as its subscription transition (S30). */
export async function recordAmountMutationDecided(input: {
    readonly subscriptionId: string;
    readonly transition: 'S30' | 'S37' | 'S10';
    readonly decidedAt: Date;
    readonly actor: { readonly type: DomainEventActorType; readonly id?: string | null };
    readonly correlationId: string;
    readonly changes?: readonly DomainEventChange[];
    readonly tx: DrizzleClient;
}): Promise<{ readonly eventId: string }> {
    const parsed = recordSchema.safeParse(input);
    if (!parsed.success)
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Invalid amount mutation decision',
            parsed.error.issues,
            'INVALID_AMOUNT_MUTATION_DECISION'
        );
    const event = await domainEventModel.insert({
        eventType: 'subscription.amount_mutation_decided',
        entityType: 'subscription',
        entityId: input.subscriptionId,
        actorType: input.actor.type,
        actorId: input.actor.id ?? null,
        correlationId: input.correlationId,
        changes: input.changes ?? [],
        reason: input.transition,
        occurredAt: input.decidedAt,
        tx: input.tx
    });
    return { eventId: event.id };
}

/** Reads the latest audited amount decision; malformed persisted transitions fail closed. */
export function createRecordedAmountMutationDecisions(): AmountMutationDecisions {
    return {
        async findLatest({ subscriptionId }) {
            const [row] = await getDb()
                .select({ transition: domainEvent.reason, decidedAt: domainEvent.occurredAt })
                .from(domainEvent)
                .where(
                    and(
                        eq(domainEvent.entityType, 'subscription'),
                        eq(domainEvent.entityId, subscriptionId),
                        eq(domainEvent.eventType, 'subscription.amount_mutation_decided')
                    )
                )
                .orderBy(desc(domainEvent.occurredAt), desc(domainEvent.id))
                .limit(1);
            if (!row) return null;
            const transition = z.enum(TRANSITIONS).safeParse(row.transition);
            if (!transition.success)
                throw new ServiceError(
                    ServiceErrorCode.INTERNAL_ERROR,
                    'Recorded amount mutation has an invalid transition',
                    transition.error.issues,
                    'INVALID_RECORDED_AMOUNT_MUTATION_TRANSITION'
                );
            return { transition: transition.data, decidedAt: row.decidedAt };
        }
    };
}
