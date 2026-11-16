/**
 * @file ai-connections-count.ts
 * @description One shared lookup of the signed-in user's AI assistant
 * connections for the surfaces that need them on any page (HOS-2184).
 *
 * Several islands ask about the same endpoint: the account sidebar, the avatar
 * menu and the mobile menu want a count (with the MCP feature off, the "Asistentes
 * de IA" entry only exists for users who still have connections to disconnect),
 * and the post-password-reset prompt wants the pending review. So the answer is
 * a module-level promise: one request per page load, whoever asks first.
 * A failure resolves to "nothing" (count `0`, no review) and is cached like a
 * success.
 */

import type { AiConnectionPendingResetReview } from '@repo/schemas';
import { buildAiConnectionsUrl, parseAiConnections } from '@/lib/ai-assistants';
import { getApiUrl } from '@/lib/env';

/** What the shared lookup resolves to. */
export interface AiConnectionsSnapshot {
    /** How many connections the user has. `0` when it could not be determined. */
    readonly count: number;
    /** The unanswered post-password-reset question, or `null`. */
    readonly pendingResetReview: AiConnectionPendingResetReview | null;
}

const EMPTY_SNAPSHOT: AiConnectionsSnapshot = { count: 0, pendingResetReview: null };

let pending: Promise<AiConnectionsSnapshot> | undefined;

/** Input of {@link getAiConnectionCount} and {@link getAiConnectionsSnapshot}. */
export interface GetAiConnectionCountParams {
    /** API base URL. Defaults to the configured one. */
    readonly apiUrl?: string;
    /** Injectable for tests. */
    readonly fetchImpl?: typeof fetch;
}

async function fetchSnapshot({
    apiUrl,
    fetchImpl = fetch
}: GetAiConnectionCountParams): Promise<AiConnectionsSnapshot> {
    try {
        const res = await fetchImpl(buildAiConnectionsUrl({ apiUrl: apiUrl ?? getApiUrl() }), {
            credentials: 'include'
        });
        if (!res.ok) {
            return EMPTY_SNAPSHOT;
        }
        const parsed = parseAiConnections({ body: await res.json() });
        return parsed.ok
            ? { count: parsed.items.length, pendingResetReview: parsed.pendingResetReview }
            : EMPTY_SNAPSHOT;
    } catch {
        return EMPTY_SNAPSHOT;
    }
}

/**
 * The user's AI connections summary, fetched at most once per page load and
 * shared by every caller.
 *
 * @param params - Optional API base and test seams.
 * @returns The snapshot, or an empty one when it could not be determined.
 */
export function getAiConnectionsSnapshot(
    params: GetAiConnectionCountParams = {}
): Promise<AiConnectionsSnapshot> {
    pending ??= fetchSnapshot(params);
    return pending;
}

/**
 * Number of AI connections of the current user, fetched at most once per page
 * load and shared by every caller.
 *
 * @param params - Optional API base and test seams.
 * @returns The count, or `0` when it could not be determined.
 */
export async function getAiConnectionCount(
    params: GetAiConnectionCountParams = {}
): Promise<number> {
    return (await getAiConnectionsSnapshot(params)).count;
}

/** Forgets the cached answer. Test-only, and after the user answers the review. */
export function resetAiConnectionCount(): void {
    pending = undefined;
}
