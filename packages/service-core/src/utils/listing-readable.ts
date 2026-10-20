import { readListingAccessFacts, resolveResourceStep } from '@repo/verticals';
import type { Actor } from '../types';
import { entityNotFoundError } from './not-found';

/** Apply step 4 to a single listing read, using the same error as an absent row. */
export function assertListingReadable(args: {
    readonly actor: Actor;
    readonly entity: unknown;
    readonly entityName: string;
}): void {
    const facts = readListingAccessFacts({ entity: args.entity });
    const result = resolveResourceStep({ actorId: args.actor.id, facts, operation: 'READ_PUBLIC' });
    if (!result.allowed) throw entityNotFoundError({ entityName: args.entityName });
}
