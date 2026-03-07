/**
 * @file list-property-section.test.ts
 * @description Focused tests for ListPropertySection.astro.
 *
 * Covers: Props interface, i18n translation keys and fallbacks,
 * imported icons from @repo/icons, CTA link structure with locale-aware
 * URLs, illustration image reference, quick-stat badges, accessibility
 * (aria-hidden on decorative elements), and semantic token compliance.
 *
 * Strategy: source-file reading via readFileSync.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const src = readFileSync(
    resolve(__dirname, '../../../src/components/sections/ListPropertySection.astro'),
    'utf8'
);

// ---------------------------------------------------------------------------
// Props interface
// ---------------------------------------------------------------------------

describe('ListPropertySection.astro - Props interface', () => {
    it('should define a Props interface', () => {
        // Arrange / Act / Assert
        expect(src).toContain('interface Props');
    });

    it('should declare locale as a readonly optional prop', () => {
        expect(src).toContain('readonly locale?');
    });

    it('should default locale to "es" for the Argentina market', () => {
        expect(src).toContain("locale = 'es'");
    });
});

// ---------------------------------------------------------------------------
// i18n integration
// ---------------------------------------------------------------------------

describe('ListPropertySection.astro - i18n integration', () => {
    it('should import createT from @/lib/i18n', () => {
        expect(src).toContain('createT');
        expect(src).toContain('@/lib/i18n');
    });

    it('should create the translation function with the locale prop', () => {
        expect(src).toContain('createT(locale)');
    });

    it('should use home.ownerCta namespace for all copy', () => {
        expect(src).toContain("t('home.ownerCta.");
    });

    it('should translate the tagline text', () => {
        expect(src).toContain("t('home.ownerCta.tagline'");
    });

    it('should translate the heading title', () => {
        expect(src).toContain("t('home.ownerCta.title'");
    });

    it('should translate the description paragraph', () => {
        expect(src).toContain("t('home.ownerCta.description'");
    });

    it('should translate the primary CTA button label', () => {
        expect(src).toContain("t('home.ownerCta.cta'");
    });

    it('should translate the secondary "how it works" link', () => {
        expect(src).toContain("t('home.ownerCta.howItWorks'");
    });

    it('should translate the visitors quick-stat badge', () => {
        expect(src).toContain("t('home.ownerCta.visitors'");
    });

    it('should translate the free-listing quick-stat badge', () => {
        expect(src).toContain("t('home.ownerCta.free'");
    });

    it('should translate the direct-bookings quick-stat badge', () => {
        expect(src).toContain("t('home.ownerCta.directBookings'");
    });

    it('should provide Spanish fallback for the "Quiero publicar" CTA', () => {
        expect(src).toContain("'Quiero publicar'");
    });

    it('should provide Spanish fallback for the tagline "Para anfitriones"', () => {
        expect(src).toContain("'Para anfitriones'");
    });
});

// ---------------------------------------------------------------------------
// Imported icons
// ---------------------------------------------------------------------------

describe('ListPropertySection.astro - Icon imports', () => {
    it('should import icons from @repo/icons (not inline SVGs)', () => {
        expect(src).toContain('from "@repo/icons"');
    });

    it('should import ArrowRightIcon for the CTA button', () => {
        expect(src).toContain('ArrowRightIcon');
    });

    it('should import UsersIcon for the visitors quick-stat', () => {
        expect(src).toContain('UsersIcon');
    });

    it('should import StarIcon for the free-listing quick-stat', () => {
        expect(src).toContain('StarIcon');
    });

    it('should import TrendingUpIcon for the direct-bookings quick-stat', () => {
        expect(src).toContain('TrendingUpIcon');
    });
});

// ---------------------------------------------------------------------------
// CTA link structure and locale-aware URLs
// ---------------------------------------------------------------------------

describe('ListPropertySection.astro - CTA links', () => {
    it('should include a primary CTA link to registrar-alojamiento', () => {
        expect(src).toContain('registrar-alojamiento');
    });

    it('should prefix the primary CTA with the locale param', () => {
        expect(src).toContain('`/${locale}/registrar-alojamiento`');
    });

    it('should include a secondary link to como-funciona', () => {
        expect(src).toContain('como-funciona');
    });

    it('should prefix the secondary link with the locale param', () => {
        expect(src).toContain('`/${locale}/como-funciona`');
    });

    it('should render an <a> element for the primary CTA', () => {
        expect(src).toContain('<a');
    });
});

// ---------------------------------------------------------------------------
// Illustration and image reference
// ---------------------------------------------------------------------------

describe('ListPropertySection.astro - Illustration', () => {
    it('should reference the publica-alojamiento illustration SVG', () => {
        expect(src).toContain('ilustracion-publica-alojamiento.svg');
    });

    it('should use /images/illustrations/ path from the public directory', () => {
        expect(src).toContain('/images/illustrations/');
    });

    it('should set an alt attribute on the illustration image', () => {
        // alt is populated via the t() CTA key
        expect(src).toContain('alt={t(');
    });

    it('should apply object-contain class for layout-safe scaling', () => {
        expect(src).toContain('object-contain');
    });

    it('should hide the illustration on small screens (hidden lg:block)', () => {
        expect(src).toContain('hidden lg:block');
    });
});

// ---------------------------------------------------------------------------
// Quick-stat badges
// ---------------------------------------------------------------------------

describe('ListPropertySection.astro - Quick-stat badges', () => {
    it('should render the visitors stat with a UsersIcon', () => {
        expect(src).toContain('<UsersIcon');
    });

    it('should render the free-listing stat with a StarIcon', () => {
        expect(src).toContain('<StarIcon');
    });

    it('should render the direct-bookings stat with a TrendingUpIcon', () => {
        expect(src).toContain('<TrendingUpIcon');
    });

    it('should set size={14} on quick-stat icons for compact layout', () => {
        expect(src).toContain('size={14}');
    });
});

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------

describe('ListPropertySection.astro - Accessibility', () => {
    it('should mark decorative circle divs as aria-hidden', () => {
        expect(src).toContain('aria-hidden="true"');
    });

    it('should use a semantic <section> element as the root', () => {
        expect(src).toContain('<section');
    });

    it('should use an <h3> for the section heading inside the card', () => {
        expect(src).toContain('<h3');
    });

    it('should use a <p> for the tagline label above the heading', () => {
        expect(src).toContain('<p ');
    });
});

// ---------------------------------------------------------------------------
// Semantic token compliance
// ---------------------------------------------------------------------------

describe('ListPropertySection.astro - Semantic token compliance', () => {
    it('should use from-primary for the gradient card background', () => {
        expect(src).toContain('from-primary');
    });

    it('should use to-primary for gradient end color', () => {
        expect(src).toContain('to-primary');
    });

    it('should use text-primary-foreground for text on the dark card', () => {
        expect(src).toContain('text-primary-foreground');
    });

    it('should use bg-primary-foreground/5 for the decorative circles', () => {
        expect(src).toContain('bg-primary-foreground/5');
    });

    it('should use bg-accent for the primary CTA button background', () => {
        expect(src).toContain('bg-accent');
    });

    it('should use text-accent-foreground for CTA button label', () => {
        expect(src).toContain('text-accent-foreground');
    });

    it('should NOT use hardcoded colors like bg-blue or bg-white', () => {
        expect(src).not.toContain('bg-blue-');
        expect(src).not.toContain('bg-white');
        expect(src).not.toContain('text-white ');
    });
});

// ---------------------------------------------------------------------------
// Background and decorative components
// ---------------------------------------------------------------------------

describe('ListPropertySection.astro - Background and decorative elements', () => {
    it('should import BackgroundPattern for the section texture', () => {
        expect(src).toContain('BackgroundPattern');
    });

    it('should use the topo pattern SVG', () => {
        expect(src).toContain('pattern-topo.svg');
    });

    it('should import DecorativeElement for illustrative flourishes', () => {
        expect(src).toContain('DecorativeElement');
    });

    it('should include a kayak decorative element', () => {
        expect(src).toContain('deco-kayak.svg');
    });

    it('should include a multi-pins decorative element', () => {
        expect(src).toContain('deco-multi-pins.svg');
    });

    it('should include a double-arrow decorative element', () => {
        expect(src).toContain('deco-flecha-doble.svg');
    });
});

// ---------------------------------------------------------------------------
// Scroll-reveal and layout utilities
// ---------------------------------------------------------------------------

describe('ListPropertySection.astro - Layout utilities', () => {
    it('should apply scroll-reveal for entrance animation', () => {
        expect(src).toContain('scroll-reveal');
    });

    it('should constrain content width with max-w-5xl', () => {
        expect(src).toContain('max-w-5xl');
    });

    it('should use rounded-3xl on the gradient card for pill shape', () => {
        expect(src).toContain('rounded-3xl');
    });

    it('should apply overflow-hidden on the card to clip decorative circles', () => {
        expect(src).toContain('overflow-hidden');
    });
});
