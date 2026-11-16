/**
 * @file auth-mcp-cimd-fetch.ts
 * @description CIMD metadata transport for the MCP authorization server
 * (HOS-2184). A CIMD `client_id` is an attacker-chosen URL, so the fetch goes
 * through the repo's `safeExternalFetch` (DNS pinning, private-IP block, timeout,
 * size cap). The host allowlist that decides WHICH urls are fetched lives in
 * `auth-mcp-oauth.ts` (`isMcpCimdUrlAllowed`).
 */

import { safeExternalFetch } from '@repo/utils/safe-fetch';

/** Timeout of one metadata fetch, in milliseconds. */
export const MCP_CIMD_FETCH_TIMEOUT_MS = 5_000;

/** Largest metadata document accepted, in bytes. */
export const MCP_CIMD_MAX_BYTES = 65_536;

/**
 * CIMD transport backed by `safeExternalFetch`. Serves `GET` and `HEAD` only,
 * never follows a redirect, and caps time and size. A blocked or failed fetch
 * rejects, which the CIMD plugin treats as an unresolvable client.
 *
 * @param input - Target URL
 * @param init - Request init (method and headers are honoured)
 * @returns A `Response` carrying the fetched body and status
 * @throws Error when the method is not GET/HEAD or the fetch is blocked
 */
export async function mcpCimdFetch(
    input: RequestInfo | URL,
    init?: RequestInit
): Promise<Response> {
    const method = (init?.method ?? 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
        throw new Error(`CIMD transport does not support ${method}`);
    }

    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, key) => {
        headers[key] = value;
    });

    const result = await safeExternalFetch({
        url: String(input),
        timeoutMs: MCP_CIMD_FETCH_TIMEOUT_MS,
        maxBytes: MCP_CIMD_MAX_BYTES,
        maxRedirects: 0,
        headers
    });

    if (!result.ok) {
        throw new Error(`CIMD metadata fetch refused: ${result.error}`);
    }

    return new Response(method === 'HEAD' ? null : result.body, {
        status: result.status,
        headers: { 'content-type': 'application/json' }
    });
}
