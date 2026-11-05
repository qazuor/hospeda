/**
 * @file TrialSummary.test.ts
 * @description TEST:V8a:7 (component level, HOS-1492, row 4): the accumulated
 * free-trial days per vertical and their origin in Mi Suscripción.
 *
 * Source and locale copy contract assertions. Behavioural markup rendering is
 * covered in TrialSummary.render.test.ts.
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
    readonly endedTitle: string;
    readonly endedConverted: string;
    readonly endedExpired: string;
    readonly activePlanMessage: string;
    readonly endedPlanMessage: string;
    readonly choosePlan: string;
    readonly vertical: Record<'accommodation' | 'venue' | 'experience', string>;
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
            "tPlural('account.subscription.trialSummary.total', state.totalDays"
        );
    });

    it('TEST:1727:5 / TEST:V8a:7 — every locale carries every key with its placeholders', () => {
        const copies = (['es', 'en', 'pt'] as const).map(readCopy);
        for (const copy of copies) {
            expect(copy.title).toContain('{{vertical}}');
            expect(copy.endedTitle).toContain('{{vertical}}');
            expect(copy.endedConverted).toBeTruthy();
            expect(copy.endedExpired).toContain('{{end}}');
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
                'venue'
            ]);
        }
        expect(copies[1].endedTitle).toBe('Your free {{vertical}} trial has ended');
        expect(copies[1].endedConverted).toBe('Your trial ended and you now have your plan.');
        expect(copies[1].endedExpired).toBe('Your trial ended on {{end}}.');
        expect(copies[2].endedTitle).toBe('Seu teste grátis de {{vertical}} terminou');
        expect(copies[2].endedConverted).toBe('Seu teste terminou e agora você tem seu plano.');
        expect(copies[2].endedExpired).toBe('Seu teste terminou em {{end}}.');
        for (const copy of copies) {
            expect(copy.activePlanMessage).toBeTruthy();
            expect(copy.endedPlanMessage).toBeTruthy();
            expect(copy.choosePlan).toBeTruthy();
        }
    });

    it('lists only the origins above zero, in base, promo, support order', () => {
        expect(SOURCE).toContain("['base', 'account.subscription.trialSummary.origins.base'],");
        expect(SOURCE).toContain("['promo', 'account.subscription.trialSummary.origins.promo'],");
        expect(SOURCE).toContain(
            "['support', 'account.subscription.trialSummary.origins.support']"
        );
        expect(SOURCE).toContain('ORIGIN_KEYS.filter(([origin]) => state.origins[origin] > 0)');
    });

    it('renders nothing for NONE, for zero days, or without entries', () => {
        expect(SOURCE).toContain('resolveTrialSummaryView({');
        expect(SOURCE).toContain('views.length > 0 && (');
    });

    it('TEST:1727:6 — consumes the view resolver and marks running or ended cards', () => {
        expect(SOURCE).toContain('resolveTrialSummaryView({');
        expect(SOURCE).toContain('data-trial-state=');
        expect(SOURCE).toContain("state: 'running' as const");
        expect(SOURCE).toContain("state: 'ended' as const");
        expect(SOURCE).toContain('formatNoticeInstant({ iso: endInstant, locale })');
        expect(SOURCE).toContain("'account.subscription.trialSummary.endedExpired'");
        expect(SOURCE).not.toContain('summary.totalDays <= 0');
        expect(SOURCE).not.toMatch(/fetch\(|publishApi/);
        expect(SOURCE).not.toMatch(/client:/);
    });

    it('TEST:1772:5 — only claims the plan for a converted trial with a live subscription', () => {
        expect(SOURCE).toContain(
            'hasLiveSubscription: liveSubscriptionVerticals.includes(vertical)'
        );
        expect(SOURCE).toContain("state.kind === 'ended_converted'");
        expect(SOURCE).toContain(
            "const endInstant = state.kind === 'ended_converted' ? null : state.endsAt;"
        );
    });

    it('TEST:1772:6 — every locale states the end date without claiming a plan', () => {
        for (const locale of ['es', 'en', 'pt'] as const) {
            expect(readCopy(locale).endedExpired).toContain('{{end}}');
        }
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

    it('offers the localized pricing page and active trial copy for each visible vertical', () => {
        expect(SOURCE).toContain(
            'const PRICING_PATH_BY_VERTICAL: Record<PublishVerticalSlug, string> = {'
        );
        expect(SOURCE).toContain("accommodation: 'planes/anfitriones/precios'");
        expect(SOURCE).toContain("venue: 'planes/comer-y-salir/precios'");
        expect(SOURCE).toContain("experience: 'planes/experiencias/precios'");
        expect(SOURCE).toContain(
            'href: buildUrl({ locale, path: PRICING_PATH_BY_VERTICAL[vertical] })'
        );
        expect(SOURCE).toContain("'account.subscription.trialSummary.activePlanMessage'");
        expect(SOURCE).toContain("'account.subscription.trialSummary.choosePlan'");
        expect(SOURCE).toContain(
            '<a class={styles.planButton} href={view.plan.href}>{view.plan.label}</a>'
        );
        expect(SOURCE).toContain('{view.plan && (');
        expect(SOURCE).toContain(
            'hasLiveSubscription: liveSubscriptionVerticals.includes(vertical)'
        );
        expect(SOURCE).toContain("if (state.kind === 'hidden') return [];");
    });

    it('uses ended copy and the same localized pricing link for expired trials', () => {
        expect(SOURCE).toContain(
            "message: t('account.subscription.trialSummary.endedPlanMessage')"
        );
        expect(SOURCE).toContain(
            'href: buildUrl({ locale, path: PRICING_PATH_BY_VERTICAL[vertical] })'
        );
        const copy = readCopy('es');
        expect(copy.endedPlanMessage).toBe(
            'Tu prueba terminó. Elegí un plan para volver a publicar.'
        );
    });

    it('has English copy and builds English pricing URLs with the shared URL helper', () => {
        const copy = readCopy('en');
        expect(copy.choosePlan).toBe('Choose your plan');
        expect(SOURCE).toContain("import { buildUrl } from '@/lib/urls';");
        expect(SOURCE).toContain('buildUrl({ locale, path: PRICING_PATH_BY_VERTICAL[vertical] })');
    });

    it('does not fetch, ships no island and styles with its CSS module', () => {
        expect(SOURCE).not.toMatch(/fetch\(|publishApi/);
        expect(SOURCE).not.toMatch(/client:/);
        expect(SOURCE).toContain("import styles from './TrialSummary.module.css';");
        expect(SOURCE).not.toMatch(/class="[^"]*\b(?:flex|p-\d|text-sm|bg-)/);
    });
});
