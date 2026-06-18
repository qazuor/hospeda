/**
 * @file ExperiencePriceTag.test.ts
 * @description Source-read tests for ExperiencePriceTag.astro (SPEC-240 T-030).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/experience/ExperiencePriceTag.astro'),
    'utf8'
);

describe('ExperiencePriceTag.astro', () => {
    describe('price on request', () => {
        it('renders "Consultar precio" when isPriceOnRequest is true', () => {
            expect(src).toContain('isPriceOnRequest');
            expect(src).toContain('experience.priceOnRequest');
        });

        it('also shows "Consultar" when priceFrom is 0', () => {
            // Zero price is treated as "on request"
            expect(src).toContain('priceFrom === 0');
        });
    });

    describe('price formatting', () => {
        it('divides priceFrom by 100 for display (centavos to ARS)', () => {
            expect(src).toContain('priceFrom / 100');
        });

        it('uses Intl.NumberFormat with es-AR currency formatting', () => {
            expect(src).toContain('Intl.NumberFormat');
            expect(src).toContain('es-AR');
            expect(src).toContain('ARS');
        });
    });

    describe('price unit', () => {
        it('renders the priceUnit label from i18n', () => {
            expect(src).toContain('priceUnit');
        });
    });

    describe('props', () => {
        it('accepts priceFrom as a number prop', () => {
            expect(src).toContain('readonly priceFrom: number');
        });

        it('accepts isPriceOnRequest as a boolean prop', () => {
            expect(src).toContain('readonly isPriceOnRequest: boolean');
        });

        it('accepts locale for i18n', () => {
            expect(src).toContain('readonly locale: SupportedLocale');
        });
    });

    describe('CSS tokens', () => {
        it('uses CSS custom properties (no Tailwind)', () => {
            expect(src).toContain('var(--');
            expect(src).not.toMatch(/class="[^"]*\b(text-|bg-|p-|m-)\w/);
        });
    });
});
