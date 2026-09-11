/**
 * @file commerce-entitlement-label-coverage.test.ts
 * @description The mirror of `entitlement-label-coverage.test.ts`, for the
 * OTHER surface that renders an entitlement key to a buyer (HOS-1178).
 *
 * ## Why a second guard, when one already exists
 *
 * `entitlement-label-coverage.test.ts` audits `billing.entitlement.<key>` —
 * the label `getEntitlementName()` resolves for the pricing tables. It cannot
 * see this surface at all: `CommercePlanPicker.client.tsx` renders a tier's
 * "what this adds" list through a DIFFERENT dictionary
 * (`commerce.owner.entitlements.*`) reached through a DIFFERENT map
 * (`COMMERCE_ENTITLEMENT_I18N_SUFFIX`), and falls back through a third
 * (`COMMERCE_ENTITLEMENT_FALLBACK_LABEL`). A key can be perfectly labelled for
 * the first and raw for the second.
 *
 * That is not hypothetical. HOS-1060 granted
 * `manage_experience_private_galleries` to `experience-premium` and added no
 * entry here; the first guard caught the missing `billing.entitlement` label
 * and CI went red, so it was found. Nothing caught the second, and the picker
 * would have rendered a bullet reading, literally,
 * `manage_experience_private_galleries` — in all three languages, on the
 * screen a provider buys from.
 *
 * `entitlement-labels.ts` had already written the warning: an unlabeled key
 * "falls back to its raw snake_case string, and the fallback firing in
 * production is not something anyone would notice before a customer does".
 * The warning was written and then walked into. This guard is the difference
 * between a note and a defense.
 *
 * ## What it proves
 *
 * For every entitlement key the picker can actually render — computed by
 * feeding the real catalogue to `deriveCommercePlanTierDiffs`, the very
 * function the picker calls, rather than by re-deriving "what a tier adds" —
 * BOTH label maps have an entry, AND `commerce.owner.entitlements.<suffix>`
 * resolves in es, en and pt.
 *
 * ## What it does NOT prove
 *
 * - It does not check the copy is good, or that the three locales say the same
 *   thing. `check-locales` covers structural parity; nothing checks meaning.
 * - It only covers keys reachable through a TIER DIFF. A key granted uniformly
 *   across a vertical never reaches this list (the diff is empty for it), so it
 *   is deliberately out of scope here — `billing.entitlement.<key>` is where
 *   those get their label.
 * - It reads the locale JSON from disk rather than through `t()`, so it proves
 *   the string EXISTS, not that the runtime resolves it. That is the same
 *   trade-off its sibling makes.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ALL_EXPERIENCE_PLANS, ALL_GASTRONOMY_PLANS } from '@repo/billing';
import { describe, expect, it } from 'vitest';
import {
    COMMERCE_ENTITLEMENT_FALLBACK_LABEL,
    COMMERCE_ENTITLEMENT_I18N_SUFFIX
} from '../commerce/entitlement-labels';
import { type CommercePlanOption, deriveCommercePlanTierDiffs } from '../commerce/plan-options';

const LOCALES = ['es', 'en', 'pt'] as const;
type Locale = (typeof LOCALES)[number];

const LOCALES_DIR = resolve(__dirname, '../../../../../packages/i18n/src/locales');

/**
 * Every entitlement key the tier picker can put on screen.
 *
 * Built by running the catalogue through `deriveCommercePlanTierDiffs` — the
 * same function `CommercePlanPicker` calls — so the guard's scope tracks the
 * picker's behaviour instead of restating it. A new `extraEntitlements` entry
 * on any commerce tier enters this set with no edit here.
 */
function renderableEntitlementKeys(): readonly string[] {
    const keys = new Set<string>();

    for (const catalogue of [ALL_GASTRONOMY_PLANS, ALL_EXPERIENCE_PLANS]) {
        const options: CommercePlanOption[] = catalogue.map((plan) => ({
            slug: plan.slug,
            name: plan.name,
            monthlyPriceArs: plan.monthlyPriceArs,
            entitlements: plan.entitlements as readonly string[],
            sortOrder: plan.sortOrder
        }));

        for (const diff of deriveCommercePlanTierDiffs(options)) {
            for (const key of diff.addedEntitlements) {
                keys.add(key);
            }
        }
    }

    return [...keys].sort();
}

function readCommerceEntitlementLabels(locale: Locale): Record<string, string> {
    const raw = readFileSync(resolve(LOCALES_DIR, locale, 'commerce.json'), 'utf8');
    const parsed = JSON.parse(raw) as {
        owner?: { entitlements?: Record<string, string> };
    };
    return parsed.owner?.entitlements ?? {};
}

describe('HOS-1178 — every entitlement the tier picker can render has a label', () => {
    it('reads a non-empty renderable set and non-empty dictionaries', () => {
        // A silent empty read looks exactly like "nothing missing", so the
        // instrument is checked before anything it reports is believed. This
        // is the assertion that would have failed if the catalogue import, the
        // diff call or the locale path had quietly returned nothing.
        expect(renderableEntitlementKeys().length).toBeGreaterThan(3);
        expect(Object.keys(COMMERCE_ENTITLEMENT_I18N_SUFFIX).length).toBeGreaterThan(3);
        for (const locale of LOCALES) {
            expect(Object.keys(readCommerceEntitlementLabels(locale)).length).toBeGreaterThan(3);
        }
    });

    it('maps every renderable key to an i18n suffix AND a fallback label', () => {
        const renderable = renderableEntitlementKeys();

        const missingSuffix = renderable.filter(
            (key) => !(key in COMMERCE_ENTITLEMENT_I18N_SUFFIX)
        );
        const missingFallback = renderable.filter(
            (key) => !(key in COMMERCE_ENTITLEMENT_FALLBACK_LABEL)
        );

        // Both maps, separately: `CommercePlanPicker` reads the suffix for the
        // i18n key and the fallback for `t()`'s second argument, so a key
        // present in one and absent from the other STILL renders raw whenever
        // the other one is the branch taken.
        expect(
            missingSuffix,
            'These entitlement keys can appear in a commerce tier diff but have no ' +
                'COMMERCE_ENTITLEMENT_I18N_SUFFIX entry, so CommercePlanPicker builds ' +
                `the i18n key from the raw snake_case value:\n${missingSuffix.join('\n')}\n` +
                'Add them to apps/web/src/lib/commerce/entitlement-labels.ts.'
        ).toEqual([]);

        expect(
            missingFallback,
            'These entitlement keys can appear in a commerce tier diff but have no ' +
                'COMMERCE_ENTITLEMENT_FALLBACK_LABEL entry, so a missing translation ' +
                `renders the raw snake_case key to the buyer:\n${missingFallback.join('\n')}\n` +
                'Add them to apps/web/src/lib/commerce/entitlement-labels.ts.'
        ).toEqual([]);
    });

    it.each(
        LOCALES
    )('resolves commerce.owner.entitlements.<suffix> for every renderable key (%s)', (locale) => {
        const labels = readCommerceEntitlementLabels(locale);
        const missing = renderableEntitlementKeys()
            .map((key) => ({ key, suffix: COMMERCE_ENTITLEMENT_I18N_SUFFIX[key] }))
            // A key with no suffix is already reported by the test above;
            // reporting it twice would bury the locale gap under it.
            .filter(({ suffix }) => suffix !== undefined && !(suffix in labels))
            .map(({ key, suffix }) => `${key} -> commerce.owner.entitlements.${suffix}`);

        expect(
            missing,
            'These entitlement keys have a suffix but no string under ' +
                `"owner.entitlements" in locales/${locale}/commerce.json, so the ` +
                'picker silently serves the Spanish fallback in every language ' +
                `(HOS-1178):\n${missing.join('\n')}`
        ).toEqual([]);
    });
});
