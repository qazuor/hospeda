import { z } from 'zod';
import { EntityTypeEnum } from '../../enums/entity-type.enum.js';

/**
 * The subset of {@link EntityTypeEnum} values that the view-tracking system
 * accepts. ACCOMMODATION, POST, EVENT, GASTRONOMY, and EXPERIENCE detail pages
 * are tracked; the remaining enum members (DESTINATION, USER, CONVERSATION,
 * REVIEW, BILLING_SUBSCRIPTION, PAYMENT) are explicitly excluded.
 *
 * GASTRONOMY and EXPERIENCE were added by HOS-734 to give both commerce
 * verticals the same "basic stats" (view counts) accommodation, posts, and
 * events already had. No DB migration was needed: `entity_views.entity_type`
 * already reuses the full `entity_type_enum` Postgres enum (see
 * `entity_view.dbschema.ts`), which has carried GASTRONOMY/EXPERIENCE since
 * they were added to {@link EntityTypeEnum} for the user-bookmark subsystem.
 * Only this narrower Zod subset needed widening.
 *
 * SPEC-159 §3 / HOS-734 / DB schema entity_view.dbschema.ts.
 */
export const TRACKABLE_ENTITY_TYPES = [
    EntityTypeEnum.ACCOMMODATION,
    EntityTypeEnum.POST,
    EntityTypeEnum.EVENT,
    EntityTypeEnum.GASTRONOMY,
    EntityTypeEnum.EXPERIENCE
] as const;

/**
 * Zod schema for the trackable entity-type subset used by SPEC-159 / HOS-734.
 *
 * Derived from {@link EntityTypeEnum} using `z.enum` with the accepted
 * string literals — avoids duplicating raw strings while keeping the type
 * narrow. Any other EntityTypeEnum value is rejected with a descriptive error.
 *
 * @example
 * ```ts
 * TrackableEntityTypeSchema.parse('ACCOMMODATION'); // ok
 * TrackableEntityTypeSchema.parse('GASTRONOMY');    // ok (HOS-734)
 * TrackableEntityTypeSchema.parse('DESTINATION');   // throws ZodError
 * ```
 */
export const TrackableEntityTypeSchema = z.enum(
    [
        EntityTypeEnum.ACCOMMODATION,
        EntityTypeEnum.POST,
        EntityTypeEnum.EVENT,
        EntityTypeEnum.GASTRONOMY,
        EntityTypeEnum.EXPERIENCE
    ],
    { message: 'zodError.entityView.entityType.invalid' }
);

/**
 * Inferred TypeScript type for the trackable-entity subset.
 * One of `'ACCOMMODATION' | 'POST' | 'EVENT' | 'GASTRONOMY' | 'EXPERIENCE'`.
 */
export type TrackableEntityType = z.infer<typeof TrackableEntityTypeSchema>;

/**
 * Core EntityView schema — the stored view-event entity (SPEC-159).
 *
 * Maps 1-to-1 to the `entity_views` table columns. The schema is intentionally
 * lean: no audit columns, no soft-delete (append-only by design; rows are
 * hard-purged by a TTL cron after 95 days).
 */
export const EntityViewSchema = z.object({
    /** Surrogate PK (UUID). */
    id: z
        .string({ message: 'zodError.entityView.id.required' })
        .uuid({ message: 'zodError.entityView.id.invalidUuid' }),

    /** Entity type — restricted to the trackable subset. */
    entityType: TrackableEntityTypeSchema,

    /**
     * PK of the viewed entity. Polymorphic — no DB-level FK (same pattern as
     * `user_bookmarks.entity_id`).
     */
    entityId: z
        .string({ message: 'zodError.entityView.entityId.required' })
        .uuid({ message: 'zodError.entityView.entityId.invalidUuid' }),

    /**
     * Salted daily hash of visitor fingerprint, or the string `'user:<uuid>'`
     * for authenticated visitors. Used for deduplication within the TTL window.
     */
    visitorHash: z
        .string({ message: 'zodError.entityView.visitorHash.required' })
        .min(1, { message: 'zodError.entityView.visitorHash.empty' }),

    /** Whether the viewer was authenticated at the time of the view. */
    isAuthenticated: z.boolean({
        message: 'zodError.entityView.isAuthenticated.required'
    }),

    /** Wall-clock timestamp of the view event. */
    viewedAt: z.coerce.date({ message: 'zodError.entityView.viewedAt.required' })
});

/**
 * Type for EntityView, inferred from {@link EntityViewSchema}.
 */
export type EntityView = z.infer<typeof EntityViewSchema>;
