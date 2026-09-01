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
            // an eighth block without an eighth row silently shifts every card
            // that renders it relative to the others.
            const blocks = [
                'pricing-card__name',
                'pricing-card__desc',
                'pricing-card__audience"',
                'pricing-card__price"',
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
            // ~3.5:1 on a light card — below WCAG AA. `--brand-primary-link` is
            // the accessible step of the same hue.
            expect(src).not.toMatch(/color: var\(--brand-primary\)/);
            expect(itemSrc).not.toMatch(/color: var\(--brand-primary\)/);
        });
    });
});
