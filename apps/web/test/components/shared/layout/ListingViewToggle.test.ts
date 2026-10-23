import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Fixed baseline: CI checkouts carry no `origin/staging`, so git cannot be asked for it. */
const LISTING_LINES_BEFORE_SHARED_TOGGLE = 1124;

const component = readFileSync(
    resolve(process.cwd(), 'src/components/shared/layout/ListingViewToggle.astro'),
    'utf8'
);
const listing = readFileSync(
    resolve(process.cwd(), 'src/pages/[lang]/alojamientos/index.astro'),
    'utf8'
);
const map = readFileSync(
    resolve(process.cwd(), 'src/pages/[lang]/alojamientos/mapa.astro'),
    'utf8'
);

describe('ListingViewToggle source contract', () => {
    it('defines inline and dock variants without fixed positioning', () => {
        expect(component).toContain('view-toggle--inline');
        expect(component).toContain('view-toggle--dock');
        expect(component).toContain('data-dock-item');
        expect(component).toMatch(
            /@media \(max-width: 767px\)[\s\S]*?view-toggle--inline[^}]*display:\s*none/s
        );
        expect(component).not.toContain('position: fixed');
    });

    it('uses two shared controls on the listing and map with dock slots', () => {
        expect(listing.match(/<ListingViewToggle\b/g)).toHaveLength(2);
        expect(listing).toMatch(
            /<ListingViewToggle\b(?=[^>]*slot="dock-start")(?=[^>]*variant="dock")[^>]*>/
        );
        expect(listing).toMatch(/<ListingViewToggle\b(?=[^>]*variant="inline")[^>]*>/);
        expect(listing).not.toContain('class="view-toggle"');
        expect(listing).not.toContain('position: fixed');
        expect(map.match(/<ListingViewToggle\b/g)).toHaveLength(2);
        expect(map).toMatch(
            /<ListingViewToggle\b(?=[^>]*slot="dock-start")(?=[^>]*variant="dock")[^>]*>/
        );
        expect(map).toMatch(/<ListingViewToggle\b(?=[^>]*variant="inline")[^>]*>/);
        expect(map.match(/active="map"/g)).toHaveLength(2);
        expect(map).not.toContain('class="view-toggle"');
        expect(map).not.toContain('position: fixed');
        // index.astro had 1124 lines before the shared toggle replaced its inline copy.
        expect(listing.split('\n').length).toBeLessThan(LISTING_LINES_BEFORE_SHARED_TOGGLE);
    });
});
