/**
 * @file SignUp.test.ts
 * @description Unit tests for SignUp auth component.
 *
 * HOS-959: the OAuth block (Google/Facebook buttons, `handleOauth`, icons)
 * moved OUT of this component and into `AuthTabs.client.tsx` — see
 * `test/components/auth/AuthTabs.client.test.tsx` for that coverage now.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/auth/SignUp.client.tsx'),
    'utf8'
);

describe('SignUp.client.tsx', () => {
    describe('imports', () => {
        it('should import createTranslations from i18n', () => {
            expect(src).toContain('createTranslations');
        });
    });

    describe('props', () => {
        it('should accept locale prop', () => {
            expect(src).toContain('locale');
        });

        it('should accept redirectTo prop', () => {
            expect(src).toContain('redirectTo');
        });

        // HOS-959: email is now a controlled value owned by AuthTabs (so it
        // survives a tab switch), not local state.
        it('should accept email and onEmailChange as controlled props', () => {
            expect(src).toMatch(/readonly email: string/);
            expect(src).toMatch(/readonly onEmailChange: \(value: string\) => void/);
        });

        it('should no longer own a local email useState (HOS-959 — controlled by AuthTabs)', () => {
            expect(src).not.toMatch(/const\s+\[\s*email\s*,\s*setEmail\s*\]\s*=\s*useState/);
        });

        it('should no longer declare showOAuth or oauthRedirectTo (HOS-959 — OAuth moved to AuthTabs)', () => {
            expect(src).not.toContain('showOAuth');
            expect(src).not.toContain('oauthRedirectTo');
        });
    });

    // HOS-959: this component no longer renders or knows about OAuth at all
    // — no button, no handler, no icons. Assert the negative so a future
    // edit that re-introduces a second copy trips this guard immediately.
    describe('no OAuth surface left (HOS-959)', () => {
        it('does not call signIn.social', () => {
            expect(src).not.toContain('signIn.social');
        });

        it('does not render an OAuth button or icon component', () => {
            expect(src).not.toContain('GoogleIcon');
            expect(src).not.toContain('FacebookIcon');
        });
    });

    describe('i18n', () => {
        it('should use t() for the form aria-label', () => {
            expect(src).toContain("aria-label={t('auth.signUp.submit', 'Crear cuenta')}");
        });

        it('should not have hardcoded Spanish in aria-labels', () => {
            expect(src).not.toContain('aria-label="Cargando');
        });

        it('should not keep the legacy loading skeleton i18n key', () => {
            expect(src).not.toContain("t('auth-ui.loading'");
        });
    });

    describe('first paint accessibility', () => {
        it('should render a named form for first-paint sign-up', () => {
            expect(src).toContain('<form');
            expect(src).toContain("aria-label={t('auth.signUp.submit', 'Crear cuenta')}");
        });

        it('should not gate the form behind isClientReady', () => {
            expect(src).not.toContain('isClientReady');
        });
    });

    /**
     * SPEC-113: name collection moved to the profile completion form.
     * The signup form must NOT render or send a free-text name input.
     */
    describe('name field removal (SPEC-113)', () => {
        it('should not render a name input', () => {
            expect(src).not.toContain('id="signup-name"');
        });

        it('should not have a name useState hook', () => {
            expect(src).not.toMatch(/useState\(['"]['"]\)\s*;[\s\S]{0,40}setName/);
            expect(src).not.toMatch(/const\s+\[\s*name\s*,\s*setName\s*\]/);
        });

        it('should not bind to setName', () => {
            expect(src).not.toContain('setName(');
        });

        it('should pass an empty name string to signUp.email', () => {
            expect(src).toContain("name: ''");
        });
    });

    /**
     * SPEC-113 follow-up: signup password input now uses the shared
     * PasswordField component, which renders a confirm field, a
     * strength meter, and a rule checklist.
     */
    describe('password fields (SPEC-113 follow-up)', () => {
        it('imports the shared PasswordField component', () => {
            expect(src).toContain('PasswordField');
            expect(src).toContain("from '@/components/ui/PasswordField.client'");
        });

        it('renders the password field with the strength meter and rule checklist', () => {
            expect(src).toMatch(/<PasswordField[\s\S]*id="signup-password"[\s\S]*showStrength/);
            expect(src).toMatch(
                /<PasswordField[\s\S]*id="signup-password"[\s\S]*showRuleChecklist/
            );
        });

        it('renders a confirm password field', () => {
            expect(src).toContain('id="signup-confirm-password"');
            expect(src).toContain('setConfirmPassword');
        });

        it('imports StrongPasswordSchema from @repo/schemas (HOS-190 slice 3)', () => {
            expect(src).toContain("import { StrongPasswordSchema } from '@repo/schemas'");
        });

        it('validates the password against StrongPasswordSchema before submit', () => {
            expect(src).toContain('StrongPasswordSchema.safeParse(password)');
        });

        it('checks that password and confirmPassword match before submit', () => {
            expect(src).toContain('password !== confirmPassword');
        });

        it('passes a rules block (length / upper / lower / digit / special) to the PasswordField i18n', () => {
            expect(src).toContain('rules:');
            for (const key of ['length:', 'upper:', 'lower:', 'digit:', 'special:']) {
                expect(src).toContain(key);
            }
        });
    });

    /**
     * HOS-190 slice 3: `noValidate` disables the browser's native email
     * enforcement, so a real presence + format guard is required before
     * calling `signUp.email()`.
     */
    describe('email guard (HOS-190 slice 3)', () => {
        it('checks the trimmed email against EmailFormatSchema before submit', () => {
            expect(src).toContain('EmailFormatSchema.safeParse(trimmedEmail)');
        });

        it('sends the trimmed email to signUp.email', () => {
            // Matched by shape rather than by an exact one-line literal: the
            // call is formatted by Biome, and a reformat must not read as a
            // behaviour regression. The distance bound keeps this from
            // matching an unrelated `trimmedEmail` elsewhere in the file.
            expect(src).toMatch(/signUp\.email\(\{[\s\S]{0,120}?email:\s*trimmedEmail\b/);
        });

        it('tells the API where the verification link should land (HOS-838)', () => {
            // The destination cannot travel in the browser — the inbox may be
            // opened on another device — so it has to reach Better Auth here.
            expect(src).toMatch(
                /signUp\.email\(\{[\s\S]{0,200}?callbackURL:\s*verificationCallbackUrl\b/
            );
        });
    });
});
