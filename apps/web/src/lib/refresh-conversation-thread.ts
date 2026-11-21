/**
 * @file refresh-conversation-thread.ts
 * @description Re-renders the SSR message block of a conversation thread in place
 * (HOS-2439), so a just-sent reply shows up without a full page reload.
 *
 * The thread is server-rendered by three Astro pages (`mi-cuenta/consultas`,
 * `mi-cuenta/consultas-propietario`, `guest/messages`). Rather than duplicating
 * their bubble markup and scoped styles inside the reply island, the current
 * page is fetched again and only its thread container is swapped in. The fetched
 * container carries the page's own scoped-style attributes, so it renders identically.
 */

/**
 * Marks the block the three thread pages render around the load-older link, the
 * message list and the "read by owner" notice. All of it can change when a
 * reply is sent, so the whole block is swapped, not just the list of messages.
 */
export const THREAD_CONTAINER_SELECTOR = '[data-conversation-thread]';

/** Result of {@link refreshConversationThread}. */
export interface RefreshConversationThreadResult {
    /** `true` when the container was swapped, `false` when nothing could be refreshed. */
    readonly refreshed: boolean;
}

/**
 * Fetches the current page again and replaces the in-page thread container with the
 * fresh one. Never throws: a failed refresh leaves the page untouched and reports
 * `refreshed: false` so the caller can fall back to a reload.
 *
 * @param params - Object with the document and the page URL to refetch.
 * @param params.doc - The live document that holds the current thread container.
 * @param params.pageUrl - Absolute URL of the current page. A `cursor` query
 * param (older-messages view) is dropped so the newest messages are returned.
 * @returns Whether the container was refreshed.
 */
export async function refreshConversationThread({
    doc,
    pageUrl
}: {
    readonly doc: Document;
    readonly pageUrl: string;
}): Promise<RefreshConversationThreadResult> {
    try {
        const current = doc.querySelector(THREAD_CONTAINER_SELECTOR);
        if (!current) return { refreshed: false };

        const url = new URL(pageUrl);
        url.searchParams.delete('cursor');

        const res = await fetch(url.toString(), {
            credentials: 'same-origin',
            cache: 'no-store',
            headers: { Accept: 'text/html' }
        });
        if (!res.ok) return { refreshed: false };

        const fresh = new DOMParser()
            .parseFromString(await res.text(), 'text/html')
            .querySelector(THREAD_CONTAINER_SELECTOR);
        if (!fresh) return { refreshed: false };

        current.replaceWith(doc.importNode(fresh, true));
        return { refreshed: true };
    } catch {
        return { refreshed: false };
    }
}
