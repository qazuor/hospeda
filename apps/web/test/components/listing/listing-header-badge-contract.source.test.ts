/**
 * @file listing-header-badge-contract.source.test.ts
 * @description Owner smoke (HOS-2520 items 2, 14 and 15): every listing detail header
 * (accommodation, venue, experience) sizes its badges from ONE shared contract, and the
 * venue/experience rows wrap instead of scrolling sideways.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string): string =>
    readFileSync(resolve(__dirname, '../../../src', relative), 'utf8');

const CSS = read('styles/components.css');
const HEADERS = {
    accommodation: read('components/accommodation/DetailHeader.astro'),
    venue: read('components/venue/VenueDetailHeader.astro'),
    experience: read('components/experience/ExperienceHero.astro')
} as const;

describe('shared listing header badge contract (components.css)', () => {
    it('declares the size tokens once on the row', () => {
        expect(CSS).toMatch(
            /\.listing-header-badges \{\s*--listing-badge-height: 1\.75rem;\s*--listing-badge-font-size: 0\.75rem;\s*--listing-badge-padding-inline: 0\.75rem;\s*\}/
        );
    });

    it('sizes every badge only from those tokens, above component-scoped rules', () => {
        const rule =
            CSS.match(
                /\.listing-header-badges \.listing-header-badge\.listing-header-badge \{[^}]*\}/
            )?.[0] ?? '';
        expect(rule).toContain('block-size: var(--listing-badge-height);');
        expect(rule).toContain('padding: 0 var(--listing-badge-padding-inline);');
        expect(rule).toContain('font-size: var(--listing-badge-font-size);');
        expect(rule).toContain('line-height: 1;');
        expect(rule).toContain('--acc-type-font-size: var(--listing-badge-font-size);');
    });

    it('shrinks all of them together in the compact wave header, over wh-compact-badge', () => {
        expect(CSS).toMatch(
            /\.wave-header\.wave-header--compact \.listing-header-badges \{\s*--listing-badge-height: 1\.375rem;/
        );
        expect(CSS).toMatch(
            /\.wave-header\.wave-header--compact \.listing-header-badges \.listing-header-badge \{[^}]*padding: 0 var\(--listing-badge-padding-inline\);/
        );
    });
});

describe.each(Object.entries(HEADERS))('%s detail header', (_vertical, src) => {
    const markup = src.split('<style>')[0] ?? '';
    const styles = src.split('<style>')[1] ?? '';

    it('marks the row and every badge with the shared classes', () => {
        expect(markup).toMatch(/class="[^"]*__badges listing-header-badges/);
        expect(markup).toMatch(/class="featured-badge[^"]*listing-header-badge"/);
        expect(markup).not.toMatch(/badge[^"]*wh-compact-badge/);
    });

    it('keeps no local badge font size or vertical padding', () => {
        const badgeRules = styles.match(/\.[\w-]*(?:badge|pill)[^{]*\{[^}]*\}/g) ?? [];
        for (const rule of badgeRules) {
            expect(rule).not.toMatch(/font-size:\s*\d/);
            expect(rule).not.toMatch(/padding:\s*4px 14px/);
        }
    });
});

describe.each([
    ['venue', HEADERS.venue, 'venue-detail-header'],
    ['experience', HEADERS.experience, 'exp-hero']
] as const)('%s badges on mobile', (_vertical, src, prefix) => {
    it('wrap instead of scrolling sideways', () => {
        const mobile =
            src.match(/@media \(max-width: 767px\)[\s\S]*?(?=@media|<\/style>)/)?.[0] ?? '';
        const row =
            mobile.match(
                new RegExp(`\\.${prefix}--mobile-gallery \\.${prefix}__badges \\{[^}]*\\}`)
            )?.[0] ?? '';
        expect(row).toContain('flex-wrap: wrap;');
        expect(row).not.toContain('overflow-x');
    });
});
