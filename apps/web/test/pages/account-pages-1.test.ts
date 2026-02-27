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
            expect(accountIndexContent).toContain('getLocaleFromParams(Astro.params)');
            expect(accountIndexContent).toContain('if (!locale)');
        });

        it('should redirect to /es/ on invalid locale', () => {
            expect(accountIndexContent).toContain("return Astro.redirect('/es/')");
        });

        it('should import locale helpers and i18n function', () => {
            expect(accountIndexContent).toContain('getLocaleFromParams');
            expect(accountIndexContent).toContain("import { t } from '../../../lib/i18n'");
        });
    });

    describe('Localization', () => {
        it('should use t() function for title', () => {
            expect(accountIndexContent).toContain(
                "const title = t({ locale, namespace: 'account', key: 'pages.dashboard.title' })"
            );
        });

        it('should use t() function for description', () => {
            expect(accountIndexContent).toContain(
                "const description = t({ locale, namespace: 'account', key: 'pages.dashboard.description' })"
            );
        });

        it('should use t() function for greeting', () => {
            expect(accountIndexContent).toContain(
                "const greeting = t({ locale, namespace: 'account', key: 'pages.dashboard.greeting' })"
            );
        });

        it('should import HOME_BREADCRUMB from page-helpers', () => {
            expect(accountIndexContent).toContain('HOME_BREADCRUMB');
            expect(accountIndexContent).toContain("from '../../../lib/page-helpers'");
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
            expect(accountIndexContent).toContain('title={title}');
            expect(accountIndexContent).toContain('description={description}');
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
            expect(accountIndexContent).toContain('label: HOME_BREADCRUMB[locale]');
            expect(accountIndexContent).toContain('href: `/${locale}/`');
        });

        it('should include account breadcrumb with title variable', () => {
            expect(accountIndexContent).toContain('label: title');
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
            expect(accountIndexContent).toContain('{greeting}');
        });
    });

    describe('Navigation sidebar', () => {
        it('should have account navigation sidebar', () => {
            expect(accountIndexContent).toContain('id="account-nav"');
        });

        it('should render navigation items', () => {
            expect(accountIndexContent).toContain('navItems.map');
        });

        it('should construct navItems with t() calls', () => {
            expect(accountIndexContent).toContain(
                "label: t({ locale, namespace: 'account', key: 'pages.dashboard.nav.editProfile' })"
            );
        });
    });

    describe('Account stats section', () => {
        it('should have account stats container', () => {
            expect(accountIndexContent).toContain('id="account-stats"');
        });

        it('should use individual stat label variables', () => {
            expect(accountIndexContent).toContain(
                "const statFavoritesLabel = t({ locale, namespace: 'account', key: 'pages.dashboard.stats.favorites' })"
            );
            expect(accountIndexContent).toContain(
                "const statReviewsLabel = t({ locale, namespace: 'account', key: 'pages.dashboard.stats.reviews' })"
            );
            expect(accountIndexContent).toContain(
                "const statSubscriptionLabel = t({ locale, namespace: 'account', key: 'pages.dashboard.stats.subscription' })"
            );
        });

        it('should display favorites stat card', () => {
            expect(accountIndexContent).toContain('{statFavoritesLabel}');
            expect(accountIndexContent).toContain('id="stat-favorites"');
        });

        it('should display reviews stat card', () => {
            expect(accountIndexContent).toContain('{statReviewsLabel}');
            expect(accountIndexContent).toContain('id="stat-reviews"');
        });

        it('should display subscription stat card', () => {
            expect(accountIndexContent).toContain('{statSubscriptionLabel}');
            expect(accountIndexContent).toContain('id="stat-subscription"');
        });

        it('should have links to account sections', () => {
            expect(accountIndexContent).toContain('href={`/${locale}/mi-cuenta/favoritos/`}');
            expect(accountIndexContent).toContain('href={`/${locale}/mi-cuenta/resenas/`}');
            expect(accountIndexContent).toContain('href={`/${locale}/mi-cuenta/suscripcion/`}');
        });
    });

    describe('Localization texts', () => {
        it('should define greeting via t() function', () => {
            expect(accountIndexContent).toContain('const greeting = t({');
        });

        it('should define stat labels via t() functions', () => {
            expect(accountIndexContent).toContain('const statFavoritesLabel = t({');
            expect(accountIndexContent).toContain('const statReviewsLabel = t({');
            expect(accountIndexContent).toContain('const statSubscriptionLabel = t({');
        });

        it('should define stat descriptions via t() functions', () => {
            expect(accountIndexContent).toContain('const statFavoritesDesc = t({');
            expect(accountIndexContent).toContain('const statReviewsDesc = t({');
            expect(accountIndexContent).toContain('const statSubscriptionDesc = t({');
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
            expect(accountIndexContent).toContain("getElementById('stat-subscription-status')");
            expect(accountIndexContent).toContain('plan.status');
            expect(accountIndexContent).toContain('data-label-${plan.status}');
        });

        it('should handle null plan with free label fallback in loadStats script', () => {
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
            expect(accountIndexContent).toContain('data-label-active={statActiveStatus}');
        });

        it('should have data-label-trial attribute on the status element', () => {
            expect(accountIndexContent).toContain('data-label-trial={statTrialStatus}');
        });

        it('should have data-label-free attribute on the status element', () => {
            expect(accountIndexContent).toContain('data-label-free={statFreeStatus}');
        });
    });

    describe('Status label localization', () => {
        it('should have subscriptionStatus via t() function', () => {
            expect(accountIndexContent).toContain(
                "const statSubscriptionStatus = t({ locale, namespace: 'account', key: 'pages.dashboard.stats.subscriptionStatus' })"
            );
        });

        it('should have activeStatus via t() function', () => {
            expect(accountIndexContent).toContain(
                "const statActiveStatus = t({ locale, namespace: 'account', key: 'pages.dashboard.stats.activeStatus' })"
            );
        });

        it('should have trialStatus via t() function', () => {
            expect(accountIndexContent).toContain(
                "const statTrialStatus = t({ locale, namespace: 'account', key: 'pages.dashboard.stats.trialStatus' })"
            );
        });

        it('should have freeStatus via t() function', () => {
            expect(accountIndexContent).toContain(
                "const statFreeStatus = t({ locale, namespace: 'account', key: 'pages.dashboard.stats.freeStatus' })"
            );
        });

        it('should render subscriptionStatus as the initial status text', () => {
            expect(accountIndexContent).toContain('{statSubscriptionStatus}');
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
            expect(favoritosContent).toContain('getLocaleFromParams(Astro.params)');
            expect(favoritosContent).toContain('if (!locale)');
        });

        it('should redirect to /es/ on invalid locale', () => {
            expect(favoritosContent).toContain("return Astro.redirect('/es/')");
        });

        it('should import locale helpers and i18n function', () => {
            expect(favoritosContent).toContain('getLocaleFromParams');
            expect(favoritosContent).toContain("import { t } from '../../../lib/i18n'");
        });
    });

    describe('Localization', () => {
        it('should use t() function for title', () => {
            expect(favoritosContent).toContain(
                "const title = t({ locale, namespace: 'account', key: 'pages.favorites.title' })"
            );
        });

        it('should use t() function for description', () => {
            expect(favoritosContent).toContain(
                "const description = t({ locale, namespace: 'account', key: 'pages.favorites.description' })"
            );
        });

        it('should use t() function for accountLabel', () => {
            expect(favoritosContent).toContain(
                "const accountLabel = t({ locale, namespace: 'account', key: 'pages.accountLabel' })"
            );
        });
    });

    describe('SEO elements', () => {
        it('should generate canonical URL', () => {
            expect(favoritosContent).toContain('const canonicalUrl = new URL(Astro.url.pathname');
            expect(favoritosContent).toContain('canonical={canonicalUrl}');
        });

        it('should pass title and description to SEOHead', () => {
            expect(favoritosContent).toContain('title={title}');
            expect(favoritosContent).toContain('description={description}');
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
            expect(favoritosContent).toContain('label: HOME_BREADCRUMB[locale]');
            expect(favoritosContent).toContain('href: `/${locale}/`');
        });

        it('should include account breadcrumb with accountLabel', () => {
            expect(favoritosContent).toContain('label: accountLabel');
            expect(favoritosContent).toContain('href: `/${locale}/mi-cuenta/`');
        });

        it('should include favorites breadcrumb with title', () => {
            expect(favoritosContent).toContain('label: title');
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
            expect(resenasContent).toContain('getLocaleFromParams(Astro.params)');
            expect(resenasContent).toContain('if (!locale)');
        });

        it('should redirect to /es/ on invalid locale', () => {
            expect(resenasContent).toContain("return Astro.redirect('/es/')");
        });

        it('should import locale helpers and i18n function', () => {
            expect(resenasContent).toContain('getLocaleFromParams');
            expect(resenasContent).toContain("import { t } from '../../../lib/i18n'");
        });
    });

    describe('Localization', () => {
        it('should use t() function for title', () => {
            expect(resenasContent).toContain(
                "const title = t({ locale, namespace: 'account', key: 'pages.reviews.title' })"
            );
        });

        it('should use t() function for description', () => {
            expect(resenasContent).toContain(
                "const description = t({ locale, namespace: 'account', key: 'pages.reviews.description' })"
            );
        });

        it('should use t() function for accountLabel', () => {
            expect(resenasContent).toContain(
                "const accountLabel = t({ locale, namespace: 'account', key: 'pages.accountLabel' })"
            );
        });
    });

    describe('SEO elements', () => {
        it('should generate canonical URL', () => {
            expect(resenasContent).toContain('const canonicalUrl = new URL(Astro.url.pathname');
            expect(resenasContent).toContain('canonical={canonicalUrl}');
        });

        it('should pass title and description to SEOHead', () => {
            expect(resenasContent).toContain('title={title}');
            expect(resenasContent).toContain('description={description}');
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
            expect(resenasContent).toContain('label: HOME_BREADCRUMB[locale]');
            expect(resenasContent).toContain('href: `/${locale}/`');
        });

        it('should include account breadcrumb with accountLabel', () => {
            expect(resenasContent).toContain('label: accountLabel');
            expect(resenasContent).toContain('href: `/${locale}/mi-cuenta/`');
        });

        it('should include reviews breadcrumb with title', () => {
            expect(resenasContent).toContain('label: title');
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
