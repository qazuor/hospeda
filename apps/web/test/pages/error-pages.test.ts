/**
 * Tests for error pages (404 and 500).
 * Verifies page structure, SEO elements, content, and accessibility.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const page404Path = resolve(__dirname, '../../src/pages/404.astro');
const page500Path = resolve(__dirname, '../../src/pages/500.astro');
const page404Content = readFileSync(page404Path, 'utf8');
const page500Content = readFileSync(page500Path, 'utf8');

describe('404.astro', () => {
    describe('Page structure', () => {
        it('should use BaseLayout', () => {
            expect(page404Content).toContain(
                "import BaseLayout from '../layouts/BaseLayout.astro'"
            );
            expect(page404Content).toContain('<BaseLayout');
        });

        it('should use SEOHead component', () => {
            expect(page404Content).toContain(
                "import SEOHead from '../components/seo/SEOHead.astro'"
            );
            expect(page404Content).toContain('<SEOHead');
        });

        it('should have SEOHead in head slot', () => {
            expect(page404Content).toContain('slot="head"');
        });
    });

    describe('SEO elements', () => {
        it('should have noindex meta tag', () => {
            expect(page404Content).toContain('noindex={true}');
        });

        it('should generate canonical URL', () => {
            expect(page404Content).toContain('const canonicalUrl = new URL(Astro.url.pathname');
        });

        it('should pass canonical to SEOHead', () => {
            expect(page404Content).toContain('canonical={canonicalUrl}');
        });

        it('should set page type to website', () => {
            expect(page404Content).toContain('type="website"');
        });

        it('should detect locale dynamically', () => {
            expect(page404Content).toContain("let locale: SupportedLocale = 'es'");
            expect(page404Content).toContain('locale={locale}');
        });
    });

    describe('Content', () => {
        it('should use t() for title translation', () => {
            expect(page404Content).toContain("namespace: 'error'");
            expect(page404Content).toContain("'404.title'");
        });

        it('should use t() for message translation', () => {
            expect(page404Content).toContain("'404.message'");
        });

        it('should display 404 text', () => {
            expect(page404Content).toContain(
                '<span class="text-9xl font-bold text-primary opacity-20"'
            );
            expect(page404Content).toContain('>404</span>');
        });

        it('should have h1 heading with translated content', () => {
            expect(page404Content).toContain('<h1 class="mb-4 text-4xl font-bold');
            expect(page404Content).toContain('{heading}');
        });

        it('should have home link with dynamic locale', () => {
            expect(page404Content).toContain('href={`/${locale}/`}');
            expect(page404Content).toContain('{goHomeLabel}');
        });
    });

    describe('Design', () => {
        it('should have centered layout', () => {
            expect(page404Content).toContain('flex items-center justify-center');
        });

        it('should have gradient background', () => {
            expect(page404Content).toContain('bg-gradient-to-b from-bg to-bg-alt');
        });

        it('should have SVG illustration', () => {
            expect(page404Content).toContain('<svg');
            expect(page404Content).toContain('width="200"');
            expect(page404Content).toContain('height="120"');
        });

        it('should have primary button styling for home link', () => {
            expect(page404Content).toContain('bg-primary');
            expect(page404Content).toContain('hover:bg-primary-dark');
        });
    });

    describe('Accessibility', () => {
        it('should have aria-hidden on decorative elements', () => {
            expect(page404Content).toContain('aria-hidden="true"');
        });

        it('should have focus-visible styles', () => {
            expect(page404Content).toContain('focus-visible:outline');
        });
    });
});

describe('500.astro', () => {
    describe('Page structure', () => {
        it('should use BaseLayout', () => {
            expect(page500Content).toContain(
                "import BaseLayout from '../layouts/BaseLayout.astro'"
            );
            expect(page500Content).toContain('<BaseLayout');
        });

        it('should use SEOHead component', () => {
            expect(page500Content).toContain(
                "import SEOHead from '../components/seo/SEOHead.astro'"
            );
            expect(page500Content).toContain('<SEOHead');
        });

        it('should have SEOHead in head slot', () => {
            expect(page500Content).toContain('slot="head"');
        });
    });

    describe('SEO elements', () => {
        it('should have noindex meta tag', () => {
            expect(page500Content).toContain('noindex={true}');
        });

        it('should generate canonical URL', () => {
            expect(page500Content).toContain('const canonicalUrl = new URL(Astro.url.pathname');
        });

        it('should pass canonical to SEOHead', () => {
            expect(page500Content).toContain('canonical={canonicalUrl}');
        });

        it('should set page type to website', () => {
            expect(page500Content).toContain('type="website"');
        });

        it('should detect locale dynamically', () => {
            expect(page500Content).toContain("let locale: SupportedLocale = 'es'");
            expect(page500Content).toContain('locale={locale}');
        });
    });

    describe('Content', () => {
        it('should use t() for title translation', () => {
            expect(page500Content).toContain("namespace: 'error'");
            expect(page500Content).toContain("'500.title'");
        });

        it('should use t() for message translation', () => {
            expect(page500Content).toContain("'500.message'");
        });

        it('should display 500 text', () => {
            expect(page500Content).toContain(
                '<span class="text-9xl font-bold text-error opacity-20"'
            );
            expect(page500Content).toContain('>500</span>');
        });

        it('should have h1 heading with translated content', () => {
            expect(page500Content).toContain('<h1 class="mb-4 text-4xl font-bold');
            expect(page500Content).toContain('{heading}');
        });

        it('should have retry button', () => {
            expect(page500Content).toContain('onclick="window.location.reload()"');
            expect(page500Content).toContain('{retryLabel}');
        });

        it('should have home link with dynamic locale', () => {
            expect(page500Content).toContain('href={`/${locale}/`}');
            expect(page500Content).toContain('{goHomeLabel}');
        });
    });

    describe('Design', () => {
        it('should have centered layout', () => {
            expect(page500Content).toContain('flex items-center justify-center');
        });

        it('should have gradient background', () => {
            expect(page500Content).toContain('bg-gradient-to-b from-bg to-bg-alt');
        });

        it('should have SVG illustration', () => {
            expect(page500Content).toContain('<svg');
            expect(page500Content).toContain('width="200"');
            expect(page500Content).toContain('height="120"');
        });

        it('should use error color for 500 text', () => {
            expect(page500Content).toContain('text-error');
        });

        it('should have responsive button layout', () => {
            expect(page500Content).toContain('flex-col');
            expect(page500Content).toContain('sm:flex-row');
        });
    });

    describe('Accessibility', () => {
        it('should have aria-hidden on decorative elements', () => {
            expect(page500Content).toContain('aria-hidden="true"');
        });

        it('should have focus-visible styles', () => {
            expect(page500Content).toContain('focus-visible:outline');
        });

        it('should use button element for retry action', () => {
            expect(page500Content).toContain('<button');
            expect(page500Content).toContain('type="button"');
        });
    });
});
