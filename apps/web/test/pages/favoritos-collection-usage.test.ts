/**
 * @file favoritos-collection-usage.test.ts
 * @description Source-reading tests for the favoritos page collection usage counter.
 * Verifies that the SSR fetch pattern and the FavoritesView island wiring are
 * present in the page source (T-UI-CL1, SPEC-098; kit migration HOS-2480).
 * The gate's own behavior lives in test/components/account/favorites/.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/favoritos/index.astro'),
    'utf8'
);

const endpointsSrc = readFileSync(
    resolve(__dirname, '../../src/lib/api/endpoints-protected.ts'),
    'utf8'
);

describe('favoritos page — collection usage counter (T-UI-CL1)', () => {
    describe('API client', () => {
        it('exports userBookmarkCollectionsApi', () => {
            expect(endpointsSrc).toContain('userBookmarkCollectionsApi');
        });

        it('defines BookmarkCollectionUsage interface with current and max', () => {
            expect(endpointsSrc).toContain('BookmarkCollectionUsage');
            expect(endpointsSrc).toContain('readonly current: number');
            expect(endpointsSrc).toContain('readonly max: number');
        });

        it('calls the correct protected endpoint path', () => {
            expect(endpointsSrc).toContain('/user-bookmark-collections');
        });

        it('list() accepts optional pagination params', () => {
            expect(endpointsSrc).toContain('page?: number');
            expect(endpointsSrc).toContain('pageSize?: number');
            expect(endpointsSrc).toContain('includeBookmarkCount?: boolean');
        });
    });

    describe('page SSR fetch', () => {
        it('imports BookmarkCollectionUsage type from api lib', () => {
            expect(src).toContain('BookmarkCollectionUsage');
        });

        it('imports getApiUrl for server-side fetch', () => {
            expect(src).toContain("from '@/lib/env'");
            expect(src).toContain('getApiUrl');
        });

        it('reads cookie header for auth forwarding', () => {
            expect(src).toContain("Astro.request.headers.get('cookie')");
        });

        it('fetches the user-bookmark-collections endpoint', () => {
            expect(src).toContain('/api/v1/protected/user-bookmark-collections');
        });

        it('wraps fetch in try/catch so errors do not break the page', () => {
            expect(src).toContain('try {');
            expect(src).toContain('} catch (err) {');
        });

        it('logs errors via webLogger', () => {
            expect(src).toContain('webLogger.error');
        });

        it('initialises collectionUsage as null (non-blocking default)', () => {
            expect(src).toContain('collectionUsage: BookmarkCollectionUsage | null = null');
        });
    });

    // ── HOS-2480: the usage seeds the collections gate of the FavoritesView ───
    // The usage line («3 de 10 colecciones usadas») and every «Crear colección»
    // entry point now read one gate inside the FavoritesView island, covered by
    // test/components/account/favorites/*.test.tsx. This page only has to hand
    // the SSR-resolved usage and the 403 flag to that island.
    describe('collections gate wiring (HOS-2480)', () => {
        it('renders the FavoritesView island with client:load', () => {
            expect(src).toContain(
                "import { FavoritesView } from '@/components/account/favorites/FavoritesView.client'"
            );
            expect(src).toContain('<FavoritesView');
            expect(src).toContain('client:load');
        });

        it('passes the SSR-resolved usage as the initial usage', () => {
            expect(src).toContain('initialUsage={collectionUsage}');
        });

        it('passes the catalog plan names of the gate (HOS-2544)', () => {
            expect(src).toContain('planNamesWithEntitlement');
            expect(src).toContain('gatePlanNames={gatePlanNames}');
        });
    });

    describe('auth guard', () => {
        it('redirects unauthenticated users', () => {
            expect(src).toContain('Astro.redirect');
            expect(src).toContain('buildLoginRedirect');
        });
    });

    // ── HOS-899: entitlement-gate detection on the SSR usage fetch ─────────────
    describe('collections entitlement gate (HOS-899)', () => {
        it('declares a collectionsAccessDenied flag, initialised false', () => {
            expect(src).toContain('let collectionsAccessDenied = false;');
        });

        it('branches on a 403 response before falling back to a generic warn', () => {
            expect(src).toContain('response.status === 403');
        });

        it('checks the error code for ENTITLEMENT_REQUIRED on a 403', () => {
            expect(src).toContain("errorBody.error?.code === 'ENTITLEMENT_REQUIRED'");
        });

        it('passes the 403 flag to the island as its own fact, not as a limit', () => {
            expect(src).toContain('initialAccessDenied={collectionsAccessDenied}');
        });
    });
});
