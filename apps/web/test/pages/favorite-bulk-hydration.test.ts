/**
 * @file favorite-bulk-hydration.test.ts
 * @description Source-assertion tests verifying that every SSR page and
 * server:defer component that renders DestinationCard or EventCardHorizontal
 * performs a single bulk favorite check (checkBulk) instead of triggering
 * one per-card checkStatus call on mount.
 *
 * Bug fixed: N+1 rate-limit — `FavoriteButton` fires its own `checkStatus`
 * request on mount when `initialIsFavorited === undefined`. The fix passes a
 * pre-resolved value from a single SSR-side /check-bulk call.
 *
 * Pattern reference: `apps/web/src/pages/[lang]/alojamientos/index.astro`
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_DIR = resolve(__dirname, '../../src');

function readSrc(relPath: string): string {
    return readFileSync(resolve(SRC_DIR, relPath), 'utf8');
}

// ---------------------------------------------------------------------------
// Helper: common assertions extracted so every describe block stays DRY
// ---------------------------------------------------------------------------

function assertBulkCheckPattern(src: string, ctx: string): void {
    it(`[${ctx}] imports userBookmarksApi from endpoints-protected`, () => {
        expect(src).toContain("from '@/lib/api/endpoints-protected'");
        expect(src).toContain('userBookmarksApi');
    });

    it(`[${ctx}] imports webLogger`, () => {
        expect(src).toContain('webLogger');
    });

    it(`[${ctx}] calls checkBulk`, () => {
        expect(src).toContain('checkBulk');
    });

    it(`[${ctx}] guards checkBulk with isAuthenticated`, () => {
        expect(src).toContain('isAuthenticated');
        // The bulk call must be inside an auth guard
        const checkBulkIdx = src.indexOf('checkBulk');
        const isAuthIdx = src.indexOf('isAuthenticated');
        // isAuthenticated appears before checkBulk (it guards the call)
        expect(isAuthIdx).toBeLessThan(checkBulkIdx);
    });

    it(`[${ctx}] has a warn fallback on bulk-check failure`, () => {
        expect(src).toContain('webLogger.warn');
    });
}

// ---------------------------------------------------------------------------
// DestinationCard.astro — must accept and forward initialIsFavorited
// ---------------------------------------------------------------------------

describe('DestinationCard.astro — pre-resolved favorite props', () => {
    const src = readSrc('components/shared/cards/DestinationCard.astro');

    it('declares initialIsFavorited optional prop', () => {
        expect(src).toContain('initialIsFavorited');
    });

    it('declares initialBookmarkId optional prop', () => {
        expect(src).toContain('initialBookmarkId');
    });

    it('passes initialIsFavorited to FavoriteButton', () => {
        expect(src).toContain('initialIsFavorited={initialIsFavorited}');
    });

    it('passes initialBookmarkId to FavoriteButton', () => {
        expect(src).toContain('initialBookmarkId={initialBookmarkId}');
    });
});

// ---------------------------------------------------------------------------
// destinos/index.astro — destination listing page
// ---------------------------------------------------------------------------

describe('pages/[lang]/destinos/index.astro — destination bulk check', () => {
    const src = readSrc('pages/[lang]/destinos/index.astro');

    assertBulkCheckPattern(src, 'destinos/index');

    it('calls checkBulk with entityType DESTINATION', () => {
        expect(src).toContain("entityType: 'DESTINATION'");
    });

    it('passes initialIsFavorited to DestinationCard', () => {
        expect(src).toContain('initialIsFavorited=');
    });

    it('passes initialBookmarkId to DestinationCard', () => {
        expect(src).toContain('initialBookmarkId=');
    });
});

// ---------------------------------------------------------------------------
// eventos/index.astro — events listing page
// ---------------------------------------------------------------------------

describe('pages/[lang]/eventos/index.astro — event bulk check', () => {
    const src = readSrc('pages/[lang]/eventos/index.astro');

    assertBulkCheckPattern(src, 'eventos/index');

    it('calls checkBulk with entityType EVENT', () => {
        expect(src).toContain("entityType: 'EVENT'");
    });

    it('creates resolvedCards with injected isFavorited', () => {
        expect(src).toContain('resolvedCards');
        expect(src).toContain('isFavorited: entry.isBookmarked');
    });

    it('renders resolvedCards in the grid (not raw cards)', () => {
        // The template must iterate resolvedCards, not the original cards array
        expect(src).toContain('resolvedCards.map(');
    });
});

// ---------------------------------------------------------------------------
// eventos/categoria/[category]/index.astro — category page
// ---------------------------------------------------------------------------

describe('pages/[lang]/eventos/categoria/[category]/index.astro — event bulk check', () => {
    const src = readSrc('pages/[lang]/eventos/categoria/[category]/index.astro');

    assertBulkCheckPattern(src, 'eventos/categoria');

    it('calls checkBulk with entityType EVENT', () => {
        expect(src).toContain("entityType: 'EVENT'");
    });

    it('creates resolvedCards with injected isFavorited', () => {
        expect(src).toContain('resolvedCards');
        expect(src).toContain('isFavorited: entry.isBookmarked');
    });

    it('renders resolvedCards in the grid', () => {
        expect(src).toContain('resolvedCards.map(');
    });
});

// ---------------------------------------------------------------------------
// destinos/[slug]/eventos/index.astro — destination-scoped events page
// ---------------------------------------------------------------------------

describe('pages/[lang]/destinos/[slug]/eventos/index.astro — event bulk check', () => {
    const src = readSrc('pages/[lang]/destinos/[slug]/eventos/index.astro');

    assertBulkCheckPattern(src, 'destinos/[slug]/eventos');

    it('calls checkBulk with entityType EVENT', () => {
        expect(src).toContain("entityType: 'EVENT'");
    });

    it('creates resolvedCards', () => {
        expect(src).toContain('resolvedCards');
    });

    it('renders resolvedCards in the grid', () => {
        expect(src).toContain('resolvedCards.map(');
    });
});

// ---------------------------------------------------------------------------
// NextEventsSection.astro — homepage server:defer events bento
// ---------------------------------------------------------------------------

describe('components/sections/NextEventsSection.astro — event bulk check', () => {
    const src = readSrc('components/sections/NextEventsSection.astro');

    assertBulkCheckPattern(src, 'NextEventsSection');

    it('calls checkBulk with entityType EVENT', () => {
        expect(src).toContain("entityType: 'EVENT'");
    });

    it('creates resolvedEventItems', () => {
        expect(src).toContain('resolvedEventItems');
    });

    it('splits resolvedEventItems into bento grid zones', () => {
        // featuredEvent and topEvents derive from resolvedEventItems
        expect(src).toContain('resolvedEventItems.find(');
        expect(src).toContain('resolvedEventItems.filter(');
    });
});

// ---------------------------------------------------------------------------
// destinos/[...path].astro — destination detail page
// ---------------------------------------------------------------------------

describe('pages/[lang]/destinos/[...path].astro — event card + nearby bulk check', () => {
    const src = readSrc('pages/[lang]/destinos/[...path].astro');

    it('imports webLogger', () => {
        expect(src).toContain('webLogger');
    });

    it('calls checkBulk for event preview cards', () => {
        expect(src).toContain('checkBulk');
        expect(src).toContain("entityType: 'EVENT'");
    });

    it('creates resolvedEventCards', () => {
        expect(src).toContain('resolvedEventCards');
    });

    it('renders resolvedEventCards in the template', () => {
        expect(src).toContain('resolvedEventCards.map(');
    });

    it('calls checkBulk for nearby destination cards', () => {
        expect(src).toContain("entityType: 'DESTINATION'");
        expect(src).toContain('nearbyDestFavoriteChecks');
    });

    it('passes nearbyDestFavoriteChecks to DestinationNearbySection', () => {
        expect(src).toContain('favoriteChecks={nearbyDestFavoriteChecks}');
    });
});

// ---------------------------------------------------------------------------
// DestinationNearbySection.astro — must accept and use favoriteChecks
// ---------------------------------------------------------------------------

describe('components/destination/DestinationNearbySection.astro — favoriteChecks prop', () => {
    const src = readSrc('components/destination/DestinationNearbySection.astro');

    it('declares favoriteChecks optional prop', () => {
        expect(src).toContain('favoriteChecks');
    });

    it('passes initialIsFavorited to DestinationCard', () => {
        expect(src).toContain('initialIsFavorited=');
    });

    it('passes initialBookmarkId to DestinationCard', () => {
        expect(src).toContain('initialBookmarkId=');
    });
});

// ---------------------------------------------------------------------------
// DestinationsIsland.client.tsx — single client-side bulk check
// ---------------------------------------------------------------------------

describe('components/sections/DestinationsIsland.client.tsx — client-side bulk check', () => {
    const src = readSrc('components/sections/DestinationsIsland.client.tsx');

    it('imports userBookmarksApi', () => {
        expect(src).toContain("from '@/lib/api/endpoints-protected'");
        expect(src).toContain('userBookmarksApi');
    });

    it('declares favoriteChecks state', () => {
        expect(src).toContain('favoriteChecks');
        expect(src).toContain('setFavoriteChecks');
    });

    it('calls checkBulk inside a useEffect', () => {
        // Both markers must appear in the source
        expect(src).toContain('checkBulk');
        expect(src).toContain('useEffect');
    });

    it('guards bulk check with isAuthenticated', () => {
        // The guard "if (!isAuthenticated ..." or similar must precede the call
        const guardIdx = src.indexOf('!isAuthenticated');
        const bulkIdx = src.indexOf('checkBulk');
        expect(guardIdx).toBeGreaterThan(-1);
        expect(guardIdx).toBeLessThan(bulkIdx);
    });

    it('gates FavoriteButton render until the bulk check resolves (prevents child-effect N+1)', () => {
        // React runs child effects BEFORE parent effects: rendering the buttons
        // before the bulk resolves would let each fire its own checkStatus,
        // re-introducing the N+1. The render must be gated on bulkResolved.
        expect(src).toContain('bulkResolved');
        expect(src).toContain('setBulkResolved');
        expect(src).toContain('!isAuthenticated || bulkResolved');
    });

    it('marks the bulk check resolved in a finally block (success and failure)', () => {
        const finallyIdx = src.indexOf('finally');
        const setResolvedIdx = src.indexOf('setBulkResolved(true)');
        expect(finallyIdx).toBeGreaterThan(-1);
        expect(setResolvedIdx).toBeGreaterThan(finallyIdx);
    });

    it('passes a real boolean initialIsFavorited for authenticated users', () => {
        // Authenticated path passes a concrete boolean (?? false) so the button
        // mounts already-hydrated; guest path passes undefined (guests never fetch).
        expect(src).toContain('?.isBookmarked ??');
    });

    it('passes initialBookmarkId to FavoriteButton', () => {
        expect(src).toContain('?.bookmarkId ?? null');
    });

    it('has a biome-ignore comment on the useEffect (intentional dep omission)', () => {
        expect(src).toContain('biome-ignore lint/correctness/useExhaustiveDependencies');
    });
});
