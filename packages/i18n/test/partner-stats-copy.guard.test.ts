/**
 * HOS-1063 AC-10 / §7.3 / G-2 — the copy of the partner statistics panel.
 *
 * Two things are asserted, and neither is about wording taste.
 *
 * 1. **The scope sentence exists in all three locales.** The partner read that
 *    exact sentence on `/presentacion/aliados/` BEFORE signing — it is the line
 *    that draws the platform/social boundary — and a panel that omits it invites
 *    precisely the question it was written to pre-empt: "and the Instagram
 *    numbers?". The i18n guards elsewhere in this repo check STRUCTURE, never
 *    content, so "the key exists" is not the same as "the promise is kept"; this
 *    file checks the content.
 *
 * 2. **The two subtrees stay separate and stay honest.**
 *    `account.partnerStats.*` and `account.partnerMentions.*` must not overlap
 *    (AC-8), and the mentions log must not acquire measurement vocabulary now
 *    that a measurement block sits beside it (NG-6, G-8, R-8). The log is
 *    *constancia*; the panel is *medición*, and the presentation sold those as
 *    different things.
 */

import { describe, expect, it } from 'vitest';
import enAccount from '../src/locales/en/account.json';
import esAccount from '../src/locales/es/account.json';
import ptAccount from '../src/locales/pt/account.json';

const LOCALES = {
    es: esAccount as Record<string, unknown>,
    en: enAccount as Record<string, unknown>,
    pt: ptAccount as Record<string, unknown>
};

const statsSubtree = (locale: keyof typeof LOCALES): Record<string, unknown> =>
    LOCALES[locale].partnerStats as Record<string, unknown>;

/** Every leaf string under a subtree, flattened. */
const leaves = (node: unknown): string[] => {
    if (typeof node === 'string') return [node];
    if (node && typeof node === 'object') {
        return Object.values(node as Record<string, unknown>).flatMap(leaves);
    }
    return [];
};

describe('HOS-1063 — the partner stats subtree exists in every locale', () => {
    it.each(['es', 'en', 'pt'] as const)('%s has the full card structure', (locale) => {
        const stats = statsSubtree(locale);
        expect(stats).toBeDefined();
        expect(stats.title).toBeTruthy();
        expect(stats.subtitle).toBeTruthy();
        expect(stats.scopeNote).toBeTruthy();
        expect(stats.window).toBeTruthy();

        const views = stats.views as Record<string, unknown>;
        expect(views.label).toBeTruthy();
        expect(views.help).toBeTruthy();
        // The not-applicable line is what replaces a numeral for a partner with
        // no page of their own (AC-9). Without it that branch renders empty and
        // the card reads as broken rather than as inapplicable.
        expect(views.notApplicable).toBeTruthy();

        const clicks = stats.clicks as Record<string, unknown>;
        expect(clicks.label).toBeTruthy();
        expect(clicks.help).toBeTruthy();
    });
});

describe('HOS-1063 AC-10 / §7.3 — the scope sentence keeps its promise', () => {
    /**
     * Asserted on MEANING, not on an exact string: the three locales say the
     * same thing in three languages, so an exact-match test could only ever
     * cover one of them. Each locale is checked for the two halves the sentence
     * must carry — "inside Hospeda" and "not a measurement of what is outside".
     */
    it('the Spanish note names Hospeda and refuses to promise measurement', () => {
        const note = statsSubtree('es').scopeNote as string;
        expect(note).toMatch(/dentro de Hospeda/i);
        expect(note).toMatch(/constancia, no medición/i);
    });

    it('the English note carries both halves', () => {
        const note = statsSubtree('en').scopeNote as string;
        expect(note).toMatch(/inside Hospeda/i);
        expect(note).toMatch(/a record, not a measurement/i);
    });

    it('the Portuguese note carries both halves', () => {
        const note = statsSubtree('pt').scopeNote as string;
        expect(note).toMatch(/dentro da Hospeda/i);
        expect(note).toMatch(/registro, n[ãa]o medi[çc][ãa]o/i);
    });
});

describe('HOS-1063 AC-8 / NG-6 — the two subtrees stay separate and honest', () => {
    it.each([
        'es',
        'en',
        'pt'
    ] as const)('%s keeps partnerStats and partnerMentions as disjoint subtrees', (locale) => {
        const stats = statsSubtree(locale);
        const mentions = LOCALES[locale].partnerMentions as Record<string, unknown>;

        expect(stats).toBeDefined();
        expect(mentions).toBeDefined();
        // Neither is nested inside the other — the structural half of AC-8.
        expect(Object.keys(stats)).not.toContain('partnerMentions');
        expect(Object.keys(mentions)).not.toContain('partnerStats');
    });

    /**
     * NG-6 / G-8 / R-8. The appearance log is a record of facts and must never
     * speak like a performance report — no reach, no impressions, no clicks —
     * and the moment a statistics block lands beside it is exactly when someone
     * proposes "while we are here, add the numbers to the log too".
     *
     * Deliberately scoped to the mentions subtree: the STATS subtree is allowed
     * to say "clics", because it has a real click number behind it.
     */
    it.each([
        'es',
        'en',
        'pt'
    ] as const)('%s keeps measurement vocabulary out of the mentions log', (locale) => {
        const mentionsCopy = leaves(LOCALES[locale].partnerMentions).join(' ').toLowerCase();

        for (const forbidden of [
            'alcance',
            'impresion',
            'impression',
            'reach',
            'estadística',
            'estatística',
            'statistic'
        ]) {
            expect(mentionsCopy).not.toContain(forbidden);
        }
    });
});
