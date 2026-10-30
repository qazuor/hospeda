/**
 * @file commercial-loads.ts
 * @description Turns `commercial-catalog.ts` into the six reference-row loads
 * of the production catalog's money half: `billing_option`, `addon`,
 * `addon_version`, `addon_version_entitlement`, `addon_version_limit` and
 * `addon_product`. GUARD:G18 regenerates them and compares them with the
 * migrations; `generateCommercialCatalogSql` is the SQL committed in the
 * migration that loads them.
 *
 * Ids are UUIDv5 over a natural key with the same namespace `catalog.ts` uses,
 * so a billing option's `plan_version_id` is exactly the id 0144 wrote:
 * - `billing_option`: `plan:<vertical>:<slug>:version:1:billing_option:<cycle>`
 * - `addon`: `addon:<slug>`; its version: `addon:<slug>:version:1`
 * - what the version grants: `addon:<slug>:version:1:entitlement|limit:<key>`
 * - `addon_product`: `addon:<slug>:product:1`
 *
 * Row order is the insert order the database needs: every add-on version is
 * inserted by an EARLIER statement than its entitlements and limits (extras 041
 * accepts a child row only under a version created by the same transaction,
 * recorded by an AFTER INSERT trigger), and the product after its version.
 */

import type { CatalogLoad } from '../generate-catalog-sql.js';
import { renderInsert } from '../generate-catalog-sql.js';
import { catalogId, type PlanCatalogDefinition, PRODUCTION_PLAN_CATALOG } from './catalog.js';
import {
    type AddonCatalogDefinition,
    type CatalogBillingCycle,
    type PlanPriceDefinition,
    PRODUCTION_ADDON_CATALOG,
    PRODUCTION_PLAN_PRICES
} from './commercial-catalog.js';

/** The commercial load names, in insert order. */
export const COMMERCIAL_CATALOG_LOAD_NAMES = [
    'billing_option',
    'addon',
    'addon_version',
    'addon_version_entitlement',
    'addon_version_limit',
    'addon_product'
] as const;

/** One commercial load name. */
export type CommercialCatalogLoadName = (typeof COMMERCIAL_CATALOG_LOAD_NAMES)[number];

/** Cycles emitted per plan, in this order. */
const CYCLES: readonly CatalogBillingCycle[] = ['monthly', 'annual'];

/**
 * Builds the `billing_option` load. Every price must name a sellable plan of
 * the plan catalog, and every sellable plan must have a price: a plan without
 * one is unsellable in practice ("Planes no disponibles").
 *
 * @param input - Build input.
 * @param input.prices - The plan prices; defaults to the production prices.
 * @param input.catalog - The plan catalog; defaults to the production catalog.
 * @returns The load, rows in price order then cycle order.
 * @throws When a price names an unknown or role plan, or a sellable plan has no price.
 */
export function buildBillingOptionLoad({
    prices = PRODUCTION_PLAN_PRICES,
    catalog = PRODUCTION_PLAN_CATALOG
}: {
    readonly prices?: readonly PlanPriceDefinition[];
    readonly catalog?: readonly PlanCatalogDefinition[];
} = {}): CatalogLoad {
    const sellable = catalog.filter((plan) => plan.role === null && plan.version.sellable);
    const naturalKey = (plan: { vertical: string; slug: string }) =>
        `${plan.vertical}:${plan.slug}`;
    const sellableKeys = new Set(sellable.map(naturalKey));
    for (const price of prices) {
        if (!sellableKeys.has(naturalKey(price))) {
            throw new Error(`Price for ${naturalKey(price)} names no sellable catalog plan.`);
        }
    }
    const pricedKeys = new Set(prices.map(naturalKey));
    const unpriced = sellable.filter((plan) => !pricedKeys.has(naturalKey(plan)));
    if (unpriced.length > 0) {
        throw new Error(`Sellable plans without a price: ${unpriced.map(naturalKey).join(', ')}.`);
    }
    return {
        table: 'billing_option',
        label: 'production catalog billing_option',
        columns: ['id', 'plan_version_id', 'cycle', 'amount', 'currency'],
        rows: prices.flatMap((price) => {
            const versionKey = `plan:${price.vertical}:${price.slug}:version:1`;
            return CYCLES.map((cycle) => [
                catalogId(`${versionKey}:billing_option:${cycle}`),
                catalogId(versionKey),
                cycle,
                price.amounts[cycle],
                'ARS'
            ]);
        })
    };
}

/** Renders a vertical list as a PostgreSQL array literal (`'{a,b}'`), which G18 reads as a string. */
function arrayLiteral({ values }: { readonly values: readonly string[] }): string {
    return `{${values.join(',')}}`;
}

/**
 * Builds the five add-on loads.
 *
 * @param input - Build input.
 * @param input.addons - The add-on catalog; defaults to the production add-ons.
 * @returns `addon`, `addon_version`, `addon_version_entitlement`, `addon_version_limit`, `addon_product`.
 */
export function buildAddonLoads({
    addons = PRODUCTION_ADDON_CATALOG
}: {
    readonly addons?: readonly AddonCatalogDefinition[];
} = {}): readonly [CatalogLoad, CatalogLoad, CatalogLoad, CatalogLoad, CatalogLoad] {
    return [
        {
            table: 'addon',
            label: 'production catalog addon',
            columns: ['id', 'slug', 'name', 'description'],
            rows: addons.map((addon) => [
                catalogId(`addon:${addon.slug}`),
                addon.slug,
                addon.name,
                addon.description
            ])
        },
        {
            table: 'addon_version',
            label: 'production catalog addon_version',
            columns: ['id', 'addon_id', 'validity', 'validity_days', 'scope_type'],
            rows: addons.map((addon) => [
                catalogId(`addon:${addon.slug}:version:1`),
                catalogId(`addon:${addon.slug}`),
                addon.version.validity,
                addon.version.validityDays,
                addon.version.scopeType
            ])
        },
        {
            table: 'addon_version_entitlement',
            label: 'production catalog addon_version_entitlement',
            columns: ['id', 'addon_version_id', 'key'],
            rows: addons.flatMap((addon) => {
                const versionKey = `addon:${addon.slug}:version:1`;
                return addon.version.entitlements.map((key) => [
                    catalogId(`${versionKey}:entitlement:${key}`),
                    catalogId(versionKey),
                    key
                ]);
            })
        },
        {
            table: 'addon_version_limit',
            label: 'production catalog addon_version_limit',
            columns: ['id', 'addon_version_id', 'key', 'value'],
            rows: addons.flatMap((addon) => {
                const versionKey = `addon:${addon.slug}:version:1`;
                return addon.version.limits.map((entry) => [
                    catalogId(`${versionKey}:limit:${entry.key}`),
                    catalogId(versionKey),
                    entry.key,
                    entry.value
                ]);
            })
        },
        {
            table: 'addon_product',
            label: 'production catalog addon_product',
            columns: [
                'id',
                'addon_id',
                'version_id',
                'price',
                'currency',
                'charge_kind',
                'cycle',
                'compatible_verticals'
            ],
            rows: addons.map((addon) => [
                catalogId(`addon:${addon.slug}:product:1`),
                catalogId(`addon:${addon.slug}`),
                catalogId(`addon:${addon.slug}:version:1`),
                addon.product.price,
                'ARS',
                addon.product.chargeKind,
                addon.product.cycle,
                arrayLiteral({ values: addon.product.compatibleVerticals })
            ])
        }
    ];
}

/**
 * Builds every commercial load, keyed by name.
 *
 * @returns The six loads.
 */
export function buildCommercialCatalogLoads(): Readonly<
    Record<CommercialCatalogLoadName, CatalogLoad>
> {
    const [addon, addon_version, addon_version_entitlement, addon_version_limit, addon_product] =
        buildAddonLoads();
    return {
        billing_option: buildBillingOptionLoad(),
        addon,
        addon_version,
        addon_version_entitlement,
        addon_version_limit,
        addon_product
    };
}

/**
 * The SQL committed in the migration that loads the commercial catalog: one
 * `INSERT` per non-empty load, in {@link COMMERCIAL_CATALOG_LOAD_NAMES} order.
 * It must run in ONE transaction (extras 041); `drizzle-kit migrate` does.
 *
 * @returns The SQL text, ending in a newline.
 */
export function generateCommercialCatalogSql(): string {
    const loads = buildCommercialCatalogLoads();
    return `${COMMERCIAL_CATALOG_LOAD_NAMES.map((name) => loads[name])
        .filter((load) => load.rows.length > 0)
        .map((load) => renderInsert({ load }))
        .join('\n--> statement-breakpoint\n')}\n`;
}
