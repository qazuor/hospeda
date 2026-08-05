import { z } from 'zod';
import { ContactInfoReadSchema } from '../../common/contact.schema.js';
import { UserIdSchema } from '../../common/id.schema.js';
import {
    EventLocationAdminSchema,
    EventLocationProtectedSchema,
    EventLocationPublicSchema
} from '../eventLocation/eventLocation.access.schema.js';
import {
    EventOrganizerAdminSchema,
    EventOrganizerProtectedSchema,
    EventOrganizerPublicSchema
} from '../eventOrganizer/eventOrganizer.access.schema.js';
import { EventSchema } from './event.schema.js';

/**
 * The author projection carried by a PUBLIC event payload (HOS-375 §6.9 / G-7).
 *
 * Deliberately its own narrow shape rather than {@link UserPublicSchema}, for
 * two independent reasons.
 *
 * **1. Scope.** `UserPublicSchema` also carries `firstName`, `lastName`,
 * `avatarUrl` and `roles`. A byline needs none of those: the author page
 * publishes a chosen display name, a slug and an avatar, and that is the whole
 * contract. `firstName`/`lastName` are the person's real name — a different
 * class of data from a display name they picked — and `roles` describes the
 * account's privileges, which has no business travelling in an events response
 * at all. Every one of them reached the LIST routes too, on every event.
 *
 * **2. Fail-closed blast radius.** `stripWithSchema`
 * (`apps/api/src/utils/response-helpers.ts`) turns ANY parse failure into an
 * HTTP 500 for the entire response, and `createPaginatedResponse` runs it per
 * item — so one bad row poisons every page of the public list. `users.image` is
 * an unbounded nullable `text` column that Better Auth signup writes directly,
 * bypassing the create/update Zod schemas, so a value that is not a valid URL is
 * a real possibility rather than a hypothetical. Under
 * `UserPublicSchema`'s `z.string().url().nullish()` that single row 500s
 * `/api/v1/public/events` for everyone. Here `image` drops the `.url()`
 * constraint entirely, so a stored non-URL round-trips instead of poisoning the
 * page.
 *
 * The same reasoning applies to `displayName` and `slug`: all three follow the
 * established read⊇write leniency convention (HOS-190/HOS-302 — bounds stay on
 * the write path, the response asserts type and presence only), the same shape
 * `ContactInfoReadSchema` uses for its own `website`.
 *
 * `id` is kept: it is the key the web transform gates the byline on, and a
 * primary-key UUID discloses nothing the slug does not.
 */
export const EventAuthorPublicSchema = z.object({
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

export type EventAuthorPublic = z.infer<typeof EventAuthorPublicSchema>;

/**
 * PUBLIC ACCESS SCHEMA
 *
 * Contains only the minimum data safe to expose to unauthenticated users.
 * Used for public listing and detail pages.
 *
 * Picks specific fields from the full schema to ensure only public data is exposed.
 */
export const EventPublicSchema = EventSchema.pick({
    // Identification
    id: true,
    slug: true,
    name: true,
    category: true,

    // Content
    summary: true,
    description: true,
    isFeatured: true,

    // SPEC-212: I18nText translations (public-safe content fields).
    // Web public pages render these to switch the visible locale to en/pt.
    // translationMeta is internal and deliberately NOT picked here.
    nameI18n: true,
    summaryI18n: true,
    descriptionI18n: true,

    // Media (public safe)
    media: true,

    // Event dates and pricing
    date: true,
    pricing: true,

    // Location references (public)
    locationId: true,
    organizerId: true,

    // Visibility
    visibility: true,

    // SEO (public)
    seo: true,

    // Tags (public)
    tags: true
}).extend({
    // Relation fields — nullish to accept both undefined (relation not loaded)
    // and null (relation loaded but FK is null on the row).
    organizer: EventOrganizerPublicSchema.nullish(),
    location: EventLocationPublicSchema.nullish(),
    /**
     * Event author, when the JOIN is performed — public-tier fields only
     * (HOS-375 §6.9 / G-7).
     *
     * The public event payload used to carry no author at all: this schema picks
     * `organizerId` but neither `authorId` nor an author relation, so the event
     * detail page had nothing to build a byline from. `EventService` already
     * eager-loads the `author` relation (`getDefaultListRelations`, inherited by
     * `getDefaultGetByIdRelations`), so the row was being fetched and then
     * silently discarded by `stripWithSchema`. Declaring it here is what lets it
     * through — it adds no query and no JOIN.
     *
     * Deliberately {@link EventAuthorPublicSchema} and NOT `UserPublicSchema`:
     * see that schema's docstring for why the wider projection both overexposed
     * (real name, roles) and could 500 the entire endpoint on one malformed
     * stored avatar. Everything it exposes — chosen display name, slug, avatar —
     * is what the author page publishes by decision anyway, so the payload gains
     * no new class of data and stays actor-blind, which is what keeps
     * `/api/v1/public/events` shareable across its edge cache.
     *
     * It reaches the LIST routes too, not just the detail one, and that is
     * deliberate: `getDefaultListRelations()` and `getCardListRelations()` both
     * already load `author`, so scoping the field to the detail payload would
     * mean introducing a second, narrower event schema to strip on lists — a
     * new divergence to maintain in exchange for dropping a handful of bytes of
     * data the author page publishes anyway.
     *
     * Additive, so allowed by the package's additive-only compat policy: a
     * historic event payload without the key still parses.
     */
    author: EventAuthorPublicSchema.nullish()
});

export type EventPublic = z.infer<typeof EventPublicSchema>;

/**
 * PROTECTED ACCESS SCHEMA
 *
 * Contains data for authenticated users, including contact info and ownership.
 * Used for user dashboards, author views, and authenticated interactions.
 *
 * Extends public schema with additional fields.
 */
export const EventProtectedSchema = EventSchema.pick({
    // All public fields
    id: true,
    slug: true,
    name: true,
    category: true,
    summary: true,
    description: true,
    isFeatured: true,
    media: true,
    date: true,
    pricing: true,
    locationId: true,
    organizerId: true,
    visibility: true,
    seo: true,
    tags: true,

    // Protected fields - ownership
    authorId: true,

    // Contact info (nested object with email, phone, website)
    contactInfo: true,

    // Lifecycle (for authors)
    lifecycleState: true,

    // The platform's moderation verdict on the author's own content (HOS-374
    // §7.6.1). An editor working from /mi-cuenta has to see whether their event
    // is still PENDING or was REJECTED; `visibility` is the author's own switch
    // and says nothing about whether the platform approved the content.
    moderationState: true,

    // Basic audit (created/updated dates)
    createdAt: true,
    updatedAt: true
}).extend({
    // HOS-190: read⊇write — a persisted contactInfo (legacy phone format, missing
    // mobilePhone) must never 500 the response. Format stays strict on write.
    contactInfo: ContactInfoReadSchema.nullish(),
    // Relation fields — nullish to accept both undefined (relation not loaded)
    // and null (relation loaded but FK is null on the row).
    organizer: EventOrganizerProtectedSchema.nullish(),
    location: EventLocationProtectedSchema.nullish()
});

export type EventProtected = z.infer<typeof EventProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA
 *
 * Contains ALL fields including sensitive admin-only data.
 * Used for admin dashboard, moderation, and management.
 *
 * This is essentially the full schema.
 */
export const EventAdminSchema = EventSchema.extend({
    // HOS-190: read⊇write lenient contactInfo (see EventProtectedSchema).
    contactInfo: ContactInfoReadSchema.nullish(),
    // Relation fields — nullish to accept both undefined and null.
    organizer: EventOrganizerAdminSchema.nullish(),
    location: EventLocationAdminSchema.nullish()
});

export type EventAdmin = z.infer<typeof EventAdminSchema>;
