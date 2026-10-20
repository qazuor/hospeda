import type { BillingForVerticals } from '@repo/billing-verticals-contract';
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
import type { CoverageNoticeRegistry } from '@repo/service-core';
import {
    type EffectiveSetPort,
    effectiveSetSnapshotCodec,
    type ListingAccessFacts,
    type ListingVertical,
    readEffectiveSet,
    readListingAccessFacts
} from '@repo/verticals';
import { createApiEffectiveSetCache } from '../effective-set-cache';
import {
    createApiBillingCanCharge,
    createApiBillingCoverage,
    createApiBillingRetentionStopped
} from './billing-coverage';
import { createBootstrapCoverageReader } from './bootstrap-coverage-reader';
import { getCoverageNotices } from './coverage-notices';

/** Production ports for the listing access resolver. */
export interface ListingAccessPorts {
    /**
     * Billing's forward contract, every member real (contract §6.3, G13), plus the
     * post-commit entry point of the shared coverage-changed registry.
     */
    readonly billing: BillingForVerticals & Pick<CoverageNoticeRegistry, 'emitCoverageChanged'>;
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
    // Every billing answer is real: `coverage` (HOS-1532), `retentionStopped` and
    // `canCharge` (HOS-1534), and the coverage-changed registry (HOS-1533):
    // `onCoverageChanged`/`emitCoverageChanged` come from the one process-wide
    // registry the billing writers, the trial machine and the publication share.
    // The `reader` stays: the trial and BASE resolution are verticals' in both
    // implementations, not a bootstrap answer (contract §6.3).
    const notices = getCoverageNotices();
    const billing: ListingAccessPorts['billing'] = {
        coverage: createApiBillingCoverage({ reader }).coverage,
        retentionStopped: createApiBillingRetentionStopped().retentionStopped,
        canCharge: createApiBillingCanCharge().canCharge,
        onCoverageChanged: notices.onCoverageChanged,
        emitCoverageChanged: notices.emitCoverageChanged
    };
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
