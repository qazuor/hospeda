/**
 * @file CollectionDetailView.client.tsx
 * @description The collection detail page on the account kit (HOS-2480).
 *
 * The SSR page reads the collection (and redirects a missing or foreign one);
 * this island draws it: one `PageHeader` with a real back link (it replaces
 * the shared `Breadcrumbs` here) and the Edit/Delete actions, then one
 * Section with URL type tabs (`NavTabs`, every type of HOS-2423), an
 * `AsyncRegion` over the read and link `Pagination`. A failed read is
 * `ErrorState` with a retry (a reload), never an empty collection (AC-2).
 * Removing a favorite from the collection asks first through `useConfirm`.
 *
 * Hydration: `client:load`.
 */

import { BookmarkIcon } from '@repo/icons';
import { useState } from 'react';
import {
    AsyncRegion,
    type AsyncResult,
    EmptyState,
    EntityCardGrid,
    ErrorState,
    LockedState,
    NavTabs,
    PageHeader,
    Pagination,
    Section,
    Skeleton,
    useConfirm
} from '@/components/account/ui';
import {
    COLLECTION_ENTITY_TYPES,
    COLLECTION_FILTER_LABELS,
    type CollectionEntityType
} from '@/lib/collection-entity-types';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import { buildUrl, buildUrlWithParams } from '@/lib/urls';
import { CollectionDetailActions } from '../CollectionDetailActions.client';
import type { CollectionForEdit } from '../CreateEditCollectionModal.client';
import { FavoriteBookmarkCard } from './FavoriteBookmarkCard';
import type { BookmarkItem } from './favorites-api';

/** What the SSR page read. */
export type CollectionDetailRead =
    | {
          readonly ok: true;
          readonly collection: CollectionForEdit;
          readonly bookmarks: readonly BookmarkItem[];
          readonly total: number;
          readonly totalPages: number;
      }
    | { readonly ok: false };

/** Props of {@link CollectionDetailView}. */
export interface CollectionDetailViewProps {
    /** Page locale. */
    readonly locale: SupportedLocale;
    /** API origin. */
    readonly apiUrl: string;
    /** The collection id from the route. */
    readonly collectionId: string;
    /** The SSR read. */
    readonly read: CollectionDetailRead;
    /** The active type filter, if any. */
    readonly activeEntityType?: CollectionEntityType;
    /** Current page, 1-based. */
    readonly currentPage: number;
}

/**
 * The collection detail page.
 *
 * @param props - See {@link CollectionDetailViewProps}.
 * @returns The page header and its Section.
 */
export function CollectionDetailView({
    locale,
    apiUrl,
    collectionId,
    read,
    activeEntityType,
    currentPage
}: CollectionDetailViewProps) {
    const { t, tPlural } = createTranslations(locale);
    const base = apiUrl.replace(/\/$/, '');
    const { confirm: askConfirm, confirmDialog } = useConfirm({ locale });
    const [removingId, setRemovingId] = useState<string | null>(null);
    const path = `mi-cuenta/favoritos/colecciones/${collectionId}`;

    const hrefFor = (params: { readonly type?: string; readonly page?: number }) => {
        const query: Record<string, string> = {};
        if (params.type) query.entityType = params.type;
        if (params.page && params.page > 1) query.bookmarksPage = String(params.page);
        return Object.keys(query).length === 0
            ? buildUrl({ locale, path })
            : buildUrlWithParams({ locale, path, params: query });
    };

    const tabs = [
        {
            href: hrefFor({}),
            label: t('account.favorites.filter.all'),
            current: activeEntityType === undefined
        },
        ...COLLECTION_ENTITY_TYPES.map((type) => ({
            href: hrefFor({ type }),
            label: t(COLLECTION_FILTER_LABELS[type].key),
            current: type === activeEntityType
        }))
    ];

    const state: AsyncResult<readonly BookmarkItem[]> = read.ok
        ? read.bookmarks.length === 0
            ? { status: 'empty' }
            : { status: 'ready', data: read.bookmarks }
        : { status: 'error', retry: () => window.location.reload() };

    async function handleRemove(bookmark: BookmarkItem): Promise<void> {
        const done = await askConfirm({
            title: t('account.favorites.collections.removeConfirmTitle'),
            description: t('account.favorites.collections.removeConfirm'),
            confirmLabel: t('account.favorites.collections.removeConfirmButton'),
            onConfirm: async () => {
                setRemovingId(bookmark.id);
                try {
                    const res = await fetch(
                        `${base}/api/v1/protected/user-bookmark-collections/${collectionId}/bookmarks/${bookmark.id}`,
                        {
                            method: 'DELETE',
                            credentials: 'include',
                            headers: { Accept: 'application/json' }
                        }
                    );
                    // A rejection keeps the dialog open with its error and retry.
                    if (!res.ok) throw new Error(`remove ${res.status}`);
                } finally {
                    setRemovingId(null);
                }
            }
        });
        if (done) window.location.reload();
    }

    return (
        <>
            <PageHeader
                title={
                    read.ok ? read.collection.name : t('account.favorites.collections.errorTitle')
                }
                description={read.ok ? (read.collection.description ?? undefined) : undefined}
                locale={locale}
                back={{
                    label: t('account.favorites.collections.backToList'),
                    href: buildUrl({ locale, path: 'mi-cuenta/favoritos' })
                }}
                actions={
                    read.ok ? (
                        <CollectionDetailActions
                            collection={read.collection}
                            locale={locale}
                        />
                    ) : undefined
                }
            />
            <Section
                title={t('account.favorites.collections.detailSectionTitle')}
                description={
                    read.ok
                        ? tPlural('account.favorites.bookmarks.count', read.total, {
                              count: read.total
                          })
                        : undefined
                }
                helpId="section:favorites.collection"
            >
                {read.ok ? (
                    <NavTabs
                        items={tabs}
                        ariaLabel={t('account.favorites.filter.label')}
                    />
                ) : null}
                <AsyncRegion
                    state={state}
                    loading={() => <Skeleton locale={locale} />}
                    error={({ retry }) => (
                        <ErrorState
                            locale={locale}
                            onRetry={retry}
                            description={t('account.favorites.collections.fetchError')}
                        />
                    )}
                    empty={() => (
                        <EmptyState
                            icon={
                                <BookmarkIcon
                                    size={28}
                                    aria-hidden={true}
                                />
                            }
                            title={t('account.favorites.collections.emptyBookmarks')}
                        />
                    )}
                    locked={(reason) => (
                        <LockedState
                            reason={reason}
                            locale={locale}
                        />
                    )}
                    ready={(bookmarks) => (
                        <EntityCardGrid label={t('account.favorites.listLabel')}>
                            {bookmarks.map((bookmark) => (
                                <FavoriteBookmarkCard
                                    key={bookmark.id}
                                    bookmark={bookmark}
                                    locale={locale}
                                    apiBase={base}
                                    removing={removingId === bookmark.id}
                                    onRemove={(target) => {
                                        void handleRemove(target);
                                    }}
                                    removeLabel={t(
                                        'account.favorites.collections.removeFromCollection'
                                    )}
                                    removeAriaLabel={t(
                                        'account.favorites.collections.removeFromCollection'
                                    )}
                                    removeTestId="collection-bookmark-remove-btn"
                                />
                            ))}
                        </EntityCardGrid>
                    )}
                />
                {read.ok && read.totalPages > 1 ? (
                    <Pagination
                        locale={locale}
                        page={Math.min(currentPage, read.totalPages)}
                        pageCount={read.totalPages}
                        hrefFor={(page) => hrefFor({ type: activeEntityType, page })}
                    />
                ) : null}
            </Section>
            {confirmDialog}
        </>
    );
}
