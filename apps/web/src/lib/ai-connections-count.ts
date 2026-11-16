/**
 * @file ai-connections-count.ts
 * @description One shared lookup of "how many AI assistants does the signed-in
 * user have connected" for the account navigation (HOS-2184 T-028).
 *
 * With the MCP feature off, the "Asistentes de IA" entry only exists for users
 * who still have connections to disconnect. Three surfaces ask the same
 * question (account sidebar, avatar menu, mobile menu), so the answer is a
 * module-level promise: one request per page load, whoever asks first.
 * A failure resolves to `0` (entry hidden) and is cached like a success.
 */

import { buildAiConnectionsUrl, parseAiConnections } from '@/lib/ai-assistants';
import { getApiUrl } from '@/lib/env';

let pending: Promise<number> | undefined;

/** Input of {@link getAiConnectionCount}. */
export interface GetAiConnectionCountParams {
    /** API base URL. Defaults to the configured one. */
    readonly apiUrl?: string;
    /** Injectable for tests. */
    readonly fetchImpl?: typeof fetch;
}

async function fetchCount({
    apiUrl,
    fetchImpl = fetch
}: GetAiConnectionCountParams): Promise<number> {
    try {
        const res = await fetchImpl(buildAiConnectionsUrl({ apiUrl: apiUrl ?? getApiUrl() }), {
            credentials: 'include'
        });
        if (!res.ok) {
            return 0;
        }
        const parsed = parseAiConnections({ body: await res.json() });
        return parsed.ok ? parsed.items.length : 0;
    } catch {
        return 0;
    }
}

/**
 * Number of AI connections of the current user, fetched at most once per page
 * load and shared by every caller.
 *
 * @param params - Optional API base and test seams.
 * @returns The count, or `0` when it could not be determined.
 */
export function getAiConnectionCount(params: GetAiConnectionCountParams = {}): Promise<number> {
    pending ??= fetchCount(params);
    return pending;
}

/** Forgets the cached answer. Test-only. */
export function resetAiConnectionCount(): void {
    pending = undefined;
}
