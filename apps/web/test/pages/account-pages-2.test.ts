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

        it('should have localized form labels', () => {
            expect(editarContent).toContain('const formLabels:');
            expect(editarContent).toContain('const buttonLabels:');
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

    describe('Form structure', () => {
        it('should have profile form section', () => {
            expect(editarContent).toContain('id="profile-form"');
        });

        it('should have name input field', () => {
            expect(editarContent).toContain('name="name"');
            expect(editarContent).toContain('type="text"');
            expect(editarContent).toContain('id="input-name"');
        });

        it('should have email input field (readonly)', () => {
            expect(editarContent).toContain('name="email"');
            expect(editarContent).toContain('type="email"');
            expect(editarContent).toContain('disabled={true}');
            expect(editarContent).toContain('id="input-email"');
        });

        it('should have bio textarea field', () => {
            expect(editarContent).toContain('name="bio"');
            expect(editarContent).toContain('<Textarea');
            expect(editarContent).toContain('id="input-bio"');
        });

        it('should have save button', () => {
            expect(editarContent).toContain('type="submit"');
            expect(editarContent).toContain('{buttonLabels[locale].save}');
        });

        it('should have cancel link back to account page', () => {
            expect(editarContent).toContain('href={`/${locale}/mi-cuenta/`}');
            expect(editarContent).toContain('{buttonLabels[locale].cancel}');
        });
    });

    describe('Form labels and helpers', () => {
        it('should have form label text', () => {
            expect(editarContent).toContain('label={formLabels[locale]');
        });

        it('should have form placeholders', () => {
            expect(editarContent).toContain('const formPlaceholders:');
        });

        it('should display field helper text', () => {
            expect(editarContent).toContain('const formHelpers:');
            expect(editarContent).toContain('{formHelpers[locale].email}');
            expect(editarContent).toContain('{formHelpers[locale].bio}');
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
            expect(preferenciasContent).toContain("pt: 'Preferências'");
        });

        it('should have localized meta descriptions', () => {
            expect(preferenciasContent).toContain(
                'const descriptions: Record<SupportedLocale, string>'
            );
            expect(preferenciasContent).toContain(
                'Configura tus preferencias de cuenta en Hospeda'
            );
        });

        it('should have localized settings labels', () => {
            expect(preferenciasContent).toContain('const settingsLabels =');
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
        it('should have notifications section', () => {
            expect(preferenciasContent).toContain('id="notifications-heading"');
            expect(preferenciasContent).toContain('{labels.notificationsSection}');
        });

        it('should have email notifications checkbox', () => {
            expect(preferenciasContent).toContain('type="checkbox"');
            expect(preferenciasContent).toContain('id="email-notifications"');
            expect(preferenciasContent).toContain('name="email-notifications"');
        });

        it('should have newsletter checkbox', () => {
            expect(preferenciasContent).toContain('id="newsletter"');
            expect(preferenciasContent).toContain('name="newsletter"');
        });

        it('should have promotional offers checkbox', () => {
            expect(preferenciasContent).toContain('id="promotional-offers"');
            expect(preferenciasContent).toContain('name="promotional-offers"');
        });

        it('should have language section', () => {
            expect(preferenciasContent).toContain('id="language-heading"');
            expect(preferenciasContent).toContain('{labels.languageSection}');
        });

        it('should display language options in select', () => {
            expect(preferenciasContent).toContain('id="language-select"');
            expect(preferenciasContent).toContain('{languageNames[loc]}');
        });

        it('should have timezone section', () => {
            expect(preferenciasContent).toContain('id="timezone-heading"');
            expect(preferenciasContent).toContain('{labels.timezoneSection}');
        });

        it('should display timezone value', () => {
            expect(preferenciasContent).toContain('{labels.timezoneValue}');
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

        it('should have localized subscription labels', () => {
            expect(suscripcionContent).toContain('const subscriptionLabels =');
            expect(suscripcionContent).toContain("heading: 'Mi Suscripción'");
            expect(suscripcionContent).toContain("planName: 'Plan Gratuito'");
        });
    });

    describe('SEO elements', () => {
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

        it('should set noindex to true', () => {
            expect(suscripcionContent).toContain('noindex={true}');
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

    describe('Current plan section', () => {
        it('should display current plan section', () => {
            expect(suscripcionContent).toContain('{labels.currentPlanSection}');
        });

        it('should show plan name', () => {
            expect(suscripcionContent).toContain('{labels.planName}');
        });

        it('should show plan price', () => {
            expect(suscripcionContent).toContain('{labels.planPrice}');
        });

        it('should list plan features', () => {
            expect(suscripcionContent).toContain('{labels.featuresHeading}');
            expect(suscripcionContent).toContain('{labels.feature1}');
            expect(suscripcionContent).toContain('{labels.feature2}');
            expect(suscripcionContent).toContain('{labels.feature3}');
            expect(suscripcionContent).toContain('{labels.feature4}');
        });

        it('should import CheckIcon from @repo/icons for features', () => {
            expect(suscripcionContent).toContain("from '@repo/icons'");
            expect(suscripcionContent).toContain('CheckIcon');
        });
    });

    describe('Upgrade CTA section', () => {
        it('should have upgrade heading', () => {
            expect(suscripcionContent).toContain('{labels.upgradeHeading}');
        });

        it('should have upgrade description', () => {
            expect(suscripcionContent).toContain('{labels.upgradeDescription}');
        });

        it('should have link to pricing page', () => {
            expect(suscripcionContent).toContain('href={`/${locale}/precios/turistas/`}');
            expect(suscripcionContent).toContain('{labels.upgradeButton}');
        });
    });

    describe('Billing section', () => {
        it('should display billing section', () => {
            expect(suscripcionContent).toContain('{labels.billingSection}');
        });

        it('should show no billing info placeholder', () => {
            expect(suscripcionContent).toContain('{labels.noBillingInfo}');
            expect(suscripcionContent).toContain('{labels.billingHint}');
        });
    });
});
