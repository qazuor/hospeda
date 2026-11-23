/**
 * @file ai-assistants-access.ts
 * @description Who may open «Asistentes de IA» (HOS-2562, owner decision of
 * 22/11): only a real client, a person with at least one business vertical.
 * A pure tourist gets the in-layout 404 on `/mi-cuenta/asistentes-ia/` and its
 * history page, indistinguishable from a route that does not exist.
 *
 * The rule itself is `isRealClient` from `@repo/schemas`, the same one the API
 * applies to the MCP OAuth flow and to every MCP request, so the page and the
 * server can never disagree. This module only adapts the session shape.
 *
 * @module lib/ai-assistants-access
 */

import { isRealClient } from '@repo/schemas';
import { fetchAuthMe } from '@/lib/auth-cache';

/** The session facts the rule reads (a subset of `App.Locals['user']`). */
export interface AiAssistantsAccessUser {
    /** Effective permissions from `/auth/me`. */
    readonly permissions: readonly string[];
    /** Owns a host-trade directory listing (provider). */
    readonly ownsHostTradeListing: boolean;
    /** Owns a live partner row. */
    readonly ownsPartner: boolean;
}

/**
 * Whether the session may use «Asistentes de IA».
 *
 * @param params.user - The session user, or `null` for no session.
 * @returns `true` only for a real client.
 */
export function canUseAiAssistants({
    user
}: {
    readonly user: AiAssistantsAccessUser | null | undefined;
}): boolean {
    if (!user) return false;
    return isRealClient({
        permissions: user.permissions,
        ownsHostTradeListing: user.ownsHostTradeListing === true,
        ownsPartner: user.ownsPartner === true
    });
}

/**
 * Asks `/auth/me` (shared, deduplicated) whether the browser's session may use
 * «Asistentes de IA». For islands on session-blind pages, such as the OAuth
 * consent screen, that must not offer a non-client a link or a button the
 * server would refuse anyway.
 *
 * @param params.apiUrl - API base URL; defaults to `getApiUrl()`.
 * @returns `true`/`false` for a signed-in session, `null` when `/auth/me`
 *   reports no session (the caller keeps its own unauthenticated path).
 */
export async function fetchCanUseAiAssistants({
    apiUrl
}: {
    readonly apiUrl?: string;
} = {}): Promise<boolean | null> {
    const me = await fetchAuthMe({ apiUrl });
    if (!me.isAuthenticated) return null;
    return canUseAiAssistants({
        user: {
            permissions: me.permissions,
            ownsHostTradeListing: me.ownsHostTradeListing === true,
            ownsPartner: me.ownsPartner === true
        }
    });
}
