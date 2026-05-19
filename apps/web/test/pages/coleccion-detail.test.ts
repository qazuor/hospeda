/**
 * @file coleccion-detail.test.ts
 * @description Source-reading tests for the collection detail page (T-051b, SPEC-098).
 *
 * Verifies that the SSR page:
 *  - reads entityType and bookmarksPage from URL search params
 *  - uses the correct API endpoint with filter params
 *  - renders the entity type filter tabs as anchor links
 *  - renders the bookmark grid
 *  - renders pagination controls
 *  - mounts CollectionBookmarkRemoveBtn as a React island
 *  - shows the empty state when no bookmarks exist
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pageSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/favoritos/colecciones/[id].astro'),
    'utf8'
);

const removeBtnSrc = readFileSync(
    resolve(__dirname, '../../src/components/account/CollectionBookmarkRemoveBtn.client.tsx'),
    'utf8'
);

describe('collection detail page — T-051b (SPEC-098)', () => {
    // ── Auth guard ───────────────────────────────────────────────────────────

    describe('auth guard', () => {
        it('redirects unauthenticated users to sign-in', () => {
            expect(pageSrc).toContain('auth/signin');
            expect(pageSrc).toContain('Astro.redirect');
        });
    });

    // ── Query param reading ──────────────────────────────────────────────────

    describe('URL search param handling', () => {
        it('reads entityType from URL search params', () => {
            expect(pageSrc).toContain("searchParams.get('entityType')");
        });

        it('reads bookmarksPage from URL search params', () => {
            expect(pageSrc).toContain("searchParams.get('bookmarksPage')");
        });

        it('validates entityType against an allowed set', () => {
            expect(pageSrc).toContain('VALID_ENTITY_TYPES');
            expect(pageSrc).toContain('isValidEntityType');
        });

        it('defaults page to 1 when param is absent', () => {
            expect(pageSrc).toContain('currentPage');
            expect(pageSrc).toContain('parseInt(rawPage');
        });
    });

    // ── API call ─────────────────────────────────────────────────────────────

    describe('API integration', () => {
        it('calls userBookmarkCollectionsApi.getById', () => {
            expect(pageSrc).toContain('userBookmarkCollectionsApi.getById');
        });

        it('passes entityType filter to the API call', () => {
            expect(pageSrc).toContain('entityType: activeEntityType');
        });

        it('passes pagination params to the API call', () => {
            expect(pageSrc).toContain('bookmarksPage: currentPage');
            expect(pageSrc).toContain('bookmarksPageSize: PAGE_SIZE');
        });

        it('redirects to /mi-cuenta/favoritos on 404', () => {
            expect(pageSrc).toContain('mi-cuenta/favoritos');
        });
    });

    // ── Filter tabs ──────────────────────────────────────────────────────────

    describe('entity type filter tabs', () => {
        it('renders filter tabs inside a nav element', () => {
            expect(pageSrc).toContain('coleccion-tabs');
        });

        it('uses anchor elements for tabs (SSR navigation)', () => {
            expect(pageSrc).toContain('coleccion-tabs__btn');
            // Tabs are <a> not <button> — they navigate via full page reload
            expect(pageSrc).toContain('<a');
            expect(pageSrc).toContain('buildFilterUrl');
        });

        it('marks the active tab with aria-current', () => {
            expect(pageSrc).toContain("aria-current={isActive ? 'true' : undefined}");
        });

        it('applies active modifier class when tab matches active filter', () => {
            expect(pageSrc).toContain('coleccion-tabs__btn--active');
        });

        it('uses i18n keys for tab labels', () => {
            expect(pageSrc).toContain('account.favorites.filter.all');
            expect(pageSrc).toContain('account.favorites.filter.accommodations');
            expect(pageSrc).toContain('account.favorites.filter.destinations');
            expect(pageSrc).toContain('account.favorites.filter.events');
            expect(pageSrc).toContain('account.favorites.filter.posts');
        });

        it('resets page to 1 when changing filter', () => {
            // buildFilterUrl does not include bookmarksPage param when building filter URLs
            expect(pageSrc).toContain('buildFilterUrl');
            // The "ALL" tab goes back to the base URL (no query params)
            expect(pageSrc).toContain("entityTypeKey === 'ALL'");
        });
    });

    // ── Bookmark grid ────────────────────────────────────────────────────────

    describe('bookmark grid', () => {
        it('renders a grid list when bookmarks exist', () => {
            expect(pageSrc).toContain('coleccion-grid');
            expect(pageSrc).toContain('bookmarksData.rows.length > 0');
        });

        it('renders card elements for each bookmark', () => {
            expect(pageSrc).toContain('coleccion-card');
        });

        it('links each card to the entity URL', () => {
            expect(pageSrc).toContain('coleccion-card__link');
            expect(pageSrc).toContain('resolveEntityHref');
        });

        it('shows the bookmark name (falls back to no_collection label)', () => {
            expect(pageSrc).toContain('bookmark.name');
        });

        it('shows the optional description (note)', () => {
            expect(pageSrc).toContain('bookmark.description');
            expect(pageSrc).toContain('coleccion-card__note');
        });

        it('shows the entity type label in card meta', () => {
            expect(pageSrc).toContain('coleccion-card__meta');
        });
    });

    // ── Empty state ──────────────────────────────────────────────────────────

    describe('empty state', () => {
        it('shows empty state when rows is empty', () => {
            expect(pageSrc).toContain('bookmarksData.rows.length === 0');
            expect(pageSrc).toContain('coleccion-empty');
        });

        it('uses the correct i18n key for empty message', () => {
            expect(pageSrc).toContain('account.favorites.collections.emptyBookmarks');
        });
    });

    // ── Pagination ───────────────────────────────────────────────────────────

    describe('pagination', () => {
        it('renders pagination when totalPages > 1', () => {
            expect(pageSrc).toContain('coleccion-pagination');
            expect(pageSrc).toContain('totalPages > 1');
        });

        it('shows prev/next as links when navigation is possible', () => {
            expect(pageSrc).toContain('buildPageUrl(currentPage - 1)');
            expect(pageSrc).toContain('buildPageUrl(currentPage + 1)');
        });

        it('disables prev button on first page', () => {
            expect(pageSrc).toContain('currentPage > 1');
            expect(pageSrc).toContain('coleccion-pagination__btn--disabled');
        });

        it('disables next button on last page', () => {
            expect(pageSrc).toContain('currentPage < totalPages');
        });

        it('renders page indicator with i18n key', () => {
            expect(pageSrc).toContain('account.favorites.collections.pageInfo');
            expect(pageSrc).toContain('coleccion-pagination__info');
        });

        it('preserves entityType param across page changes', () => {
            // buildPageUrl includes entityType when activeEntityType is set
            expect(pageSrc).toContain('buildPageUrl');
            expect(pageSrc).toContain('params.entityType = activeEntityType');
        });
    });

    // ── Remove island ────────────────────────────────────────────────────────

    describe('CollectionBookmarkRemoveBtn island', () => {
        it('mounts CollectionBookmarkRemoveBtn with client:visible', () => {
            expect(pageSrc).toContain('CollectionBookmarkRemoveBtn');
            expect(pageSrc).toContain('client:visible');
        });

        it('passes collectionId to the island', () => {
            expect(pageSrc).toContain('collectionId={id}');
        });

        it('passes bookmarkId to the island', () => {
            expect(pageSrc).toContain('bookmarkId={bookmark.id}');
        });

        it('passes apiBase to the island', () => {
            expect(pageSrc).toContain('apiBase={apiBase}');
        });

        it('passes locale to the island', () => {
            expect(pageSrc).toContain('locale={locale}');
        });

        it('reads apiBase via the validated getApiUrl() helper', () => {
            expect(pageSrc).toContain('getApiUrl()');
        });
    });

    // ── Styling ──────────────────────────────────────────────────────────────

    describe('styling', () => {
        it('uses CSS custom properties (no hardcoded hex/rgb colors)', () => {
            expect(pageSrc).toContain('var(--brand-primary)');
            expect(pageSrc).toContain('var(--core-muted-foreground)');
            expect(pageSrc).toContain('var(--core-card)');
        });

        it('does not use standalone Tailwind utility classes', () => {
            // Web app uses BEM-lite CSS classes — check that no class attribute
            // contains standalone Tailwind utilities (those begin the value or
            // follow a space, and are not part of a BEM name like "coleccion-grid")
            expect(pageSrc).not.toMatch(/class(Name)?="\s*(flex|text-sm|text-lg|bg-\w|p-\d)\b/);
        });
    });
});

// ────────────────────────────────────────────────────────────────────────────
// CollectionBookmarkRemoveBtn island tests
// ────────────────────────────────────────────────────────────────────────────

describe('CollectionBookmarkRemoveBtn — source structure', () => {
    it('exports CollectionBookmarkRemoveBtn as a named export', () => {
        expect(removeBtnSrc).toContain('export function CollectionBookmarkRemoveBtn');
    });

    it('declares CollectionBookmarkRemoveBtnProps interface as readonly', () => {
        expect(removeBtnSrc).toContain('CollectionBookmarkRemoveBtnProps');
        expect(removeBtnSrc).toContain('readonly collectionId: string');
        expect(removeBtnSrc).toContain('readonly bookmarkId: string');
        expect(removeBtnSrc).toContain('readonly apiBase: string');
        expect(removeBtnSrc).toContain('readonly locale: SupportedLocale');
    });

    it('calls the correct DELETE endpoint', () => {
        expect(removeBtnSrc).toContain('/api/v1/protected/user-bookmark-collections/');
        expect(removeBtnSrc).toContain("method: 'DELETE'");
    });

    it('forwards credentials to the API call', () => {
        expect(removeBtnSrc).toContain("credentials: 'include'");
    });

    it('reloads the page on successful removal', () => {
        expect(removeBtnSrc).toContain('window.location.reload()');
    });

    it('shows error state when API call fails', () => {
        expect(removeBtnSrc).toContain('setError(');
        expect(removeBtnSrc).toContain('account.favorites.collections.removeError');
    });

    it('disables the button while removing', () => {
        expect(removeBtnSrc).toContain('disabled={removing}');
    });

    it('uses CSS custom properties for styling (no hardcoded colors)', () => {
        expect(removeBtnSrc).toContain('var(--radius-button');
        expect(removeBtnSrc).toContain('var(--font-sans)');
    });

    it('uses createTranslations for i18n', () => {
        expect(removeBtnSrc).toContain('createTranslations(locale)');
    });
});
