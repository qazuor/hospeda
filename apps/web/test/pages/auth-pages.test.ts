/**
 * Tests for authentication pages (forgot-password, reset-password, verify-email).
 * Verifies page structure, SEO elements, localization, and React island integration.
 *
 * Note: Form fields are now inside React island components from @repo/auth-ui,
 * not in the Astro pages directly.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const forgotPasswordPath = resolve(__dirname, '../../src/pages/[lang]/auth/forgot-password.astro');
const resetPasswordPath = resolve(__dirname, '../../src/pages/[lang]/auth/reset-password.astro');
const verifyEmailPath = resolve(__dirname, '../../src/pages/[lang]/auth/verify-email.astro');

const forgotPasswordContent = readFileSync(forgotPasswordPath, 'utf8');
const resetPasswordContent = readFileSync(resetPasswordPath, 'utf8');
const verifyEmailContent = readFileSync(verifyEmailPath, 'utf8');

describe('forgot-password.astro', () => {
    describe('Page structure', () => {
        it('should use BaseLayout', () => {
            expect(forgotPasswordContent).toContain(
                "import BaseLayout from '../../../layouts/BaseLayout.astro'"
            );
            expect(forgotPasswordContent).toContain('<BaseLayout');
        });

        it('should use SEOHead component', () => {
            expect(forgotPasswordContent).toContain(
                "import SEOHead from '../../../components/seo/SEOHead.astro'"
            );
            expect(forgotPasswordContent).toContain('<SEOHead');
        });

        it('should use Container component', () => {
            expect(forgotPasswordContent).toContain(
                "import Container from '../../../components/ui/Container.astro'"
            );
            expect(forgotPasswordContent).toContain('<Container>');
        });

        it('should not use Breadcrumb component (auth pages)', () => {
            expect(forgotPasswordContent).not.toContain('Breadcrumb');
        });
    });

    describe('Locale validation', () => {
        it('should validate locale parameter', () => {
            expect(forgotPasswordContent).toContain('getLocaleFromParams(Astro.params)');
            expect(forgotPasswordContent).toContain('if (!locale)');
        });

        it('should redirect to /es/ on invalid locale', () => {
            expect(forgotPasswordContent).toContain("return Astro.redirect('/es/')");
        });

        it('should import locale helpers', () => {
            expect(forgotPasswordContent).toContain('getLocaleFromParams');
            expect(forgotPasswordContent).toContain("import { t } from '../../../lib/i18n'");
        });
    });

    describe('Localization', () => {
        it('should have localized titles for all supported locales', () => {
            expect(forgotPasswordContent).toContain(
                "t({ locale, namespace: 'auth-ui', key: 'pages.forgotPassword.title' })"
            );
        });

        it('should have localized meta descriptions', () => {
            expect(forgotPasswordContent).toContain(
                "t({ locale, namespace: 'auth-ui', key: 'pages.forgotPassword.description' })"
            );
        });
    });

    describe('SEO elements', () => {
        it('should generate canonical URL', () => {
            expect(forgotPasswordContent).toContain(
                'const canonicalUrl = new URL(Astro.url.pathname'
            );
            expect(forgotPasswordContent).toContain('canonical={canonicalUrl}');
        });

        it('should pass title and description to SEOHead', () => {
            expect(forgotPasswordContent).toContain('title={title}');
            expect(forgotPasswordContent).toContain('description={description}');
        });

        it('should set page type to website', () => {
            expect(forgotPasswordContent).toContain('type="website"');
        });

        it('should set noindex to true', () => {
            expect(forgotPasswordContent).toContain('noindex={true}');
        });
    });

    describe('React island integration', () => {
        it('should import ForgotPasswordClient component', () => {
            expect(forgotPasswordContent).toContain(
                "import { ForgotPasswordClient } from '../../../components/auth/ForgotPassword.client'"
            );
        });

        it('should render ForgotPasswordClient with client:load', () => {
            expect(forgotPasswordContent).toContain('<ForgotPasswordClient');
            expect(forgotPasswordContent).toContain('client:load');
        });

        it('should pass resetPasswordUrl prop', () => {
            expect(forgotPasswordContent).toContain('resetPasswordUrl={resetPasswordUrl}');
        });

        it('should pass signInUrl prop', () => {
            expect(forgotPasswordContent).toContain('signInUrl={signInUrl}');
        });

        it('should compute locale-aware URLs', () => {
            expect(forgotPasswordContent).toContain(
                'const resetPasswordUrl = `/${locale}/auth/reset-password`'
            );
            expect(forgotPasswordContent).toContain('const signInUrl = `/${locale}/auth/signin`');
        });
    });

    describe('Page layout', () => {
        it('should have centered card layout', () => {
            expect(forgotPasswordContent).toContain(
                'flex min-h-screen items-center justify-center'
            );
            expect(forgotPasswordContent).toContain('rounded-lg border border-border');
        });
    });
});

describe('reset-password.astro', () => {
    describe('Page structure', () => {
        it('should use BaseLayout', () => {
            expect(resetPasswordContent).toContain(
                "import BaseLayout from '../../../layouts/BaseLayout.astro'"
            );
            expect(resetPasswordContent).toContain('<BaseLayout');
        });

        it('should use SEOHead component', () => {
            expect(resetPasswordContent).toContain(
                "import SEOHead from '../../../components/seo/SEOHead.astro'"
            );
            expect(resetPasswordContent).toContain('<SEOHead');
        });

        it('should use Container component', () => {
            expect(resetPasswordContent).toContain(
                "import Container from '../../../components/ui/Container.astro'"
            );
            expect(resetPasswordContent).toContain('<Container>');
        });

        it('should not use Breadcrumb component (auth pages)', () => {
            expect(resetPasswordContent).not.toContain('Breadcrumb');
        });
    });

    describe('Locale validation', () => {
        it('should validate locale parameter', () => {
            expect(resetPasswordContent).toContain('getLocaleFromParams(Astro.params)');
            expect(resetPasswordContent).toContain('if (!locale)');
        });

        it('should redirect to /es/ on invalid locale', () => {
            expect(resetPasswordContent).toContain("return Astro.redirect('/es/')");
        });

        it('should import locale helpers', () => {
            expect(resetPasswordContent).toContain('getLocaleFromParams');
            expect(resetPasswordContent).toContain("import { t } from '../../../lib/i18n'");
        });
    });

    describe('Localization', () => {
        it('should have localized titles for all supported locales', () => {
            expect(resetPasswordContent).toContain(
                "t({ locale, namespace: 'auth-ui', key: 'pages.resetPassword.title' })"
            );
        });

        it('should have localized meta descriptions', () => {
            expect(resetPasswordContent).toContain(
                "t({ locale, namespace: 'auth-ui', key: 'pages.resetPassword.description' })"
            );
        });
    });

    describe('SEO elements', () => {
        it('should generate canonical URL', () => {
            expect(resetPasswordContent).toContain(
                'const canonicalUrl = new URL(Astro.url.pathname'
            );
            expect(resetPasswordContent).toContain('canonical={canonicalUrl}');
        });

        it('should pass title and description to SEOHead', () => {
            expect(resetPasswordContent).toContain('title={title}');
            expect(resetPasswordContent).toContain('description={description}');
        });

        it('should set page type to website', () => {
            expect(resetPasswordContent).toContain('type="website"');
        });

        it('should set noindex to true', () => {
            expect(resetPasswordContent).toContain('noindex={true}');
        });
    });

    describe('React island integration', () => {
        it('should import ResetPasswordClient component', () => {
            expect(resetPasswordContent).toContain(
                "import { ResetPasswordClient } from '../../../components/auth/ResetPassword.client'"
            );
        });

        it('should render ResetPasswordClient with client:load', () => {
            expect(resetPasswordContent).toContain('<ResetPasswordClient');
            expect(resetPasswordContent).toContain('client:load');
        });

        it('should pass token prop', () => {
            expect(resetPasswordContent).toContain('token={token}');
        });

        it('should pass signInUrl prop', () => {
            expect(resetPasswordContent).toContain('signInUrl={signInUrl}');
        });

        it('should extract token from query params', () => {
            expect(resetPasswordContent).toContain("Astro.url.searchParams.get('token')");
        });
    });

    describe('Page layout', () => {
        it('should have centered card layout', () => {
            expect(resetPasswordContent).toContain('flex min-h-screen items-center justify-center');
            expect(resetPasswordContent).toContain('rounded-lg border border-border');
        });
    });
});

describe('verify-email.astro', () => {
    describe('Page structure', () => {
        it('should use BaseLayout', () => {
            expect(verifyEmailContent).toContain(
                "import BaseLayout from '../../../layouts/BaseLayout.astro'"
            );
            expect(verifyEmailContent).toContain('<BaseLayout');
        });

        it('should use SEOHead component', () => {
            expect(verifyEmailContent).toContain(
                "import SEOHead from '../../../components/seo/SEOHead.astro'"
            );
            expect(verifyEmailContent).toContain('<SEOHead');
        });

        it('should use Container component', () => {
            expect(verifyEmailContent).toContain(
                "import Container from '../../../components/ui/Container.astro'"
            );
            expect(verifyEmailContent).toContain('<Container>');
        });

        it('should not use Breadcrumb component (auth pages)', () => {
            expect(verifyEmailContent).not.toContain('Breadcrumb');
        });
    });

    describe('Locale validation', () => {
        it('should validate locale parameter', () => {
            expect(verifyEmailContent).toContain('getLocaleFromParams(Astro.params)');
            expect(verifyEmailContent).toContain('if (!locale)');
        });

        it('should redirect to /es/ on invalid locale', () => {
            expect(verifyEmailContent).toContain("return Astro.redirect('/es/')");
        });

        it('should import locale helpers', () => {
            expect(verifyEmailContent).toContain('getLocaleFromParams');
            expect(verifyEmailContent).toContain("import { t } from '../../../lib/i18n'");
        });
    });

    describe('Localization', () => {
        it('should have localized titles for all supported locales', () => {
            expect(verifyEmailContent).toContain(
                "t({ locale, namespace: 'auth-ui', key: 'pages.verifyEmail.title' })"
            );
        });

        it('should have localized meta descriptions', () => {
            expect(verifyEmailContent).toContain(
                "t({ locale, namespace: 'auth-ui', key: 'pages.verifyEmail.description' })"
            );
        });
    });

    describe('SEO elements', () => {
        it('should generate canonical URL', () => {
            expect(verifyEmailContent).toContain('const canonicalUrl = new URL(Astro.url.pathname');
            expect(verifyEmailContent).toContain('canonical={canonicalUrl}');
        });

        it('should pass title and description to SEOHead', () => {
            expect(verifyEmailContent).toContain('title={title}');
            expect(verifyEmailContent).toContain('description={description}');
        });

        it('should set page type to website', () => {
            expect(verifyEmailContent).toContain('type="website"');
        });

        it('should set noindex to true', () => {
            expect(verifyEmailContent).toContain('noindex={true}');
        });
    });

    describe('React island integration', () => {
        it('should import VerifyEmailClient component', () => {
            expect(verifyEmailContent).toContain(
                "import { VerifyEmailClient } from '../../../components/auth/VerifyEmail.client'"
            );
        });

        it('should render VerifyEmailClient with client:load', () => {
            expect(verifyEmailContent).toContain('<VerifyEmailClient');
            expect(verifyEmailContent).toContain('client:load');
        });

        it('should pass token prop', () => {
            expect(verifyEmailContent).toContain('token={token}');
        });

        it('should pass redirectTo prop', () => {
            expect(verifyEmailContent).toContain('redirectTo={redirectTo}');
        });

        it('should extract token from query params', () => {
            expect(verifyEmailContent).toContain("Astro.url.searchParams.get('token')");
        });

        it('should redirect to signin after verification', () => {
            expect(verifyEmailContent).toContain('const redirectTo = `/${locale}/auth/signin`');
        });
    });

    describe('Page layout', () => {
        it('should have centered card layout', () => {
            expect(verifyEmailContent).toContain('flex min-h-screen items-center justify-center');
            expect(verifyEmailContent).toContain('rounded-lg border border-border');
        });
    });
});
