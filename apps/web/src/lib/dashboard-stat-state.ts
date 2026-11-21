/**
 * @file dashboard-stat-state.ts
 * @description DOM helpers for the account dashboard stat cards (HOS-2424).
 *
 * A stat whose read failed must say it is unavailable, never show a fabricated
 * `0` ("Mis propiedades: 0 publicados" for a host who has one published listing).
 * The helpers below own the two terminal states of a stat element: a real value
 * or "unavailable". They take the document as a parameter so they are testable.
 */

/** CSS class marking a stat that is still waiting for its first value. */
export const STAT_LOADING_CLASS = 'stat-value--loading';

/** CSS class marking a stat whose value could not be loaded. */
export const STAT_UNAVAILABLE_CLASS = 'stat-value--unavailable';

/** Attribute on a stat element carrying its localized "not available" text. */
export const STAT_UNAVAILABLE_ATTR = 'data-label-unavailable';

/** Last-resort text when the element carries no localized label. */
const FALLBACK_UNAVAILABLE_TEXT = '—';

/**
 * Shows a real value in a stat element and clears the loading/unavailable state.
 *
 * @param params.id - Element id of the stat value
 * @param params.value - Text to show
 * @param params.doc - Document to query (defaults to the global one)
 */
export function setStatValue({
    id,
    value,
    doc = document
}: {
    readonly id: string;
    readonly value: string;
    readonly doc?: Document;
}): void {
    const el = doc.getElementById(id);
    if (!el) return;
    el.textContent = value;
    el.classList.remove(STAT_LOADING_CLASS, STAT_UNAVAILABLE_CLASS);
}

/**
 * Marks stat elements as unavailable: their localized "not available" text
 * replaces whatever placeholder they hold, never a numeric value.
 *
 * @param params.ids - Element ids to mark
 * @param params.onlyIfLoading - When true, skips elements that already received a value
 * @param params.doc - Document to query (defaults to the global one)
 */
export function markStatsUnavailable({
    ids,
    onlyIfLoading = false,
    doc = document
}: {
    readonly ids: readonly string[];
    readonly onlyIfLoading?: boolean;
    readonly doc?: Document;
}): void {
    for (const id of ids) {
        const el = doc.getElementById(id);
        if (!el) continue;
        if (onlyIfLoading && !el.classList.contains(STAT_LOADING_CLASS)) continue;
        el.textContent = el.getAttribute(STAT_UNAVAILABLE_ATTR) ?? FALLBACK_UNAVAILABLE_TEXT;
        el.classList.remove(STAT_LOADING_CLASS);
        el.classList.add(STAT_UNAVAILABLE_CLASS);
    }
}

/** Subset of `GET /protected/host/dashboard` the dashboard reads. */
export interface HostDashboardStatsInput {
    readonly properties?: { readonly total?: number };
    readonly unreadConversations?: number;
    /** Sections whose zeros are a server-side failure fallback. */
    readonly unavailable?: readonly string[];
}

/**
 * Resolves the host counters, returning `null` for any value that is not a
 * trustworthy number: absent from the payload, or flagged by the API as a
 * failure fallback (`unavailable`). A `null` must render as "not available",
 * never as `0` (HOS-2424).
 *
 * @param params.data - The `data` member of the host dashboard response
 * @returns The properties total and unread messages, each `number | null`
 */
export function resolveHostStatValues({
    data
}: {
    readonly data: HostDashboardStatsInput | undefined;
}): { readonly properties: number | null; readonly messages: number | null } {
    const unavailable = data?.unavailable ?? [];
    const total = data?.properties?.total;
    const unread = data?.unreadConversations;
    return {
        properties: typeof total === 'number' && !unavailable.includes('properties') ? total : null,
        messages:
            typeof unread === 'number' && !unavailable.includes('unreadConversations')
                ? unread
                : null
    };
}
