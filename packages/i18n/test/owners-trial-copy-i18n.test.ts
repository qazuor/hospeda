/**
 * @file owners-trial-copy-i18n.test.ts
 * @description Regression guard for BETA-185.
 *
 * Card-first (HOS-171) moved the trial onto the MercadoPago preapproval the
 * checkout creates, so the card is now collected on day 1. The owner/publish
 * trial copy must NOT promise "no card" anymore ("Sin tarjeta" / "No credit
 * card" / "Sem cartao"), or it contradicts the real flow the user hits at
 * checkout. This test pins the two trial-messaging keys in every locale so the
 * card-first-incompatible claim cannot be reintroduced.
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
 * Card-first-incompatible phrases: any of these appearing in a trial key means
 * the copy is promising a no-card trial that no longer exists.
 */
const FORBIDDEN_NO_CARD_PHRASES = ['sin tarjeta', 'no credit card', 'sem cartao', 'sem cartão'];

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

describe('owners trial copy is card-first compatible (BETA-185)', () => {
    for (const [locale, dict] of LOCALES) {
        for (const key of TRIAL_KEYS) {
            it(`${locale}: ${key} exists and is non-empty`, () => {
                const value = resolveKey(dict, key);
                expect(
                    typeof value === 'string' && value.length > 0,
                    `${locale}/host.json:${key}`
                ).toBe(true);
            });

            it(`${locale}: ${key} does not promise a no-card trial`, () => {
                const value = resolveKey(dict, key);
                const text = typeof value === 'string' ? value.toLowerCase() : '';
                const hit = FORBIDDEN_NO_CARD_PHRASES.find((phrase) => text.includes(phrase));
                expect(
                    hit,
                    `${locale}/host.json:${key} still promises "${hit}" — card-first (HOS-171) collects the card on day 1`
                ).toBeUndefined();
            });
        }
    }
});
