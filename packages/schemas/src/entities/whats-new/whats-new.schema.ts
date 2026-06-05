import { z } from 'zod';

/**
 * Internationalisation shape for a What's New entry field.
 *
 * Spanish (`es`) is the project default locale and is **required**.
 * English and Portuguese are optional; the server falls back to `es`
 * when a requested locale is absent from the entry.
 */
export const WhatsNewEntryI18nSchema = z.object({
    /** Spanish text — required (project default locale). */
    es: z.string().min(1),
    /** English text — optional, falls back to `es` when absent. */
    en: z.string().optional(),
    /** Portuguese text — optional, falls back to `es` when absent. */
    pt: z.string().optional()
});

/** Inferred type for {@link WhatsNewEntryI18nSchema}. */
export type WhatsNewEntryI18n = z.infer<typeof WhatsNewEntryI18nSchema>;

/**
 * Audience roles for What's New entry targeting.
 *
 * This is the set of admin-facing roles that can receive a curated entry.
 * Absent/empty means ALL roles see the entry (universal broadcast).
 *
 * **Important**: this is audience targeting for content routing only — it is
 * NOT an authorization gate. The endpoint only requires an authenticated
 * session; `PermissionEnum` governs access. The `roles` field merely filters
 * which entries a given user sees in the response.
 */
export const WhatsNewAudienceRoleSchema = z.enum(['HOST', 'EDITOR', 'ADMIN', 'SUPER_ADMIN']);

/** Inferred type for {@link WhatsNewAudienceRoleSchema}. */
export type WhatsNewAudienceRole = z.infer<typeof WhatsNewAudienceRoleSchema>;

/**
 * Schema for a single curated What's New / release-notes entry.
 *
 * Entries are stored in a typed array in `apps/api/src/data/whats-new/whats-new.ts`
 * and validated at API boot time via `WhatsNewCatalogSchema.parse(...)`.
 * A malformed entry causes the API process to throw at startup and refuse to
 * serve traffic — content typos break startup, not production.
 *
 * @see {@link WhatsNewEntry} for the inferred TypeScript type.
 */
export const WhatsNewEntrySchema = z.object({
    /**
     * Stable string identifier for this entry, e.g. `'2026-05-29-cron-history'`.
     *
     * Must be kebab-case (lowercase alphanumerics and hyphens only).
     * **Never reuse a retired id** — `seenIds` stored in user settings may still
     * reference it; a collision would silently mark a new entry as already seen.
     */
    id: z
        .string()
        .min(1)
        .regex(/^[a-z0-9-]+$/, 'id must be kebab-case'),

    /**
     * ISO 8601 datetime string for when this entry was published.
     *
     * Used for:
     * - Sorting entries newest-first in the response.
     * - The `baselineAt` comparison: entries with `publishedAt <= baselineAt`
     *   are automatically treated as seen for that user (prevents flooding
     *   pre-existing users on feature deploy).
     */
    publishedAt: z.string().datetime(),

    /**
     * Optional audience targeting by role.
     *
     * When absent or empty, the entry is visible to ALL authenticated roles.
     * When present, only users whose role appears in this array will receive
     * the entry from `GET /api/v1/protected/whats-new`.
     *
     * **Reminder**: this is content routing, NOT an authorization gate.
     * The endpoint itself only requires a valid authenticated session.
     * Refer to {@link WhatsNewAudienceRoleSchema} for the allowed values.
     */
    roles: z.array(WhatsNewAudienceRoleSchema).optional(),

    /**
     * When `true`, the entry will auto-open the What's New modal once
     * if the user has not yet seen it.
     *
     * Default `false` — non-highlight entries only appear in the panel and
     * dashboard card; they do not trigger the modal automatically.
     */
    highlight: z.boolean().default(false),

    /**
     * Entry title, localised.
     *
     * Spanish (`es`) is required. English and Portuguese are optional and
     * fall back to `es` when absent.
     */
    title: WhatsNewEntryI18nSchema,

    /**
     * Entry body, localised.
     *
     * Written in **Markdown**. Spanish (`es`) is required.
     * Rendered in the admin via TipTap's sanitized read-only path
     * (`@tiptap/react` + `tiptap-markdown`) — no XSS risk.
     *
     * English and Portuguese are optional and fall back to `es` when absent.
     */
    body: WhatsNewEntryI18nSchema,

    /**
     * Optional image URL (CDN / external origin).
     *
     * When present, the origin of this URL **must** be added to the admin
     * Content Security Policy `img-src` directive before the entry is
     * published to production. See §9 of SPEC-175.
     *
     * TBD-2: The exact approved CDN origin is not yet decided — it must be
     * resolved before the first image-bearing entry goes live.
     */
    image: z.string().url().optional()
});

/** Inferred TypeScript type for a single What's New entry. */
export type WhatsNewEntry = z.infer<typeof WhatsNewEntrySchema>;
