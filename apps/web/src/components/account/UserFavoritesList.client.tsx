import { formatDate, toBcp47Locale } from '@repo/i18n';
import { FavoriteIcon } from '@repo/icons';
/**
 * User favorites list component with tab navigation.
 *
 * Displays user's bookmarked items filtered by entity type.
 * Supports paginated "load more" and optimistic deletion.
 *
 * @example
 * ```tsx
 * <UserFavoritesList locale="es" />
 * ```
 */
import { type FormEvent, useEffect, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { userBookmarksApi } from '../../lib/api/endpoints-protected';
import type { SupportedLocale } from '../../lib/i18n';
import { webLogger } from '../../lib/logger';
import { addToast } from '../../store/toast-store';

/** Props for the UserFavoritesList component */
interface UserFavoritesListProps {
    readonly locale: SupportedLocale;
}

/** Entity type values supported as bookmark targets */
type EntityType = 'ACCOMMODATION' | 'DESTINATION' | 'EVENT' | 'POST';

/** Normalized bookmark data for display */
interface Bookmark {
    readonly id: string;
    readonly entityId: string;
    readonly entityType: EntityType;
    readonly name: string | null;
    readonly description: string | null;
    readonly createdAt: string;
}

/** Tab configuration entry */
interface TabConfig {
    readonly id: EntityType;
    readonly label: string;
}

/** Maps entity types to i18n tab label keys */
const TAB_LABEL_KEYS: Readonly<Record<EntityType, string>> = {
    ACCOMMODATION: 'favorites.tabs.accommodation',
    DESTINATION: 'favorites.tabs.destination',
    EVENT: 'favorites.tabs.event',
    POST: 'favorites.tabs.post'
} as const;

const PAGE_SIZE = 12 as const;

/**
 * User favorites list component.
 *
 * Renders a tabbed interface for browsing and managing bookmarks grouped
 * by entity type. Uses optimistic UI for deletion and "load more" pagination.
 *
 * @param props - Component props.
 * @param props.locale - Active locale for translations and date formatting.
 */
export function UserFavoritesList({ locale }: UserFavoritesListProps) {
    const { t } = useTranslation({ locale, namespace: 'account' });

    const [activeTab, setActiveTab] = useState<EntityType>('ACCOMMODATION');
    const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [page, setPage] = useState(1);

    const tabs: TabConfig[] = [
        { id: 'ACCOMMODATION', label: t(TAB_LABEL_KEYS.ACCOMMODATION) },
        { id: 'DESTINATION', label: t(TAB_LABEL_KEYS.DESTINATION) },
        { id: 'EVENT', label: t(TAB_LABEL_KEYS.EVENT) },
        { id: 'POST', label: t(TAB_LABEL_KEYS.POST) }
    ];

    /**
     * Fetch bookmarks for the active tab.
     *
     * @param resetPage - When true, resets the list to page 1 (tab change).
     */
    const fetchBookmarks = async (resetPage = false) => {
        setIsLoading(true);
        try {
            const currentPage = resetPage ? 1 : page;
            const result = await userBookmarksApi.list({
                entityType: activeTab,
                page: currentPage,
                pageSize: PAGE_SIZE
            });

            if (result.ok && result.data) {
                const fetched = result.data.bookmarks as unknown as Bookmark[];
                setBookmarks(resetPage ? fetched : (prev) => [...prev, ...fetched]);
                setTotal(result.data.total);
                if (!resetPage) {
                    setPage(currentPage + 1);
                }
            } else {
                addToast({ type: 'error', message: t('favorites.fetchError') });
            }
        } catch (error) {
            addToast({ type: 'error', message: t('favorites.fetchError') });
            webLogger.error('Error fetching bookmarks:', error);
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Switch to a different entity-type tab and reset list state.
     *
     * @param tabId - The entity type tab to activate.
     */
    const handleTabChange = (tabId: EntityType) => {
        setActiveTab(tabId);
        setBookmarks([]);
        setPage(1);
    };

    /**
     * Delete a bookmark with optimistic UI rollback on failure.
     *
     * @param bookmarkId - The ID of the bookmark to delete.
     */
    const handleDelete = async (bookmarkId: string) => {
        const snapshot = [...bookmarks];

        setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
        setTotal((prev) => prev - 1);

        try {
            const result = await userBookmarksApi.delete({ id: bookmarkId });

            if (result.ok) {
                addToast({ type: 'success', message: t('favorites.deleteSuccess') });
            } else {
                setBookmarks(snapshot);
                setTotal((prev) => prev + 1);
                addToast({ type: 'error', message: t('favorites.deleteError') });
            }
        } catch (error) {
            setBookmarks(snapshot);
            setTotal((prev) => prev + 1);
            addToast({ type: 'error', message: t('favorites.deleteError') });
            webLogger.error('Error deleting bookmark:', error);
        }
    };

    /**
     * Trigger load-more fetch for the current tab.
     *
     * @param e - Form submit event to prevent default navigation.
     */
    const handleLoadMore = (e: FormEvent) => {
        e.preventDefault();
        fetchBookmarks();
    };

    // biome-ignore lint/correctness/useExhaustiveDependencies: refetch intentionally when activeTab changes; fetchBookmarks captures latest state via closure
    useEffect(() => {
        fetchBookmarks(true);
    }, [activeTab]);

    const hasMore = bookmarks.length < total;

    return (
        <div className="user-favorites-list">
            {/* Tab Navigation */}
            <div className="mb-6 border-border border-b">
                <nav
                    className="flex gap-4"
                    role="tablist"
                    aria-label={t('accessibility.favoriteCategories')}
                >
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === tab.id}
                            aria-controls={`panel-${tab.id}`}
                            onClick={() => handleTabChange(tab.id)}
                            className={`border-b-2 px-4 py-3 font-medium text-sm transition-colors ${
                                activeTab === tab.id
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-text-secondary hover:border-border hover:text-text'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Panel */}
            <div
                id={`panel-${activeTab}`}
                role="tabpanel"
                aria-labelledby={`tab-${activeTab}`}
            >
                {/* Loading State (initial) */}
                {isLoading && bookmarks.length === 0 && (
                    <div className="flex items-center justify-center py-12">
                        <div className="h-12 w-12 animate-spin rounded-full border-primary border-b-2" />
                        <span className="ml-3 text-text-secondary">{t('favorites.loading')}</span>
                    </div>
                )}

                {/* Empty State */}
                {!isLoading && bookmarks.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <FavoriteIcon
                            size="xl"
                            weight="regular"
                            className="mb-4 text-text-tertiary"
                        />
                        <h3 className="mb-2 font-semibold text-lg text-text">
                            {t('favorites.empty')}
                        </h3>
                        <p className="max-w-md text-sm text-text-secondary">
                            {t('favorites.emptyAction')}
                        </p>
                    </div>
                )}

                {/* Bookmarks List */}
                {bookmarks.length > 0 && (
                    <div className="space-y-4">
                        {bookmarks.map((bookmark) => (
                            <div
                                key={bookmark.id}
                                className="rounded-lg border border-border p-4 transition-shadow hover:shadow-md"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0 flex-1">
                                        <h3 className="mb-1 truncate font-semibold text-base text-text">
                                            {bookmark.name ??
                                                `${t(TAB_LABEL_KEYS[bookmark.entityType])} #${bookmark.entityId.slice(0, 8)}`}
                                        </h3>
                                        {bookmark.description && (
                                            <p className="line-clamp-2 text-sm text-text-secondary">
                                                {bookmark.description}
                                            </p>
                                        )}
                                        <p className="mt-2 text-text-tertiary text-xs">
                                            {formatDate({
                                                date: bookmark.createdAt,
                                                locale: toBcp47Locale(locale),
                                                options: {
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric'
                                                }
                                            })}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(bookmark.id)}
                                        className="flex-shrink-0 rounded-md px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/10"
                                        aria-label={`${t('favorites.delete')} ${bookmark.name ?? bookmark.entityId}`}
                                    >
                                        {t('favorites.delete')}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Load More Button */}
                {hasMore && !isLoading && (
                    <div className="mt-8 flex justify-center">
                        <button
                            type="button"
                            onClick={handleLoadMore}
                            className="rounded-lg bg-primary px-6 py-2.5 font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                        >
                            {t('favorites.loadMore')}
                        </button>
                    </div>
                )}

                {/* Loading More Indicator */}
                {isLoading && bookmarks.length > 0 && (
                    <div className="flex items-center justify-center py-8">
                        <div className="h-8 w-8 animate-spin rounded-full border-primary border-b-2" />
                    </div>
                )}
            </div>
        </div>
    );
}
