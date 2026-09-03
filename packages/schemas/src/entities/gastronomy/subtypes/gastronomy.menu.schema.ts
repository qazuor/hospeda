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
 * | Structured carta | `gastronomy_menu_sections` + `gastronomy_menu_items` | the venue willing to type its dishes |
 * | Uploaded photo / PDF | `gastronomies.menu_file_url` + `menu_file_kind` | the venue that has the menu as an image |
 * | External link | `gastronomies.menu_url` (pre-existing) | the venue that already publishes one |
 *
 * All three may be set at once and **none is required**. Nobody is made to load
 * forty items to be allowed to publish.
 *
 * @module entities/gastronomy/subtypes/gastronomy.menu.schema
 */
import { z } from 'zod';
import { mediaAssetUrl } from '../../../common/media.schema.js';

// ----------------------------------------------------------------------------
// Limits
// ----------------------------------------------------------------------------

/**
 * How many sections one carta may hold.
 *
 * A ceiling, not a product tier: the tier decision (`gastronomy-pro` and above
 * may edit a structured carta at all) is an ENTITLEMENT, checked at the route.
 * This number exists so a single PUT cannot be used to write an unbounded
 * number of rows in one transaction.
 */
export const GASTRONOMY_MENU_MAX_SECTIONS = 30;

/** How many dishes one section may hold. See {@link GASTRONOMY_MENU_MAX_SECTIONS}. */
export const GASTRONOMY_MENU_MAX_ITEMS_PER_SECTION = 100;

/**
 * The highest price a dish may carry, in centavos (ARS 1.000.000).
 *
 * Present because the field is an integer of centavos typed by a person: the
 * difference between a plausible price and one that came from a slipped decimal
 * point is three orders of magnitude, and there is no other check between the
 * keyboard and the public page.
 */
export const GASTRONOMY_MENU_MAX_ITEM_PRICE_CENTS = 100_000_000;

// ----------------------------------------------------------------------------
// Menu file (the photo / PDF alternative)
// ----------------------------------------------------------------------------

/**
 * What kind of file the venue uploaded as its menu.
 *
 * Declared here rather than in `enums/` for the same reason
 * {@link GastronomyMediaStateSchema} is: it describes one column of one
 * vertical and has no cross-entity consumer.
 *
 * @see packages/db/src/schemas/gastronomy/gastronomy.dbschema.ts
 */
export const GastronomyMenuFileKindSchema = z.enum(['image', 'pdf'], {
    message: 'zodError.gastronomy.menuFileKind.invalid'
});
export type GastronomyMenuFileKind = z.infer<typeof GastronomyMenuFileKindSchema>;

/**
 * The uploaded menu file as the API reports it, or `null` when the venue has
 * not uploaded one.
 *
 * `url` and `kind` are ONE object rather than two sibling fields precisely so
 * that "half an attachment" — a URL whose kind is unknown, which the public
 * page could not decide how to render — is unrepresentable.
 */
export const GastronomyMenuFileSchema = z.object({
    /** Public delivery URL of the photo or PDF. */
    url: mediaAssetUrl('zodError.gastronomy.menuFileUrl.invalid'),
    /** Whether {@link url} points at an image or at a PDF. */
    kind: GastronomyMenuFileKindSchema
});
export type GastronomyMenuFile = z.infer<typeof GastronomyMenuFileSchema>;

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
export const GastronomyMenuItemSchema = z.object({
    /** Menu item ID (UUID). */
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    /** The section this dish belongs to. */
    sectionId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    /** The listing this dish belongs to (denormalized — see the db schema). */
    gastronomyId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    /** Name of the dish or drink. */
    name: z.string().min(1).max(150),
    /** Optional description. */
    description: z.string().max(500).nullable(),
    /** Price in centavos, or `null` for "a consultar". */
    priceCents: z.number().int().min(0).max(GASTRONOMY_MENU_MAX_ITEM_PRICE_CENTS).nullable(),
    /** Whether the dish is currently on offer. */
    isAvailable: z.boolean(),
    /**
     * Delivery URL of the dish's photo, or `null` (HOS-1045).
     *
     * Three FLAT fields rather than one nested `photo` object, unlike
     * {@link GastronomyMenuFileSchema} next door — and the difference is not an
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
export type GastronomyMenuItem = z.infer<typeof GastronomyMenuItemSchema>;

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
export const GastronomyMenuItemPublicSchema = GastronomyMenuItemSchema.omit({
    createdById: true,
    updatedById: true,
    photoPublicId: true
});
export type GastronomyMenuItemPublic = z.infer<typeof GastronomyMenuItemPublicSchema>;

/** One course heading, as stored, with its dishes. */
export const GastronomyMenuSectionSchema = z.object({
    /** Menu section ID (UUID). */
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    /** The listing this section belongs to. */
    gastronomyId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    /** Heading of the course. */
    name: z.string().min(1).max(120),
    /** Optional blurb under the heading. */
    description: z.string().max(500).nullable(),
    /** Position within the menu. */
    displayOrder: z.number().int().min(0),
    /**
     * The dishes, already ordered by `displayOrder`.
     *
     * `.default([])` because this schema doubles as the row type the model is
     * parameterised by, and a `gastronomy_menu_sections` ROW has no `items`
     * column — the array is assembled by `getGastronomyMenu`.
     */
    items: z.array(GastronomyMenuItemSchema).default([]),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    ...MenuAuthorFields
});
export type GastronomyMenuSection = z.infer<typeof GastronomyMenuSectionSchema>;

/** A course as a reader sees it — the stored row minus its audit authors. */
export const GastronomyMenuSectionPublicSchema = GastronomyMenuSectionSchema.omit({
    createdById: true,
    updatedById: true,
    items: true
}).extend({
    items: z.array(GastronomyMenuItemPublicSchema)
});
export type GastronomyMenuSectionPublic = z.infer<typeof GastronomyMenuSectionPublicSchema>;

// ----------------------------------------------------------------------------
// Write payload
// ----------------------------------------------------------------------------

/**
 * A dish as the owner submits it.
 *
 * Carries NO id. The carta is written as a whole document (see
 * {@link GastronomyMenuReplacePayloadSchema}), so an id supplied by the client
 * would be an id the server has to either trust or ignore — and trusting one
 * is how a caller writes a dish into somebody else's listing.
 */
export const GastronomyMenuItemInputSchema = z.object({
    /** Name of the dish or drink. */
    name: z
        .string()
        .trim()
        .min(1, { message: 'zodError.gastronomy.menuItem.name.min' })
        .max(150, { message: 'zodError.gastronomy.menuItem.name.max' }),
    /** Optional description. Empty string and `null` both mean "none". */
    description: z
        .string()
        .trim()
        .max(500, { message: 'zodError.gastronomy.menuItem.description.max' })
        .nullish(),
    /**
     * Price in CENTAVOS — never pesos, and never a float. `null` (or omitted)
     * is the honest value for "según pesca" / "a consultar", which is why the
     * field is nullable rather than defaulted to zero: a zero would publish the
     * dish as free.
     */
    priceCents: z
        .number()
        .int({ message: 'zodError.gastronomy.menuItem.priceCents.int' })
        .min(0, { message: 'zodError.gastronomy.menuItem.priceCents.min' })
        .max(GASTRONOMY_MENU_MAX_ITEM_PRICE_CENTS, {
            message: 'zodError.gastronomy.menuItem.priceCents.max'
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
     * `CommerceMenuManager`'s scheme-gate note): the value is only ever a URL
     * to render, it is scheme-checked here, and the ENTITLEMENT for having a
     * dish photo at all is enforced by the route before this parses.
     */
    photoUrl: mediaAssetUrl('zodError.gastronomy.menuItemPhoto.url.invalid').nullish(),
    /**
     * Cloudinary `public_id` of that asset, round-tripped by the client so a
     * later cleanup can destroy it rather than merely forget it.
     */
    photoPublicId: z
        .string()
        .trim()
        .max(255, { message: 'zodError.gastronomy.menuItemPhoto.publicId.max' })
        .nullish(),
    /**
     * Alt text. Optional, and its absence is not an accessibility hole — the
     * public renderer falls back to the dish's own name, which is required.
     */
    photoAlt: z
        .string()
        .trim()
        .max(200, { message: 'zodError.gastronomy.menuItemPhoto.alt.max' })
        .nullish()
});
export type GastronomyMenuItemInput = z.input<typeof GastronomyMenuItemInputSchema>;

/**
 * Output of the per-dish photo upload route (HOS-1045).
 *
 * The route uploads the BYTES and returns them described; it does not write a
 * row, because at upload time the dish it belongs to may not exist yet (the
 * carta is saved as a whole document afterwards). That is the one place this
 * flow differs from `POST .../menu-file`, which can persist immediately
 * because its target is a column on the listing itself.
 */
export const GastronomyMenuItemPhotoUploadOutputSchema = z.object({
    /** Public delivery URL of the uploaded photo. */
    url: mediaAssetUrl('zodError.gastronomy.menuItemPhoto.url.invalid'),
    /** Cloudinary `public_id`, for the client to round-trip into the document. */
    publicId: z.string()
});
export type GastronomyMenuItemPhotoUploadOutput = z.infer<
    typeof GastronomyMenuItemPhotoUploadOutputSchema
>;

/** A course heading as the owner submits it. See {@link GastronomyMenuItemInputSchema}. */
export const GastronomyMenuSectionInputSchema = z.object({
    /** Heading of the course. */
    name: z
        .string()
        .trim()
        .min(1, { message: 'zodError.gastronomy.menuSection.name.min' })
        .max(120, { message: 'zodError.gastronomy.menuSection.name.max' }),
    /** Optional blurb under the heading. */
    description: z
        .string()
        .trim()
        .max(500, { message: 'zodError.gastronomy.menuSection.description.max' })
        .nullish(),
    /**
     * The dishes, in the order they should appear. May be EMPTY: an owner
     * building the carta over several sittings types the headings first, and
     * refusing to save that would mean the half-built menu is lost on reload.
     */
    items: z
        .array(GastronomyMenuItemInputSchema)
        .max(GASTRONOMY_MENU_MAX_ITEMS_PER_SECTION, {
            message: 'zodError.gastronomy.menuSection.items.max'
        })
        .default([])
});
export type GastronomyMenuSectionInput = z.input<typeof GastronomyMenuSectionInputSchema>;

/**
 * The whole carta, submitted as ONE document (`PUT .../menu`).
 *
 * ## Why replace-the-document rather than per-row endpoints
 *
 * `gastronomy_media` deliberately went the other way — a route per photo
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
export const GastronomyMenuReplacePayloadSchema = z.object({
    /**
     * The sections, in order. An EMPTY array is a legitimate submission and
     * means "delete the carta" — the owner who fell back to a photo needs a way
     * to take the typed version down.
     */
    sections: z
        .array(GastronomyMenuSectionInputSchema)
        .max(GASTRONOMY_MENU_MAX_SECTIONS, {
            message: 'zodError.gastronomy.menu.sections.max'
        })
        .default([])
});
export type GastronomyMenuReplacePayload = z.input<typeof GastronomyMenuReplacePayloadSchema>;

// ----------------------------------------------------------------------------
// Service input / output
// ----------------------------------------------------------------------------

/** Service input for reading a listing's carta. */
export const GastronomyMenuGetInputSchema = z.object({
    gastronomyId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
});
export type GastronomyMenuGetInput = z.infer<typeof GastronomyMenuGetInputSchema>;

/** Service input for replacing a listing's carta. */
export const GastronomyMenuReplaceInputSchema = z.object({
    gastronomyId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    menu: GastronomyMenuReplacePayloadSchema
});
export type GastronomyMenuReplaceInput = z.input<typeof GastronomyMenuReplaceInputSchema>;

/**
 * What a menu read answers with.
 *
 * The three shapes travel TOGETHER on purpose. A consumer deciding what to
 * render has to know about all of them at once — a venue with an empty
 * `sections` array and a `file` is not a venue without a menu — and shipping
 * them in one payload is what stops a caller from asking for the sections,
 * finding none, and concluding there is nothing to show.
 */
export const GastronomyMenuOutputSchema = z.object({
    /** The structured carta, ordered. Empty when the venue typed none. */
    sections: z.array(GastronomyMenuSectionPublicSchema),
    /** The uploaded photo or PDF, or `null`. */
    file: GastronomyMenuFileSchema.nullable(),
    /** The external link (`gastronomies.menu_url`), or `null`. */
    externalUrl: z.string().url().nullable()
});
export type GastronomyMenuOutput = z.infer<typeof GastronomyMenuOutputSchema>;

/** Output of the menu-file upload route. */
export const GastronomyMenuFileUploadOutputSchema = z.object({
    file: GastronomyMenuFileSchema
});
export type GastronomyMenuFileUploadOutput = z.infer<typeof GastronomyMenuFileUploadOutputSchema>;
