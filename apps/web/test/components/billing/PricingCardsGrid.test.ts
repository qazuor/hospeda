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
import { semanticTypography } from '@repo/design-tokens';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/billing/PricingCardsGrid.astro'),
    'utf8'
);

/**
 * The card build moved out of the frontmatter into a real module (see that
 * file's header for why `astro check` forced it). The HOS-943 guards below that
 * are about WHAT the card says therefore read this file now — the assertions are
 * unchanged, only their subject moved. The ones about the component still read
 * the component.
 */
const viewSrc = readFileSync(
    resolve(__dirname, '../../../src/components/billing/pricing-card-view.ts'),
    'utf8'
);

/**
 * The `<li>` markup for one bullet / one numeric cap moved into its own
 * component when the card's list was cut into a visible summary plus a
 * `<details>` disclosure: both halves render through it, and duplicating twenty
 * lines of markup is how the two copies drift — a source-reading guard only ever
 * matches the first one.
 */
const itemSrc = readFileSync(
    resolve(__dirname, '../../../src/components/billing/PricingCardItem.astro'),
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
            expect(viewSrc).toContain(
                "import { computePlanDelta, computePlanDeltas } from '@/components/billing/plan-card-delta';"
            );
            expect(viewSrc).toContain('const deltas = computePlanDeltas({ plans });');
        });

        it('feeds the delta — not the plan’s full entitlement list — to the bullet builder', () => {
            // The bug this catches is subtle and would look right: keeping
            // `getDisplayFeatures({ keys: plan.entitlements })` renders every
            // tier as a full list under a header promising only differences.
            expect(viewSrc).toContain(
                'getDisplayFeatures({ keys: delta.addedEntitlements, audience, t })'
            );
            expect(viewSrc).not.toContain('getDisplayFeatures({ keys: plan.entitlements');
        });

        it('renders limit lines from the delta’s limitChanges', () => {
            expect(viewSrc).toContain('delta.limitChanges.map(');
        });

        it('requires `limits` on the plan shape, so a payload without caps cannot compile', () => {
            // Dropping this field is what made an entitlement-only delta the
            // only implementable one before HOS-943.
            expect(viewSrc).toMatch(/readonly limits: Readonly<Record<string, number>>;/);
        });

        it('carries no hand-written per-plan feature or delta list', () => {
            // AC-11. Any literal plan slug in either file would be the start of
            // exactly the curated table this feature exists to avoid. Both are
            // swept: the build moved out of the component, so checking only the
            // component would leave the curated list a file away.
            for (const slug of ['owner-basico', 'owner-pro', 'owner-premium', 'tourist-vip']) {
                expect(src, `component / ${slug}`).not.toContain(slug);
                expect(viewSrc, `view builder / ${slug}`).not.toContain(slug);
            }
        });
    });

    describe('no "everything in plan undefined" (AC-17)', () => {
        // The behaviour these guard is also EXECUTED, on the real build, in
        // `pricing-card-view.test.ts`. They stay because a passing behaviour
        // test cannot tell "the guard is unreachable" from "the guard is right":
        // these pin the shape that makes the bad string unrepresentable.
        it('builds the delta heading only inside the showsDelta branch', () => {
            const headingMatch = viewSrc.match(
                /deltaHeading: showsDelta\n\s+\? includesEverythingTemplate\.replace\(/
            );
            expect(headingMatch).not.toBeNull();
        });

        it('interpolates the previous plan’s name in exactly one place', () => {
            const occurrences = viewSrc.split('includesEverythingTemplate.replace(').length - 1;
            expect(occurrences).toBe(1);
        });

        it('falls back to a neutral heading when there is no previous tier', () => {
            expect(viewSrc).toContain('const includesAllLabel = ');
            expect(viewSrc).toContain(': includesAllLabel');
        });

        it('requires a real previous plan object, not just a non-zero index', () => {
            // `index > 0` alone is not enough: with `noUncheckedIndexedAccess`
            // off, `plans[index - 1]` could still be undefined at runtime.
            expect(viewSrc).toContain(
                'const showsDelta = !rawDelta.isFirstTier && !rawDelta.isEmpty && previousPlan !== undefined;'
            );
        });

        it('falls back to the full offer when a tier adds nothing (empty delta)', () => {
            expect(viewSrc).toContain(
                'const delta = showsDelta ? rawDelta : computePlanDelta({ plan });'
            );
        });
    });

    describe('"Recomendado para" on every card, no superiority badge (AC-12)', () => {
        it('renders the audience line unconditionally, at the card’s own nesting depth', () => {
            // An indentation-depth comparison, not a `)}`-position one: with
            // nested conditionals, `indexOf(')}')` finds the inner closer first
            // and passes with the element still inside a condition.
            //
            // The anchor is the header block, not the plan NAME: the name moved
            // one level deeper when it was grouped with the description, so
            // comparing against it would now demand that the audience line be
            // nested too — the opposite of what this asserts. The header is the
            // card's first direct child and is unconditional by construction.
            const headerLine = src
                .split('\n')
                .find((line) => line.includes('<div class="pricing-card__header">'));
            const audienceLine = src
                .split('\n')
                .find((line) => line.includes('<p class="pricing-card__audience">'));

            expect(headerLine).toBeDefined();
            expect(audienceLine).toBeDefined();

            const depthOf = (line: string): number => (line.match(/^\t*/)?.[0] ?? '').length;
            expect(depthOf(audienceLine as string)).toBe(depthOf(headerLine as string));
        });

        it('resolves the profile through the shared helper for every plan', () => {
            expect(viewSrc).toContain('getPlanRecommendedFor({ plan, audience, t })');
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
            // reader announces with the number. The <li> now lives in
            // PricingCardItem.astro — one component rendered by both halves of
            // the split list — so that is where the shape is pinned.
            const itemMatch = itemSrc.match(/<li class="pricing-card__limit">[\s\S]*?<\/li>/);
            expect(itemMatch).not.toBeNull();
            const item = itemMatch?.[0] ?? '';
            expect(item).toContain('{item.text}');
            expect(item).toContain('{item.help}');
        });

        it('renders both halves of the split list through that ONE component', () => {
            // The reason the markup was extracted: two inline copies drift, and
            // the guard above would only ever have matched the first of them.
            expect(src).toContain(
                "import PricingCardItemLine from '@/components/billing/PricingCardItem.astro';"
            );
            expect(src).not.toContain('<li class="pricing-card__limit">');
            expect(src).not.toContain('<li class="pricing-card__feature">');
            // Twice: once for the visible summary, once inside the disclosure.
            expect(src.split('<PricingCardItemLine item={item} />').length - 1).toBe(2);
        });

        it('resolves the explanation from i18n per limit key', () => {
            expect(viewSrc).toContain('help: getLimitHelp({ key: change.key, t })');
        });

        it('uses a visible line rather than a title-attribute tooltip', () => {
            // A `title` tooltip is not keyboard-operable and is inconsistently
            // announced; AC-13 prefers the visible secondary line. Swept over
            // both files that render card markup.
            expect(src).not.toMatch(/<span[^>]*title=/);
            expect(itemSrc).not.toMatch(/<span[^>]*title=/);
            expect(itemSrc).toContain('.pricing-card__limit-help');
        });

        it('never prints the raw unlimited sentinel', () => {
            expect(viewSrc).toContain('formatLimitValue({');
            expect(viewSrc).toContain('isUnlimited: change.isUnlimited');
        });
    });

    describe('grid stays centred at one, two or three tiers (AC-14, absorbs HOS-891)', () => {
        it('exposes the rendered card count on the grid, clamped to three', () => {
            // HOS-984 added an `id` attribute to this element (the promo-entry
            // anchor's scroll target), so this checks the load-bearing pieces
            // independently rather than one exact attribute-order string.
            expect(src).toContain('class="pricing-cards__grid"');
            expect(src).toContain('data-count={Math.min(cards.length, 3)}');
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
            // Swept over every file that now contributes card copy, not just
            // the component — the build moved out, and a claim added there
            // would reach the same card.
            for (const [name, text] of [
                ['component', src],
                ['view builder', viewSrc],
                ['item component', itemSrc]
            ] as const) {
                const lowered = text.toLowerCase();
                for (const phrase of [
                    'sin tarjeta',
                    'no credit card',
                    'sem cartão',
                    'sem cartao'
                ]) {
                    expect(lowered, `${name} / ${phrase}`).not.toContain(phrase);
                }
            }
        });

        it('takes the trial length from the plan, never from a hardcoded string', () => {
            expect(src).toContain("tPlural('pricing.trial', card.plan.trialDays)");
            // No literal day count anywhere in the card's own copy.
            expect(src).not.toMatch(/\b\d+\s*d[ií]as?\b/i);
            expect(viewSrc).not.toMatch(/\b\d+\s*d[ií]as?\b/i);
        });
    });

    // ─── Owner review of the live pages ─────────────────────────────────────
    //
    // Six adjustments after the owner saw the pages running. The behavioural
    // half (what the summary contains, what the discount says) is executed in
    // `pricing-card-items.test.ts`, `annual-saving.test.ts` and
    // `pricing-card-view.test.ts`. What is left here is what only the markup and
    // the stylesheet can answer.

    describe('the card is cut down, and nothing is lost (adjustment 1)', () => {
        it('hides the remainder behind a native <details>, so it works with no JavaScript', () => {
            // A scripted toggle would have to re-solve keyboard operation, the
            // expanded-state announcement, and the no-JS fallback. <details>
            // gives all three for free — and, unlike `display: none` driven by a
            // script, the hidden lines are in the DOM for find-in-page and for
            // crawlers.
            expect(src).toContain('<details class="pricing-card__more">');
            expect(src).toContain('<summary class="pricing-card__more-summary">');
        });

        it('renders the disclosure ONLY when something is actually hidden', () => {
            // Otherwise a short card grows a "(0 más)" control that opens onto
            // nothing.
            expect(src).toContain('{card.hiddenItems.length > 0 && (');
        });

        it('labels the disclosure with a count resolved from the split, not a literal', () => {
            expect(src).toContain('{card.seeAllLabel}');
            expect(viewSrc).toContain(
                "seeAllLabel: seeAllTemplate.replace('{count}', String(items.hidden.length))"
            );
        });

        it('takes the summary size from the shared constant, never from a literal', () => {
            expect(viewSrc).toContain(
                "import { buildPricingCardItems } from '@/components/billing/pricing-card-items';"
            );
            expect(viewSrc).toContain('const items = buildPricingCardItems({');
        });

        it('keeps the summary the FIRST child of the details in the markup', () => {
            // Non-negotiable: `<summary>` is only the disclosure's label — and
            // only keyboard-operable as one — when it is the first child. The
            // owner wanted the control at the foot of the list; that is a
            // presentational reorder, never a DOM move.
            const details = src.match(
                /<details class="pricing-card__more">([\s\S]*?)<\/details>/
            )?.[1];

            expect(details).toBeDefined();
            const summaryAt = (details as string).indexOf('<summary');
            const listAt = (details as string).indexOf('<ul');
            expect(summaryAt).toBeGreaterThan(-1);
            expect(listAt).toBeGreaterThan(-1);
            expect(summaryAt).toBeLessThan(listAt);
        });

        it('moves the trigger to the foot of the list with CSS alone', () => {
            // Open, the control used to sit between the lines already showing
            // and the ones just revealed, splitting the list in two.
            const detailsRule = src.match(/\.pricing-card__more \{([^}]*)\}/)?.[1] ?? '';
            const summaryRule = src.match(/\.pricing-card__more-summary \{([^}]*)\}/)?.[1] ?? '';

            expect(detailsRule).toContain('display: flex;');
            expect(detailsRule).toContain('flex-direction: column;');
            expect(summaryRule).toContain('order: 2;');
        });

        it('carries BOTH labels in the DOM and alternates them on [open]', () => {
            // Never a script: `details` keeps working with JavaScript off, so a
            // JS-written label would say "ver todo" over an already-open list.
            expect(src).toContain(
                'class="pricing-card__more-label pricing-card__more-label--closed"'
            );
            expect(src).toContain(
                'class="pricing-card__more-label pricing-card__more-label--open"'
            );
            expect(src).toContain('{card.seeAllLabel}');
            expect(src).toContain('{seeLessLabel}');

            // One rule per state. Either one missing leaves both labels visible
            // in that state — the closed card would read "Ver todo lo que
            // incluye (5 más) Ver menos".
            expect(src).toMatch(
                /\.pricing-card__more:not\(\[open\]\) \.pricing-card__more-label--open \{\s*display: none;/
            );
            expect(src).toMatch(
                /\.pricing-card__more\[open\] \.pricing-card__more-label--closed \{\s*display: none;/
            );
        });

        it('takes the open label from i18n, with no count baked into it', () => {
            expect(src).toContain("t('pricing.seeLess'");
        });

        it('keeps the revealed lines free of focusable content, which is what makes the reorder safe', () => {
            // Reordering with flex does NOT reorder tabbing. The reorder is only
            // harmless because the summary's next tab stop is the CTA, below it
            // in both orders. A link or a button inside a revealed line would
            // send focus visually BACKWARDS.
            expect(itemSrc).not.toMatch(/<(a|button|input|select|textarea)\b/);
            expect(itemSrc).not.toContain('tabindex');
        });
    });

    describe('prices and CTAs land on the same line across cards (adjustment 2)', () => {
        it('shares row tracks with subgrid rather than guessing a min-height', () => {
            expect(src).toContain('grid-template-rows: subgrid;');
            expect(src).toContain('grid-row: 1 / -1;');
            // A min-height tuned by eye breaks on the first copy edit, in
            // another locale, or at another font size.
            expect(src).not.toMatch(/\.pricing-card\s*\{[^}]*min-height:/);
        });

        it('declares one row per in-flow card block — the invariant subgrid depends on', () => {
            // Every direct child of `.pricing-card` consumes one shared row, so
            // the row list and the block list must have the same length. Adding
            // a block without adding a row silently shifts every card that
            // renders it relative to the others.
            //
            // History of the count, because both moves were deliberate and each
            // looks like a mistake from the other side:
            //
            //   7 → 6  the plan name and its description were wrapped in
            //          `.pricing-card__header`. They are one group, they now
            //          share one row, and the row list lost an `auto` to match.
            //          `pricing-card__name` and `pricing-card__desc` are
            //          asserted separately below — still rendered, just no
            //          longer DIRECT children.
            //   6 → 7  HOS-943 split the card into a centred offer half and a
            //          left-aligned detail half. The `<hr>` between them is a
            //          real in-flow child, so the row list gained an `auto`.
            //          Taking the rule out of flow (absolute, or a
            //          pseudo-element on a neighbour) would have kept the count
            //          at six and been WRONG: a shared row is precisely what
            //          makes the rule land on the same line across the three
            //          cards.
            const blocks = [
                'pricing-card__header',
                'pricing-card__audience"',
                'pricing-card__price"',
                'pricing-card__divider',
                'pricing-card__delta-heading',
                'pricing-card__body',
                'pricing-card__btn-wrapper'
            ];
            for (const block of blocks) {
                expect(src, block).toContain(`class="${block.replace('"', '')}"`);
            }

            const rows = src.match(/grid-template-rows: ((?:auto |1fr )+auto);/);
            expect(rows).not.toBeNull();
            expect((rows?.[1] ?? '').split(/\s+/)).toHaveLength(blocks.length);
        });

        it('keeps the selection radio OUT of the flow, so it consumes no row', () => {
            // `.sr-only` is absolutely positioned; an absolutely positioned
            // element is not a grid item. If it ever stopped being one, every
            // card would shift by a row.
            expect(src).toContain('class="sr-only pricing-card__select"');
        });

        it('degrades to the previous behaviour where subgrid is unsupported', () => {
            expect(src).toContain('@supports (grid-template-rows: subgrid)');
            // The flex fallback still stretches the cards to equal height and
            // still bottom-aligns the CTA.
            expect(src).toContain('align-items: stretch;');
            expect(src).toMatch(/\.pricing-card__btn-wrapper \{[\s\S]*?margin-top: auto;/);
        });
    });

    describe('the annual discount is legible BEFORE choosing annual (adjustment 3)', () => {
        it('shows a per-card hint while the monthly price is on screen', () => {
            expect(src).toContain('{card.annualHintLabel}');
            expect(src).toContain('class="pricing-card__annual-hint"');
        });

        it('hides that hint once annual is selected — the saving label takes over', () => {
            const annualHideRule = src.match(
                /\[data-billing='annual'\] \.pricing-card__amount--monthly,[\s\S]*?\{\s*display: none;\s*\}/
            );
            expect(annualHideRule?.[0]).toContain('pricing-card__annual-hint');
        });

        it('never renders the hint for a plan with no annual price', () => {
            // Guarded on the resolved label being non-empty, and the label is
            // empty exactly when `computeAnnualSavingPercent` returned null.
            expect(src).toContain('{card.annualHintLabel && (');
        });

        it('computes both percentages, never writing one down', () => {
            expect(viewSrc).toContain('computeAnnualSavingPercent({ plan })');
            expect(viewSrc).toContain('resolveBestAnnualSavingPercent({');
            // A written-down percentage goes stale on the first price edit in
            // admin, and nothing would report it.
            expect(src).not.toMatch(/ahorr[áa]\s+(hasta\s+)?\d+\s*%/i);
            expect(viewSrc).not.toMatch(/ahorr[áa]\s+(hasta\s+)?\d+\s*%/i);
        });

        it('puts the catalogue-wide badge inside the "Anual" radio, not floating beside it', () => {
            // Inside the control, the percentage is part of that option's
            // accessible name; beside it, a screen reader announces a number
            // detached from what it applies to.
            const annualOption = src.match(/data-pricing-toggle="annual"[\s\S]*?<\/button>/);
            expect(annualOption?.[0]).toContain('pricing-toggle__badge');
            expect(annualOption?.[0]).toContain('{annualBadgeLabel}');
        });

        it('renders no badge at all when no tier has an annual discount', () => {
            expect(src).toContain('{annualBadgeLabel && (');
        });
    });

    describe('clicking a card selects it (adjustment 4)', () => {
        it('backs the state with a real radio instead of aria-pressed on a div', () => {
            // The card contains a button and a <summary>, so `role="button"` on
            // the card itself would be a nested-interactive violation — and
            // these pages ARE in the axe sweep. `aria-pressed` on a role-less
            // element is prohibited ARIA and would never be announced.
            expect(src).toContain('type="radio"');
            expect(src).toContain('data-pricing-select');
            expect(src).not.toMatch(/aria-pressed/);
            expect(src).not.toMatch(/class="pricing-card"[\s\S]{0,200}role="button"/);
            expect(src).not.toMatch(/class="pricing-card"[\s\S]{0,200}tabindex/i);
        });

        it('gives that radio an accessible name and a per-audience group', () => {
            expect(src).toContain('aria-label={card.selectAriaLabel}');
            expect(src).toContain('name={selectGroupName}');
            expect(src).toMatch(/const selectGroupName = `pricing-select-\$\{audience\}`;/);
        });

        it('paints the selection with no script, via :has(:checked)', () => {
            expect(src).toContain('.pricing-card:has(.pricing-card__select:checked)');
        });

        it('draws the focus ring on the card, since the radio itself is invisible', () => {
            expect(src).toContain('.pricing-card:has(.pricing-card__select:focus-visible)');
        });

        it('never hijacks a click that landed on a real control', () => {
            // The CTA, the "ver todo" disclosure and any link inside the card
            // must behave exactly as they did before selection existed.
            expect(src).toContain(
                'if (target?.closest(\'a, button, summary, input, label, [role="button"]\')) {'
            );
        });

        it('mirrors keyboard selection too, by listening for change', () => {
            // Arrow keys move within a radio group without producing a click.
            expect(src).toContain("input.addEventListener('change', syncFromInputs);");
        });

        it('respects prefers-reduced-motion without removing the state itself', () => {
            const reduced = src.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\t\}/);
            expect(reduced?.[0]).toContain('transition: none;');
            expect(reduced?.[0]).toContain('transform: none;');
            // The border and elevation still change — only the motion goes.
            expect(reduced?.[0]).not.toContain('border-color');
        });
    });

    describe('design tokens that do not exist resolve to nothing', () => {
        it('uses --border, never --core-border', () => {
            // `var(--core-border)` resolves to nothing and erases the border in
            // silence. Only `core-background`/`core-foreground`/`core-card`/
            // `core-muted-foreground` carry the `core-` prefix.
            for (const [name, text] of [
                ['component', src],
                ['item component', itemSrc]
            ] as const) {
                expect(text, name).not.toContain('--core-border');
            }
        });

        it('never uses --brand-primary as body text on a card', () => {
            // ~3.5:1 on a light card — below WCAG AA's 4.5:1 for normal text.
            // `--brand-primary-link` is the accessible step of the same hue.
            //
            // Two exceptions, neither a loophole, and each with the premise
            // that licenses it asserted immediately below:
            //
            // - `.pricing-card__name` — AA's LARGE-text threshold is 3:1, which
            //   ~3.5:1 clears. The next test proves the title really is large.
            // - `.pricing-card__watermark` — not text at all. A decorative glyph
            //   at 10% opacity, `aria-hidden`, painted BEHIND every child. The
            //   test after next proves all three.
            //
            // Every OTHER rule in either file is still forbidden the token:
            // add a third and this list stops matching.
            const offending = [
                ...src.matchAll(/([\w.\-[\]='"]+)\s*\{[^}]*color: var\(--brand-primary\)/g)
            ];

            expect(offending.map((match) => match[1]).sort()).toEqual([
                '.pricing-card__name',
                '.pricing-card__watermark'
            ]);
            expect(itemSrc).not.toMatch(/color: var\(--brand-primary\)/);
        });

        it('keeps the plan name large enough for the 3:1 exemption it relies on', () => {
            // The premise of the exception above, asserted rather than assumed:
            // AA large text is >= 24px, or >= 18.66px bold. Both facts have to
            // hold, and `--text-xl` has to be a FLAT 24px — a clamped step would
            // shrink on a phone and take the colour out of conformance with
            // nothing reporting it.
            const rule = src.match(/\.pricing-card__name \{([^}]*)\}/)?.[1] ?? '';

            expect(rule).toContain('font-size: var(--text-xl);');
            expect(rule).toContain('font-weight: 700;');
            // `semanticTypography`, not `fontSize`: the CSS custom property
            // `--text-xl` is generated from the semantic scale (24px). The raw
            // `fontSize.xl` is a different, smaller step (20px) and asserting on
            // it would measure a token the component does not use.
            expect(semanticTypography.xl).toBe('1.5rem');
            expect(semanticTypography.xl).not.toContain('clamp');
        });

        it('keeps the corner glyph decorative, faint and behind every child', () => {
            // The premise of the second exception above. All three conditions
            // matter and each fails differently: dropping `aria-hidden` makes a
            // screen reader announce "crown icon" before the plan name; raising
            // the opacity puts a visible shape under the copy; losing the
            // negative z-index paints it OVER the text.
            const rule = src.match(/\.pricing-card__watermark \{([^}]*)\}/)?.[1] ?? '';
            const opacity = Number(rule.match(/opacity: ([\d.]+);/)?.[1] ?? '1');

            expect(src).toContain('<span class="pricing-card__watermark" aria-hidden="true">');
            expect(rule).toContain('z-index: -1;');
            expect(rule).toContain('pointer-events: none;');
            expect(opacity).toBeLessThanOrEqual(0.12);
            // A negative z-index only stays inside the card if the card is a
            // stacking context; otherwise the glyph escapes behind the section.
            expect(src).toMatch(/\.pricing-card \{[^}]*isolation: isolate;/);
        });

        it('takes the glyph colour from the card, which duotone would ignore', () => {
            // `createPhosphorIcon` forwards `color` (default `currentColor`)
            // only on the non-duotone weights; under duotone the glyph paints
            // the icon package's own brand blue at full strength and the
            // opacity above stops being the thing that fades it.
            expect(src).toContain('<WatermarkIcon size={168} weight="fill" />');
        });

        it('cuts the glyph on the card edge instead of framing it', () => {
            expect(src).toMatch(/\.pricing-card \{[^}]*overflow: hidden;/);
            const rule = src.match(/\.pricing-card__watermark \{([^}]*)\}/)?.[1] ?? '';
            // Both offsets negative: the glyph has to leave the box on two
            // edges, or `overflow` has nothing to clip.
            expect(rule).toMatch(/inset-block-start: calc\(.*\* -1\);/);
            expect(rule).toMatch(/inset-inline-end: calc\(.*\* -1\);/);
        });

        it('caps the dark-theme glyph BELOW the light one, where headroom is smaller', () => {
            // This used to assert a LIFT, on the assumption that the same alpha
            // over a dark card reads as almost nothing. Measuring it for
            // HOS-943 showed the opposite on both counts, and the rule now
            // encodes the measurement:
            //
            // - The same alpha reads STRONGER over the dark card, so dark needs
            //   less of it to match the light theme's presence.
            // - The binding text token differs per theme. On light it is
            //   `--brand-primary-link`, which stays above 4.5:1 until ~0.125.
            //   On dark it is `--core-muted-foreground` on `.pricing-card__desc`
            //   — top of the card, no background of its own, directly under the
            //   glyph — which crosses BELOW 4.5:1 at ~0.086.
            //
            // So the dark value must exist, must be its own number (an override
            // equal to the base is dead CSS a reviewer would delete), and must
            // be the SMALLER of the two. Raising it to "match" the light theme
            // is the regression this test exists to catch.
            const light = Number(
                src
                    .match(/\.pricing-card__watermark \{([^}]*)\}/)?.[1]
                    ?.match(/opacity: ([\d.]+);/)?.[1] ?? '1'
            );
            const dark = Number(
                src
                    .match(
                        /:global\(\[data-theme='dark'\]\) \.pricing-card__watermark \{([^}]*)\}/
                    )?.[1]
                    ?.match(/opacity: ([\d.]+);/)?.[1] ?? '1'
            );

            expect(dark).toBeGreaterThan(0);
            expect(dark).not.toBe(light);
            expect(dark).toBeLessThan(light);
            // `--core-muted-foreground` on a dark card falls under AA past here.
            expect(dark).toBeLessThanOrEqual(0.085);
        });

        it('keeps the light glyph visible enough to be a watermark at all', () => {
            // The other half of the owner's complaint: the previous 0.06 was a
            // 1.07:1 tint on a white card, which he read as "casi no se ve".
            // The `<= 0.12` ceiling asserted above is the accessibility bound;
            // this is the floor that stops a future edit from quietly fading it
            // back out of existence while still passing every test above.
            const light = Number(
                src
                    .match(/\.pricing-card__watermark \{([^}]*)\}/)?.[1]
                    ?.match(/opacity: ([\d.]+);/)?.[1] ?? '1'
            );

            expect(light).toBeGreaterThanOrEqual(0.09);
        });

        it('resolves the glyph through the shared table, never inline in the template', () => {
            expect(src).toContain(
                "import { resolvePlanWatermarkIcon } from '@/components/billing/plan-watermark-icon';"
            );
            expect(src).toContain('resolvePlanWatermarkIcon({ slug: card.plan.slug })');
        });

        it('underlines the plan name with a masked stroke, not a border', () => {
            // A straight `border-bottom` / `text-decoration` is the thing this
            // replaces. And it is a MASK, not a `background-image`: an SVG used
            // as a background is a separate document, so its colour would have
            // to be baked into the data URI and dark mode would break silently.
            const rule = src.match(/\.pricing-card__name::after \{([^}]*)\}/)?.[1] ?? '';

            expect(rule).toContain('mask-image: url("data:image/svg+xml,');
            expect(rule).toContain('background-color: var(--brand-accent);');
            expect(rule).not.toContain('background-image:');
            expect(rule).toContain('pointer-events: none;');

            const nameRule = src.match(/\.pricing-card__name \{([^}]*)\}/)?.[1] ?? '';
            expect(nameRule).not.toMatch(/border-bottom:/);
            expect(nameRule).not.toMatch(/text-decoration:/);
            // It follows the NAME's width, not the card's.
            expect(nameRule).toContain('width: fit-content;');
        });

        it('ships the underline as a pseudo-element, so it is neither announced nor selectable', () => {
            // An inline <svg> would be a node in the tree; a ::after with
            // `content: ''` is not, and its content cannot be selected.
            const rule = src.match(/\.pricing-card__name::after \{([^}]*)\}/)?.[1] ?? '';

            expect(rule).toContain("content: '';");
            expect(src).not.toMatch(/<svg[^>]*pricing-card__name/);
        });
    });

    // -----------------------------------------------------------------------
    // Vertical rhythm — owner review: "hay demasiado espaciado entre título,
    // texto que le sigue, para quién es recomendado, precio, y lo que incluye"
    // -----------------------------------------------------------------------

    describe('one number spaces the card (owner review of the live pages)', () => {
        it('groups the name and the description into one block', () => {
            // Title and description are one unit. If either ever leaves the
            // wrapper it becomes a direct child again and silently claims a
            // shared subgrid row that the row list does not declare.
            const header = src.match(/<div class="pricing-card__header">([\s\S]*?)<\/div>/)?.[1];

            expect(header).toBeDefined();
            expect(header).toContain('class="pricing-card__name"');
            expect(header).toContain('class="pricing-card__desc"');
        });

        it('leaves no vertical margin on any block the card gap already spaces', () => {
            // The bug this replaces: six blocks each carrying their own
            // `margin-bottom`, stacked on top of the grid's 30px row gutter, and
            // no single rule from which the total was visible. A margin back on
            // any of them means two mechanisms are spacing the same edge again.
            for (const block of [
                'pricing-card__name',
                'pricing-card__desc',
                'pricing-card__audience',
                'pricing-card__price',
                'pricing-card__delta-heading',
                'pricing-card__body'
            ]) {
                const rule = src.match(new RegExp(`\\.${block} \\{([^}]*)\\}`))?.[1] ?? '';

                expect(rule, block).not.toMatch(/margin-bottom:/);
                expect(rule, block).not.toMatch(/margin: 0 0 var\(/);
            }
        });

        it('spaces the groups from a single declared rhythm', () => {
            expect(src).toContain('--pricing-card-rhythm: var(--space-4);');
            expect(src).toContain('gap: var(--pricing-card-rhythm);');
            // Inside a group the step is DERIVED from that same number, not a
            // second free value someone can drift.
            expect(src).toContain(
                '--pricing-card-rhythm-tight: calc(var(--pricing-card-rhythm) * 0.4);'
            );
        });

        it('stops the 30px card gutter from spacing the shared subgrid rows', () => {
            // A subgrid takes its parent's gutters in the subgridded axis, so
            // the space meant to sit BETWEEN cards was also sitting between
            // every block INSIDE one. Splitting the shorthand is the fix; a
            // plain `gap` back on the subgrid branch reinstates the bug.
            const branch = src.match(
                /@supports \(grid-template-rows: subgrid\) \{([\s\S]*?)\n\t\t\}\n\t\}/
            )?.[1];

            expect(branch).toBeDefined();
            expect(branch).toContain('column-gap: var(--space-card-gap);');
            expect(branch).toContain('row-gap: var(--pricing-card-rhythm);');
        });
    });

    // -----------------------------------------------------------------------
    // HOS-943 owner review — the card is one offer sitting on its own detail
    // -----------------------------------------------------------------------

    describe('the card splits into a centred offer half and a left-aligned detail half', () => {
        /** The body of one scoped rule, by selector, first occurrence. */
        const ruleFor = (selector: string): string =>
            src.match(new RegExp(`\\.${selector} \\{([^}]*)\\}`))?.[1] ?? '';

        it('centres every block above the divider', () => {
            // The header needs `align-items` and not only `text-align`: the plan
            // name is `width: fit-content` (its hand-drawn underline has to be
            // the width of the TEXT), so it is a narrow box inside that column
            // and `text-align` alone would centre the glyphs inside a box still
            // pinned to the left.
            const header = ruleFor('pricing-card__header');

            expect(header).toContain('align-items: center;');
            expect(header).toContain('text-align: center;');
            expect(ruleFor('pricing-card__audience')).toContain('text-align: center;');
            expect(ruleFor('pricing-card__price')).toContain('text-align: center;');
        });

        it('leaves the item list alone — a centred bulleted list has no rail to read down', () => {
            // Every line would start at a different x and the tick markers would
            // stop forming a column. The change of alignment IS the signal that
            // the card has two halves; extending it downwards erases it.
            for (const selector of [
                'pricing-card__delta-heading',
                'pricing-card__body',
                'pricing-card__items'
            ]) {
                expect(ruleFor(selector), selector).not.toContain('text-align: center');
            }
        });

        it('draws the rule as an <hr> carrying no semantics', () => {
            // `<hr>` maps to the `separator` role by default. Announcing a
            // separator right before a line that already reads "todo lo del plan
            // X, más:" is a landmark to step over for nothing.
            //
            // `role="presentation"` and not `aria-hidden="true"` on purpose:
            // the two make different claims and only one of them is true here.
            // `aria-hidden` says the element must be HIDDEN; `presentation` says
            // it carries no SEMANTICS, which is the actual situation. Nothing is
            // lost either way — an `<hr>` cannot contain text.
            expect(src).toContain('<hr class="pricing-card__divider" role="presentation" />');
            expect(src).not.toMatch(/<hr[^>]*aria-hidden/);
        });

        it('strips the UA rule’s own border and margin', () => {
            // The UA sheet gives `<hr>` a 3D inset border and a vertical margin.
            // The margin especially: the card's rhythm is ONE declared number,
            // and a UA margin stacked on top of it is the same invisible-total
            // bug the rhythm block was written to kill.
            const divider = ruleFor('pricing-card__divider');

            expect(divider).toContain('margin: 0;');
            expect(divider).toContain('border: 0;');
            expect(divider).toContain('border-block-start: 1px solid var(--border);');
        });
    });

    describe('the trial line is a pill, and it has no fill (HOS-943 adjustment 2)', () => {
        const trialRule = (): string => src.match(/\.pricing-card__trial \{([^}]*)\}/)?.[1] ?? '';

        it('renders as an enclosed chip rather than one more line of text', () => {
            // On a card that is otherwise five stacked lines of sans-serif text,
            // a sixth stacked line cannot stand out however it is coloured. The
            // pill separates by SHAPE first, which is also what makes it work
            // for a reader who cannot tell the two oranges apart.
            const rule = trialRule();

            expect(rule).toContain('border-radius: var(--radius-pill);');
            expect(rule).toContain('display: inline-flex;');
            expect(rule).toContain('font-weight: 700;');
            // A step up from the small step every other line on the card uses.
            expect(rule).toContain('font-size: var(--text-body);');
            expect(rule).not.toContain('font-size: var(--text-body-sm);');
        });

        it('carries NO background — the ink has no contrast headroom to spend', () => {
            // `--brand-accent-text` measures 4.53:1 over `--core-card` on the
            // light theme: three hundredths above the 4.5:1 floor, by design
            // (SPEC-308). Any background behind it, of any colour, at any alpha,
            // spends headroom that is not there — a 12% tint of the ink itself
            // drops it to 3.86:1 and even 4% drops it to 4.29:1. Dark passes
            // either way, which is exactly why this must be a guard: the
            // regression would only appear in one theme.
            const rule = trialRule();

            expect(rule).not.toContain('background');
            expect(rule).toContain('color: var(--brand-accent-text);');
            // The border tracks the ink instead of naming a token, so the promo
            // island's recolouring (`--promo`, `--ineligible`) stays coherent
            // instead of leaving a green label inside an orange outline.
            expect(rule).toMatch(/border: 2px solid color-mix\(in srgb, currentColor \d+%/);
        });

        it('keeps the trial element childless, because the island assigns textContent', () => {
            // `PlanPurchaseButton` sets `trialEl.textContent` in TWO places (the
            // trial-ineligible notice and the `trial_extension` promo), and
            // assigning `textContent` destroys every child node. An icon inside
            // this element would disappear the moment either fired, and the
            // cleanup path restores a saved STRING, so it could never come back.
            const markup = src.match(/<p class="pricing-card__trial">([\s\S]*?)<\/p>/)?.[1];

            expect(markup).toBeDefined();
            expect(markup).not.toMatch(/<[a-zA-Z]/);
        });
    });

    describe('the saving badge is green text, not green on green (HOS-943)', () => {
        const badgeRule = (): string => src.match(/\.pricing-toggle__badge \{([^}]*)\}/)?.[1] ?? '';

        // The ratios themselves are measured in
        // `packages/design-tokens/src/tokens/green-text-contrast.test.ts`, which
        // recomputes them from the theme records. This block only pins the
        // CONSUMER: which token the rule reaches for, and that it spends no
        // headroom on a fill. Neither half is sufficient alone — the token guard
        // cannot see that this rule uses the token, and this guard cannot see
        // whether the token still clears AA.

        it('takes the AA-safe green text step, never --success', () => {
            // `--success` is 3.46:1 on the toggle track and 4:1 on a white card:
            // it fails AA as normal-size text BARE, so no amount of adjusting
            // what sits behind it makes it usable here.
            const rule = badgeRule();

            expect(rule).toContain('color: var(--hospeda-forest-link);');
            expect(rule).not.toContain('--success');
        });

        it('carries NO background — the badge is 12px bold, so its floor is 4.5:1', () => {
            // It shipped as a 16% `--success` tint under `--success` ink and axe
            // measured 2.89:1 light / 4.13:1 dark. Even under the token that
            // replaced it, an 8% self-tint drops the light track to 4.37:1, so
            // there is no "small enough" fill to reintroduce.
            const rule = badgeRule();

            expect(rule).not.toContain('background');
            expect(rule).not.toContain('color-mix');
        });

        it('outlines with full currentColor, so the border clears 3:1 by itself', () => {
            // Tracking the ink rather than naming a token keeps the outline
            // coherent with whatever the text is. At full strength it inherits
            // the ink's 4.88:1 worst case; the trial pill's 60% alpha would
            // composite to 2.47:1 on the light track and fail WCAG 1.4.11.
            expect(badgeRule()).toContain('border: 1px solid currentColor;');
        });

        it('recolours the promo trial pill with the same green', () => {
            // Preexisting, not introduced here: `--success` measured 4:1 on a
            // light `--core-card`. Same token, same page, so the two greens
            // cannot drift apart.
            const rule = src.match(/\.pricing-card__trial--promo \{([^}]*)\}/)?.[1] ?? '';

            expect(rule).toContain('var(--hospeda-forest-link,');
            expect(rule).not.toContain('var(--success');
        });

        it('leaves the badge outside the card, so it consumes no subgrid row', () => {
            // The row-count invariant asserted far above counts DIRECT children
            // of `.pricing-card`. This badge lives in `.pricing-toggle-block`,
            // which is why restyling it cannot shift the cards — stated so that
            // a future move of the badge into the card has to confront the
            // row list rather than discover it.
            const toggleBlock = src.match(
                /<div class="pricing-toggle-block">([\s\S]*?)<\/div>\n\t\t<\/div>/
            );

            expect(toggleBlock?.[0]).toContain('pricing-toggle__badge');
            expect(toggleBlock?.[0]).not.toContain('pricing-card__');
        });
    });
});
