/**
 * HOS-2258: source-level wiring of the venue videos surfaces. These pages are
 * Astro files, so the contract is pinned by reading them.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(__dirname, '../../src', path), 'utf8');

describe('venue ficha (HOS-2258)', () => {
    const page = read('pages/[lang]/comer-y-salir/[slug].astro');
    const sections = read('lib/venue/venue-detail-sections.ts');

    it('renders the videos block right after the gallery, with the venue scope', () => {
        expect(page).toContain('scope="venue"');
        expect(page.indexOf('venue-detail__gallery')).toBeLessThan(
            page.indexOf('venue-detail__videos')
        );
    });

    it('keeps the body registry free of a media entry (the gallery and videos are fixed)', () => {
        expect(sections).toMatch(/media:\s*false/);
    });
});

describe('listing video block (AC-5)', () => {
    const block = read('components/listing/ListingVideoSection.astro');

    it('never uses the owner url as an iframe src: it is rebuilt by resolveVideoEmbed', () => {
        expect(block).toContain('resolveVideoEmbed');
        expect(block).not.toMatch(/iframe\.src\s*=\s*video\.url/);
        expect(block).toContain('iframe.src = embedUrl');
    });

    it('holds static keys for both scopes', () => {
        expect(block).toContain("'venue.detail.videos.title'");
        expect(block).toContain("'accommodations.detail.videos.title'");
    });
});

describe('editor Fotos page (AC-8, AC-9)', () => {
    const page = read('pages/[lang]/mi-cuenta/comercio/[vertical]/[id]/editar/fotos.astro');

    it('decides the widget from the catalog trait state, not from the vertical', () => {
        expect(page).toContain('traits?.videos');
        expect(page).not.toMatch(/vertical\s*===\s*['"]venue['"]/);
    });

    it('shows nothing locked when no plan grants the key', () => {
        expect(page).toMatch(/videosState === 'locked' && videosUpsellPlan/);
    });
});
