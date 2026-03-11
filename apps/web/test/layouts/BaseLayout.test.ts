import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const srcDir = resolve(__dirname, '../../src');

const src = readFileSync(resolve(srcDir, 'layouts/BaseLayout.astro'), 'utf8');

describe('BaseLayout.astro - HTML document structure', () => {
    it('should declare DOCTYPE html', () => {
        // Arrange: source already loaded
        // Act: search for doctype declaration
        // Assert
        expect(src).toMatch(/<!doctype html>/i);
    });

    it('should have an html element with lang attribute bound to locale prop', () => {
        // Arrange: source already loaded
        // Act: look for html tag with dynamic lang
        // Assert
        expect(src).toContain('<html lang={locale}>');
    });

    it('should include meta charset UTF-8', () => {
        // Arrange / Act / Assert
        expect(src).toContain('charset="UTF-8"');
    });

    it('should include meta viewport tag for responsive design', () => {
        // Arrange / Act / Assert
        expect(src).toContain('name="viewport"');
        expect(src).toContain('width=device-width');
    });
});

describe('BaseLayout.astro - FOUC prevention for dark mode', () => {
    it('should contain an inline script for theme detection', () => {
        // Arrange: source already loaded
        // Act: check for is:inline script
        // Assert
        expect(src).toContain('is:inline');
    });

    it('should read theme from localStorage in the inline script', () => {
        // Arrange / Act / Assert
        expect(src).toContain("localStorage.getItem('theme')");
    });

    it('should check prefers-color-scheme dark media query', () => {
        // Arrange / Act / Assert
        expect(src).toContain('prefers-color-scheme: dark');
    });

    it('should set data-theme attribute on documentElement when dark', () => {
        // Arrange / Act / Assert
        expect(src).toContain("setAttribute('data-theme', 'dark')");
    });
});

describe('BaseLayout.astro - Font loading', () => {
    it('should preconnect to fonts.googleapis.com', () => {
        // Arrange / Act / Assert
        expect(src).toContain('href="https://fonts.googleapis.com"');
        expect(src).toContain('rel="preconnect"');
    });

    it('should preconnect to fonts.gstatic.com', () => {
        // Arrange / Act / Assert
        expect(src).toContain('href="https://fonts.gstatic.com"');
    });

    it('should load Inter and Dancing Script font families', () => {
        // Arrange / Act / Assert
        expect(src).toContain('Dancing+Script');
        expect(src).toContain('Inter');
    });
});

describe('BaseLayout.astro - Favicon and icons', () => {
    it('should include SVG favicon link', () => {
        // Arrange / Act / Assert
        expect(src).toContain('href="/icon.svg"');
        expect(src).toContain('type="image/svg+xml"');
    });

    it('should include light-scheme PNG favicon', () => {
        // Arrange / Act / Assert
        expect(src).toContain('href="/icon-light-32x32.png"');
    });

    it('should include dark-scheme PNG favicon', () => {
        // Arrange / Act / Assert
        expect(src).toContain('href="/icon-dark-32x32.png"');
    });

    it('should include apple-touch-icon', () => {
        // Arrange / Act / Assert
        expect(src).toContain('rel="apple-touch-icon"');
        expect(src).toContain('href="/apple-icon.png"');
    });
});

describe('BaseLayout.astro - Slots', () => {
    it('should expose a named head slot for SEO overrides', () => {
        // Arrange / Act / Assert
        expect(src).toContain('<slot name="head"');
    });

    it('should expose a default slot for page body content', () => {
        // Arrange / Act / Assert
        // The default slot has no name attribute
        expect(src).toMatch(/<slot\s*\/>/);
    });
});

describe('BaseLayout.astro - Scroll-reveal observer', () => {
    it('should contain the scroll-reveal selector constant', () => {
        // Arrange / Act / Assert
        expect(src).toContain('.scroll-reveal');
        expect(src).toContain('.scroll-reveal-left');
        expect(src).toContain('.scroll-reveal-right');
    });

    it('should use IntersectionObserver for scroll-triggered reveals', () => {
        // Arrange / Act / Assert
        expect(src).toContain('IntersectionObserver');
    });

    it('should respect prefers-reduced-motion for accessibility', () => {
        // Arrange / Act / Assert
        expect(src).toContain('prefers-reduced-motion: reduce');
    });

    it('should use MutationObserver to handle dynamically added elements', () => {
        // Arrange / Act / Assert
        expect(src).toContain('MutationObserver');
    });

    it('should add the revealed class when an element intersects', () => {
        // Arrange / Act / Assert
        expect(src).toContain('"revealed"');
    });
});

describe('BaseLayout.astro - Component imports', () => {
    it('should import Header layout component', () => {
        // Arrange / Act / Assert
        // The file uses double-quoted imports: import Header from "./Header.astro"
        expect(src).toContain('import Header from');
        expect(src).toContain('Header.astro');
    });

    it('should import Footer layout component', () => {
        // Arrange / Act / Assert
        // The file uses double-quoted imports: import Footer from "./Footer.astro"
        expect(src).toContain('import Footer from');
        expect(src).toContain('Footer.astro');
    });

    it('should import FeedbackFAB from @repo/feedback', () => {
        // Arrange / Act / Assert
        expect(src).toContain('FeedbackFAB');
        expect(src).toContain('@repo/feedback');
    });

    it('should import ToastContainer from the Toast client component', () => {
        // Arrange / Act / Assert
        expect(src).toContain('ToastContainer');
        expect(src).toContain('Toast.client');
    });
});

describe('BaseLayout.astro - Layout structure', () => {
    it('should render Header conditionally based on showHeader prop', () => {
        // Arrange / Act / Assert
        expect(src).toContain('showHeader');
        expect(src).toContain('<Header');
    });

    it('should render Footer unconditionally with locale prop', () => {
        // Arrange / Act / Assert
        expect(src).toContain('<Footer locale={locale}');
    });

    it('should include a skip-to-content accessibility link', () => {
        // Arrange / Act / Assert
        expect(src).toContain('skip-to-content');
        expect(src).toContain('#main-content');
    });

    it('should wrap page content in a main element with id main-content', () => {
        // Arrange / Act / Assert
        expect(src).toContain('id="main-content"');
        expect(src).toContain('<main');
    });

    it('should mount FeedbackFAB with client:only directive', () => {
        // Arrange / Act / Assert
        // FeedbackFAB uses client:only="react" (cannot be server-rendered)
        expect(src).toContain('client:only="react"');
        expect(src).toContain('<FeedbackFAB');
    });
});

describe('BaseLayout.astro - Default prop values', () => {
    it('should default title to Hospeda', () => {
        // Arrange / Act / Assert
        expect(src).toContain('"Hospeda"');
    });

    it('should default locale to es', () => {
        // Arrange / Act / Assert
        // The destructuring uses double quotes: locale = "es"
        expect(src).toContain('locale = "es"');
    });

    it('should default showHeader to true', () => {
        // Arrange / Act / Assert
        expect(src).toContain('showHeader = true');
    });
});
