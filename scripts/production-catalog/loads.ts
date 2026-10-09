import type { CatalogLoad } from '../generate-catalog-sql.js';
import { renderInsert } from '../generate-catalog-sql.js';
import { catalogId, PLACEHOLDER_CATALOG, type PlanCatalogDefinition } from './catalog.js';

export const PLAN_CATALOG_LOAD_NAMES = [
    'plan',
    'plan_version',
    'plan_version_entitlement',
    'plan_version_limit'
] as const;

/** Build the four plan-only loads. Kept separate from G18's migration defaults until V2.4b. */
export function buildPlanCatalogLoads(
    catalog: readonly PlanCatalogDefinition[] = PLACEHOLDER_CATALOG
): readonly CatalogLoad[] {
    return [
        {
            table: 'plan',
            label: 'production catalog plan',
            columns: ['id', 'vertical', 'slug', 'name', 'role'],
            rows: catalog.map((plan) => [
                catalogId(`plan:${plan.vertical}:${plan.slug}`),
                plan.vertical,
                plan.slug,
                plan.name,
                plan.role
            ])
        },
        {
            table: 'plan_version',
            label: 'production catalog plan_version',
            columns: [
                'id',
                'plan_id',
                'vertical',
                'rank',
                'sellable',
                'current',
                'grace_days',
                'trial_days',
                'allows_pause',
                'inherits_tourist_vip'
            ],
            rows: catalog.map((plan) => {
                const key = `plan:${plan.vertical}:${plan.slug}`;
                const version = plan.version;
                return [
                    catalogId(`${key}:version:1`),
                    catalogId(key),
                    plan.vertical,
                    version.rank,
                    version.sellable,
                    version.current,
                    version.graceDays,
                    version.trialDays,
                    version.allowsPause,
                    version.inheritsTouristVip
                ];
            })
        },
        {
            table: 'plan_version_entitlement',
            label: 'production catalog plan_version_entitlement',
            columns: ['id', 'plan_version_id', 'key', 'plan_quota', 'trial_quota'],
            rows: catalog.flatMap((plan) => {
                const versionKey = `plan:${plan.vertical}:${plan.slug}:version:1`;
                return plan.version.entitlements.map((entry) => [
                    catalogId(`${versionKey}:entitlement:${entry.key}`),
                    catalogId(versionKey),
                    entry.key,
                    entry.planQuota ?? null,
                    entry.trialQuota ?? null
                ]);
            })
        },
        {
            table: 'plan_version_limit',
            label: 'production catalog plan_version_limit',
            columns: ['id', 'plan_version_id', 'key', 'value'],
            rows: catalog.flatMap((plan) => {
                const versionKey = `plan:${plan.vertical}:${plan.slug}:version:1`;
                return plan.version.limits.map((entry) => [
                    catalogId(`${versionKey}:limit:${entry.key}`),
                    catalogId(versionKey),
                    entry.key,
                    entry.value
                ]);
            })
        }
    ];
}

/** SQL to paste into the V2.4b migration after product values are approved. */
export function generatePlanCatalogSql(
    catalog: readonly PlanCatalogDefinition[] = PLACEHOLDER_CATALOG
): string {
    return `${buildPlanCatalogLoads(catalog)
        .filter((load) => load.rows.length > 0)
        .map((load) => renderInsert({ load }))
        .join('\n--> statement-breakpoint\n')}\n`;
}
