/**
 * @file trial-plans.config.ts
 * @description The three dedicated trial plans — one per vertical — and the
 * COMPOSITION mechanism that decides what they actually grant (HOS-1012 D-5,
 * spec §6.8).
 *
 * ## Why a dedicated plan and not the entry tier
 *
 * Under card-first the host picked a tier at checkout and trialled THAT tier.
 * With the trial moved to first publish there is no checkout and no picker, so a
 * tier has to be chosen for them — and the entry tier is the one that costs the
 * most: `owner-basico` grants none of what actually sells, so on day 30 the host
 * is asked to pay for exactly what they already had. The decision is the
 * industry's **reverse trial**: full paid features for a window, then a drop to
 * a lower tier.
 *
 * | Plan | Entitlements from | Limits from |
 * | --- | --- | --- |
 * | `owner-trial` | `owner-pro` | `owner-basico` |
 * | `gastronomy-trial` | `gastronomy-pro` | `gastronomy-basico` |
 * | `experience-trial` | `experience-pro` | `experience-basico` |
 *
 * `pro` and not `premium` on purpose: `premium` adds custom branding, the
 * verification badge and advanced stats — things appreciated once you have
 * decided to stay, not things that decide you. Partner is excluded entirely
 * (its plans are `hasTrial: false`).
 *
 * Taking the limits from `basico` is what makes the downgrade problem
 * impossible rather than merely mitigated: the trial's limits ARE the smallest
 * paid tier's, so whatever the host loaded during the trial fits inside any plan
 * they subsequently buy.
 *
 * ## Snapshot vs composition — the invariant, and it runs ONE WAY
 *
 * > **The snapshot is for showing. The composition is for gating.** If the two
 * > ever diverge, what goes stale is a screen, never a door.
 *
 * The `entitlements` / `limits` on each definition below are a SNAPSHOT: they
 * exist so any reader that shows plan information to a human (the admin billing
 * view, the downgrade preview) sees something sensible instead of an empty plan,
 * which would read as *unlimited*. They are **not** what gates a request.
 *
 * What gates a request is {@link TrialPlanComposition}, stored on the plan row's
 * `metadata.trialComposition` and resolved LIVE at every entitlement load (see
 * `loadEntitlements` in `apps/api/src/middlewares/entitlement.ts`). That is not
 * a stylistic preference — HOS-39's Model C makes `entitlements` and
 * `limitsValues` **commercial** fields: the database wins, the seed deliberately
 * does not sync them from config, and the admin `PlanDialog` edits them. So a
 * config-level derivation would keep the trial plan and its sources identical in
 * the repo forever while being false in production from the first operator edit,
 * with nothing red anywhere.
 *
 * Deliberately kept OUT of `ALL_PLANS` — the established idiom for a plan that
 * exists and grants but never shows on the public pricing page, with four
 * precedents (`COMMERCE_LISTING_PLAN`, `PARTNER_LISTING_PLAN`,
 * `TEST_DAILY_PLAN`, the commerce verticals). `ALL_PLANS` drives the public
 * `/plans` endpoint, the accommodation seed loop AND the grant-matrix snapshot
 * tests, so inclusion would break all three.
 */
import { ProductDomainEnum, type ProductDomainValue } from '@repo/schemas';
import { COMMERCE_TRIAL_DAYS, OWNER_TRIAL_DAYS } from '../constants/billing.constants.js';
import type { PlanDefinition } from '../types/plan.types.js';
import {
    EXPERIENCE_BASICO_PLAN,
    EXPERIENCE_PRO_PLAN,
    GASTRONOMY_BASICO_PLAN,
    GASTRONOMY_PRO_PLAN,
    OWNER_BASICO_PLAN,
    OWNER_PRO_PLAN
} from './plans.config.js';

/**
 * The `metadata` key a trial plan's composition is stored under, on both the
 * `billing_plans.metadata` JSONB column and the seed/data-migration writes.
 *
 * Named once so the reader at the entitlement seam and the writers in
 * `@repo/seed` cannot drift on a string literal.
 */
export const TRIAL_COMPOSITION_METADATA_KEY = 'trialComposition';

/**
 * Which plan each half of a trial plan's grants is read from, by SLUG.
 *
 * Slugs and not ids: `billing_plans` has no `slug` column (`name` IS the slug,
 * SPEC-168 convention), ids are per-environment UUIDs, and a slug survives a
 * re-seed of any environment.
 */
export interface TrialPlanComposition {
    /** Slug of the plan whose ENTITLEMENTS the trial grants (the `pro` tier). */
    readonly entitlementsFrom: string;
    /** Slug of the plan whose LIMITS the trial applies (the `basico` tier). */
    readonly limitsFrom: string;
}

/**
 * Reads a {@link TrialPlanComposition} off a plan row's `metadata`, or
 * `undefined` when the plan is not a composed trial plan.
 *
 * Defensive on purpose: `metadata` is an untyped JSONB column that an operator
 * (or a bad migration) can put anything into, and this value decides which
 * grants a request resolves. A malformed composition reads as "not a trial
 * plan", which degrades to the plan's own snapshot rather than to an empty
 * grant set — an empty `limits` map means *unlimited* downstream, so failing
 * towards the snapshot is the only safe direction.
 *
 * @param metadata - The plan row's `metadata` value, of any shape.
 * @returns The composition when both slugs are present and non-empty strings.
 */
export function readTrialComposition(metadata: unknown): TrialPlanComposition | undefined {
    if (typeof metadata !== 'object' || metadata === null) {
        return undefined;
    }
    const raw = (metadata as Record<string, unknown>)[TRIAL_COMPOSITION_METADATA_KEY];
    if (typeof raw !== 'object' || raw === null) {
        return undefined;
    }
    const { entitlementsFrom, limitsFrom } = raw as Record<string, unknown>;
    if (typeof entitlementsFrom !== 'string' || entitlementsFrom.length === 0) {
        return undefined;
    }
    if (typeof limitsFrom !== 'string' || limitsFrom.length === 0) {
        return undefined;
    }
    return { entitlementsFrom, limitsFrom };
}

/** The shape a resolved plan row contributes to a composition. */
export interface TrialGrantSource {
    readonly entitlements?: readonly string[] | null;
    readonly limits?: Readonly<Record<string, number>> | null;
}

/** The grants a composition resolves to. */
export interface TrialComposedGrants {
    readonly entitlements: readonly string[];
    readonly limits: Readonly<Record<string, number>>;
}

/**
 * Takes each half of a trial plan's grants from its own source.
 *
 * One line of logic in ONE place on purpose: this is the exact point a mutation
 * that swaps the two sources has to die, and having it inline at the
 * entitlement seam would leave the guard (T-036) asserting a second,
 * independently-written copy of the same rule.
 *
 * @param input.entitlementsSource - The resolved `pro` plan row.
 * @param input.limitsSource - The resolved `basico` plan row.
 * @returns Entitlements from the first source, limits from the second.
 */
export function composeTrialGrants(input: {
    readonly entitlementsSource: TrialGrantSource;
    readonly limitsSource: TrialGrantSource;
}): TrialComposedGrants {
    return {
        entitlements: input.entitlementsSource.entitlements ?? [],
        limits: input.limitsSource.limits ?? {}
    };
}

/**
 * Builds one vertical's trial plan definition from its two source plans.
 *
 * The entitlements/limits it copies are the SNAPSHOT (see the file docblock) —
 * the gating path never reads them.
 *
 * @param input.slug - The trial plan's slug (and `billing_plans.name`).
 * @param input.name - Buyer-invisible display name; used by admin surfaces.
 * @param input.description - Admin-facing description.
 * @param input.entitlementsSource - The `pro` plan of this vertical.
 * @param input.limitsSource - The `basico` plan of this vertical.
 * @param input.trialDays - The vertical's existing trial length. NOT a new
 *   constant — each vertical inherits the one it already had.
 * @returns The trial plan definition.
 */
function buildTrialPlan(input: {
    slug: string;
    name: string;
    description: string;
    entitlementsSource: PlanDefinition;
    limitsSource: PlanDefinition;
    trialDays: number;
}): PlanDefinition {
    return {
        slug: input.slug,
        name: input.name,
        description: input.description,
        // Same reason `COMMERCE_LISTING_PLAN` and every commerce tier carries
        // `'owner'`: it only satisfies the `PlanCategory` type. For
        // `owner-trial` it is also literally true, and load-bearing — a HOST's
        // live subscription must resolve as owner-category or HOS-217's check
        // discards it. For the two commerce trials `product_domain` is the real
        // discriminator and filters them out long before category is asked.
        category: 'owner',
        // Never sold: the trial is granted at first publish, never bought. No
        // `billing_prices` row is ever created for these plans, so a checkout
        // that somehow reached one would fail with PRICE_NOT_FOUND on top of
        // the `isActive: false` below.
        monthlyPriceArs: 0,
        annualPriceArs: null,
        monthlyPriceUsdRef: 0,
        // The row IS the trial, and its length lives here — this is the
        // "DB-side override on the plan row" the publish path defers to instead
        // of naming a second trial-length constant of its own.
        hasTrial: true,
        trialDays: input.trialDays,
        isDefault: false,
        sortOrder: 0,
        // Not sellable. `billing.plans.findById` and `getPlanBySlug` both
        // deliberately ignore `active`, so entitlement resolution and the trial
        // creator are unaffected; what this does close is the catalogue lookup
        // at checkout, which lists ACTIVE plans only.
        isActive: false,
        // ── SNAPSHOT (for showing, never for gating) ──────────────────────
        entitlements: [...input.entitlementsSource.entitlements],
        limits: [...input.limitsSource.limits]
    };
}

/**
 * Accommodation trial plan — `owner-pro`'s entitlements, `owner-basico`'s
 * limits. See the file docblock for why.
 */
export const OWNER_TRIAL_PLAN: PlanDefinition = buildTrialPlan({
    slug: 'owner-trial',
    name: 'Prueba gratuita',
    description:
        'Hospeda-owned first-publish trial for accommodation hosts (HOS-1012 D-5). Grants owner-pro features with owner-basico limits. Never sold.',
    entitlementsSource: OWNER_PRO_PLAN,
    limitsSource: OWNER_BASICO_PLAN,
    trialDays: OWNER_TRIAL_DAYS
});

/** Gastronomy trial plan. See {@link OWNER_TRIAL_PLAN}. */
export const GASTRONOMY_TRIAL_PLAN: PlanDefinition = buildTrialPlan({
    slug: 'gastronomy-trial',
    name: 'Prueba gratuita — Gastronomía',
    description:
        'Hospeda-owned first-publish trial for gastronomy listings (HOS-1012 D-5). Never sold.',
    entitlementsSource: GASTRONOMY_PRO_PLAN,
    limitsSource: GASTRONOMY_BASICO_PLAN,
    trialDays: COMMERCE_TRIAL_DAYS
});

/** Experience trial plan. See {@link OWNER_TRIAL_PLAN}. */
export const EXPERIENCE_TRIAL_PLAN: PlanDefinition = buildTrialPlan({
    slug: 'experience-trial',
    name: 'Prueba gratuita — Experiencias',
    description:
        'Hospeda-owned first-publish trial for experience listings (HOS-1012 D-5). Never sold.',
    entitlementsSource: EXPERIENCE_PRO_PLAN,
    limitsSource: EXPERIENCE_BASICO_PLAN,
    trialDays: COMMERCE_TRIAL_DAYS
});

/**
 * One trial plan, everything a writer needs to put it in `billing_plans`.
 *
 * The seed, the three data-migrations and the snapshot guard all iterate this
 * ONE list. With three verticals a hardcoded `if (slug === 'owner-trial')` chain
 * is three chances to forget one, and the third is always the one forgotten.
 */
export interface TrialPlanEntry {
    /** The plan definition, carrying the display snapshot. */
    readonly plan: PlanDefinition;
    /** What the runtime actually resolves. Stored on `metadata.trialComposition`. */
    readonly composition: TrialPlanComposition;
    /** The `billing_plans.product_domain` to stamp. */
    readonly productDomain: ProductDomainValue;
}

/** Every trial plan, in vertical order. Deliberately NOT part of `ALL_PLANS`. */
export const ALL_TRIAL_PLANS: readonly TrialPlanEntry[] = [
    {
        plan: OWNER_TRIAL_PLAN,
        composition: {
            entitlementsFrom: OWNER_PRO_PLAN.slug,
            limitsFrom: OWNER_BASICO_PLAN.slug
        },
        productDomain: ProductDomainEnum.ACCOMMODATION
    },
    {
        plan: GASTRONOMY_TRIAL_PLAN,
        composition: {
            entitlementsFrom: GASTRONOMY_PRO_PLAN.slug,
            limitsFrom: GASTRONOMY_BASICO_PLAN.slug
        },
        productDomain: ProductDomainEnum.GASTRONOMY
    },
    {
        plan: EXPERIENCE_TRIAL_PLAN,
        composition: {
            entitlementsFrom: EXPERIENCE_PRO_PLAN.slug,
            limitsFrom: EXPERIENCE_BASICO_PLAN.slug
        },
        productDomain: ProductDomainEnum.EXPERIENCE
    }
];

/**
 * Which trial plan a vertical's first publish starts the trial on.
 *
 * `partner` is absent on purpose, not by omission: the three partner plans are
 * `hasTrial: false` and no partner flow ever starts a trial. An absent key
 * makes {@link resolveTrialPlanSlug} answer `undefined`, which the callers
 * treat as "no trial here" — the safe direction.
 */
export const TRIAL_PLAN_SLUG_BY_PRODUCT_DOMAIN: Readonly<
    Partial<Record<ProductDomainValue, string>>
> = Object.freeze(
    Object.fromEntries(ALL_TRIAL_PLANS.map((e) => [e.productDomain, e.plan.slug]))
) as Readonly<Partial<Record<ProductDomainValue, string>>>;

/**
 * The trial plan slug for a product domain.
 *
 * The ONE place a vertical is turned into a trial plan slug — the same shape
 * `resolveCommercePlanSlug` uses for the paid catalogue, and for the same
 * reason: `createTrialSubscription` throws when the resolved plan's
 * `product_domain` does not match the requested one, so a mapping mistake here
 * fails loudly instead of silently consuming the wrong vertical's trial.
 *
 * @param input.productDomain - The vertical the trial is being started in.
 * @returns The trial plan's slug, or `undefined` for a domain with no trial.
 */
export function resolveTrialPlanSlug(input: {
    readonly productDomain: ProductDomainValue;
}): string | undefined {
    return TRIAL_PLAN_SLUG_BY_PRODUCT_DOMAIN[input.productDomain];
}

/** Every trial plan slug, for membership tests. */
export const TRIAL_PLAN_SLUGS: readonly string[] = ALL_TRIAL_PLANS.map((e) => e.plan.slug);

/**
 * Whether a slug names one of the composed trial plans.
 *
 * @param slug - A plan slug (`billing_plans.name`).
 * @returns True when the slug is a trial plan's.
 */
export function isTrialPlanSlug(slug: string): boolean {
    return TRIAL_PLAN_SLUGS.includes(slug);
}
