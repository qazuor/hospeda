import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const homepagePath = resolve(__dirname, '../../src/pages/[lang]/index.astro');
const content = readFileSync(homepagePath, 'utf8');

const rootRedirectPath = resolve(__dirname, '../../src/pages/index.astro');
const rootContent = readFileSync(rootRedirectPath, 'utf8');

describe('[lang]/index.astro', () => {
    it('should export prerender = true for SSG', () => {
        expect(content).toContain('export const prerender = true');
    });

    it('should export getStaticPaths', () => {
        expect(content).toContain('getStaticLocalePaths as getStaticPaths');
    });

    it('should import and use SEOHead', () => {
        expect(content).toContain('import SEOHead from');
        expect(content).toContain('slot="head"');
    });

    it('should use server:defer for dynamic sections', () => {
        expect(content).toContain('AccommodationsSection server:defer');
        expect(content).toContain('DestinationsSection server:defer');
        expect(content).toContain('EventsSection server:defer');
        expect(content).toContain('PostsSection server:defer');
    });

    it('should include skeleton fallbacks', () => {
        expect(content).toContain('AccommodationGridSkeleton');
        expect(content).toContain('DestinationGridSkeleton');
        expect(content).toContain('EventGridSkeleton');
        expect(content).toContain('PostGridSkeleton');
    });

    it('should pass locale to all sections', () => {
        expect(content).toContain('locale={locale}');
    });

    it('should include all main sections', () => {
        expect(content).toContain('HeroSection');
        expect(content).toContain('AccommodationsSection');
        expect(content).toContain('DestinationsSection');
        expect(content).toContain('EventsSection');
        expect(content).toContain('PostsSection');
        expect(content).toContain('ReviewsSection');
        expect(content).toContain('StatsSection');
        expect(content).toContain('ListPropertySection');
    });

    it('should include parallax dividers', () => {
        expect(content).toContain('ParallaxDivider');
        expect(content).toContain('parallax-rio-uruguay.jpg');
        expect(content).toContain('parallax-carnaval.jpg');
        expect(content).toContain('parallax-termas-er.jpg');
    });
});

describe('pages/index.astro (root redirect)', () => {
    it('should export prerender = true', () => {
        expect(rootContent).toContain('export const prerender = true');
    });

    it('should redirect to /es/ with 301', () => {
        expect(rootContent).toContain("Astro.redirect('/es/', 301)");
    });
});
