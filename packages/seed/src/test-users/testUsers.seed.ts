import {
    UserModel,
    accounts,
    billingCustomers,
    billingPlans,
    billingSubscriptions,
    eq,
    getDb
} from '@repo/db';
import type { DrizzleClient } from '@repo/db';
import { LifecycleStatusEnum, RoleEnum, VisibilityEnum } from '@repo/schemas';
import { hash } from 'bcryptjs';
import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';
import { summaryTracker } from '../utils/summaryTracker.js';

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
}

/**
 * The 11 new test users created by this seed.
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
): Promise<void> {
    const existing = await db
        .select({ id: billingSubscriptions.id })
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.customerId, customerId))
        .limit(1);

    if (existing.length > 0) {
        return;
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

    await db.insert(billingSubscriptions).values({
        customerId,
        // billing_subscriptions.plan_id is varchar (not UUID) — store the UUID
        // string directly. See CLAUDE.md gotcha: "billing_plans.id is UUID but
        // billing_subscriptions.plan_id is varchar".
        planId,
        status: subStatus,
        // Use monthly interval for all test subscriptions. For local entitlement
        // testing the billing cycle doesn't matter — only status drives behavior.
        billingInterval: 'month',
        livemode: false,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        ...(isTrialing ? { trialStart, trialEnd } : {})
    });
}

/**
 * Seeds 11 test users for SPEC-143 Block 1 local entitlement testing.
 *
 * Each user receives:
 * - A `users` row with the correct role and lifecycle/visibility defaults.
 * - An `account` row with a bcrypt-hashed password so Better Auth can log in
 *   with `Password123!` at http://localhost:4321/auth/signin/.
 * - (For users with a planSlug) A `billing_customers` row + an active
 *   `billing_subscriptions` row, so `loadEntitlements()` returns the correct
 *   plan gates without needing a real MercadoPago checkout.
 *
 * Idempotent: users that already exist (matched by email) are skipped entirely.
 * If a user exists but is missing their account row or billing rows, those gaps
 * are filled in.
 *
 * Tables touched: users, account, billing_customers, billing_subscriptions.
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

            // ── Ensure billing rows (for paid-tier users) ────────────────────
            if (spec.planSlug) {
                const planId = await resolvePlanId(spec.planSlug, db);
                const customerId = await ensureBillingCustomer(userId, spec.email, db);
                await ensureSubscription(
                    customerId,
                    planId,
                    db,
                    spec.subStatus ?? 'active',
                    spec.trialDays ?? 14
                );

                logger.info(
                    `${STATUS_ICONS.Info}    Billing rows ensured for ${spec.email} (plan: ${spec.planSlug})`
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
