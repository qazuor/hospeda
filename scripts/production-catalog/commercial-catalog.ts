/**
 * @file commercial-catalog.ts
 * @description The money half of the production catalog: the price of every
 * sellable plan (`billing_option`) and the add-on catalog (`addon`,
 * `addon_version` with what it grants, `addon_product` with its price).
 *
 * `catalog.ts` declares WHAT each plan grants; this file declares WHAT IT COSTS
 * and the add-ons sold at the cutover. Both travel to the database as SQL that
 * `scripts/generate-catalog-sql.ts` generates and GUARD:G18 compares
 * (spec `30-el-corte.md` step 3/3a; `10-corte/B2.md` AC:B2:8: "las
 * `billing_option` tienen los precios vigentes hoy, que carga la migración
 * estructural del paso 3").
 *
 * ## Money unit
 *
 * Every amount is in MINOR units (centavos of ARS): `billing_option.amount`
 * becomes `amountMinor` in `start-subscription.service.ts`, and the
 * MercadoPago adapter sends `amountMinor / 100` as `transaction_amount`. So
 * ARS 18.000 is `1_800_000`. `addon_product.price` follows the same money rule
 * (integer centavos, repo-wide policy).
 *
 * ## Values
 *
 * The prices are the ones live in production at the cutover (owner decision,
 * 2026-10-20): monthly and annual cycles only. Role plans (`trial`,
 * `pre_trial`, `floor`) carry no option: nobody subscribes to them
 * (`startSubscription` rejects a version that is not current AND sellable, and
 * the floor is read as a coverage floor, never anchored by a subscription).
 *
 * The add-ons are the active production add-ons that have a faithful
 * equivalent in the new model. Left out on purpose: "Extra Properties Pack
 * (+5)" (`extra-properties-5`), sold only to the retired `complex` customer
 * category, and its key `max_properties` is granted by no plan of the new
 * catalog, so what "+5" adds to has no meaning there.
 */

/** A billing cycle the catalog prices. */
export type CatalogBillingCycle = 'monthly' | 'annual';

/** The prices of one sellable plan, in ARS minor units (centavos). */
export interface PlanPriceDefinition {
    /** Vertical of the priced plan (with `slug`, the plan's natural key). */
    readonly vertical: 'accommodation' | 'venue' | 'experience' | 'tourist' | 'partner';
    /** Slug of the priced plan. */
    readonly slug: string;
    /** Amount per cycle, in centavos. */
    readonly amounts: Readonly<Record<CatalogBillingCycle, number>>;
}

/** Converts whole ARS pesos to centavos. */
const ars = ({ pesos }: { readonly pesos: number }): number => pesos * 100;

/** One plan's monthly and annual price, given in whole pesos. */
const priced = (input: {
    readonly vertical: PlanPriceDefinition['vertical'];
    readonly slug: string;
    readonly monthly: number;
    readonly annual: number;
}): PlanPriceDefinition => ({
    vertical: input.vertical,
    slug: input.slug,
    amounts: { monthly: ars({ pesos: input.monthly }), annual: ars({ pesos: input.annual }) }
});

/** Live production prices of every sellable plan of `PRODUCTION_PLAN_CATALOG`. */
export const PRODUCTION_PLAN_PRICES: readonly PlanPriceDefinition[] = [
    priced({ vertical: 'accommodation', slug: 'owner-basico', monthly: 18_000, annual: 180_000 }),
    priced({ vertical: 'accommodation', slug: 'owner-pro', monthly: 35_000, annual: 350_000 }),
    priced({ vertical: 'accommodation', slug: 'owner-premium', monthly: 65_000, annual: 650_000 }),
    priced({ vertical: 'venue', slug: 'venue-basico', monthly: 30_000, annual: 300_000 }),
    priced({ vertical: 'venue', slug: 'venue-pro', monthly: 65_000, annual: 650_000 }),
    priced({
        vertical: 'venue',
        slug: 'venue-premium',
        monthly: 80_000,
        annual: 800_000
    }),
    priced({ vertical: 'experience', slug: 'experience-basico', monthly: 15_000, annual: 150_000 }),
    priced({ vertical: 'experience', slug: 'experience-pro', monthly: 35_000, annual: 350_000 }),
    priced({
        vertical: 'experience',
        slug: 'experience-premium',
        monthly: 50_000,
        annual: 500_000
    }),
    priced({ vertical: 'tourist', slug: 'tourist-vip', monthly: 15_000, annual: 150_000 }),
    priced({ vertical: 'partner', slug: 'partner-silver', monthly: 15_000, annual: 150_000 }),
    priced({ vertical: 'partner', slug: 'partner-gold', monthly: 30_000, annual: 300_000 })
];

/** One add-on of the catalog: identity, its version 1 and its product. */
export interface AddonCatalogDefinition {
    /** Stable slug (the production slug, kept). */
    readonly slug: string;
    /** Display name (the production name, kept). */
    readonly name: string;
    /** Description (the production description, kept). */
    readonly description: string;
    /** Version 1: what it grants, for how long and over what. */
    readonly version: {
        readonly validity: 'FIXED_DAYS' | 'WHILE_SUBSCRIPTION_ALIVE';
        readonly validityDays: number | null;
        readonly scopeType: 'LISTING' | 'VERTICAL_SUBSCRIPTION' | 'USER' | 'GLOBAL';
        readonly entitlements: readonly string[];
        readonly limits: readonly { readonly key: string; readonly value: number }[];
    };
    /** The product billing sells: price in centavos, charge kind and verticals. */
    readonly product: {
        readonly price: number;
        readonly chargeKind: 'UNA_VEZ' | 'PERIODICO';
        readonly cycle: 'monthly' | null;
        readonly compatibleVerticals: readonly ('accommodation' | 'venue' | 'experience')[];
    };
}

/** A recurring pack that raises one limit while the vertical subscription lives. */
const limitPack = (input: {
    readonly slug: string;
    readonly name: string;
    readonly description: string;
    readonly key: string;
    readonly value: number;
    readonly monthlyPesos: number;
    readonly vertical: 'accommodation' | 'venue' | 'experience';
}): AddonCatalogDefinition => ({
    slug: input.slug,
    name: input.name,
    description: input.description,
    version: {
        validity: 'WHILE_SUBSCRIPTION_ALIVE',
        validityDays: null,
        scopeType: 'VERTICAL_SUBSCRIPTION',
        entitlements: [],
        limits: [{ key: input.key, value: input.value }]
    },
    product: {
        price: ars({ pesos: input.monthlyPesos }),
        chargeKind: 'PERIODICO',
        cycle: 'monthly',
        compatibleVerticals: [input.vertical]
    }
});

/** A one-time boost that features ONE listing for a fixed number of days. */
const visibilityBoost = (input: {
    readonly slug: string;
    readonly name: string;
    readonly noun: string;
    readonly days: 7 | 30;
    readonly pesos: number;
    readonly vertical: 'accommodation' | 'venue' | 'experience';
}): AddonCatalogDefinition => ({
    slug: input.slug,
    name: input.name,
    description: `Your ${input.noun} appears featured in search results for ${input.days} days.`,
    version: {
        validity: 'FIXED_DAYS',
        validityDays: input.days,
        scopeType: 'LISTING',
        entitlements: ['featured_listing'],
        limits: []
    },
    product: {
        price: ars({ pesos: input.pesos }),
        chargeKind: 'UNA_VEZ',
        cycle: null,
        compatibleVerticals: [input.vertical]
    }
});

/** The production add-ons that have a faithful equivalent in the new model (10 of 11). */
export const PRODUCTION_ADDON_CATALOG: readonly AddonCatalogDefinition[] = [
    limitPack({
        slug: 'extra-accommodations-5',
        name: 'Extra Accommodations Pack (+5)',
        description: 'Adds 5 additional accommodations to your plan. Renews monthly.',
        key: 'max_accommodations',
        value: 5,
        monthlyPesos: 13_000,
        vertical: 'accommodation'
    }),
    limitPack({
        slug: 'extra-photos-20',
        name: 'Extra Photos Pack (+20 photos)',
        description: 'Adds 20 additional photos to each accommodation. Renews monthly.',
        key: 'max_photos_per_accommodation',
        value: 20,
        monthlyPesos: 5_000,
        vertical: 'accommodation'
    }),
    limitPack({
        slug: 'extra-venues-1',
        name: 'Extra Comer y salir Listing (+1)',
        description: 'Adds 1 additional gastronomy listing to your plan. Renews monthly.',
        key: 'max_venues',
        value: 1,
        monthlyPesos: 15_000,
        vertical: 'venue'
    }),
    limitPack({
        slug: 'extra-experiences-1',
        name: 'Extra Experience Listing (+1)',
        description: 'Adds 1 additional experience listing to your plan. Renews monthly.',
        key: 'max_experiences',
        value: 1,
        monthlyPesos: 15_000,
        vertical: 'experience'
    }),
    visibilityBoost({
        slug: 'visibility-boost-7d',
        name: 'Visibility Boost (7 days)',
        noun: 'accommodation',
        days: 7,
        pesos: 5_000,
        vertical: 'accommodation'
    }),
    visibilityBoost({
        slug: 'visibility-boost-30d',
        name: 'Visibility Boost (30 days)',
        noun: 'accommodation',
        days: 30,
        pesos: 15_000,
        vertical: 'accommodation'
    }),
    visibilityBoost({
        slug: 'visibility-boost-venue-7d',
        name: 'Visibility Boost — Comer y salir (7 days)',
        noun: 'restaurant',
        days: 7,
        pesos: 5_000,
        vertical: 'venue'
    }),
    visibilityBoost({
        slug: 'visibility-boost-venue-30d',
        name: 'Visibility Boost — Comer y salir (30 days)',
        noun: 'restaurant',
        days: 30,
        pesos: 15_000,
        vertical: 'venue'
    }),
    visibilityBoost({
        slug: 'visibility-boost-experience-7d',
        name: 'Visibility Boost — Experience (7 days)',
        noun: 'experience',
        days: 7,
        pesos: 5_000,
        vertical: 'experience'
    }),
    visibilityBoost({
        slug: 'visibility-boost-experience-30d',
        name: 'Visibility Boost — Experience (30 days)',
        noun: 'experience',
        days: 30,
        pesos: 15_000,
        vertical: 'experience'
    })
];
