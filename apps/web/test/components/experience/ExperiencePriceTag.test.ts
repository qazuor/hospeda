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

        it('delegates the on-request decision to resolveExperiencePriceDisplay (HOS-1943)', () => {
            // A null, missing or legacy 0 price is "on request": that rule lives
            // in the resolver (behaviour-tested in test/lib/experience/
            // price-display.test.ts). Here: the tag must call it with the stored
            // pair and branch on its answer, not re-derive the rule inline.
            expect(src).toContain('resolveExperiencePriceDisplay({ priceFrom, isPriceOnRequest })');
            expect(src).toContain("display.kind === 'on-request'");
            expect(src).not.toContain('priceFrom === 0');
        });
    });

    describe('price formatting', () => {
        it('divides the resolved cents by 100 for display (centavos to ARS)', () => {
            // `display.cents` is only reachable on the 'amount' branch, so the
            // conversion can never format a null or on-request price as "$0".
            expect(src).toContain('.format(display.cents / 100)');
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
        it('accepts priceFrom as a nullable number prop (HOS-1943)', () => {
            expect(src).toContain('readonly priceFrom: number | null');
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
