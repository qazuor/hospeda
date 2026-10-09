import { LifecycleStatusEnum, PublicationStatusEnum, VisibilityEnum } from '@repo/schemas';
import type { ListingAccessFacts } from './resource-step';

/**
 * TRANSITORY bridge for listings not backfilled by V6.9 yet.
 * A NULL status is published only for ACTIVE, PUBLIC listings without a
 * suspended owner or plan restriction. A written status always wins.
 * V6.9b (HOS-1641) removes this function and the legacy-column reads.
 */
export function resolveEffectivePublicationStatus(args: {
    readonly publicationStatus: PublicationStatusEnum | null;
    readonly lifecycleState: unknown;
    readonly visibility: unknown;
    readonly ownerSuspended?: unknown;
    readonly planRestricted?: unknown;
}): PublicationStatusEnum | null {
    if (args.publicationStatus !== null) return args.publicationStatus;
    return args.lifecycleState === LifecycleStatusEnum.ACTIVE &&
        args.visibility === VisibilityEnum.PUBLIC &&
        args.ownerSuspended !== true &&
        args.planRestricted !== true
        ? PublicationStatusEnum.PUBLISHED
        : null;
}

/** Read authorization facts from a raw listing row. */
export function readListingAccessFacts(args: {
    readonly entity: unknown;
}): ListingAccessFacts | null {
    const { entity } = args;
    if (entity === null || typeof entity !== 'object') return null;
    if (!('ownerId' in entity)) return null;
    const ownerId = typeof entity.ownerId === 'string' ? entity.ownerId : null;
    const status = 'publicationStatus' in entity ? entity.publicationStatus : null;
    const writtenStatus = Object.values(PublicationStatusEnum).find((value) => value === status);
    const publicationStatus =
        status !== null && status !== undefined && writtenStatus === undefined
            ? null
            : resolveEffectivePublicationStatus({
                  publicationStatus: writtenStatus ?? null,
                  lifecycleState: 'lifecycleState' in entity ? entity.lifecycleState : null,
                  visibility: 'visibility' in entity ? entity.visibility : null,
                  ownerSuspended: 'ownerSuspended' in entity ? entity.ownerSuspended : undefined,
                  planRestricted: 'planRestricted' in entity ? entity.planRestricted : undefined
              });
    return { ownerId, publicationStatus };
}
