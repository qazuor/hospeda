import { formatDate, toBcp47Locale } from '@repo/i18n';
import { FavoriteIcon } from '@repo/icons';
/**
 * User favorites list component with tab navigation
 *
 * Displays user's bookmarked items with filtering by entity type.
 * Supports pagination with load more functionality and optimistic deletion.
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

interface UserFavoritesListProps {
    locale: 'es' | 'en' | 'pt';
}

type EntityType = 'ACCOMMODATION' | 'DESTINATION' | 'EVENT' | 'POST';

interface Bookmark {
    id: string;
    entityId: string;
    entityType: EntityType;
    name: string | null;
    description: string | null;
    createdAt: string;
}

interface TabConfig {
    id: EntityType;
    label: string;
}

/** Maps entity types to i18n tab label keys */
const TAB_LABEL_KEYS: Readonly<Record<EntityType, string>> = {
    ACCOMMODATION: 'favorites.tabs.accommodation',
    DESTINATION: 'favorites.tabs.destination',
    EVENT: 'favorites.tabs.event',
    POST: 'favorites.tabs.post'
} as const;

/**
 * User favorites list component
 */
export function UserFavoritesList({ locale }: UserFavoritesListProps) {
    const { t } = useTranslation({ locale: locale as SupportedLocale, namespace: 'account' });
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
     * Fetch bookmarks for active tab
     */
    const fetchBookmarks = async (resetPage = false) => {
        setIsLoading(true);
        try {
            const currentPage = resetPage ? 1 : page;
            const result = await userBookmarksApi.list({
                entityType: activeTab,
                page: currentPage,
                pageSize: 12
            });

            if (result.ok && result.data) {
                const newBookmarks = result.data.bookmarks as unknown as Bookmark[];
                setBookmarks(resetPage ? newBookmarks : [...bookmarks, ...newBookmarks]);
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
     * Handle tab change
     */
    const handleTabChange = (tabId: EntityType) => {
        setActiveTab(tabId);
        setBookmarks([]);
        setPage(1);
    };

    /**
     * Handle bookmark deletion with optimistic removal
     */
    const handleDelete = async (bookmarkId: string) => {
        const previousBookmarks = [...bookmarks];

        setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
        setTotal((prev) => prev - 1);

        try {
            const result = await userBookmarksApi.delete({ id: bookmarkId });

            if (result.ok) {
                addToast({ type: 'success', message: t('favorites.deleteSuccess') });
            } else {
                setBookmarks(previousBookmarks);
                setTotal((prev) => prev + 1);
                addToast({ type: 'error', message: t('favorites.deleteError') });
            }
        } catch (error) {
            setBookmarks(previousBookmarks);
            setTotal((prev) => prev + 1);
            addToast({ type: 'error', message: t('favorites.deleteError') });
            webLogger.error('Error deleting bookmark:', error);
        }
    };

    /**
     * Load more bookmarks
     */
    const handleLoadMore = (e: FormEvent) => {
        e.preventDefault();
        fetchBookmarks();
    };

    // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally refetch when activeTab changes; fetchBookmarks captures latest state via closure
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
                            className={`px-4 py-3 font-medium text-sm transition-colors border-b-2${
                                activeTab === tab.id
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-text-secondary hover:border-border hover:text-text'
                            }
							`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Content */}
            <div
                id={`panel-${activeTab}`}
                role="tabpanel"
                aria-labelledby={`tab-${activeTab}`}
            >
                {/* Loading State */}
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
                                            {bookmark.name ||
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
                                        className="flex-shrink-0 rounded-md px-3 py-1.5 font-medium text-red-600 text-sm transition-colors hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/20 dark:hover:text-red-300"
                                        aria-label={`${t('favorites.delete')} ${bookmark.name || bookmark.entityId}`}
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
                            className="rounded-lg bg-primary px-6 py-2.5 font-medium text-white transition-colors hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
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
