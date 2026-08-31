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
            expect(src).toContain('function resolveQueryInterval');
            expect(src).toContain('new URLSearchParams(window.location.search)');
            expect(src).toContain("params.get('interval')");
        });

        it('returns null (not a forced default) when the param is absent or invalid', () => {
            expect(src).toMatch(/value === 'monthly' \|\| value === 'annual' \? value : null/);
        });

        it('applies the resolved interval before wiring the click listeners, so a later manual toggle click is never overridden', () => {
            const initFnMatch = src.match(
                /function initPricingToggle\(container: HTMLElement\): void \{[\s\S]*?\n\t\}/
            );
            expect(initFnMatch).not.toBeNull();
            const body = initFnMatch?.[0] ?? '';
            const setActiveCallIndex = body.indexOf("setActive(queryInterval ?? 'monthly')");
            const addEventListenerIndex = body.indexOf("addEventListener('click'");
            expect(setActiveCallIndex).toBeGreaterThan(-1);
            expect(addEventListenerIndex).toBeGreaterThan(-1);
            expect(setActiveCallIndex).toBeLessThan(addEventListenerIndex);
        });
    });

    describe('pre-select toggle from logged-in intendedInterval lookup (HOS-115 T-008, nudge path 2)', () => {
        it('fetches trial status via the shared billingApi client, not a raw fetch()', () => {
            expect(src).toContain("import { billingApi } from '@/lib/api/endpoints-protected';");
            expect(src).toContain('billingApi.getTrialStatus()');
            expect(src).not.toMatch(/\bfetch\(/);
        });

        it('only runs the lookup when the query param did not already decide', () => {
            const initFnMatch = src.match(
                /function initPricingToggle\(container: HTMLElement\): void \{[\s\S]*?\n\t\}/
            );
            const body = initFnMatch?.[0] ?? '';
            expect(body).toMatch(
                /if \(!queryInterval && container\.dataset\.audience === 'owner'\)/
            );
        });

        it('is scoped to the owner audience via data-audience, so the tourist pricing page is unaffected', () => {
            expect(src).toContain('data-audience={audience}');
            expect(src).toContain("container.dataset.audience === 'owner'");
        });

        it('never overrides a manual toggle click made while the lookup is in flight', () => {
            expect(src).toContain('let manuallyToggled = false;');
            expect(src).toContain('manuallyToggled = true;');
            expect(src).toContain('isOverridden: () => manuallyToggled');
            const nudgeFnMatch = src.match(
                /async function applyIntendedIntervalNudge[\s\S]*?\): Promise<void> \{[\s\S]*?\n\t\}/
            );
            expect(nudgeFnMatch).not.toBeNull();
            expect(nudgeFnMatch?.[0]).toContain('if (isOverridden() || !result.ok) return;');
        });

        it('only applies a valid resolved interval from the API response', () => {
            const nudgeFnMatch = src.match(
                /async function applyIntendedIntervalNudge[\s\S]*?\): Promise<void> \{[\s\S]*?\n\t\}/
            );
            const body = nudgeFnMatch?.[0] ?? '';
            expect(body).toContain(
                "if (intendedInterval === 'monthly' || intendedInterval === 'annual') {"
            );
            expect(body).toContain('setActive(intendedInterval);');
        });

        it('documents why the lookup is client-side and not baked into the cached SSR HTML', () => {
            expect(src).toContain('Cache-Control');
            expect(src.toLowerCase()).toContain('cloudflare caches the ssr html');
        });
    });

    // ─── HOS-943 ────────────────────────────────────────────────────────────
    //
    // These are source-reading guards, and they are honest about it: they prove
    // the component WIRES the delta rather than that a browser renders it. The
    // delta's behaviour is executed in `plan-card-delta.test.ts`; what is left
    // for this file is the wiring that file cannot see — that the card reads
    // the computed delta instead of a curated list, and that the pieces which
    // must be unconditional really are.

    describe('cumulative delta (AC-10, AC-11)', () => {
        it('derives the bullets from the computed delta, not from a curated list', () => {
            expect(src).toContain(
                "import { computePlanDelta, computePlanDeltas } from '@/components/billing/plan-card-delta';"
            );
            expect(src).toContain('const deltas = computePlanDeltas({ plans });');
        });

        it('feeds the delta — not the plan’s full entitlement list — to the bullet builder', () => {
            // The bug this catches is subtle and would look right: keeping
            // `getDisplayFeatures({ keys: plan.entitlements })` renders every
            // tier as a full list under a header promising only differences.
            expect(src).toContain(
                'getDisplayFeatures({ keys: delta.addedEntitlements, audience, t })'
            );
            expect(src).not.toContain('getDisplayFeatures({ keys: plan.entitlements');
        });

        it('renders limit lines from the delta’s limitChanges', () => {
            expect(src).toContain('delta.limitChanges.map(');
        });

        it('requires `limits` on the plan shape, so a payload without caps cannot compile', () => {
            // Dropping this field is what made an entitlement-only delta the
            // only implementable one before HOS-943.
            expect(src).toMatch(/readonly limits: Readonly<Record<string, number>>;/);
        });

        it('carries no hand-written per-plan feature or delta list', () => {
            // AC-11. Any literal plan slug in the component would be the start
            // of exactly the curated table this feature exists to avoid.
            for (const slug of ['owner-basico', 'owner-pro', 'owner-premium', 'tourist-vip']) {
                expect(src).not.toContain(slug);
            }
        });
    });

    describe('no "everything in plan undefined" (AC-17)', () => {
        it('builds the delta heading only inside the showsDelta branch', () => {
            const headingMatch = src.match(
                /deltaHeading: showsDelta\n\t{3}\? includesEverythingTemplate\.replace\(/
            );
            expect(headingMatch).not.toBeNull();
        });

        it('interpolates the previous plan’s name in exactly one place', () => {
            const occurrences = src.split('includesEverythingTemplate.replace(').length - 1;
            expect(occurrences).toBe(1);
        });

        it('falls back to a neutral heading when there is no previous tier', () => {
            expect(src).toContain('const includesAllLabel = ');
            expect(src).toContain(': includesAllLabel,');
        });

        it('requires a real previous plan object, not just a non-zero index', () => {
            // `index > 0` alone is not enough: with `noUncheckedIndexedAccess`
            // off, `plans[index - 1]` could still be undefined at runtime.
            expect(src).toContain(
                'const showsDelta = !rawDelta.isFirstTier && !rawDelta.isEmpty && previousPlan !== undefined;'
            );
        });

        it('falls back to the full offer when a tier adds nothing (empty delta)', () => {
            expect(src).toContain(
                'const delta = showsDelta ? rawDelta : computePlanDelta({ plan });'
            );
        });
    });

    describe('"Recomendado para" on every card, no superiority badge (AC-12)', () => {
        it('renders the audience line unconditionally, at the same nesting depth as the plan name', () => {
            // An indentation-depth comparison, not a `)}`-position one: with
            // nested conditionals, `indexOf(')}')` finds the inner closer first
            // and passes with the element still inside a condition.
            const nameLine = src
                .split('\n')
                .find((line) => line.includes('<h3 class="pricing-card__name">'));
            const audienceLine = src
                .split('\n')
                .find((line) => line.includes('<p class="pricing-card__audience">'));

            expect(nameLine).toBeDefined();
            expect(audienceLine).toBeDefined();

            const depthOf = (line: string): number => (line.match(/^\t*/)?.[0] ?? '').length;
            expect(depthOf(audienceLine as string)).toBe(depthOf(nameLine as string));
        });

        it('resolves the profile through the shared helper for every plan', () => {
            expect(src).toContain('getPlanRecommendedFor({ plan, audience, t })');
            expect(src).toContain('{card.recommendedFor}');
        });

        it('has no highlighted card, no badge and no highlightedSlug prop', () => {
            expect(src).not.toContain('highlightedSlug');
            expect(src).not.toContain('data-recommended-label');
            expect(src).not.toContain("t('pricing.recommended'");
            expect(src).not.toMatch(/\.pricing-card--highlighted\s*\{/);
            expect(src).not.toContain("'pricing-card--highlighted'");
        });
    });

    describe('every numeric limit is explained, accessibly (AC-13)', () => {
        it('renders the explanation inside the same list item as the value', () => {
            // Same <li> is what makes the explanation part of what a screen
            // reader announces with the number.
            const itemMatch = src.match(/<li class="pricing-card__limit">[\s\S]*?<\/li>/);
            expect(itemMatch).not.toBeNull();
            const item = itemMatch?.[0] ?? '';
            expect(item).toContain('{line.text}');
            expect(item).toContain('{line.help}');
        });

        it('resolves the explanation from i18n per limit key', () => {
            expect(src).toContain('help: getLimitHelp({ key: change.key, t })');
        });

        it('uses a visible line rather than a title-attribute tooltip', () => {
            // A `title` tooltip is not keyboard-operable and is inconsistently
            // announced; AC-13 prefers the visible secondary line.
            expect(src).not.toMatch(/<span[^>]*title=/);
            expect(src).toContain('.pricing-card__limit-help');
        });

        it('never prints the raw unlimited sentinel', () => {
            expect(src).toContain('formatLimitValue({');
            expect(src).toContain('isUnlimited: change.isUnlimited');
        });
    });

    describe('grid stays centred at one, two or three tiers (AC-14, absorbs HOS-891)', () => {
        it('exposes the rendered card count on the grid, clamped to three', () => {
            expect(src).toContain(
                '<div class="pricing-cards__grid" data-count={Math.min(cards.length, 3)}>'
            );
        });

        it('gives the one-card and two-card grids their own column template and width', () => {
            const twoRule = src.match(/\.pricing-cards__grid\[data-count='2'\] \{[\s\S]*?\}/);
            const oneRule = src.match(/\.pricing-cards__grid\[data-count='1'\] \{[\s\S]*?\}/);

            expect(twoRule?.[0]).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
            expect(twoRule?.[0]).toContain('max-width:');
            expect(oneRule?.[0]).toContain('grid-template-columns: minmax(0, 1fr);');
            expect(oneRule?.[0]).toContain('max-width:');
        });

        it('centres the track itself instead of centring a track wider than its cards', () => {
            const baseRule = src.match(/\n\t\.pricing-cards__grid \{[\s\S]*?\n\t\}/);
            expect(baseRule?.[0]).toContain('margin: 0 auto;');
            expect(baseRule?.[0]).toContain('justify-content: center;');
        });

        it('collapses every count to a single centred column below 768px', () => {
            const mobile = src.match(/@media \(max-width: 768px\) \{[\s\S]*?\n\t\}/);
            expect(mobile?.[0]).toContain(".pricing-cards__grid[data-count='1']");
            expect(mobile?.[0]).toContain(".pricing-cards__grid[data-count='2']");
            expect(mobile?.[0]).toContain('grid-template-columns: minmax(0, 1fr);');
        });
    });

    describe('card-first trial copy (AC-15, AC-16)', () => {
        it('never claims a no-card trial', () => {
            const lowered = src.toLowerCase();
            for (const phrase of ['sin tarjeta', 'no credit card', 'sem cartão', 'sem cartao']) {
                expect(lowered).not.toContain(phrase);
            }
        });

        it('takes the trial length from the plan, never from a hardcoded string', () => {
            expect(src).toContain("tPlural('pricing.trial', card.plan.trialDays)");
            // No literal day count anywhere in the component's own copy.
            expect(src).not.toMatch(/\b\d+\s*d[ií]as?\b/i);
        });
    });
});
