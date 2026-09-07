/**
 * @file favoritos-collection-usage.test.ts
 * @description Source-reading tests for the favoritos page collection usage counter.
 * Verifies that the SSR fetch pattern and the CollectionUsageMeter island wiring
 * are present in the page source (T-UI-CL1, SPEC-098; island extraction HOS-999).
 * The counter's own rendering behavior lives in
 * test/components/account/CollectionUsageMeter.test.tsx.
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

    // ── HOS-999: usage counter moved to the CollectionUsageMeter island ────────
    // The "X / max" counter + progress bar markup (role="progressbar",
    // account.favorites.collections.usage/limit_reached, the warning modifier,
    // the null-collectionUsage skip) used to be rendered inline here and was
    // covered by source-reading assertions in this file. It now lives in
    // CollectionUsageMeter.client.tsx, covered by behavioral RTL tests in
    // test/components/account/CollectionUsageMeter.test.tsx. This page only
    // needs to wire the SSR-resolved usage into that island correctly.
    describe('usage counter wiring (HOS-999)', () => {
        it('imports the CollectionUsageMeter island', () => {
            expect(src).toContain(
                "import { CollectionUsageMeter } from '@/components/account/CollectionUsageMeter.client'"
            );
        });

        it('renders CollectionUsageMeter with client:load and the SSR-resolved usage as `initial`', () => {
            expect(src).toContain('<CollectionUsageMeter');
            expect(src).toContain('client:load');
            expect(src).toContain('initial={collectionUsage}');
        });

        it('still computes isAtLimit for CreateCollectionCTA', () => {
            expect(src).toContain('isAtLimit');
            expect(src).toContain('isAtLimit={isAtLimit}');
        });
    });

    describe('auth guard', () => {
        it('redirects unauthenticated users', () => {
            expect(src).toContain('Astro.redirect');
            expect(src).toContain('auth/signin');
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

        it('passes accessDenied to CreateCollectionCTA instead of folding it into isAtLimit', () => {
            expect(src).toContain('accessDenied={collectionsAccessDenied}');
        });
    });
});
