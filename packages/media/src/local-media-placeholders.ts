/**
 * @file local-media-placeholders.ts
 * @description CI cost guard (HOS-1144): a deliberate, explicitly-enabled mode
 * in which every REMOTE media URL is swapped for a placeholder served by the
 * app itself, so a CI run downloads nothing from Cloudinary (or any other
 * image CDN).
 *
 * ## Why this exists
 *
 * `a11y-sweep.yml` and `e2e-pr.yml` seed the CI database with the REAL
 * production Cloudinary URLs and then boot `apps/web` (`output: 'server'`,
 * zero prerendered pages). Every page render therefore makes the SSR Node
 * process fetch the untransformed originals through Astro's `/_image`
 * endpoint, and Chromium fetches whatever `<img>` tags survive that.
 * Measured over 30 days: 70.66 GB of Cloudinary bandwidth, 98.5% of it from
 * User-Agent `node` with no referrer, originating in the US — the GitHub
 * Actions runners.
 *
 * Interception happens at URL RESOLUTION, never inside Astro's image service:
 * by the time an image service is invoked it already holds the downloaded
 * buffer, which is exactly the cost we are trying to avoid.
 *
 * ## Why a dedicated variable and NOT `process.env.CI`
 *
 * `CI=true` is set by a great many tools, including production build
 * pipelines. Keying this behaviour off `CI` would mean a production build
 * that happens to run under `CI=true` serves grey placeholders to real
 * visitors. The switch must be opted into by name, once, in the four
 * workflows that need it.
 *
 * @module local-media-placeholders
 */

/**
 * Name of the environment variable that enables local-placeholder mode.
 *
 * Exported so guards, tests and documentation reference ONE spelling.
 */
export const LOCAL_MEDIA_PLACEHOLDERS_ENV_VAR = 'HOSPEDA_USE_LOCAL_MEDIA_PLACEHOLDERS';

/**
 * The local image served in place of every remote media URL while the mode is
 * active.
 *
 * Two properties of this path are load-bearing and must survive any edit:
 *
 * 1. **It exists on disk in `apps/web/public`** (`public/assets/images/placeholder.svg`),
 *    so the browser gets a 200 rather than a 404. The module-level
 *    `FALLBACK_PLACEHOLDER` in `get-media-url.ts` (`/images/placeholder.svg`)
 *    deliberately is NOT reused here: no app actually serves that path, so
 *    every CI image would 404.
 * 2. **It contains the substring `placeholder`.** ~20 components in
 *    `apps/web` gate optimisation on `!url.includes('placeholder')` and fall
 *    back to a plain `<img>`. Keeping the word in the path is what stops the
 *    placeholder from being routed through `<Image>` / `/_image` — a local
 *    SVG has nothing to gain there, and the round-trip would only add work.
 */
export const LOCAL_MEDIA_PLACEHOLDER = '/assets/images/placeholder.svg';

/**
 * Hostnames that are served by the app under test itself. A URL pointing at
 * one of these costs nothing and must keep working (E2E fixtures address the
 * local API by absolute URL).
 */
const LOCAL_HOSTNAMES: ReadonlySet<string> = new Set([
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    '[::1]'
]);

/**
 * Reads the raw environment value in a way that is safe in every runtime this
 * package ships to (Node SSR, Vite/Astro build, browser bundle).
 *
 * In a browser bundle `process` is undefined, so the mode reads as OFF and the
 * real remote URL is emitted. That is intentional and covered by a second
 * layer of defence: the Playwright/Chromium runs block DNS resolution of
 * `res.cloudinary.com` outright.
 *
 * @returns The raw string value, or `undefined` when unavailable.
 */
function readRawEnvValue(): string | undefined {
    if (typeof process === 'undefined' || !process.env) {
        return undefined;
    }
    return process.env[LOCAL_MEDIA_PLACEHOLDERS_ENV_VAR];
}

/**
 * Whether local-placeholder mode is active for this process.
 *
 * Only the exact strings `'true'` (any casing) and `'1'` enable it. Anything
 * else — unset, empty, `'false'`, `'0'`, a stray space — leaves it OFF. The
 * check is deliberately NOT `Boolean(value)` nor `z.coerce.boolean()`: both
 * treat the string `'false'` as true, which would be the worst possible
 * failure mode for a switch that hides real photographs.
 *
 * ## Why this is NOT memoised
 *
 * It was, and the memo was wrong. This module legitimately loads more than once
 * in a single process: `packages/seed`'s vitest resolves `@repo/media` through
 * `vite-tsconfig-paths` for some import graphs and through the package's
 * `exports` field for others, so two copies coexist — each with its own
 * module-level cache. Measured: with a memo, a call in one copy returned `true`
 * while `uploadSeedImage`, holding the other copy, still fetched the original.
 *
 * A memo of a process-global value that every copy can read directly buys
 * nothing and costs exactly that class of bug. `process.env` IS the shared
 * state; reading it per call is what makes every copy agree. The cost is a
 * property read and a short string compare, against a `fetch` of a
 * 212 KB image — it does not register.
 *
 * @returns `true` when every remote media URL must be replaced by
 *   {@link LOCAL_MEDIA_PLACEHOLDER}.
 *
 * @example
 * ```ts
 * // HOSPEDA_USE_LOCAL_MEDIA_PLACEHOLDERS=true
 * isLocalMediaPlaceholderMode(); // → true
 * ```
 */
export function isLocalMediaPlaceholderMode(): boolean {
    const raw = readRawEnvValue();
    const normalized = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    return normalized === 'true' || normalized === '1';
}

/**
 * Whether the given URL would cause a fetch to a host other than the app
 * under test.
 *
 * Returns `true` only for absolute `http`/`https` URLs — including the
 * protocol-relative `//host/path` form — whose hostname is not in
 * {@link LOCAL_HOSTNAMES}. Root-relative paths, bare relative paths, `data:`
 * URIs, `blob:` URLs and anything unparseable are NOT remote: they either cost
 * nothing or are not fetched over the network at all.
 *
 * @param url - Candidate media URL.
 * @returns `true` when resolving this URL would hit a third-party host.
 *
 * @example
 * ```ts
 * isRemoteMediaUrl('https://res.cloudinary.com/h/image/upload/v1/a.jpg'); // → true
 * isRemoteMediaUrl('//res.cloudinary.com/h/image/upload/v1/a.jpg');       // → true
 * isRemoteMediaUrl('/assets/images/placeholder.svg');                     // → false
 * isRemoteMediaUrl('http://localhost:4321/x.png');                        // → false
 * isRemoteMediaUrl('data:image/png;base64,AAAA');                         // → false
 * ```
 */
export function isRemoteMediaUrl(url: string): boolean {
    const trimmed = url.trim();
    if (trimmed === '') {
        return false;
    }

    // Protocol-relative URLs start with `//` and ARE remote, so they must be
    // tested before the root-relative shortcut below swallows them.
    const candidate = trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;

    let parsed: URL;
    try {
        parsed = new URL(candidate);
    } catch {
        // Relative path (`/a.svg`, `a.svg`) — resolved against this origin.
        return false;
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return false;
    }

    return !LOCAL_HOSTNAMES.has(parsed.hostname);
}

/**
 * Resolves the URL that must be rendered in place of a remote one while
 * local-placeholder mode is active.
 *
 * Honours a caller-supplied fallback (the same `options.fallback` contract
 * `getMediaUrl` already exposes), so an entity-specific placeholder such as
 * `/assets/images/placeholder-accommodation.svg` still wins over the generic
 * one. A fallback that is itself remote is discarded — swapping one remote
 * fetch for another would defeat the whole mechanism.
 *
 * @param options - Optional caller-supplied fallback URL.
 * @returns A local, cost-free image URL.
 */
export function resolveLocalMediaPlaceholder(options?: {
    readonly fallback?: string | undefined;
}): string {
    const fallback = options?.fallback?.trim();
    if (fallback && !isRemoteMediaUrl(fallback)) {
        return fallback;
    }
    return LOCAL_MEDIA_PLACEHOLDER;
}
