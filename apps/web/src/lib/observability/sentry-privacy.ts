/**
 * @file sentry-privacy.ts
 * @description Privacy policy shared by the browser and server Sentry configs
 * (HOS-1892, mirrors the API decision in `apps/api/src/lib/sentry.ts`).
 *
 * Sentry v11 replaced `sendDefaultPii` with `dataCollection`, and its defaults are
 * PERMISSIVE (cookies, request/response bodies, user info, URL query params).
 * Hospeda collects none of those. OAuth, magic-link and MercadoPago callbacks carry
 * `code`, `state`, `token`, `signature`... in the query string.
 *
 * This module has no `@sentry/*` import at all: `sentry.client.config.ts` is emitted in
 * every page head, and an import of the SDK here would put it back on the critical
 * path (HOS-369).
 */

/**
 * Request shape the scrubber reads and rewrites. Declared locally (not imported
 * from `@sentry/astro`) so this module has no reference to the SDK at all: the
 * HOS-369 static guard forbids any `@sentry/*` import in browser-reachable
 * modules, type-only or not.
 */
interface ScrubbableRequest {
    url?: string;
    headers?: Record<string, string>;
    query_string?: unknown;
}

/**
 * Header names/fragments never sent to Sentry (matched as substrings,
 * case-insensitive by the SDK).
 */
const DENIED_HEADER_FRAGMENTS: readonly string[] = [
    'authorization',
    'cookie',
    'token',
    'api-key',
    'apikey',
    'csrf',
    'forwarded',
    '-ip',
    'remote-',
    'via',
    '-user'
];

/**
 * Explicit Sentry v11 `dataCollection` policy for the web app (browser + server).
 * Exported so tests pin it.
 */
export const SENTRY_DATA_COLLECTION = {
    userInfo: false,
    cookies: false,
    httpHeaders: {
        request: { deny: [...DENIED_HEADER_FRAGMENTS] },
        response: { deny: [...DENIED_HEADER_FRAGMENTS, 'set-cookie'] }
    },
    httpBodies: [],
    // Empty allowlist: NO query param is collected.
    urlQueryParams: { allow: [] },
    graphQL: { document: false, variables: false },
    genAI: { inputs: false, outputs: false },
    mcp: { inputs: false, outputs: false },
    databaseQueryData: false,
    queues: false,
    frameContextLines: 7
};

/** Header names removed (case-insensitively) by {@link scrubSentryEvent}. */
const SCRUBBED_HEADERS: readonly string[] = ['authorization', 'cookie', 'x-auth-token'];

/** Strips `?query` and `#fragment` from a URL string. */
function stripQueryAndFragment(url: string): string {
    const index = url.search(/[?#]/);
    return index === -1 ? url : url.slice(0, index);
}

/**
 * `beforeSend` implementation shared by both configs. Removes credential headers
 * and, as defense in depth on top of `dataCollection.urlQueryParams`, any query
 * string / fragment from the request URL.
 *
 * @param event - The event about to be sent.
 * @returns The same event, scrubbed.
 */
export function scrubSentryEvent<T extends { request?: object }>(event: T): T {
    const request = event.request as ScrubbableRequest | undefined;
    if (!request) {
        return event;
    }

    const { query_string: _queryString, ...withoutQuery } = request;
    const headers = request.headers
        ? Object.fromEntries(
              Object.entries(request.headers).filter(
                  ([name]) => !SCRUBBED_HEADERS.includes(name.toLowerCase())
              )
          )
        : undefined;
    const scrubbed: ScrubbableRequest = {
        ...withoutQuery,
        ...(headers ? { headers } : {}),
        ...(typeof request.url === 'string' ? { url: stripQueryAndFragment(request.url) } : {})
    };
    event.request = scrubbed;
    return event;
}
