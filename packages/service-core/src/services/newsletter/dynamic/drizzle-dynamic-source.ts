import { accommodations, getDb } from '@repo/db';
import {
    DynamicBlockConfigSchema,
    NewsletterDynamicEntityTypeEnum,
    NewsletterDynamicSourceEnum,
    PublicationStatusEnum
} from '@repo/schemas';
import { inArray } from 'drizzle-orm';
import type { ServiceContext } from '../../../types/index.js';
import { DynamicResolutionError } from './dynamic-resolution.error.js';
import type {
    DroppedItem,
    DynamicSourcePort,
    FetchCandidatesInput
} from './dynamic-source.port.js';
import { eligibleAccommodationPredicate } from './eligible-accommodation.predicate.js';
import { CARD_LOADERS, SOURCE_RESOLVERS } from './registries.js';

/** Read-only Drizzle adapter, bound to one entity type and an injected site origin. */
export class DrizzleDynamicSource implements DynamicSourcePort {
    private readonly entityType: NewsletterDynamicEntityTypeEnum;
    private readonly siteUrl: string;
    private readonly ctx?: ServiceContext;

    /** Construct an adapter without opening a connection or reading environment values. */
    constructor(input: {
        readonly siteUrl: string;
        readonly entityType?: NewsletterDynamicEntityTypeEnum;
        readonly ctx?: ServiceContext;
    }) {
        this.entityType = input.entityType ?? NewsletterDynamicEntityTypeEnum.ACCOMMODATION;
        this.siteUrl = input.siteUrl;
        this.ctx = input.ctx;
    }

    /** Fetch a stable ranked selection from the entity/source registry. */
    async fetchCandidates(input: FetchCandidatesInput): Promise<readonly string[]> {
        const block = DynamicBlockConfigSchema.parse(input.block);
        if (block.entityType !== this.entityType)
            throw new DynamicResolutionError({ code: 'DYNAMIC_ENTITY_TYPE_MISMATCH' });
        const resolver = SOURCE_RESOLVERS[block.entityType][block.source];
        if (!resolver)
            throw new DynamicResolutionError({ code: 'SOURCE_NOT_SUPPORTED_FOR_ENTITY' });
        return resolver({ ...input, block, ctx: this.ctx });
    }

    /** Preserve incoming order while removing items that no longer satisfy the shared predicate. */
    async revalidate(input: Parameters<DynamicSourcePort['revalidate']>[0]) {
        const block = DynamicBlockConfigSchema.parse(input.block);
        if (block.entityType !== this.entityType)
            throw new DynamicResolutionError({ code: 'DYNAMIC_ENTITY_TYPE_MISMATCH' });
        if (!input.ids.length) return { validIds: [], dropped: [] };
        const db = this.ctx?.tx ?? getDb();
        // One snapshot supplies both the eligibility decision and its diagnostic reason.
        const rows = await db
            .select({
                id: accommodations.id,
                deletedAt: accommodations.deletedAt,
                publicationStatus: accommodations.publicationStatus,
                destinationId: accommodations.destinationId,
                reviewsCount: accommodations.reviewsCount,
                eligible: eligibleAccommodationPredicate({ block })
            })
            .from(accommodations)
            .where(inArray(accommodations.id, [...input.ids]));
        const byId = new Map(rows.map((row) => [row.id, row]));
        const validIds: string[] = [];
        const dropped: DroppedItem[] = [];
        for (const id of new Set(input.ids)) {
            const row = byId.get(id);
            if (row?.eligible) {
                validIds.push(id);
                continue;
            }
            const reason: DroppedItem['reason'] =
                !row || row.deletedAt
                    ? 'deleted'
                    : row.publicationStatus === PublicationStatusEnum.PUBLISHED
                      ? block.source === NewsletterDynamicSourceEnum.TOP_RATED &&
                        row.reviewsCount < (block.params.minReviews ?? 3)
                          ? 'below_min_reviews'
                          : 'destination_mismatch'
                      : 'not_published';
            dropped.push({ id, reason });
        }
        return { validIds, dropped };
    }

    /** Load the bound entity type's localized cards, without changing adapter state. */
    async loadCards(input: Parameters<DynamicSourcePort['loadCards']>[0]) {
        const loader = CARD_LOADERS[this.entityType];
        if (!loader) throw new DynamicResolutionError({ code: 'ENTITY_TYPE_NOT_ENABLED' });
        return loader({ ...input, siteUrl: this.siteUrl, ctx: this.ctx });
    }
}
