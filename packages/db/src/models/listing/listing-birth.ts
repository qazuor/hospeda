import { LifecycleStatusEnum, PublicationStatusEnum, VisibilityEnum } from '@repo/schemas';
import { sql } from 'drizzle-orm';

interface LegacyPublicationFacts {
    readonly lifecycleState?: unknown;
    readonly visibility?: unknown;
    readonly ownerSuspended?: unknown;
    readonly planRestricted?: unknown;
}

interface ListingBirthData extends LegacyPublicationFacts {
    readonly publicationStatus?: unknown;
    readonly inactiveSince?: unknown;
    readonly deadlinesVersion?: unknown;
}

/** TRANSITORY: the same rule as the Coord-43 bridge (`resolveEffectivePublicationStatus`); V6.1/V6.9b replace it with plain DRAFT once PB1 exists. */
export function legacyPublicationStatus({
    lifecycleState,
    visibility,
    ownerSuspended,
    planRestricted
}: LegacyPublicationFacts): PublicationStatusEnum {
    return lifecycleState === LifecycleStatusEnum.ACTIVE &&
        visibility === VisibilityEnum.PUBLIC &&
        ownerSuspended !== true &&
        planRestricted !== true
        ? PublicationStatusEnum.PUBLISHED
        : PublicationStatusEnum.DRAFT;
}

/** Completes the listing birth state without changing the caller's data. */
export function withListingBirthColumns<T extends ListingBirthData>({
    data
}: {
    readonly data: T;
}): {
    readonly data: T;
} {
    const hasInactiveSince = Object.hasOwn(data, 'inactiveSince');
    const hasDeadlinesVersion = Object.hasOwn(data, 'deadlinesVersion');
    if (hasInactiveSince !== hasDeadlinesVersion) {
        throw new Error('inactiveSince and deadlinesVersion are written together');
    }
    return {
        data: {
            ...data,
            ...(!Object.hasOwn(data, 'publicationStatus') && {
                publicationStatus: legacyPublicationStatus(data)
            }),
            ...(!hasInactiveSince && { inactiveSince: sql`now()` }),
            ...(!hasDeadlinesVersion && {
                deadlinesVersion: sql`(SELECT max("version") FROM "vertical_deadline_version")`
            })
        }
    };
}
