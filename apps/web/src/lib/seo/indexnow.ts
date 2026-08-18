/**
 * @file indexnow.ts
 * @description IndexNow protocol client (HOS-585 G-1).
 *
 * IndexNow is the live mechanism for telling search engines that a URL changed.
 * One submission reaches Bing, Yandex, Seznam, Naver and Yep; the legacy
 * `bing.com/ping?sitemap=` endpoint is dead and is NOT a fallback.
 *
 * This module is deliberately transport-only: it takes URLs that a caller has
 * already decided are worth submitting and puts them on the wire. It does not
 * know what an accommodation is, does not build URLs, and does not read
 * settings — that lives in the endpoint that calls it. Keeping it that narrow is
 * what makes the protocol semantics (which status means what) unit-testable
 * without mocking the whole site.
 *
 * **Never throws.** Every failure — network, timeout, protocol rejection — comes
 * back in the result object, because the only caller is a fire-and-forget hook
 * running alongside a content write that must not fail because a ping did.
 */

/** Where submissions go. Shared by every participating search engine. */
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

/** Protocol ceiling for a single submission. */
export const INDEXNOW_MAX_URLS_PER_REQUEST = 10_000;

/** How long to wait before giving up on a submission. */
export const INDEXNOW_TIMEOUT_MS = 10_000;

/** The wire payload, exactly as the protocol defines it. */
export interface IndexNowPayload {
    /** Bare hostname the URLs belong to (no scheme, no trailing slash). */
    readonly host: string;
    /** The API key, matching the contents of the file at `keyLocation`. */
    readonly key: string;
    /** Absolute URL of the key file, on the same host. */
    readonly keyLocation: string;
    /** Absolute URLs being submitted. */
    readonly urlList: readonly string[];
}

/** Outcome of one submission attempt. */
export interface IndexNowResult {
    /** Whether the engines accepted the submission. */
    readonly success: boolean;
    /** How many URLs were on the wire. `0` when the attempt never left. */
    readonly submitted: number;
    /** HTTP status, when a response was actually received. */
    readonly status?: number;
    /** Human-readable failure reason. Absent on success. */
    readonly error?: string;
    /** Wall-clock duration of the attempt. */
    readonly durationMs: number;
}

/**
 * What each documented status means, in words a log reader can act on.
 *
 * `202` is a success: the submission is accepted while the engines verify the
 * key file. Treating it as a failure would make the very first submission of a
 * freshly-published key look broken and invite someone to "fix" a working setup.
 */
const STATUS_EXPLANATIONS: Readonly<Record<number, string>> = {
    400: 'invalid format — the payload shape was rejected',
    403: 'key not valid — the key file is missing, unreachable, or its contents do not match',
    422: 'URLs do not belong to the host, or the key does not match the schema',
    429: 'too many requests — the submitter is being rate-limited as spam'
};

/** Statuses the protocol defines as acceptance. */
const ACCEPTED_STATUSES = new Set([200, 202]);

/**
 * Normalize a site URL into the bare host IndexNow expects.
 *
 * @param params.siteUrl - Absolute site URL (e.g. `https://hospeda.com.ar/`).
 * @returns The bare hostname, or `undefined` when the input is not a URL.
 */
export function toIndexNowHost({ siteUrl }: { readonly siteUrl: string }): string | undefined {
    try {
        return new URL(siteUrl).host;
    } catch {
        return undefined;
    }
}

/**
 * Reject any URL that does not belong to `host`.
 *
 * The protocol answers `422` for a foreign URL and penalizes the submitter, so
 * catching it here is cheaper than learning it from a rejection. Returns the
 * offenders rather than silently dropping them: a URL that should have been
 * submitted and quietly was not is indistinguishable from a working system.
 *
 * @param params.host - The bare host every URL must belong to.
 * @param params.urls - Absolute URLs to check.
 * @returns The URLs that do NOT belong to `host` (empty when all are valid).
 */
export function findForeignUrls({
    host,
    urls
}: {
    readonly host: string;
    readonly urls: readonly string[];
}): readonly string[] {
    return urls.filter((url) => {
        try {
            return new URL(url).host !== host;
        } catch {
            // An unparseable string is foreign by definition.
            return true;
        }
    });
}

/**
 * Submit a batch of URLs to IndexNow.
 *
 * Refuses, without sending anything, when the batch is empty, exceeds
 * {@link INDEXNOW_MAX_URLS_PER_REQUEST}, or contains a URL that does not belong
 * to `host`. Each of those is reported as a failed result rather than a silent
 * truncation — a submitter that quietly sends the first 10,000 of 10,001 URLs
 * looks healthy while losing data.
 *
 * @param params.payload - The submission.
 * @param params.fetchImpl - Injectable `fetch`, for tests. Defaults to global.
 * @returns The outcome. Never rejects.
 */
export async function submitToIndexNow({
    payload,
    fetchImpl = fetch
}: {
    readonly payload: IndexNowPayload;
    readonly fetchImpl?: typeof fetch;
}): Promise<IndexNowResult> {
    const startedAt = Date.now();
    const count = payload.urlList.length;
    const fail = (error: string, status?: number): IndexNowResult => ({
        success: false,
        submitted: 0,
        ...(status === undefined ? {} : { status }),
        error,
        durationMs: Date.now() - startedAt
    });

    if (count === 0) {
        return fail('nothing to submit — the URL list was empty');
    }
    if (count > INDEXNOW_MAX_URLS_PER_REQUEST) {
        return fail(
            `batch of ${count} exceeds the ${INDEXNOW_MAX_URLS_PER_REQUEST}-URL protocol limit`
        );
    }

    const foreign = findForeignUrls({ host: payload.host, urls: payload.urlList });
    if (foreign.length > 0) {
        return fail(
            `${foreign.length} URL(s) do not belong to ${payload.host} (first: ${foreign[0]})`
        );
    }

    try {
        const response = await fetchImpl(INDEXNOW_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(INDEXNOW_TIMEOUT_MS)
        });

        if (!ACCEPTED_STATUSES.has(response.status)) {
            const explanation =
                STATUS_EXPLANATIONS[response.status] ?? 'unexpected status from IndexNow';
            return fail(explanation, response.status);
        }

        return {
            success: true,
            submitted: count,
            status: response.status,
            durationMs: Date.now() - startedAt
        };
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return fail(`submission failed before a response: ${reason}`);
    }
}
