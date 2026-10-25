/**
 * @module test/components/billing/plan-description-upcoming-parity
 * @description HOS-1766 item 15. `billing.plan.<slug>.description` (the plan
 * card copy) promised "branding personalizado" while the comparison table marks
 * that row `upcoming`. A card must not sell a capability the table says is not
 * live yet: wherever a plan description names an `upcoming` row, the mention has
 * to carry the locale's "coming soon" marker right after it.
 *
 * The mention phrases are listed per locale on purpose: card copy is prose and
 * does not always reuse the row label (pt says "identidade visual personalizada",
 * the row says "Branding personalizado"). A NEW upcoming row with no entry in
 * `MENTIONS` fails the coverage test, so the author has to decide, per locale,
 * which phrase (if any) the cards use for it.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    EXPERIENCE_GROUPS,
    GASTRONOMY_GROUPS,
    OWNER_GROUPS,
    TOURIST_GROUPS
} from '../../../src/components/billing/plan-comparison-rows';

const LOCALES_DIR = resolve(__dirname, '../../../../../packages/i18n/src/locales');
const LOCALES = ['es', 'en', 'pt'] as const;
type Locale = (typeof LOCALES)[number];

interface BillingLocale {
    readonly plan: Readonly<Record<string, { readonly description: string }>>;
    readonly comparison: {
        readonly upcoming: string;
        readonly row: Readonly<Record<string, string>>;
    };
}

const billing = Object.fromEntries(
    LOCALES.map((l) => [
        l,
        JSON.parse(readFileSync(resolve(LOCALES_DIR, l, 'billing.json'), 'utf8')) as BillingLocale
    ])
) as Record<Locale, BillingLocale>;

/** Every row id the comparison tables mark `upcoming`, across all audiences. */
const UPCOMING_ROW_IDS = [
    ...new Set(
        [...TOURIST_GROUPS, ...OWNER_GROUPS, ...GASTRONOMY_GROUPS, ...EXPERIENCE_GROUPS]
            .flatMap((group) => group.rows)
            .filter((row) => row.status === 'upcoming')
            .map((row) => row.id)
    )
].sort();

/**
 * Phrases the plan cards use for each upcoming row, per locale. An empty list
 * means no card copy mentions the row today (verified against all plan
 * descriptions when this guard was written).
 */
const MENTIONS: Readonly<Record<string, Readonly<Record<Locale, readonly string[]>>>> = {
    aiSupport: { es: [], en: [], pt: [] },
    alertsOffers: { es: [], en: [], pt: [] },
    branding: {
        es: ['branding personalizado'],
        en: ['custom branding'],
        pt: ['identidade visual personalizada']
    },
    prioritySupport: { es: [], en: [], pt: [] },
    respondReviews: { es: [], en: [], pt: [] }
};

describe('plan card copy vs upcoming comparison rows', () => {
    it('has a mention entry for every upcoming row (and no stale ones)', () => {
        expect(Object.keys(MENTIONS).sort()).toEqual(UPCOMING_ROW_IDS);
    });

    describe.each(LOCALES)('%s', (locale) => {
        const { plan, comparison } = billing[locale];
        const marker = `(${comparison.upcoming.toLowerCase()})`;

        it.each(
            UPCOMING_ROW_IDS
        )('row "%s": every mention in a card carries the marker', (rowId) => {
            // Arrange
            const phrases = MENTIONS[rowId]?.[locale] ?? [];

            for (const [slug, { description }] of Object.entries(plan)) {
                for (const phrase of phrases) {
                    const at = description.toLowerCase().indexOf(phrase.toLowerCase());
                    if (at === -1) continue;

                    // Act
                    const after = description.slice(at + phrase.length).toLowerCase();

                    // Assert
                    expect(after.startsWith(` ${marker}`), `${slug}: "${phrase}"`).toBe(true);
                }
            }
        });

        it('the upcoming mentions are actually present in the premium card (premise)', () => {
            // Guards the guard: if the phrase list drifts from the copy, the
            // loop above would pass vacuously by never finding a mention.
            const description = plan['owner-premium']?.description.toLowerCase() ?? '';
            const [phrase] = MENTIONS.branding?.[locale] ?? [];

            expect(phrase && description.includes(phrase.toLowerCase())).toBe(true);
        });

        it('only sells a row that is NOT upcoming without a marker (verification badge stays live)', () => {
            // The badge row is `available`, so its mention must NOT be flagged.
            const row = [...OWNER_GROUPS]
                .flatMap((g) => g.rows)
                .find((r) => r.id === 'verificationBadge');
            expect(row?.status).toBe('available');
        });
    });
});
