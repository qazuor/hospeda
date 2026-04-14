import { z } from 'zod';
import { LifecycleStatusEnum } from '../../enums/lifecycle-state.enum.js';
import {
    AccommodationAdminSchema,
    AccommodationProtectedSchema,
    AccommodationPublicSchema
} from '../accommodation/accommodation.access.schema.js';
import {
    DestinationAdminSchema,
    DestinationProtectedSchema,
    DestinationPublicSchema
} from '../destination/destination.access.schema.js';
import {
    EventAdminSchema,
    EventProtectedSchema,
    EventPublicSchema
} from '../event/event.access.schema.js';
import {
    UserAdminSchema,
    UserProtectedSchema,
    UserPublicSchema
} from '../user/user.access.schema.js';
import { PostSchema } from './post.schema.js';

// ---------------------------------------------------------------------------
// Inline sponsorship relation shapes — avoids a circular import cycle.
//
// postSponsorship.access.schema.ts imports PostPublicSchema / PostProtectedSchema
// / PostAdminSchema from this file, so we cannot import PostSponsorship*Schema
// back.  Instead we inline the same field sets that those schemas pick/expose,
// mirroring their definitions exactly.  This keeps the module graph acyclic
// while still allowing runtime safeParse() to validate sponsorship payloads.
// ---------------------------------------------------------------------------

/**
 * Inline mirror of PostSponsorshipPublicSchema fields.
 * Picks only the subset that is safe to expose to unauthenticated users.
 */
const PostSponsorshipPublicRelationSchema = z.object({
    id: z.string().uuid(),
    postId: z.string().uuid(),
    sponsorId: z.string().uuid(),
    description: z.string(),
    message: z.string().optional(),
    isHighlighted: z.boolean(),
    fromDate: z.date().optional(),
    toDate: z.date().optional()
});

/**
 * Inline mirror of PostSponsorshipProtectedSchema fields.
 * Extends public fields with financial and lifecycle data.
 */
const PostSponsorshipProtectedRelationSchema = PostSponsorshipPublicRelationSchema.extend({
    paid: z
        .object({
            price: z.number(),
            currency: z.string()
        })
        .optional(),
    paidAt: z.date().optional(),
    lifecycleState: z.nativeEnum(LifecycleStatusEnum).optional(),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional()
});

/**
 * Inline mirror of PostSponsorshipAdminSchema fields.
 * Full schema including admin-only audit and moderation data.
 */
const PostSponsorshipAdminRelationSchema = PostSponsorshipProtectedRelationSchema.extend({
    deletedAt: z.date().nullable().optional(),
    createdById: z.string().uuid().nullable().optional(),
    updatedById: z.string().uuid().nullable().optional(),
    deletedById: z.string().uuid().nullable().optional(),
    adminInfo: z.record(z.string(), z.unknown()).optional()
});

/**
 * PUBLIC ACCESS SCHEMA
 *
 * Contains only the minimum data safe to expose to unauthenticated users.
 * Used for public listing and detail pages.
 *
 * Picks specific fields from the full schema to ensure only public data is exposed.
 * Relation fields are all optional — they are only present when the API JOIN loads them.
 */
export const PostPublicSchema = PostSchema.pick({
    // Identification
    id: true,
    slug: true,
    title: true,
    summary: true,
    content: true,
    category: true,

    // Author (only ID, not full details)
    authorId: true,

    // Media (public safe)
    media: true,

    // Flags
    isFeatured: true,
    isFeaturedInWebsite: true,
    isNews: true,

    // Social engagement (public)
    likes: true,
    comments: true,
    shares: true,

    // Display fields
    publishedAt: true,
    readingTimeMinutes: true,

    // Related entities (only IDs)
    relatedDestinationId: true,
    relatedAccommodationId: true,
    relatedEventId: true,

    // Visibility
    visibility: true,

    // SEO (public)
    seo: true,

    // Tags (public)
    tags: true,

    // Basic timestamps
    createdAt: true,
    updatedAt: true
}).extend({
    /** Full author data when JOIN is performed — public-tier fields only. */
    author: UserPublicSchema.optional(),
    /** Full related accommodation when JOIN is performed — public-tier fields only. */
    relatedAccommodation: AccommodationPublicSchema.optional(),
    /** Full related destination when JOIN is performed — public-tier fields only. */
    relatedDestination: DestinationPublicSchema.optional(),
    /** Full related event when JOIN is performed — public-tier fields only. */
    relatedEvent: EventPublicSchema.optional(),
    /**
     * Sponsorship data with nested sponsor user — public-tier fields only.
     * Inlined to avoid circular import with postSponsorship.access.schema.ts.
     */
    sponsorship: PostSponsorshipPublicRelationSchema.extend({
        sponsor: UserPublicSchema.optional()
    }).optional()
});

export type PostPublic = z.infer<typeof PostPublicSchema>;

/**
 * PROTECTED ACCESS SCHEMA
 *
 * Contains data for authenticated users.
 * Used for user dashboards and authenticated interactions.
 *
 * Extends public schema with additional fields.
 * Relation fields are all optional — they are only present when the API JOIN loads them.
 */
export const PostProtectedSchema = PostSchema.pick({
    // All public fields
    id: true,
    slug: true,
    title: true,
    summary: true,
    content: true,
    category: true,
    authorId: true,
    media: true,
    isFeatured: true,
    isFeaturedInWebsite: true,
    isNews: true,
    likes: true,
    comments: true,
    shares: true,
    publishedAt: true,
    readingTimeMinutes: true,
    relatedDestinationId: true,
    relatedAccommodationId: true,
    relatedEventId: true,
    visibility: true,
    seo: true,
    tags: true,
    createdAt: true,
    updatedAt: true,

    // Protected fields - ownership and lifecycle
    lifecycleState: true,
    expiresAt: true,
    sponsorshipId: true
}).extend({
    /** Full author data when JOIN is performed — protected-tier fields only. */
    author: UserProtectedSchema.optional(),
    /** Full related accommodation when JOIN is performed — protected-tier fields only. */
    relatedAccommodation: AccommodationProtectedSchema.optional(),
    /** Full related destination when JOIN is performed — protected-tier fields only. */
    relatedDestination: DestinationProtectedSchema.optional(),
    /** Full related event when JOIN is performed — protected-tier fields only. */
    relatedEvent: EventProtectedSchema.optional(),
    /**
     * Sponsorship data with nested sponsor user — protected-tier fields only.
     * Inlined to avoid circular import with postSponsorship.access.schema.ts.
     */
    sponsorship: PostSponsorshipProtectedRelationSchema.extend({
        sponsor: UserProtectedSchema.optional()
    }).optional()
});

export type PostProtected = z.infer<typeof PostProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA
 *
 * Contains ALL fields including sensitive admin-only data.
 * Used for admin dashboard, moderation, and management.
 *
 * This is essentially the full schema extended with all relation fields.
 * Relation fields are all optional — they are only present when the API JOIN loads them.
 */
export const PostAdminSchema = PostSchema.extend({
    /** Full author data when JOIN is performed — admin-tier fields only. */
    author: UserAdminSchema.optional(),
    /** Full related accommodation when JOIN is performed — admin-tier fields only. */
    relatedAccommodation: AccommodationAdminSchema.optional(),
    /** Full related destination when JOIN is performed — admin-tier fields only. */
    relatedDestination: DestinationAdminSchema.optional(),
    /** Full related event when JOIN is performed — admin-tier fields only. */
    relatedEvent: EventAdminSchema.optional(),
    /**
     * Sponsorship data with nested sponsor user — admin-tier fields only.
     * Inlined to avoid circular import with postSponsorship.access.schema.ts.
     */
    sponsorship: PostSponsorshipAdminRelationSchema.extend({
        sponsor: UserAdminSchema.optional()
    }).optional()
});

export type PostAdmin = z.infer<typeof PostAdminSchema>;
