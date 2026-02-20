import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const layoutPath = resolve(__dirname, '../../src/layouts/BaseLayout.astro');
const layoutContent = readFileSync(layoutPath, 'utf8');

describe('BaseLayout.astro', () => {
    describe('Props interface', () => {
        it('should define title prop', () => {
            expect(layoutContent).toContain('title: string');
        });

        it('should define description prop', () => {
            expect(layoutContent).toContain('description: string');
        });

        it('should define optional image prop', () => {
            expect(layoutContent).toContain('image?: string');
        });

        it('should define optional noindex prop', () => {
            expect(layoutContent).toContain('noindex?: boolean');
        });

        it('should define optional locale prop', () => {
            expect(layoutContent).toContain('locale?: string');
        });

        it('should define optional isHero prop for transparent header', () => {
            expect(layoutContent).toContain('isHero?: boolean');
        });
    });

    describe('Head section', () => {
        it('should include charset meta', () => {
            expect(layoutContent).toContain('charset="UTF-8"');
        });

        it('should include viewport meta', () => {
            expect(layoutContent).toContain('name="viewport"');
        });

        it('should include title with Hospeda suffix', () => {
            expect(layoutContent).toContain('| Hospeda');
        });

        it('should include description meta', () => {
            expect(layoutContent).toContain('name="description"');
        });

        it('should include canonical URL', () => {
            expect(layoutContent).toContain('rel="canonical"');
        });

        it('should conditionally include noindex meta', () => {
            expect(layoutContent).toContain('noindex');
            expect(layoutContent).toContain('robots');
        });
    });

    describe('Open Graph', () => {
        it('should include og:title', () => {
            expect(layoutContent).toContain('og:title');
        });

        it('should include og:description', () => {
            expect(layoutContent).toContain('og:description');
        });

        it('should include og:url', () => {
            expect(layoutContent).toContain('og:url');
        });

        it('should include og:locale', () => {
            expect(layoutContent).toContain('og:locale');
        });

        it('should conditionally include og:image', () => {
            expect(layoutContent).toContain('og:image');
        });
    });

    describe('Fonts', () => {
        it('should preconnect to Google Fonts', () => {
            expect(layoutContent).toContain('fonts.googleapis.com');
            expect(layoutContent).toContain('fonts.gstatic.com');
        });

        it('should have crossorigin attribute on gstatic preconnect', () => {
            expect(layoutContent).toContain('crossorigin');
        });

        it('should preload font stylesheet', () => {
            expect(layoutContent).toContain('rel="preload"');
            expect(layoutContent).toContain('as="style"');
        });

        it('should load Inter font', () => {
            expect(layoutContent).toContain('Inter');
        });

        it('should load Fraunces variable font', () => {
            expect(layoutContent).toContain('Fraunces');
        });

        it('should load Caveat font', () => {
            expect(layoutContent).toContain('Caveat');
        });

        it('should use display=swap', () => {
            expect(layoutContent).toContain('display=swap');
        });

        it('should have noscript fallback for font loading', () => {
            expect(layoutContent).toContain('<noscript>');
            expect(layoutContent).toContain('rel="stylesheet"');
        });

        it('should preload Caveat font file', () => {
            expect(layoutContent).toContain('as="font"');
            expect(layoutContent).toContain('crossorigin');
        });
    });

    describe('Accessibility', () => {
        it('should include skip-to-content link', () => {
            expect(layoutContent).toContain('#main-content');
            expect(layoutContent).toContain('Skip to content');
        });

        it('should have main element with id', () => {
            expect(layoutContent).toContain('id="main-content"');
        });

        it('should use lang attribute on html', () => {
            expect(layoutContent).toContain('lang={locale}');
        });
    });

    describe('Layout Components', () => {
        it('should import Header component', () => {
            expect(layoutContent).toContain("import Header from './Header.astro'");
        });

        it('should import Footer component', () => {
            expect(layoutContent).toContain("import Footer from './Footer.astro'");
        });

        it('should render Header with locale and isHero', () => {
            expect(layoutContent).toContain('<Header locale={locale} isHero={isHero}');
        });

        it('should render Footer with locale', () => {
            expect(layoutContent).toContain('<Footer locale={locale}');
        });

        it('should have a default slot inside main', () => {
            expect(layoutContent).toContain('<main');
            expect(layoutContent).toContain('<slot />');
        });
    });

    describe('Styles', () => {
        it('should import tailwind.css', () => {
            expect(layoutContent).toContain('tailwind.css');
        });
    });

    describe('View Transitions', () => {
        it('should import ViewTransitions from astro:transitions', () => {
            expect(layoutContent).toContain("import { ViewTransitions } from 'astro:transitions'");
        });

        it('should render ViewTransitions with fallback swap', () => {
            expect(layoutContent).toContain('<ViewTransitions fallback="swap"');
        });

        it('should define custom view transition keyframes', () => {
            expect(layoutContent).toContain('vt-fade-scale-out');
            expect(layoutContent).toContain('vt-fade-scale-in');
        });
    });

    describe('Dark mode FOUC prevention', () => {
        it('should have inline script for theme detection', () => {
            expect(layoutContent).toContain('is:inline');
            expect(layoutContent).toContain('hospeda-theme');
        });

        it('should set data-theme attribute before first paint', () => {
            expect(layoutContent).toContain('data-theme');
        });
    });

    describe('Scroll reveal', () => {
        it('should have scroll reveal observer script', () => {
            expect(layoutContent).toContain('initScrollReveal');
            expect(layoutContent).toContain('IntersectionObserver');
        });

        it('should respect prefers-reduced-motion', () => {
            expect(layoutContent).toContain('prefers-reduced-motion');
        });

        it('should re-init on astro page load', () => {
            expect(layoutContent).toContain('astro:page-load');
        });
    });
});
