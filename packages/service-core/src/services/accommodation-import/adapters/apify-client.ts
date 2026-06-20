/**
 * Shared Apify HTTP client helper (SPEC-222)
 *
 * Provides a single typed entry-point for running any Apify actor via the
 * `run-sync-get-dataset-items` endpoint and returning the resulting dataset
 * items array.  Both the Airbnb adapter and the Booking adapter (another
 * task) import this helper so the HTTP logic lives in exactly one place.
 *
 * **Actor slug encoding**: Apify actor IDs take the form `owner/actor-name`
 * (e.g. `apify/airbnb-scraper`).  The Apify REST API addresses an actor as a
 * SINGLE path segment using the tilde form `owner~actor-name`; the raw slug
 * with a literal `/` routes to a non-existent endpoint and returns HTTP 404.
 * The configured `owner/actor` slug is therefore transformed to its tilde form
 * before being inserted into the path:
 *
 * ```
 * https://api.apify.com/v2/acts/<owner>~<actor-name>/run-sync-get-dataset-items
 * ```
 *
 * The API token is sent in an `Authorization: Bearer` header, never as a query
 * parameter, so it cannot leak through access logs, proxies, or error traces.
 *
 * **Error policy**: All non-2xx responses and all `fetch` exceptions return an
 * empty array.  Callers must treat an empty result as a degraded extraction —
 * this function never throws.
 *
 * **Trusted host**: `api.apify.com` is an official-API tier endpoint exempt
 * from `safeExternalFetch` per AC-10.2.
 *
 * @module services/accommodation-import/adapters/apify-client
 */

// ---------------------------------------------------------------------------
// runApifyActor
// ---------------------------------------------------------------------------

/**
 * Input parameters for {@link runApifyActor}.
 */
export interface RunApifyActorInput {
    /** Apify API token (from `ctx.credentials.apifyToken`). */
    readonly token: string;
    /**
     * Apify actor slug in `owner/actor-name` form
     * (e.g. `apify/airbnb-scraper`, `dtrungtin/airbnb-scraper`).
     * The slash is treated as a path separator, not percent-encoded.
     */
    readonly actor: string;
    /**
     * JSON body sent to the actor's `INPUT` as its run configuration.
     * The exact shape is actor-specific — callers are responsible for
     * constructing a compatible payload.
     */
    readonly actorInput: Record<string, unknown>;
    /** Maximum wall-clock time (ms) to wait for the synchronous run + result. */
    readonly timeoutMs: number;
}

/**
 * Runs an Apify actor synchronously and returns the full dataset items array.
 *
 * Calls `POST https://api.apify.com/v2/acts/{actor}/run-sync-get-dataset-items`
 * where `{actor}` is the configured `owner/actor` slug transformed to its tilde
 * form `owner~actor` (a literal slash 404s) and the token travels in an
 * `Authorization: Bearer` header.  The request body is `actorInput` serialised
 * as JSON.  Returns `[]` for a malformed actor slug.
 *
 * The `run-sync-get-dataset-items` endpoint blocks until the actor run
 * finishes and streams back the dataset as a top-level JSON array, so the
 * response body is parsed directly as `unknown[]`.
 *
 * **Degradation contract**: returns `[]` (never throws) on:
 * - non-2xx HTTP response
 * - `fetch` rejection (network error, DNS failure, etc.)
 * - `AbortController` timeout expiry (`timeoutMs` exceeded)
 * - JSON parse failure
 *
 * @param input - Actor run parameters.
 * @returns The dataset items array, or `[]` on any failure.
 *
 * @example
 * ```ts
 * const items = await runApifyActor({
 *   token: 'apify_api_xxx',
 *   actor: 'apify/airbnb-scraper',
 *   actorInput: { startUrls: [{ url: 'https://www.airbnb.com/rooms/12345' }] },
 *   timeoutMs: 30_000,
 * });
 * // items: unknown[]  — each element is one dataset record
 * ```
 */
/**
 * Apify actor slug shape: `owner/actor-name`, each part limited to safe slug
 * characters. Validated before path interpolation as defence-in-depth — even
 * though `actor` is operator-controlled (env var), this prevents a malformed
 * value from altering the request path or injecting query/path segments.
 */
const APIFY_ACTOR_SLUG_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export async function runApifyActor(input: RunApifyActorInput): Promise<unknown[]> {
    const { token, actor, actorInput, timeoutMs } = input;

    // Defence-in-depth: reject any actor slug that is not a clean owner/name
    // pair before interpolating it into the request path.
    if (!APIFY_ACTOR_SLUG_RE.test(actor)) {
        return [];
    }

    // Build the URL. The Apify REST API addresses an actor as a SINGLE path
    // segment using the tilde form `owner~actor-name` — the raw `owner/actor`
    // slug (with a literal "/") routes to a non-existent endpoint and returns
    // HTTP 404, which this client would silently degrade to an empty result.
    // The slug is validated above as a clean `owner/name` pair, so replacing the
    // single "/" with "~" is safe. The token is sent as an Authorization header
    // (NOT a query param) so it never leaks into logs, proxies, or error messages.
    const actorPath = actor.replace('/', '~');
    const url = `https://api.apify.com/v2/acts/${actorPath}/run-sync-get-dataset-items`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(actorInput),
            signal: controller.signal
        });

        if (!response.ok) {
            // Non-2xx (e.g. 401 bad token, 404 unknown actor, 429 rate-limit) — degrade
            return [];
        }

        const data = (await response.json()) as unknown;

        // The endpoint returns a top-level JSON array; guard against malformed
        // responses that return an object instead.
        if (!Array.isArray(data)) {
            return [];
        }

        return data;
    } catch {
        // fetch rejection, AbortError (timeout), JSON parse error — all degrade
        return [];
    } finally {
        clearTimeout(timer);
    }
}
