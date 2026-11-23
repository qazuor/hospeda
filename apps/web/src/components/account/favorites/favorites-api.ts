/**
 * @file favorites-api.ts
 * @description Browser reads and writes of the favorites page (HOS-2480).
 *
 * Every read resolves to a value or throws: a failure is never turned into an
 * empty list or a `0` here, so the caller's `AsyncRegion` can show the error
 * state (HOS-2414 AC-2). The one exception is the collections list's 403
 * `ENTITLEMENT_REQUIRED`, which is a real answer («your plan has no
 * collections») and comes back as `{ kind: 'noPlan' }`.
 */

import type {
    BookmarkCollectionItem,
    BookmarkCollectionUsage
} from '@/lib/api/endpoints-protected';
import type { FavoritesTabKey } from './favorites-tabs';

/** Favorites per page of the «Sin colección» grid. */
export const FAVORITES_PAGE_SIZE = 12;

/** Collections read in one request (entity-agnostic, read once). */
const COLLECTIONS_PAGE_SIZE = 100;

const BOOKMARKS_PATH = '/api/v1/protected/user-bookmarks';
const COLLECTIONS_PATH = '/api/v1/protected/user-bookmark-collections';

/** One bookmark as the list endpoint returns it (server-enriched). */
export interface BookmarkItem {
    readonly id: string;
    readonly entityId: string;
    readonly entityType: string;
    /** User label; null when the bookmark is just a heart click. */
    readonly name?: string | null;
    /** The user's personal note (stored as `description`). */
    readonly description?: string | null;
    /** Collection it belongs to; null/undefined means uncollected. */
    readonly collectionId?: string | null;
    readonly entityName?: string | null;
    readonly entitySlug?: string | null;
    readonly entityImage?: string | null;
}

/** A loaded page of uncollected bookmarks. */
export interface BookmarksPage {
    readonly bookmarks: readonly BookmarkItem[];
    /** Server total of uncollected bookmarks for the tab (all pages). */
    readonly total: number;
}

/** What the collections list answered. */
export type CollectionsRead =
    | {
          readonly kind: 'ok';
          readonly items: readonly BookmarkCollectionItem[];
          readonly usage: BookmarkCollectionUsage | null;
      }
    | { readonly kind: 'noPlan' };

/** The API error a failed write carried (code and message), for translation. */
export interface ApiErrorInfo {
    readonly code?: string;
    readonly message?: string;
}

/** A failed write, with the API error attached for `translateApiError`. */
export class FavoritesApiError extends Error {
    /** The API error envelope, when the body had one. */
    readonly apiError: ApiErrorInfo | undefined;

    /**
     * @param input - Options object.
     * @param input.message - Internal message.
     * @param input.apiError - The API error envelope.
     */
    constructor({
        message,
        apiError
    }: {
        readonly message: string;
        readonly apiError: ApiErrorInfo | undefined;
    }) {
        super(message);
        this.name = 'FavoritesApiError';
        this.apiError = apiError;
    }
}

/** Error envelope of a failed request. */
interface ApiErrorBody {
    readonly error?: { readonly code?: string | null; readonly message?: string };
}

/** Reads the JSON error envelope, or nothing when the body is not JSON. */
async function readError(res: Response): Promise<ApiErrorBody['error']> {
    try {
        return ((await res.json()) as ApiErrorBody).error;
    } catch {
        return undefined;
    }
}

/**
 * Reads one page of the uncollected bookmarks of a tab. `uncollected=true`
 * makes the SERVER filter before paginating, so «Sin colección» covers every
 * page and not only the current one (HOS-2420).
 *
 * @param input - Options object.
 * @param input.base - API origin without trailing slash.
 * @param input.tab - The tab (ALL omits the type filter).
 * @param input.page - 1-based page.
 * @param input.signal - Abort signal.
 * @returns The page.
 * @throws When the request fails or the body is not a success envelope.
 */
export async function fetchUncollectedPage({
    base,
    tab,
    page,
    signal
}: {
    readonly base: string;
    readonly tab: FavoritesTabKey;
    readonly page: number;
    readonly signal?: AbortSignal;
}): Promise<BookmarksPage> {
    const params = new URLSearchParams({
        page: String(page),
        pageSize: String(FAVORITES_PAGE_SIZE),
        uncollected: 'true'
    });
    if (tab !== 'ALL') params.set('entityType', tab);
    const res = await fetch(`${base}${BOOKMARKS_PATH}?${params.toString()}`, {
        credentials: 'include',
        signal
    });
    if (!res.ok) throw new Error(`bookmarks ${res.status}`);
    const body = (await res.json()) as {
        readonly success: boolean;
        readonly data?: { readonly bookmarks: readonly BookmarkItem[]; readonly total: number };
    };
    if (!body.success || !body.data) throw new Error('bookmarks: no data');
    return { bookmarks: body.data.bookmarks ?? [], total: body.data.total ?? 0 };
}

/**
 * Reads the total favorites of a tab (every bookmark, collected or not), for
 * the tab's count.
 *
 * @param input - Options object.
 * @param input.base - API origin without trailing slash.
 * @param input.tab - The tab.
 * @param input.signal - Abort signal.
 * @returns The total.
 * @throws When the request fails.
 */
export async function fetchTabCount({
    base,
    tab,
    signal
}: {
    readonly base: string;
    readonly tab: FavoritesTabKey;
    readonly signal?: AbortSignal;
}): Promise<number> {
    const params = new URLSearchParams({ page: '1', pageSize: '1' });
    if (tab !== 'ALL') params.set('entityType', tab);
    const res = await fetch(`${base}${BOOKMARKS_PATH}?${params.toString()}`, {
        credentials: 'include',
        signal
    });
    if (!res.ok) throw new Error(`count ${res.status}`);
    const body = (await res.json()) as {
        readonly success: boolean;
        readonly data?: { readonly total: number };
    };
    if (!body.success || typeof body.data?.total !== 'number') throw new Error('count: no data');
    return body.data.total;
}

/**
 * Deletes a bookmark.
 *
 * @param input - Options object.
 * @param input.base - API origin without trailing slash.
 * @param input.id - Bookmark id.
 * @returns Nothing on success.
 * @throws {FavoritesApiError} With the API error attached on failure.
 */
export async function deleteBookmark({
    base,
    id
}: {
    readonly base: string;
    readonly id: string;
}): Promise<void> {
    const res = await fetch(`${base}${BOOKMARKS_PATH}/${id}`, {
        method: 'DELETE',
        credentials: 'include'
    });
    if (!res.ok) {
        const error = await readError(res);
        throw new FavoritesApiError({
            message: `delete ${res.status}`,
            apiError: error ? { code: error.code ?? undefined, message: error.message } : undefined
        });
    }
}

/**
 * Reads the user's collections with their counts and the usage counters.
 *
 * @param input - Options object.
 * @param input.base - API origin without trailing slash.
 * @returns The collections, or `noPlan` on 403 `ENTITLEMENT_REQUIRED`.
 * @throws On any other failure.
 */
export async function fetchCollections({
    base
}: {
    readonly base: string;
}): Promise<CollectionsRead> {
    const params = new URLSearchParams({
        page: '1',
        pageSize: String(COLLECTIONS_PAGE_SIZE),
        includeBookmarkCount: 'true'
    });
    const res = await fetch(`${base}${COLLECTIONS_PATH}?${params.toString()}`, {
        credentials: 'include'
    });
    if (!res.ok) {
        // The API signals «collections are not in your plan» as a 403 with
        // `ENTITLEMENT_REQUIRED` (HOS-899): not an error, a locked feature.
        if (res.status === 403 && (await readError(res))?.code === 'ENTITLEMENT_REQUIRED') {
            return { kind: 'noPlan' };
        }
        throw new Error(`collections ${res.status}`);
    }
    const body = (await res.json()) as {
        readonly success: boolean;
        readonly data?: {
            readonly items: readonly BookmarkCollectionItem[];
            readonly usage?: BookmarkCollectionUsage;
        };
    };
    if (!body.success || !body.data || !Array.isArray(body.data.items)) {
        throw new Error('collections: no data');
    }
    return { kind: 'ok', items: body.data.items, usage: body.data.usage ?? null };
}
