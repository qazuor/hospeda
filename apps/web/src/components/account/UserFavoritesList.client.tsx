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
import { userBookmarksApi } from '../../lib/api/endpoints';
import { addToast } from '../../store/toast-store';

interface UserFavoritesListProps {
    locale: 'es' | 'en' | 'pt';
}

type EntityType = 'ACCOMMODATION' | 'DESTINATION' | 'EVENT' | 'POST';

interface Bookmark {
    id: string;
    entityId: string;
    entityType: EntityType;
    displayName: string;
    notes: string | null;
    createdAt: string;
}

interface TabConfig {
    id: EntityType;
    label: string;
}

/**
 * Get localized tab labels
 */
function getTabLabels(locale: 'es' | 'en' | 'pt'): Record<EntityType, string> {
    const labels = {
        es: {
            ACCOMMODATION: 'Alojamientos',
            DESTINATION: 'Destinos',
            EVENT: 'Eventos',
            POST: 'Blog'
        },
        en: {
            ACCOMMODATION: 'Accommodations',
            DESTINATION: 'Destinations',
            EVENT: 'Events',
            POST: 'Blog'
        },
        pt: {
            ACCOMMODATION: 'Acomodações',
            DESTINATION: 'Destinos',
            EVENT: 'Eventos',
            POST: 'Blog'
        }
    };
    return labels[locale];
}

/**
 * Get localized messages
 */
function getMessages(locale: 'es' | 'en' | 'pt') {
    const messages = {
        es: {
            empty: 'No tienes favoritos en esta categoría',
            emptyAction: 'Comienza explorando contenido para guardar tus favoritos',
            delete: 'Eliminar',
            deleteSuccess: 'Favorito eliminado correctamente',
            deleteError: 'Error al eliminar el favorito',
            loadMore: 'Cargar más',
            loading: 'Cargando...',
            fetchError: 'Error al cargar los favoritos'
        },
        en: {
            empty: 'You have no favorites in this category',
            emptyAction: 'Start exploring content to save your favorites',
            delete: 'Delete',
            deleteSuccess: 'Favorite deleted successfully',
            deleteError: 'Error deleting favorite',
            loadMore: 'Load more',
            loading: 'Loading...',
            fetchError: 'Error loading favorites'
        },
        pt: {
            empty: 'Você não tem favoritos nesta categoria',
            emptyAction: 'Comece explorando conteúdo para salvar seus favoritos',
            delete: 'Excluir',
            deleteSuccess: 'Favorito excluído com sucesso',
            deleteError: 'Erro ao excluir favorito',
            loadMore: 'Carregar mais',
            loading: 'Carregando...',
            fetchError: 'Erro ao carregar favoritos'
        }
    };
    return messages[locale];
}

/**
 * User favorites list component
 */
export function UserFavoritesList({ locale }: UserFavoritesListProps) {
    const [activeTab, setActiveTab] = useState<EntityType>('ACCOMMODATION');
    const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [page, setPage] = useState(1);

    const tabLabels = getTabLabels(locale);
    const messages = getMessages(locale);

    const tabs: TabConfig[] = [
        { id: 'ACCOMMODATION', label: tabLabels.ACCOMMODATION },
        { id: 'DESTINATION', label: tabLabels.DESTINATION },
        { id: 'EVENT', label: tabLabels.EVENT },
        { id: 'POST', label: tabLabels.POST }
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
                addToast({ type: 'error', message: messages.fetchError });
            }
        } catch (error) {
            addToast({ type: 'error', message: messages.fetchError });
            console.error('Error fetching bookmarks:', error);
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
                addToast({ type: 'success', message: messages.deleteSuccess });
            } else {
                setBookmarks(previousBookmarks);
                setTotal((prev) => prev + 1);
                addToast({ type: 'error', message: messages.deleteError });
            }
        } catch (error) {
            setBookmarks(previousBookmarks);
            setTotal((prev) => prev + 1);
            addToast({ type: 'error', message: messages.deleteError });
            console.error('Error deleting bookmark:', error);
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
            <div className="mb-6 border-gray-200 border-b">
                <nav
                    className="flex gap-4"
                    role="tablist"
                    aria-label="Favorite categories"
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
                                    : 'border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900'
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
                        <span className="ml-3 text-gray-600">{messages.loading}</span>
                    </div>
                )}

                {/* Empty State */}
                {!isLoading && bookmarks.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <FavoriteIcon
                            size="xl"
                            weight="regular"
                            className="mb-4 text-gray-400"
                        />
                        <h3 className="mb-2 font-semibold text-gray-900 text-lg">
                            {messages.empty}
                        </h3>
                        <p className="max-w-md text-gray-600 text-sm">{messages.emptyAction}</p>
                    </div>
                )}

                {/* Bookmarks List */}
                {bookmarks.length > 0 && (
                    <div className="space-y-4">
                        {bookmarks.map((bookmark) => (
                            <div
                                key={bookmark.id}
                                className="rounded-lg border border-gray-200 p-4 transition-shadow hover:shadow-md"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0 flex-1">
                                        <h3 className="mb-1 truncate font-semibold text-base text-gray-900">
                                            {bookmark.displayName}
                                        </h3>
                                        {bookmark.notes && (
                                            <p className="line-clamp-2 text-gray-600 text-sm">
                                                {bookmark.notes}
                                            </p>
                                        )}
                                        <p className="mt-2 text-gray-500 text-xs">
                                            {new Date(bookmark.createdAt).toLocaleDateString(
                                                locale,
                                                {
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric'
                                                }
                                            )}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(bookmark.id)}
                                        className="flex-shrink-0 rounded-md px-3 py-1.5 font-medium text-red-600 text-sm transition-colors hover:bg-red-50 hover:text-red-700"
                                        aria-label={`${messages.delete} ${bookmark.displayName}`}
                                    >
                                        {messages.delete}
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
                            {messages.loadMore}
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
