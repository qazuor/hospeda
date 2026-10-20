import { accounts, eq, getDb, UserModel } from '@repo/db';
import { LifecycleStatusEnum, RoleEnum, RoleGrantReason, VisibilityEnum } from '@repo/schemas';
import { getUserRoles, grantRole, revokeRole } from '@repo/service-core';
import { hash } from 'bcryptjs';
import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';
import { summaryTracker } from '../utils/summaryTracker.js';
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
 * Spec for one test user in the matrix.
 */
export interface TestUserSpec {
    readonly email: string;
    readonly displayName: string;
    readonly role: (typeof RoleEnum)[keyof typeof RoleEnum];
    /**
     * Additional roles to grant alongside `role`, so a single test user can
     * hold more than one hat at once (HOS-296 multi-role). Used for the
     * HOST + vertical-owner dual-role fixture (HOS-694 AC-3 / AC-12).
     */
    readonly extraRoles?: readonly (typeof RoleEnum)[keyof typeof RoleEnum][];
}

/**
 * The 13 test users created by this seed — the non-billing remainder of the
 * SPEC-143 Block 1 matrix (HOS-1416 demolished the legacy billing schema:
 * every plan/subscription/addon/billing-state fixture lost its subject and
 * was removed along with the billing machinery it drove).
 *
 * What survives is what is still exercised without billing: staff role gates,
 * tourist/host/gastronomy/experience/complex role fixtures, the HOST accommodation,
 * promotion and provider-listing attachments, and multi-role grants.
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
    // Host tier (HOST role)
    {
        email: 'host-basico@local.test',
        displayName: 'Host Basico',
        role: RoleEnum.HOST
    },
    {
        email: 'host-pro@local.test',
        displayName: 'Host Pro',
        role: RoleEnum.HOST
    },
    {
        email: 'host-premium@local.test',
        displayName: 'Host Premium',
        role: RoleEnum.HOST
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
        role: RoleEnum.HOST
    },
    // Each fixture owns only its own listing vertical.
    {
        email: 'gastronomy-owner@local.test',
        displayName: 'Comercio Gastronomía',
        role: RoleEnum.GASTRONOMY_OWNER
    },
    {
        email: 'experience-owner@local.test',
        displayName: 'Comercio Experiencia',
        role: RoleEnum.EXPERIENCE_OWNER
    },
    // Dual-role fixture (HOS-296 multi-role, HOS-694). AC-3 asserts a HOST
    // retains the role after being granted a listing-owner role; AC-12 asserts
    // the header's three-option publish control renders for an account already
    // holding either role. HOS-30's accommodation fixture still applies
    // (triggered by `role === HOST`); GASTRONOMY_OWNER is granted directly,
    // with no backing listing, since role possession alone is what the nav
    // gate and the header control read (HOS-1417 retired the shared owner role).
    {
        email: 'host-gastronomy@local.test',
        displayName: 'Host y Comercio',
        role: RoleEnum.HOST,
        extraRoles: [RoleEnum.GASTRONOMY_OWNER]
    },
    // Complex / CLIENT_MANAGER tier
    {
        email: 'complex-basico@local.test',
        displayName: 'Complex Basico',
        role: RoleEnum.CLIENT_MANAGER
    },
    {
        email: 'complex-pro@local.test',
        displayName: 'Complex Pro',
        role: RoleEnum.CLIENT_MANAGER
    },
    {
        email: 'complex-premium@local.test',
        displayName: 'Complex Premium',
        role: RoleEnum.CLIENT_MANAGER
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
 * non-USER hat at once — used by `host-gastronomy@local.test` (HOST +
 * GASTRONOMY_OWNER) to exercise HOS-296's multi-role invariant end-to-end
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
 * Seeds 13 test users — the non-billing remainder of the SPEC-143 Block 1
 * matrix (HOS-1416 removed every plan/subscription/addon/billing-state
 * fixture along with the legacy billing schema; see the `TEST_USERS`
 * docstring).
 *
 * Each user receives:
 * - A `users` row with the correct role and lifecycle/visibility defaults.
 * - An `account` row with a bcrypt-hashed password so Better Auth can log in
 *   with `Password123!` at http://localhost:4321/auth/signin/.
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
 *
 * Idempotent: users that already exist (matched by email) are skipped entirely.
 * If a user exists but is missing their account row, that gap is filled in.
 *
 * Tables touched: users, account, accommodations,
 * accommodation_media, r_accommodation_amenity, r_accommodation_feature,
 * accommodation_faqs, owner_promotions (HOST users only).
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

                // Even if the user row exists, fill in a missing account row below.
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

            // ── Ensure a fully-featured accommodation for HOST users (HOS-30) ──
            // Idempotent: skips if the user already owns one.
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
