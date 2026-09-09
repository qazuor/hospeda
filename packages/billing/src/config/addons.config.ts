import { ProductDomainEnum, type ProductDomainValue } from '@repo/schemas';
import type { AddonDefinition } from '../types/addon.types.js';
import { EntitlementKey } from '../types/entitlement.types.js';
import { LimitKey } from '../types/plan.types.js';

// ─── ONE-TIME ADD-ONS ──────────────────────────────────────────

/**
 * What a 7-day visibility boost costs, in ARS centavos — for EVERY vertical
 * (HOS-1286).
 *
 * The owner's instruction was "same price as accommodation", so the six
 * definitions below read these two constants instead of repeating two numbers
 * six times. If the verticals are ever priced apart, the change is to split
 * this pair per domain, and the six literals it feeds do not have to be hunted
 * for one at a time.
 *
 * These are also the only per-vertical prices in the visibility family, which
 * is why they sit together at the top of the file rather than inline: the
 * decision "gastronomy pays what a hotel pays" should be visible in one glance,
 * not reconstructed from six scattered fields.
 */
export const VISIBILITY_BOOST_7D_PRICE_ARS = 500_000; // ARS $5,000
/** 30-day counterpart of {@link VISIBILITY_BOOST_7D_PRICE_ARS}. */
export const VISIBILITY_BOOST_30D_PRICE_ARS = 1_500_000; // ARS $15,000

/**
 * Human label for the listing a visibility boost features, per vertical — used
 * only to build each add-on's display `name` and `description`.
 *
 * The three add-on FAMILIES cannot share one slug: `productDomain` is a single
 * value per definition (that is the point of HOS-1060 — two verticals sharing
 * one row is exactly the collision it closed), so "boost a restaurant" and
 * "boost a hotel" are necessarily different catalogue entries.
 */
const VISIBILITY_BOOST_SUBJECT: Readonly<Record<string, { noun: string; label: string }>> = {
    [ProductDomainEnum.ACCOMMODATION]: { noun: 'accommodation', label: 'Accommodation' },
    [ProductDomainEnum.GASTRONOMY]: { noun: 'restaurant', label: 'Restaurant' },
    [ProductDomainEnum.EXPERIENCE]: { noun: 'experience', label: 'Experience' }
};

/**
 * Builds one visibility-boost add-on (HOS-1286).
 *
 * ## Why a factory, and why all six go through it
 *
 * Before HOS-1286 there were two hand-written literals. Six hand-written
 * literals differing in three fields is the copy-paste
 * `EXTRA_GASTRONOMIES_ADDON` / `EXTRA_EXPERIENCES_ADDON` were deliberately kept
 * apart to avoid — except that pair differs in its `affectsLimitKey`, where a
 * wrong copy raises the wrong cap silently. This family differs in
 * `productDomain`, where a wrong copy features a listing in the WRONG VERTICAL,
 * which is worse and just as silent. The factory makes the domain a parameter
 * that cannot be forgotten.
 *
 * The two accommodation entries are built here too, at their existing slugs,
 * names and prices — identical rows to what shipped, so the `billing_addons`
 * seed (idempotent on `name`) and every stored purchase keep matching.
 *
 * ## `requiresAccommodationTarget` on a gastronomy add-on
 *
 * The flag is `true` for all six: every visibility boost is scoped to ONE
 * listing. The field name is historical — it predates commerce — and the table
 * the target id points into is decided by {@link AddonDefinition.productDomain},
 * never by the flag. The name is kept rather than corrected because it is on the
 * wire (`AddonResponseSchema.requiresAccommodationTarget`) and a rename would
 * break in-flight clients; consumers must read the DOMAIN to know which listings
 * to offer.
 *
 * @param input.domain - The vertical this boost belongs to and features in.
 * @param input.days - Boost duration, 7 or 30.
 * @param input.slug - Catalogue slug (explicit, so the two accommodation
 *   entries keep their pre-HOS-1286 slugs rather than a derived one).
 * @param input.name - Display name; also the `billing_addons` idempotency key.
 * @param input.sortOrder - Display order within the add-on catalogue.
 * @returns The boost's {@link AddonDefinition}.
 */
function visibilityBoostAddon(input: {
    domain: ProductDomainValue;
    days: 7 | 30;
    slug: string;
    name: string;
    sortOrder: number;
}): AddonDefinition {
    const subject = VISIBILITY_BOOST_SUBJECT[input.domain];
    const noun = subject ? subject.noun : 'listing';
    return {
        slug: input.slug,
        name: input.name,
        description: `Your ${noun} appears featured in search results for ${input.days} days.`,
        billingType: 'one_time',
        priceArs: input.days === 7 ? VISIBILITY_BOOST_7D_PRICE_ARS : VISIBILITY_BOOST_30D_PRICE_ARS,
        annualPriceArs: null, // One-time purchase
        durationDays: input.days,
        affectsLimitKey: null,
        limitIncrease: null,
        grantsEntitlement: EntitlementKey.FEATURED_LISTING,
        // 'owner'/'complex' for accommodation as before; commerce definitions use
        // 'owner' for the reason every other one here does — PlanCategory has no
        // commerce member, so `productDomain` is the real discriminator.
        targetCategories:
            input.domain === ProductDomainEnum.ACCOMMODATION ? ['owner', 'complex'] : ['owner'],
        productDomain: input.domain,
        isActive: true,
        sortOrder: input.sortOrder,
        // Scoped to ONE listing, of this add-on's own domain. See the factory doc
        // for why the field keeps its accommodation-era name.
        requiresAccommodationTarget: true
    };
}

export const VISIBILITY_BOOST_ADDON: AddonDefinition = visibilityBoostAddon({
    domain: ProductDomainEnum.ACCOMMODATION,
    days: 7,
    slug: 'visibility-boost-7d',
    name: 'Visibility Boost (7 days)',
    sortOrder: 1
});

export const VISIBILITY_BOOST_30D_ADDON: AddonDefinition = visibilityBoostAddon({
    domain: ProductDomainEnum.ACCOMMODATION,
    days: 30,
    slug: 'visibility-boost-30d',
    name: 'Visibility Boost (30 days)',
    sortOrder: 2
});

/**
 * Gastronomy visibility boosts (HOS-1286) — the reason this issue exists: a
 * restaurant owner had reviews and an `is_featured` column and no way to buy
 * placement.
 */
export const VISIBILITY_BOOST_GASTRONOMY_ADDON: AddonDefinition = visibilityBoostAddon({
    domain: ProductDomainEnum.GASTRONOMY,
    days: 7,
    slug: 'visibility-boost-gastronomy-7d',
    name: 'Visibility Boost — Restaurant (7 days)',
    sortOrder: 12
});

/** 30-day twin of {@link VISIBILITY_BOOST_GASTRONOMY_ADDON}. */
export const VISIBILITY_BOOST_GASTRONOMY_30D_ADDON: AddonDefinition = visibilityBoostAddon({
    domain: ProductDomainEnum.GASTRONOMY,
    days: 30,
    slug: 'visibility-boost-gastronomy-30d',
    name: 'Visibility Boost — Restaurant (30 days)',
    sortOrder: 13
});

/** Experience-side twin of {@link VISIBILITY_BOOST_GASTRONOMY_ADDON}. */
export const VISIBILITY_BOOST_EXPERIENCE_ADDON: AddonDefinition = visibilityBoostAddon({
    domain: ProductDomainEnum.EXPERIENCE,
    days: 7,
    slug: 'visibility-boost-experience-7d',
    name: 'Visibility Boost — Experience (7 days)',
    sortOrder: 14
});

/** 30-day twin of {@link VISIBILITY_BOOST_EXPERIENCE_ADDON}. */
export const VISIBILITY_BOOST_EXPERIENCE_30D_ADDON: AddonDefinition = visibilityBoostAddon({
    domain: ProductDomainEnum.EXPERIENCE,
    days: 30,
    slug: 'visibility-boost-experience-30d',
    name: 'Visibility Boost — Experience (30 days)',
    sortOrder: 15
});

/**
 * The four commerce visibility boosts (HOS-1286), gastronomy first.
 *
 * Kept as its own list, like {@link ALL_PRIVATE_GALLERY_ADDONS}, so the
 * dual-write data-migration that inserts them into an already-seeded
 * environment iterates the same array this file exports rather than repeating
 * the four slugs.
 */
export const ALL_COMMERCE_VISIBILITY_BOOST_ADDONS: readonly AddonDefinition[] = [
    VISIBILITY_BOOST_GASTRONOMY_ADDON,
    VISIBILITY_BOOST_GASTRONOMY_30D_ADDON,
    VISIBILITY_BOOST_EXPERIENCE_ADDON,
    VISIBILITY_BOOST_EXPERIENCE_30D_ADDON
];

// ─── RECURRING ADD-ONS ─────────────────────────────────────────

export const EXTRA_PHOTOS_ADDON: AddonDefinition = {
    slug: 'extra-photos-20',
    name: 'Extra Photos Pack (+20 photos)',
    description: 'Adds 20 additional photos to each accommodation. Renews monthly.',
    billingType: 'recurring',
    priceArs: 500000, // ARS $5,000/month
    annualPriceArs: 4800000, // ARS $48,000/year (20% annual discount)
    durationDays: null,
    affectsLimitKey: LimitKey.MAX_PHOTOS_PER_ACCOMMODATION,
    limitIncrease: 20,
    grantsEntitlement: null,
    targetCategories: ['owner', 'complex'],
    // HOS-1060: derived from the cap it raises —
    // `productDomainForLimitKey(MAX_PHOTOS_PER_ACCOMMODATION)` is accommodation.
    // Every add-on carrying an `affectsLimitKey` must agree with that map, or it
    // raises a cap the owner's subscription domain never supplies a base for.
    productDomain: ProductDomainEnum.ACCOMMODATION,
    isActive: true,
    sortOrder: 3
};

export const EXTRA_ACCOMMODATIONS_ADDON: AddonDefinition = {
    slug: 'extra-accommodations-5',
    name: 'Extra Accommodations Pack (+5)',
    description: 'Adds 5 additional accommodations to your plan. Renews monthly.',
    billingType: 'recurring',
    priceArs: 1300000, // ARS $13,000/month — HOS-301 D1
    annualPriceArs: 13000000, // ARS $130,000/year (ten months, matching the owner plans) — HOS-301 D1
    durationDays: null,
    affectsLimitKey: LimitKey.MAX_ACCOMMODATIONS,
    limitIncrease: 5,
    grantsEntitlement: null,
    targetCategories: ['owner'],
    // HOS-1060 — agrees with `productDomainForLimitKey(MAX_ACCOMMODATIONS)`.
    productDomain: ProductDomainEnum.ACCOMMODATION,
    isActive: true,
    sortOrder: 4
};

export const EXTRA_PROPERTIES_ADDON: AddonDefinition = {
    slug: 'extra-properties-5',
    name: 'Extra Properties Pack (+5)',
    description: 'Adds 5 additional properties to your complex. Renews monthly.',
    billingType: 'recurring',
    priceArs: 2000000, // ARS $20,000/month
    annualPriceArs: 19200000, // ARS $192,000/year (20% annual discount)
    durationDays: null,
    affectsLimitKey: LimitKey.MAX_PROPERTIES,
    limitIncrease: 5,
    grantsEntitlement: null,
    targetCategories: ['complex'],
    // HOS-1060 — agrees with `productDomainForLimitKey(MAX_PROPERTIES)`.
    productDomain: ProductDomainEnum.ACCOMMODATION,
    isActive: true,
    sortOrder: 5
};

export const AI_SUPPORT_ADDON: AddonDefinition = {
    slug: 'ai-support-monthly',
    name: 'AI Support (monthly)',
    description:
        'Unlocks AI-powered support tools for hosts, including smart reply suggestions and automated guest FAQ handling. Renews monthly.',
    billingType: 'recurring',
    // Placeholder pricing/quota — the ai_support FEATURE route is deferred to a
    // future spec (SPEC-211 §AC-4.2). Until that spec lands with final pricing,
    // the addon ships INACTIVE so it never surfaces in the purchasable catalog:
    // an active addon at a TBD price would grant AI_SUPPORT for a feature that
    // does not exist yet (host pays, receives nothing). Flip isActive to true in
    // the ai_support feature spec once price/quota are confirmed by the owner.
    priceArs: 800000, // ARS $8,000/month — TBD: owner to confirm final price at implementation
    annualPriceArs: 7680000, // ARS $76,800/year (20% annual discount) — TBD: owner to confirm at implementation
    durationDays: null,
    affectsLimitKey: LimitKey.MAX_AI_SUPPORT_PER_MONTH,
    limitIncrease: 100, // TBD: owner to confirm the monthly AI interaction quota at implementation
    grantsEntitlement: EntitlementKey.AI_SUPPORT,
    targetCategories: ['owner', 'complex'],
    // HOS-1060 — agrees with `productDomainForLimitKey(MAX_AI_SUPPORT_PER_MONTH)`.
    productDomain: ProductDomainEnum.ACCOMMODATION,
    isActive: false,
    sortOrder: 6
};

/**
 * Extra-listing add-ons, one per commerce vertical (HOS-688 §6.8).
 *
 * Calqued on {@link EXTRA_ACCOMMODATIONS_ADDON}: recurring, no entitlement, an
 * `affectsLimitKey` pointing at the vertical's own cap. Two definitions rather
 * than one pooled add-on because an `AddonDefinition` carries exactly one
 * `affectsLimitKey` — the model already implies the split, and a shared add-on
 * could not express "raise my gastronomy cap and leave my experience cap
 * alone".
 *
 * `limitIncrease: 1`, not 5: a commerce plan sells ONE listing, so one listing
 * is the unit an owner buys more of.
 *
 * **Price** mirrors the vertical plan's own ARS $15.000 — a second listing
 * costs what the first one does. That is DERIVED from the plan price rather
 * than separately decided, and like every price in this package it is a
 * `'commercial'` field: the database wins, so an admin-UI override stands
 * without a deploy.
 *
 * Each add-on must also appear in `ADDON_SLUG_BY_LIMIT_KEY`
 * (`apps/web/src/lib/billing/plan-usage-config.ts`), or it is purchasable and
 * grants the cap increase while never being linked from the at-cap row anyone
 * would buy it from.
 */
export const EXTRA_GASTRONOMIES_ADDON: AddonDefinition = {
    slug: 'extra-gastronomies-1',
    name: 'Extra Gastronomy Listing (+1)',
    description: 'Adds 1 additional gastronomy listing to your plan. Renews monthly.',
    billingType: 'recurring',
    priceArs: 1500000, // ARS $15,000/month — same as the gastronomy plan itself
    annualPriceArs: 15000000, // ARS $150,000/year (ten months, the rule every plan here follows)
    durationDays: null,
    affectsLimitKey: LimitKey.MAX_GASTRONOMIES,
    limitIncrease: 1,
    grantsEntitlement: null,
    // 'owner' for the same reason the commerce plans use it: PlanCategory has no
    // commerce member and product_domain is the real discriminator.
    targetCategories: ['owner'],
    // HOS-1060: and here is that discriminator, finally declared. Until this
    // field existed the comment above described a column no add-on carried, so a
    // gastronomy owner could buy `extra-experiences-1` — the two rows are
    // byte-identical on every field anyone could have filtered by.
    productDomain: ProductDomainEnum.GASTRONOMY,
    isActive: true,
    sortOrder: 7
};

/** Experience-side twin of {@link EXTRA_GASTRONOMIES_ADDON}. */
export const EXTRA_EXPERIENCES_ADDON: AddonDefinition = {
    slug: 'extra-experiences-1',
    name: 'Extra Experience Listing (+1)',
    description: 'Adds 1 additional experience listing to your plan. Renews monthly.',
    billingType: 'recurring',
    priceArs: 1500000, // ARS $15,000/month — same as the experience plan itself
    annualPriceArs: 15000000, // ARS $150,000/year (ten months, the rule every plan here follows)
    durationDays: null,
    affectsLimitKey: LimitKey.MAX_EXPERIENCES,
    limitIncrease: 1,
    grantsEntitlement: null,
    targetCategories: ['owner'],
    // HOS-1060 — the other half of the pair; see the gastronomy twin above.
    productDomain: ProductDomainEnum.EXPERIENCE,
    isActive: true,
    sortOrder: 8
};

// ─── PRIVATE-GALLERY PACKS (HOS-1060) ──────────────────────────

/**
 * Builds one of the three private-gallery packs (HOS-1060).
 *
 * ## What a pack is, commercially
 *
 * The owner decided (2026-09-04) that private galleries are sold as an escalón
 * AND a complemento at once, not one or the other: `experience-premium` grants
 * the capability with a base cap, and these packs do two different jobs on top
 * of it.
 *
 *   - On `experience-basico` and `experience-pro` they ENABLE the feature —
 *     those tiers do not grant
 *     {@link EntitlementKey.MANAGE_EXPERIENCE_PRIVATE_GALLERIES} at all, so the
 *     pack's `grantsEntitlement` is what turns it on;
 *   - On `experience-premium` they RAISE the cap, through `affectsLimitKey` +
 *     `limitIncrease`, for the provider who ran out of slots.
 *
 * One definition covers both because an add-on may carry a grant and a limit
 * increase simultaneously — `AI_SUPPORT_ADDON` is the precedent. What is new is
 * that the grant DUPLICATES one a plan also makes; the two are additive, and
 * `loadEntitlements` unions them, so an owner holding both keeps the capability
 * when either lapses.
 *
 * ## Why the three are a family built by a factory
 *
 * The three differ in exactly two numbers (the increase and the price) and in
 * nothing else. Spelling three near-identical literals out invites the failure
 * `EXTRA_GASTRONOMIES_ADDON` / `EXTRA_EXPERIENCES_ADDON` were built apart to
 * avoid — a copy-paste that leaves one of them pointing at the wrong limit key,
 * which raises the wrong cap and reports no error anywhere. Here there is only
 * ONE limit key, so the factory is the cheaper defense.
 *
 * ## They ship INACTIVE, and that is not a placeholder
 *
 * {@link AI_SUPPORT_ADDON} sets the precedent and states the reason: an active
 * add-on at a TBD price, for a feature whose routes do not exist yet, means a
 * provider pays and receives nothing. Nothing in HOS-1060's phase 1 can create,
 * serve or expire a gallery. The packs are flipped `isActive: true` by the phase
 * that ships the gallery itself, together with the prices the owner confirms —
 * the numbers below are DERIVED placeholders, not decisions (see each pack).
 *
 * @param input.galleries - How many active galleries the pack adds.
 * @param input.priceArs - Monthly price in ARS centavos.
 * @param input.sortOrder - Display order within the add-on catalogue.
 * @returns The pack's {@link AddonDefinition}.
 */
function privateGalleryPack(input: {
    galleries: number;
    priceArs: number;
    sortOrder: number;
}): AddonDefinition {
    return {
        slug: `private-galleries-${input.galleries}`,
        name: `Private Galleries Pack (+${input.galleries})`,
        description: `Adds ${input.galleries} additional active private galleries for your experiences, and enables private galleries on plans that do not include them. Renews monthly.`,
        billingType: 'recurring',
        priceArs: input.priceArs,
        // Ten months, the rule every recurring definition in this file follows.
        annualPriceArs: input.priceArs * 10,
        durationDays: null,
        affectsLimitKey: LimitKey.MAX_ACTIVE_PRIVATE_GALLERIES,
        limitIncrease: input.galleries,
        // The half that makes a pack usable on `-basico` and `-pro`, where the
        // plan grants nothing. On `-premium` it is redundant with the plan's own
        // grant and harmless: entitlement sets are unioned, never counted.
        grantsEntitlement: EntitlementKey.MANAGE_EXPERIENCE_PRIVATE_GALLERIES,
        // 'owner' for the reason every commerce definition here uses it:
        // PlanCategory has no commerce member. `productDomain` below is the
        // discriminator that actually separates this from an accommodation
        // add-on.
        targetCategories: ['owner'],
        productDomain: ProductDomainEnum.EXPERIENCE,
        // See the factory's doc: the gallery routes do not exist yet.
        isActive: false,
        sortOrder: input.sortOrder
    };
}

/**
 * +5 active galleries.
 *
 * ARS $8.000/mo is DERIVED, not decided: the owner set the three sizes
 * (+5/+10/+20) and said the prices differ, without naming them. The three
 * numbers below price a gallery-month at 1.600 / 1.400 / 1.200 centavos-scaled
 * ARS — sub-linear, so a bigger pack is cheaper per gallery, which is the shape
 * every other pack in this file has. They also stay below the $20.000 step from
 * `experience-basico` to `experience-pro`, so buying capacity never quietly
 * costs more than moving up the ladder. Owner confirms them when the packs are
 * activated.
 */
export const PRIVATE_GALLERIES_5_ADDON: AddonDefinition = privateGalleryPack({
    galleries: 5,
    priceArs: 800_000, // ARS $8.000/month — TBD: owner to confirm at activation
    sortOrder: 9
});

/** +10 active galleries. See {@link PRIVATE_GALLERIES_5_ADDON} for the pricing shape. */
export const PRIVATE_GALLERIES_10_ADDON: AddonDefinition = privateGalleryPack({
    galleries: 10,
    priceArs: 1_400_000, // ARS $14.000/month — TBD: owner to confirm at activation
    sortOrder: 10
});

/** +20 active galleries. See {@link PRIVATE_GALLERIES_5_ADDON} for the pricing shape. */
export const PRIVATE_GALLERIES_20_ADDON: AddonDefinition = privateGalleryPack({
    galleries: 20,
    priceArs: 2_400_000, // ARS $24.000/month — TBD: owner to confirm at activation
    sortOrder: 11
});

/** The three private-gallery packs, smallest first (HOS-1060). */
export const ALL_PRIVATE_GALLERY_ADDONS: readonly AddonDefinition[] = [
    PRIVATE_GALLERIES_5_ADDON,
    PRIVATE_GALLERIES_10_ADDON,
    PRIVATE_GALLERIES_20_ADDON
];

// ─── ALL ADD-ONS ───────────────────────────────────────────────

/** All available add-ons in the system */
export const ALL_ADDONS: AddonDefinition[] = [
    VISIBILITY_BOOST_ADDON,
    VISIBILITY_BOOST_30D_ADDON,
    EXTRA_PHOTOS_ADDON,
    EXTRA_ACCOMMODATIONS_ADDON,
    EXTRA_PROPERTIES_ADDON,
    AI_SUPPORT_ADDON,
    EXTRA_GASTRONOMIES_ADDON,
    EXTRA_EXPERIENCES_ADDON,
    ...ALL_PRIVATE_GALLERY_ADDONS,
    ...ALL_COMMERCE_VISIBILITY_BOOST_ADDONS
];

/**
 * The product domain that owns an add-on, resolved from the CATALOGUE
 * (HOS-1060).
 *
 * ## Why this reads config and not the `billing_addons` row
 *
 * `productDomain` is a Model C `'capability'` fact: it says which vertical an
 * add-on belongs to, which is a structural decision, not a price an operator
 * tunes. Reading it from the database would make an already-seeded environment's
 * stale row the authority over the binary that also carries the check —
 * precisely the ordering hazard `commerce-entitlements.config.ts` was written
 * around, where a lagging row would have locked commerce owners out of
 * capabilities the catalogue advertises.
 *
 * It also means the eight pre-existing `billing_addons` rows need no backfill:
 * the domain was never stored, so there is nothing in them to correct.
 *
 * ## `undefined` is an answer, and it is the safe one
 *
 * An operator can create an add-on through the SPEC-168 admin UI with a slug
 * this catalogue does not know. That add-on has no domain, and this returns
 * `undefined` rather than guessing — no `?? ACCOMMODATION`, which is the exact
 * default HOS-1078 removed from `productDomainForLimitKey` one layer down after
 * it answered confidently for keys nobody had mapped.
 *
 * Callers MUST fail CLOSED on `undefined`.
 *
 * ## Named for its INPUT, because a derived near-twin already exists
 *
 * `apps/web/src/lib/billing/addon-domain.ts` exports its own
 * `resolveAddonProductDomain`, which answers the same question by DERIVING the
 * domain from the add-on's `affectsLimitKey` through `productDomainForLimitKey`
 * (HOS-689). That derivation gates the `/mi-cuenta/addons/` catalogue today, and
 * it is why the cross-vertical purchase the owner described is already refused
 * there for any add-on that raises a cap.
 *
 * It cannot replace this one, and this one does not replace it:
 *
 * - the derivation has nothing to read for an add-on whose `affectsLimitKey` is
 *   `null` (`visibility-boost-7d`/`-30d`), so it coerces those to accommodation
 *   by hand;
 * - it cannot tell apart two add-ons that raise the SAME cap for different
 *   verticals, a shape the catalogue is one edit away from.
 *
 * So this is the DECLARED answer and that is the DERIVED one, deliberately
 * named apart (`…ForAddonSlug`, mirroring `productDomainForLimitKey`) so a
 * reader can never mistake which is which. Folding the derivation into this
 * declaration is follow-up work: the web only sees `AddonResponse`, so it needs
 * `productDomain` carried on that contract first.
 *
 * @param slug - The add-on slug, e.g. from `billing_addons.metadata.slug`.
 * @returns Its product domain, or `undefined` when the slug is not in the
 *   catalogue.
 *
 * @example
 * ```ts
 * productDomainForAddonSlug('extra-experiences-1'); // 'experience'
 * productDomainForAddonSlug('extra-photos-20');     // 'accommodation'
 * productDomainForAddonSlug('operator-invented');   // undefined
 * ```
 */
export function productDomainForAddonSlug(slug: string): ProductDomainValue | undefined {
    return ALL_ADDONS.find((addon) => addon.slug === slug)?.productDomain;
}

/**
 * Retrieves an add-on definition by its unique slug identifier.
 *
 * @param slug - The unique slug of the add-on to find (e.g. 'visibility-boost-7d')
 * @returns The matching AddonDefinition, or undefined if not found
 *
 * @example
 * ```ts
 * const addon = getAddonBySlug('visibility-boost-7d');
 * if (addon) {
 *     console.log(`Found: ${addon.name} - ${addon.priceArs / 100} ARS`);
 * }
 * ```
 */
export function getAddonBySlug(slug: string): AddonDefinition | undefined {
    return ALL_ADDONS.find((addon) => addon.slug === slug);
}
