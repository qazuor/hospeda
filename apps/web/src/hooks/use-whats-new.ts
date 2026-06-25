import { getApiUrl } from '@/lib/env';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface WhatsNewItem {
    readonly id: string;
    readonly title: string;
    readonly body: string;
    readonly image?: string;
    readonly publishedAt: string;
    readonly highlight: boolean;
    readonly seen: boolean;
}

interface UseWhatsNewReturn {
    readonly items: readonly WhatsNewItem[];
    readonly unseenCount: number;
    readonly isLoading: boolean;
    readonly error: Error | null;
    readonly markSeen: (entryIds: readonly string[]) => void;
    readonly markAllSeen: () => void;
}

const CACHE_TTL = 60_000;
const WHATS_NEW_EVENT = 'hospeda:whats-new-updated';

interface CacheEntry {
    readonly data: readonly WhatsNewItem[];
    readonly timestamp: number;
}

let sharedCache: CacheEntry | null = null;

function getCached(): readonly WhatsNewItem[] | null {
    if (!sharedCache) return null;
    if (Date.now() - sharedCache.timestamp > CACHE_TTL) {
        sharedCache = null;
        return null;
    }
    return sharedCache.data;
}

function setCache(data: readonly WhatsNewItem[]): void {
    sharedCache = { data, timestamp: Date.now() };
}

function emitWhatsNewUpdate(data: readonly WhatsNewItem[]): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
        new CustomEvent<readonly WhatsNewItem[]>(WHATS_NEW_EVENT, { detail: data })
    );
}

export function clearWhatsNewCache(): void {
    sharedCache = null;
}

export function useWhatsNew(): UseWhatsNewReturn {
    const [items, setItems] = useState<readonly WhatsNewItem[]>(() => getCached() ?? []);
    const [isLoading, setIsLoading] = useState<boolean>(() => !getCached());
    const [error, setError] = useState<Error | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        function handleUpdate(event: Event): void {
            const customEvent = event as CustomEvent<readonly WhatsNewItem[]>;
            const nextItems = customEvent.detail;
            setCache(nextItems);
            setItems(nextItems);
            setIsLoading(false);
        }

        window.addEventListener(WHATS_NEW_EVENT, handleUpdate as EventListener);
        return () => {
            window.removeEventListener(WHATS_NEW_EVENT, handleUpdate as EventListener);
        };
    }, []);

    useEffect(() => {
        const cached = getCached();
        if (cached) {
            setItems(cached);
            setIsLoading(false);
            return;
        }

        let cancelled = false;

        async function fetchWhatsNew(): Promise<void> {
            try {
                const res = await fetch(`${getApiUrl()}/api/v1/protected/whats-new`, {
                    credentials: 'include'
                });

                if (cancelled || !mountedRef.current) return;

                if (!res.ok) {
                    throw new Error(`Failed to fetch What's New: ${res.status}`);
                }

                const body = (await res.json()) as { readonly data?: readonly WhatsNewItem[] };
                const data = body.data ?? [];

                setCache(data);
                if (!cancelled && mountedRef.current) {
                    setItems(data);
                    setError(null);
                    setIsLoading(false);
                }
            } catch (err) {
                if (cancelled || !mountedRef.current) return;
                setError(err instanceof Error ? err : new Error(String(err)));
                setIsLoading(false);
            }
        }

        void fetchWhatsNew();

        return () => {
            cancelled = true;
        };
    }, []);

    const unseenCount = items.filter((item) => !item.seen).length;

    const markSeen = useCallback((entryIds: readonly string[]): void => {
        if (entryIds.length === 0) return;

        setItems((prev) => {
            const nextItems = prev.map((item) =>
                entryIds.includes(item.id) ? { ...item, seen: true } : item
            );
            setCache(nextItems);
            emitWhatsNewUpdate(nextItems);
            return nextItems;
        });

        fetch(`${getApiUrl()}/api/v1/protected/users/me/whats-new-seen`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entryIds })
        }).catch(() => {});
    }, []);

    const markAllSeen = useCallback((): void => {
        const unseenIds = items.filter((item) => !item.seen).map((item) => item.id);
        if (unseenIds.length > 0) {
            markSeen(unseenIds);
        }
    }, [items, markSeen]);

    return { items, unseenCount, isLoading, error, markSeen, markAllSeen };
}
