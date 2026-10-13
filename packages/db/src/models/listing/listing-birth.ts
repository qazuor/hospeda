import { PublicationStatusEnum } from '@repo/schemas';
import { sql } from 'drizzle-orm';

interface ListingBirthData {
    readonly publicationStatus?: unknown;
    readonly inactiveSince?: unknown;
    readonly deadlinesVersion?: unknown;
}

/**
 * Completes the listing birth state without changing the caller's data.
 *
 * A listing is born `DRAFT` unless the caller writes its `publicationStatus`
 * (seeds and tests may; no API input carries it — only the PB transitions
 * change it afterwards). The retention clock (`inactiveSince`) and the
 * deadlines version are written together: both default to the birth instant
 * and the current deadlines version, and passing only one of them throws.
 *
 * @param input - `data`: the insert values of the listing row.
 * @returns `data` with the birth columns the caller did not set.
 */
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
                publicationStatus: PublicationStatusEnum.DRAFT
            }),
            ...(!hasInactiveSince && { inactiveSince: sql`now()` }),
            ...(!hasDeadlinesVersion && {
                deadlinesVersion: sql`(SELECT max("version") FROM "vertical_deadline_version")`
            })
        }
    };
}
