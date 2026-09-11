/**
 * @file owners-trial-copy-i18n.test.ts
 * @description Veracity guard for the owner/publish trial copy. Originally
 * BETA-185; INVERTED by HOS-1012.
 *
 * This guard used to forbid the phrase "sin tarjeta". Card-first (HOS-171) had
 * moved the trial onto the MercadoPago preapproval the checkout creates, so the
 * card WAS collected on day 1 and promising otherwise contradicted the flow.
 *
 * HOS-1012 reversed that: the trial is a local `billing_subscriptions` row with
 * `mp_subscription_id = NULL`, born when the host publishes their first listing.
 * No card is collected, and no checkout is involved. So "sin tarjeta" is now the
 * TRUE statement and the copy must make it.
 *
 * The guard is inverted rather than deleted, because the failure it protects
 * against is unchanged in kind: copy that describes a flow the product does not
 * run. It now asserts BOTH directions —
 *
 * - the copy must PROMISE the no-card trial (a positive assertion: silence is a
 *   regression, since a rewrite that quietly drops the promise sells the weaker
 *   product without anyone noticing), and
 * - it must NOT re-describe the card-first flow it replaced.
 *
 * A one-directional guard would have let the card-first sentences survive
 * untouched here as long as nobody re-added the banned phrase.
 */

import { describe, expect, it } from 'vitest';
import enHost from '../src/locales/en/host.json';
import esHost from '../src/locales/es/host.json';
import ptHost from '../src/locales/pt/host.json';

/**
 * Trial-messaging keys inside host.json, as paths WITHIN the file — the `host.`
 * the call sites use is the namespace (the file's basename), not part of the
 * path.
 *
 * These used to live in `owners.json`, which flattens to `owners.host.*` — a
 * key no `t('host.…')` call site could ever reach, so the strings this guard
 * validated were never rendered and the `en`/`pt` translations were inert
 * (HOS-331). Moved to the namespace the call sites actually request.
 */
const TRIAL_KEYS = ['landing.trialCallout', 'pages.nueva.trialNote'] as const;

/**
 * The no-card promise, per locale. At least one must appear in every trial key:
 * since HOS-1012 the trial genuinely takes no card, and that is the single most
 * load-bearing thing this copy can say.
 */
const REQUIRED_NO_CARD_PHRASES: Readonly<Record<string, readonly string[]>> = {
    es: ['sin tarjeta'],
    en: ['no card'],
    pt: ['sem cartão']
};

/**
 * Phrases that describe the card-first flow HOS-1012 removed. Any of these in a
 * trial key means the copy is narrating a checkout the host never reaches: the
 * trial starts at publish, with nothing collected and no plan chosen.
 */
const FORBIDDEN_CARD_FIRST_PHRASES = [
    'cargás tu tarjeta',
    'cargas tu tarjeta',
    'add your card',
    'cadastra seu cartão',
    'arranca cuando elegís tu plan',
    'starts when you pick your plan'
];

const LOCALES: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
    ['es', esHost as Record<string, unknown>],
    ['en', enHost as Record<string, unknown>],
    ['pt', ptHost as Record<string, unknown>]
];

/** Resolves a dot-notation key against a nested object. */
function resolveKey(obj: Record<string, unknown>, key: string): unknown {
    return key.split('.').reduce<unknown>((current, part) => {
        if (current && typeof current === 'object' && !Array.isArray(current)) {
            return (current as Record<string, unknown>)[part];
        }
        return undefined;
    }, obj);
}

/**
 * Every string form of a trial key: the bare leaf, or the CLDR `_one`/`_other`
 * pair it becomes once pluralised.
 *
 * Both halves are read, not just one. The forbidden-phrase check below used to
 * resolve a single value and coerce a miss to `''` — and `''` contains no
 * forbidden phrase, so that check passed happily on a key that had been
 * renamed out from under it. Returning every variant catches a no-card promise
 * hiding in `_other`, and lets an empty result fail instead of pass.
 */
function resolveTrialCopy(dict: Record<string, unknown>, key: string): readonly string[] {
    return [key, `${key}_one`, `${key}_other`]
        .map((candidate) => resolveKey(dict, candidate))
        .filter((value): value is string => typeof value === 'string' && value.length > 0);
}

describe('owners trial copy promises the no-card trial (HOS-1012, inverting BETA-185)', () => {
    for (const [locale, dict] of LOCALES) {
        for (const key of TRIAL_KEYS) {
            it(`${locale}: ${key} exists and is non-empty`, () => {
                const variants = resolveTrialCopy(dict, key);
                expect(
                    variants.length > 0,
                    `${locale}/host.json:${key} — neither the bare key nor a _one/_other pair resolves`
                ).toBe(true);
            });

            it(`${locale}: ${key} promises the no-card trial`, () => {
                const variants = resolveTrialCopy(dict, key);
                // Guard the instrument: with nothing to search, a phrase check
                // would be vacuously true in whichever direction it runs.
                expect(
                    variants.length,
                    `${locale}/host.json:${key} resolves to nothing`
                ).toBeGreaterThan(0);

                const required = REQUIRED_NO_CARD_PHRASES[locale] ?? [];
                for (const value of variants) {
                    const text = value.toLowerCase();
                    const promises = required.some((phrase) => text.includes(phrase));
                    expect(
                        promises,
                        `${locale}/host.json:${key} does not say ${required.join(' / ')} — since HOS-1012 the trial takes no card, and dropping that promise sells the weaker product`
                    ).toBe(true);
                }
            });

            it(`${locale}: ${key} does not describe the retired card-first flow`, () => {
                const variants = resolveTrialCopy(dict, key);
                expect(
                    variants.length,
                    `${locale}/host.json:${key} resolves to nothing`
                ).toBeGreaterThan(0);

                for (const value of variants) {
                    const text = value.toLowerCase();
                    const hit = FORBIDDEN_CARD_FIRST_PHRASES.find((phrase) =>
                        text.includes(phrase)
                    );
                    expect(
                        hit,
                        `${locale}/host.json:${key} still says "${hit}" — HOS-1012 starts the trial at publish, with no card and no plan chosen`
                    ).toBeUndefined();
                }
            });
        }
    }
});
