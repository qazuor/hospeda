import { PublicationStatusEnum } from '@repo/schemas';
import type { ListingAccessFacts } from './resource-step';

/** Read authorization facts from a raw listing row. */
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
