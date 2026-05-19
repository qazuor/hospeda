/**
 * @file SignUp.test.ts
 * @description Unit tests for SignUp auth component.
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
    });

    describe('i18n', () => {
        it('should use t() for loading aria-label', () => {
            expect(src).toContain("t('auth-ui.loading'");
        });

        it('should not have hardcoded Spanish in aria-labels', () => {
            expect(src).not.toContain('aria-label="Cargando');
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

        it('imports StrongPasswordRegex from @repo/schemas', () => {
            expect(src).toContain("import { StrongPasswordRegex } from '@repo/schemas'");
        });

        it('checks the password against StrongPasswordRegex before submit', () => {
            expect(src).toContain('StrongPasswordRegex.test(password)');
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
});
