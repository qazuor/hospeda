/**
 * @file PricingCardsGrid.tourist-trial.test.ts
 * @description TEST:V8a:7 (component level, HOS-1492, row 1): on the tourist
 * pricing, a plan that grants a trial warns that starting consumes the free
 * trial, which is once in a lifetime. A plan without a trial says nothing, and
 * no other audience carries the note.
 *
 * The tourist pricing renders "Planes no disponibles" until HOS-1621, so this
 * row is proven at component level (H10/H12), not by e2e. Vitest cannot render
 * `.astro` here, so the card's gate is read from the source and evaluated
 * against a tourist plan with a trial and one without — the same predicate the
 * card's trial line uses, read by data, never by a list of plans.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/billing/PricingCardsGrid.astro'),
    'utf8'
);

function readNote(locale: 'es' | 'en' | 'pt'): string {
    const json = JSON.parse(
        readFileSync(
            resolve(__dirname, `../../../../../packages/i18n/src/locales/${locale}/pricing.json`),
            'utf8'
        )
    ) as { startConsumesTrialNote: string };
    return json.startConsumesTrialNote;
}

/** The note's gate exactly as the card writes it. */
const NOTE_GATE =
    'showsTrialConsumesNote && card.plan.hasTrial && card.plan.trialDays > 0 && (\n\t\t\t\t\t\t\t<p class="pricing-card__trial-note">{trialConsumesNote}</p>';

/** Evaluates the card's gate for one plan, mirroring {@link NOTE_GATE}. */
function cardShowsNote(params: {
    readonly showsTrialConsumesNote: boolean;
    readonly plan: { readonly hasTrial: boolean; readonly trialDays: number };
}): boolean {
    const { showsTrialConsumesNote, plan } = params;
    return showsTrialConsumesNote && plan.hasTrial && plan.trialDays > 0;
}

describe('PricingCardsGrid — row 1, the tourist trial is consumed on start (HOS-1492)', () => {
    it('TEST:V8a:7 — the note states the row 1 copy in every locale', () => {
        expect(readNote('es')).toBe(
            'Empezar consume tu prueba gratis, y la prueba es una sola vez en la vida.'
        );
        expect(readNote('en')).toMatch(/trial/i);
        expect(readNote('pt')).toMatch(/teste/i);
        expect(src).toContain("const trialConsumesNote = t('pricing.startConsumesTrialNote');");
    });

    it('TEST:V8a:7 — the card renders the note behind the plan-data gate, next to the trial line', () => {
        expect(src).toContain(NOTE_GATE);
        const trialLine = src.indexOf('<p class="pricing-card__trial">');
        const note = src.indexOf('<p class="pricing-card__trial-note">');
        expect(trialLine).toBeGreaterThan(-1);
        expect(note).toBeGreaterThan(trialLine);
        expect(src.indexOf('<hr class="pricing-card__divider"')).toBeGreaterThan(note);
    });

    it('TEST:V8a:7 — a tourist plan with a trial shows it; one without does not', () => {
        const tourist = { showsTrialConsumesNote: true };
        expect(cardShowsNote({ ...tourist, plan: { hasTrial: true, trialDays: 14 } })).toBe(true);
        expect(cardShowsNote({ ...tourist, plan: { hasTrial: false, trialDays: 0 } })).toBe(false);
        expect(cardShowsNote({ ...tourist, plan: { hasTrial: true, trialDays: 0 } })).toBe(false);
        expect(cardShowsNote({ ...tourist, plan: { hasTrial: false, trialDays: 14 } })).toBe(false);
    });

    it('only the tourist audience carries the note, through an exhaustive record', () => {
        expect(src).toMatch(
            /TRIAL_CONSUMES_NOTE_BY_AUDIENCE: Readonly<Record<PricingAudience, boolean>> = \{\s*tourist: true,\s*owner: false,\s*gastronomy: false,\s*experience: false,\s*partner: false\s*\};/
        );
        expect(src).toContain(
            'const showsTrialConsumesNote = TRIAL_CONSUMES_NOTE_BY_AUDIENCE[audience];'
        );
        expect(src).not.toMatch(/audience\s*===\s*'tourist'/);
    });

    it('decides by plan data, never by a list of plan slugs', () => {
        const gateRegion = src.slice(
            src.indexOf('TRIAL_CONSUMES_NOTE_BY_AUDIENCE'),
            src.indexOf("const trialConsumesNote = t('pricing.startConsumesTrialNote');")
        );
        expect(gateRegion).not.toMatch(/slug|tourist-(?:free|plus|vip)|\.includes\(/);
    });

    it('leaves the subscribe island untouched', () => {
        expect(src).toContain(
            '<SubscribeButton client:idle locale={locale} vertical={subscribeVertical} />'
        );
    });
});
