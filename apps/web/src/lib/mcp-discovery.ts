/**
 * @file mcp-discovery.ts
 * @description Server-side discovery of the MCP server URL (HOS-2184 T-028).
 *
 * The web app has no flag of its own for the MCP feature. It asks the API,
 * which already publishes the answer: RFC 9728 protected-resource metadata
 * answers 200 with `resource` set to the canonical MCP URL when the feature is
 * on and 404 when it is off (spec AC-1, AC-4). That keeps one source of truth
 * and one env var (`HOSPEDA_MCP_ENABLED`) instead of a web twin to keep in sync.
 *
 * Any failure (network, timeout, non-200, malformed body) reads as "off": the
 * panel then degrades to the manage-only view, which is the safe direction.
 * Results are cached briefly so the account sidebar does not pay a round trip
 * on every request.
 */

import { z } from 'zod';
import { getApiUrl, getInternalApiUrl } from './env';

/** Path of the protected-resource metadata document, at the API root. */
export const MCP_DISCOVERY_PATH = '/.well-known/oauth-protected-resource';

const POSITIVE_TTL_MS = 60_000;
const NEGATIVE_TTL_MS = 30_000;
const REQUEST_TIMEOUT_MS = 2_000;

const ProtectedResourceSchema = z.object({ resource: z.url() });

let cache: { readonly value: string | null; readonly expiresAt: number } | undefined;
let inflight: Promise<string | null> | undefined;

/** Input of {@link getMcpUrl}. */
export interface GetMcpUrlParams {
    /** API base URL used for the lookup (internal URL preferred by callers). */
    readonly apiUrl: string;
    /** Injectable for tests. */
    readonly fetchImpl?: typeof fetch;
    /** Injectable clock for tests. */
    readonly now?: () => number;
}

async function lookup({
    apiUrl,
    fetchImpl = fetch,
    now = Date.now
}: GetMcpUrlParams): Promise<string | null> {
    let value: string | null = null;
    try {
        const response = await fetchImpl(`${apiUrl.replace(/\/$/, '')}${MCP_DISCOVERY_PATH}`, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        });
        if (response.status === 200) {
            const parsed = ProtectedResourceSchema.safeParse(await response.json());
            value = parsed.success ? parsed.data.resource : null;
        }
    } catch {
        value = null;
    }
    cache = { value, expiresAt: now() + (value ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS) };
    return value;
}

/**
 * Returns the canonical MCP URL when the feature is on, `null` otherwise.
 *
 * Stale-while-revalidate: only the very first call (empty cache) waits for the
 * API. Afterwards an expired entry is served as is while one background refresh
 * runs, so no request ever pays the lookup (or its timeout) again. The account
 * layout calls this on every page, which is why.
 *
 * @param params - API base URL plus test seams.
 * @returns The MCP URL byte for byte as the API publishes it, or `null`.
 */
export async function getMcpUrl(params: GetMcpUrlParams): Promise<string | null> {
    const now = params.now ?? Date.now;
    if (cache && cache.expiresAt > now()) {
        return cache.value;
    }
    inflight ??= lookup(params).finally(() => {
        inflight = undefined;
    });
    return cache ? cache.value : inflight;
}

/** Clears the cache. Test-only. */
export function resetMcpUrlCache(): void {
    cache = undefined;
    inflight = undefined;
}

/**
 * {@link getMcpUrl} against the API this web instance is configured with
 * (the internal URL for SSR when set, the public one otherwise).
 *
 * @returns The MCP URL when the feature is on, `null` otherwise.
 */
export async function getConfiguredMcpUrl(): Promise<string | null> {
    return getMcpUrl({ apiUrl: getInternalApiUrl() ?? getApiUrl() });
}
