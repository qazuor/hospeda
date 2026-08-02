/**
 * @file favorite-bulk-hydration.test.ts
 * @description Source-assertion tests for the SSR bulk favourite check that
 * still exists — and only where it still exists.
 *
 * HOS-369 WB0-5 removed this pattern from the 23 public catalog pages: baking
 * per-user favourite state into the HTML is exactly what kept them out of the
 * edge cache, and the hearts now resolve it themselves after hydration, once
 * per page load for the whole grid (`store/favorites-store`). The guard that
 * asserts they stay that way is
 * `test/pages/cacheable-pages-are-session-blind.guard.test.ts`.
 *
 * What remains here covers the two files WB0-7 still owns
 * (`destinos/[...path].astro` and the section it feeds). For those, the
 * original regression is still live and still worth guarding: `checkBulk` did
 * not forward the SSR `Cookie` header (unlike its sibling `checkStatus`), so
 * every SSR call silently ran as an anonymous request — the API saw
 * `actorRole: guest` for genuinely logged-in users and returned 401 (a
 * production incident). When WB0-7 de-personalizes those two files, this file
 * goes away with them.
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

// ---------------------------------------------------------------------------
// DestinationCard.astro — must accept and forward initialIsFavorited
// ---------------------------------------------------------------------------

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

    it('reads the SSR cookie header from Astro.request', () => {
        expect(src).toContain("Astro.request.headers.get('cookie')");
    });

    it('forwards cookieHeader on BOTH checkBulk calls (event preview + nearby destinations)', () => {
        // This page has two independent checkBulk call sites sharing one
        // hoisted `cookieHeader` const — every call block must reference it,
        // not just the first, so a partial regression (only one call site
        // losing the forward) still fails this test.
        const checkBulkBlocks = [...src.matchAll(/checkBulk\(\{[\s\S]*?\}\);/g)];
        expect(checkBulkBlocks.length).toBe(2);
        for (const block of checkBulkBlocks) {
            expect(block[0]).toContain('cookieHeader');
        }
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
