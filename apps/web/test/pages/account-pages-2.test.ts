/**
 * Tests for account pages (editar, preferencias, suscripcion).
 * Verifies page structure, SEO elements, localization, and form fields.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const editarPath = resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/editar.astro');
const preferenciasPath = resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/preferencias.astro');
const suscripcionPath = resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/suscripcion.astro');

const editarContent = readFileSync(editarPath, 'utf8');
const preferenciasContent = readFileSync(preferenciasPath, 'utf8');
const suscripcionContent = readFileSync(suscripcionPath, 'utf8');

describe('editar.astro', () => {
    describe('Page structure', () => {
        it('should use BaseLayout', () => {
            expect(editarContent).toContain(
                "import BaseLayout from '../../../layouts/BaseLayout.astro'"
            );
            expect(editarContent).toContain('<BaseLayout');
        });

        it('should use SEOHead component', () => {
            expect(editarContent).toContain(
                "import SEOHead from '../../../components/seo/SEOHead.astro'"
            );
            expect(editarContent).toContain('<SEOHead');
        });

        it('should use Container component', () => {
            expect(editarContent).toContain(
                "import Container from '../../../components/ui/Container.astro'"
            );
            expect(editarContent).toContain('<Container>');
        });

        it('should use Breadcrumb component', () => {
            expect(editarContent).toContain(
                "import Breadcrumb from '../../../components/ui/Breadcrumb.astro'"
            );
            expect(editarContent).toContain('<Breadcrumb');
        });

        it('should import ProfileEditForm React island', () => {
            expect(editarContent).toContain(
                "import { ProfileEditForm } from '../../../components/account/ProfileEditForm.client'"
            );
        });
    });

    describe('Locale validation', () => {
        it('should validate locale parameter', () => {
            expect(editarContent).toContain('const { lang } = Astro.params');
            expect(editarContent).toContain('if (!lang || !isValidLocale(lang))');
        });

        it('should redirect to /es/ on invalid locale', () => {
            expect(editarContent).toContain("return Astro.redirect('/es/')");
        });

        it('should import locale helpers', () => {
            expect(editarContent).toContain('isValidLocale');
            expect(editarContent).toContain('type SupportedLocale');
        });
    });

    describe('Localization', () => {
        it('should have localized titles for all supported locales', () => {
            expect(editarContent).toContain("es: 'Editar Perfil'");
            expect(editarContent).toContain("en: 'Edit Profile'");
            expect(editarContent).toContain("pt: 'Editar Perfil'");
        });

        it('should have localized meta descriptions', () => {
            expect(editarContent).toContain('const descriptions: Record<SupportedLocale, string>');
        });

        it('should have localized breadcrumb labels', () => {
            expect(editarContent).toContain('const homeLabels');
            expect(editarContent).toContain('const accountLabels');
        });
    });

    describe('SEO elements', () => {
        it('should generate canonical URL', () => {
            expect(editarContent).toContain('const canonicalUrl = new URL(Astro.url.pathname');
            expect(editarContent).toContain('canonical={canonicalUrl}');
        });

        it('should pass title and description to SEOHead', () => {
            expect(editarContent).toContain('title={titles[locale]}');
            expect(editarContent).toContain('description={descriptions[locale]}');
        });

        it('should set page type to website', () => {
            expect(editarContent).toContain('type="website"');
        });

        it('should set noindex to true', () => {
            expect(editarContent).toContain('noindex={true}');
        });
    });

    describe('Breadcrumbs', () => {
        it('should define breadcrumb items', () => {
            expect(editarContent).toContain('const breadcrumbItems = [');
            expect(editarContent).toContain('label: homeLabels[locale]');
            expect(editarContent).toContain('label: accountLabels[locale]');
            expect(editarContent).toContain('label: titles[locale]');
        });

        it('should render breadcrumb items prop', () => {
            expect(editarContent).toContain('items={breadcrumbItems}');
        });
    });

    describe('Form section wrapper', () => {
        it('should have profile form section article', () => {
            expect(editarContent).toContain('id="profile-form"');
        });

        it('should render ProfileEditForm React island with client:visible', () => {
            expect(editarContent).toContain('<ProfileEditForm');
            expect(editarContent).toContain('client:visible');
        });

        it('should pass userId to ProfileEditForm', () => {
            expect(editarContent).toContain('userId={user.id}');
        });

        it('should pass initialName to ProfileEditForm', () => {
            expect(editarContent).toContain('initialName={user.name}');
        });

        it('should pass email to ProfileEditForm', () => {
            expect(editarContent).toContain('email={user.email}');
        });

        it('should pass locale to ProfileEditForm', () => {
            expect(editarContent).toContain('locale={locale}');
        });

        it('should extract userBio from user profile', () => {
            expect(editarContent).toContain('userBio');
            expect(editarContent).toContain('initialBio={userBio}');
        });
    });
});

describe('preferencias.astro', () => {
    describe('Page structure', () => {
        it('should use BaseLayout', () => {
            expect(preferenciasContent).toContain(
                "import BaseLayout from '../../../layouts/BaseLayout.astro'"
            );
            expect(preferenciasContent).toContain('<BaseLayout');
        });

        it('should use SEOHead component', () => {
            expect(preferenciasContent).toContain(
                "import SEOHead from '../../../components/seo/SEOHead.astro'"
            );
            expect(preferenciasContent).toContain('<SEOHead');
        });

        it('should use Container component', () => {
            expect(preferenciasContent).toContain(
                "import Container from '../../../components/ui/Container.astro'"
            );
            expect(preferenciasContent).toContain('<Container>');
        });

        it('should use Breadcrumb component', () => {
            expect(preferenciasContent).toContain(
                "import Breadcrumb from '../../../components/ui/Breadcrumb.astro'"
            );
            expect(preferenciasContent).toContain('<Breadcrumb');
        });

        it('should import PreferenceToggles React island', () => {
            expect(preferenciasContent).toContain(
                "import { PreferenceToggles } from '../../../components/account/PreferenceToggles.client'"
            );
        });
    });

    describe('Locale validation', () => {
        it('should validate locale parameter', () => {
            expect(preferenciasContent).toContain('const { lang } = Astro.params');
            expect(preferenciasContent).toContain('if (!lang || !isValidLocale(lang))');
        });

        it('should redirect to /es/ on invalid locale', () => {
            expect(preferenciasContent).toContain("return Astro.redirect('/es/')");
        });

        it('should import locale helpers', () => {
            expect(preferenciasContent).toContain('isValidLocale');
            expect(preferenciasContent).toContain('type SupportedLocale');
        });
    });

    describe('Localization', () => {
        it('should have localized titles for all supported locales', () => {
            expect(preferenciasContent).toContain("es: 'Preferencias'");
            expect(preferenciasContent).toContain("en: 'Preferences'");
            expect(preferenciasContent).toContain("pt: 'Preferencias'");
        });

        it('should have localized meta descriptions', () => {
            expect(preferenciasContent).toContain(
                'const descriptions: Record<SupportedLocale, string>'
            );
            expect(preferenciasContent).toContain(
                'Configura tus preferencias de cuenta en Hospeda'
            );
        });

        it('should have localized heading texts', () => {
            expect(preferenciasContent).toContain('const headings:');
            expect(preferenciasContent).toContain("heading: 'Preferencias'");
        });
    });

    describe('SEO elements', () => {
        it('should generate canonical URL', () => {
            expect(preferenciasContent).toContain(
                'const canonicalUrl = new URL(Astro.url.pathname'
            );
            expect(preferenciasContent).toContain('canonical={canonicalUrl}');
        });

        it('should pass title and description to SEOHead', () => {
            expect(preferenciasContent).toContain('title={titles[locale]}');
            expect(preferenciasContent).toContain('description={descriptions[locale]}');
        });

        it('should set page type to website', () => {
            expect(preferenciasContent).toContain('type="website"');
        });

        it('should set noindex to true', () => {
            expect(preferenciasContent).toContain('noindex={true}');
        });
    });

    describe('Breadcrumbs', () => {
        it('should define breadcrumb items', () => {
            expect(preferenciasContent).toContain('const breadcrumbItems = [');
            expect(preferenciasContent).toContain('label: homeLabels[locale]');
            expect(preferenciasContent).toContain('label: accountLabels[locale]');
            expect(preferenciasContent).toContain('label: titles[locale]');
        });

        it('should render breadcrumb items prop', () => {
            expect(preferenciasContent).toContain('items={breadcrumbItems}');
        });
    });

    describe('Settings sections', () => {
        it('should render PreferenceToggles React island with client:visible', () => {
            expect(preferenciasContent).toContain('<PreferenceToggles');
            expect(preferenciasContent).toContain('client:visible');
        });

        it('should pass userId to PreferenceToggles', () => {
            expect(preferenciasContent).toContain('userId={user.id}');
        });

        it('should pass initialSettings to PreferenceToggles', () => {
            expect(preferenciasContent).toContain('initialSettings={initialSettings}');
        });

        it('should pass locale to PreferenceToggles', () => {
            expect(preferenciasContent).toContain('locale={locale}');
        });

        it('should extract initialSettings from user session', () => {
            expect(preferenciasContent).toContain('const initialSettings =');
        });

        it('should have timezone section', () => {
            expect(preferenciasContent).toContain('id="timezone-heading"');
        });

        it('should display timezone value', () => {
            expect(preferenciasContent).toContain('America/Argentina/Buenos_Aires');
        });
    });
});

describe('suscripcion.astro', () => {
    describe('Page structure', () => {
        it('should use BaseLayout', () => {
            expect(suscripcionContent).toContain(
                "import BaseLayout from '../../../layouts/BaseLayout.astro'"
            );
            expect(suscripcionContent).toContain('<BaseLayout');
        });

        it('should use SEOHead component', () => {
            expect(suscripcionContent).toContain(
                "import SEOHead from '../../../components/seo/SEOHead.astro'"
            );
            expect(suscripcionContent).toContain('<SEOHead');
        });

        it('should use Container component', () => {
            expect(suscripcionContent).toContain(
                "import Container from '../../../components/ui/Container.astro'"
            );
            expect(suscripcionContent).toContain('<Container>');
        });

        it('should use Breadcrumb component', () => {
            expect(suscripcionContent).toContain(
                "import Breadcrumb from '../../../components/ui/Breadcrumb.astro'"
            );
            expect(suscripcionContent).toContain('<Breadcrumb');
        });

        it('should import SubscriptionCard from account components', () => {
            expect(suscripcionContent).toContain(
                "import { SubscriptionCard } from '../../../components/account/SubscriptionCard.client'"
            );
        });

        it('should use SubscriptionCard with client:load directive', () => {
            expect(suscripcionContent).toContain('<SubscriptionCard');
            expect(suscripcionContent).toContain('client:load');
        });

        it('should pass locale prop to SubscriptionCard', () => {
            expect(suscripcionContent).toContain('locale={locale}');
        });

        it('should pass upgradeHref prop to SubscriptionCard', () => {
            expect(suscripcionContent).toContain('upgradeHref={`/${locale}/precios/turistas/`}');
        });
    });

    describe('Locale validation', () => {
        it('should validate locale parameter', () => {
            expect(suscripcionContent).toContain('const { lang } = Astro.params');
            expect(suscripcionContent).toContain('if (!lang || !isValidLocale(lang))');
        });

        it('should redirect to /es/ on invalid locale', () => {
            expect(suscripcionContent).toContain("return Astro.redirect('/es/')");
        });

        it('should import locale helpers', () => {
            expect(suscripcionContent).toContain('isValidLocale');
            expect(suscripcionContent).toContain('type SupportedLocale');
        });
    });

    describe('Auth guard', () => {
        it('should retain auth guard with Astro.locals.user check', () => {
            expect(suscripcionContent).toContain('const user = Astro.locals.user');
            expect(suscripcionContent).toContain('if (!user)');
        });

        it('should redirect unauthenticated users to signin', () => {
            expect(suscripcionContent).toContain('return Astro.redirect(`/${locale}/auth/signin`)');
        });
    });

    describe('Localization', () => {
        it('should have localized titles for all supported locales', () => {
            expect(suscripcionContent).toContain("es: 'Mi Suscripción'");
            expect(suscripcionContent).toContain("en: 'My Subscription'");
            expect(suscripcionContent).toContain("pt: 'Minha Assinatura'");
        });

        it('should have localized meta descriptions', () => {
            expect(suscripcionContent).toContain(
                'const descriptions: Record<SupportedLocale, string>'
            );
            expect(suscripcionContent).toContain('Administra tu plan y suscripción en Hospeda');
        });

        it('should have subscriptionLabels with only heading and description keys', () => {
            // Arrange: the updated page delegates plan details to SubscriptionCard
            // Act & Assert: subscriptionLabels only contains heading and description
            expect(suscripcionContent).toContain('const subscriptionLabels =');
            expect(suscripcionContent).toContain("heading: 'Mi Suscripción'");
            expect(suscripcionContent).toContain("description: 'Administra tu plan");
            // Plan-detail keys must NOT appear in the Astro template (moved to React component)
            expect(suscripcionContent).not.toContain("planName: 'Plan Gratuito'");
            expect(suscripcionContent).not.toContain('featuresHeading');
            expect(suscripcionContent).not.toContain('upgradeHeading');
            expect(suscripcionContent).not.toContain('billingSection');
        });
    });

    describe('SEO elements', () => {
        it('should retain SEOHead with noindex', () => {
            expect(suscripcionContent).toContain('noindex={true}');
        });

        it('should generate canonical URL', () => {
            expect(suscripcionContent).toContain('const canonicalUrl = new URL(Astro.url.pathname');
            expect(suscripcionContent).toContain('canonical={canonicalUrl}');
        });

        it('should pass title and description to SEOHead', () => {
            expect(suscripcionContent).toContain('title={titles[locale]}');
            expect(suscripcionContent).toContain('description={descriptions[locale]}');
        });

        it('should set page type to website', () => {
            expect(suscripcionContent).toContain('type="website"');
        });
    });

    describe('Breadcrumbs', () => {
        it('should define breadcrumb items', () => {
            expect(suscripcionContent).toContain('const breadcrumbItems = [');
            expect(suscripcionContent).toContain('label: homeLabels[locale]');
            expect(suscripcionContent).toContain('label: accountLabels[locale]');
            expect(suscripcionContent).toContain('label: titles[locale]');
        });

        it('should render breadcrumb items prop', () => {
            expect(suscripcionContent).toContain('items={breadcrumbItems}');
        });
    });

    describe('Content delegation to SubscriptionCard', () => {
        it('should not contain hardcoded "Plan Gratuito" literal in HTML template', () => {
            // Plan name is now rendered by SubscriptionCard React component
            // Remove frontmatter block to check only the HTML template section
            const htmlTemplate = suscripcionContent.split('---').slice(2).join('---');
            expect(htmlTemplate).not.toContain('Plan Gratuito');
        });

        it('should not contain hardcoded "Free Plan" literal in HTML template', () => {
            // Plan name is now rendered by SubscriptionCard React component
            const htmlTemplate = suscripcionContent.split('---').slice(2).join('---');
            expect(htmlTemplate).not.toContain('Free Plan');
        });

        it('should not import CheckIcon (moved to React component)', () => {
            // CheckIcon was previously imported for plan features list in the Astro template.
            // It is now used exclusively inside SubscriptionCard.client.tsx.
            expect(suscripcionContent).not.toContain('CheckIcon');
        });

        it('should render labels.heading in the page heading', () => {
            expect(suscripcionContent).toContain('{labels.heading}');
        });

        it('should render labels.description as subtitle', () => {
            expect(suscripcionContent).toContain('{labels.description}');
        });
    });
});
