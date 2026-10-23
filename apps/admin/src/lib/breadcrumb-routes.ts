/**
 * Pure helpers that decide whether a pathname has a registered page in the
 * TanStack Router route table (HOS-1754).
 *
 * `Breadcrumbs` builds one entry per pathname prefix, but some prefixes are
 * only structural (e.g. `/billing/subscriptions`) and have no page of their
 * own. The router exposes `routesByPath`, a map keyed by every route's
 * `fullPath` (e.g. `/billing/subscriptions/$subscriptionId/cancellation`).
 * These helpers match a concrete pathname against those patterns so the
 * breadcrumb can render a non-linking segment instead of a 404 link.
 */

type MatchesRoutePatternInput = {
    /** Concrete pathname to test, e.g. `/billing/subscriptions/<uuid>`. */
    readonly path: string;
    /** Route `fullPath` pattern, e.g. `/billing/subscriptions/$subscriptionId`. */
    readonly pattern: string;
};

type IsRegisteredPathInput = {
    /** Concrete pathname to test. */
    readonly path: string;
    /** Route `fullPath` patterns, typically from `getRoutePaths`. */
    readonly routePaths: readonly string[];
};

type MinimalRouter = {
    /**
     * TanStack Router route table keyed by each route's `fullPath`. Typed as
     * `object` because the generated `FileRoutesByFullPath` has no string
     * index signature; only its keys are read.
     */
    readonly routesByPath?: object;
};

type GetRoutePathsInput = {
    /** Router instance exposing `routesByPath`. */
    readonly router: MinimalRouter;
};

/**
 * Escapes the regex metacharacters of a literal path segment so a segment
 * such as `plans.v2` only matches itself.
 */
const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Splits a path into its non-empty segments. */
const splitSegments = (value: string): string[] => value.split('/').filter(Boolean);

/**
 * Normalizes a path by dropping its trailing slashes, so `/a/` and `/a`
 * compare equal. The root path stays `/`.
 */
const normalizePath = (value: string): string => {
    if (value === '/') return '/';
    return value.replace(/\/+$/, '');
};

/**
 * Builds the regex source for a route `fullPath` pattern:
 * - a `$name` segment accepts any non-empty segment (no `/`);
 * - a final `$` segment is a splat and accepts any remainder, including none;
 * - every other segment is a literal, case-sensitive match.
 */
const buildPatternSource = (pattern: string): string => {
    const normalized = normalizePath(pattern);
    if (normalized === '/') return '/';

    const segments = splitSegments(normalized);
    let source = '';

    segments.forEach((segment, index) => {
        const isLast = index === segments.length - 1;
        if (segment === '$' && isLast) {
            source += '(?:/.*)?';
            return;
        }
        if (segment.startsWith('$')) {
            source += '/[^/]+';
            return;
        }
        source += `/${escapeRegExp(segment)}`;
    });

    return source;
};

/**
 * Returns whether a concrete pathname matches a route `fullPath` pattern.
 *
 * Trailing slashes are ignored on both sides. `$param` segments accept any
 * non-empty value without a slash and a final `$` accepts any remainder; the
 * remaining segments are compared literally and case-sensitively.
 *
 * @example
 * matchesRoutePattern({
 *   path: '/billing/subscriptions/abc/cancellation',
 *   pattern: '/billing/subscriptions/$subscriptionId/cancellation'
 * }); // true
 */
export const matchesRoutePattern = ({ path, pattern }: MatchesRoutePatternInput): boolean => {
    const normalizedPath = normalizePath(path);
    return new RegExp(`^${buildPatternSource(pattern)}$`).test(normalizedPath);
};

/**
 * Returns whether any of the registered `routePaths` has a page for `path`.
 *
 * Fails open: with an empty route table it returns `true`, so a router that
 * does not expose its routes never hides links. This keeps the previous
 * breadcrumb behaviour as the safe fallback.
 */
export const isRegisteredPath = ({ path, routePaths }: IsRegisteredPathInput): boolean => {
    if (routePaths.length === 0) return true;
    return routePaths.some((pattern) => matchesRoutePattern({ path, pattern }));
};

/**
 * Returns the registered route `fullPath` patterns exposed by the router.
 *
 * Returns an empty list when `routesByPath` is absent, which makes
 * `isRegisteredPath` fail open.
 */
export const getRoutePaths = ({ router }: GetRoutePathsInput): readonly string[] =>
    Object.keys(router.routesByPath ?? {});
