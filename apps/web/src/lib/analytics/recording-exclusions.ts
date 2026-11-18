/**
 * Routes the Umami session recorder must never run on (HOS-2347 §6.5).
 *
 * ONE list. Each entry is a path below `/{lang}/`, and a guard test
 * (`test/lib/analytics/recording-exclusions.test.ts`) asserts that each one
 * maps to an existing directory under `src/pages/[lang]/`. So a renamed or
 * moved route fails CI instead of silently dropping out of the exclusion.
 *
 * `sumate` covers the whole family (partner, provider and sponsor sign-ups):
 * all three are free-text lead forms (HOS-2347 review decision, 2026-11-18).
 *
 * The two legacy per-vertical publish routes (`publicar-<vertical>`) are not
 * listed: both are permanent redirects to `publicar/*` and never render.
 */

/** Excluded route prefixes, relative to `/{lang}/`, without slashes. */
export const RECORDING_EXCLUDED_ROUTE_PREFIXES = [
    'auth',
    'mi-cuenta',
    'guest',
    'suscriptores/checkout',
    'publicar',
    'feedback',
    'colaborar',
    'contacto',
    'partners/reclamar',
    'sumate',
    'newsletter'
] as const;

/** One excluded route prefix. */
export type RecordingExcludedRoutePrefix = (typeof RECORDING_EXCLUDED_ROUTE_PREFIXES)[number];

const LOCALE_SEGMENT = /^\/(?:es|en|pt)(?=\/|$)/i;

/**
 * Whether the recorder must not run on `pathname`.
 *
 * Rules: an optional leading `/{es|en|pt}` segment is stripped, then the
 * leading and trailing slashes. A prefix matches when the rest equals it or
 * starts with `prefix + '/'`, so `publicar` matches `/es/publicar/nueva` but
 * not `/es/publicaciones/`. Case-insensitive; the query string and the hash
 * are ignored.
 *
 * @param input.pathname - A pathname, or a path that may carry `?query` / `#hash`
 * @returns `true` when the path is excluded from recording
 *
 * @example
 * ```ts
 * isRecordingExcludedPath({ pathname: '/es/auth/signin/' }); // true
 * isRecordingExcludedPath({ pathname: '/es/partners/foo/' }); // false
 * ```
 */
export function isRecordingExcludedPath(input: { readonly pathname: string }): boolean {
    const withoutSuffix = input.pathname.split(/[?#]/, 1)[0] ?? '';
    const rest = withoutSuffix
        .toLowerCase()
        .replace(LOCALE_SEGMENT, '')
        .replace(/^\/+|\/+$/g, '');
    return RECORDING_EXCLUDED_ROUTE_PREFIXES.some(
        (prefix) => rest === prefix || rest.startsWith(`${prefix}/`)
    );
}
