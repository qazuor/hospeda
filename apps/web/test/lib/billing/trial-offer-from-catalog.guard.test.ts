/**
 * @file trial-offer-from-catalog.guard.test.ts
 * @description HOS-1967 static guard: nothing in `apps/web/src/lib/billing`
 * decides a trial offer per vertical by hand.
 *
 * The bug it freezes out: `resolvePlanCardTrialOffer` carried
 * `{ accommodation: false, venue: false, experience: false, tourist: true }`, so
 * the tourist pricing promised «30 días de prueba gratis» while the checkout
 * charged on the spot. Owner rule: every plan surface shows what the plan offers
 * by reading the database, never a hardcoded value.
 *
 * ## What it matches, and why not a function name
 *
 * It is anchored on the SHAPE of the mistake, not on a symbol, so renaming the
 * resolver or its type alias cannot escape it:
 * - an object entry whose key is a vertical or audience name (bare, quoted or
 *   `[VerticalEnum.X]`) and whose value is a boolean or number literal;
 * - a positive `trialDays` literal or a `hasTrial: true` literal;
 * - in `fetch-plans.ts`, any `.trialDays` read other than the API's
 *   `trialOffer?.trialDays` (the sellable version's own `trial_days` is not the
 *   offer).
 * Each detector is exercised against the escapes it must catch before it is
 * trusted on the real tree.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../../../src/lib/billing');

const VERTICAL_KEY_LITERAL =
    /(?:^|[\s{,(])(?:['"`]?(?:accommodation|venue|experience|tourist|owner|partner)['"`]?|\[\s*VerticalEnum\.[A-Z_]+\s*\])\s*:\s*(?:true|false|-?\d+(?:\.\d+)?)(?![\w.])/m;
const POSITIVE_TRIAL_LITERAL = /\b(?:trialDays\s*:\s*[1-9]\d*(?![\w.])|hasTrial\s*:\s*true\b)/;
const NON_OFFER_TRIAL_DAYS_READ = /(?<!trialOffer\?)\.trialDays\b/;

/** Source files under lib/billing, tests excluded. */
function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return sourceFiles(path);
        return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
    });
}

/** Strips line and block comments so a docblock quoting the old bug is not a hit. */
function code(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('HOS-1967 guard — the trial offer is read from the catalog', () => {
    it('each detector catches the escapes it exists for', () => {
        for (const snippet of [
            'const m = { accommodation: false, tourist: true };',
            "const m = { 'tourist': true };",
            'const m = {tourist:true};',
            'const m = { [VerticalEnum.TOURIST]: true };',
            'const m = {\n    venue: 30\n};'
        ]) {
            expect(VERTICAL_KEY_LITERAL.test(snippet), snippet).toBe(true);
        }
        for (const allowed of [
            "owner: 'accommodation',",
            "tourist: 'tourist-free'",
            'touristCount: 3',
            'limits: { reviews: 10 }'
        ]) {
            expect(VERTICAL_KEY_LITERAL.test(allowed), allowed).toBe(false);
        }
        expect(POSITIVE_TRIAL_LITERAL.test('trialDays: 30,')).toBe(true);
        expect(POSITIVE_TRIAL_LITERAL.test('hasTrial: true')).toBe(true);
        expect(POSITIVE_TRIAL_LITERAL.test('trialDays: 0,')).toBe(false);
        expect(NON_OFFER_TRIAL_DAYS_READ.test('trialDays: plan.trialDays,')).toBe(true);
        expect(NON_OFFER_TRIAL_DAYS_READ.test('trialDays: trialOffer?.trialDays ?? 0')).toBe(false);
    });

    it('no lib/billing source maps a vertical to a literal or hardcodes a trial', () => {
        const files = sourceFiles(ROOT);
        const names = files.map((file) => relative(ROOT, file));
        expect(names).toContain('pricing-situation.ts');
        expect(names).toContain('fetch-plans.ts');

        const offenders = files.flatMap((file) => {
            const source = code(readFileSync(file, 'utf8'));
            return [VERTICAL_KEY_LITERAL, POSITIVE_TRIAL_LITERAL]
                .filter((detector) => detector.test(source))
                .map((detector) => `${relative(ROOT, file)} matches ${detector.source}`);
        });
        expect(offenders).toEqual([]);
    });

    it('fetch-plans reads trial days only from the API trial offer', () => {
        const source = code(readFileSync(join(ROOT, 'fetch-plans.ts'), 'utf8'));
        expect(source).toContain('trialOffer?.trialDays');
        expect(NON_OFFER_TRIAL_DAYS_READ.test(source)).toBe(false);
    });
});
