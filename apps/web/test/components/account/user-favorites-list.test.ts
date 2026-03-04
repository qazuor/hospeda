/**
 * Tests for UserFavoritesList.client.tsx
 *
 * Verifies component structure, exports, props interface, i18n integration,
 * accessibility attributes, API integration, tab navigation, and deletion patterns.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(
    __dirname,
    '../../../src/components/account/UserFavoritesList.client.tsx'
);
const content = readFileSync(componentPath, 'utf8');

describe('UserFavoritesList.client.tsx', () => {
    describe('Module exports', () => {
        it('should export UserFavoritesList as named export', () => {
            expect(content).toContain('export function UserFavoritesList(');
        });

        it('should not use default export', () => {
            expect(content).not.toContain('export default');
        });
    });

    describe('Props interface', () => {
        it('should define UserFavoritesListProps interface', () => {
            expect(content).toContain('interface UserFavoritesListProps');
        });

        it('should define locale prop with supported locales', () => {
            expect(content).toContain("locale: 'es' | 'en' | 'pt'");
        });
    });

    describe('Imports', () => {
        it('should import useState and useEffect from react', () => {
            expect(content).toContain('useState');
            expect(content).toContain('useEffect');
        });

        it('should import FavoriteIcon from @repo/icons', () => {
            expect(content).toContain("import { FavoriteIcon } from '@repo/icons'");
        });

        it('should import userBookmarksApi from endpoints', () => {
            expect(content).toContain(
                "import { userBookmarksApi } from '../../lib/api/endpoints-protected'"
            );
        });

        it('should import addToast from toast store', () => {
            expect(content).toContain("import { addToast } from '../../store/toast-store'");
        });

        it('should import useTranslation hook', () => {
            expect(content).toContain(
                "import { useTranslation } from '../../hooks/useTranslation'"
            );
        });

        it('should import formatDate from @repo/i18n', () => {
            expect(content).toContain('formatDate');
            expect(content).toContain("from '@repo/i18n'");
        });
    });

    describe('i18n integration', () => {
        it('should use useTranslation with account namespace', () => {
            expect(content).toContain("namespace: 'account'");
        });

        it('should destructure t from useTranslation', () => {
            expect(content).toContain('const { t } = useTranslation(');
        });

        it('should use t() for accommodation tab label', () => {
            expect(content).toContain("'favorites.tabs.accommodation'");
        });

        it('should use t() for destination tab label', () => {
            expect(content).toContain("'favorites.tabs.destination'");
        });

        it('should use t() for event tab label', () => {
            expect(content).toContain("'favorites.tabs.event'");
        });

        it('should use t() for post tab label', () => {
            expect(content).toContain("'favorites.tabs.post'");
        });

        it('should use t() for empty state message', () => {
            expect(content).toContain("t('favorites.empty')");
        });

        it('should use t() for empty action message', () => {
            expect(content).toContain("t('favorites.emptyAction')");
        });

        it('should use t() for delete button text', () => {
            expect(content).toContain("t('favorites.delete')");
        });

        it('should use t() for delete success message', () => {
            expect(content).toContain("t('favorites.deleteSuccess')");
        });

        it('should use t() for delete error message', () => {
            expect(content).toContain("t('favorites.deleteError')");
        });

        it('should use t() for load more button text', () => {
            expect(content).toContain("t('favorites.loadMore')");
        });

        it('should use t() for loading text', () => {
            expect(content).toContain("t('favorites.loading')");
        });

        it('should use t() for fetch error message', () => {
            expect(content).toContain("t('favorites.fetchError')");
        });

        it('should define TAB_LABEL_KEYS mapping entity types to i18n keys', () => {
            expect(content).toContain('TAB_LABEL_KEYS');
        });

        it('should not contain hardcoded Spanish localization strings', () => {
            expect(content).not.toContain('No tienes favoritos en esta categoría');
            expect(content).not.toContain('Favorito eliminado correctamente');
            expect(content).not.toContain('Error al eliminar el favorito');
        });

        it('should not contain hardcoded English localization strings', () => {
            expect(content).not.toContain('You have no favorites in this category');
            expect(content).not.toContain('Favorite deleted successfully');
        });

        it('should not contain hardcoded Portuguese localization strings', () => {
            expect(content).not.toContain('Você não tem favoritos nesta categoria');
            expect(content).not.toContain('Favorito excluído com sucesso');
        });
    });

    describe('Internal types', () => {
        it('should define EntityType union type', () => {
            expect(content).toContain(
                "type EntityType = 'ACCOMMODATION' | 'DESTINATION' | 'EVENT' | 'POST'"
            );
        });

        it('should define Bookmark interface with id field', () => {
            expect(content).toContain('id: string');
        });

        it('should define Bookmark interface with entityId field', () => {
            expect(content).toContain('entityId: string');
        });

        it('should define Bookmark interface with entityType field', () => {
            expect(content).toContain('entityType: EntityType');
        });

        it('should define Bookmark interface with name field', () => {
            expect(content).toContain('name: string | null');
        });

        it('should define Bookmark interface with description field', () => {
            expect(content).toContain('description: string | null');
        });

        it('should define Bookmark interface with createdAt field', () => {
            expect(content).toContain('createdAt: string');
        });

        it('should define TabConfig interface', () => {
            expect(content).toContain('interface TabConfig');
        });
    });

    describe('Tab navigation', () => {
        it('should initialize activeTab to ACCOMMODATION', () => {
            expect(content).toContain("useState<EntityType>('ACCOMMODATION')");
        });

        it('should have all 4 tabs defined', () => {
            expect(content).toContain("{ id: 'ACCOMMODATION'");
            expect(content).toContain("{ id: 'DESTINATION'");
            expect(content).toContain("{ id: 'EVENT'");
            expect(content).toContain("{ id: 'POST'");
        });

        it('should have handleTabChange function', () => {
            expect(content).toContain('const handleTabChange = (tabId: EntityType)');
        });

        it('should reset bookmarks when tab changes', () => {
            expect(content).toContain('setBookmarks([])');
        });

        it('should reset page to 1 on tab change', () => {
            expect(content).toContain('setPage(1)');
        });

        it('should fetch bookmarks when activeTab changes via useEffect', () => {
            expect(content).toContain('useEffect(() => {');
            expect(content).toContain('}, [activeTab])');
        });
    });

    describe('Accessibility', () => {
        it('should have tablist role on nav element', () => {
            expect(content).toContain('role="tablist"');
        });

        it('should have aria-label on tablist nav using t()', () => {
            expect(content).toContain("aria-label={t('accessibility.favoriteCategories')}");
        });

        it('should have tab role on tab buttons', () => {
            expect(content).toContain('role="tab"');
        });

        it('should have aria-selected on tab buttons', () => {
            expect(content).toContain('aria-selected={activeTab === tab.id}');
        });

        it('should have aria-controls on tab buttons', () => {
            expect(content).toContain('aria-controls={`panel-${tab.id}`}');
        });

        it('should have tabpanel role on content panel', () => {
            expect(content).toContain('role="tabpanel"');
        });

        it('should have aria-labelledby on tabpanel', () => {
            expect(content).toContain('aria-labelledby={`tab-${activeTab}`}');
        });

        it('should have aria-label on delete buttons using t()', () => {
            expect(content).toContain("t('favorites.delete')");
            expect(content).toContain('aria-label={`');
        });
    });

    describe('API integration', () => {
        it('should call userBookmarksApi.list to fetch bookmarks', () => {
            expect(content).toContain('userBookmarksApi.list(');
        });

        it('should pass entityType to list call', () => {
            expect(content).toContain('entityType: activeTab');
        });

        it('should pass page to list call', () => {
            expect(content).toContain('page: currentPage');
        });

        it('should pass pageSize of 12 to list call', () => {
            expect(content).toContain('pageSize: 12');
        });

        it('should call userBookmarksApi.delete to remove bookmarks', () => {
            expect(content).toContain('userBookmarksApi.delete({ id: bookmarkId })');
        });

        it('should define fetchBookmarks function', () => {
            expect(content).toContain('const fetchBookmarks = async');
        });

        it('should handle fetch error with toast using t()', () => {
            expect(content).toContain("t('favorites.fetchError')");
        });
    });

    describe('Optimistic deletion', () => {
        it('should define handleDelete function', () => {
            expect(content).toContain('const handleDelete = async (bookmarkId: string)');
        });

        it('should save previous bookmarks before optimistic remove', () => {
            expect(content).toContain('const previousBookmarks = [...bookmarks]');
        });

        it('should filter out deleted bookmark optimistically', () => {
            expect(content).toContain('prev.filter((b) => b.id !== bookmarkId)');
        });

        it('should decrement total optimistically', () => {
            expect(content).toContain('setTotal((prev) => prev - 1)');
        });

        it('should restore bookmarks on delete error', () => {
            expect(content).toContain('setBookmarks(previousBookmarks)');
        });

        it('should increment total back on delete error', () => {
            expect(content).toContain('setTotal((prev) => prev + 1)');
        });

        it('should show success toast on delete success using t()', () => {
            expect(content).toContain("t('favorites.deleteSuccess')");
        });

        it('should show error toast on delete failure using t()', () => {
            expect(content).toContain("t('favorites.deleteError')");
        });
    });

    describe('Pagination', () => {
        it('should define handleLoadMore function', () => {
            expect(content).toContain('const handleLoadMore = (e: FormEvent)');
        });

        it('should prevent default on load more button click', () => {
            expect(content).toContain('e.preventDefault()');
        });

        it('should compute hasMore from bookmarks length vs total', () => {
            expect(content).toContain('const hasMore = bookmarks.length < total');
        });

        it('should show load more button when hasMore is true', () => {
            expect(content).toContain('{hasMore && !isLoading && (');
        });

        it('should increment page when loading more', () => {
            expect(content).toContain('setPage(currentPage + 1)');
        });
    });

    describe('Loading and empty states', () => {
        it('should show loading state when isLoading and no bookmarks', () => {
            expect(content).toContain('{isLoading && bookmarks.length === 0 && (');
        });

        it('should show empty state when not loading and no bookmarks', () => {
            expect(content).toContain('{!isLoading && bookmarks.length === 0 && (');
        });

        it('should show FavoriteIcon in empty state', () => {
            expect(content).toContain('<FavoriteIcon');
        });

        it('should show empty message text using t()', () => {
            expect(content).toContain("t('favorites.empty')");
        });

        it('should show empty action text using t()', () => {
            expect(content).toContain("t('favorites.emptyAction')");
        });

        it('should show loading spinner animation', () => {
            expect(content).toContain('animate-spin');
        });

        it('should show loading text during initial load using t()', () => {
            expect(content).toContain("t('favorites.loading')");
        });

        it('should show inline loading indicator when loading more', () => {
            expect(content).toContain('{isLoading && bookmarks.length > 0 && (');
        });
    });

    describe('Bookmark list rendering', () => {
        it('should render bookmark name', () => {
            expect(content).toContain('bookmark.name');
        });

        it('should render bookmark description when present', () => {
            expect(content).toContain('bookmark.description');
        });

        it('should render formatted createdAt date using formatDate from @repo/i18n', () => {
            expect(content).toContain('formatDate');
            expect(content).toContain("from '@repo/i18n'");
            expect(content).toContain('date: bookmark.createdAt');
        });

        it('should use bookmark.id as key', () => {
            expect(content).toContain('key={bookmark.id}');
        });

        it('should show bookmarks list when bookmarks exist', () => {
            expect(content).toContain('{bookmarks.length > 0 && (');
        });
    });

    describe('Container class', () => {
        it('should have user-favorites-list class on root', () => {
            expect(content).toContain('className="user-favorites-list"');
        });
    });
});
