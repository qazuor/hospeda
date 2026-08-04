/**
 * @file accommodation-conversation-store.ts
 * @description Shared client-side lookup of "does this visitor already have a
 * conversation with this accommodation?" (HOS-369 WB0-7).
 *
 * **Why this exists.** The accommodation detail page used to answer that
 * question once during SSR — a single
 * `protectedConversationsApi.list({ accommodationId, pageSize: 1 })` call whose
 * result fed two different props: `ContactHost.existingConversationId` (which
 * turns the contact form into a "view your existing conversation" link) and
 * `ReviewSidebarCard.canLeaveReview` (only a past enquirer may review). Both are
 * per-visitor, so neither can survive in an edge-cached document.
 *
 * Moving the lookup into the two islands independently would issue the same
 * request twice per page load. This store keeps the SSR page's property — **one
 * request answers both questions** — by caching the in-flight promise per
 * accommodation and handing every consumer the same result.
 *
 * **Session resolution lives here**, mirroring `favorites-store.ts`: a guest
 * never triggers a conversations request at all, and consumers therefore do not
 * carry an auth gate of their own.
 *
 * Nothing is persisted. This is server state re-resolved on the next page load;
 * `sessionStorage` caching it would let a stale answer outlive the conversation
 * that created it.
 */

import { useEffect, useState } from 'react';
import { protectedConversationsApi } from '@/lib/api/endpoints-protected';
import { fetchAuthMe, readCachedAuthMe, writeCachedAuthMe } from '@/lib/auth-cache';

/** Resolved (or in-flight) conversation state for one accommodation. */
export interface AccommodationConversationState {
    /**
     * Id of the visitor's existing conversation with this accommodation, or
     * `null` when there is none (including for guests and while resolving).
     */
    readonly conversationId: string | null;
    /**
     * Whether the visitor has at least one conversation with this
     * accommodation. This is the review-eligibility signal: only a past
     * enquirer may leave a review.
     */
    readonly hasConversation: boolean;
    /**
     * Whether the lookup is still in flight. `false` for guests (resolved
     * locally, no request) and after the request settles — including when it
     * fails, which degrades to "no conversation" rather than staying busy.
     */
    readonly isResolving: boolean;
}

/**
 * State served during SSR, to guests, and on any failure: no conversation, not
 * busy. This is the anonymous variant the server renders and the edge caches
 * (HOS-369 D-11), and it is also the fail-closed answer — a visitor wrongly
 * shown the contact form recovers on submit (the protected `initiate` route is
 * idempotent and returns the existing conversation), whereas one wrongly shown
 * the "you already have a conversation" link would have no way forward.
 */
const NO_CONVERSATION: AccommodationConversationState = {
    conversationId: null,
    hasConversation: false,
    isResolving: false
};

/** State while a lookup is in flight. */
const RESOLVING: AccommodationConversationState = {
    conversationId: null,
    hasConversation: false,
    isResolving: true
};

/**
 * In-flight or settled lookups, keyed by accommodation id. Sharing the
 * *promise* (not just the result) is what collapses the two islands' mounts —
 * they hydrate in different ticks, so a result-only cache would still let both
 * fire a request.
 */
const lookupsByAccommodation = new Map<string, Promise<AccommodationConversationState>>();

/**
 * Resolve whether the visitor has a session, cache-first. Concurrent callers
 * across every island share a single in-flight `/auth/me` inside `fetchAuthMe`.
 */
async function resolveIsAuthenticated(): Promise<boolean> {
    const cached = readCachedAuthMe();
    if (cached) return cached.isAuthenticated;

    const snapshot = await fetchAuthMe();
    writeCachedAuthMe(snapshot);
    return snapshot.isAuthenticated;
}

/**
 * Perform the lookup for one accommodation.
 *
 * `cookieHeader` is deliberately omitted: it is the SSR-only escape hatch, and
 * a browser call carries the session automatically via `credentials: 'include'`.
 */
async function lookup(accommodationId: string): Promise<AccommodationConversationState> {
    try {
        const isAuthenticated = await resolveIsAuthenticated();
        if (!isAuthenticated) return NO_CONVERSATION;

        const result = await protectedConversationsApi.list({ accommodationId, pageSize: 1 });
        if (!result.ok) return NO_CONVERSATION;

        const first = result.data.items?.[0] ?? null;
        if (!first) return NO_CONVERSATION;
        return { conversationId: first.id, hasConversation: true, isResolving: false };
    } catch {
        // Network failure — degrade to "no conversation" (see NO_CONVERSATION).
        return NO_CONVERSATION;
    }
}

/**
 * Read the visitor's conversation state for one accommodation, issuing at most
 * one request per accommodation per page load however many islands ask.
 *
 * @param accommodationId - The accommodation being viewed.
 * @returns The shared, settled promise for that accommodation.
 */
export function getAccommodationConversation(
    accommodationId: string
): Promise<AccommodationConversationState> {
    const cached = lookupsByAccommodation.get(accommodationId);
    if (cached) return cached;

    const pending = lookup(accommodationId);
    lookupsByAccommodation.set(accommodationId, pending);
    return pending;
}

/**
 * React hook exposing the visitor's conversation state for one accommodation.
 *
 * Starts at {@link NO_CONVERSATION} (with `isResolving: true` once mounted in a
 * browser), so the server-rendered output is always the anonymous variant.
 *
 * @param params - `{ accommodationId }` (RO-RO).
 * @returns The current {@link AccommodationConversationState}.
 */
export function useAccommodationConversation({
    accommodationId
}: {
    readonly accommodationId: string;
}): AccommodationConversationState {
    const [state, setState] = useState<AccommodationConversationState>(NO_CONVERSATION);

    useEffect(() => {
        let cancelled = false;
        setState(RESOLVING);
        getAccommodationConversation(accommodationId).then((resolved) => {
            if (!cancelled) setState(resolved);
        });
        return () => {
            cancelled = true;
        };
    }, [accommodationId]);

    return state;
}

/**
 * TEST-ONLY: drop every cached lookup.
 *
 * Vitest reuses the module across tests in a file, so without this the promise
 * resolved in one test would silently satisfy the next one's mount and the
 * expected request would never be issued.
 */
export function resetAccommodationConversationStore(): void {
    lookupsByAccommodation.clear();
}
