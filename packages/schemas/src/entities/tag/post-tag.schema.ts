import { z } from 'zod';
import { UserIdSchema } from '../../common/id.schema.js';
import { LifecycleStatusEnumSchema } from '../../enums/lifecycle-state.schema.js';
import { TagColorEnumSchema } from '../../enums/tag-color.schema.js';

/**
 * PostTag Schema — Main Entity Schema
 *
 * Represents the `post_tags` table introduced by SPEC-086 (D-001, D-018).
 *
 * PostTags are a public, SEO-driven taxonomy for blog posts — entirely separate
 * from the user-tag subsystem (`tags` table). Key characteristics:
 * - Each PostTag has a URL-safe `slug` that appears in public URLs like
 *   `/blog?tag=gastronomia` (D-013).
 * - No per-user ownership — PostTags are managed by editors/admins only.
 * - `name` and `slug` are unique (enforced by DB indexes).
 * - No i18n in v1 (D-015).
 *
 * @see D-001, D-013, D-018 in SPEC-086 decisions.md
 */
export const PostTagSchema = z.object({
    // ID field
    id: z
        .string({
            message: 'zodError.common.id.required'
        })
        .uuid({ message: 'zodError.common.id.invalidUuid' }),

    // Audit fields
    createdAt: z.coerce.date({
        message: 'zodError.common.createdAt.required'
    }),
    updatedAt: z.coerce.date({
        message: 'zodError.common.updatedAt.required'
    }),
    createdById: UserIdSchema.nullable(),
    updatedById: UserIdSchema.nullable(),
    // Use .nullish() (not .optional()) because Drizzle returns `null` for unset audit columns.
    deletedAt: z.coerce
        .date({
            message: 'zodError.common.deletedAt.required'
        })
        .nullish(),
    deletedById: UserIdSchema.nullish(),

    // Lifecycle
    lifecycleState: LifecycleStatusEnumSchema,

    // PostTag-specific fields

    /**
     * Human-readable tag name. Must be unique across all PostTags.
     * Not i18n'd in v1 (D-015).
     */
    name: z
        .string({
            message: 'zodError.postTag.name.required'
        })
        .min(1, { message: 'zodError.postTag.name.min' }),

    /**
     * URL-safe slug used in public URLs (e.g., `/blog?tag=gastronomia`).
     * Must be lowercase and contain only alphanumerics and hyphens.
     * Must be unique across all PostTags.
     *
     * @example `'gastronomia'`, `'guia-de-viaje'`, `'familia'`
     */
    slug: z
        .string({
            message: 'zodError.postTag.slug.required'
        })
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
            message: 'zodError.postTag.slug.format'
        }),

    /** Display color for admin UI and public tag badges. */
    color: TagColorEnumSchema,

    /** Optional icon identifier for admin UI display. */
    icon: z
        .string({
            message: 'zodError.postTag.icon.required'
        })
        .nullable()
        .optional(),

    /**
     * Optional human-readable description of this tag's scope or intent.
     * Not exposed publicly; admin-use only.
     */
    description: z
        .string({
            message: 'zodError.postTag.description.required'
        })
        .nullable()
        .optional()
});

export type PostTag = z.infer<typeof PostTagSchema>;

/**
 * PostTag array schema
 */
export const PostTagsArraySchema = z.array(PostTagSchema, {
    message: 'zodError.postTags.required'
});
export type PostTagsArray = z.infer<typeof PostTagsArraySchema>;
