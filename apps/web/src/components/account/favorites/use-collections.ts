/**
 * @file use-collections.ts
 * @description The user's collections and THE collections gate of the
 * favorites page (HOS-2480).
 *
 * The gate starts from what the SSR page read (so «Crear colección» never
 * flashes enabled for a user without the plan) and is then kept in sync by
 * every collections read: the list endpoint carries the usage counters, and
 * its 403 `ENTITLEMENT_REQUIRED` is the «no plan» answer. A create anywhere on
 * the page broadcasts `COLLECTION_CREATED_EVENT` (HOS-999) and this hook
 * re-reads, so the list and the gate move together.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AsyncResult, LockReason } from '@/components/account/ui';
import type {
    BookmarkCollectionItem,
    BookmarkCollectionUsage
} from '@/lib/api/endpoints-protected';
import { COLLECTION_CREATED_EVENT } from '../collection-created-event';
import { type CollectionsGate, resolveCollectionsGate } from './collections-gate';
import { fetchCollections } from './favorites-api';

/** Raw state of the collections read. */
type ReadState =
    | { readonly status: 'loading' }
    | { readonly status: 'error' }
    | { readonly status: 'noPlan' }
    | { readonly status: 'ready'; readonly items: readonly BookmarkCollectionItem[] };

/** Result of {@link useCollections}. */
export interface UseCollectionsResult {
    /** The collections region state. */
    readonly state: AsyncResult<readonly BookmarkCollectionItem[]>;
    /** The gate every create entry point reads. */
    readonly gate: CollectionsGate;
    /** Re-reads the collections (and the gate). */
    readonly refetch: () => Promise<void>;
}

/**
 * Collections + gate of the favorites page.
 *
 * @param input - Options object.
 * @param input.base - API origin without trailing slash.
 * @param input.initialGate - The gate the SSR page resolved.
 * @param input.lockReason - The plan lock reason (catalog plan names), used for `locked`.
 * @returns See {@link UseCollectionsResult}.
 */
export function useCollections({
    base,
    initialGate,
    lockReason
}: {
    readonly base: string;
    readonly initialGate: CollectionsGate;
    readonly lockReason: LockReason;
}): UseCollectionsResult {
    const [read, setRead] = useState<ReadState>(
        initialGate.kind === 'noPlan' ? { status: 'noPlan' } : { status: 'loading' }
    );
    const [gate, setGate] = useState<CollectionsGate>(initialGate);
    const mounted = useRef(true);

    const refetch = useCallback(async () => {
        try {
            const result = await fetchCollections({ base });
            if (!mounted.current) return;
            if (result.kind === 'noPlan') {
                setGate({ kind: 'noPlan' });
                setRead({ status: 'noPlan' });
                return;
            }
            setRead({ status: 'ready', items: result.items });
            setGate((prev) => nextGate({ prev, usage: result.usage }));
        } catch {
            // A failed read leaves the gate as it was: never invent a cap.
            if (mounted.current) setRead({ status: 'error' });
        }
    }, [base]);

    useEffect(() => {
        mounted.current = true;
        void refetch();
        const onCreated = () => {
            void refetch();
        };
        window.addEventListener(COLLECTION_CREATED_EVENT, onCreated);
        return () => {
            mounted.current = false;
            window.removeEventListener(COLLECTION_CREATED_EVENT, onCreated);
        };
    }, [refetch]);

    const retry = useCallback(() => {
        setRead({ status: 'loading' });
        void refetch();
    }, [refetch]);

    const state: AsyncResult<readonly BookmarkCollectionItem[]> =
        read.status === 'loading'
            ? { status: 'loading' }
            : read.status === 'error'
              ? { status: 'error', retry }
              : read.status === 'noPlan'
                ? { status: 'locked', reason: lockReason }
                : read.items.length === 0
                  ? { status: 'empty' }
                  : { status: 'ready', data: read.items };

    return { state, gate, refetch };
}

/** The gate after a successful read: usage decides; unknown usage keeps the last known one. */
function nextGate({
    prev,
    usage
}: {
    readonly prev: CollectionsGate;
    readonly usage: BookmarkCollectionUsage | null;
}): CollectionsGate {
    const known = usage ?? (prev.kind === 'noPlan' ? null : prev.usage);
    return resolveCollectionsGate({ accessDenied: false, usage: known });
}
