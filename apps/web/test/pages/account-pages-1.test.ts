/**
 * Tests for account dashboard pages (index, favoritos, resenas).
 * Verifies page structure, SEO elements, localization, and key content sections.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const accountIndexPath = resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/index.astro');
const favoritosPath = resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/favoritos.astro');
const resenasPath = resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/resenas.astro');

const accountIndexContent = readFileSync(accountIndexPath, 'utf8');
const favoritosContent = readFileSync(favoritosPath, 'utf8');
const resenasContent = readFileSync(resenasPath, 'utf8');

describe('mi-cuenta/index.astro', () => {
    describe('Page structure', () => {
        it('should use BaseLayout', () => {
            expect(accountIndexContent).toContain(
                "import BaseLayout from '../../../layouts/BaseLayout.astro'"
            );
            expect(accountIndexContent).toContain('<BaseLayout');
        });

        it('should use SEOHead component', () => {
            expect(accountIndexContent).toContain(
                "import SEOHead from '../../../components/seo/SEOHead.astro'"
            );
            expect(accountIndexContent).toContain('<SEOHead');
        });

        it('should use Container component', () => {
            expect(accountIndexContent).toContain(
                "import Container from '../../../components/ui/Container.astro'"
            );
            expect(accountIndexContent).toContain('<Container>');
        });

        it('should use Breadcrumb component', () => {
            expect(accountIndexContent).toContain(
                "import Breadcrumb from '../../../components/ui/Breadcrumb.astro'"
            );
            expect(accountIndexContent).toContain('<Breadcrumb');
        });

        it('should use Section component', () => {
            expect(accountIndexContent).toContain(
                "import Section from '../../../components/ui/Section.astro'"
            );
            expect(accountIndexContent).toContain('<Section>');
        });
    });

    describe('Locale validation', () => {
        it('should validate locale parameter', () => {
            expect(accountIndexContent).toContain('const { lang } = Astro.params');
            expect(accountIndexContent).toContain('if (!lang || !isValidLocale(lang))');
        });

        it('should redirect to /es/ on invalid locale', () => {
            expect(accountIndexContent).toContain("return Astro.redirect('/es/')");
        });

        it('should import locale helpers', () => {
            expect(accountIndexContent).toContain('isValidLocale');
            expect(accountIndexContent).toContain('type SupportedLocale');
        });
    });

    describe('Localization', () => {
        it('should have localized titles for all supported locales', () => {
            expect(accountIndexContent).toContain("es: 'Mi Cuenta'");
            expect(accountIndexContent).toContain("en: 'My Account'");
            expect(accountIndexContent).toContain("pt: 'Minha Conta'");
        });

        it('should have localized meta descriptions', () => {
            expect(accountIndexContent).toContain(
                'const descriptions: Record<SupportedLocale, string>'
            );
        });

        it('should have localized home breadcrumb labels', () => {
            expect(accountIndexContent).toContain(
                'const homeLabels: Record<SupportedLocale, string>'
            );
            expect(accountIndexContent).toContain("es: 'Inicio'");
            expect(accountIndexContent).toContain("en: 'Home'");
            expect(accountIndexContent).toContain("pt: 'Início'");
        });

        it('should have localized greetings', () => {
            expect(accountIndexContent).toContain('const greetings:');
            expect(accountIndexContent).toContain("es: 'Bienvenido'");
        });
    });

    describe('SEO elements', () => {
        it('should generate canonical URL', () => {
            expect(accountIndexContent).toContain(
                'const canonicalUrl = new URL(Astro.url.pathname'
            );
            expect(accountIndexContent).toContain('canonical={canonicalUrl}');
        });

        it('should pass title and description to SEOHead', () => {
            expect(accountIndexContent).toContain('title={titles[locale]}');
            expect(accountIndexContent).toContain('description={descriptions[locale]}');
        });

        it('should set page type to website', () => {
            expect(accountIndexContent).toContain('type="website"');
        });

        it('should set noindex to true', () => {
            expect(accountIndexContent).toContain('noindex={true}');
        });
    });

    describe('Breadcrumb navigation', () => {
        it('should have breadcrumb items', () => {
            expect(accountIndexContent).toContain('const breadcrumbItems =');
            expect(accountIndexContent).toContain('items={breadcrumbItems}');
        });

        it('should include home breadcrumb', () => {
            expect(accountIndexContent).toContain('label: homeLabels[locale]');
            expect(accountIndexContent).toContain('href: `/${locale}/`');
        });

        it('should include account breadcrumb', () => {
            expect(accountIndexContent).toContain('label: titles[locale]');
            expect(accountIndexContent).toContain('href: `/${locale}/mi-cuenta/`');
        });
    });

    describe('User header card', () => {
        it('should have user header article', () => {
            expect(accountIndexContent).toContain('id="user-header"');
        });

        it('should have avatar with initials', () => {
            expect(accountIndexContent).toContain('h-24 w-24');
            expect(accountIndexContent).toContain('rounded-full');
            expect(accountIndexContent).toContain('bg-primary');
        });

        it('should display user name and email', () => {
            expect(accountIndexContent).toContain('{user.name}');
            expect(accountIndexContent).toContain('{user.email}');
        });

        it('should display localized greeting', () => {
            expect(accountIndexContent).toContain('{greetings[locale]}');
        });
    });

    describe('Navigation sidebar', () => {
        it('should have account navigation sidebar', () => {
            expect(accountIndexContent).toContain('id="account-nav"');
        });

        it('should render navigation items from locale', () => {
            expect(accountIndexContent).toContain('navItems[locale].map');
        });
    });

    describe('Account stats section', () => {
        it('should have account stats container', () => {
            expect(accountIndexContent).toContain('id="account-stats"');
        });

        it('should display favorites stat card', () => {
            expect(accountIndexContent).toContain('{statsLabels[locale].favorites}');
            expect(accountIndexContent).toContain('{stats.favorites}');
        });

        it('should display reviews stat card', () => {
            expect(accountIndexContent).toContain('{statsLabels[locale].reviews}');
            expect(accountIndexContent).toContain('{stats.reviews}');
        });

        it('should display subscription stat card', () => {
            expect(accountIndexContent).toContain('{statsLabels[locale].subscription}');
        });

        it('should have links to account sections', () => {
            expect(accountIndexContent).toContain('href={`/${locale}/mi-cuenta/favoritos/`}');
            expect(accountIndexContent).toContain('href={`/${locale}/mi-cuenta/resenas/`}');
            expect(accountIndexContent).toContain('href={`/${locale}/mi-cuenta/suscripcion/`}');
        });
    });

    describe('Localization texts', () => {
        it('should define greeting texts', () => {
            expect(accountIndexContent).toContain('const greetings:');
        });

        it('should define stat labels', () => {
            expect(accountIndexContent).toContain('const statsLabels:');
        });

        it('should define navigation items', () => {
            expect(accountIndexContent).toContain('const navItems:');
        });
    });
});

describe('mi-cuenta/favoritos.astro', () => {
    describe('Page structure', () => {
        it('should use BaseLayout', () => {
            expect(favoritosContent).toContain(
                "import BaseLayout from '../../../layouts/BaseLayout.astro'"
            );
            expect(favoritosContent).toContain('<BaseLayout');
        });

        it('should use SEOHead component', () => {
            expect(favoritosContent).toContain(
                "import SEOHead from '../../../components/seo/SEOHead.astro'"
            );
            expect(favoritosContent).toContain('<SEOHead');
        });

        it('should use Container component', () => {
            expect(favoritosContent).toContain(
                "import Container from '../../../components/ui/Container.astro'"
            );
            expect(favoritosContent).toContain('<Container>');
        });

        it('should use Breadcrumb component', () => {
            expect(favoritosContent).toContain(
                "import Breadcrumb from '../../../components/ui/Breadcrumb.astro'"
            );
            expect(favoritosContent).toContain('<Breadcrumb');
        });
    });

    describe('Locale validation', () => {
        it('should validate locale parameter', () => {
            expect(favoritosContent).toContain('const { lang } = Astro.params');
            expect(favoritosContent).toContain('if (!lang || !isValidLocale(lang))');
        });

        it('should redirect to /es/ on invalid locale', () => {
            expect(favoritosContent).toContain("return Astro.redirect('/es/')");
        });

        it('should import locale helpers', () => {
            expect(favoritosContent).toContain('isValidLocale');
            expect(favoritosContent).toContain('type SupportedLocale');
        });
    });

    describe('Localization', () => {
        it('should have localized titles for all supported locales', () => {
            expect(favoritosContent).toContain("es: 'Mis Favoritos'");
            expect(favoritosContent).toContain("en: 'My Favorites'");
            expect(favoritosContent).toContain("pt: 'Meus Favoritos'");
        });

        it('should have localized meta descriptions', () => {
            expect(favoritosContent).toContain(
                'const descriptions: Record<SupportedLocale, string>'
            );
            expect(favoritosContent).toContain('Gestiona tus alojamientos, destinos, eventos');
        });

        it('should have localized account breadcrumb labels', () => {
            expect(favoritosContent).toContain(
                'const accountLabels: Record<SupportedLocale, string>'
            );
            expect(favoritosContent).toContain("es: 'Mi Cuenta'");
            expect(favoritosContent).toContain("en: 'My Account'");
        });

        it('should have localized tab labels', () => {
            expect(favoritosContent).toContain('tabs: {');
            expect(favoritosContent).toContain("accommodations: 'Alojamientos'");
            expect(favoritosContent).toContain("destinations: 'Destinos'");
            expect(favoritosContent).toContain("events: 'Eventos'");
            expect(favoritosContent).toContain("blog: 'Blog'");
        });

        it('should have localized empty state message', () => {
            expect(favoritosContent).toContain(
                "emptyState: 'No tienes favoritos en esta categoría'"
            );
        });
    });

    describe('SEO elements', () => {
        it('should generate canonical URL', () => {
            expect(favoritosContent).toContain('const canonicalUrl = new URL(Astro.url.pathname');
            expect(favoritosContent).toContain('canonical={canonicalUrl}');
        });

        it('should pass title and description to SEOHead', () => {
            expect(favoritosContent).toContain('title={titles[locale]}');
            expect(favoritosContent).toContain('description={descriptions[locale]}');
        });

        it('should set page type to website', () => {
            expect(favoritosContent).toContain('type="website"');
        });

        it('should set noindex to true', () => {
            expect(favoritosContent).toContain('noindex={true}');
        });
    });

    describe('Breadcrumb navigation', () => {
        it('should have breadcrumb items', () => {
            expect(favoritosContent).toContain('const breadcrumbItems =');
            expect(favoritosContent).toContain('items={breadcrumbItems}');
        });

        it('should include home breadcrumb', () => {
            expect(favoritosContent).toContain('label: homeLabels[locale]');
            expect(favoritosContent).toContain('href: `/${locale}/`');
        });

        it('should include account breadcrumb', () => {
            expect(favoritosContent).toContain('label: accountLabels[locale]');
            expect(favoritosContent).toContain('href: `/${locale}/mi-cuenta/`');
        });

        it('should include favorites breadcrumb', () => {
            expect(favoritosContent).toContain('label: titles[locale]');
            expect(favoritosContent).toContain('href: `/${locale}/mi-cuenta/favoritos/`');
        });
    });

    describe('Tabs navigation', () => {
        it('should have tabs container', () => {
            expect(favoritosContent).toContain('border-b border-border');
            expect(favoritosContent).toContain('aria-label="Tabs"');
        });

        it('should have accommodations tab', () => {
            expect(favoritosContent).toContain('{labels.tabs.accommodations}');
            expect(favoritosContent).toContain('border-primary');
            expect(favoritosContent).toContain('aria-current="page"');
        });

        it('should have destinations tab', () => {
            expect(favoritosContent).toContain('{labels.tabs.destinations}');
        });

        it('should have events tab', () => {
            expect(favoritosContent).toContain('{labels.tabs.events}');
        });

        it('should have blog tab', () => {
            expect(favoritosContent).toContain('{labels.tabs.blog}');
        });
    });

    describe('Empty state', () => {
        it('should display empty state message', () => {
            expect(favoritosContent).toContain('{labels.emptyState}');
        });

        it('should import FavoriteIcon from @repo/icons', () => {
            expect(favoritosContent).toContain("from '@repo/icons'");
            expect(favoritosContent).toContain('FavoriteIcon');
        });

        it('should have placeholder comment for future card grid', () => {
            expect(favoritosContent).toContain('<!-- Placeholder for future card grid -->');
        });
    });
});

describe('mi-cuenta/resenas.astro', () => {
    describe('Page structure', () => {
        it('should use BaseLayout', () => {
            expect(resenasContent).toContain(
                "import BaseLayout from '../../../layouts/BaseLayout.astro'"
            );
            expect(resenasContent).toContain('<BaseLayout');
        });

        it('should use SEOHead component', () => {
            expect(resenasContent).toContain(
                "import SEOHead from '../../../components/seo/SEOHead.astro'"
            );
            expect(resenasContent).toContain('<SEOHead');
        });

        it('should use Container component', () => {
            expect(resenasContent).toContain(
                "import Container from '../../../components/ui/Container.astro'"
            );
            expect(resenasContent).toContain('<Container>');
        });

        it('should use Breadcrumb component', () => {
            expect(resenasContent).toContain(
                "import Breadcrumb from '../../../components/ui/Breadcrumb.astro'"
            );
            expect(resenasContent).toContain('<Breadcrumb');
        });
    });

    describe('Locale validation', () => {
        it('should validate locale parameter', () => {
            expect(resenasContent).toContain('const { lang } = Astro.params');
            expect(resenasContent).toContain('if (!lang || !isValidLocale(lang))');
        });

        it('should redirect to /es/ on invalid locale', () => {
            expect(resenasContent).toContain("return Astro.redirect('/es/')");
        });

        it('should import locale helpers', () => {
            expect(resenasContent).toContain('isValidLocale');
            expect(resenasContent).toContain('type SupportedLocale');
        });
    });

    describe('Localization', () => {
        it('should have localized titles for all supported locales', () => {
            expect(resenasContent).toContain("es: 'Mis Reseñas'");
            expect(resenasContent).toContain("en: 'My Reviews'");
            expect(resenasContent).toContain("pt: 'Minhas Avaliações'");
        });

        it('should have localized meta descriptions', () => {
            expect(resenasContent).toContain('const descriptions: Record<SupportedLocale, string>');
            expect(resenasContent).toContain('Gestiona tus reseñas de alojamientos');
        });

        it('should have localized account breadcrumb labels', () => {
            expect(resenasContent).toContain(
                'const accountLabels: Record<SupportedLocale, string>'
            );
            expect(resenasContent).toContain("es: 'Mi Cuenta'");
            expect(resenasContent).toContain("en: 'My Account'");
        });

        it('should have localized content labels', () => {
            expect(resenasContent).toContain('const contentLabels =');
            expect(resenasContent).toContain("emptyTitle: 'No has escrito ninguna reseña todavía'");
            expect(resenasContent).toContain("ctaButton: 'Explorar alojamientos'");
        });
    });

    describe('SEO elements', () => {
        it('should generate canonical URL', () => {
            expect(resenasContent).toContain('const canonicalUrl = new URL(Astro.url.pathname');
            expect(resenasContent).toContain('canonical={canonicalUrl}');
        });

        it('should pass title and description to SEOHead', () => {
            expect(resenasContent).toContain('title={titles[locale]}');
            expect(resenasContent).toContain('description={descriptions[locale]}');
        });

        it('should set page type to website', () => {
            expect(resenasContent).toContain('type="website"');
        });

        it('should set noindex to true', () => {
            expect(resenasContent).toContain('noindex={true}');
        });
    });

    describe('Breadcrumb navigation', () => {
        it('should have breadcrumb items', () => {
            expect(resenasContent).toContain('const breadcrumbItems =');
            expect(resenasContent).toContain('items={breadcrumbItems}');
        });

        it('should include home breadcrumb', () => {
            expect(resenasContent).toContain('label: homeLabels[locale]');
            expect(resenasContent).toContain('href: `/${locale}/`');
        });

        it('should include account breadcrumb', () => {
            expect(resenasContent).toContain('label: accountLabels[locale]');
            expect(resenasContent).toContain('href: `/${locale}/mi-cuenta/`');
        });

        it('should include reviews breadcrumb', () => {
            expect(resenasContent).toContain('label: titles[locale]');
            expect(resenasContent).toContain('href: `/${locale}/mi-cuenta/resenas/`');
        });
    });

    describe('Empty state', () => {
        it('should display empty title', () => {
            expect(resenasContent).toContain('{labels.emptyTitle}');
            expect(resenasContent).toContain('text-2xl font-semibold');
        });

        it('should display empty description', () => {
            expect(resenasContent).toContain('{labels.emptyDescription}');
            expect(resenasContent).toContain('max-w-2xl');
        });

        it('should import StarIcon from @repo/icons', () => {
            expect(resenasContent).toContain("from '@repo/icons'");
            expect(resenasContent).toContain('StarIcon');
        });

        it('should have CTA button', () => {
            expect(resenasContent).toContain('href={`/${locale}/alojamientos/`}');
            expect(resenasContent).toContain('{labels.ctaButton}');
            expect(resenasContent).toContain('bg-primary');
        });

        it('should have placeholder comment for future ReviewCard list', () => {
            expect(resenasContent).toContain('<!-- Placeholder for future ReviewCard list -->');
        });
    });
});
