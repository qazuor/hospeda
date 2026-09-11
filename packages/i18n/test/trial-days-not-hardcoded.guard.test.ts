/**
 * @file trial-days-not-hardcoded.guard.test.ts
 * @description HOS-941 R-2 — no locale string may state a trial length.
 *
 * ## What broke, and why it looked fine
 *
 * The two commerce landings promised their free trial with the number written
 * out: `commerce.landing.gastronomy.price.trial` read literally
 * "30 días de prueba gratis", `…faq.a1` repeated the same 30 inside a sentence,
 * and the experience vertical carried both again — twelve strings across two
 * verticals and three locales, none of which anything compared against
 * `billing_plans.metadata.trialDays`.
 *
 * The database says 30 today, so all twelve happened to be TRUE. That is the
 * dangerous shape of this bug, not a mitigating one: the page looked correct,
 * every test was green, and the copy was right only by coincidence. The first
 * time an operator edits the plan in admin, the landings promise a trial the
 * checkout will not grant, and nothing anywhere fails.
 *
 * It has already happened once. HOS-525: marketing promised hosts 30 days while
 * the product handed them 14.
 *
 * ## Why the whole file, and not a list of keys
 *
 * The sibling assertion this one generalises (`hardcodes no trial day count in
 * the new plan-card copy`, in
 * `apps/web/test/components/billing/pricing-card-catalogue.guard.test.ts`)
 * sweeps two named subtrees of `pricing.json`. Naming a subtree — or worse, a
 * key — makes the guard die at the next rename, and a guard that quietly stops
 * guarding is indistinguishable from a passing one.
 *
 * So the anchor here is the INEVITABLE token: a digit sitting next to a day
 * unit, in any of the three languages the repo ships. Whatever the key is
 * called, whatever subtree it moves to, whoever adds it next year, a number of
 * days cannot be written in these two files without saying "N días" / "N days" /
 * "N dias". Both files are entirely free of such a string today, which is what
 * makes a whole-file sweep viable rather than merely desirable.
 *
 * ## Scope: these two files only
 *
 * Not repo-wide, deliberately. Other locale files carry day counts that are
 * genuinely fixed and belong in the copy — `account.json`'s 7/30-day visibility
 * boost addon names, `common.json`'s `window.7d`, the 16-day weather forecast,
 * the 30-day data-deletion window in the FAQ. A repo-wide version of this rule
 * would fail on all of them, and the pressure to add an exemption list is
 * exactly how a guard turns into a fail-open one. `pricing.json` and
 * `commerce.json` are the two files that describe what a subscription costs and
 * grants, and in those a number of days is always a claim about the catalogue.
 *
 * Widening the scope, or excusing a string inside it, is meant to be a
 * deliberate edit of this file. There is no ignore comment on purpose.
 *
 * ## What this does NOT prove
 *
 * - A trial length spelled out in words ("treinta días") passes. The check is
 *   about digits.
 * - It says nothing about the RENDERED page. A page that interpolates a
 *   hardcoded `30` into a `{{count}}` placeholder satisfies every assertion
 *   here; that is held by the page guards and by the unit tests over
 *   `resolveCommerceLandingOffer`.
 * - It says nothing about the database. Whether `trialDays` is 30 or 14 is not
 *   a source-level fact.
 *
 * @module test/trial-days-not-hardcoded.guard
 */

import { describe, expect, it } from 'vitest';

import commerceEn from '../src/locales/en/commerce.json';
import pricingEn from '../src/locales/en/pricing.json';
import commerceEs from '../src/locales/es/commerce.json';
import pricingEs from '../src/locales/es/pricing.json';
import commercePt from '../src/locales/pt/commerce.json';
import pricingPt from '../src/locales/pt/pricing.json';

/** The catalogue-describing locale files, per locale. */
const GUARDED_FILES: ReadonlyArray<{
    readonly label: string;
    readonly dict: Record<string, unknown>;
}> = [
    { label: 'es/commerce.json', dict: commerceEs as Record<string, unknown> },
    { label: 'en/commerce.json', dict: commerceEn as Record<string, unknown> },
    { label: 'pt/commerce.json', dict: commercePt as Record<string, unknown> },
    { label: 'es/pricing.json', dict: pricingEs as Record<string, unknown> },
    { label: 'en/pricing.json', dict: pricingEn as Record<string, unknown> },
    { label: 'pt/pricing.json', dict: pricingPt as Record<string, unknown> }
];

/**
 * A digit adjacent to a day unit, in either order, in es / en / pt.
 *
 * Both orders are matched because "30 días" and "día 30" are the same claim
 * written two ways, and the hyphenated English attributive ("30-day trial") is
 * the form the `en` copy actually used before this fix.
 */
const LITERAL_DAY_COUNT: ReadonlyArray<RegExp> = [
    /\b\d+[\s-]*(d[ií]as?|days?)\b/i,
    /\b(d[ií]as?|days?)[\s-]*\d+\b/i
];

/** Every string in a locale tree, paired with its dot path. */
function collectStrings(
    node: unknown,
    path = ''
): ReadonlyArray<{ readonly path: string; readonly text: string }> {
    if (typeof node === 'string') {
        return [{ path, text: node }];
    }
    if (typeof node !== 'object' || node === null) {
        return [];
    }
    return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
        collectStrings(value, path === '' ? key : `${path}.${key}`)
    );
}

/** Resolve a dot path against a nested locale object. */
function at(dict: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((current, part) => {
        if (current && typeof current === 'object' && !Array.isArray(current)) {
            return (current as Record<string, unknown>)[part];
        }
        return undefined;
    }, dict);
}

describe('HOS-941 R-2 — no locale string states a trial length', () => {
    for (const { label, dict } of GUARDED_FILES) {
        it(`${label} contains no literal day count`, () => {
            const strings = collectStrings(dict);

            // Guard the instrument: an empty sweep would report "no literal day
            // count" about nothing at all.
            expect(
                strings.length,
                `${label} produced no strings — the sweep is blind`
            ).toBeGreaterThan(50);

            const offenders = strings.filter(({ text }) =>
                LITERAL_DAY_COUNT.some((pattern) => pattern.test(text))
            );

            expect(
                offenders.map(({ path, text }) => `${label}:${path} — "${text}"`),
                `A number of days written into ${label} is a claim about billing_plans.metadata.trialDays that nothing verifies. Interpolate it from the plan with tPlural (see lib/billing/commerce-landing-plan.ts), or, if the number genuinely is not a catalogue value, move the string to a locale file this guard does not cover.`
            ).toEqual([]);
        });
    }
});

/** The two commerce verticals whose landings advertise a trial. */
const COMMERCE_VERTICALS = ['gastronomy', 'experience'] as const;

/** The commerce locale files, per locale. */
const COMMERCE_FILES: ReadonlyArray<{
    readonly label: string;
    readonly dict: Record<string, unknown>;
}> = [
    { label: 'es/commerce.json', dict: commerceEs as Record<string, unknown> },
    { label: 'en/commerce.json', dict: commerceEn as Record<string, unknown> },
    { label: 'pt/commerce.json', dict: commercePt as Record<string, unknown> }
];

describe('HOS-941 R-2 — the commerce landings interpolate the trial length', () => {
    // The rule above is satisfied by DELETING the promise. These assertions are
    // the other half: the copy still exists, and it is still shaped to receive a
    // number from the plan.
    for (const { label, dict } of COMMERCE_FILES) {
        for (const vertical of COMMERCE_VERTICALS) {
            for (const key of [`landing.${vertical}.price.trial`, `landing.${vertical}.faq.a1`]) {
                for (const plural of ['one', 'other'] as const) {
                    it(`${label}:${key}_${plural} interpolates {{count}}`, () => {
                        const value = at(dict, `${key}_${plural}`);
                        expect(typeof value, `${label}:${key}_${plural} does not resolve`).toBe(
                            'string'
                        );
                        expect(
                            value as string,
                            `${label}:${key}_${plural} must carry {{count}} — a trial sentence with no placeholder either lost the number or hardcoded it`
                        ).toContain('{{count}}');
                    });
                }
            }

            it(`${label}:landing.${vertical}.faq.a1NoTrial stands on its own`, () => {
                // The trial clause sits mid-sentence, so a plan with no trial
                // needs a separately written answer rather than a mechanical
                // splice. It must also not mention a trial: that is the whole
                // point of the variant.
                const value = at(dict, `landing.${vertical}.faq.a1NoTrial`);
                expect(
                    typeof value,
                    `${label}:landing.${vertical}.faq.a1NoTrial does not resolve — the page renders it whenever the plan offers no trial, or the fetch failed`
                ).toBe('string');

                const text = (value as string).toLowerCase();
                expect((value as string).length).toBeGreaterThan(20);
                expect(text).not.toContain('{{count}}');
                for (const word of ['prueba', 'trial', 'teste']) {
                    expect(
                        text,
                        `${label}:landing.${vertical}.faq.a1NoTrial mentions "${word}" — it is the answer shown when there is NO trial`
                    ).not.toContain(word);
                }
            });
        }
    }
});
