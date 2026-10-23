import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const component = readFileSync(
    new URL('../../../src/components/shared/layout/ListingViewToggle.astro', import.meta.url),
    'utf8'
);
const listing = readFileSync(
    new URL('../../../src/pages/[lang]/alojamientos/index.astro', import.meta.url),
    'utf8'
);
const map = readFileSync(
    new URL('../../../src/pages/[lang]/alojamientos/mapa.astro', import.meta.url),
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
        expect(listing).toContain('slot="dock-start"');
        expect(listing).not.toContain('class="view-toggle"');
        expect(listing).not.toContain('position: fixed');
        expect(map.match(/<ListingViewToggle\b/g)).toHaveLength(2);
        expect(map).toContain('slot="dock-start"');
        expect(map.match(/active="map"/g)).toHaveLength(2);
        expect(map).not.toContain('class="view-toggle"');
        expect(map).not.toContain('position: fixed');
        const mergeBase = execFileSync('git', ['merge-base', 'HEAD', 'origin/staging'], {
            encoding: 'utf8'
        }).trim();
        const base = execFileSync(
            'git',
            ['show', `${mergeBase}:apps/web/src/pages/[lang]/alojamientos/index.astro`],
            { encoding: 'utf8' }
        );
        expect(listing.split('\n').length).toBeLessThan(base.split('\n').length);
    });
});
