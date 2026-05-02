/**
 * @file favoritos-collection-usage.test.ts
 * @description Source-reading tests for the favoritos page collection usage counter.
 * Verifies that the SSR fetch pattern, usage counter markup, and i18n keys
 * are present in the page source (T-UI-CL1, SPEC-098).
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

    describe('usage counter rendering', () => {
        it('renders collection-usage element', () => {
            expect(src).toContain('collection-usage');
        });

        it('uses account.favorites.collections.usage i18n key', () => {
            expect(src).toContain('account.favorites.collections.usage');
        });

        it('uses account.favorites.collections.limit_reached i18n key', () => {
            expect(src).toContain('account.favorites.collections.limit_reached');
        });

        it('renders a progress bar element', () => {
            expect(src).toContain('role="progressbar"');
            expect(src).toContain('aria-valuenow');
            expect(src).toContain('aria-valuemax');
        });

        it('applies warning modifier when at limit', () => {
            expect(src).toContain('collection-usage--warning');
            expect(src).toContain('isAtLimit');
        });

        it('renders the usage bar fill with dynamic width', () => {
            expect(src).toContain('collection-usage__bar-fill');
            expect(src).toContain('usageRatio');
        });

        it('skips counter when collectionUsage is null (no auth cookie or API error)', () => {
            expect(src).toContain('usageLabel !== null');
        });
    });

    describe('auth guard', () => {
        it('redirects unauthenticated users', () => {
            expect(src).toContain('Astro.redirect');
            expect(src).toContain('auth/signin');
        });
    });

    describe('styling', () => {
        it('uses CSS custom properties for colors (no hardcoded values)', () => {
            // Should use var(--primary), var(--muted-foreground), etc.
            expect(src).toContain('var(--primary)');
            expect(src).toContain('var(--muted-foreground)');
        });

        it('uses var(--radius-pill) for bar border-radius', () => {
            expect(src).toContain('var(--radius-pill)');
        });

        it('does not use Tailwind utility classes', () => {
            // Web app uses vanilla CSS only (no Tailwind)
            expect(src).not.toMatch(/className="[^"]*\b(flex|grid|text-)\w+/);
        });
    });
});
