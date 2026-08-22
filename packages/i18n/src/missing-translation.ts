/**
 * Canonical "is this translation absent from the catalog?" predicate.
 *
 * Every `t()` implementation in the monorepo has the signature
 * `(key, ...) => string`: none of them can report absence structurally by
 * returning `undefined`, because their return value is rendered directly into
 * the UI and must always be a string. Absence is therefore encoded IN the
 * returned string, and the two live implementations encode it differently:
 *
 * - `packages/i18n/src/hooks/use-translations.ts` (`useTranslations`) always
 *   returns the `[MISSING: <key>]` marker.
 * - `apps/web/src/lib/i18n.ts` (`resolve` / `createT` / `createTranslations`)
 *   returns that same marker ONLY under `import.meta.env.DEV`. In a production
 *   build it echoes the requested key back verbatim.
 *
 * Detecting absence by the marker alone is therefore correct in development and
 * silently wrong in production — the exact defect that made `pluralize()` render
 * a raw dotted key (`billing.limit.max_active_alerts.message_one`) to end users.
 *
 * The build-mode-independent signal is the one both implementations share: an
 * absent key yields a value that is either the marker or the requested key
 * itself. That is what this predicate tests, so callers behave identically in
 * dev and prod. The `[MISSING:` marker stays supported as a development aid, but
 * it is no longer the load-bearing mechanism.
 *
 * @see packages/i18n/src/pluralization.ts
 */

/**
 * Marker prefix emitted by translation functions for an absent key.
 *
 * Kept exported so producers of the marker and this predicate cannot drift
 * apart. Treat it as a development affordance, never as the sole way absence is
 * detected — production builds do not emit it.
 */
export const MISSING_TRANSLATION_MARKER = '[MISSING:';

/**
 * Decides whether a translation lookup failed to find the key in the catalog.
 *
 * A lookup counts as missing when the returned value is:
 * - `undefined`, `null`, or the empty string (no value at all), or
 * - prefixed with {@link MISSING_TRANSLATION_MARKER} (development builds), or
 * - strictly equal to the key that was requested (production builds, where the
 *   raw key is echoed back instead of the marker).
 *
 * The key-equality arm means a catalog entry whose value is literally identical
 * to its own dotted key is reported as missing. That is accepted: such an entry
 * is indistinguishable from an absent one at this boundary, and rendering it
 * would put a dotted key on screen either way.
 *
 * @param params - Object with the requested key and the value the lookup returned.
 * @param params.key - The exact key that was passed to the translation function.
 * @param params.value - The value the translation function returned for that key.
 * @returns `true` when the key has no usable translation, `false` otherwise.
 *
 * @example
 * ```ts
 * isMissingTranslation({ key: 'a.b', value: '[MISSING: a.b]' }); // true  (dev)
 * isMissingTranslation({ key: 'a.b', value: 'a.b' });            // true  (prod)
 * isMissingTranslation({ key: 'a.b', value: 'Hola' });           // false
 * ```
 */
export function isMissingTranslation({
    key,
    value
}: {
    readonly key: string;
    readonly value: string | null | undefined;
}): boolean {
    if (value === null || value === undefined || value === '') {
        return true;
    }

    if (value.startsWith(MISSING_TRANSLATION_MARKER)) {
        return true;
    }

    return value === key;
}
