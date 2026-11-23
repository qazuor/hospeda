/**
 * @file FavoritesView.client.tsx
 * @description The favorites page island on the account kit (HOS-2480).
 *
 * One `PageHeader` (the only `h1`) with «Crear colección», then two flat
 * Sections: «Sin colección» (type tabs, EntityCard grid, server pagination)
 * and «Mis colecciones» (the ONE plan `LockedState` when the plan has no
 * collections). «Crear colección» and the «Mover» dialog read the same gate
 * (`collections-gate.ts`). Removing a favorite asks first through `useConfirm`
 * (HOS-2429); notes autosave on blur (HOS-2445).
 *
 * The page stays session-blind beyond its existing auth gate: per-user data
 * is read here, in the browser, except the SSR gate seed the page passes in.
 *
 * Hydration: `client:load`.
 */

import { useCallback, useMemo, useState } from 'react';
import { PageHeader, useConfirm } from '@/components/account/ui';
import type { BookmarkCollectionUsage } from '@/lib/api/endpoints-protected';
import { translateApiError } from '@/lib/api-errors';
import { useSingleFlight } from '@/lib/forms/use-single-flight';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { addToast } from '@/store/toast-store';
import { MoveToCollectionModal } from '../MoveToCollectionModal.client';
import { CreateCollectionAction } from './CreateCollectionAction';
import { collectionsPlanLockReason, resolveCollectionsGate } from './collections-gate';
import { FavoritesCollectionsSection } from './FavoritesCollectionsSection';
import { FavoritesUncollectedSection } from './FavoritesUncollectedSection';
import styles from './FavoritesView.module.css';
import { type BookmarkItem, FavoritesApiError } from './favorites-api';
import { useCollections } from './use-collections';
import { useFavoritesList } from './use-favorites-list';

/** Props of {@link FavoritesView}. */
export interface FavoritesViewProps {
    /** Page locale. */
    readonly locale: SupportedLocale;
    /** API origin. */
    readonly apiUrl: string;
    /** Catalog names of the plans that carry collections (read by the SSR page, HOS-2544). */
    readonly gatePlanNames?: readonly string[];
    /** Usage the SSR page read, or null when unknown. */
    readonly initialUsage: BookmarkCollectionUsage | null;
    /** True when the SSR read answered `ENTITLEMENT_REQUIRED`. */
    readonly initialAccessDenied: boolean;
}

/**
 * The favorites page.
 *
 * @param props - See {@link FavoritesViewProps}.
 * @returns The page header and its Sections.
 */
export function FavoritesView({
    locale,
    apiUrl,
    gatePlanNames = [],
    initialUsage,
    initialAccessDenied
}: FavoritesViewProps) {
    const t = createT(locale);
    const base = apiUrl.replace(/\/$/, '');
    const list = useFavoritesList({ base });
    const lockReason = useMemo(
        () => collectionsPlanLockReason({ t, locale, planNames: gatePlanNames }),
        [t, locale, gatePlanNames]
    );
    const initialGate = useMemo(
        () => resolveCollectionsGate({ accessDenied: initialAccessDenied, usage: initialUsage }),
        [initialAccessDenied, initialUsage]
    );
    const collections = useCollections({ base, initialGate, lockReason });
    const { confirm: askConfirm, confirmDialog } = useConfirm({ locale });
    const runSingleFlight = useSingleFlight();
    const [toMove, setToMove] = useState<BookmarkItem | null>(null);

    const handleRemove = useCallback(
        async (bookmark: BookmarkItem) => {
            // HOS-2429: removing also drops the note, instantly and for good.
            // A double click must not stack two dialogs.
            const hasNote = Boolean(bookmark.description?.trim());
            const confirmed = await runSingleFlight(() =>
                askConfirm({
                    title: t('account.favorites.removeFavoriteConfirm.title'),
                    description: hasNote
                        ? t('account.favorites.removeFavoriteConfirm.messageWithNote')
                        : t('account.favorites.removeFavoriteConfirm.message'),
                    confirmLabel: t('account.favorites.removeFavoriteConfirm.confirm')
                })
            );
            if (!confirmed) return;
            try {
                await list.remove(bookmark);
            } catch (err) {
                addToast({
                    type: 'error',
                    message: translateApiError({
                        error: err instanceof FavoritesApiError ? err.apiError : undefined,
                        t,
                        fallback: t('account.favorites.errors.removeFailed')
                    })
                });
            }
        },
        [askConfirm, list, runSingleFlight, t]
    );

    const handleMoved = useCallback(
        ({
            newCollectionId,
            newCollectionName
        }: {
            readonly newCollectionId: string | null;
            readonly newCollectionName: string | null;
        }) => {
            if (toMove) list.applyMove({ bookmark: toMove, collectionId: newCollectionId });
            void collections.refetch();
            addToast({
                type: 'success',
                message:
                    newCollectionId === null || newCollectionName === null
                        ? t('account.favorites.collections.moveSuccessUncollected')
                        : t('account.favorites.collections.moveSuccess', undefined, {
                              name: newCollectionName
                          })
            });
            setToMove(null);
        },
        [toMove, list, collections, t]
    );

    const moveOptions =
        collections.state.status === 'ready'
            ? collections.state.data.map((c) => ({
                  id: c.id,
                  name: c.name,
                  color: c.color,
                  icon: c.icon,
                  bookmarkCount: c.bookmarkCount
              }))
            : [];

    return (
        <div className={styles.page}>
            <PageHeader
                title={t('account.pages.favorites.title')}
                locale={locale}
                actions={
                    <CreateCollectionAction
                        locale={locale}
                        gate={collections.gate}
                        gatePlanNames={gatePlanNames}
                    />
                }
            />
            <FavoritesUncollectedSection
                locale={locale}
                apiBase={base}
                list={list}
                onMove={setToMove}
                onRemove={(bookmark) => {
                    void handleRemove(bookmark);
                }}
            />
            <FavoritesCollectionsSection
                locale={locale}
                state={collections.state}
                gate={collections.gate}
            />
            {toMove === null ? null : (
                <MoveToCollectionModal
                    isOpen
                    onClose={() => setToMove(null)}
                    onSaved={handleMoved}
                    locale={locale}
                    bookmarkId={toMove.id}
                    currentCollectionId={toMove.collectionId ?? null}
                    collections={moveOptions}
                    gate={collections.gate}
                    gatePlanNames={gatePlanNames}
                />
            )}
            {confirmDialog}
        </div>
    );
}
