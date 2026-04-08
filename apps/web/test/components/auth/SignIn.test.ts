/**
 * @file SignIn.test.ts
 * @description Unit tests for SignIn auth component.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/auth/SignIn.client.tsx'),
    'utf8'
);

describe('SignIn.client.tsx', () => {
    describe('imports', () => {
        it('should import createTranslations from i18n', () => {
            expect(src).toContain('createTranslations');
        });

        it('should import SupportedLocale type', () => {
            expect(src).toContain('SupportedLocale');
        });
    });

    describe('props', () => {
        it('should accept locale prop', () => {
            expect(src).toContain('locale');
        });

        it('should accept redirectTo prop', () => {
            expect(src).toContain('redirectTo');
        });

        it('should accept showOAuth prop', () => {
            expect(src).toContain('showOAuth');
        });
    });

    describe('i18n', () => {
        it('should use t() for loading skeleton aria-label', () => {
            expect(src).toContain("t('auth-ui.loading'");
        });

        it('should not have hardcoded Spanish in aria-labels', () => {
            expect(src).not.toContain('aria-label="Cargando');
        });
    });

    describe('accessibility', () => {
        it('should have aria-busy on loading skeleton', () => {
            expect(src).toContain('aria-busy="true"');
        });
    });
});
