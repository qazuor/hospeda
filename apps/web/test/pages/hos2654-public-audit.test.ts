import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(__dirname, '../../src', path), 'utf8');

describe('HOS-2654 public layout contracts', () => {
    it('bounds mobile featured cards and retains the browse-all link', () => {
        const featured = source('components/sections/FeaturedAccommodationsSection.astro');

        expect(featured).toMatch(
            /@media \(max-width: 640px\)[\s\S]*?:nth-child\(n \+ 5\)\s*\{\s*display: none/
        );
        expect(featured).toContain('class="accommodations__see-all"');
        expect(featured).toContain('href={seeAllHref}');
    });

    it('keeps six category tiles and leaves the articles link to its own section', () => {
        const home = source('pages/[lang]/index.astro');
        const tiles = home.slice(
            home.indexOf('const categoryTiles'),
            home.indexOf('] as const;', home.indexOf('const categoryTiles'))
        );

        expect(tiles.match(/title: t\("home\.categoryTiles\.tiles\./g)).toHaveLength(6);
        expect(tiles).not.toContain('/publicaciones/');
    });

    it('preserves the computed social proof but drops the decorative arrow', () => {
        const home = source('pages/[lang]/index.astro');
        const hero = source('components/sections/HeroSection.astro');

        expect(home).toContain('shouldShowSocialProof({ reviewsCount, averageRating })');
        expect(hero).not.toContain('social-proof__deco-arrow');
    });

    it('uses circular destination controls and a readable counter', () => {
        const carousel = source('components/sections/DestinationsIsland.client.tsx');
        const css = source('components/sections/DestinationsIsland.module.css');

        expect(carousel).toContain('<ArrowLeftIcon');
        expect(carousel).toContain('<ArrowRightIcon');
        expect(css).toMatch(
            /\.arrowButton\s*\{[^}]*min-width: 44px;[^}]*min-height: 44px;[^}]*var\(--radius-pill\)/
        );
        expect(css).toMatch(/\.slideCounter\s*\{[^}]*font-size: var\(--text-body\)/);
    });

    it('keeps the benefits catalog public and invalidates it with pricing', () => {
        const benefits = source('pages/[lang]/beneficios/index.astro');

        expect(benefits).toContain("fetchPublicPlans({ vertical: 'tourist' })");
        expect(benefits).toContain('cacheable: touristCatalog.ok');
        expect(benefits).toContain('tags: [CACHE_TAG_PRICING]');
        expect(benefits).not.toMatch(/Astro\.locals\.user|Astro\.cookies/);
        expect(benefits).toMatch(
            /\.benefits-section__grid:has\(> :nth-child\(5\):last-child\)\s*\{[^}]*justify-content: center/
        );
    });

    it('omits zero bookmarks and places the destination in the article header', () => {
        const post = source('components/post/PostDetailHeader.astro');

        expect(post).toContain('bookmarkCount !== undefined && bookmarkCount > 0');
        expect(post).toContain('href={destination.href} class="post-header__destination"');
    });

    it('renders the author avatar only in the title slot', () => {
        const author = source('pages/[lang]/autores/[slug]/index.astro');
        const profile = author.slice(author.indexOf('<div class="author-page__profile">'));

        expect(author).toMatch(
            /<Fragment slot="title-media">[\s\S]*?src=\{avatar\}[\s\S]*?<\/Fragment>/
        );
        expect(profile).not.toContain('src={avatar}');
        expect(author).toContain('subtitle={[postsPagination');
    });
});
