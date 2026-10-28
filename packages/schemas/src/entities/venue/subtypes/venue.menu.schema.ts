/**
 * Gastronomy menu schemas — the venue's carta (HOS-895).
 *
 * ## Three ways to show a menu, none of them mandatory
 *
 * Before HOS-895 a menu was ONE thing: `gastronomies.menu_url`, a link to a
 * page the venue had published somewhere else. A small restaurant rarely has
 * one; it almost always has a photo or a PDF. Resolving only that, though,
 * would have left the three issues queued behind this one — HOS-1043
 * (multi-language menu), HOS-1045 (a photo per dish), HOS-1044 (a QR with
 * metrics) — with nothing to attach to, because **a photo has no dishes inside
 * it**. So the owner decision was to model the carta for real and keep the
 * attachment as the alternative:
 *
 * | Shape | Where it lives | For whom |
 * |---|---|---|
 * | Structured carta | `venue_menu_sections` + `venue_menu_items` | the venue willing to type its dishes |
 * | Uploaded photo / PDF | `gastronomies.menu_file_url` + `menu_file_kind` | the venue that has the menu as an image |
 * | External link | `gastronomies.menu_url` (pre-existing) | the venue that already publishes one |
 *
 * All three may be set at once and **none is required**. Nobody is made to load
 * forty items to be allowed to publish.
 *
 * ## Multi-language carta (HOS-1043)
 *
 * `nameI18n`/`descriptionI18n` on both the section and the item retrofit
 * `{es,en,pt}` translations exactly as HOS-117 retrofitted
 * `venue_faqs.question_i18n`/`answer_i18n`: additive, nullish, and the
 * legacy `name`/`description` columns stay the `es` fallback source — carried
 * on the STORED schema so a legacy row (no translations) parses unchanged.
 *
 * Unlike the FAQ pair, this one is a PAID capability
 * (`EntitlementKey.MULTILINGUAL_VENUE_MENU`, venue-premium only):
 * the route refuses a submitted document that carries any translation unless
 * the owner's plan grants the key (see `menu-translations-gate.ts`), and the
 * public read withholds already-typed translations from a downgraded owner's
 * payload the same live way it withholds the carta itself. The owner's own
 * protected read is never gated — see `getMenu.ts`.
 *
 * @module entities/venue/subtypes/venue.menu.schema
 */
import { z } from 'zod';
import { i18nText } from '../../../common/i18n.schema.js';
import { mediaAssetUrl } from '../../../common/media.schema.js';

// ----------------------------------------------------------------------------
// Limits
// ----------------------------------------------------------------------------

/**
 * How many sections one carta may hold.
 *
 * A ceiling, not a product tier: the tier decision (`venue-pro` and above
 * may edit a structured carta at all) is an ENTITLEMENT, checked at the route.
 * This number exists so a single PUT cannot be used to write an unbounded
 * number of rows in one transaction.
 */
export const VENUE_MENU_MAX_SECTIONS = 30;

/** How many dishes one section may hold. See {@link VENUE_MENU_MAX_SECTIONS}. */
export const VENUE_MENU_MAX_ITEMS_PER_SECTION = 100;

/**
 * The highest price a dish may carry, in centavos (ARS 1.000.000).
 *
 * Present because the field is an integer of centavos typed by a person: the
 * difference between a plausible price and one that came from a slipped decimal
 * point is three orders of magnitude, and there is no other check between the
 * keyboard and the public page.
 */
export const VENUE_MENU_MAX_ITEM_PRICE_CENTS = 100_000_000;

// ----------------------------------------------------------------------------
// Menu file (the photo / PDF alternative)
// ----------------------------------------------------------------------------

/**
 * What kind of file the venue uploaded as its menu.
 *
 * Declared here rather than in `enums/` for the same reason
 * {@link VenueMediaStateSchema} is: it describes one column of one
 * vertical and has no cross-entity consumer.
 *
 * @see packages/db/src/schemas/venue/venue.dbschema.ts
 */
export const VenueMenuFileKindSchema = z.enum(['image', 'pdf'], {
    message: 'zodError.venue.menuFileKind.invalid'
});
export type VenueMenuFileKind = z.infer<typeof VenueMenuFileKindSchema>;

/**
 * The uploaded menu file as the API reports it, or `null` when the venue has
 * not uploaded one.
 *
 * `url` and `kind` are ONE object rather than two sibling fields precisely so
 * that "half an attachment" — a URL whose kind is unknown, which the public
 * page could not decide how to render — is unrepresentable.
 */
export const VenueMenuFileSchema = z.object({
    /** Public delivery URL of the photo or PDF. */
    url: mediaAssetUrl('zodError.venue.menuFileUrl.invalid'),
    /** Whether {@link url} points at an image or at a PDF. */
    kind: VenueMenuFileKindSchema
});
export type VenueMenuFile = z.infer<typeof VenueMenuFileSchema>;

// ----------------------------------------------------------------------------
// Stored rows
// ----------------------------------------------------------------------------

/**
 * The two audit-author columns every table in this repo carries, spelled once.
 *
 * They are part of the STORED row and deliberately absent from the read
 * projections below: a diner reading a menu has no business learning the UUID
 * of the staff member who last touched it. Same public/stored split
 * `GastronomyFaqPublicSchema` makes.
 */
const MenuAuthorFields = {
    /** User who created the row; `null` once that user is deleted. */
    createdById: z.string().uuid().nullish(),
    /** User who last updated the row; `null` once that user is deleted. */
    updatedById: z.string().uuid().nullish()
} as const;

/** One dish or drink, as stored. */
export const VenueMenuItemSchema = z.object({
    /** Menu item ID (UUID). */
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    /** The section this dish belongs to. */
    sectionId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    /** The listing this dish belongs to (denormalized — see the db schema). */
    venueId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    /** Name of the dish or drink. */
    name: z.string().min(1).max(150),
    /** Optional description. */
    description: z.string().max(500).nullable(),
    /**
     * Localized name (HOS-1043), or `null` when the dish has never been
     * translated. `name` remains the `es` fallback source; read paths resolve
     * this via `resolveI18nText` with `name` as the fallback. Additive/nullish,
     * gated at write and at public read — see the module docblock.
     */
    nameI18n: i18nText({ min: 1, max: 150 }).nullish(),
    /**
     * Localized description (HOS-1043), or `null`. Same fallback rule as
     * {@link VenueMenuItemSchema.nameI18n}, with `description` as the
     * `es` source. `min: 0` because the legacy field itself has no minimum —
     * "a consultar" applies to price, not to prose.
     */
    descriptionI18n: i18nText({ min: 0, max: 500 }).nullish(),
    /** Price in centavos, or `null` for "a consultar". */
    priceCents: z.number().int().min(0).max(VENUE_MENU_MAX_ITEM_PRICE_CENTS).nullable(),
    /** Whether the dish is currently on offer. */
    isAvailable: z.boolean(),
    /**
     * Delivery URL of the dish's photo, or `null` (HOS-1045).
     *
     * Three FLAT fields rather than one nested `photo` object, unlike
     * {@link VenueMenuFileSchema} next door — and the difference is not an
     * oversight. That schema is nested because a URL whose `kind` is unknown is
     * a half-attachment the renderer cannot decide how to draw. Here the only
     * load-bearing field is the URL: `alt` degrades to the dish's own name and
     * `publicId` is never rendered at all, so there is no half-value to make
     * unrepresentable. What flat fields buy instead is that this schema stays a
     * faithful mirror of the COLUMNS — it is the type `GastronomyMenuItemModel`
     * is parameterised by, and a nested object here would force a mapping layer
     * between every row read and every row written.
     *
     * Validated with a bare `z.string()`, not {@link mediaAssetUrl}: this is
     * the STORED shape, and a legacy row must be readable, not rejected. The
     * scheme allowlist lives on the INPUT schema (the write gate) and again at
     * render time via `resolveSafeExternalUrl` — the same two-sided layering
     * `menuFileUrl` uses.
     */
    photoUrl: z.string().nullable(),
    /** Cloudinary `public_id` of that asset, or `null`. Never published. */
    photoPublicId: z.string().nullable(),
    /** Alt text for the photo, or `null` (falls back to the dish's name). */
    photoAlt: z.string().nullable(),
    /** Position within its section. */
    displayOrder: z.number().int().min(0),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    ...MenuAuthorFields
});
export type VenueMenuItem = z.infer<typeof VenueMenuItemSchema>;

/**
 * A dish as a reader sees it — the stored row minus its audit authors and
 * minus the photo's Cloudinary id.
 *
 * `photoPublicId` is omitted DELIBERATELY, not by inheritance: a derived
 * schema accepts everything it does not name, so every field added to the base
 * lands on the public page unless a decision is taken here. This one is an
 * internal handle for destroying the asset; the diner needs the URL and
 * nothing else, and publishing the id would put a Cloudinary write handle in
 * the page source for no reader benefit.
 */
export const VenueMenuItemPublicSchema = VenueMenuItemSchema.omit({
    createdById: true,
    updatedById: true,
    photoPublicId: true
});
export type VenueMenuItemPublic = z.infer<typeof VenueMenuItemPublicSchema>;

/** One course heading, as stored, with its dishes. */
export const VenueMenuSectionSchema = z.object({
    /** Menu section ID (UUID). */
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    /** The listing this section belongs to. */
    venueId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    /** Heading of the course. */
    name: z.string().min(1).max(120),
    /** Optional blurb under the heading. */
    description: z.string().max(500).nullable(),
    /**
     * Localized heading (HOS-1043), or `null`. `name` remains the `es`
     * fallback source. Additive/nullish, gated at write and at public read —
     * see the module docblock.
     */
    nameI18n: i18nText({ min: 1, max: 120 }).nullish(),
    /**
     * Localized blurb (HOS-1043), or `null`. `description` remains the `es`
     * fallback source.
     */
    descriptionI18n: i18nText({ min: 0, max: 500 }).nullish(),
    /** Position within the menu. */
    displayOrder: z.number().int().min(0),
    /**
     * The dishes, already ordered by `displayOrder`.
     *
     * `.default([])` because this schema doubles as the row type the model is
     * parameterised by, and a `venue_menu_sections` ROW has no `items`
     * column — the array is assembled by `getVenueMenu`.
     */
    items: z.array(VenueMenuItemSchema).default([]),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    ...MenuAuthorFields
});
export type VenueMenuSection = z.infer<typeof VenueMenuSectionSchema>;

/** A course as a reader sees it — the stored row minus its audit authors. */
export const VenueMenuSectionPublicSchema = VenueMenuSectionSchema.omit({
    createdById: true,
    updatedById: true,
    items: true
}).extend({
    items: z.array(VenueMenuItemPublicSchema)
});
export type VenueMenuSectionPublic = z.infer<typeof VenueMenuSectionPublicSchema>;

// ----------------------------------------------------------------------------
// Write payload
// ----------------------------------------------------------------------------

/**
 * A dish as the owner submits it.
 *
 * Carries NO id. The carta is written as a whole document (see
 * {@link VenueMenuReplacePayloadSchema}), so an id supplied by the client
 * would be an id the server has to either trust or ignore — and trusting one
 * is how a caller writes a dish into somebody else's listing.
 */
export const VenueMenuItemInputSchema = z.object({
    /** Name of the dish or drink. */
    name: z
        .string()
        .trim()
        .min(1, { message: 'zodError.venue.menuItem.name.min' })
        .max(150, { message: 'zodError.venue.menuItem.name.max' }),
    /** Optional description. Empty string and `null` both mean "none". */
    description: z
        .string()
        .trim()
        .max(500, { message: 'zodError.venue.menuItem.description.max' })
        .nullish(),
    /**
     * Localized name (HOS-1043), or `null`/omitted to leave the dish untranslated.
     * Whether the caller's PLAN allows submitting one at all is an ENTITLEMENT
     * (`MULTILINGUAL_VENUE_MENU`) checked at the route
     * (`menuPayloadCarriesTranslations`), the same permission/entitlement split
     * `photoUrl` above documents.
     */
    nameI18n: i18nText({ min: 1, max: 150 }).nullish(),
    /** Localized description (HOS-1043), or `null`/omitted. Same gate as {@link nameI18n}. */
    descriptionI18n: i18nText({ min: 0, max: 500 }).nullish(),
    /**
     * Price in CENTAVOS — never pesos, and never a float. `null` (or omitted)
     * is the honest value for "según pesca" / "a consultar", which is why the
     * field is nullable rather than defaulted to zero: a zero would publish the
     * dish as free.
     */
    priceCents: z
        .number()
        .int({ message: 'zodError.venue.menuItem.priceCents.int' })
        .min(0, { message: 'zodError.venue.menuItem.priceCents.min' })
        .max(VENUE_MENU_MAX_ITEM_PRICE_CENTS, {
            message: 'zodError.venue.menuItem.priceCents.max'
        })
        .nullish(),
    /** Whether the dish is on offer. Defaults to `true`. */
    isAvailable: z.boolean().default(true),
    /**
     * Delivery URL of the dish's photo (HOS-1045), as returned by
     * `POST .../menu-item-photo`. `null`/omitted removes it.
     *
     * {@link mediaAssetUrl} and NOT `z.string().url()`: the latter accepts
     * `javascript:`, `data:` and `vbscript:`, and this value becomes an
     * `<img src>` on a public page. This is the write gate; the read side
     * gets a second one at render.
     *
     * Accepting it from the body is safe in a way `menuFileUrl` was not (see
     * `VenueMenuManager`'s scheme-gate note): the value is only ever a URL
     * to render, it is scheme-checked here, and the ENTITLEMENT for having a
     * dish photo at all is enforced by the route before this parses.
     */
    photoUrl: mediaAssetUrl('zodError.venue.menuItemPhoto.url.invalid').nullish(),
    /**
     * Cloudinary `public_id` of that asset, round-tripped by the client so a
     * later cleanup can destroy it rather than merely forget it.
     */
    photoPublicId: z
        .string()
        .trim()
        .max(255, { message: 'zodError.venue.menuItemPhoto.publicId.max' })
        .nullish(),
    /**
     * Alt text. Optional, and its absence is not an accessibility hole — the
     * public renderer falls back to the dish's own name, which is required.
     */
    photoAlt: z
        .string()
        .trim()
        .max(200, { message: 'zodError.venue.menuItemPhoto.alt.max' })
        .nullish()
});
export type VenueMenuItemInput = z.input<typeof VenueMenuItemInputSchema>;

/**
 * Output of the per-dish photo upload route (HOS-1045).
 *
 * The route uploads the BYTES and returns them described; it does not write a
 * row, because at upload time the dish it belongs to may not exist yet (the
 * carta is saved as a whole document afterwards). That is the one place this
 * flow differs from `POST .../menu-file`, which can persist immediately
 * because its target is a column on the listing itself.
 */
export const VenueMenuItemPhotoUploadOutputSchema = z.object({
    /** Public delivery URL of the uploaded photo. */
    url: mediaAssetUrl('zodError.venue.menuItemPhoto.url.invalid'),
    /** Cloudinary `public_id`, for the client to round-trip into the document. */
    publicId: z.string()
});
export type VenueMenuItemPhotoUploadOutput = z.infer<typeof VenueMenuItemPhotoUploadOutputSchema>;

/** A course heading as the owner submits it. See {@link VenueMenuItemInputSchema}. */
export const VenueMenuSectionInputSchema = z.object({
    /** Heading of the course. */
    name: z
        .string()
        .trim()
        .min(1, { message: 'zodError.venue.menuSection.name.min' })
        .max(120, { message: 'zodError.venue.menuSection.name.max' }),
    /** Optional blurb under the heading. */
    description: z
        .string()
        .trim()
        .max(500, { message: 'zodError.venue.menuSection.description.max' })
        .nullish(),
    /**
     * Localized heading (HOS-1043), or `null`/omitted. See
     * {@link VenueMenuItemInputSchema.nameI18n} for the entitlement gate.
     */
    nameI18n: i18nText({ min: 1, max: 120 }).nullish(),
    /** Localized blurb (HOS-1043), or `null`/omitted. Same gate as `nameI18n`. */
    descriptionI18n: i18nText({ min: 0, max: 500 }).nullish(),
    /**
     * The dishes, in the order they should appear. May be EMPTY: an owner
     * building the carta over several sittings types the headings first, and
     * refusing to save that would mean the half-built menu is lost on reload.
     */
    items: z
        .array(VenueMenuItemInputSchema)
        .max(VENUE_MENU_MAX_ITEMS_PER_SECTION, {
            message: 'zodError.venue.menuSection.items.max'
        })
        .default([])
});
export type VenueMenuSectionInput = z.input<typeof VenueMenuSectionInputSchema>;

/**
 * The whole carta, submitted as ONE document (`PUT .../menu`).
 *
 * ## Why replace-the-document rather than per-row endpoints
 *
 * `venue_media` deliberately went the other way — a route per photo
 * operation — and the reason it gives is specific: an uploaded photo is a
 * Cloudinary asset that is BILLED from the moment it lands, so an owner who
 * uploads and leaves without saving has already cost money. That argument does
 * not reach the carta, whose sections and dishes are text: nothing is created
 * outside the database, so nothing can be orphaned by a save that never
 * happens.
 *
 * What the carta has instead is the opposite property — it is edited as a
 * whole. Renaming a course, dragging a dish into it and deleting two others is
 * ONE thought and, submitted as a document, ONE transaction. Split across
 * per-row routes it becomes four requests that can half-succeed, leaving a
 * published menu in a state the owner never described.
 *
 * The attachment, being a real uploaded asset, keeps the media table's
 * behaviour: it is persisted by its own upload route in the same request that
 * stores the file, and is NOT part of this payload.
 */
export const VenueMenuReplacePayloadSchema = z.object({
    /**
     * The sections, in order. An EMPTY array is a legitimate submission and
     * means "delete the carta" — the owner who fell back to a photo needs a way
     * to take the typed version down.
     */
    sections: z
        .array(VenueMenuSectionInputSchema)
        .max(VENUE_MENU_MAX_SECTIONS, {
            message: 'zodError.venue.menu.sections.max'
        })
        .default([])
});
export type VenueMenuReplacePayload = z.input<typeof VenueMenuReplacePayloadSchema>;

// ----------------------------------------------------------------------------
// Service input / output
// ----------------------------------------------------------------------------

/** Service input for reading a listing's carta. */
export const VenueMenuGetInputSchema = z.object({
    venueId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
});
export type VenueMenuGetInput = z.infer<typeof VenueMenuGetInputSchema>;

/** Service input for replacing a listing's carta. */
export const VenueMenuReplaceInputSchema = z.object({
    venueId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    menu: VenueMenuReplacePayloadSchema
});
export type VenueMenuReplaceInput = z.input<typeof VenueMenuReplaceInputSchema>;

/**
 * What a menu read answers with.
 *
 * The three shapes travel TOGETHER on purpose. A consumer deciding what to
 * render has to know about all of them at once — a venue with an empty
 * `sections` array and a `file` is not a venue without a menu — and shipping
 * them in one payload is what stops a caller from asking for the sections,
 * finding none, and concluding there is nothing to show.
 */
export const VenueMenuOutputSchema = z.object({
    /** The structured carta, ordered. Empty when the venue typed none. */
    sections: z.array(VenueMenuSectionPublicSchema),
    /** The uploaded photo or PDF, or `null`. */
    file: VenueMenuFileSchema.nullable(),
    /** The external link (`gastronomies.menu_url`), or `null`. */
    externalUrl: z.string().url().nullable()
});
export type VenueMenuOutput = z.infer<typeof VenueMenuOutputSchema>;

/** Output of the menu-file upload route. */
export const VenueMenuFileUploadOutputSchema = z.object({
    file: VenueMenuFileSchema
});
export type VenueMenuFileUploadOutput = z.infer<typeof VenueMenuFileUploadOutputSchema>;
