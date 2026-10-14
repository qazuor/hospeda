import {
    type DomainEventActorType,
    type DomainEventChange,
    type DrizzleClient,
    domainEventModel
} from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types';

/**
 * The decisions of exception 4 (B11 §3, B11.md:372): the ten transitions and ONE
 * tombstone, the receipt tombstone; the twelfth, the cancellation of the inherited
 * Tourist VIP, by the owner's decision (H3 → b, Coord-289); and the thirteenth,
 * `REJECTION_REVIVED`, which is not a transition of ours but the live re-read of a
 * terminal row the provider cancelled after a rejected charge (Coord-351 F3, HOS-1676
 * H-8): B11 §3 says «desde esa relectura la fila entra a la salvedad 4», so that re-read
 * records the decision and starts the 3-day clock. Local literals on purpose: nothing
 * from `@repo/db` is evaluated at module level.
 */
export const SALVEDAD_4_TRANSITIONS = [
    'S12',
    'S3',
    'S13',
    'S16',
    'S20',
    'S22',
    'S23',
    'S24',
    'S31',
    'S36',
    'RECEPTION_TOMBSTONE',
    'TOURIST_VIP_INHERITED',
    // Coord-351 F3 · B11 §3: «desde esa relectura la fila entra a la salvedad 4».
    'REJECTION_REVIVED'
] as const;

/** The cancellations of the complement of a terminal addon instance (exception 1, B11.md:374-377). */
export const SALVEDAD_1_TRANSITIONS = ['A3', 'A5', 'A6', 'S21'] as const;

/** The live row a cancellation left behind: `CANCEL_SCHEDULED` by S11 (B11 §3 point 3). */
export const CANCEL_SCHEDULED_TRANSITIONS = ['S11'] as const;

/** Every transition whose decision to cancel our preapproval the sweep retries (AC:B11:6). */
export type ProviderCancellationTransition =
    | (typeof SALVEDAD_4_TRANSITIONS)[number]
    | (typeof SALVEDAD_1_TRANSITIONS)[number]
    | (typeof CANCEL_SCHEDULED_TRANSITIONS)[number];

const TRANSITIONS = [
    ...SALVEDAD_4_TRANSITIONS,
    ...SALVEDAD_1_TRANSITIONS,
    ...CANCEL_SCHEDULED_TRANSITIONS
] as const;

/** Input of {@link recordProviderCancellationDecided}. */
export interface RecordProviderCancellationDecidedInput {
    readonly subscriptionId: string;
    readonly transition: ProviderCancellationTransition;
    /** The instant of the transition (for the receipt tombstone: when it was written). */
    readonly decidedAt: Date;
    readonly actor: { readonly type: DomainEventActorType; readonly id?: string | null };
    readonly correlationId: string;
    readonly changes?: readonly DomainEventChange[];
    /** The transition's own transaction: the decision is written with the transition. */
    readonly tx: DrizzleClient;
}

const inputSchema = z.object({
    subscriptionId: z.uuid(),
    transition: z.enum(TRANSITIONS),
    decidedAt: z.date(),
    actor: z.object({
        type: z.enum(['owner', 'admin', 'job', 'provider']),
        id: z.uuid().nullable().optional()
    }),
    correlationId: z.uuid(),
    tx: z.custom<DrizzleClient>((value) => value !== undefined && value !== null)
});

/**
 * Records that one of OUR transitions decided to cancel this subscription's preapproval
 * (AC:B11:6). It is the population and the clock of the sweep's 3-day retry: the spec needs
 * no column because "every transition is auditable, with its when" (B11 §3 point 2;
 * NUCLEO/08 §1.1 criterion 2), and this event is that audit record. Written in the SAME
 * transaction as the transition, so a decision never exists without its transition.
 *
 * @param input - The subscription, the transition code, its instant, actor and correlation
 * @returns The written event id
 * @throws ServiceError VALIDATION_ERROR on an invalid input or a missing transaction
 */
export async function recordProviderCancellationDecided(
    input: RecordProviderCancellationDecidedInput
): Promise<{ readonly eventId: string }> {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Invalid provider cancellation decision',
            parsed.error.issues,
            'INVALID_PROVIDER_CANCELLATION_DECISION'
        );
    }
    const event = await domainEventModel.insert({
        eventType: 'subscription.provider_cancellation_decided',
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
