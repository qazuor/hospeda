/**
 * @file TrialSummary.test.ts
 * @description TEST:V8a:7 (component level, HOS-1492, row 4): the accumulated
 * free-trial days per vertical and their origin in Mi Suscripción.
 *
 * Vitest cannot render `.astro` in this repo, so these assertions read the
 * SOURCE for the component's decisions (nothing for `NONE` or zero days, only
 * the origins above zero, the dates when both are known, no fetch, no island)
 * and the real locale files for the copy the row obliges.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(
    resolve(__dirname, '../../../src/components/account/TrialSummary.astro'),
    'utf8'
);

type Locale = 'es' | 'en' | 'pt';

interface TrialSummaryCopy {
    readonly title: string;
    readonly vertical: Record<'accommodation' | 'gastronomy' | 'experience', string>;
    readonly total_one: string;
    readonly total_other: string;
    readonly origins: Record<string, string>;
    readonly dates: string;
}

function readCopy(locale: Locale): TrialSummaryCopy {
    const json = JSON.parse(
        readFileSync(
            resolve(__dirname, `../../../../../packages/i18n/src/locales/${locale}/account.json`),
            'utf8'
        )
    ) as { subscription: { trialSummary: TrialSummaryCopy } };
    return json.subscription.trialSummary;
}

describe('TrialSummary.astro — row 4, the accumulated trial days', () => {
    it('TEST:V8a:7 — states the total and its origins with the row 4 wording', () => {
        const copy = readCopy('es');
        expect(copy.total_other).toBe('{{count}} días de prueba en total');
        expect(copy.origins.base_other).toBe('{{count}} del plan');
        expect(copy.origins.promo_other).toBe('{{count}} por promociones');
        expect(copy.origins.support_other).toBe('{{count}} regalados por soporte');
        expect(copy.dates).toBe('Del {{start}} al {{end}}');
        expect(SOURCE).toContain(
            "tPlural('account.subscription.trialSummary.total', summary.totalDays"
        );
    });

    it('TEST:V8a:7 — every locale carries every key with its placeholders', () => {
        for (const locale of ['es', 'en', 'pt'] as const) {
            const copy = readCopy(locale);
            expect(copy.title).toContain('{{vertical}}');
            expect(copy.total_one).toContain('{{count}}');
            expect(copy.total_other).toContain('{{count}}');
            for (const origin of ['base', 'promo', 'support']) {
                expect(copy.origins[`${origin}_one`]).toContain('{{count}}');
                expect(copy.origins[`${origin}_other`]).toContain('{{count}}');
            }
            expect(copy.dates).toContain('{{start}}');
            expect(copy.dates).toContain('{{end}}');
            expect(Object.keys(copy.vertical).sort()).toEqual([
                'accommodation',
                'experience',
                'gastronomy'
            ]);
        }
    });

    it('lists only the origins above zero, in base, promo, support order', () => {
        expect(SOURCE).toContain("['base', 'account.subscription.trialSummary.origins.base'],");
        expect(SOURCE).toContain("['promo', 'account.subscription.trialSummary.origins.promo'],");
        expect(SOURCE).toContain(
            "['support', 'account.subscription.trialSummary.origins.support']"
        );
        expect(SOURCE).toContain('ORIGIN_KEYS.filter(([origin]) => summary.origins[origin] > 0)');
    });

    it('renders nothing for NONE, for zero days, or without entries', () => {
        expect(SOURCE).toContain(
            "if (!('totalDays' in summary) || summary.totalDays <= 0) return [];"
        );
        expect(SOURCE).toContain('views.length > 0 && (');
    });

    it('states the start and end dates only when both are known', () => {
        expect(SOURCE).toContain('start && end');
        expect(SOURCE).toContain(
            "t('account.subscription.trialSummary.dates', undefined, { start, end })"
        );
        expect(SOURCE).toContain('{view.dates && <p class={styles.dates}>{view.dates}</p>}');
    });

    it('names the vertical through an exhaustive Record', () => {
        expect(SOURCE).toContain(
            'const VERTICAL_KEY: Readonly<Record<PublishVerticalSlug, string>> = {'
        );
        expect(SOURCE).not.toMatch(/vertical\s*===|as unknown as/);
    });

    it('does not fetch, ships no island and styles with its CSS module', () => {
        expect(SOURCE).not.toMatch(/fetch\(|publishApi/);
        expect(SOURCE).not.toMatch(/client:/);
        expect(SOURCE).toContain("import styles from './TrialSummary.module.css';");
        expect(SOURCE).not.toMatch(/class="[^"]*\b(?:flex|p-\d|text-sm|bg-)/);
    });
});
