import { z } from 'zod';

/**
 * Platform settings — Zod schemas (SPEC-156).
 *
 * Source of truth for the shape of every supported `platform_settings.key`
 * value, plus the discriminated union response the API returns.
 *
 * Storage: the DB column is a JSONB blob keyed by an opaque string. Validation
 * happens at the application boundary (route handlers + service writes) via the
 * discriminated union below — the DB never sees an invalid value because every
 * `upsert` goes through Zod first.
 *
 * **Compatibility (per packages/schemas/CLAUDE.md "additive-only" policy)**:
 * once a value schema ships, fields may only be added (as `.optional()`) or
 * widened. Renames/removals require the three-phase migration. The key enum is
 * append-only.
 */

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

/**
 * Supported `platform_settings.key` values. Append-only — never remove a key
 * without a migration plan, because stored rows would lose their type binding.
 */
export const PlatformSettingsKeySchema = z.enum([
    'seo.defaults',
    'maintenance.mode',
    'announcements.global'
]);

/** TypeScript type for the supported key set. */
export type PlatformSettingsKey = z.infer<typeof PlatformSettingsKeySchema>;

// ---------------------------------------------------------------------------
// `seo.defaults` value
// ---------------------------------------------------------------------------

/**
 * Value shape for `seo.defaults`. Mirrors the 3 fields previously stored in
 * the admin's `localStorage.SEO_SETTINGS_KEY` (per audit `04-settings.md`
 * §4.1) plus the SSR-time read by the web app.
 */
export const SeoDefaultsValueSchema = z.object({
    /** Meta `<title>` template. `%s` is replaced by the page-specific title. */
    metaTitleTemplate: z.string().min(1).max(255),
    /** Fallback `<meta name="description">` when a page does not set its own. */
    metaDescriptionDefault: z.string().min(1).max(500),
    /** Default Open Graph image URL. */
    ogImageDefault: z.string().url()
});

/** Inferred type for the `seo.defaults` value. */
export type SeoDefaultsValue = z.infer<typeof SeoDefaultsValueSchema>;

// ---------------------------------------------------------------------------
// `maintenance.mode` value
// ---------------------------------------------------------------------------

/**
 * Value shape for `maintenance.mode`. When `enabled` is true, the platform
 * shows a maintenance page to non-SUPER_ADMIN visitors.
 */
export const MaintenanceModeValueSchema = z.object({
    /** Whether maintenance mode is active. */
    enabled: z.boolean(),
    /** Optional message shown on the maintenance page (i18n upstream). */
    message: z.string().max(500).optional()
});

/** Inferred type for the `maintenance.mode` value. */
export type MaintenanceModeValue = z.infer<typeof MaintenanceModeValueSchema>;

// ---------------------------------------------------------------------------
// `announcements.global` value
// ---------------------------------------------------------------------------

/** Visual variant for a global announcement banner. */
export const AnnouncementVariantSchema = z.enum(['info', 'warning', 'danger']);

/** Visual variant for a global announcement banner. */
export type AnnouncementVariant = z.infer<typeof AnnouncementVariantSchema>;

/**
 * A single global announcement item. Stored as part of the
 * `announcements.global` array; rendered cross-device by web + admin via the
 * public endpoint `GET /api/v1/public/announcements`.
 */
export const AnnouncementItemSchema = z.object({
    /** Stable client-generated identifier (UUID) for editing/dismissing. */
    id: z.string().uuid(),
    /** Localized message text — all three locales required per `04 §8.2`. */
    text: z.object({
        es: z.string().min(1).max(1000),
        en: z.string().min(1).max(1000),
        pt: z.string().min(1).max(1000)
    }),
    /** Visual style. */
    variant: AnnouncementVariantSchema,
    /** Whether the user can dismiss this banner. */
    dismissible: z.boolean(),
    /** Optional start of the active window (ISO-8601). Absent = always-on. */
    startsAt: z.string().datetime({ offset: true }).optional(),
    /** Optional end of the active window (ISO-8601). Absent = no expiry. */
    endsAt: z.string().datetime({ offset: true }).optional()
});

/** Inferred type for a single announcement item. */
export type AnnouncementItem = z.infer<typeof AnnouncementItemSchema>;

/**
 * Value shape for `announcements.global`. An array of zero or more announcement
 * items. The public endpoint filters by date window server-side before
 * returning.
 */
export const AnnouncementsValueSchema = z.array(AnnouncementItemSchema);

/** Inferred type for the `announcements.global` value. */
export type AnnouncementsValue = z.infer<typeof AnnouncementsValueSchema>;

// ---------------------------------------------------------------------------
// Discriminated union response
// ---------------------------------------------------------------------------

/**
 * Response shape for `GET /api/v1/admin/platform-settings/:key`. Discriminated
 * by `key` so consumers (admin pages, hooks) get the correctly typed `value`
 * for the key requested. `updatedAt` is serialized as an ISO-8601 string at
 * the API boundary (DB stores `timestamptz`).
 */
export const PlatformSettingsResponseSchema = z.discriminatedUnion('key', [
    z.object({
        key: z.literal('seo.defaults'),
        value: SeoDefaultsValueSchema,
        updatedAt: z.string().datetime({ offset: true }),
        updatedBy: z.string().uuid()
    }),
    z.object({
        key: z.literal('maintenance.mode'),
        value: MaintenanceModeValueSchema,
        updatedAt: z.string().datetime({ offset: true }),
        updatedBy: z.string().uuid()
    }),
    z.object({
        key: z.literal('announcements.global'),
        value: AnnouncementsValueSchema,
        updatedAt: z.string().datetime({ offset: true }),
        updatedBy: z.string().uuid()
    })
]);

/** Inferred response type. */
export type PlatformSettingsResponse = z.infer<typeof PlatformSettingsResponseSchema>;
