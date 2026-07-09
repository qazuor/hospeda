/**
 * @file PricingCardsGrid.test.ts
 * @description Source-reading guard for PricingCardsGrid.astro. Astro components
 * can't be rendered in Vitest/jsdom, so we assert on the source text.
 *
 * Focus: the billing-period toggle lifecycle (Bug B4). The monthly/annual toggle
 * is wired by a vanilla-JS module script. Astro's ClientRouter does NOT re-run
 * module scripts after a View Transitions swap, so the init MUST be attached on
 * `astro:page-load` (which also fires on first load) — a bare module-level call
 * leaves the toggle dead after in-app navigation.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/billing/PricingCardsGrid.astro'),
    'utf8'
);

describe('PricingCardsGrid.astro', () => {
    describe('billing toggle lifecycle (Bug B4)', () => {
        it('re-initializes the toggle on every navigation via astro:page-load', () => {
            expect(src).toContain("addEventListener('astro:page-load'");
        });

        it('wires the page-load listener to the toggle initializer', () => {
            // Keystone of the B4 fix: the container query must run inside the
            // page-load handler, not as a bare module-level statement that
            // ClientRouter would skip on subsequent navigations.
            expect(src).toMatch(
                /addEventListener\(\s*'astro:page-load'\s*,\s*initAllPricingToggles\s*\)/
            );
        });

        it('drives the card prices through the data-billing attribute', () => {
            expect(src).toContain("setAttribute('data-billing'");
        });

        it('only renders the toggle when at least one plan has an annual price', () => {
            expect(src).toContain('hasAnyAnnualPrice');
        });
    });

    describe('trial copy visible on both toggles (HOS-115 T-005)', () => {
        it('renders the trial line with an interval-neutral class (no --monthly modifier)', () => {
            expect(src).toContain('class="pricing-card__trial"');
            expect(src).not.toContain('pricing-card__trial--monthly');
        });

        it('does not hide the trial class under the annual toggle', () => {
            // The annual hide rule must only target the monthly-specific price
            // amount/period — the trial copy is the SAME trial regardless of
            // interval (HOS-115), so it must stay visible under both toggles.
            const annualHideRuleMatch = src.match(
                /\[data-billing='annual'\] \.pricing-card__amount--monthly,[\s\S]*?\{\s*display: none;\s*\}/
            );
            expect(annualHideRuleMatch).not.toBeNull();
            expect(annualHideRuleMatch?.[0]).not.toContain('pricing-card__trial');
        });
    });

    describe('pre-select toggle from ?interval= query param (HOS-115 T-006)', () => {
        it('reads the interval query param on load', () => {
            expect(src).toContain('function resolveInitialInterval');
            expect(src).toContain('new URLSearchParams(window.location.search)');
            expect(src).toContain("params.get('interval')");
        });

        it('defaults to monthly when the param is absent or invalid', () => {
            expect(src).toMatch(/params\.get\('interval'\) === 'annual' \? 'annual' : 'monthly'/);
        });

        it('applies the resolved interval before wiring the click listeners, so a later manual toggle click is never overridden', () => {
            const initFnMatch = src.match(
                /function initPricingToggle\(container: HTMLElement\): void \{[\s\S]*?\n\t\}/
            );
            expect(initFnMatch).not.toBeNull();
            const body = initFnMatch?.[0] ?? '';
            const setActiveCallIndex = body.indexOf('setActive(resolveInitialInterval())');
            const addEventListenerIndex = body.indexOf("addEventListener('click'");
            expect(setActiveCallIndex).toBeGreaterThan(-1);
            expect(addEventListenerIndex).toBeGreaterThan(-1);
            expect(setActiveCallIndex).toBeLessThan(addEventListenerIndex);
        });
    });
});
