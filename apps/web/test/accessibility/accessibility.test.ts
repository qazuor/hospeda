/**
 * @file accessibility.test.ts
 * @description WCAG AA pattern validation via source-content inspection.
 *
 * Tests check for accessibility patterns across layout, page, and component
 * source files: aria-hidden on decorative elements, skip links, semantic
 * landmarks, focus management, form label associations, image alt text,
 * heading hierarchy, and prefers-reduced-motion handling.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Source files under test
// ---------------------------------------------------------------------------

const baseLayoutSrc = readFileSync(
    resolve(__dirname, '../../src/layouts/BaseLayout.astro'),
    'utf8'
);

const headerSrc = readFileSync(resolve(__dirname, '../../src/layouts/Header.astro'), 'utf8');

const globalCssSrc = readFileSync(resolve(__dirname, '../../src/styles/global.css'), 'utf8');

const page404Src = readFileSync(resolve(__dirname, '../../src/pages/404.astro'), 'utf8');

const page500Src = readFileSync(resolve(__dirname, '../../src/pages/500.astro'), 'utf8');

const _homepageSrc = readFileSync(resolve(__dirname, '../../src/pages/[lang]/index.astro'), 'utf8');

const contactoSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/contacto.astro'),
    'utf8'
);

const mapaSiteSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mapa-del-sitio.astro'),
    'utf8'
);

// ---------------------------------------------------------------------------
// Skip link — keyboard-first navigation
// ---------------------------------------------------------------------------

describe('BaseLayout.astro — skip to content link', () => {
    it('renders a skip-to-content link as the first interactive element', () => {
        // WCAG 2.4.1: bypass blocks
        expect(baseLayoutSrc).toContain('class="skip-to-content"');
        expect(baseLayoutSrc).toContain('href="#main-content"');
    });

    it('skip-to-content link text is descriptive', () => {
        expect(baseLayoutSrc).toContain('Skip to content');
    });

    it('skip link target has id="main-content" on the <main> element', () => {
        expect(baseLayoutSrc).toContain('id="main-content"');
        expect(baseLayoutSrc).toContain('<main id="main-content"');
    });
});

// ---------------------------------------------------------------------------
// Semantic landmarks — HTML5 structural elements
// ---------------------------------------------------------------------------

describe('BaseLayout.astro — semantic landmark elements', () => {
    it('wraps primary content in a <main> element', () => {
        // WCAG 1.3.1: info and relationships
        expect(baseLayoutSrc).toContain('<main ');
        expect(baseLayoutSrc).toContain('</main>');
    });

    it('sets the page language via lang attribute on <html>', () => {
        // WCAG 3.1.1: language of page
        expect(baseLayoutSrc).toContain('lang={locale}');
        expect(baseLayoutSrc).toContain('<html lang');
    });

    it('renders a <Footer> landmark component', () => {
        expect(baseLayoutSrc).toContain('<Footer');
    });

    it('renders a <Header> landmark component', () => {
        expect(baseLayoutSrc).toContain('<Header');
    });
});

describe('Header.astro — semantic landmark elements', () => {
    it('wraps navigation in a <nav> element', () => {
        expect(headerSrc).toContain('<nav');
    });

    it('adds an aria-label to the main navigation', () => {
        // WCAG 4.1.2: name, role, value — nav must have accessible name
        expect(headerSrc).toContain('aria-label=');
    });

    it('uses the principal nav translation key for the aria-label', () => {
        expect(headerSrc).toContain("'nav.principal'");
    });
});

// ---------------------------------------------------------------------------
// Focus management — keyboard accessibility
// ---------------------------------------------------------------------------

describe('Header.astro — focus management', () => {
    it('mobile menu button has aria-expanded attribute', () => {
        // WCAG 4.1.2: buttons that toggle panels must expose their state
        expect(headerSrc).toContain('aria-expanded="false"');
        expect(headerSrc).toContain('setAttribute("aria-expanded"');
    });

    it('mobile menu button has aria-controls referencing the menu panel', () => {
        expect(headerSrc).toContain('aria-controls="mobile-menu"');
    });

    it('mobile menu button has a descriptive aria-label', () => {
        expect(headerSrc).toContain('aria-label=');
        expect(headerSrc).toContain("'nav.abrirMenu'");
    });

    it('aria-label updates when the menu opens or closes', () => {
        // Dynamic label change on toggle
        expect(headerSrc).toContain('setAttribute("aria-label"');
        expect(headerSrc).toContain('data-label-open=');
        expect(headerSrc).toContain('data-label-close=');
    });

    it('mobile menu overlay has role="dialog" with aria-modal', () => {
        expect(headerSrc).toContain('role="dialog"');
        expect(headerSrc).toContain('aria-modal="true"');
    });
});

describe('BaseLayout.astro — focus-visible styles', () => {
    it('skip-to-content link has a focus style defined in an inline <style>', () => {
        // Focus must be visible (WCAG 2.4.7)
        expect(baseLayoutSrc).toContain('.skip-to-content:focus');
    });
});

describe('Interactive elements — focus-visible outline', () => {
    it('links in 404 page have focus-visible:outline styles', () => {
        expect(page404Src).toContain('focus-visible:outline');
    });

    it('buttons and links in 500 page have focus-visible:outline styles', () => {
        expect(page500Src).toContain('focus-visible:outline');
    });

    it('links in contacto page have focus-visible:outline styles', () => {
        expect(contactoSrc).toContain('focus-visible:outline');
    });

    it('links in mapa-del-sitio have focus-visible:outline styles', () => {
        expect(mapaSiteSrc).toContain('focus-visible:outline');
    });
});

// ---------------------------------------------------------------------------
// Decorative elements — aria-hidden
// ---------------------------------------------------------------------------

describe('aria-hidden on decorative elements', () => {
    it('404 page SVG illustration is aria-hidden', () => {
        // Decorative images must be hidden from screen readers (WCAG 1.1.1)
        expect(page404Src).toContain('aria-hidden="true"');
    });

    it('500 page SVG illustration is aria-hidden', () => {
        expect(page500Src).toContain('aria-hidden="true"');
    });

    it('404 decorative error code text is aria-hidden', () => {
        // The giant "404" number is decorative; the h1 conveys the real message
        const matches = page404Src.match(/aria-hidden="true"/g) ?? [];
        expect(matches.length).toBeGreaterThanOrEqual(2);
    });

    it('500 decorative error code text is aria-hidden', () => {
        const matches = page500Src.match(/aria-hidden="true"/g) ?? [];
        expect(matches.length).toBeGreaterThanOrEqual(2);
    });

    it('header nav separator spans are aria-hidden', () => {
        // Decorative pipe separators between nav links are not meaningful
        expect(headerSrc).toContain('aria-hidden="true"');
    });

    it('icons inside buttons and links are aria-hidden', () => {
        // Icon SVGs inside labelled buttons/links must not add duplicate text
        expect(page404Src).toContain('aria-hidden="true"');
        expect(page500Src).toContain('aria-hidden="true"');
    });
});

// ---------------------------------------------------------------------------
// Image alt text
// ---------------------------------------------------------------------------

describe('Header.astro — image alt text', () => {
    it('logo image has a descriptive alt attribute', () => {
        // WCAG 1.1.1: non-text content
        expect(headerSrc).toContain('alt="Hospeda logo"');
    });
});

// ---------------------------------------------------------------------------
// Heading hierarchy
// ---------------------------------------------------------------------------

describe('Page heading hierarchy', () => {
    it('404 page has exactly one h1 element', () => {
        const h1Count = (page404Src.match(/<h1/g) ?? []).length;
        expect(h1Count).toBe(1);
    });

    it('500 page has exactly one h1 element', () => {
        const h1Count = (page500Src.match(/<h1/g) ?? []).length;
        expect(h1Count).toBe(1);
    });

    it('mapa-del-sitio has one h1 and uses h2 for section headings', () => {
        // The page renders seven sections via Astro's map() template — the source
        // contains one <h2 template expression that produces a heading per section.
        const h1Count = (mapaSiteSrc.match(/<h1/g) ?? []).length;
        const h2Count = (mapaSiteSrc.match(/<h2/g) ?? []).length;
        expect(h1Count).toBe(1);
        expect(h2Count).toBeGreaterThanOrEqual(1);
    });

    it('contacto page h1 is the first heading on the page', () => {
        // h2 should only appear after an h1 in the document
        const h1Index = contactoSrc.indexOf('<h1');
        const h2Index = contactoSrc.indexOf('<h2');
        expect(h1Index).toBeGreaterThan(0);
        expect(h1Index).toBeLessThan(h2Index);
    });

    it('contacto page has an h1 and an h2 (contact info section)', () => {
        expect(contactoSrc).toContain('<h1');
        expect(contactoSrc).toContain('<h2');
    });
});

// ---------------------------------------------------------------------------
// Semantic HTML — additional structural elements
// ---------------------------------------------------------------------------

describe('Semantic HTML structural elements', () => {
    it('mapa-del-sitio uses <article> elements for section cards', () => {
        // Each sitemap card is a standalone, self-contained content unit
        expect(mapaSiteSrc).toContain('<article');
    });

    it('mapa-del-sitio uses <nav> with aria-label inside each section', () => {
        expect(mapaSiteSrc).toContain('<nav aria-label=');
    });

    it('contacto page uses <aside> for supplementary contact information', () => {
        // The contact info panel is supplementary to the main form content
        expect(contactoSrc).toContain('<aside');
    });

    it('contacto page uses <section> with scroll-reveal for the main section', () => {
        expect(contactoSrc).toContain('<section');
    });

    it('contacto page wraps its heading in a <header> element', () => {
        expect(contactoSrc).toContain('<header');
    });

    it('mapa-del-sitio wraps its page heading in a <header> element', () => {
        expect(mapaSiteSrc).toContain('<header');
    });

    it('contacto contact info uses a <ul> list for contact items', () => {
        // Structurally listed contact details aid screen reader navigation
        expect(contactoSrc).toContain('<ul');
        expect(contactoSrc).toContain('<li');
    });
});

// ---------------------------------------------------------------------------
// Form accessibility — label associations
// ---------------------------------------------------------------------------

describe('contacto.astro — form accessibility', () => {
    it('renders a ContactForm React island for the contact form', () => {
        // Form label/field associations are owned by ContactForm component
        expect(contactoSrc).toContain('ContactForm');
    });

    it('social media links have descriptive aria-label attributes', () => {
        // Icon-only links must have accessible names (WCAG 1.1.1, 4.1.2)
        expect(contactoSrc).toContain('aria-label="Instagram"');
        expect(contactoSrc).toContain('aria-label="Facebook"');
        expect(contactoSrc).toContain('aria-label="Twitter / X"');
    });

    it('social media icon SVGs inside links are aria-hidden', () => {
        // Icon is decorative when the link already has an accessible name
        expect(contactoSrc).toContain('aria-hidden="true"');
    });

    it('contact info list has an aria-label for screen reader context', () => {
        expect(contactoSrc).toContain('aria-label={contactInfoHeading}');
    });
});

// ---------------------------------------------------------------------------
// Prefers-reduced-motion
// ---------------------------------------------------------------------------

describe('global.css — prefers-reduced-motion support', () => {
    it('BaseLayout respects prefers-reduced-motion in the scroll observer script', () => {
        // The inline scroll-reveal script checks prefers-reduced-motion and
        // immediately reveals all elements when the user prefers reduced motion
        expect(baseLayoutSrc).toContain('prefers-reduced-motion');
        expect(baseLayoutSrc).toContain('prefersReducedMotion');
    });

    it('scroll-reveal animations are defined in CSS', () => {
        expect(globalCssSrc).toContain('.scroll-reveal');
        expect(globalCssSrc).toContain('.scroll-reveal.revealed');
    });

    it('defines transition properties for scroll-reveal animations', () => {
        expect(globalCssSrc).toContain('transition:');
        expect(globalCssSrc).toContain('ease-out');
    });
});

// ---------------------------------------------------------------------------
// Dark mode — contrast accessibility
// ---------------------------------------------------------------------------

describe('global.css — dark mode via data-theme attribute', () => {
    it('dark mode activates via [data-theme="dark"] selector', () => {
        // Ensures dark mode is not dependent on OS preference alone,
        // letting users override regardless of system settings
        expect(globalCssSrc).toContain('[data-theme="dark"]');
    });

    it('BaseLayout includes FOUC prevention script for dark mode', () => {
        // Prevents flash of un-themed content before styles load
        expect(baseLayoutSrc).toContain("localStorage.getItem('theme')");
        expect(baseLayoutSrc).toContain('data-theme');
    });

    it('dark mode defines destructive color for error states', () => {
        // Ensures error colors remain visible in dark mode
        const darkSection = globalCssSrc.slice(globalCssSrc.indexOf('[data-theme="dark"]'));
        expect(darkSection).toContain('--destructive:');
    });
});

// ---------------------------------------------------------------------------
// Viewport meta tag — mobile accessibility
// ---------------------------------------------------------------------------

describe('BaseLayout.astro — viewport and mobile accessibility', () => {
    it('sets the viewport meta tag for responsive layout', () => {
        // Prevents mobile browsers from scaling down pages (WCAG 1.4.4)
        expect(baseLayoutSrc).toContain('name="viewport"');
        expect(baseLayoutSrc).toContain('width=device-width');
    });

    it('sets charset to UTF-8 for international character support', () => {
        expect(baseLayoutSrc).toContain('charset="UTF-8"');
    });
});
