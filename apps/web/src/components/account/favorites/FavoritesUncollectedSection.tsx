/**
 * @file FavoritesUncollectedSection.tsx
 * @description The «Sin colección» Section of the favorites page (HOS-2480):
 * kit `Tabs` per entity type, an `AsyncRegion` (Skeleton, ErrorState with
 * retry, EmptyState, the `EntityCard` grid) and server-side `Pagination`
 * (HOS-2420: every page of uncollected favorites is reachable).
 */

import { BookmarkIcon } from '@repo/icons';
import {
    AsyncRegion,
    EmptyState,
    EntityCardGrid,
    ErrorState,
    LockedState,
    Pagination,
    Section,
    Skeleton,
    type TabItem,
    Tabs
} from '@/components/account/ui';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import { FavoriteBookmarkCard } from './FavoriteBookmarkCard';
import styles from './FavoritesView.module.css';
import type { BookmarkItem } from './favorites-api';
import { FAVORITES_TABS, tabLabelKey } from './favorites-tabs';
import type { UseFavoritesListResult } from './use-favorites-list';

/** Props of {@link FavoritesUncollectedSection}. */
export interface FavoritesUncollectedSectionProps {
    /** Page locale. */
    readonly locale: SupportedLocale;
    /** API origin without trailing slash. */
    readonly apiBase: string;
    /** The list state from `useFavoritesList`. */
    readonly list: UseFavoritesListResult;
    /** Opens the «Mover» dialog for a bookmark. */
    readonly onMove?: (bookmark: BookmarkItem) => void;
    /** Asks for confirmation, then removes. */
    readonly onRemove: (bookmark: BookmarkItem) => void;
}

/**
 * The uncollected favorites Section.
 *
 * @param props - See {@link FavoritesUncollectedSectionProps}.
 * @returns A kit Section.
 */
export function FavoritesUncollectedSection({
    locale,
    apiBase,
    list,
    onMove,
    onRemove
}: FavoritesUncollectedSectionProps) {
    const { t, tPlural } = createTranslations(locale);
    const { state, counts, tab, selectTab, page, pageCount, setPage, removingIds } = list;

    const total = state.status === 'ready' ? state.data.total : state.status === 'empty' ? 0 : null;

    const panel = (
        <AsyncRegion
            state={state}
            loading={() => (
                <Skeleton
                    locale={locale}
                    shape="block"
                    lines={3}
                />
            )}
            error={({ retry }) => (
                <ErrorState
                    locale={locale}
                    onRetry={retry}
                    title={t('account.favorites.errors.fetchFailed')}
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
                    title={t('account.favorites.empty')}
                    description={t('account.favorites.emptyAction')}
                />
            )}
            locked={(reason) => (
                <LockedState
                    reason={reason}
                    locale={locale}
                />
            )}
            ready={(data) => (
                <EntityCardGrid label={t('account.favorites.listLabel')}>
                    {data.bookmarks.map((bookmark) => (
                        <FavoriteBookmarkCard
                            key={bookmark.id}
                            bookmark={bookmark}
                            locale={locale}
                            apiBase={apiBase}
                            removing={removingIds.has(bookmark.id)}
                            onMove={onMove}
                            onRemove={onRemove}
                            removeLabel={t('account.favorites.removeBtn')}
                            removeAriaLabel={t('account.favorites.removeLabel')}
                            onNoteSaved={list.applyNote}
                        />
                    ))}
                </EntityCardGrid>
            )}
        />
    );

    const items: readonly TabItem[] = FAVORITES_TABS.map((key) => {
        const count = counts[key];
        return {
            id: key,
            label: t(tabLabelKey({ tab: key })),
            panel,
            ...(count === undefined
                ? {}
                : {
                      count,
                      countLabel: tPlural('account.favorites.bookmarks.count', count, { count })
                  })
        };
    });

    return (
        <Section
            title={t('account.favorites.collections.no_collection')}
            description={
                total === null
                    ? undefined
                    : tPlural('account.favorites.bookmarks.count', total, { count: total })
            }
            helpId="section:favorites.uncollected"
        >
            <Tabs
                className={styles.typeTabs}
                items={items}
                ariaLabel={t('account.favorites.filter.label')}
                value={tab}
                onValueChange={(id) => {
                    const next = FAVORITES_TABS.find((key) => key === id);
                    if (next) selectTab(next);
                }}
            />
            {pageCount > 1 ? (
                <Pagination
                    locale={locale}
                    page={page}
                    pageCount={pageCount}
                    onPageChange={setPage}
                />
            ) : null}
        </Section>
    );
}
