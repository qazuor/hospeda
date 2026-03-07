import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const srcDir = resolve(__dirname, '../../src');

const src = readFileSync(resolve(srcDir, 'layouts/Header.astro'), 'utf8');

describe('Header.astro - Semantic HTML', () => {
    it('should use a nav element as the root element', () => {
        // Arrange: source already loaded
        // Act: look for semantic nav element
        // Assert
        expect(src).toContain('<nav');
    });

    it('should have an aria-label on the nav element for screen readers', () => {
        // Arrange / Act / Assert
        expect(src).toContain('aria-label=');
    });

    it('should give the nav element an id of navbar', () => {
        // Arrange / Act / Assert
        expect(src).toContain('id="navbar"');
    });
});

describe('Header.astro - Logo and brand', () => {
    it('should render the Hospeda logo image', () => {
        // Arrange / Act / Assert
        expect(src).toContain('src="/images/logo.webp"');
        expect(src).toContain('alt="Hospeda logo"');
    });

    it('should display Hospeda brand text next to the logo', () => {
        // Arrange / Act / Assert
        expect(src).toContain('Hospeda');
    });

    it('should wrap the logo in a locale-aware link using buildUrl', () => {
        // Arrange / Act / Assert
        // The logo anchor href is built via buildUrl with the typed locale
        expect(src).toContain('buildUrl({ locale: typedLocale })');
    });
});

describe('Header.astro - Desktop navigation links', () => {
    it('should import NAV_LINKS from the navigation data file', () => {
        // Arrange / Act / Assert
        expect(src).toContain('NAV_LINKS');
        expect(src).toContain('@/data/navigation');
    });

    it('should iterate over NAV_LINKS to render desktop nav anchors', () => {
        // Arrange / Act / Assert
        expect(src).toContain('NAV_LINKS.map');
        expect(src).toContain('nav-link');
    });

    it('should resolve nav link hrefs via getNavHref which uses buildUrl', () => {
        // Arrange / Act / Assert
        expect(src).toContain('getNavHref');
        expect(src).toContain('buildUrl');
    });

    it('should use the locale variable when building nav link paths', () => {
        // Arrange / Act / Assert
        expect(src).toContain('typedLocale');
    });

    it('should render visual separators between desktop nav items', () => {
        // Arrange / Act / Assert
        expect(src).toContain('nav-separator');
    });
});

describe('Header.astro - Language switcher', () => {
    it('should import LanguageSwitcher component', () => {
        // Arrange / Act / Assert
        expect(src).toContain('import LanguageSwitcher from');
        expect(src).toContain('LanguageSwitcher.astro');
    });

    it('should render LanguageSwitcher with the current locale', () => {
        // Arrange / Act / Assert
        expect(src).toContain('<LanguageSwitcher locale={typedLocale}');
    });

    it('should render LanguageSwitcher in both desktop and mobile layouts', () => {
        // Arrange / Act / Assert
        // Two occurrences: one in the desktop CTA bar and one inside the mobile menu
        const occurrences = (src.match(/<LanguageSwitcher/g) ?? []).length;
        expect(occurrences).toBeGreaterThanOrEqual(2);
    });
});

describe('Header.astro - Auth section', () => {
    it('should import AuthSection component', () => {
        // Arrange / Act / Assert
        expect(src).toContain('import AuthSection from');
        expect(src).toContain('AuthSection.astro');
    });

    it('should render AuthSection with server:defer for deferred hydration', () => {
        // Arrange / Act / Assert
        expect(src).toContain('server:defer');
        expect(src).toContain('<AuthSection');
    });

    it('should pass locale prop to AuthSection', () => {
        // Arrange / Act / Assert
        expect(src).toContain('locale={locale}');
    });

    it('should provide a fallback slot inside AuthSection for pre-render state', () => {
        // Arrange / Act / Assert
        expect(src).toContain('slot="fallback"');
    });
});

describe('Header.astro - Theme toggle', () => {
    it('should import ThemeToggle component', () => {
        // Arrange / Act / Assert
        expect(src).toContain('import ThemeToggle from');
        expect(src).toContain('ThemeToggle.astro');
    });

    it('should render ThemeToggle in the desktop CTA bar', () => {
        // Arrange / Act / Assert
        expect(src).toContain('<ThemeToggle');
    });
});

describe('Header.astro - Mobile navigation', () => {
    it('should include a mobile menu button with id mobile-menu-btn', () => {
        // Arrange / Act / Assert
        expect(src).toContain('id="mobile-menu-btn"');
    });

    it('should set aria-expanded on the mobile menu button', () => {
        // Arrange / Act / Assert
        expect(src).toContain('aria-expanded="false"');
    });

    it('should set aria-controls linking button to the mobile menu panel', () => {
        // Arrange / Act / Assert
        expect(src).toContain('aria-controls="mobile-menu"');
    });

    it('should render the full-screen mobile menu panel with id mobile-menu', () => {
        // Arrange / Act / Assert
        expect(src).toContain('id="mobile-menu"');
    });

    it('should mark the mobile menu panel as a dialog with aria-modal', () => {
        // Arrange / Act / Assert
        expect(src).toContain('role="dialog"');
        expect(src).toContain('aria-modal="true"');
    });

    it('should include open and close icon elements for the mobile button', () => {
        // Arrange / Act / Assert
        expect(src).toContain('id="menu-icon-open"');
        expect(src).toContain('id="menu-icon-close"');
    });

    it('should import ListIcon and CloseIcon from @repo/icons for the mobile button', () => {
        // Arrange / Act / Assert
        expect(src).toContain('ListIcon');
        expect(src).toContain('CloseIcon');
        expect(src).toContain('@repo/icons');
    });
});

describe('Header.astro - i18n integration', () => {
    it('should import createT from the i18n lib', () => {
        // Arrange / Act / Assert
        expect(src).toContain('createT');
        expect(src).toContain('@/lib/i18n');
    });

    it('should cast locale to SupportedLocale for type safety', () => {
        // Arrange / Act / Assert
        expect(src).toContain('SupportedLocale');
        expect(src).toContain('typedLocale');
    });

    it('should use translation helper t() for nav labels', () => {
        // Arrange / Act / Assert
        expect(src).toContain('t(link.labelKey');
    });
});

describe('Header.astro - Owner CTA link', () => {
    it('should render a CTA link to the propietarios page', () => {
        // Arrange / Act / Assert
        expect(src).toContain("path: 'propietarios'");
    });

    it('should build the propietarios link using buildUrl with current locale', () => {
        // Arrange / Act / Assert
        expect(src).toContain("buildUrl({ locale: typedLocale, path: 'propietarios' })");
    });
});

describe('Header.astro - Scroll behavior script', () => {
    it('should contain a scroll event listener for navbar style changes', () => {
        // Arrange / Act / Assert
        expect(src).toContain('window.addEventListener("scroll"');
    });

    it('should apply backdrop-blur when the page is scrolled', () => {
        // Arrange / Act / Assert
        expect(src).toContain('backdrop-blur-md');
    });

    it('should dispatch a custom navbar:scroll event for islands to consume', () => {
        // Arrange / Act / Assert
        expect(src).toContain('navbar:scroll');
        expect(src).toContain('CustomEvent');
    });
});

describe('Header.astro - Prop defaults', () => {
    it('should default locale to es', () => {
        // Arrange / Act / Assert
        expect(src).toContain("locale = 'es'");
    });

    it('should default isHomepage to false', () => {
        // Arrange / Act / Assert
        expect(src).toContain('isHomepage = false');
    });
});
