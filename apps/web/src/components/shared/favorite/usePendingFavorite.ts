/**
 * @file usePendingFavorite.ts
 * @description Applies the favorite a guest tapped before signing in (HOS-1925).
 *
 * The heart saves a `favorite` pending action when a guest taps it. After
 * sign-in the guest lands back on the page; once the session and the heart's own
 * status are resolved, the heart that matches the saved entity applies it once.
 * Client-only: it never runs during SSR, so cacheable pages stay session-blind.
 */

import { useEffect, useRef } from 'react';
import { takePendingAction } from '@/lib/pending-action';
import type { FavoriteEntityType } from '@/store/favorites-store';
import { getFavoriteStatus } from '@/store/favorites-store';

/** Parameters for {@link usePendingFavorite}. */
export interface UsePendingFavoriteParams {
    readonly entityType: FavoriteEntityType;
    readonly entityId: string;
    /** True only once the session is known AND belongs to a signed-in user. */
    readonly isAuthenticated: boolean;
    /** Whether the heart's own status is still resolving. */
    readonly isResolving: boolean;
    /** Performs the favorite. Must itself be idempotent against server state. */
    readonly apply: () => Promise<void>;
}

/** Take and apply the pending favorite for this entity, at most once. */
export function usePendingFavorite({
    entityType,
    entityId,
    isAuthenticated,
    isResolving,
    apply
}: UsePendingFavoriteParams): void {
    const applyRef = useRef(apply);
    applyRef.current = apply;

    useEffect(() => {
        if (!isAuthenticated || isResolving) return;
        // The render's `isResolving` can predate the store registering this
        // entity; the store is the fresh source.
        if (getFavoriteStatus({ entityType, entityId }).isResolving) return;

        const taken = takePendingAction({
            path: window.location.pathname,
            matches: (action) =>
                action.kind === 'favorite' &&
                action.entityType === entityType &&
                action.entityId === entityId
        });
        if (taken) void applyRef.current();
    }, [isAuthenticated, isResolving, entityType, entityId]);
}
