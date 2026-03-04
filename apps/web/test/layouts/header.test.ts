/**
 * Tests for Header.astro layout component (T-039).
 * Verifies isHero prop support, transparent/solid state CSS,
 * hero-mode nav link colors, logo, navigation links, and responsive behavior.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../src/layouts/Header.astro');
const content = readFileSync(componentPath, 'utf8');

describe('Header.astro', () => {
    describe('Semantic HTML', () => {
        it('should use header element', () => {
            expect(content).toContain('<header');
        });

        it('should have navigation with role', () => {
            expect(content).toContain('role="navigation"');
        });

        it('should have aria-label for navigation', () => {
            expect(content).toContain('aria-label=');
        });

        it('should have banner role on header element', () => {
            expect(content).toContain('role="banner"');
        });
    });

    describe('Logo', () => {
        it('should render Hospeda text', () => {
            expect(content).toContain('Hospeda');
        });

        it('should link to locale root', () => {
            expect(content).toContain('${locale}/');
        });

        it('should use serif font', () => {
            expect(content).toContain('font-serif');
        });
    });

    describe('Navigation links', () => {
        it('should include accommodations link via i18n', () => {
            expect(content).toContain("key: 'accommodations'");
            expect(content).toContain('/alojamientos/');
        });

        it('should include destinations link via i18n', () => {
            expect(content).toContain("key: 'destinations'");
            expect(content).toContain('/destinos/');
        });

        it('should include events link via i18n', () => {
            expect(content).toContain("key: 'events'");
            expect(content).toContain('/eventos/');
        });

        it('should include blog link via i18n', () => {
            expect(content).toContain("key: 'blog'");
            expect(content).toContain('/publicaciones/');
        });
    });

    describe('Props interface', () => {
        it('should accept locale prop', () => {
            expect(content).toContain('locale?: string');
        });

        it('should accept isHero prop for transparent-to-solid transition', () => {
            expect(content).toContain('isHero?: boolean');
        });

        it('should default isHero to false', () => {
            expect(content).toContain('isHero = false');
        });
    });

    describe('isHero prop support', () => {
        it('should conditionally apply transparent positioning when isHero is true', () => {
            expect(content).toContain('isHero');
        });

        it('should apply bg-gray-900 class when not isHero (solid background)', () => {
            expect(content).toContain('bg-gray-900');
        });

        it('should use isHero to toggle between absolute and relative positioning', () => {
            expect(content).toContain('absolute');
            expect(content).toContain('relative');
        });
    });

    describe('Nav link classes', () => {
        it('should use text-white/70 for inactive nav links', () => {
            expect(content).toContain('text-white/70');
        });

        it('should use hover:text-white for hover state', () => {
            expect(content).toContain('hover:text-white');
        });

        it('should use text-white for logo in hero mode', () => {
            expect(content).toContain('text-white');
        });

        it('should use border-white/30 for owner CTA button outline', () => {
            expect(content).toContain('border-white/30');
        });
    });

    describe('Style block', () => {
        it('should have a style block', () => {
            expect(content).toContain('<style>');
        });

        it('should define styles for header-theme-toggle', () => {
            expect(content).toContain('.header-theme-toggle');
        });

        it('should define styles for header-auth-section', () => {
            expect(content).toContain('.header-auth-section');
        });
    });

    describe('Responsive', () => {
        it('should hide desktop nav on mobile', () => {
            expect(content).toContain('hidden');
            expect(content).toContain('md:flex');
        });

        it('should use MobileMenuWrapper component for mobile navigation', () => {
            expect(content).toContain(
                "import { MobileMenuWrapper } from '../components/ui/MobileMenuWrapper.client'"
            );
        });

        it('should hydrate MobileMenuWrapper only on mobile via client:media', () => {
            expect(content).toContain('client:media="(max-width: 768px)"');
        });

        it('should pass navItems and locale to MobileMenuWrapper', () => {
            expect(content).toContain('navItems={');
            expect(content).toContain('locale={locale');
        });
    });

    describe('Header positioning', () => {
        it('should have appropriate z-index', () => {
            expect(content).toContain('z-20');
        });

        it('should be full-width', () => {
            expect(content).toContain('w-full');
        });

        it('should use absolute positioning for hero pages', () => {
            expect(content).toContain('absolute top-0 left-0');
        });

        it('should use relative positioning for non-hero pages', () => {
            expect(content).toContain('relative bg-bg');
        });
    });

    describe('Safe area insets', () => {
        it('should account for safe-area-inset-top for notch devices', () => {
            expect(content).toContain('safe-area-inset-top');
        });
    });

    describe('Logo animation', () => {
        it('should have transition-opacity duration-300 on logo', () => {
            expect(content).toContain('transition-opacity duration-300');
        });
    });

    describe('i18n integration', () => {
        it('should import t function from lib/i18n', () => {
            expect(content).toContain("import { t, type SupportedLocale } from '../lib/i18n'");
        });

        it('should use nav namespace for link labels', () => {
            expect(content).toContain("namespace: 'nav'");
        });

        it('should use ownerCta key for CTA button', () => {
            expect(content).toContain("key: 'ownerCta'");
        });
    });

    describe('Auth and theme sections', () => {
        it('should include ThemeToggle component', () => {
            expect(content).toContain(
                "import { ThemeToggle } from '../components/ui/ThemeToggle.client'"
            );
        });

        it('should hydrate ThemeToggle with client:idle', () => {
            expect(content).toContain('client:idle');
        });

        it('should include AuthSection component', () => {
            expect(content).toContain('AuthSection');
        });

        it('should use server:defer for AuthSection', () => {
            expect(content).toContain('server:defer');
        });
    });
});
