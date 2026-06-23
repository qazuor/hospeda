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

// ---------------------------------------------------------------------------
// startApifyRun
// ---------------------------------------------------------------------------

/**
 * Input parameters for {@link startApifyRun}.
 */
export interface StartApifyRunInput {
    /** Apify API token. */
    readonly token: string;
    /**
     * Apify actor slug in `owner/actor-name` form
     * (e.g. `apify/airbnb-scraper`).
     * Transformed to tilde form for the request path.
     */
    readonly actor: string;
    /**
     * JSON body sent to the actor as its run configuration.
     * The exact shape is actor-specific.
     */
    readonly actorInput: Record<string, unknown>;
}

/**
 * Result returned by a successful {@link startApifyRun} call.
 */
export interface StartApifyRunResult {
    /** The Apify run ID, used to poll status via {@link getApifyRunStatus}. */
    readonly runId: string;
    /** The dataset ID associated with this run, used to fetch items via {@link getApifyDatasetItems}. */
    readonly defaultDatasetId: string;
}

/**
 * Starts an Apify actor run asynchronously and returns the run ID and dataset ID.
 *
 * Calls `POST https://api.apify.com/v2/acts/{actor}/runs` with the provided
 * `actorInput` as the JSON request body.  The actor slug is transformed from
 * the `owner/actor` form to the `owner~actor` tilde form required by the Apify
 * REST API.  The token travels in an `Authorization: Bearer` header, never in
 * the URL.
 *
 * **Trusted host**: `api.apify.com` is an official-API tier endpoint exempt
 * from `safeExternalFetch` per AC-10.2.
 *
 * **Degradation contract**: returns `null` (never throws) on:
 * - non-201 HTTP response
 * - `fetch` rejection (network error, DNS failure, etc.)
 * - Response body missing `data.id` or `data.defaultDatasetId`
 * - Malformed actor slug
 *
 * @param input - Actor run parameters.
 * @returns `{ runId, defaultDatasetId }` on success, or `null` on any failure.
 *
 * @example
 * ```ts
 * const result = await startApifyRun({
 *   token: 'apify_api_xxx',
 *   actor: 'apify/airbnb-scraper',
 *   actorInput: { startUrls: [{ url: 'https://www.airbnb.com/rooms/12345' }] },
 * });
 * if (result) {
 *   console.log(result.runId, result.defaultDatasetId);
 * }
 * ```
 */
export async function startApifyRun(
    input: StartApifyRunInput
): Promise<StartApifyRunResult | null> {
    const { token, actor, actorInput } = input;

    if (!APIFY_ACTOR_SLUG_RE.test(actor)) {
        return null;
    }

    const actorPath = actor.replace('/', '~');
    const url = `https://api.apify.com/v2/acts/${actorPath}/runs`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(actorInput)
        });

        if (response.status !== 201) {
            return null;
        }

        const body = (await response.json()) as {
            data?: { id?: string; defaultDatasetId?: string };
        };

        const runId = body?.data?.id;
        const defaultDatasetId = body?.data?.defaultDatasetId;

        if (!runId || !defaultDatasetId) {
            return null;
        }

        return { runId, defaultDatasetId };
    } catch {
        // fetch rejection or JSON parse error — degrade
        return null;
    }
}

// ---------------------------------------------------------------------------
// getApifyRunStatus
// ---------------------------------------------------------------------------

/**
 * The set of terminal and non-terminal statuses an Apify actor run may report.
 *
 * - `READY` / `RUNNING`: the run is still in progress.
 * - `SUCCEEDED`: the run completed successfully; dataset items are available.
 * - `FAILED` / `TIMED-OUT` / `ABORTED`: the run ended without producing usable data.
 */
export type ApifyRunStatus = 'READY' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMED-OUT' | 'ABORTED';

/**
 * Result returned by a successful {@link getApifyRunStatus} call.
 */
export interface GetApifyRunStatusResult {
    /** Current Apify run status. */
    readonly status: ApifyRunStatus;
    /** Dataset ID associated with the run (needed to fetch items on SUCCEEDED). */
    readonly defaultDatasetId: string;
}

/**
 * Input parameters for {@link getApifyRunStatus}.
 */
export interface GetApifyRunStatusInput {
    /** Apify API token. */
    readonly token: string;
    /** Apify run ID returned by {@link startApifyRun}. */
    readonly runId: string;
}

/**
 * Fetches the current status of an Apify actor run.
 *
 * Calls `GET https://api.apify.com/v2/actor-runs/{runId}` with an
 * `Authorization: Bearer` header.  Returns `{ status, defaultDatasetId }` when
 * the response is 200 and the body contains both fields; returns `null`
 * otherwise.
 *
 * **Degradation contract**: returns `null` (never throws) on:
 * - non-200 HTTP response
 * - `fetch` rejection (network error, DNS failure, etc.)
 * - Response body missing `data.status` or `data.defaultDatasetId`
 *
 * @param input - Run status query parameters.
 * @returns `{ status, defaultDatasetId }` on success, or `null` on any failure.
 *
 * @example
 * ```ts
 * const result = await getApifyRunStatus({ token: 'apify_api_xxx', runId: 'abc123' });
 * if (result?.status === 'SUCCEEDED') {
 *   const items = await getApifyDatasetItems({ token, datasetId: result.defaultDatasetId });
 * }
 * ```
 */
export async function getApifyRunStatus(
    input: GetApifyRunStatusInput
): Promise<GetApifyRunStatusResult | null> {
    const { token, runId } = input;

    const url = `https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (response.status !== 200) {
            return null;
        }

        const body = (await response.json()) as {
            data?: { status?: string; defaultDatasetId?: string };
        };

        const status = body?.data?.status;
        const defaultDatasetId = body?.data?.defaultDatasetId;

        if (!status || !defaultDatasetId) {
            return null;
        }

        return { status: status as ApifyRunStatus, defaultDatasetId };
    } catch {
        // fetch rejection or JSON parse error — degrade
        return null;
    }
}

// ---------------------------------------------------------------------------
// getApifyDatasetItems
// ---------------------------------------------------------------------------

/**
 * Input parameters for {@link getApifyDatasetItems}.
 */
export interface GetApifyDatasetItemsInput {
    /** Apify API token. */
    readonly token: string;
    /** Dataset ID returned by a successful Apify run. */
    readonly datasetId: string;
}

/**
 * Fetches all items from an Apify dataset.
 *
 * Calls `GET https://api.apify.com/v2/datasets/{datasetId}/items` with an
 * `Authorization: Bearer` header.  Returns the response body parsed as an
 * `unknown[]` array on success.
 *
 * **Degradation contract**: returns `[]` (never throws) on:
 * - non-200 HTTP response
 * - `fetch` rejection (network error, DNS failure, etc.)
 * - Response body is not a JSON array
 *
 * @param input - Dataset query parameters.
 * @returns The array of dataset items, or `[]` on any failure.
 *
 * @example
 * ```ts
 * const items = await getApifyDatasetItems({ token: 'apify_api_xxx', datasetId: 'ds_abc' });
 * // items: unknown[] — each element is one dataset record
 * ```
 */
export async function getApifyDatasetItems(input: GetApifyDatasetItemsInput): Promise<unknown[]> {
    const { token, datasetId } = input;

    const url = `https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (response.status !== 200) {
            return [];
        }

        const body = (await response.json()) as unknown;

        if (!Array.isArray(body)) {
            return [];
        }

        return body;
    } catch {
        // fetch rejection or JSON parse error — degrade
        return [];
    }
}
