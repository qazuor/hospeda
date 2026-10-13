import { PublicationStatusEnum } from '@repo/schemas';
import type { ListingAccessFacts } from './resource-step';

/**
 * Read authorization facts from a raw listing row.
 *
 * `publicationStatus` is the written value when it is one of the six states
 * of `PublicationStatusEnum`, and `null` otherwise (absent, NULL or unknown):
 * the authorization then fails closed. HOS-1641 (V6.9b) removed the
 * transitory Coord-43 bridge that derived a status from the old columns.
 *
 * @param args - `entity`: the raw listing row, of any shape.
 * @returns The owner id and publication status, or `null` when the row is not
 *   an object or carries no `ownerId`.
 */
export function readListingAccessFacts(args: {
    readonly entity: unknown;
}): ListingAccessFacts | null {
    const { entity } = args;
    if (entity === null || typeof entity !== 'object') return null;
    if (!('ownerId' in entity)) return null;
    const ownerId = typeof entity.ownerId === 'string' ? entity.ownerId : null;
    const status = 'publicationStatus' in entity ? entity.publicationStatus : null;
    const publicationStatus =
        Object.values(PublicationStatusEnum).find((value) => value === status) ?? null;
    return { ownerId, publicationStatus };
}
