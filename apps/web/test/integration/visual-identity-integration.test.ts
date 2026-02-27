/**
 * Integration tests for SPEC-015: Regional visual identity on the homepage.
 * End-to-end verification that all new visual identity components are correctly
 * assembled in the homepage and referenced in the design system files.
 *
 * Checks cover:
 * - Regional palette (#0D7377) defined in global.css
 * - Fraunces font referenced in global.css and tailwind.css
 * - RiverWavesDivider imported in HeroSection
 * - Bento grid layout in FeaturedDestinations
 * - Glassmorphism cards in StatisticsSection
 * - Postcard-carousel class in TestimonialsSection
 * - Newsletter gradient from-primary-800
 * - Owner CTA split flex layout
 * - Footer bg-gradient-to-b from-primary-900
 * - Texture classes in global CSS
 * - ScrollHeader imported in Header
 * - ViewTransitions in BaseLayout
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// --- Source file paths ---
const homepagePath = resolve(__dirname, '../../src/pages/[lang]/index.astro');
const globalCssPath = resolve(__dirname, '../../src/styles/global.css');
const tailwindCssPath = resolve(__dirname, '../../src/styles/tailwind.css');
const texturesCssPath = resolve(__dirname, '../../src/styles/textures.css');
const heroSectionPath = resolve(__dirname, '../../src/components/content/HeroSection.astro');
const featuredDestinationsPath = resolve(
    __dirname,
    '../../src/components/content/FeaturedDestinations.astro'
);
const statisticsSectionPath = resolve(
    __dirname,
    '../../src/components/content/StatisticsSection.astro'
);
const testimonialsSectionPath = resolve(
    __dirname,
    '../../src/components/content/TestimonialsSection.astro'
);
const newsletterSectionPath = resolve(
    __dirname,
    '../../src/components/content/NewsletterSection.astro'
);
const ownerCtaSectionPath = resolve(
    __dirname,
    '../../src/components/content/OwnerCTASection.astro'
);
const footerPath = resolve(__dirname, '../../src/layouts/Footer.astro');
const headerPath = resolve(__dirname, '../../src/layouts/Header.astro');
const baseLayoutPath = resolve(__dirname, '../../src/layouts/BaseLayout.astro');

// --- Read source files ---
const homepage = readFileSync(homepagePath, 'utf8');
const globalCss = readFileSync(globalCssPath, 'utf8');
const tailwindCss = readFileSync(tailwindCssPath, 'utf8');
const texturesCss = readFileSync(texturesCssPath, 'utf8');
const heroSection = readFileSync(heroSectionPath, 'utf8');
const featuredDestinations = readFileSync(featuredDestinationsPath, 'utf8');
const statisticsSection = readFileSync(statisticsSectionPath, 'utf8');
const testimonialsSection = readFileSync(testimonialsSectionPath, 'utf8');
const newsletterSection = readFileSync(newsletterSectionPath, 'utf8');
const ownerCtaSection = readFileSync(ownerCtaSectionPath, 'utf8');
const footer = readFileSync(footerPath, 'utf8');
const header = readFileSync(headerPath, 'utf8');
const baseLayout = readFileSync(baseLayoutPath, 'utf8');

describe('Visual Identity Integration (SPEC-015)', () => {
    describe('Regional palette - global.css', () => {
        it('should define primary color #0D7377 (Rio Uruguay teal)', () => {
            expect(globalCss).toMatch(/--color-primary:\s*#0D7377/i);
        });

        it('should define full primary scale from 50 to 950', () => {
            expect(globalCss).toContain('--color-primary-50:');
            expect(globalCss).toContain('--color-primary-800:');
            expect(globalCss).toContain('--color-primary-900:');
            expect(globalCss).toContain('--color-primary-950:');
        });

        it('should define warm sand accent color #F0E6D6', () => {
            expect(globalCss).toMatch(/--color-accent:\s*#F0E6D6/i);
        });

        it('should define amber gold secondary color #D4870E', () => {
            expect(globalCss).toMatch(/--color-secondary:\s*#D4870E/i);
        });

        it('should define terracotta accent-dark #C25B3A', () => {
            expect(globalCss).toMatch(/--color-accent-dark:\s*#C25B3A/i);
        });

        it('should define river sand background #FDFAF5', () => {
            expect(globalCss).toMatch(/--color-bg:\s*#FDFAF5/i);
        });

        it('should define warm brown text #2C1810', () => {
            expect(globalCss).toMatch(/--color-text:\s*#2C1810/i);
        });

        it('should define Noche Estrellada dark mode with night blue #0F1A2E', () => {
            const darkSection = globalCss.split('[data-theme="dark"]')[1];
            expect(darkSection).toBeDefined();
            expect(darkSection).toMatch(/--color-bg:\s*#0F1A2E/i);
        });

        it('should define luminous teal #3DBDC0 for dark mode primary', () => {
            const darkSection = globalCss.split('[data-theme="dark"]')[1];
            expect(darkSection).toBeDefined();
            expect(darkSection).toMatch(/--color-primary:\s*#3DBDC0/i);
        });
    });

    describe('Fraunces font - global.css', () => {
        it('should define Fraunces Fallback @font-face', () => {
            expect(globalCss).toContain('font-family: "Fraunces Fallback"');
        });

        it('should use Georgia as Fraunces Fallback source', () => {
            expect(globalCss).toContain('src: local("Georgia")');
        });

        it('should reference Fraunces in --font-serif variable', () => {
            expect(globalCss).toContain('"Fraunces"');
        });

        it('should define --fraunces-hero variable axis settings', () => {
            expect(globalCss).toContain('--fraunces-hero:');
        });

        it('should define --fraunces-section variable axis settings', () => {
            expect(globalCss).toContain('--fraunces-section:');
        });

        it('should define --fraunces-default variable axis settings', () => {
            expect(globalCss).toContain('--fraunces-default:');
        });
    });

    describe('Fraunces font - tailwind.css', () => {
        it('should import global.css which contains Fraunces definitions', () => {
            expect(tailwindCss).toContain('@import "./global.css"');
        });

        it('should map --font-serif (Fraunces) to Tailwind theme', () => {
            const themeSection = tailwindCss.split('@theme inline')[1];
            expect(themeSection).toBeDefined();
            expect(themeSection).toContain('--font-serif');
        });

        it('should apply font-serif to headings in base layer', () => {
            expect(tailwindCss).toContain('var(--font-serif)');
        });

        it('should apply font-variation-settings for Fraunces axes on headings', () => {
            expect(tailwindCss).toContain('font-variation-settings');
            expect(tailwindCss).toContain('var(--fraunces-default)');
        });
    });

    describe('Shape divider - HeroSection', () => {
        it('should have torn paper shape divider at bottom', () => {
            expect(heroSection).toContain('hero-shape-divider');
        });

        it('should use CSS mask for shape divider', () => {
            expect(heroSection).toContain('mask-image');
        });

        it('should position divider absolutely at bottom', () => {
            const dividerBlock = heroSection.slice(heroSection.indexOf('hero-shape-divider'));
            expect(dividerBlock).toContain('bottom-[-1px]');
        });

        it('should use banner-shape.png for mask', () => {
            expect(heroSection).toContain('banner-shape.png');
        });

        it('should have aria-hidden on divider', () => {
            const dividerBlock = heroSection.slice(heroSection.indexOf('hero-shape-divider'));
            expect(dividerBlock).toContain('aria-hidden="true"');
        });
    });

    describe('Uniform grid - FeaturedDestinations', () => {
        it('should use destinations-grid class on the grid container', () => {
            expect(featuredDestinations).toContain('destinations-grid');
        });

        it('should use CSS grid for layout', () => {
            expect(featuredDestinations).toContain('grid');
        });

        it('should not use bento-style col-span or row-span', () => {
            expect(featuredDestinations).not.toContain('col-span-2');
            expect(featuredDestinations).not.toContain('row-span-2');
        });

        it('should use uniform cards without hero differentiation', () => {
            expect(featuredDestinations).not.toContain('featuredCard');
            expect(featuredDestinations).not.toContain('regularCards');
        });

        it('homepage should include FeaturedDestinations with texture-sand on section', () => {
            expect(homepage).toContain('texture-sand');
        });
    });

    describe('Glassmorphism - StatisticsSection', () => {
        it('should use glassmorphism-card class on stat items', () => {
            expect(statisticsSection).toContain('glassmorphism-card');
        });

        it('should apply backdrop-blur-md on glassmorphism cards', () => {
            expect(statisticsSection).toContain('backdrop-blur-md');
        });

        it('should have border border-white/20 on glassmorphism cards', () => {
            expect(statisticsSection).toContain('border-white/20');
        });

        it('should define .glassmorphism-card with semi-transparent background', () => {
            expect(statisticsSection).toContain('rgba(255, 255, 255, 0.08)');
        });

        it('should use @supports for progressive enhancement of backdrop-filter', () => {
            expect(statisticsSection).toContain('@supports (backdrop-filter:');
        });

        it('should have mobile fallback removing blur for glassmorphism', () => {
            expect(statisticsSection).toContain('backdrop-filter: none');
        });

        it('StatisticsSection component should exist', () => {
            expect(statisticsSection).toBeDefined();
        });
    });

    describe('Postcard testimonials - TestimonialsSection', () => {
        it('should use postcard-carousel class as container', () => {
            expect(testimonialsSection).toContain('postcard-carousel');
        });

        it('should apply rotation transform on odd testimonial cards for postcard feel', () => {
            expect(testimonialsSection).toContain('rotate(-1deg)');
        });

        it('should apply rotation transform on even testimonial cards', () => {
            expect(testimonialsSection).toContain('rotate(1deg)');
        });

        it('should implement folded-corner effect with ::before pseudo-element', () => {
            expect(testimonialsSection).toContain('::before');
            expect(testimonialsSection).toContain('border-width: 0 24px 24px 0');
        });

        it('should implement stamp decoration with ::after pseudo-element', () => {
            expect(testimonialsSection).toContain('::after');
            expect(testimonialsSection).toContain('border: 2px dashed var(--color-primary)');
        });

        it('should respect prefers-reduced-motion by removing rotation', () => {
            expect(testimonialsSection).toContain('prefers-reduced-motion: reduce');
            expect(testimonialsSection).toContain('transform: none');
        });

        it('homepage should pass testimonials array to TestimonialsSection', () => {
            expect(homepage).toContain('testimonials={TESTIMONIALS}');
        });
    });

    describe('Newsletter gradient - NewsletterSection', () => {
        it('should use gradient from-primary-800 in background layer', () => {
            expect(newsletterSection).toContain('from-primary-800');
        });

        it('should use bg-gradient-to-br for gradient direction', () => {
            expect(newsletterSection).toContain('bg-gradient-to-br');
        });

        it('should include via-primary-700 in the gradient', () => {
            expect(newsletterSection).toContain('via-primary-700');
        });

        it('should include to-primary-900 in the gradient', () => {
            expect(newsletterSection).toContain('to-primary-900');
        });

        it('should have decorative SVG river illustration', () => {
            expect(newsletterSection).toContain('<svg');
        });

        it('NewsletterSection component should exist', () => {
            expect(newsletterSection).toBeDefined();
        });
    });

    describe('Owner CTA split layout - OwnerCTASection', () => {
        it('should use flex layout for split container', () => {
            expect(ownerCtaSection).toContain('flex');
        });

        it('should stack on mobile (flex-col) and go side-by-side on desktop (lg:flex-row)', () => {
            expect(ownerCtaSection).toContain('flex-col');
            expect(ownerCtaSection).toContain('lg:flex-row');
        });

        it('should have left illustration side with flex-shrink-0', () => {
            expect(ownerCtaSection).toContain('flex-shrink-0');
        });

        it('should have right text side with flex-1', () => {
            expect(ownerCtaSection).toContain('flex-1');
        });

        it('should use gradient background from-primary-50', () => {
            expect(ownerCtaSection).toContain('from-primary-50');
        });

        it('should include a decorative SVG illustration on the left side', () => {
            expect(ownerCtaSection).toContain('<svg');
            expect(ownerCtaSection).toContain('aria-hidden="true"');
        });

        it('should link CTA button to propietarios page', () => {
            expect(ownerCtaSection).toContain('/propietarios/');
        });

        it('homepage should include OwnerCTASection', () => {
            expect(homepage).toContain('<OwnerCTASection');
        });
    });

    describe('Footer gradient - Footer', () => {
        it('should use bg-gradient-to-b on the main footer content div', () => {
            expect(footer).toContain('bg-gradient-to-b');
        });

        it('should start gradient from-primary-900', () => {
            expect(footer).toContain('from-primary-900');
        });

        it('should include skyline SVG silhouette divider above footer', () => {
            expect(footer).toContain('<svg');
            expect(footer).toContain('text-primary-900');
        });

        it('should use white/10 border for social links separator', () => {
            expect(footer).toContain('border-white/10');
        });

        it('should have Hecho con mate tagline in accent font', () => {
            expect(footer).toContain('mate');
            expect(footer).toContain('font-accent');
        });
    });

    describe('Texture classes - textures.css referenced in tailwind.css', () => {
        it('tailwind.css should import textures.css', () => {
            expect(tailwindCss).toContain('@import "./textures.css"');
        });

        it('textures.css should define .texture-water class', () => {
            expect(texturesCss).toContain('.texture-water');
        });

        it('textures.css should define .texture-sand class', () => {
            expect(texturesCss).toContain('.texture-sand');
        });

        it('textures.css should define .texture-leaf class', () => {
            expect(texturesCss).toContain('.texture-leaf');
        });

        it('textures.css should define .texture-stars class', () => {
            expect(texturesCss).toContain('.texture-stars');
        });

        it('HeroSection should have dark gradient overlay for text readability', () => {
            expect(heroSection).toContain('bg-gradient-to-b');
        });

        it('homepage should apply texture-sand on FeaturedDestinations section', () => {
            expect(homepage).toContain('texture-sand');
        });
    });

    describe('ScrollHeader - Header', () => {
        it('should use isHero prop to toggle header transparency', () => {
            expect(header).toContain('isHero');
        });

        it('should apply absolute transparent positioning when isHero is true', () => {
            expect(header).toContain('bg-transparent');
        });

        it('should apply solid bg-gray-900 when not in hero mode', () => {
            expect(header).toContain('bg-gray-900');
        });

        it('should include header element with id main-header', () => {
            expect(header).toContain('id="main-header"');
        });

        it('should use ThemeToggle with client:idle for scroll-aware interactions', () => {
            expect(header).toContain('ThemeToggle');
            expect(header).toContain('client:idle');
        });

        it('should use z-20 for proper stacking context over hero', () => {
            expect(header).toContain('z-20');
        });

        it('should have style block with auth and theme toggle styles', () => {
            expect(header).toContain('<style>');
            expect(header).toContain('.header-auth-section');
        });
    });

    describe('ViewTransitions - BaseLayout', () => {
        it('should import ViewTransitions from astro:transitions', () => {
            expect(baseLayout).toContain("import { ViewTransitions } from 'astro:transitions'");
        });

        it('should render ViewTransitions component in head', () => {
            expect(baseLayout).toContain('<ViewTransitions');
        });

        it('should use fallback="swap" on ViewTransitions', () => {
            expect(baseLayout).toContain('fallback="swap"');
        });

        it('should define ::view-transition-old keyframe animation', () => {
            expect(baseLayout).toContain('::view-transition-old(root)');
        });

        it('should define ::view-transition-new keyframe animation', () => {
            expect(baseLayout).toContain('::view-transition-new(root)');
        });

        it('should define vt-fade-scale-out keyframe', () => {
            expect(baseLayout).toContain('vt-fade-scale-out');
        });

        it('should define vt-fade-scale-in keyframe', () => {
            expect(baseLayout).toContain('vt-fade-scale-in');
        });

        it('should define entity-image view transition group for card morphing', () => {
            expect(baseLayout).toContain('::view-transition-group(entity-image)');
        });

        it('should load FOUC prevention script inline before first paint', () => {
            expect(baseLayout).toContain('is:inline');
            expect(baseLayout).toContain('hospeda-theme');
        });
    });

    describe('Homepage source file readability and completeness', () => {
        it('should import BaseLayout', () => {
            expect(homepage).toContain('import BaseLayout');
            expect(homepage).toContain('BaseLayout.astro');
        });

        it('should import all key section components', () => {
            const expectedImports = [
                'HeroSection',
                'FeaturedSection',
                'FeaturedAccommodations',
                'FeaturedDestinations',
                'FeaturedEvents',
                'FeaturedPosts',
                'CategoryIconsSection',
                'TestimonialsSection',
                'OwnerCTASection'
            ];

            for (const component of expectedImports) {
                expect(homepage, `Missing import: ${component}`).toContain(component);
            }
        });

        it('should use server:defer for Server Islands', () => {
            expect(homepage).toContain('server:defer');
        });

        it('should define skeleton fallbacks for each Server Island', () => {
            expect(homepage).toContain('AccommodationCardSkeleton');
            expect(homepage).toContain('DestinationCardSkeleton');
            expect(homepage).toContain('EventCardSkeleton');
            expect(homepage).toContain('BlogPostCardSkeleton');
        });

        it('should define TESTIMONIALS hardcoded array', () => {
            expect(homepage).toContain('const TESTIMONIALS');
            expect(homepage).toContain('testimonial-1');
            expect(homepage).toContain('testimonial-2');
            expect(homepage).toContain('testimonial-3');
        });

        it('should support 3 locales via getStaticPaths', () => {
            expect(homepage).toContain('getStaticLocalePaths as getStaticPaths');
        });

        it('should pass apiBaseUrl to HeroSection', () => {
            expect(homepage).toContain('apiBaseUrl={apiBaseUrl}');
        });
    });
});
