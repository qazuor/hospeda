/**
 * Plan names for the general dashboard's subscription card, read from the
 * catalog (HOS-2473, owner rule «la UI de planes lee el catálogo»).
 *
 * The card receives the user's plan SLUG from `/user/stats` and needs a
 * display name. Instead of a hand-kept slug list, this reads every public
 * catalog vertical and translates each plan the catalog actually sells. A
 * plan the catalog does not list (or a catalog that failed to load) simply
 * has no entry, and the card falls back to the plan name the API sent.
 *
 * @module lib/account/dashboard-plan-names
 */

import type { PublicPlanCatalogVertical } from '@repo/schemas';
import { type FetchPlansResult, fetchPublicPlans } from '@/lib/billing/fetch-plans';
import { getPlanName } from '@/lib/billing/plan-name';

/** Every vertical the public plan catalog serves. */
export const DASHBOARD_CATALOG_VERTICALS: readonly PublicPlanCatalogVertical[] = [
    'accommodation',
    'venue',
    'experience',
    'tourist'
];

/**
 * Reads the catalog of every vertical and returns translated names by slug.
 *
 * @param input.t - Translator (`billing.plan.<slug>.name`, falling back to the catalog name).
 * @param input.fetchPlans - Catalog reader; injectable for tests.
 * @returns `{ [slug]: name }` for every plan the catalog lists.
 */
export async function readDashboardPlanNames({
    t,
    fetchPlans = fetchPublicPlans
}: {
    readonly t: (key: string, fallback?: string) => string;
    readonly fetchPlans?: (input: {
        readonly vertical: PublicPlanCatalogVertical;
    }) => Promise<FetchPlansResult>;
}): Promise<Readonly<Record<string, string>>> {
    const results = await Promise.all(
        DASHBOARD_CATALOG_VERTICALS.map((vertical) => fetchPlans({ vertical }))
    );
    const names: Record<string, string> = {};
    for (const result of results) {
        if (!result.ok) continue;
        for (const plan of result.plans) {
            names[plan.slug] = getPlanName({ plan, t });
        }
    }
    return names;
}
