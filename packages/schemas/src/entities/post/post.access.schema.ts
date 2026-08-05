import { z } from 'zod';
import { UserIdSchema } from '../../common/id.schema.js';
import { LifecycleStatusEnum } from '../../enums/lifecycle-state.enum.js';
import {
    AccommodationAdminSchema,
    AccommodationProtectedCardSchema,
    AccommodationPublicCardSchema
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
    PostSponsorAdminSchema,
    PostSponsorProtectedSchema,
    PostSponsorPublicSchema
} from '../postSponsor/postSponsor.access.schema.js';
import { PublicPostTagSchema } from '../tag/post-tag.public.schema.js';
import { UserAdminSchema, UserProtectedSchema } from '../user/user.access.schema.js';
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
    message: z.string().nullish(),
    isHighlighted: z.boolean(),
    fromDate: z.date().nullish(),
    toDate: z.date().nullish()
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
        .nullish(),
    paidAt: z.date().nullish(),
    lifecycleState: z.nativeEnum(LifecycleStatusEnum).nullish(),
    createdAt: z.date().nullish(),
    updatedAt: z.date().nullish()
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
    // Use .nullish() (not .optional()) because Drizzle returns `null` for empty JSONB columns.
    adminInfo: z.record(z.string(), z.unknown()).nullish()
});

/**
 * The author projection carried by a PUBLIC post payload.
 *
 * Mirrors `EventAuthorPublicSchema` (`../event/event.access.schema.ts`) field
 * for field, and exists for the same two reasons — the post payload just had
 * the defect for longer, and on a bigger surface (every public post route uses
 * this schema).
 *
 * **1. Scope.** It used to be `UserPublicSchema`, which also carries
 * `firstName`, `lastName`, `avatarUrl` and `roles`. A byline needs none of
 * those: the author page publishes a chosen display name, a slug and an avatar,
 * and that is the whole contract. `firstName`/`lastName` are the person's real
 * name — a different class of data from a display name they picked — and
 * `roles` describes the account's privileges, which has no business travelling
 * in a posts response. `PostService` eager-loads `author` by default, so all of
 * it reached the LIST routes too, on every post.
 *
 * This was not theoretical. `apps/web`'s `toArticleCardProps` actively rendered
 * `firstName + lastName` whenever `displayName` was falsy, and
 * `PostAuthorCard.astro` did the same — including on the HOS-375 author page,
 * which publishes a byline only for authors who chose one. `display_name` is a
 * nullable column Better Auth signup writes directly, bypassing the
 * create/update Zod schemas, so `''` and `null` are both real production
 * states: the page hardened against publishing an author's legal name was
 * publishing it two sections lower, for the same person.
 *
 * **2. Fail-closed blast radius.** `stripWithSchema`
 * (`apps/api/src/utils/response-helpers.ts`) turns ANY parse failure into an
 * HTTP 500 for the entire response, and `createPaginatedResponse` runs it per
 * item — so one bad row poisons every page of the public list. `users.image` is
 * an unbounded nullable `text` column Better Auth writes directly, so a value
 * that is not a valid URL is a real possibility rather than a hypothetical.
 * Under `UserPublicSchema`'s `z.string().url().nullish()` — and its
 * `slug: z.string().min(1)` — that single row 500s `/api/v1/public/posts` for
 * everyone. Here `image` drops the `.url()` constraint entirely, so a stored
 * non-URL round-trips instead of poisoning the page.
 *
 * `displayName`, `slug` and `image` all follow the established read⊇write
 * leniency convention (HOS-190/HOS-302 — bounds stay on the write path, the
 * response asserts type and presence only), the same shape
 * `ContactInfoReadSchema` uses for its own `website`.
 *
 * `id` is kept: it is the key the web transform gates the byline on, and a
 * primary-key UUID discloses nothing the slug does not.
 *
 * ## Why this is a REMOVAL, and why that is allowed here
 *
 * `packages/schemas/CLAUDE.md` forbids dropping fields from a published schema
 * without a three-phase deprecation. This narrowing is a deliberate,
 * owner-approved privacy fix taken as a single step: the whole point is that
 * `firstName`/`lastName`/`roles` stop reaching public callers NOW, and a
 * deprecation window is precisely the thing that would keep publishing them.
 * Treat it as an intentional exception, not an oversight — and do not "restore"
 * the wide shape for compatibility. Consumers were audited first: every public
 * post route declares `PostPublicSchema` (or a non-post shape), and the two web
 * consumers that read the removed fields were changed in the same commit.
 *
 * Declared separately from `EventAuthorPublicSchema` rather than shared: these
 * are per-entity RESPONSE contracts, and a single shared schema would mean
 * widening one payload silently widens the other.
 */
export const PostAuthorPublicSchema = z.object({
    id: UserIdSchema,
    /** Chosen public name. Nullable, unbounded `text` — never 500 on it. */
    displayName: z.string().nullish(),
    /** Link target for `/autores/{slug}/`. Lenient for the same reason. */
    slug: z.string().nullish(),
    /**
     * Avatar URL (the `users.image` column).
     *
     * The ABSENCE of `.url()` is the load-bearing part: this is a RESPONSE
     * contract over an unbounded `text` column Better Auth writes directly, so
     * asserting a format here can only fail-close a page that a bad stored
     * value should never have been able to take down. The format constraint
     * stays on the WRITE path, where a rejection is a 400 the caller can fix —
     * exactly the read⊇write split `ContactInfoReadSchema.website` uses.
     *
     * DO NOT "restore" strictness with `.catch(undefined)`. `ZodCatch` has no
     * renderer in `@hono/zod-openapi` / `@asteasolutions/zod-to-openapi`, and
     * the OpenAPI document is GLOBAL: one unrenderable field makes
     * `getOpenAPIDocument()` throw, which 500s `/docs/openapi.json` and breaks
     * `/docs`, `/reference` and `/ui` in every environment. That is not a
     * hypothesis — it is the regression `apps/api`'s
     * `test/routes/openapi-doc-generation.test.ts` caught on this very field.
     *
     * Consequence, by design: a malformed value now reaches the client as-is
     * instead of being erased here. Not rendering a broken `<img>` is the
     * CONSUMER's job — `apps/web`'s `isRenderableImageUrl` (`src/lib/media.ts`)
     * is where that decision lives.
     */
    image: z.string().nullish()
});

export type PostAuthorPublic = z.infer<typeof PostAuthorPublicSchema>;

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

    // SPEC-212: I18nText translations (public-safe content fields).
    // Web public pages render these to switch the visible locale to en/pt.
    // translationMeta is internal and deliberately NOT picked here.
    titleI18n: true,
    summaryI18n: true,
    contentI18n: true,

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

    /** Public PostTags (SEO taxonomy) — SPEC-086. */
    postTags: true,

    // Basic timestamps
    createdAt: true,
    updatedAt: true
}).extend({
    /**
     * Post author, when the JOIN is performed — public-tier fields only.
     *
     * Deliberately {@link PostAuthorPublicSchema} and NOT `UserPublicSchema`:
     * see that schema's docstring for why the wider projection both overexposed
     * (real name, roles) and could 500 the entire endpoint on one malformed
     * stored avatar.
     */
    author: PostAuthorPublicSchema.nullish(),
    /**
     * Related accommodation when JOIN is performed — public CARD tier.
     *
     * Deliberately NOT `AccommodationPublicSchema`: that schema re-exposes the premium
     * `richDescription`/`richDescriptionI18n`, and the entitlement helpers that gate them
     * only ever run on a flat, top-level accommodation — never on one nested inside a
     * post. `PostService` eager-loads this relation by default with no column allowlist,
     * so the full schema here served ungated premium markdown on a shared-cached public
     * endpoint. The card tier omits both by construction.
     */
    relatedAccommodation: AccommodationPublicCardSchema.nullish(),
    /** Full related destination when JOIN is performed — public-tier fields only. */
    relatedDestination: DestinationPublicSchema.nullish(),
    /** Full related event when JOIN is performed — public-tier fields only. */
    relatedEvent: EventPublicSchema.nullish(),
    /**
     * Public PostTags — overrides the picked field to use the slimmer
     * PublicPostTagSchema (id, name, slug, color, icon, lifecycleState,
     * description) instead of the full admin-tier PostTagSchema.
     */
    postTags: z.array(PublicPostTagSchema).optional(),
    /**
     * Sponsorship data with nested sponsor user — public-tier fields only.
     * Inlined to avoid circular import with postSponsorship.access.schema.ts.
     */
    sponsorship: PostSponsorshipPublicRelationSchema.extend({
        sponsor: PostSponsorPublicSchema.nullish()
    }).nullish()
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
    postTags: true,
    createdAt: true,
    updatedAt: true,

    // Protected fields - ownership and lifecycle
    lifecycleState: true,
    expiresAt: true,
    sponsorshipId: true
}).extend({
    /** Full author data when JOIN is performed — protected-tier fields only. */
    author: UserProtectedSchema.nullish(),
    /** Full related accommodation when JOIN is performed — protected-tier fields only. */
    relatedAccommodation: AccommodationProtectedCardSchema.nullish(),
    /** Full related destination when JOIN is performed — protected-tier fields only. */
    relatedDestination: DestinationProtectedSchema.nullish(),
    /** Full related event when JOIN is performed — protected-tier fields only. */
    relatedEvent: EventProtectedSchema.nullish(),
    /**
     * Sponsorship data with nested sponsor user — protected-tier fields only.
     * Inlined to avoid circular import with postSponsorship.access.schema.ts.
     */
    sponsorship: PostSponsorshipProtectedRelationSchema.extend({
        sponsor: PostSponsorProtectedSchema.nullish()
    }).nullish()
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
    author: UserAdminSchema.nullish(),
    /** Full related accommodation when JOIN is performed — admin-tier fields only. */
    relatedAccommodation: AccommodationAdminSchema.nullish(),
    /** Full related destination when JOIN is performed — admin-tier fields only. */
    relatedDestination: DestinationAdminSchema.nullish(),
    /** Full related event when JOIN is performed — admin-tier fields only. */
    relatedEvent: EventAdminSchema.nullish(),
    /**
     * Sponsorship data with nested sponsor user — admin-tier fields only.
     * Inlined to avoid circular import with postSponsorship.access.schema.ts.
     */
    sponsorship: PostSponsorshipAdminRelationSchema.extend({
        sponsor: PostSponsorAdminSchema.nullish()
    }).nullish()
});

export type PostAdmin = z.infer<typeof PostAdminSchema>;
