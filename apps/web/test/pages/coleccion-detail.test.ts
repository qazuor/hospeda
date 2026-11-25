/**
 * @file coleccion-detail.test.ts
 * @description Source-reading tests for the collection detail page (T-051b, SPEC-098).
 *
 * Verifies that the SSR page:
 *  - reads entityType and bookmarksPage from URL search params
 *  - uses the correct API endpoint with filter params
 *  - redirects a missing or foreign collection instead of rendering it
 *  - hands the read to the `CollectionDetailView` island (HOS-2480), whose
 *    tabs, cards, empty/error states, pagination and removal are covered
 *    behaviorally by test/components/account/favorites/CollectionDetailView.test.tsx
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pageSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/favoritos/colecciones/[id].astro'),
    'utf8'
);

const viewSrc = readFileSync(
    resolve(__dirname, '../../src/components/account/favorites/CollectionDetailView.client.tsx'),
    'utf8'
);

describe('collection detail page — T-051b (SPEC-098)', () => {
    describe('auth guard', () => {
        it('redirects unauthenticated users to sign-in', () => {
            expect(pageSrc).toContain('auth/signin');
            expect(pageSrc).toContain('Astro.redirect');
        });
    });

    describe('URL search param handling', () => {
        it('reads entityType from URL search params', () => {
            expect(pageSrc).toContain("searchParams.get('entityType')");
        });

        it('reads bookmarksPage from URL search params', () => {
            expect(pageSrc).toContain("searchParams.get('bookmarksPage')");
        });

        it('validates entityType against the shared allowed set', () => {
            expect(pageSrc).toContain('parseCollectionEntityType');
        });

        it('defaults page to 1 when param is absent', () => {
            expect(pageSrc).toContain('currentPage');
            expect(pageSrc).toContain('parseInt(rawPage');
        });
    });

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

        it('redirects 404/400/403 to /mi-cuenta/favoritos (never confirms a foreign id)', () => {
            expect(pageSrc).toContain('status === 404 || status === 400 || status === 403');
            expect(pageSrc).toContain("path: 'mi-cuenta/favoritos'");
        });

        it('hands any other failure to the island as a failed read, never as empty', () => {
            expect(pageSrc).toContain(': { ok: false }');
        });
    });

    describe('island wiring (HOS-2480)', () => {
        it('renders CollectionDetailView with client:load', () => {
            expect(pageSrc).toContain('<CollectionDetailView');
            expect(pageSrc).toContain('client:load');
        });

        it('passes the read, the filter, the page and the API origin', () => {
            expect(pageSrc).toContain('read={read}');
            expect(pageSrc).toContain('activeEntityType={activeEntityType}');
            expect(pageSrc).toContain('currentPage={currentPage}');
            expect(pageSrc).toContain('apiUrl={getApiUrl()}');
            expect(pageSrc).toContain('collectionId={id}');
        });

        it('renders shared account breadcrumbs through the island PageHeader', () => {
            expect(pageSrc).not.toContain('Breadcrumbs');
            expect(viewSrc).toContain('breadcrumbs={buildAccountBreadcrumbs(');
            expect(viewSrc).toContain("getAccountSectionLabel({ t, section: 'favoritos' })");
            expect(viewSrc).not.toContain('back={{');
        });

        it('builds the type tabs from the shared list as URL links (NavTabs)', () => {
            expect(viewSrc).toContain('COLLECTION_ENTITY_TYPES.map');
            expect(viewSrc).toContain('COLLECTION_FILTER_LABELS');
            expect(viewSrc).toContain('<NavTabs');
        });

        it('has no page-local styles left (kit only)', () => {
            expect(pageSrc).not.toContain('<style');
        });
    });
});
