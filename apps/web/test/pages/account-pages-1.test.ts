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
            expect(accountIndexContent).toContain('id="stat-favorites"');
        });

        it('should display reviews stat card', () => {
            expect(accountIndexContent).toContain('{statsLabels[locale].reviews}');
            expect(accountIndexContent).toContain('id="stat-reviews"');
        });

        it('should display subscription stat card', () => {
            expect(accountIndexContent).toContain('{statsLabels[locale].subscription}');
            expect(accountIndexContent).toContain('id="stat-subscription"');
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

    describe('Client-side stats script', () => {
        it('should have a script tag to fetch stats from API', () => {
            expect(accountIndexContent).toContain('<script>');
            expect(accountIndexContent).toContain('/api/v1/protected');
        });

        it('should update stat elements by id', () => {
            expect(accountIndexContent).toContain("getElementById('stat-favorites')");
            expect(accountIndexContent).toContain("getElementById('stat-reviews')");
            expect(accountIndexContent).toContain("getElementById('stat-subscription')");
        });

        it('should update stat-subscription-status based on plan.status in loadStats script', () => {
            // Arrange: the script reads plan.status to pick the correct label attribute
            expect(accountIndexContent).toContain("getElementById('stat-subscription-status')");
            expect(accountIndexContent).toContain('plan.status');
            expect(accountIndexContent).toContain('data-label-${plan.status}');
        });

        it('should handle null plan with free label fallback in loadStats script', () => {
            // Arrange: when API returns no plan object, the script falls back to data-label-free
            expect(accountIndexContent).toContain("getAttribute('data-label-free')");
        });
    });

    describe('Subscription stat card data attributes', () => {
        it('should have id "stat-subscription" on the plan name element', () => {
            expect(accountIndexContent).toContain('id="stat-subscription"');
        });

        it('should have id "stat-subscription-status" on the status label element', () => {
            expect(accountIndexContent).toContain('id="stat-subscription-status"');
        });

        it('should have data-label-active attribute on the status element', () => {
            expect(accountIndexContent).toContain(
                'data-label-active={statsDescriptions[locale].activeStatus}'
            );
        });

        it('should have data-label-trial attribute on the status element', () => {
            expect(accountIndexContent).toContain(
                'data-label-trial={statsDescriptions[locale].trialStatus}'
            );
        });

        it('should have data-label-free attribute on the status element', () => {
            expect(accountIndexContent).toContain(
                'data-label-free={statsDescriptions[locale].freeStatus}'
            );
        });
    });

    describe('statsDescriptions localization', () => {
        it('should have subscriptionStatus in statsDescriptions', () => {
            expect(accountIndexContent).toContain('subscriptionStatus:');
        });

        it('should have activeStatus in statsDescriptions', () => {
            expect(accountIndexContent).toContain('activeStatus:');
        });

        it('should have trialStatus in statsDescriptions', () => {
            expect(accountIndexContent).toContain('trialStatus:');
        });

        it('should have freeStatus in statsDescriptions', () => {
            expect(accountIndexContent).toContain('freeStatus:');
        });

        it('should define statsDescriptions with all required locale keys', () => {
            expect(accountIndexContent).toContain('const statsDescriptions:');
        });

        it('should render subscriptionStatus as the initial status text', () => {
            expect(accountIndexContent).toContain('{statsDescriptions[locale].subscriptionStatus}');
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

        it('should import UserFavoritesList React island', () => {
            expect(favoritosContent).toContain(
                "import { UserFavoritesList } from '../../../components/account/UserFavoritesList.client'"
            );
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

    describe('React island', () => {
        it('should render UserFavoritesList with client:visible directive', () => {
            expect(favoritosContent).toContain('<UserFavoritesList client:visible');
        });

        it('should pass locale prop to UserFavoritesList', () => {
            expect(favoritosContent).toContain('locale={locale}');
        });

        it('should have a comment describing the React island purpose', () => {
            expect(favoritosContent).toContain('UserFavoritesList');
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

        it('should import UserReviewsList React island', () => {
            expect(resenasContent).toContain(
                "import { UserReviewsList } from '../../../components/account/UserReviewsList.client'"
            );
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
            expect(resenasContent).toContain("es: 'Mis Resenas'");
            expect(resenasContent).toContain("en: 'My Reviews'");
            expect(resenasContent).toContain("pt: 'Minhas Avaliacoes'");
        });

        it('should have localized meta descriptions', () => {
            expect(resenasContent).toContain('const descriptions: Record<SupportedLocale, string>');
            expect(resenasContent).toContain('Gestiona tus resenas de alojamientos');
        });

        it('should have localized account breadcrumb labels', () => {
            expect(resenasContent).toContain(
                'const accountLabels: Record<SupportedLocale, string>'
            );
            expect(resenasContent).toContain("es: 'Mi Cuenta'");
            expect(resenasContent).toContain("en: 'My Account'");
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

    describe('React island', () => {
        it('should render UserReviewsList with client:visible directive', () => {
            expect(resenasContent).toContain('<UserReviewsList client:visible');
        });

        it('should pass locale prop to UserReviewsList', () => {
            expect(resenasContent).toContain('locale={locale}');
        });

        it('should have a comment describing the React island purpose', () => {
            expect(resenasContent).toContain('UserReviewsList');
        });
    });
});
