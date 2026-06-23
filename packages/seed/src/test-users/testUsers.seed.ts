import { ALL_PLANS, getAddonBySlug } from '@repo/billing';
import {
    UserModel,
    accounts,
    and,
    billingAddonPurchases,
    billingCustomers,
    billingPlans,
    billingSubscriptions,
    eq,
    getDb,
    sql
} from '@repo/db';
import type { DrizzleClient } from '@repo/db';
import { LifecycleStatusEnum, RoleEnum, VisibilityEnum } from '@repo/schemas';
import { ADDON_RECALC_SOURCE_ID } from '@repo/service-core';
import { hash } from 'bcryptjs';
import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';
import { summaryTracker } from '../utils/summaryTracker.js';
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
 * Spec for one test user in the matrix.
 */
interface TestUserSpec {
    readonly email: string;
    readonly displayName: string;
    readonly role: (typeof RoleEnum)[keyof typeof RoleEnum];
    /**
     * Slug of the billing plan to activate for this user.
     * When undefined the user has no active subscription (free tier).
     */
    readonly planSlug?: string;
    /**
     * Initial subscription status. Defaults to 'active' when omitted (matches
     * the original Block 1 user matrix). Set to 'trialing' to seed a user
     * with `trial_start = now()` and `trial_end = now() + trialDays`. Use
     * for Block 3 trial-lifecycle smoke (2.1.a / 2.1.b / 2.1.c).
     */
    readonly subStatus?: 'active' | 'trialing';
    /**
     * Trial window in days when `subStatus === 'trialing'`. Defaults to 14
     * (the HOST trial window per `packages/billing/src/config/plans.config.ts`
     * `OWNER_TRIAL_DAYS`). Ignored when status is anything else.
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
}

/**
 * The 13 test users created by this seed.
 *
 * NOTE: super-admin@local.test and admin@local.test are intentionally
 * excluded — the required seed already creates superadmin@hospeda.com
 * and admin@hospeda.com via admin-user.json / super-admin-user.json.
 * Those accounts are the canonical admin credentials for local dev.
 */
const TEST_USERS: readonly TestUserSpec[] = [
    // Staff (no billing)
    { email: 'editor@local.test', displayName: 'Editor Local', role: RoleEnum.EDITOR },
    { email: 'sponsor@local.test', displayName: 'Sponsor Local', role: RoleEnum.SPONSOR },
    // Tourist tier (USER role)
    { email: 'tourist-free@local.test', displayName: 'Turista Free', role: RoleEnum.USER },
    {
        email: 'tourist-plus@local.test',
        displayName: 'Turista Plus',
        role: RoleEnum.USER,
        planSlug: 'tourist-plus'
    },
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
    // 14-day window starting at seed time. owner-basico is the canonical trial-eligible plan.
    {
        email: 'host-trial@local.test',
        displayName: 'Host Trial',
        role: RoleEnum.HOST,
        planSlug: 'owner-basico',
        subStatus: 'trialing',
        trialDays: 14
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
    }
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
async function resolvePlanId(planSlug: string, db: DrizzleClient): Promise<string> {
    const rows = await db
        .select({ id: billingPlans.id })
        .from(billingPlans)
        .where(eq(billingPlans.name, planSlug))
        .limit(1);

    const row = rows[0];
    if (!row) {
        throw new Error(
            `Plan "${planSlug}" not found in billing_plans. Run the required seed (billingPlans.seed.ts) before seedTestUsers.`
        );
    }
    return row.id;
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

/**
 * Ensures a `billing_subscriptions` row exists for the given customer + plan
 * with the requested status.
 *
 * Idempotent on customer_id. When `subStatus === 'trialing'`, also stamps
 * `trial_start = now()` and `trial_end = now() + trialDays` so the trial
 * cron logic (apply-scheduled-plan-changes / trial expiry) has real dates
 * to act on.
 *
 * Skips silently if a subscription already exists for this customer — the
 * one-time seeded shape is treated as authoritative; tests that want to
 * exercise a transition (active → canceled, trialing → expired) should
 * UPDATE the existing row instead of relying on the seed to swap status.
 */
async function ensureSubscription(
    customerId: string,
    planId: string,
    db: DrizzleClient,
    subStatus: 'active' | 'trialing' = 'active',
    trialDays = 14
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
    const periodEnd = new Date(now);
    // Use 30-day window — local testing only, period accuracy doesn't matter.
    periodEnd.setDate(periodEnd.getDate() + 30);

    const isTrialing = subStatus === 'trialing';
    const trialStart = isTrialing ? now : null;
    const trialEnd = isTrialing
        ? (() => {
              const end = new Date(now);
              end.setDate(end.getDate() + trialDays);
              return end;
          })()
        : null;

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
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            ...(isTrialing ? { trialStart, trialEnd } : {})
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
    // matches what applyAddonEntitlements would compute.
    const canonicalPlan = ALL_PLANS.find((plan) => plan.slug === planSlug);
    if (!canonicalPlan) {
        throw new Error(`Plan "${planSlug}" not found in ALL_PLANS catalog`);
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
 * Seeds 13 test users for SPEC-143 Block 1 local entitlement testing.
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
 *
 * Idempotent: users that already exist (matched by email) are skipped entirely.
 * If a user exists but is missing their account row or billing rows, those gaps
 * are filled in.
 *
 * Tables touched: users, account, billing_customers, billing_subscriptions,
 * billing_addon_purchases, billing_customer_limits.
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

                // Heal role drift: a downstream flow (e.g. host-onboarding) may have
                // promoted a USER to HOST after the initial seed. Re-running the seed
                // must restore the matrix to its declared shape so smoke runs against
                // a predictable baseline.
                if (existing.role !== spec.role) {
                    await userModel.update({ id: userId }, { role: spec.role });
                    logger.info(
                        `${STATUS_ICONS.Info}    Healed role drift for ${spec.email} (${existing.role} → ${spec.role})`
                    );
                }

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
                    role: spec.role,
                    lifecycleState: LifecycleStatusEnum.ACTIVE,
                    visibility: VisibilityEnum.PUBLIC
                });

                userId = newUser.id;
                created++;

                logger.success({
                    msg: `${STATUS_ICONS.Success}  Created user ${spec.email} (${spec.role}, id: ${userId})`
                });
            }

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
                const planId = await resolvePlanId(spec.planSlug, db);
                const subscriptionId = await ensureSubscription(
                    customerId,
                    planId,
                    db,
                    spec.subStatus ?? 'active',
                    spec.trialDays ?? 14
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
            } else {
                logger.info(
                    `${STATUS_ICONS.Info}    Billing customer ensured for ${spec.email} (free tier, no subscription)`
                );
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
