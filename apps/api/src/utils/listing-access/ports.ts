import {
    accommodations,
    and,
    eq,
    experiences,
    gastronomies,
    getDb,
    isNull,
    planCatalogModel
} from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import {
    createBootstrapBillingForVerticals,
    type EffectiveSetPort,
    effectiveSetSnapshotCodec,
    type ListingAccessFacts,
    type ListingVertical,
    readEffectiveSet,
    readListingAccessFacts
} from '@repo/verticals';
import { createApiEffectiveSetCache } from '../effective-set-cache';
import { createBootstrapCoverageReader } from './bootstrap-coverage-reader';

/** Production ports for the listing access resolver. */
export interface ListingAccessPorts {
    readonly billing: ReturnType<typeof createBootstrapBillingForVerticals>;
    readonly effectiveSet: EffectiveSetPort;
    readonly loadFacts: (args: {
        readonly vertical: ListingVertical;
        readonly listingId: string;
    }) => Promise<{ readonly facts: ListingAccessFacts | null; readonly ownerId: string | null }>;
}

let ports: ListingAccessPorts | undefined;

/** Build production listing access ports once; tests replace this module with vi.mock. */
export function getListingAccessPorts(): ListingAccessPorts {
    if (ports) return ports;
    const reader = createBootstrapCoverageReader();
    const billing = createBootstrapBillingForVerticals({ reader });
    const cache = createApiEffectiveSetCache(effectiveSetSnapshotCodec);
    const effectiveSet: EffectiveSetPort = ({ userId, vertical }) =>
        readEffectiveSet({
            reader: planCatalogModel,
            billing,
            trials: reader,
            userId,
            vertical,
            cache
        });
    const loadFacts: ListingAccessPorts['loadFacts'] = async ({ vertical, listingId }) => {
        const db = getDb();
        let entity: unknown;
        switch (vertical) {
            case VerticalEnum.ACCOMMODATION:
                [entity] = await db
                    .select()
                    .from(accommodations)
                    .where(and(eq(accommodations.id, listingId), isNull(accommodations.deletedAt)))
                    .limit(1);
                break;
            case VerticalEnum.GASTRONOMY:
                [entity] = await db
                    .select()
                    .from(gastronomies)
                    .where(and(eq(gastronomies.id, listingId), isNull(gastronomies.deletedAt)))
                    .limit(1);
                break;
            case VerticalEnum.EXPERIENCE:
                [entity] = await db
                    .select()
                    .from(experiences)
                    .where(and(eq(experiences.id, listingId), isNull(experiences.deletedAt)))
                    .limit(1);
                break;
        }
        const facts = readListingAccessFacts({ entity });
        return { facts, ownerId: facts?.ownerId ?? null };
    };
    ports = { billing, effectiveSet, loadFacts };
    return ports;
}
