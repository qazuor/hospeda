import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const srcDir = resolve(__dirname, '../../../src/components/auth');

const signInContent = readFileSync(resolve(srcDir, 'SignIn.client.tsx'), 'utf8');
const signUpContent = readFileSync(resolve(srcDir, 'SignUp.client.tsx'), 'utf8');
const forgotPasswordContent = readFileSync(resolve(srcDir, 'ForgotPassword.client.tsx'), 'utf8');
const resetPasswordContent = readFileSync(resolve(srcDir, 'ResetPassword.client.tsx'), 'utf8');
const verifyEmailContent = readFileSync(resolve(srcDir, 'VerifyEmail.client.tsx'), 'utf8');
const authSectionContent = readFileSync(resolve(srcDir, 'AuthSection.astro'), 'utf8');

// ---------------------------------------------------------------------------
// SignIn.client.tsx
// ---------------------------------------------------------------------------
describe('SignIn.client.tsx', () => {
    describe('Named export', () => {
        it('should use a named function export (no default export)', () => {
            expect(signInContent).toContain('export function SignInClient');
            expect(signInContent).not.toContain('export default');
        });
    });

    describe('Imports', () => {
        it('should import SignInForm from @repo/auth-ui', () => {
            expect(signInContent).toContain("import { SignInForm } from '@repo/auth-ui'");
        });

        it('should import signIn from the local auth-client', () => {
            expect(signInContent).toContain("import { signIn } from '../../lib/auth-client'");
        });

        it('should NOT import from better-auth directly', () => {
            expect(signInContent).not.toContain("from 'better-auth'");
        });
    });

    describe('Props interface', () => {
        it('should export a SignInClientProps interface', () => {
            expect(signInContent).toContain('export interface SignInClientProps');
        });

        it('should have readonly redirectTo prop', () => {
            expect(signInContent).toContain('readonly redirectTo: string');
        });

        it('should have readonly showOAuth optional prop', () => {
            expect(signInContent).toContain('readonly showOAuth?: boolean');
        });
    });

    describe('Delegation contract', () => {
        it('should pass signIn function to SignInForm', () => {
            expect(signInContent).toContain('signIn={signIn}');
        });

        it('should forward redirectTo to SignInForm', () => {
            expect(signInContent).toContain('redirectTo={redirectTo}');
        });

        it('should forward showOAuth to SignInForm', () => {
            expect(signInContent).toContain('showOAuth={showOAuth}');
        });

        it('should default showOAuth to true', () => {
            expect(signInContent).toContain('showOAuth = true');
        });
    });

    describe('Code quality', () => {
        it('should have no console.log statements', () => {
            expect(signInContent).not.toContain('console.log');
        });

        it('should have no hardcoded Spanish strings', () => {
            // Prop names and JSDoc are acceptable; we look for UI-visible Spanish text
            expect(signInContent).not.toMatch(/"Iniciar|"Registrar|"Contraseña|"Correo/);
        });

        it('should have no hardcoded color classes', () => {
            expect(signInContent).not.toMatch(/bg-(blue|red|green|gray|white)-\d+/);
            expect(signInContent).not.toMatch(/text-(blue|red|green|gray)-\d+/);
        });

        it('should have JSDoc module annotation', () => {
            expect(signInContent).toContain('@module SignIn.client');
        });
    });
});

// ---------------------------------------------------------------------------
// SignUp.client.tsx
// ---------------------------------------------------------------------------
describe('SignUp.client.tsx', () => {
    describe('Named export', () => {
        it('should use a named function export (no default export)', () => {
            expect(signUpContent).toContain('export function SignUpClient');
            expect(signUpContent).not.toContain('export default');
        });
    });

    describe('Imports', () => {
        it('should import SignUpForm from @repo/auth-ui', () => {
            expect(signUpContent).toContain("import { SignUpForm } from '@repo/auth-ui'");
        });

        it('should import both signIn and signUp from the local auth-client', () => {
            expect(signUpContent).toContain(
                "import { signIn, signUp } from '../../lib/auth-client'"
            );
        });

        it('should NOT import from better-auth directly', () => {
            expect(signUpContent).not.toContain("from 'better-auth'");
        });
    });

    describe('Props interface', () => {
        it('should export a SignUpClientProps interface', () => {
            expect(signUpContent).toContain('export interface SignUpClientProps');
        });

        it('should have readonly redirectTo prop', () => {
            expect(signUpContent).toContain('readonly redirectTo: string');
        });

        it('should have readonly showOAuth optional prop', () => {
            expect(signUpContent).toContain('readonly showOAuth?: boolean');
        });
    });

    describe('Delegation contract', () => {
        it('should pass signUp function to SignUpForm', () => {
            expect(signUpContent).toContain('signUp={signUp}');
        });

        it('should pass signIn function to SignUpForm', () => {
            expect(signUpContent).toContain('signIn={signIn}');
        });

        it('should forward redirectTo to SignUpForm', () => {
            expect(signUpContent).toContain('redirectTo={redirectTo}');
        });

        it('should forward showOAuth to SignUpForm', () => {
            expect(signUpContent).toContain('showOAuth={showOAuth}');
        });

        it('should default showOAuth to true', () => {
            expect(signUpContent).toContain('showOAuth = true');
        });
    });

    describe('Code quality', () => {
        it('should have no console.log statements', () => {
            expect(signUpContent).not.toContain('console.log');
        });

        it('should have no hardcoded Spanish strings', () => {
            expect(signUpContent).not.toMatch(/"Iniciar|"Registrar|"Contraseña|"Correo/);
        });

        it('should have JSDoc module annotation', () => {
            expect(signUpContent).toContain('@module SignUp.client');
        });
    });
});

// ---------------------------------------------------------------------------
// ForgotPassword.client.tsx
// ---------------------------------------------------------------------------
describe('ForgotPassword.client.tsx', () => {
    describe('Named export', () => {
        it('should use a named function export (no default export)', () => {
            expect(forgotPasswordContent).toContain('export function ForgotPasswordClient');
            expect(forgotPasswordContent).not.toContain('export default');
        });
    });

    describe('Imports', () => {
        it('should import ForgotPasswordForm from @repo/auth-ui', () => {
            expect(forgotPasswordContent).toContain(
                "import { ForgotPasswordForm } from '@repo/auth-ui'"
            );
        });

        it('should import forgetPassword from the local auth-client', () => {
            expect(forgotPasswordContent).toContain(
                "import { forgetPassword } from '../../lib/auth-client'"
            );
        });

        it('should NOT import from better-auth directly', () => {
            expect(forgotPasswordContent).not.toContain("from 'better-auth'");
        });
    });

    describe('Props interface', () => {
        it('should export a ForgotPasswordClientProps interface', () => {
            expect(forgotPasswordContent).toContain('export interface ForgotPasswordClientProps');
        });

        it('should have readonly resetPasswordUrl prop', () => {
            expect(forgotPasswordContent).toContain('readonly resetPasswordUrl: string');
        });

        it('should have readonly signInUrl prop', () => {
            expect(forgotPasswordContent).toContain('readonly signInUrl: string');
        });
    });

    describe('Delegation contract', () => {
        it('should create a handleForgotPassword adapter', () => {
            expect(forgotPasswordContent).toContain('handleForgotPassword');
        });

        it('should pass onForgotPassword handler to ForgotPasswordForm', () => {
            expect(forgotPasswordContent).toContain('onForgotPassword={handleForgotPassword}');
        });

        it('should forward resetPasswordUrl as redirectTo', () => {
            expect(forgotPasswordContent).toContain('redirectTo={resetPasswordUrl}');
        });

        it('should forward signInUrl to ForgotPasswordForm', () => {
            expect(forgotPasswordContent).toContain('signInUrl={signInUrl}');
        });

        it('should call forgetPassword with email and redirectTo', () => {
            expect(forgotPasswordContent).toContain('await forgetPassword({ email, redirectTo })');
        });
    });

    describe('Code quality', () => {
        it('should have no console.log statements', () => {
            expect(forgotPasswordContent).not.toContain('console.log');
        });

        it('should use async/await (not .then())', () => {
            expect(forgotPasswordContent).toContain('async');
            expect(forgotPasswordContent).toContain('await');
            expect(forgotPasswordContent).not.toContain('.then(');
        });

        it('should have JSDoc module annotation', () => {
            expect(forgotPasswordContent).toContain('@module ForgotPassword.client');
        });
    });
});

// ---------------------------------------------------------------------------
// ResetPassword.client.tsx
// ---------------------------------------------------------------------------
describe('ResetPassword.client.tsx', () => {
    describe('Named export', () => {
        it('should use a named function export (no default export)', () => {
            expect(resetPasswordContent).toContain('export function ResetPasswordClient');
            expect(resetPasswordContent).not.toContain('export default');
        });
    });

    describe('Imports', () => {
        it('should import ResetPasswordForm from @repo/auth-ui', () => {
            expect(resetPasswordContent).toContain(
                "import { ResetPasswordForm } from '@repo/auth-ui'"
            );
        });

        it('should import resetPassword from the local auth-client', () => {
            expect(resetPasswordContent).toContain(
                "import { resetPassword } from '../../lib/auth-client'"
            );
        });

        it('should NOT import from better-auth directly', () => {
            expect(resetPasswordContent).not.toContain("from 'better-auth'");
        });
    });

    describe('Props interface', () => {
        it('should export a ResetPasswordClientProps interface', () => {
            expect(resetPasswordContent).toContain('export interface ResetPasswordClientProps');
        });

        it('should have readonly token prop', () => {
            expect(resetPasswordContent).toContain('readonly token: string');
        });

        it('should have readonly signInUrl prop', () => {
            expect(resetPasswordContent).toContain('readonly signInUrl: string');
        });
    });

    describe('Delegation contract', () => {
        it('should create a handleResetPassword adapter', () => {
            expect(resetPasswordContent).toContain('handleResetPassword');
        });

        it('should pass onResetPassword handler to ResetPasswordForm', () => {
            expect(resetPasswordContent).toContain('onResetPassword={handleResetPassword}');
        });

        it('should forward token to ResetPasswordForm', () => {
            expect(resetPasswordContent).toContain('token={token}');
        });

        it('should forward signInUrl to ResetPasswordForm', () => {
            expect(resetPasswordContent).toContain('signInUrl={signInUrl}');
        });

        it('should call resetPassword with newPassword and token', () => {
            expect(resetPasswordContent).toContain(
                'await resetPassword({ newPassword, token: resetToken })'
            );
        });
    });

    describe('Code quality', () => {
        it('should have no console.log statements', () => {
            expect(resetPasswordContent).not.toContain('console.log');
        });

        it('should use async/await (not .then())', () => {
            expect(resetPasswordContent).toContain('async');
            expect(resetPasswordContent).toContain('await');
            expect(resetPasswordContent).not.toContain('.then(');
        });

        it('should have JSDoc module annotation', () => {
            expect(resetPasswordContent).toContain('@module ResetPassword.client');
        });
    });
});

// ---------------------------------------------------------------------------
// VerifyEmail.client.tsx
// ---------------------------------------------------------------------------
describe('VerifyEmail.client.tsx', () => {
    describe('Named export', () => {
        it('should use a named function export (no default export)', () => {
            expect(verifyEmailContent).toContain('export function VerifyEmailClient');
            expect(verifyEmailContent).not.toContain('export default');
        });
    });

    describe('Imports', () => {
        it('should import VerifyEmail from @repo/auth-ui', () => {
            expect(verifyEmailContent).toContain("import { VerifyEmail } from '@repo/auth-ui'");
        });

        it('should import verifyEmail from the local auth-client', () => {
            expect(verifyEmailContent).toContain(
                "import { verifyEmail } from '../../lib/auth-client'"
            );
        });

        it('should NOT import from better-auth directly', () => {
            expect(verifyEmailContent).not.toContain("from 'better-auth'");
        });
    });

    describe('Props interface', () => {
        it('should export a VerifyEmailClientProps interface', () => {
            expect(verifyEmailContent).toContain('export interface VerifyEmailClientProps');
        });

        it('should have readonly token prop', () => {
            expect(verifyEmailContent).toContain('readonly token: string');
        });

        it('should have readonly redirectTo prop', () => {
            expect(verifyEmailContent).toContain('readonly redirectTo: string');
        });
    });

    describe('Delegation contract', () => {
        it('should create a handleVerifyEmail adapter', () => {
            expect(verifyEmailContent).toContain('handleVerifyEmail');
        });

        it('should pass onVerifyEmail handler to VerifyEmail', () => {
            expect(verifyEmailContent).toContain('onVerifyEmail={handleVerifyEmail}');
        });

        it('should forward token to VerifyEmail', () => {
            expect(verifyEmailContent).toContain('token={token}');
        });

        it('should forward redirectTo to VerifyEmail', () => {
            expect(verifyEmailContent).toContain('redirectTo={redirectTo}');
        });

        it('should call verifyEmail with the token', () => {
            expect(verifyEmailContent).toContain('await verifyEmail({ token: verifyToken })');
        });
    });

    describe('Code quality', () => {
        it('should have no console.log statements', () => {
            expect(verifyEmailContent).not.toContain('console.log');
        });

        it('should use async/await (not .then())', () => {
            expect(verifyEmailContent).toContain('async');
            expect(verifyEmailContent).toContain('await');
            expect(verifyEmailContent).not.toContain('.then(');
        });

        it('should have JSDoc module annotation', () => {
            expect(verifyEmailContent).toContain('@module VerifyEmail.client');
        });
    });
});

// ---------------------------------------------------------------------------
// AuthSection.astro
// ---------------------------------------------------------------------------
describe('AuthSection.astro', () => {
    describe('Server Island', () => {
        it('should be documented as a Server Island', () => {
            expect(authSectionContent).toContain('Server Island');
        });

        it('should use server:defer in its JSDoc / usage context', () => {
            // The component itself documents server:defer usage for consumers
            expect(authSectionContent).toContain('server:defer');
        });
    });

    describe('Imports', () => {
        it('should import UserNav from UserNav.client', () => {
            expect(authSectionContent).toContain("import { UserNav } from './UserNav.client'");
        });

        it('should import createT from the i18n lib', () => {
            expect(authSectionContent).toContain('import { createT');
            expect(authSectionContent).toContain("from '../../lib/i18n'");
        });

        it('should import buildUrl from urls lib', () => {
            expect(authSectionContent).toContain("import { buildUrl } from '../../lib/urls'");
        });
    });

    describe('Props interface', () => {
        it('should define a Props interface', () => {
            expect(authSectionContent).toContain('interface Props');
        });

        it('should have readonly locale optional prop', () => {
            expect(authSectionContent).toContain('readonly locale?: string');
        });

        it('should have readonly variant optional prop with hero/scrolled union type', () => {
            expect(authSectionContent).toContain("readonly variant?: 'hero' | 'scrolled'");
        });

        it('should default locale to es', () => {
            expect(authSectionContent).toContain("locale = 'es'");
        });

        it('should default variant to hero', () => {
            expect(authSectionContent).toContain("variant = 'hero'");
        });
    });

    describe('Auth-aware rendering', () => {
        it('should read user from Astro.locals.user', () => {
            expect(authSectionContent).toContain('Astro.locals.user');
        });

        it('should conditionally render UserNav when authenticated', () => {
            expect(authSectionContent).toContain('isAuthenticated');
            expect(authSectionContent).toContain('<UserNav');
        });

        it('should render sign-in link when not authenticated', () => {
            expect(authSectionContent).toContain("path: 'auth/signin'");
        });

        it('should use locale-prefixed sign-in URL via buildUrl', () => {
            expect(authSectionContent).toContain('buildUrl({ locale: typedLocale');
        });

        it('should set id="navbar-signin" on the sign-in anchor', () => {
            expect(authSectionContent).toContain('id="navbar-signin"');
        });
    });

    describe('i18n', () => {
        it('should use createT for translations', () => {
            expect(authSectionContent).toContain('createT(typedLocale)');
        });

        it('should translate the sign-in label via t()', () => {
            expect(authSectionContent).toContain("t('nav.iniciarSesion'");
        });

        it('should cast locale to SupportedLocale', () => {
            expect(authSectionContent).toContain('as SupportedLocale');
        });
    });

    describe('Design tokens', () => {
        it('should use semantic color tokens for scrolled variant', () => {
            expect(authSectionContent).toContain('text-foreground');
            expect(authSectionContent).toContain('border-foreground/20');
        });

        it('should NOT use hardcoded palette colors', () => {
            expect(authSectionContent).not.toMatch(/text-(blue|red|green|gray)-\d+/);
            expect(authSectionContent).not.toMatch(/bg-(blue|red|green|gray)-\d+/);
        });
    });

    describe('UserNav delegation', () => {
        it('should pass user name to UserNav', () => {
            expect(authSectionContent).toContain('user.name');
        });

        it('should pass user email to UserNav', () => {
            expect(authSectionContent).toContain('user.email');
        });

        it('should forward locale to UserNav', () => {
            expect(authSectionContent).toContain('locale={locale}');
        });

        it('should forward variant to UserNav', () => {
            expect(authSectionContent).toContain('variant={variant}');
        });

        it('should use client:load directive on UserNav', () => {
            expect(authSectionContent).toContain('client:load');
        });
    });

    describe('Code quality', () => {
        it('should have no console.log statements', () => {
            expect(authSectionContent).not.toContain('console.log');
        });
    });
});
