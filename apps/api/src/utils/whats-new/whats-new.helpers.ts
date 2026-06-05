/**
 * @module utils/whats-new/whats-new.helpers
 *
 * Pure server-side helper functions for the What's New feature.
 *
 * These functions have no Hono or DB imports — they are purely computational
 * and can be unit-tested in isolation without any app setup.
 *
 * @see SPEC-175 §6.5, §6.7, §12.5
 */
import type { WhatsNewAudienceRole, WhatsNewEntry, WhatsNewEntryI18n } from '@repo/schemas';

// ---------------------------------------------------------------------------
// Role filtering
// ---------------------------------------------------------------------------

/**
 * Input for {@link filterEntriesByRole}.
 */
export interface FilterEntriesByRoleInput {
    /** Full catalog of curated entries. */
    readonly entries: readonly WhatsNewEntry[];
    /**
     * The actor's role for audience targeting.
     * `undefined` / `null` means unauthenticated — returns nothing.
     */
    readonly role: WhatsNewAudienceRole | string | null | undefined;
}

/**
 * Filters a catalog of What's New entries to only those applicable to the
 * given role.
 *
 * Audience-targeting rules (per SPEC-175 §6.4, D4):
 * - An entry with an absent or empty `roles` array is visible to **all** roles.
 * - An entry with a non-empty `roles` array is visible only to roles in that list.
 * - This is content routing, NOT authorization — the endpoint already requires
 *   an authenticated session; `roles` merely controls what each user sees.
 *
 * @param input - `{ entries, role }`
 * @returns Filtered array of entries applicable to the given role.
 *
 * @example
 * ```ts
 * filterEntriesByRole({ entries, role: 'HOST' })
 * // returns entries where roles is absent/empty OR includes 'HOST'
 * ```
 */
export function filterEntriesByRole({ entries, role }: FilterEntriesByRoleInput): WhatsNewEntry[] {
    if (!role) return [];

    return entries.filter((entry) => {
        // Absent or empty roles = universal broadcast
        if (!entry.roles || entry.roles.length === 0) return true;
        return entry.roles.includes(role as WhatsNewAudienceRole);
    });
}

// ---------------------------------------------------------------------------
// Seen computation
// ---------------------------------------------------------------------------

/**
 * Input for {@link computeSeen}.
 */
export interface ComputeSeenInput {
    /** The entry to evaluate. */
    readonly entry: Pick<WhatsNewEntry, 'id' | 'publishedAt'>;
    /**
     * The set of entry ids already explicitly seen by the user.
     * Defaults to an empty array when absent.
     */
    readonly seenIds: readonly string[];
    /**
     * ISO 8601 datetime string — entries published at or before this point
     * are automatically treated as seen (prevents flooding pre-existing users
     * on feature deploy). Required for baseline comparison.
     */
    readonly baselineAt: string;
}

/**
 * Determines whether a single What's New entry has been seen by a user.
 *
 * An entry is considered **seen** when either of these conditions holds:
 * 1. The entry's `id` is in `seenIds` (explicit mark-seen via the PATCH endpoint).
 * 2. The entry's `publishedAt` is **less than or equal to** `baselineAt`
 *    (entries predating the user's first GET are auto-seen to prevent flooding).
 *
 * Date comparison uses `Date` objects rather than raw ISO string comparison to
 * avoid locale or format ordering surprises (e.g. different precision, trailing Z).
 * Both values must be valid ISO 8601 datetime strings as enforced by
 * `WhatsNewEntrySchema` and the settings schema.
 *
 * @param input - `{ entry, seenIds, baselineAt }`
 * @returns `true` when the entry is seen; `false` otherwise.
 *
 * @example
 * ```ts
 * computeSeen({
 *   entry: { id: 'x', publishedAt: '2026-01-01T00:00:00Z' },
 *   seenIds: [],
 *   baselineAt: '2026-05-01T00:00:00Z'
 * }) // true — publishedAt <= baselineAt
 *
 * computeSeen({
 *   entry: { id: 'y', publishedAt: '2026-06-01T00:00:00Z' },
 *   seenIds: [],
 *   baselineAt: '2026-05-01T00:00:00Z'
 * }) // false — publishedAt > baselineAt and id not in seenIds
 *
 * computeSeen({
 *   entry: { id: 'y', publishedAt: '2026-06-01T00:00:00Z' },
 *   seenIds: ['y'],
 *   baselineAt: '2026-05-01T00:00:00Z'
 * }) // true — id in seenIds
 * ```
 */
export function computeSeen({ entry, seenIds, baselineAt }: ComputeSeenInput): boolean {
    if (seenIds.includes(entry.id)) return true;

    const publishedMs = new Date(entry.publishedAt).getTime();
    const baselineMs = new Date(baselineAt).getTime();
    // entries published at exactly the baseline moment are also auto-seen
    return publishedMs <= baselineMs;
}

// ---------------------------------------------------------------------------
// Locale resolution
// ---------------------------------------------------------------------------

/**
 * Input for {@link resolveEntryLocale}.
 */
export interface ResolveEntryLocaleInput {
    /**
     * The i18n field object from a What's New entry.
     * `es` is always present (required by schema); `en` and `pt` are optional.
     */
    readonly field: WhatsNewEntryI18n;
    /**
     * The requested locale (e.g. from `actor.settings.languageAdmin`).
     * Falls back to `'es'` when the requested locale is absent from the entry.
     */
    readonly locale: string | null | undefined;
}

/**
 * Resolves a single locale string from an i18n field.
 *
 * Resolution order:
 * 1. Requested locale (`en` or `pt`) — when present in the field.
 * 2. `'es'` (project default locale) — when the requested locale is absent or
 *    the field has no value for it. The `es` key is required by `WhatsNewEntryI18nSchema`
 *    so this fallback always produces a non-empty string.
 *
 * The returned value is **never** empty or undefined.
 *
 * @param input - `{ field, locale }`
 * @returns A non-empty locale-resolved string.
 *
 * @example
 * ```ts
 * resolveEntryLocale({ field: { es: 'Título', en: 'Title' }, locale: 'en' })
 * // 'Title'
 *
 * resolveEntryLocale({ field: { es: 'Título' }, locale: 'en' })
 * // 'Título' — en absent, fallback to es
 *
 * resolveEntryLocale({ field: { es: 'Título', pt: 'Título PT' }, locale: 'pt' })
 * // 'Título PT'
 *
 * resolveEntryLocale({ field: { es: 'Título' }, locale: 'pt' })
 * // 'Título' — pt absent, fallback to es
 *
 * resolveEntryLocale({ field: { es: 'Título' }, locale: null })
 * // 'Título' — null locale, fallback to es
 * ```
 */
export function resolveEntryLocale({ field, locale }: ResolveEntryLocaleInput): string {
    if (locale === 'en' && field.en) return field.en;
    if (locale === 'pt' && field.pt) return field.pt;
    // Default: es (always present by schema)
    return field.es;
}
