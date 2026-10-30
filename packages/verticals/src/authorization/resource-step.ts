import { PublicationStatusEnum } from '@repo/schemas';
import {
    FOREIGN_ADMITTING_STATES,
    type ListingOperation,
    OWNER_ADMITTING_STATES
} from './listing-operation';

export interface ListingAccessFacts {
    readonly ownerId: string | null;
    readonly publicationStatus: PublicationStatusEnum | null;
}

export type StepOutcome<TReason extends string> =
    | { readonly allowed: true }
    | { readonly allowed: false; readonly reason: TReason };

/**
 * Step 4 combines absence, foreign ownership and inadmissible state into NOT_FOUND.
 * V8a's row 20 (content already deleted) has its own reader,
 * rather than READ_OWN.
 */
export function resolveResourceStep(args: {
    readonly actorId: string | null;
    readonly facts: ListingAccessFacts | null;
    readonly operation: ListingOperation;
}): StepOutcome<'NOT_FOUND'> {
    const { actorId, facts, operation } = args;
    if (facts === null || facts.publicationStatus === PublicationStatusEnum.PURGED) {
        return { allowed: false, reason: 'NOT_FOUND' };
    }
    const isOwner = Boolean(actorId) && facts.ownerId !== null && actorId === facts.ownerId;
    const admitted = isOwner ? OWNER_ADMITTING_STATES : FOREIGN_ADMITTING_STATES;
    return admitted[operation].includes(facts.publicationStatus as PublicationStatusEnum)
        ? { allowed: true }
        : { allowed: false, reason: 'NOT_FOUND' };
}
