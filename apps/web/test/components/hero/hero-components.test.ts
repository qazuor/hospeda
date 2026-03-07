/**
 * @file hero-components.test.ts
 * @description Source-level tests for HeroSearchForm.tsx and HeroSlideshow.tsx.
 *
 * These are React island components in apps/web/src/components/ (root level,
 * not in a subdirectory). Tests verify structure, accessibility, token usage,
 * i18n integration, and named-export compliance.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const srcDir = resolve(__dirname, '../../../src');

function readComponent(relativePath: string): string {
    return readFileSync(resolve(srcDir, relativePath), 'utf8');
}

// ──────────────────────────────────────────────────────────────────────────────
// HeroSearchForm.tsx
// ──────────────────────────────────────────────────────────────────────────────

describe('HeroSearchForm.tsx', () => {
    const src = readComponent('components/hero/HeroSearchForm.tsx');

    describe('Exports', () => {
        it('should use a named export (not default)', () => {
            expect(src).toContain('export function HeroSearchForm');
        });

        it('should NOT use a default export', () => {
            expect(src).not.toMatch(/^export default/m);
        });
    });

    describe('Props interface', () => {
        it('should define HeroSearchFormProps interface with readonly props', () => {
            expect(src).toContain('interface HeroSearchFormProps');
            expect(src).toContain('readonly locale');
        });

        it('should have locale prop typed as SupportedLocale', () => {
            expect(src).toContain('SupportedLocale');
        });
    });

    describe('Hero semantic tokens', () => {
        it('should use bg-hero-overlay semantic token for desktop bar background', () => {
            expect(src).toContain('bg-hero-overlay');
        });

        it('should use border-hero-border semantic token for separators', () => {
            expect(src).toContain('border-hero-border');
        });

        it('should use text-hero-text semantic token for text color', () => {
            expect(src).toContain('text-hero-text');
        });

        it('should use text-hero-text-muted semantic token for muted labels', () => {
            expect(src).toContain('text-hero-text-muted');
        });

        it('should use bg-hero-overlay-heavy token for hover state', () => {
            expect(src).toContain('bg-hero-overlay-heavy');
        });

        it('should NOT use hardcoded white opacity class bg-white/', () => {
            // The old pattern used bg-black/30, bg-white/10 etc.
            expect(src).not.toMatch(/bg-white\/\d/);
        });

        it('should NOT use hardcoded black opacity class bg-black/', () => {
            expect(src).not.toMatch(/bg-black\/\d/);
        });

        it('should NOT use text-white/', () => {
            expect(src).not.toMatch(/text-white\/\d/);
        });
    });

    describe('Search button', () => {
        it('should include a SearchIcon import', () => {
            expect(src).toContain('SearchIcon');
        });

        it('should have at least one Button with search text key', () => {
            expect(src).toContain("'home.searchBar.search'");
        });
    });

    describe('i18n integration', () => {
        it('should import createT from i18n lib', () => {
            expect(src).toContain('createT');
        });

        it('should use i18n key for guests label', () => {
            expect(src).toContain("'home.searchBar.guests'");
        });

        it('should use i18n key for dates label', () => {
            expect(src).toContain("'home.searchBar.dates'");
        });

        it('should use i18n key for adults label (in guests popover)', () => {
            expect(src).toContain("'home.searchBar.adults'");
        });

        it('should use i18n key for cancel button', () => {
            expect(src).toContain("'home.searchBar.cancel'");
        });
    });

    describe('Sub-components used', () => {
        it('should use SearchFieldDestination component', () => {
            expect(src).toContain('SearchFieldDestination');
        });

        it('should use SearchFieldType component', () => {
            expect(src).toContain('SearchFieldType');
        });

        it('should use GuestCounter component', () => {
            expect(src).toContain('GuestCounter');
        });

        it('should use Drawer for mobile layout', () => {
            expect(src).toContain('Drawer');
            expect(src).toContain('DrawerContent');
        });

        it('should use Popover for desktop guest/date pickers', () => {
            expect(src).toContain('Popover');
            expect(src).toContain('PopoverContent');
        });

        it('should use Calendar for date range selection', () => {
            expect(src).toContain('Calendar');
        });
    });

    describe('Responsive layout', () => {
        it('should hide desktop bar on small screens (lg:flex)', () => {
            expect(src).toContain('lg:flex');
        });

        it('should hide mobile button on large screens (lg:hidden)', () => {
            expect(src).toContain('lg:hidden');
        });
    });

    describe('Icons', () => {
        it('should import CalendarDotsIcon from @repo/icons', () => {
            expect(src).toContain('CalendarDotsIcon');
            expect(src).toContain('@repo/icons');
        });

        it('should import UsersIcon from @repo/icons', () => {
            expect(src).toContain('UsersIcon');
        });
    });

    describe('useSearchForm hook', () => {
        it('should import useSearchForm hook', () => {
            expect(src).toContain('useSearchForm');
        });
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// HeroSlideshow.tsx
// ──────────────────────────────────────────────────────────────────────────────

describe('HeroSlideshow.tsx', () => {
    const src = readComponent('components/hero/HeroSlideshow.tsx');

    describe('Exports', () => {
        it('should use a named export for HeroSlideshow', () => {
            expect(src).toContain('export { HeroSlideshow }');
        });

        it('should export HeroSlideshowProps type', () => {
            expect(src).toContain('export type { HeroSlideshowProps');
        });

        it('should export HeroImage type', () => {
            expect(src).toContain('HeroImage');
        });

        it('should NOT use a default export', () => {
            expect(src).not.toMatch(/^export default/m);
        });
    });

    describe('Props interface', () => {
        it('should define HeroSlideshowProps interface with readonly images', () => {
            expect(src).toContain('interface HeroSlideshowProps');
            expect(src).toContain('readonly images');
        });

        it('should have optional interval prop', () => {
            expect(src).toContain('readonly interval?');
        });

        it('should have optional fadeDuration prop', () => {
            expect(src).toContain('readonly fadeDuration?');
        });
    });

    describe('Image layers', () => {
        it('should render img elements with loading=eager for first paint', () => {
            expect(src).toContain('loading="eager"');
        });

        it('should have two image layer refs (layerARef, layerBRef)', () => {
            expect(src).toContain('layerARef');
            expect(src).toContain('layerBRef');
        });

        it('should use absolute positioning for images to enable crossfade', () => {
            expect(src).toContain('absolute inset-0');
        });

        it('should scale images for the zoom effect', () => {
            expect(src).toContain('scale-110');
        });

        it('should use object-cover for image fitting', () => {
            expect(src).toContain('object-cover');
        });
    });

    describe('Dot navigation accessibility', () => {
        it('should have role=tablist on the dots container', () => {
            expect(src).toContain('role="tablist"');
        });

        it('should have aria-label on the tablist for slideshow navigation', () => {
            expect(src).toContain('aria-label="Slideshow navigation"');
        });

        it('should have role=tab on individual dot buttons', () => {
            expect(src).toContain('role="tab"');
        });

        it('should have aria-selected on dot buttons', () => {
            expect(src).toContain('aria-selected=');
        });

        it('should have aria-label with slide index on each dot button', () => {
            expect(src).toContain('aria-label={`Slide');
        });
    });

    describe('Hero semantic tokens for dots', () => {
        it('should use bg-hero-text for active dot', () => {
            expect(src).toContain('bg-hero-text');
        });

        it('should use bg-hero-surface for inactive dot', () => {
            expect(src).toContain('bg-hero-surface');
        });

        it('should use bg-hero-text-muted for hovered inactive dot', () => {
            expect(src).toContain('bg-hero-text-muted');
        });

        it('should use text-hero-text-muted for caption text', () => {
            expect(src).toContain('text-hero-text-muted');
        });
    });

    describe('Caption rendering', () => {
        it('should render a caption paragraph with image alt text', () => {
            expect(src).toContain('images[activeSlide]?.alt');
        });
    });

    describe('Animation constants', () => {
        it('should define DEFAULT_INTERVAL constant', () => {
            expect(src).toContain('DEFAULT_INTERVAL');
        });

        it('should define DEFAULT_FADE_DURATION constant', () => {
            expect(src).toContain('DEFAULT_FADE_DURATION');
        });
    });

    describe('React hooks usage', () => {
        it('should use useState for activeSlide', () => {
            expect(src).toContain('activeSlide');
        });

        it('should use useRef for layer refs', () => {
            expect(src).toContain('useRef');
        });

        it('should use useEffect for preloading and auto-advance', () => {
            expect(src).toContain('useEffect');
        });

        it('should use useCallback for transitionTo and goToSlide', () => {
            expect(src).toContain('useCallback');
        });
    });

    describe('Scroll-based dots fade', () => {
        it('should listen to scroll events to hide dots when scrolled', () => {
            expect(src).toContain('scroll');
        });

        it('should track dotsOpacity state', () => {
            expect(src).toContain('dotsOpacity');
        });

        it('should track dotsVisible state', () => {
            expect(src).toContain('dotsVisible');
        });
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// Hero image data file (src/data/hero.ts)
// ──────────────────────────────────────────────────────────────────────────────

describe('hero.ts data file', () => {
    const heroData = readComponent('data/hero.ts');

    describe('Exports', () => {
        it('should export HERO_IMAGE_SOURCES as a named export', () => {
            expect(heroData).toContain('export const HERO_IMAGE_SOURCES');
        });

        it('should export SLIDE_SECONDS as a named export', () => {
            expect(heroData).toContain('export const SLIDE_SECONDS');
        });

        it('should NOT use a default export', () => {
            expect(heroData).not.toMatch(/^export default/m);
        });
    });

    describe('HERO_IMAGE_SOURCES array', () => {
        it('should contain at least 10 image entries', () => {
            // Each entry has a src property — count occurrences
            const srcMatches = heroData.match(/\{ src: hero\d+/g);
            expect(srcMatches).not.toBeNull();
            expect((srcMatches ?? []).length).toBeGreaterThanOrEqual(10);
        });

        it('should use "as const" assertion for immutability', () => {
            expect(heroData).toContain('as const');
        });

        it('should include alt text for each image entry', () => {
            expect(heroData).toContain('alt:');
        });

        it('should include an entry for the Rio Uruguay view', () => {
            expect(heroData).toContain('Rio Uruguay');
        });

        it('should include entries for termas and playa scenes', () => {
            expect(heroData.toLowerCase()).toContain('termas');
            expect(heroData.toLowerCase()).toContain('playa');
        });
    });

    describe('SLIDE_SECONDS constant', () => {
        it('should define SLIDE_SECONDS as a numeric constant', () => {
            expect(heroData).toMatch(/SLIDE_SECONDS\s*=\s*\d+/);
        });

        it('should use "as const" on SLIDE_SECONDS for literal type narrowing', () => {
            expect(heroData).toContain('SLIDE_SECONDS');
            expect(heroData).toContain('as const');
        });
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// HeroSection.astro - additional structural tests
// ──────────────────────────────────────────────────────────────────────────────

describe('HeroSection.astro - structural and visual details', () => {
    const heroSection = readFileSync(
        resolve(srcDir, 'components/sections/HeroSection.astro'),
        'utf8'
    );

    describe('H1 heading styling', () => {
        it('should include h1 element with font-serif class for serif heading font', () => {
            expect(heroSection).toContain('<h1');
            expect(heroSection).toContain('font-serif');
        });

        it('should use font-bold weight on the h1 element', () => {
            expect(heroSection).toContain('font-bold');
        });

        it('should use text-hero-text semantic token on the h1', () => {
            expect(heroSection).toContain('text-hero-text');
        });

        it('should use clamp() for fluid typography on h1', () => {
            expect(heroSection).toContain('clamp(');
        });
    });

    describe('Hero image sources integration', () => {
        it('should import HERO_IMAGE_SOURCES from @/data/hero', () => {
            expect(heroSection).toContain('HERO_IMAGE_SOURCES');
            expect(heroSection).toContain('@/data/hero');
        });

        it('should import SLIDE_SECONDS constant', () => {
            expect(heroSection).toContain('SLIDE_SECONDS');
        });

        it('should pass interval derived from SLIDE_SECONDS to HeroSlideshow', () => {
            expect(heroSection).toContain('interval={SLIDE_SECONDS * 1000}');
        });

        it('should map HERO_IMAGE_SOURCES to slideshowImages array', () => {
            expect(heroSection).toContain('slideshowImages');
        });
    });

    describe('Wave divider at bottom', () => {
        it('should include a wave-bottom-hero CSS class for the wave divider effect', () => {
            expect(heroSection).toContain('wave-bottom-hero');
        });

        it('should use overflow-hidden to clip the wave shape', () => {
            expect(heroSection).toContain('overflow-hidden');
        });
    });

    describe('Overlay gradient', () => {
        it('should use a gradient with hero-overlay-heavy semantic tokens', () => {
            expect(heroSection).toContain('from-hero-overlay-heavy');
            expect(heroSection).toContain('to-hero-overlay-heavy');
        });

        it('should use via-hero-overlay for the middle gradient stop', () => {
            expect(heroSection).toContain('via-hero-overlay');
        });
    });

    describe('Scroll fade behavior', () => {
        it('should have an inline script for hero scroll effects', () => {
            expect(heroSection).toContain('<script>');
            expect(heroSection).toContain('handleScroll');
        });

        it('should listen to astro:page-load to re-initialize scroll effects', () => {
            expect(heroSection).toContain('astro:page-load');
        });

        it('should use passive scroll listener for performance', () => {
            expect(heroSection).toContain('passive: true');
        });
    });
});
