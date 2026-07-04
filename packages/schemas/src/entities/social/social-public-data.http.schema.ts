import { z } from 'zod';

/**
 * Entity types the public-data-pull endpoint is allowed to surface.
 *
 * Deliberately narrow (R-1: this is NOT a general-purpose public API
 * aggregator). It starts with the two entity kinds a social draft most often
 * references — accommodations and destinations. Extend it consciously (add a
 * variant + widen the aggregation service + update the scoping test), never
 * speculatively.
 */
export const SocialPublicDataEntityTypeEnumSchema = z.enum(['ACCOMMODATION', 'DESTINATION']);

/** TypeScript type inferred from {@link SocialPublicDataEntityTypeEnumSchema}. */
export type SocialPublicDataEntityType = z.infer<typeof SocialPublicDataEntityTypeEnumSchema>;

/**
 * A single public entity shaped for draft enrichment. Intentionally minimal —
 * only the fields the Custom GPT needs to reference or link an entity in a
 * social draft, never the full entity payload.
 */
export const SocialPublicDataItemSchema = z.object({
    entityType: SocialPublicDataEntityTypeEnumSchema,
    id: z.string().uuid(),
    title: z.string(),
    slug: z.string(),
    /** Short blurb; null when the source entity has no summary. */
    summary: z.string().nullable(),
    /** Primary image URL; null when the entity has no media. */
    imageUrl: z.string().url().nullable()
});

/** TypeScript type inferred from {@link SocialPublicDataItemSchema}. */
export type SocialPublicDataItem = z.infer<typeof SocialPublicDataItemSchema>;

/**
 * Response data shape for GET /api/v1/ai/social/public-data.
 *
 * Wrapped in an object (`{ items }`) rather than a bare array — mirrors
 * {@link SocialCatalogResponseDataSchema} and leaves room to add metadata
 * (e.g. a resolved query echo) additively without breaking the contract.
 */
export const SocialPublicDataResponseDataSchema = z.object({
    items: z.array(SocialPublicDataItemSchema)
});

/** TypeScript type inferred from {@link SocialPublicDataResponseDataSchema}. */
export type SocialPublicDataResponseData = z.infer<typeof SocialPublicDataResponseDataSchema>;
