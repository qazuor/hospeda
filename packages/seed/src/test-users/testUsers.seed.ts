import {
    ALL_EXPERIENCE_PLANS,
    ALL_GASTRONOMY_PLANS,
    ALL_PLANS,
    COMMERCE_TRIAL_DAYS,
    DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL,
    getAddonBySlug,
    OWNER_TRIAL_DAYS
} from '@repo/billing';
import type { DrizzleClient } from '@repo/db';
import {
    accounts,
    and,
    billingAddonPurchases,
    billingCustomers,
    billingPlans,
    billingSubscriptions,
    eq,
    getDb,
    sql,
    UserModel
} from '@repo/db';
import {
    LifecycleStatusEnum,
    ProductDomainEnum,
    type ProductDomainValue,
    RoleEnum,
    RoleGrantReason,
    SubscriptionStatusEnum,
    VisibilityEnum
} from '@repo/schemas';
import { ADDON_RECALC_SOURCE_ID, getUserRoles, grantRole, revokeRole } from '@repo/service-core';
import { hash } from 'bcryptjs';
import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';
import { summaryTracker } from '../utils/summaryTracker.js';
import { ensureExperienceAtCapListing, ensureGastronomyAtCapListing } from './commerceListing.js';
import { ensureHostAccommodation } from './hostAccommodation.js';
import { ensureHostPromotion } from './hostPromotion.js';
import {
    ensureHostTradeOwnership,
    HOST_TRADE_OWNER_EMAIL,
    HOST_TRADE_OWNER_SLUG
} from './hostTradeOwnership.js';
import { markUserReady } from './markUserReady.js';

/**
 * Number of bcrypt salt rounds for hashing test user passwords.
 * Must match apps/api/src/lib/auth.ts BCRYPT_SALT_ROUNDS (12).
 */
const SALT_ROUNDS = 12;

/**
 * Shared password for all test users.
 * Dev-only convenience — these accounts never exist on staging/prod.
 */
const TEST_PW = 'Password123!';

/**
 * Entity name used by summaryTracker for this seed.
 */
const ENTITY_NAME = 'Test Users';

/**
 * Every plan `ensureAddonPurchase` can resolve a base limit from, across the
 * verticals this seed grants an addon fixture for (HOS-1268).
 *
 * `ALL_PLANS` alone (accommodation `owner-*` + `tourist-*`) is what
 * `host-pro-plus-addon@local.test` happened to work against — it does NOT
 * include the commerce verticals at all (`ALL_GASTRONOMY_PLANS` /
 * `ALL_EXPERIENCE_PLANS` are separate exports, and `PLANS_BY_CATEGORY.complex`
 * is deliberately empty). A gastronomy/experience addon fixture resolving its
 * base plan against `ALL_PLANS` alone would throw
 * `Plan "gastronomy-basico" not found in ALL_PLANS catalog` even though the
 * plan is real and seeded — this constant is what fixes that.
 */
const ALL_SEED_ADDON_BASE_PLANS = [...ALL_PLANS, ...ALL_GASTRONOMY_PLANS, ...ALL_EXPERIENCE_PLANS];

/**
 * Spec for one test user in the matrix.
 */
export interface TestUserSpec {
    readonly email: string;
    readonly displayName: string;
    readonly role: (typeof RoleEnum)[keyof typeof RoleEnum];
    /**
     * Slug of the billing plan to activate for this user.
     * When undefined the user has no active subscription (free tier).
     */
    readonly planSlug?: string;
    /**
     * Initial subscription status. Defaults to `'active'` when omitted
     * (matches the original Block 1 user matrix).
     *
     * Accepts every member of {@link SubscriptionStatusEnum} (HOS-1268) — not
     * just `'active' | 'trialing'`. Before HOS-1268 this field could not
     * express `past_due`, `paused`, `cancelled`, `comp` or `courtesy` in ANY
     * vertical, which meant mora/pausa/cancelación/cortesía could not be
     * reproduced locally at all, and every bug fix that lived in one of those
     * states had to ship without a regression test. `ensureSubscription`
     * populates the extra columns each status needs (`trialStart`/`trialEnd`
     * for `TRIALING`, `canceledAt`/`cancelAtPeriodEnd` for `CANCELLED`,
     * `courtesyStartsAt`/`courtesyEndsAt`/`courtesyCyclesGranted` for
     * `COURTESY`); every other status writes cleanly with no extra columns.
     *
     * `TRIALING` still needs `trialDays` below. `COMP`/`COURTESY` bypass
     * MercadoPago entirely, same as every other row this seed writes (see
     * `ensureBillingCustomer`'s docblock) — the real `courtesy-grant.service.ts`
     * additionally requires a live `mpSubscriptionId` to pause, which a seeded
     * row deliberately never has, so a courtesy fixture is written directly
     * rather than through that service.
     */
    readonly subStatus?: (typeof SubscriptionStatusEnum)[keyof typeof SubscriptionStatusEnum];
    /**
     * Trial window in days when `subStatus === SubscriptionStatusEnum.TRIALING`.
     * Defaults to `OWNER_TRIAL_DAYS` (the HOST trial window per
     * `packages/billing/src/constants/billing.constants.ts`, 30 days as of
     * the 2026-08-15 owner decision). Pass `COMMERCE_TRIAL_DAYS` for a
     * gastronomy/experience trial fixture. Ignored when status is anything else.
     */
    readonly trialDays?: number;
    /**
     * Optional addon slug to apply to the user's active subscription. When
     * present the seed inserts both a `billing_addon_purchases` row
     * (status='active', limit/entitlement adjustments populated) and a
     * `billing_customer_limits` row reflecting the aggregated post-addon
     * limit (base plan limit + addon increase). Mirrors the production
     * `applyAddonEntitlements` flow without going through QZPay so smokes
     * 1.7, 1.12 and 2.5 can exercise an addon-extended limit without the
     * SQL-direct cache-bust workaround. Requires `planSlug`.
     */
    readonly addonSlug?: string;
    /**
     * Additional roles to grant alongside `role`, so a single test user can
     * hold more than one hat at once (HOS-296 multi-role). Used for the
     * HOST + COMMERCE_OWNER dual-role fixture (HOS-694 AC-3 / AC-12).
     */
    readonly extraRoles?: readonly (typeof RoleEnum)[keyof typeof RoleEnum][];
    /**
     * OVERRIDE for `billing_subscriptions.product_domain` (HOS-694). Omitting it
     * no longer means "let the column default answer" — since HOS-1233 T-035 the
     * domain is derived from `planSlug`'s own plan row, so every fixture is
     * stamped with its plan's real vertical whether or not it declares one here.
     *
     * That derivation is why this field is now rarely needed. It used to be
     * REQUIRED for the two commerce verticals and deliberately omitted for
     * accommodation, tourist and complex "where the column's `'accommodation'`
     * default is already correct" — reasoning that was true for accommodation,
     * incidental for complex, and wrong for tourist, which has been a domain of
     * its own since this spec. Declare a value only for a fixture that
     * deliberately wants a domain its plan does NOT name.
     */
    readonly subscriptionProductDomain?: ProductDomainValue;
    /**
     * When true, seeds exactly one gastronomy listing owned by this user so
     * their subscription starts AT its `MAX_GASTRONOMIES` cap (HOS-694
     * AC-13 / AC-30). Requires `planSlug` to resolve to a gastronomy-vertical
     * plan.
     */
    readonly ownsGastronomyAtCap?: boolean;
    /**
     * When true, seeds exactly one experience listing owned by this user so
     * their subscription starts AT its `MAX_EXPERIENCES` cap (HOS-1268 —
     * mirrors {@link ownsGastronomyAtCap}, which existed for gastronomy only;
     * experiences had no equivalent fixture). Requires `planSlug` to resolve
     * to an experience-vertical plan.
     */
    readonly ownsExperienceAtCap?: boolean;
}

/**
 * One entry per billing state that, before HOS-1268, could not be seeded in
 * ANY vertical: `past_due` ("mora"), `cancelled`, `paused` and `comp`, plus
 * `courtesy` (added to the vocabulary later by HOS-180, but equally
 * unreachable here until now). `active` and `trialing` are excluded — every
 * vertical already had at least one fixture for those.
 *
 * `PAUSED` here means a REAL pause (no courtesy window) — `ensureSubscription`
 * only stamps the courtesy columns when `subStatus === COURTESY`, so this row
 * exercises the "entitlements cut" branch of `deriveCourtesyStatus`'s truth
 * table, not the gift.
 */
const BILLING_STATE_MATRIX: readonly {
    readonly suffix: string;
    readonly displaySuffix: string;
    readonly subStatus: (typeof SubscriptionStatusEnum)[keyof typeof SubscriptionStatusEnum];
}[] = [
    { suffix: 'past-due', displaySuffix: 'En Mora', subStatus: SubscriptionStatusEnum.PAST_DUE },
    {
        suffix: 'cancelled',
        displaySuffix: 'Cancelado',
        subStatus: SubscriptionStatusEnum.CANCELLED
    },
    { suffix: 'paused', displaySuffix: 'Pausado', subStatus: SubscriptionStatusEnum.PAUSED },
    {
        suffix: 'comp',
        displaySuffix: 'Cortesía Permanente',
        subStatus: SubscriptionStatusEnum.COMP
    },
    {
        suffix: 'courtesy',
        displaySuffix: 'Cortesía Temporal',
        subStatus: SubscriptionStatusEnum.COURTESY
    }
];

/**
 * Builds the five {@link BILLING_STATE_MATRIX} fixtures for one vertical
 * (HOS-1268), so the vertical × state matrix the issue asks for is generated
 * once instead of hand-written 20 times with the same shape repeated.
 *
 * The state-specific column wiring (trialStart, canceledAt/cancelAtPeriodEnd,
 * courtesyStartsAt/courtesyEndsAt/courtesyCyclesGranted) lives exactly once,
 * in `ensureSubscription` — this function only varies the identity
 * (email/displayName), role and plan across the five otherwise-identical
 * fixtures.
 *
 * `subscriptionProductDomain` is deliberately never set here: since HOS-1233
 * T-035 the domain derives from `planSlug`'s own `billing_plans` row (see
 * `TestUserSpec.subscriptionProductDomain`'s docblock), so declaring it would
 * be redundant at best and a silent lie at worst if it ever drifted from what
 * the plan actually names.
 *
 * @param input.emailPrefix - e.g. `'host'` → `host-past-due@local.test`.
 * @param input.displayNamePrefix - e.g. `'Host'` → `'Host En Mora'`.
 * @param input.role - The declared role every fixture in this group shares.
 * @param input.extraRoles - Additional roles, same as {@link TestUserSpec.extraRoles}.
 * @param input.planSlug - The sellable plan slug for this vertical (its
 *   `product_domain` row is what the subscription derives its domain from).
 */
function buildBillingStateFixtures(input: {
    readonly emailPrefix: string;
    readonly displayNamePrefix: string;
    readonly role: (typeof RoleEnum)[keyof typeof RoleEnum];
    readonly extraRoles?: readonly (typeof RoleEnum)[keyof typeof RoleEnum][];
    readonly planSlug: string;
}): TestUserSpec[] {
    return BILLING_STATE_MATRIX.map(({ suffix, displaySuffix, subStatus }) => ({
        email: `${input.emailPrefix}-${suffix}@local.test`,
        displayName: `${input.displayNamePrefix} ${displaySuffix}`,
        role: input.role,
        extraRoles: input.extraRoles,
        planSlug: input.planSlug,
        subStatus
    }));
}

/**
 * The 42 test users created by this seed (17 pre-existing — 12 from SPEC-143
 * Block 1, `host-provider@local.test` added by HOS-376 T-013, and 4
 * commerce-owner fixtures added by HOS-694 — plus 25 added by HOS-1268: the
 * gastronomy/experience trial, addon and at-cap fixtures accommodation already
 * had, and the past_due/cancelled/paused/comp/courtesy billing-state matrix
 * across all four verticals — see `buildBillingStateFixtures`).
 *
 * `tourist-plus@local.test` was removed by HOS-1224 along with the plan it
 * existed to exercise. It was not repointed: `tourist-vip` is the only
 * surviving paid tourist tier and `tourist-vip@local.test` already covers it,
 * so repointing would have produced a byte-identical duplicate under a
 * misleading address. The coverage it carried — a tourist tier BETWEEN free
 * and VIP — has no subject left in the product.
 *
 * Note the resolution below is fail-closed on purpose: a `planSlug` absent
 * from the seeded `billing_plans` table throws rather than seeding a planless
 * user, which is what makes a stale fixture surface at seed time instead of
 * as a silent gap. (Not the in-memory `ALL_PLANS` TS constant specifically —
 * `resolvePlan` queries the DB row, so a gastronomy/experience/complex/trial
 * plan slug resolves fine even though none of those live in `ALL_PLANS`,
 * which only ever held the accommodation + tourist tiers.)
 *
 * NOTE: super-admin@local.test and admin@local.test are intentionally
 * excluded — the required seed already creates superadmin@hospeda.com.ar
 * and admin@hospeda.com.ar via admin-user.json / super-admin-user.json.
 * Those accounts are the canonical admin credentials for local dev.
 */
export const TEST_USERS: readonly TestUserSpec[] = [
    // Staff (no billing)
    { email: 'editor@local.test', displayName: 'Editor Local', role: RoleEnum.EDITOR },
    { email: 'sponsor@local.test', displayName: 'Sponsor Local', role: RoleEnum.SPONSOR },
    // Tourist tier (USER role)
    { email: 'tourist-free@local.test', displayName: 'Turista Free', role: RoleEnum.USER },
    {
        email: 'tourist-vip@local.test',
        displayName: 'Turista VIP',
        role: RoleEnum.USER,
        planSlug: 'tourist-vip'
    },
    // Host tier (HOST role)
    {
        email: 'host-basico@local.test',
        displayName: 'Host Basico',
        role: RoleEnum.HOST,
        planSlug: 'owner-basico'
    },
    {
        email: 'host-pro@local.test',
        displayName: 'Host Pro',
        role: RoleEnum.HOST,
        planSlug: 'owner-pro'
    },
    {
        email: 'host-premium@local.test',
        displayName: 'Host Premium',
        role: RoleEnum.HOST,
        planSlug: 'owner-premium'
    },
    // Host with addon applied (SPEC-143 #32). owner-pro base = 15 photos, plus
    // extra-photos-20 addon = 35 photos total. Exercises the addon-aggregated
    // limit path in billing_customer_limits without bypassing applyAddonEntitlements.
    {
        email: 'host-pro-plus-addon@local.test',
        displayName: 'Host Pro Plus Addon',
        role: RoleEnum.HOST,
        planSlug: 'owner-pro',
        addonSlug: 'extra-photos-20'
    },
    // Trial-state host (SPEC-143 Block 3 — trial lifecycle smoke). status='trialing',
    // OWNER_TRIAL_DAYS-day window starting at seed time.
    //
    // Plan is `owner-trial`, NOT `owner-basico` (fixed HOS-1268 — the previous
    // comment here called `owner-basico` "the canonical trial-eligible plan",
    // which was true under card-first but stopped being true at HOS-1012 D-5:
    // `owner-trial` is the dedicated, seeded trial plan (owner-pro's
    // entitlements + owner-basico's limits — see
    // `packages/billing/src/config/trial-plans.config.ts` and
    // `accommodation-publish-deps.ts`'s own docblock, which spells out that
    // `owner-basico` was "the correct placeholder BEFORE D-5 was decided").
    // A fixture still pinned to `owner-basico` would exercise the wrong
    // entitlement composition for every trial-lifecycle test that reads what
    // the host can actually do during the trial, not just its status.
    {
        email: 'host-trial@local.test',
        displayName: 'Host Trial',
        role: RoleEnum.HOST,
        planSlug: 'owner-trial',
        subStatus: SubscriptionStatusEnum.TRIALING,
        trialDays: OWNER_TRIAL_DAYS
    },
    // Dual-role host (HOS-376 T-013). A HOST who ALSO owns a host_trades
    // listing. Every other host in this matrix is only a host, and no test user
    // owns a provider listing at all — so "a host who is also a provider can
    // rate OTHER providers but not their own" (AC-16 / AC-17) has no account to
    // exercise it with. Ownership of the listing is attached separately by
    // `ensureHostTradeOwnership`, since it lives on the host_trades row.
    {
        email: 'host-provider@local.test',
        displayName: 'Host Provider',
        role: RoleEnum.HOST,
        planSlug: 'owner-basico'
    },
    // Commerce owner tier (COMMERCE_OWNER role, HOS-694). The SPEC-143
    // matrix had no commerce owner at all until now: HOS-688 introduced
    // per-vertical billing (MAX_GASTRONOMIES / MAX_EXPERIENCES) with nothing
    // local to verify it against. `subscriptionProductDomain` stamps
    // `billing_subscriptions.product_domain` so `subscriptionMatchesDomain`
    // resolves each user's cap from the right vertical plan.
    // HOS-964 follow-up (2026-09-07 smoke finding): `extraRoles` grants the
    // per-vertical role (GASTRONOMY_OWNER / EXPERIENCE_OWNER) alongside the
    // legacy `role: COMMERCE_OWNER` above, matching what production's
    // `createForOwner` (base-commerce-listing.service.ts) actually grants in
    // the same transaction as the listing (HOS-1077). Without this, these
    // fixtures only ever held the retiring COMMERCE_OWNER, and any audience
    // targeting gated on the vertical role (e.g. a What's New entry, or the
    // web welcome-tour split from HOS-788) silently never reached them.
    {
        email: 'commerce-gastronomy@local.test',
        displayName: 'Comercio Gastronomía',
        role: RoleEnum.COMMERCE_OWNER,
        extraRoles: [RoleEnum.GASTRONOMY_OWNER],
        planSlug: DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL.gastronomy,
        subscriptionProductDomain: ProductDomainEnum.GASTRONOMY
    },
    {
        email: 'commerce-experience@local.test',
        displayName: 'Comercio Experiencia',
        role: RoleEnum.COMMERCE_OWNER,
        extraRoles: [RoleEnum.EXPERIENCE_OWNER],
        planSlug: DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL.experience,
        subscriptionProductDomain: ProductDomainEnum.EXPERIENCE
    },
    // Owns exactly one gastronomy listing, at MAX_GASTRONOMIES=1 — the state
    // AC-13 and AC-30 need to exercise and that nobody could reproduce
    // locally before this (HOS-694).
    {
        email: 'commerce-gastronomy-at-cap@local.test',
        displayName: 'Comercio Gastronomía Al Tope',
        role: RoleEnum.COMMERCE_OWNER,
        extraRoles: [RoleEnum.GASTRONOMY_OWNER],
        planSlug: DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL.gastronomy,
        subscriptionProductDomain: ProductDomainEnum.GASTRONOMY,
        ownsGastronomyAtCap: true
    },
    // Owns exactly one experience listing, at MAX_EXPERIENCES=1 (HOS-1268 —
    // experiences had no at-cap fixture at all before this; gastronomy's
    // above was the only one). Domain is left to derive from the plan (see
    // `TestUserSpec.subscriptionProductDomain`'s docblock) rather than
    // declared, per HOS-1233 T-035.
    {
        email: 'commerce-experience-at-cap@local.test',
        displayName: 'Comercio Experiencia Al Tope',
        role: RoleEnum.COMMERCE_OWNER,
        extraRoles: [RoleEnum.EXPERIENCE_OWNER],
        planSlug: DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL.experience,
        ownsExperienceAtCap: true
    },
    // Trial-state commerce owners (HOS-1268). Mirrors `host-trial@local.test`
    // one vertical over: dedicated seeded trial plan (`gastronomy-trial` /
    // `experience-trial`, HOS-1012 D-5), `COMMERCE_TRIAL_DAYS`-day window.
    // Neither existed before this — the matrix had a trial fixture for
    // accommodation only.
    {
        email: 'commerce-gastronomy-trial@local.test',
        displayName: 'Comercio Gastronomía Trial',
        role: RoleEnum.COMMERCE_OWNER,
        extraRoles: [RoleEnum.GASTRONOMY_OWNER],
        planSlug: 'gastronomy-trial',
        subStatus: SubscriptionStatusEnum.TRIALING,
        trialDays: COMMERCE_TRIAL_DAYS
    },
    {
        email: 'commerce-experience-trial@local.test',
        displayName: 'Comercio Experiencia Trial',
        role: RoleEnum.COMMERCE_OWNER,
        extraRoles: [RoleEnum.EXPERIENCE_OWNER],
        planSlug: 'experience-trial',
        subStatus: SubscriptionStatusEnum.TRIALING,
        trialDays: COMMERCE_TRIAL_DAYS
    },
    // Commerce owners with an addon applied (HOS-1268 — mirrors
    // `host-pro-plus-addon@local.test`). `extra-gastronomies-1` /
    // `extra-experiences-1` each raise their vertical's MAX_* cap by 1 on top
    // of the sellable plan's base of 1, so the aggregated limit is 2.
    {
        email: 'commerce-gastronomy-plus-addon@local.test',
        displayName: 'Comercio Gastronomía Plus Addon',
        role: RoleEnum.COMMERCE_OWNER,
        extraRoles: [RoleEnum.GASTRONOMY_OWNER],
        planSlug: DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL.gastronomy,
        addonSlug: 'extra-gastronomies-1'
    },
    {
        email: 'commerce-experience-plus-addon@local.test',
        displayName: 'Comercio Experiencia Plus Addon',
        role: RoleEnum.COMMERCE_OWNER,
        extraRoles: [RoleEnum.EXPERIENCE_OWNER],
        planSlug: DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL.experience,
        addonSlug: 'extra-experiences-1'
    },
    // Dual-role fixture (HOS-296 multi-role, HOS-694). AC-3 asserts a HOST
    // retains the role after being granted COMMERCE_OWNER; AC-12 asserts the
    // header's three-option publish control renders for an account already
    // holding either role. HOS-30's accommodation fixture still applies
    // (triggered by `role === HOST`); COMMERCE_OWNER is granted directly,
    // with no backing listing, since role possession alone is what the nav
    // gate and the header control read.
    {
        email: 'host-commerce@local.test',
        displayName: 'Host y Comercio',
        role: RoleEnum.HOST,
        planSlug: 'owner-basico',
        extraRoles: [RoleEnum.COMMERCE_OWNER]
    },
    // Complex / CLIENT_MANAGER tier
    {
        email: 'complex-basico@local.test',
        displayName: 'Complex Basico',
        role: RoleEnum.CLIENT_MANAGER,
        planSlug: 'complex-basico'
    },
    {
        email: 'complex-pro@local.test',
        displayName: 'Complex Pro',
        role: RoleEnum.CLIENT_MANAGER,
        planSlug: 'complex-pro'
    },
    {
        email: 'complex-premium@local.test',
        displayName: 'Complex Premium',
        role: RoleEnum.CLIENT_MANAGER,
        planSlug: 'complex-premium'
    },
    // Billing-state matrix (HOS-1268): past_due / cancelled / paused / comp /
    // courtesy, one fixture per vertical (accommodation, gastronomy,
    // experience, tourist) — see `buildBillingStateFixtures`'s docblock.
    // This is the gap the issue exists to close: before this, none of these
    // five states could be seeded in ANY vertical, so a regression test for a
    // bug living in mora/cancelación/pausa/cortesía had nowhere to run.
    ...buildBillingStateFixtures({
        emailPrefix: 'host',
        displayNamePrefix: 'Host',
        role: RoleEnum.HOST,
        planSlug: 'owner-basico'
    }),
    ...buildBillingStateFixtures({
        emailPrefix: 'commerce-gastronomy',
        displayNamePrefix: 'Comercio Gastronomía',
        role: RoleEnum.COMMERCE_OWNER,
        extraRoles: [RoleEnum.GASTRONOMY_OWNER],
        planSlug: DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL.gastronomy
    }),
    ...buildBillingStateFixtures({
        emailPrefix: 'commerce-experience',
        displayNamePrefix: 'Comercio Experiencia',
        role: RoleEnum.COMMERCE_OWNER,
        extraRoles: [RoleEnum.EXPERIENCE_OWNER],
        planSlug: DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL.experience
    }),
    ...buildBillingStateFixtures({
        emailPrefix: 'tourist',
        displayNamePrefix: 'Turista',
        role: RoleEnum.USER,
        planSlug: 'tourist-vip'
    })
] as const;

/**
 * Derives firstName + lastName from a displayName string.
 * Splits on the first space; if no space, uses displayName as firstName and 'Test' as lastName.
 */
function splitDisplayName(displayName: string): { firstName: string; lastName: string } {
    const spaceIdx = displayName.indexOf(' ');
    if (spaceIdx === -1) {
        return { firstName: displayName, lastName: 'Test' };
    }
    return {
        firstName: displayName.slice(0, spaceIdx),
        lastName: displayName.slice(spaceIdx + 1)
    };
}

/**
 * Resolves a billing plan id from the DB by slug (the `name` column).
 *
 * Billing plans are pre-seeded by billingPlans.seed.ts (required seed).
 * The `name` column stores the plan slug — see billingPlans.seed.ts:45 and
 * apps/api/src/services/subscription-checkout.service.ts:72 for context.
 *
 * @throws {Error} When the plan is not found (billing plans must be seeded first)
 */
async function resolvePlan(
    planSlug: string,
    db: DrizzleClient
): Promise<{ readonly id: string; readonly productDomain: ProductDomainValue }> {
    const rows = await db
        .select({ id: billingPlans.id, productDomain: billingPlans.productDomain })
        .from(billingPlans)
        .where(eq(billingPlans.name, planSlug))
        .limit(1);

    const row = rows[0];
    if (!row) {
        throw new Error(
            `Plan "${planSlug}" not found in billing_plans. Run the required seed (billingPlans.seed.ts) before seedTestUsers.`
        );
    }

    // The column is a plain `varchar`, so its TS type is `string` and narrowing
    // it is a real check rather than a formality: a plan row carrying a domain
    // no longer in the enum fails the seed here, loudly, instead of being
    // copied onto every subscription that plan backs.
    const domains: readonly string[] = Object.values(ProductDomainEnum);
    if (!domains.includes(row.productDomain)) {
        throw new Error(
            `Plan "${planSlug}" reports product_domain "${row.productDomain}", which is not a ProductDomainEnum member.`
        );
    }

    return { id: row.id, productDomain: row.productDomain as ProductDomainValue };
}

/**
 * Ensures a `billing_customers` row exists for the given user.
 * Returns the customer id (existing or newly created).
 *
 * NOTE: We insert directly into the qzpay-drizzle schema tables instead of
 * going through the QZPay API because:
 * (a) initialising a MercadoPago adapter requires real MP credentials which
 *     are not available in the seed environment,
 * (b) for local entitlement testing we never need MP — we only need the
 *     billing_customers + billing_subscriptions rows to exist so that
 *     loadEntitlements() returns the correct plan gates, and
 * (c) the direct-insert pattern is already approved for users/accounts by
 *     the same SPEC-143 Block 1 decision.
 */
async function ensureBillingCustomer(
    userId: string,
    email: string,
    db: DrizzleClient
): Promise<string> {
    const existing = await db
        .select({ id: billingCustomers.id })
        .from(billingCustomers)
        .where(eq(billingCustomers.externalId, userId))
        .limit(1);

    const existingRow = existing[0];
    if (existingRow) {
        return existingRow.id;
    }

    const inserted = await db
        .insert(billingCustomers)
        .values({
            email,
            externalId: userId,
            livemode: false,
            metadata: { source: 'local-test-users-seed' }
        })
        .returning({ id: billingCustomers.id });

    const insertedRow = inserted[0];
    if (!insertedRow) {
        throw new Error(`Insert into billing_customers returned no row for userId=${userId}`);
    }
    return insertedRow.id;
}

/** Adds (or subtracts, for a negative `days`) whole days to a `Date`, returning a new instance. */
function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

/**
 * Ensures a `billing_subscriptions` row exists for the given customer + plan
 * with the requested status.
 *
 * Idempotent on customer_id. Every {@link SubscriptionStatusEnum} member is
 * accepted (HOS-1268); most write only `status` + the default period dates,
 * but four need extra columns to be a REALISTIC row of that state rather than
 * merely a string the entitlement code happens to switch on:
 *
 * - `TRIALING` stamps `trial_start = now()` and `trial_end = now() + trialDays`
 *   so the trial cron logic (apply-scheduled-plan-changes / trial expiry) has
 *   real dates to act on.
 * - `PAST_DUE` anchors `current_period_end` 3 days in the past, inside the
 *   7-day grace window `past-due-grace.middleware.ts` enforces (see
 *   `docs/billing/grace-period-source-of-truth.md`). This is the ONE local way
 *   to reach this status at all: `dunning.job.ts`'s own docblock (HOS-191 F5)
 *   documents `past_due` as structurally unreachable through any local code
 *   path — nothing in this codebase ever WRITES it, so a direct seed insert is
 *   not a shortcut around a slower path, it is the only path.
 * - `CANCELLED` mirrors what `finalize-cancelled-subs.job.ts` actually
 *   produces: `current_period_end` in the past (the period already elapsed),
 *   `cancel_at_period_end = true` and `canceled_at` stamped at the original
 *   cancel request (see `subscription-cancel.service.ts`).
 * - `COURTESY` stamps `courtesy_starts_at` / `courtesy_ends_at` /
 *   `courtesy_cycles_granted` (HOS-180/HOS-993 typed columns), still inside
 *   the gifted window, mirroring `courtesy-grant.service.ts`'s own write.
 *
 * Skips silently if a subscription already exists for this customer — the
 * one-time seeded shape is treated as authoritative; tests that want to
 * exercise a transition (active → cancelled, trialing → expired) should
 * UPDATE the existing row instead of relying on the seed to swap status.
 *
 * @param productDomain - Stamped on `billing_subscriptions.product_domain`
 *   (HOS-694). REQUIRED, and resolved by the caller from the PLAN's own row
 *   rather than declared per test user.
 *
 *   It used to be optional, on the stated grounds that "the column's
 *   `'accommodation'` default is already correct" for accommodation, tourist
 *   and complex plans. That reasoning was the bug HOS-1233 exists to kill:
 *   tourist is a domain of its own since this spec, so every tourist test user
 *   was seeded claiming to be an accommodation subscriber — locally reproducing
 *   the exact misfiling measured in prod and staging (spec F-4b). Deriving the
 *   value from the plan means a vertical added later cannot be forgotten here,
 *   because nobody has to remember to declare anything.
 */
async function ensureSubscription(
    customerId: string,
    planId: string,
    db: DrizzleClient,
    productDomain: ProductDomainValue,
    subStatus: (typeof SubscriptionStatusEnum)[keyof typeof SubscriptionStatusEnum] = SubscriptionStatusEnum.ACTIVE,
    trialDays = OWNER_TRIAL_DAYS
): Promise<string> {
    const existing = await db
        .select({ id: billingSubscriptions.id })
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.customerId, customerId))
        .limit(1);

    const existingRow = existing[0];
    if (existingRow) {
        return existingRow.id;
    }

    const now = new Date();
    // Default 30-day window — local testing only, period accuracy doesn't
    // matter except where a status's OWN semantics depend on it (past_due,
    // cancelled below).
    let periodStart = now;
    let periodEnd = addDays(now, 30);

    const isTrialing = subStatus === SubscriptionStatusEnum.TRIALING;
    const trialStart = isTrialing ? now : null;
    const trialEnd = isTrialing ? addDays(now, trialDays) : null;

    // Extra per-status fields. Left `null`/`false` (their column defaults) for
    // every status that doesn't need them, so ACTIVE/PAUSED/COMP/EXPIRED/
    // PENDING_PROVIDER/ABANDONED all write the same minimal shape they always
    // did.
    let canceledAt: Date | null = null;
    let cancelAtPeriodEnd = false;
    let courtesyStartsAt: Date | null = null;
    let courtesyEndsAt: Date | null = null;
    let courtesyCyclesGranted: number | null = null;

    if (subStatus === SubscriptionStatusEnum.PAST_DUE) {
        periodEnd = addDays(now, -3);
        periodStart = addDays(periodEnd, -30);
    } else if (subStatus === SubscriptionStatusEnum.CANCELLED) {
        periodEnd = addDays(now, -1);
        periodStart = addDays(periodEnd, -30);
        canceledAt = periodEnd;
        cancelAtPeriodEnd = true;
    } else if (subStatus === SubscriptionStatusEnum.COURTESY) {
        courtesyStartsAt = now;
        courtesyEndsAt = addDays(now, 30);
        courtesyCyclesGranted = 1;
    }

    const inserted = await db
        .insert(billingSubscriptions)
        .values({
            customerId,
            // billing_subscriptions.plan_id is varchar (not UUID), so we store
            // the UUID string directly. See CLAUDE.md gotcha: "billing_plans.id
            // is UUID but billing_subscriptions.plan_id is varchar".
            planId,
            status: subStatus,
            // Use monthly interval for all test subscriptions. For local entitlement
            // testing the billing cycle does not matter; only status drives behavior.
            billingInterval: 'month',
            livemode: false,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            productDomain,
            ...(isTrialing ? { trialStart, trialEnd } : {}),
            ...(canceledAt ? { canceledAt, cancelAtPeriodEnd } : {}),
            ...(courtesyStartsAt ? { courtesyStartsAt, courtesyEndsAt, courtesyCyclesGranted } : {})
        })
        .returning({ id: billingSubscriptions.id });

    const insertedRow = inserted[0];
    if (!insertedRow) {
        throw new Error(
            `Insert into billing_subscriptions returned no row for customerId=${customerId}`
        );
    }
    return insertedRow.id;
}

/**
 * Applies an addon purchase to a customer's active subscription, mirroring
 * what `AddonEntitlementService.applyAddonEntitlements` does in production
 * without invoking QZPay. Two tables are touched:
 *
 * 1. `billing_addon_purchases`: one row with `status='active'` and the
 *    populated `limitAdjustments` / `entitlementAdjustments` JSONB so cron
 *    jobs (addon-expiry, addon-reconciliation) and admin/customer-facing
 *    listings observe the purchase exactly as a real one.
 * 2. `billing_customer_limits`: for limit-type addons only. Inserts the
 *    aggregated post-addon limit (`basePlanLimit + addon.limitIncrease`)
 *    under `source='addon'` + `source_id=ADDON_RECALC_SOURCE_ID`, matching
 *    the well-known sentinel used by the addon-limit-recalculation flow.
 *    This is what `loadEntitlements()` reads at request time.
 *
 * For entitlement-type addons (`addon.grantsEntitlement` set), the seed
 * skips the limits step. The entitlement itself is recorded in the
 * purchase row's `entitlementAdjustments` array and resolved by the runtime
 * via the same path it uses for QZPay-granted entitlements.
 *
 * Idempotent on `(customerId, addonSlug, status='active')` thanks to the
 * `idx_addon_purchases_active_unique` partial unique index.
 *
 * @throws {Error} When the addon slug is unknown or the base plan limit
 *   cannot be resolved from `ALL_PLANS`.
 */
async function ensureAddonPurchase(
    customerId: string,
    subscriptionId: string,
    addonSlug: string,
    planSlug: string,
    db: DrizzleClient
): Promise<void> {
    const addon = getAddonBySlug(addonSlug);
    if (!addon) {
        throw new Error(`Addon "${addonSlug}" not found in addon catalog`);
    }

    // Idempotency: if there is already an active purchase for this
    // customer+addon, do nothing. The partial unique index would reject the
    // duplicate insert anyway, but a pre-check produces a clearer log.
    const existing = await db
        .select({ id: billingAddonPurchases.id })
        .from(billingAddonPurchases)
        .where(
            and(
                eq(billingAddonPurchases.customerId, customerId),
                eq(billingAddonPurchases.addonSlug, addonSlug),
                eq(billingAddonPurchases.status, 'active')
            )
        )
        .limit(1);

    if (existing.length > 0) {
        return;
    }

    // Resolve base plan limit from canonical config so the aggregated limit
    // matches what applyAddonEntitlements would compute. Searches across
    // every vertical this seed grants an addon for (HOS-1268) — see
    // `ALL_SEED_ADDON_BASE_PLANS`'s docblock for why `ALL_PLANS` alone is not
    // enough.
    const canonicalPlan = ALL_SEED_ADDON_BASE_PLANS.find((plan) => plan.slug === planSlug);
    if (!canonicalPlan) {
        throw new Error(`Plan "${planSlug}" not found in ALL_SEED_ADDON_BASE_PLANS catalog`);
    }

    const isLimitAddon = addon.affectsLimitKey !== null && addon.limitIncrease !== null;
    const isEntitlementAddon = addon.grantsEntitlement !== null;

    let limitAdjustments: Array<{
        limitKey: string;
        increase: number;
        previousValue: number;
        newValue: number;
    }> = [];
    let entitlementAdjustments: Array<{ entitlementKey: string; granted: boolean }> = [];

    if (isLimitAddon && addon.affectsLimitKey && addon.limitIncrease !== null) {
        const baseLimitDef = canonicalPlan.limits.find((lim) => lim.key === addon.affectsLimitKey);
        const basePlanLimit = baseLimitDef?.value ?? 0;

        // Skip the limits row for unlimited base plans (matches production behavior).
        if (basePlanLimit === -1) {
            limitAdjustments = [
                {
                    limitKey: addon.affectsLimitKey,
                    increase: addon.limitIncrease,
                    previousValue: -1,
                    newValue: -1
                }
            ];
        } else {
            const newMaxValue = basePlanLimit + addon.limitIncrease;
            limitAdjustments = [
                {
                    limitKey: addon.affectsLimitKey,
                    increase: addon.limitIncrease,
                    previousValue: basePlanLimit,
                    newValue: newMaxValue
                }
            ];

            // Insert the aggregated limit. Idempotent via the active-purchase
            // pre-check above plus the natural fact that the aggregated row is
            // keyed by (customer_id, limit_key, source, source_id) implicitly.
            await db.execute(sql`
                INSERT INTO billing_customer_limits (
                    customer_id, limit_key, max_value, current_value,
                    source, source_id, livemode
                ) VALUES (
                    ${customerId}, ${addon.affectsLimitKey}, ${newMaxValue}, 0,
                    'addon', ${ADDON_RECALC_SOURCE_ID}, false
                )
                ON CONFLICT DO NOTHING
            `);
        }
    }

    if (isEntitlementAddon && addon.grantsEntitlement) {
        entitlementAdjustments = [
            {
                entitlementKey: addon.grantsEntitlement,
                granted: true
            }
        ];
    }

    await db.insert(billingAddonPurchases).values({
        customerId,
        subscriptionId,
        addonSlug,
        status: 'active',
        purchasedAt: new Date(),
        limitAdjustments,
        entitlementAdjustments,
        metadata: { source: 'local-test-users-seed' }
    });
}

/**
 * Brings a test user's set of hats to exactly
 * `{ USER, declaredRole, ...extraRoles }` (HOS-296).
 *
 * The seed used to heal drift with a single `update(users, { role })`. That
 * write no longer exists, and "restore the declared shape" is now a SET
 * operation rather than a scalar assignment — a user who gained HOST through
 * the host-onboarding funnel after the initial seed holds `{USER, HOST}`, and
 * granting the declared role alone would leave the extra hat in place. The
 * smoke matrix depends on a predictable baseline (a `tourist-*` fixture that
 * still wears HOST shows host navigation), so extras are revoked.
 *
 * `USER` is always part of the target set because that is what a real signup
 * produces: Better Auth's create hook grants `USER`, and anything else is
 * layered on top. Keeping it also guarantees the extras-revoke below can never
 * hit `revokeRole`'s last-role guard.
 *
 * `extraRoles` (HOS-694) lets a single fixture declare more than one
 * non-USER hat at once — used by `host-commerce@local.test` (HOST +
 * COMMERCE_OWNER) to exercise HOS-296's multi-role invariant end-to-end
 * without needing a second `role` field on `TestUserSpec`.
 *
 * Grants run BEFORE revokes for the same reason.
 *
 * @param params.userId - The seeded user's id.
 * @param params.email - Used only for log output.
 * @param params.declaredRole - The primary role this fixture declares in `TEST_USERS`.
 * @param params.extraRoles - Additional roles to grant alongside `declaredRole`.
 */
async function syncTestUserRoles(params: {
    userId: string;
    email: string;
    declaredRole: (typeof RoleEnum)[keyof typeof RoleEnum];
    extraRoles?: readonly (typeof RoleEnum)[keyof typeof RoleEnum][];
}): Promise<void> {
    const { userId, email, declaredRole, extraRoles = [] } = params;

    const desired = new Set<(typeof RoleEnum)[keyof typeof RoleEnum]>([
        RoleEnum.USER,
        declaredRole,
        ...extraRoles
    ]);

    for (const role of desired) {
        const granted = await grantRole({
            userId,
            role,
            grantedBy: null,
            reason: RoleGrantReason.SEED
        });
        if (granted.error) {
            throw new Error(`Failed to grant ${role} to ${email}: ${granted.error.message}`);
        }
    }

    const held = await getUserRoles({ userId });
    for (const role of held) {
        if (desired.has(role)) {
            continue;
        }
        const revoked = await revokeRole({
            userId,
            role,
            revokedBy: null,
            reason: RoleGrantReason.SEED
        });
        if (revoked.error) {
            throw new Error(`Failed to revoke ${role} from ${email}: ${revoked.error.message}`);
        }
        logger.info(
            `${STATUS_ICONS.Info}    Healed role drift for ${email} (revoked extra ${role})`
        );
    }
}

/**
 * Seeds 42 test users for local entitlement testing (17 pre-existing + 25
 * from HOS-1268 — see the `TEST_USERS` docstring for
 * the pre-existing count's own history).
 *
 * Each user receives:
 * - A `users` row with the correct role and lifecycle/visibility defaults.
 * - An `account` row with a bcrypt-hashed password so Better Auth can log in
 *   with `Password123!` at http://localhost:4321/auth/signin/.
 * - (For users with a planSlug) A `billing_customers` row + an active
 *   `billing_subscriptions` row, so `loadEntitlements()` returns the correct
 *   plan gates without needing a real MercadoPago checkout.
 * - (For users with an addonSlug) A `billing_addon_purchases` row plus, for
 *   limit-type addons, a `billing_customer_limits` row with the aggregated
 *   post-addon limit applied. Mirrors what production
 *   `applyAddonEntitlements()` does without going through QZPay.
 * - (For HOST-role users, HOS-30) Exactly one fully-featured accommodation
 *   they own — every catalog amenity/feature applicable to the
 *   `accommodation` vertical, a full curated image gallery, a rich Tier-3
 *   price block, and FAQs. See {@link ensureHostAccommodation}. Idempotent:
 *   skipped entirely if the user already owns an accommodation.
 * - (For HOST-role users, BETA-89) Two owner promotions attached to that
 *   accommodation — one currently active, one expired/archived — so the
 *   "Mis promociones" list/CRUD flows have data to exercise locally. See
 *   {@link ensureHostPromotion}. Idempotent: skipped entirely if the user
 *   already owns a promotion.
 * - (For the one fixture with `ownsGastronomyAtCap`, HOS-694) Exactly one
 *   gastronomy listing they own, so their sellable-gastronomy-plan subscription
 *   (`MAX_GASTRONOMIES: 1`) starts AT its cap — the state AC-13 / AC-30 need
 *   to exercise. See {@link ensureGastronomyAtCapListing}. Idempotent:
 *   skipped entirely if the user already owns a gastronomy listing.
 * - (For the one fixture with `ownsExperienceAtCap`, HOS-1268) The same, one
 *   level over: exactly one experience listing they own, at `MAX_EXPERIENCES: 1`.
 *   See {@link ensureExperienceAtCapListing}.
 *
 * Idempotent: users that already exist (matched by email) are skipped entirely.
 * If a user exists but is missing their account row or billing rows, those gaps
 * are filled in.
 *
 * Tables touched: users, account, billing_customers, billing_subscriptions,
 * billing_addon_purchases, billing_customer_limits, accommodations,
 * accommodation_media, r_accommodation_amenity, r_accommodation_feature,
 * accommodation_faqs, owner_promotions (HOST users only), gastronomies (the
 * at-cap gastronomy fixture only), experiences (the at-cap experience fixture
 * only).
 *
 * @param _context - Seed context (unused; kept for the runExampleSeeds contract)
 *
 * @example
 * ```ts
 * // Standalone via CLI:
 * // pnpm db:seed:test-users
 *
 * // As part of the full seed pipeline:
 * // pnpm db:seed  (runs --reset --required --example which includes this seed)
 * ```
 */
export async function seedTestUsers(_context: SeedContext): Promise<void> {
    const separator = '─'.repeat(80);

    logger.info('');
    logger.info(`${separator}`);
    logger.info(`${STATUS_ICONS.Seed}  Seeding ${ENTITY_NAME} (SPEC-143 Block 1)`);
    logger.info(`${separator}`);

    const db = getDb();
    const userModel = new UserModel();

    const hashedPassword = await hash(TEST_PW, SALT_ROUNDS);

    let created = 0;
    let skipped = 0;

    for (const spec of TEST_USERS) {
        try {
            // ── Idempotency: check by email ──────────────────────────────────
            const existing = await userModel.findOne({ email: spec.email });

            let userId: string;

            if (existing) {
                userId = existing.id;
                logger.info(
                    `${STATUS_ICONS.Skip}  Skipping user ${spec.email} — already exists (id: ${userId})`
                );
                skipped++;

                // Role drift is healed below, after the user row is guaranteed
                // to exist — see `syncTestUserRoles`.

                // Even if the user row exists, fill in missing account/billing rows below.
            } else {
                // ── Insert users row ─────────────────────────────────────────
                const { firstName, lastName } = splitDisplayName(spec.displayName);

                const newUser = await userModel.create({
                    email: spec.email,
                    emailVerified: true,
                    displayName: spec.displayName,
                    firstName,
                    lastName,
                    lifecycleState: LifecycleStatusEnum.ACTIVE,
                    visibility: VisibilityEnum.PUBLIC
                });

                userId = newUser.id;
                created++;

                logger.success({
                    msg: `${STATUS_ICONS.Success}  Created user ${spec.email} (${spec.role}, id: ${userId})`
                });
            }

            // ── Sync the declared role SET (HOS-296) ─────────────────────────
            await syncTestUserRoles({
                userId,
                email: spec.email,
                declaredRole: spec.role,
                extraRoles: spec.extraRoles
            });

            // ── Mark user ready (SPEC-264) ───────────────────────────────────
            // Writes the domain state that onboarding gates read so the user is
            // immediately usable after seeding without any manual click-through:
            // profileCompleted=true, host.welcome tour seen, whatsNew baselined.
            const readyResult = await markUserReady({ email: spec.email, model: userModel });
            if (!readyResult.ok) {
                logger.warn(
                    `${STATUS_ICONS.Warning}  markUserReady: user not found for ${spec.email} — onboarding state NOT written`
                );
            }

            // ── Ensure account row (Better Auth credentials) ─────────────────
            const existingAccount = await db
                .select({ id: accounts.id })
                .from(accounts)
                .where(eq(accounts.userId, userId))
                .limit(1);

            if (existingAccount.length === 0) {
                await db.insert(accounts).values({
                    id: crypto.randomUUID(),
                    // Better Auth convention: accountId = userId for credential provider
                    accountId: userId,
                    providerId: 'credential',
                    userId,
                    password: hashedPassword,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });

                logger.info(`${STATUS_ICONS.Info}    Account row created for ${spec.email}`);
            }

            // ── Ensure a billing customer for EVERY test user ─────────────────
            // Mirrors production: the Better Auth signup databaseHook eagerly
            // creates a billing_customers row for every user, including free-tier
            // ones with no subscription. Without a customer, the entitlement
            // middleware's no-customer branch yields empty entitlements (no
            // tourist-free defaults), so a free user cannot even save favorites.
            // Seeding the customer unconditionally keeps the local free tier
            // faithful to prod. (SPEC-143 smoke F-B2)
            const customerId = await ensureBillingCustomer(userId, spec.email, db);

            // ── Ensure subscription (+ addon) only for paid-tier users ────────
            if (spec.planSlug) {
                const plan = await resolvePlan(spec.planSlug, db);
                // HOS-1233 T-035: the plan's own row is the source of the
                // subscription's domain. `subscriptionProductDomain` stays as an
                // explicit override for a fixture that deliberately wants a
                // domain its plan does not name; when absent, the derivation
                // answers — so a vertical added later cannot be silently
                // seeded as accommodation just because nobody declared it.
                const subscriptionId = await ensureSubscription(
                    customerId,
                    plan.id,
                    db,
                    spec.subscriptionProductDomain ?? plan.productDomain,
                    spec.subStatus ?? SubscriptionStatusEnum.ACTIVE,
                    spec.trialDays ?? OWNER_TRIAL_DAYS
                );

                logger.info(
                    `${STATUS_ICONS.Info}    Billing rows ensured for ${spec.email} (plan: ${spec.planSlug})`
                );

                // Apply addon (if declared) on top of the subscription.
                if (spec.addonSlug) {
                    await ensureAddonPurchase(
                        customerId,
                        subscriptionId,
                        spec.addonSlug,
                        spec.planSlug,
                        db
                    );
                    logger.info(
                        `${STATUS_ICONS.Info}    Addon ensured for ${spec.email} (addon: ${spec.addonSlug})`
                    );
                }

                // ── Ensure the at-cap gastronomy listing (HOS-694) ────────────
                // Idempotent: skips if the user already owns one. Puts this
                // owner's sellable-gastronomy-plan subscription AT its
                // MAX_GASTRONOMIES=1 cap, the state AC-13 / AC-30 need.
                if (spec.ownsGastronomyAtCap) {
                    await ensureGastronomyAtCapListing({ userId, spec });
                    logger.info(
                        `${STATUS_ICONS.Info}    At-cap gastronomy listing ensured for ${spec.email}`
                    );
                }

                // ── Ensure the at-cap experience listing (HOS-1268) ───────────
                // Mirrors the gastronomy branch above — idempotent, puts this
                // owner's sellable-experience-plan subscription AT its
                // MAX_EXPERIENCES=1 cap.
                if (spec.ownsExperienceAtCap) {
                    await ensureExperienceAtCapListing({ userId, spec });
                    logger.info(
                        `${STATUS_ICONS.Info}    At-cap experience listing ensured for ${spec.email}`
                    );
                }
            } else {
                logger.info(
                    `${STATUS_ICONS.Info}    Billing customer ensured for ${spec.email} (free tier, no subscription)`
                );
            }

            // ── Ensure a fully-featured accommodation for HOST users (HOS-30) ──
            // Idempotent: skips if the user already owns one. Every host plan
            // allows at least 1 accommodation, so this never exceeds the plan limit.
            if (spec.role === RoleEnum.HOST) {
                await ensureHostAccommodation({ userId, spec, db });

                // ── Ensure 2 owner promotions (1 active, 1 archived) for HOST users (BETA-89) ──
                // Idempotent: skips if the user already owns one. Depends on the
                // accommodation created just above (re-resolved internally by id).
                await ensureHostPromotion({ userId, spec });

                // ── HOS-376 T-013: make the dual-role user a provider too ──
                // Only this one account. Idempotent, and it yields rather than
                // steal a listing a real provider already claimed.
                if (spec.email === HOST_TRADE_OWNER_EMAIL) {
                    const action = await ensureHostTradeOwnership({ userId, db });
                    if (action === 'skip-owned-by-other') {
                        logger.warn(
                            `${STATUS_ICONS.Warning}  host_trades "${HOST_TRADE_OWNER_SLUG}" already belongs to another user — left untouched, ${spec.email} has no provider listing here.`
                        );
                    }
                }
            }

            summaryTracker.trackSuccess(ENTITY_NAME);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error(`${STATUS_ICONS.Error}  Failed to seed ${spec.email}: ${message}`);
            summaryTracker.trackError(ENTITY_NAME, spec.email, message);
        }
    }

    logger.info(`${separator}`);
    logger.info(
        `${STATUS_ICONS.Info}  Test users: ${created} created, ${skipped} skipped (${TEST_USERS.length} total)`
    );
}
