/**
 * @description The web reads a plan card's name and description from
 * `billing.plan.<slug>.{name,description}` and falls back SILENTLY to the
 * catalog's own `name`/`description` when the key is missing
 * (`apps/web/src/lib/billing/plan-name.ts`, `apps/web/src/lib/billing-i18n.ts`).
 * A slug renamed in the catalog but not in the locale (HOS-1819 renamed the three
 * venue plan slugs) therefore raises no error anywhere: `check:i18n-keys` only sees
 * static keys, and the page renders the catalog title instead of the copy.
 *
 * This guard pins the two sets together: every sold plan (no role) has copy in
 * every locale, and no locale keeps copy for a slug the catalog no longer has.
 * The orphan check is against every catalog slug, plus the card slugs the web
 * synthesizes for a free tier that is not a catalog plan.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRODUCTION_PLAN_CATALOG } from '../production-catalog/catalog.js';

const LOCALES_DIR = resolve(__dirname, '../../packages/i18n/src/locales');
const LOCALES = ['es', 'en', 'pt'] as const;

interface BillingPlanCopy {
    readonly plan: Readonly<
        Record<string, { readonly name?: string; readonly description?: string }>
    >;
}

function readPlanCopy({
    locale
}: {
    readonly locale: (typeof LOCALES)[number];
}): BillingPlanCopy['plan'] {
    const raw = readFileSync(resolve(LOCALES_DIR, locale, 'billing.json'), 'utf8');
    return (JSON.parse(raw) as BillingPlanCopy).plan;
}

const SOLD_PLAN_SLUGS = [
    ...new Set(
        PRODUCTION_PLAN_CATALOG.filter((plan) => plan.role === null).map((plan) => plan.slug)
    )
].sort();

/**
 * Card slugs the web builds on its own, with no catalog plan behind them
 * (`FREE_TIER_CARD_SLUG` in `apps/web/src/lib/billing/fetch-plans.ts`).
 */
const WEB_ONLY_CARD_SLUGS = ['tourist-free'] as const;

const KNOWN_SLUGS = new Set<string>([
    ...PRODUCTION_PLAN_CATALOG.map((plan) => plan.slug),
    ...WEB_ONLY_CARD_SLUGS
]);

describe('TEST:1819:5 AC:1:3 plan card copy follows the production catalog slugs', () => {
    for (const locale of LOCALES) {
        it(`TEST:1819:5 AC:1:3 ${locale}: no billing.plan key names a slug the catalog lacks`, () => {
            const orphans = Object.keys(readPlanCopy({ locale }))
                .filter((slug) => !KNOWN_SLUGS.has(slug))
                .sort();
            expect(orphans).toEqual([]);
        });

        it(`TEST:1819:5 AC:1:3 ${locale}: every sold plan has a name and a description`, () => {
            const copy = readPlanCopy({ locale });
            const incomplete = SOLD_PLAN_SLUGS.filter(
                (slug) => !copy[slug]?.name?.trim() || !copy[slug]?.description?.trim()
            );
            expect(incomplete).toEqual([]);
        });
    }
});
