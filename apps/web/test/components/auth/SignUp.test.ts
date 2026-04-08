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
});
