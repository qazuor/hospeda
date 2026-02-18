/**
 * Tests for sign in and sign up authentication pages.
 * Verifies page structure, SEO elements, localization, React island usage, and navigation links.
 *
 * Note: Form fields and social login buttons are now inside React island components
 * (SignInIsland, SignUpIsland from @repo/auth-ui), not in the Astro pages directly.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const loginPath = resolve(__dirname, '../../src/pages/[lang]/auth/signin.astro');
const registerPath = resolve(__dirname, '../../src/pages/[lang]/auth/signup.astro');

const loginContent = readFileSync(loginPath, 'utf8');
const registerContent = readFileSync(registerPath, 'utf8');

describe('signin.astro', () => {
    describe('Page structure', () => {
        it('should use BaseLayout', () => {
            expect(loginContent).toContain(
                "import BaseLayout from '../../../layouts/BaseLayout.astro'"
            );
            expect(loginContent).toContain('<BaseLayout');
        });

        it('should use SEOHead component', () => {
            expect(loginContent).toContain(
                "import SEOHead from '../../../components/seo/SEOHead.astro'"
            );
            expect(loginContent).toContain('<SEOHead');
        });

        it('should use Container component', () => {
            expect(loginContent).toContain(
                "import Container from '../../../components/ui/Container.astro'"
            );
            expect(loginContent).toContain('<Container>');
        });

        it('should not use Breadcrumb component (auth pages)', () => {
            expect(loginContent).not.toContain('Breadcrumb');
        });
    });

    describe('Locale validation', () => {
        it('should validate locale parameter', () => {
            expect(loginContent).toContain('const { lang } = Astro.params');
            expect(loginContent).toContain('if (!lang || !isValidLocale(lang))');
        });

        it('should redirect to /es/ on invalid locale', () => {
            expect(loginContent).toContain("return Astro.redirect('/es/')");
        });

        it('should import locale helpers', () => {
            expect(loginContent).toContain('isValidLocale');
            expect(loginContent).toContain('type SupportedLocale');
        });
    });

    describe('Localization', () => {
        it('should have localized titles for all supported locales', () => {
            expect(loginContent).toContain("es: 'Iniciar sesión'");
            expect(loginContent).toContain("en: 'Sign In'");
            expect(loginContent).toContain("pt: 'Entrar'");
        });

        it('should have localized meta descriptions', () => {
            expect(loginContent).toContain('const descriptions: Record<SupportedLocale, string>');
            expect(loginContent).toContain('Inicia sesión en tu cuenta de Hospeda');
        });

        it('should have localized navigation labels', () => {
            expect(loginContent).toContain('const labels =');
            expect(loginContent).toContain("noAccount: '¿No tienes cuenta?'");
            expect(loginContent).toContain("signUp: 'Registrarse'");
        });
    });

    describe('SEO elements', () => {
        it('should generate canonical URL', () => {
            expect(loginContent).toContain('const canonicalUrl = new URL(Astro.url.pathname');
            expect(loginContent).toContain('canonical={canonicalUrl}');
        });

        it('should pass title and description to SEOHead', () => {
            expect(loginContent).toContain('title={titles[locale]}');
            expect(loginContent).toContain('description={descriptions[locale]}');
        });

        it('should set page type to website', () => {
            expect(loginContent).toContain('type="website"');
        });

        it('should set noindex to true', () => {
            expect(loginContent).toContain('noindex={true}');
        });
    });

    describe('React island integration', () => {
        it('should import SignInIsland component', () => {
            expect(loginContent).toContain(
                "import { SignInIsland } from '../../../components/auth/SignInIsland'"
            );
        });

        it('should render SignInIsland with client:load', () => {
            expect(loginContent).toContain('<SignInIsland');
            expect(loginContent).toContain('client:load');
        });

        it('should pass redirectTo prop', () => {
            expect(loginContent).toContain('redirectTo={redirectTo}');
        });

        it('should pass showOAuth prop', () => {
            expect(loginContent).toContain('showOAuth={true}');
        });

        it('should read returnUrl from query params', () => {
            expect(loginContent).toContain("Astro.url.searchParams.get('returnUrl')");
        });
    });

    describe('Navigation links', () => {
        it('should have link to forgot password page', () => {
            expect(loginContent).toContain('href={`/${locale}/auth/forgot-password/`}');
            expect(loginContent).toContain('{currentLabels.forgotPassword}');
        });

        it('should have link to register page', () => {
            expect(loginContent).toContain('href={`/${locale}/auth/signup/`}');
            expect(loginContent).toContain('{currentLabels.signUp}');
        });
    });

    describe('Page layout', () => {
        it('should have centered card layout', () => {
            expect(loginContent).toContain('flex min-h-screen items-center justify-center');
            expect(loginContent).toContain('rounded-lg border border-border');
        });
    });
});

describe('signup.astro', () => {
    describe('Rendering Strategy (SSR)', () => {
        it('should NOT enable prerendering (SSR page)', () => {
            expect(registerContent).not.toContain('export const prerender = true');
        });

        it('should NOT have getStaticPaths (SSR page)', () => {
            expect(registerContent).not.toContain('export function getStaticPaths');
        });
    });

    describe('Server-side auth guard', () => {
        it('should check Astro.locals.user for auth redirect', () => {
            expect(registerContent).toContain('if (Astro.locals.user)');
        });

        it('should redirect authenticated users to home page', () => {
            expect(registerContent).toContain('return Astro.redirect(`/${locale}/`)');
        });

        it('should NOT have client-side auth redirect script', () => {
            expect(registerContent).not.toContain('redirectIfAuthenticated');
        });
    });

    describe('Page structure', () => {
        it('should use BaseLayout', () => {
            expect(registerContent).toContain(
                "import BaseLayout from '../../../layouts/BaseLayout.astro'"
            );
            expect(registerContent).toContain('<BaseLayout');
        });

        it('should use SEOHead component', () => {
            expect(registerContent).toContain(
                "import SEOHead from '../../../components/seo/SEOHead.astro'"
            );
            expect(registerContent).toContain('<SEOHead');
        });

        it('should use Container component', () => {
            expect(registerContent).toContain(
                "import Container from '../../../components/ui/Container.astro'"
            );
            expect(registerContent).toContain('<Container>');
        });

        it('should not use Breadcrumb component (auth pages)', () => {
            expect(registerContent).not.toContain('Breadcrumb');
        });
    });

    describe('Locale validation', () => {
        it('should validate locale parameter', () => {
            expect(registerContent).toContain('const { lang } = Astro.params');
            expect(registerContent).toContain('if (!lang || !isValidLocale(lang))');
        });

        it('should redirect to /es/ on invalid locale', () => {
            expect(registerContent).toContain("return Astro.redirect('/es/')");
        });

        it('should import locale helpers', () => {
            expect(registerContent).toContain('isValidLocale');
            expect(registerContent).toContain('type SupportedLocale');
        });
    });

    describe('Localization', () => {
        it('should have localized titles for all supported locales', () => {
            expect(registerContent).toContain("es: 'Registrarse'");
            expect(registerContent).toContain("en: 'Sign Up'");
            expect(registerContent).toContain("pt: 'Registrar'");
        });

        it('should have localized meta descriptions', () => {
            expect(registerContent).toContain(
                'const descriptions: Record<SupportedLocale, string>'
            );
            expect(registerContent).toContain('Crea tu cuenta en Hospeda');
        });

        it('should have localized navigation labels', () => {
            expect(registerContent).toContain('const labels =');
            expect(registerContent).toContain("haveAccount: '¿Ya tienes cuenta?'");
            expect(registerContent).toContain("signIn: 'Iniciar sesión'");
        });
    });

    describe('SEO elements', () => {
        it('should generate canonical URL', () => {
            expect(registerContent).toContain('const canonicalUrl = new URL(Astro.url.pathname');
            expect(registerContent).toContain('canonical={canonicalUrl}');
        });

        it('should pass title and description to SEOHead', () => {
            expect(registerContent).toContain('title={titles[locale]}');
            expect(registerContent).toContain('description={descriptions[locale]}');
        });

        it('should set page type to website', () => {
            expect(registerContent).toContain('type="website"');
        });

        it('should set noindex to true', () => {
            expect(registerContent).toContain('noindex={true}');
        });
    });

    describe('React island integration', () => {
        it('should import SignUpIsland component', () => {
            expect(registerContent).toContain(
                "import { SignUpIsland } from '../../../components/auth/SignUpIsland'"
            );
        });

        it('should render SignUpIsland with client:load', () => {
            expect(registerContent).toContain('<SignUpIsland');
            expect(registerContent).toContain('client:load');
        });

        it('should pass redirectTo prop', () => {
            expect(registerContent).toContain('redirectTo={redirectTo}');
        });

        it('should pass showOAuth prop', () => {
            expect(registerContent).toContain('showOAuth={true}');
        });
    });

    describe('Navigation links', () => {
        it('should have link to login page', () => {
            expect(registerContent).toContain('href={`/${locale}/auth/signin/`}');
            expect(registerContent).toContain('{currentLabels.signIn}');
        });
    });

    describe('Page layout', () => {
        it('should have centered card layout', () => {
            expect(registerContent).toContain('flex min-h-screen items-center justify-center');
            expect(registerContent).toContain('rounded-lg border border-border');
        });
    });
});
