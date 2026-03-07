import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pagesDir = resolve(__dirname, '../../src/pages/[lang]/auth');

function readPage(name: string): string {
    return readFileSync(resolve(pagesDir, `${name}.astro`), 'utf8');
}

describe('auth/signin.astro', () => {
    const content = readPage('signin');

    it('should NOT export prerender (SSR page)', () => {
        expect(content).not.toContain('export const prerender = true');
    });

    it('should import and use BaseLayout', () => {
        expect(content).toContain('import BaseLayout from');
        expect(content).toContain('<BaseLayout');
    });

    it('should import and use SEOHead with noindex', () => {
        expect(content).toContain('import SEOHead from');
        expect(content).toContain('noindex={true}');
    });

    it('should import SignInClient component', () => {
        expect(content).toContain('import { SignInClient }');
        expect(content).toContain('<SignInClient');
    });

    it('should redirect authenticated users', () => {
        expect(content).toContain('Astro.locals.user');
        expect(content).toContain('Astro.redirect');
    });

    it('should read returnUrl from query params', () => {
        expect(content).toContain("searchParams.get('returnUrl')");
    });

    it('should use buildUrl for navigation links', () => {
        expect(content).toContain('import { buildUrl }');
        expect(content).toContain("path: 'auth/forgot-password'");
        expect(content).toContain("path: 'auth/signup'");
    });

    it('should include i18n labels for all locales', () => {
        expect(content).toContain('es:');
        expect(content).toContain('en:');
        expect(content).toContain('pt:');
    });

    it('should use design system tokens (not hardcoded colors)', () => {
        expect(content).toContain('bg-card');
        expect(content).toContain('border-border');
        expect(content).toContain('text-primary');
        expect(content).toContain('text-muted-foreground');
        expect(content).not.toMatch(/text-(white|black|gray-\d+)/);
    });
});

describe('auth/signup.astro', () => {
    const content = readPage('signup');

    it('should NOT export prerender (SSR page)', () => {
        expect(content).not.toContain('export const prerender = true');
    });

    it('should import SignUpClient component', () => {
        expect(content).toContain('import { SignUpClient }');
        expect(content).toContain('<SignUpClient');
    });

    it('should redirect authenticated users', () => {
        expect(content).toContain('Astro.locals.user');
        expect(content).toContain('Astro.redirect');
    });

    it('should use SEOHead with noindex', () => {
        expect(content).toContain('noindex={true}');
    });

    it('should link to signin page', () => {
        expect(content).toContain("path: 'auth/signin'");
    });

    it('should include i18n labels for all locales', () => {
        expect(content).toContain('es:');
        expect(content).toContain('en:');
        expect(content).toContain('pt:');
    });
});

describe('auth/forgot-password.astro', () => {
    const content = readPage('forgot-password');

    it('should export prerender = true (SSG page)', () => {
        expect(content).toContain('export const prerender = true');
    });

    it('should export getStaticPaths', () => {
        expect(content).toContain('getStaticLocalePaths as getStaticPaths');
    });

    it('should import ForgotPasswordClient component', () => {
        expect(content).toContain('import { ForgotPasswordClient }');
        expect(content).toContain('<ForgotPasswordClient');
    });

    it('should include client-side auth redirect script', () => {
        expect(content).toContain('redirectIfAuthenticated');
        expect(content).toContain('get-session');
    });

    it('should use buildUrl for links', () => {
        expect(content).toContain("path: 'auth/reset-password'");
        expect(content).toContain("path: 'auth/signin'");
    });
});

describe('auth/reset-password.astro', () => {
    const content = readPage('reset-password');

    it('should NOT export prerender (SSR page)', () => {
        expect(content).not.toContain('export const prerender = true');
    });

    it('should import ResetPasswordClient component', () => {
        expect(content).toContain('import { ResetPasswordClient }');
        expect(content).toContain('<ResetPasswordClient');
    });

    it('should read token from query params', () => {
        expect(content).toContain("searchParams.get('token')");
    });

    it('should use SEOHead with noindex', () => {
        expect(content).toContain('noindex={true}');
    });
});

describe('auth/verify-email.astro', () => {
    const content = readPage('verify-email');

    it('should NOT export prerender (SSR page)', () => {
        expect(content).not.toContain('export const prerender = true');
    });

    it('should import VerifyEmailClient component', () => {
        expect(content).toContain('import { VerifyEmailClient }');
        expect(content).toContain('<VerifyEmailClient');
    });

    it('should read token from query params', () => {
        expect(content).toContain("searchParams.get('token')");
    });

    it('should use SEOHead with noindex', () => {
        expect(content).toContain('noindex={true}');
    });
});
