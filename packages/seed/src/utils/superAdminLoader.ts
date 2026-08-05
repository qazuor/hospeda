import { randomUUID } from 'node:crypto';
import type { DrizzleClient } from '@repo/db';
import { accounts, getDb, UserModel, userRole, users } from '@repo/db';
import { PermissionEnum, RoleEnum, RoleGrantReason } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { grantRole } from '@repo/service-core';
import { hash } from 'bcryptjs';
import { and, asc, eq, isNull } from 'drizzle-orm';
import superAdminInput from '../data/user/required/super-admin-user.json';
import { STATUS_ICONS } from './icons.js';
import { logger } from './logger.js';
import { summaryTracker } from './summaryTracker.js';

/**
 * Grants the baseline `USER` hat plus `SUPER_ADMIN` to the seeded super admin
 * (HOS-296).
 *
 * Both hats, not just `SUPER_ADMIN`: every account holds `USER` as its
 * baseline (that is what `revokeRole`'s last-role guard protects), and the
 * super admin is not an exception. `grantRole` is idempotent, so this is safe
 * to call on every seed run.
 *
 * @param userId - The super admin's real `users.id`.
 * @throws {Error} When a grant fails — a super admin with no hats is an
 *   unusable environment, so this must be loud rather than logged and skipped.
 */
async function grantSuperAdminRole(userId: string): Promise<void> {
    for (const role of [RoleEnum.USER, RoleEnum.SUPER_ADMIN]) {
        const granted = await grantRole({
            userId,
            role,
            grantedBy: null,
            reason: RoleGrantReason.SEED
        });
        if (granted.error) {
            throw new Error(`Failed to grant ${role} to the super admin: ${granted.error.message}`);
        }
    }
}

/**
 * Finds the existing super admin, if any (HOS-296).
 *
 * This used to be `userModel.findOne({ role: RoleEnum.SUPER_ADMIN })`. With
 * `users.role` dropped, that filter key matches no column, and
 * `buildWhereClause` THROWS a `DbError` when every key in a where-object is
 * unknown — so the old call did not degrade, it aborted `loadSuperAdminAndGetActor`
 * outright, taking down both the seed pipeline and the data-migration runner
 * (`data-migrations/runner.ts` bootstraps its actor through this function).
 *
 * "Who is a super admin" is now a join to `user_role`, kept as an INNER JOIN on
 * `users` with an `IS NULL` deleted filter so a soft-deleted account can never
 * be adopted as the seeding actor — same shape as `required/aiPrompts.seed.ts`.
 *
 * ## Why the `ORDER BY` is load-bearing, not cosmetic
 *
 * `LIMIT 1` without an `ORDER BY` picks whatever row Postgres happens to hand
 * back first. On a database holding a single super admin that is stable by
 * accident; on one holding several — a real environment where a second staff
 * account was promoted — it can change between runs for reasons no caller
 * controls (plan choice, physical row order after a `VACUUM`, a concurrent
 * update moving a tuple).
 *
 * That turns a specific data-migration failure into a reachable one rather
 * than a theoretical one. `0040-reattribute-imported-events.ts` resolves its
 * fallback actor through {@link findSuperAdminActor}, and by design it THROWS
 * when the actor it resolves is not the one `0027`/`0028` ran as. A
 * non-deterministic pick therefore does not merely choose a different-but-fine
 * actor: it aborts `0036` and blocks `0037`/`0038` from ever applying.
 *
 * `createdAt ASC` is the tiebreak because it is the one column here that is
 * both immutable and monotonic — "the FIRST super admin this database ever
 * had", which is by construction the one the earliest migrations ran as. `id`
 * (a random UUID) is stable but arbitrary, and `email`/`displayName` are both
 * mutable. `id ASC` is appended as a second key because `created_at` is not
 * unique — two accounts promoted in the same seed run can share a timestamp,
 * which would put the ambiguity straight back.
 *
 * @param db - Drizzle client to read through. Callers holding an explicit
 *   client (the data-migration runner) must pass it: `getDb()`'s singleton
 *   lives on whichever `@repo/db` module copy the importer resolved, which is
 *   not necessarily the one the caller initialized.
 * @returns The super admin's id/displayName/email, or `null` when none exists.
 */
async function findExistingSuperAdmin(db: DrizzleClient): Promise<{
    id: string;
    displayName: string | null;
    email: string;
} | null> {
    const rows = await db
        .select({
            id: users.id,
            displayName: users.displayName,
            email: users.email
        })
        .from(userRole)
        .innerJoin(users, eq(users.id, userRole.userId))
        .where(and(eq(userRole.role, RoleEnum.SUPER_ADMIN), isNull(users.deletedAt)))
        // Deterministic pick — see the JSDoc. Never drop this: `LIMIT 1` without
        // it makes the resolved actor depend on Postgres' physical row order.
        .orderBy(asc(users.createdAt), asc(users.id))
        .limit(1);

    return rows[0] ?? null;
}

/**
 * Resolves the existing super admin as an {@link Actor}, WITHOUT creating one
 * and without any of {@link loadSuperAdminAndGetActor}'s side effects (no
 * credential-account write, no role self-heal).
 *
 * Exists for callers that need an acting super admin but must never
 * MANUFACTURE one — specifically the versioned data-migration runner
 * (`data-migrations/runner.ts`). The seed pipeline bootstraps the well-known
 * `superadmin@hospeda.com` account on purpose; a migration run must not, or a
 * curated production seed (`--required --exclude=users`, which deliberately
 * skips exactly that account) would grow a predictable admin credential as a
 * silent side effect of running migrations.
 *
 * @param args - RO-RO input. `db` defaults to the `getDb()` singleton; pass an
 *   explicit client when you hold one (see {@link findExistingSuperAdmin}).
 * @returns The super admin actor, or `null` when no super admin exists.
 */
export async function findSuperAdminActor(
    args: { readonly db?: DrizzleClient } = {}
): Promise<Actor | null> {
    const existing = await findExistingSuperAdmin(args.db ?? getDb());
    if (!existing) {
        return null;
    }

    return {
        id: existing.id,
        roles: [RoleEnum.SUPER_ADMIN],
        permissions: Object.values(PermissionEnum)
    };
}

/**
 * Generates a cryptographically random password for the super admin seed.
 * Used when HOSPEDA_SEED_SUPER_ADMIN_PASSWORD env var is not set.
 */
const generateRandomPassword = (): string => {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Buffer.from(bytes).toString('base64url');
};

/**
 * Normalizes user data by removing schema and ID fields that shouldn't be sent to the service.
 *
 * @param userData - Raw user data from JSON file
 * @returns Cleaned user data ready for database insertion
 */
const normalizeUserData = (userData: Record<string, unknown>) => {
    const { $schema, id, ...normalizedData } = userData;
    return normalizedData;
};

/**
 * Creates a Better Auth credential account record for the super admin user.
 * This allows the super admin to sign in with email/password via Better Auth.
 */
const ensureCredentialAccount = async (userId: string, email: string): Promise<void> => {
    const db = getDb();

    // Check if account already exists
    const existing = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'credential')))
        .limit(1);

    const envPassword = process.env.HOSPEDA_SEED_SUPER_ADMIN_PASSWORD;

    if (existing.length > 0) {
        // Account exists. If env password is set, rehash and update so the seed
        // is the source of truth for the super admin password. If not set, leave
        // the existing hash untouched to avoid locking the user out.
        if (!envPassword) {
            logger.info(
                `${STATUS_ICONS.Success} Credential account already exists for super admin (HOSPEDA_SEED_SUPER_ADMIN_PASSWORD not set, password unchanged)`
            );
            return;
        }

        const hashedPassword = await hash(envPassword, 10);
        await db
            .update(accounts)
            .set({ password: hashedPassword, updatedAt: new Date() })
            .where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'credential')));

        logger.success({
            msg: `${STATUS_ICONS.Success} Credential account password updated for super admin (email: ${email[0]}***@${email.split('@')[1]})`
        });
        return;
    }

    // No account yet. Create one, using env password if provided, else random.
    const password = envPassword || generateRandomPassword();
    if (!envPassword) {
        logger.warn(
            `${STATUS_ICONS.Warning} HOSPEDA_SEED_SUPER_ADMIN_PASSWORD not set. Generated random password for super admin. Set the env var for a predictable password.`
        );
        console.warn('[SEED] Generated random super admin password: [REDACTED]');
        console.warn('[SEED] Change this password immediately after first login.');
    }
    const hashedPassword = await hash(password, 10);

    await db.insert(accounts).values({
        id: randomUUID(),
        accountId: userId,
        providerId: 'credential',
        userId,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date()
    });

    logger.success({
        msg: `${STATUS_ICONS.Success} Credential account created for super admin (email: ${email[0]}***@${email.split('@')[1]})`
    });
};

/**
 * Loads the super admin user and returns its actor information.
 *
 * This function creates the super admin user directly using the model to bypass
 * foreign key validation issues during initial seeding. It ensures that:
 * - Only one super admin exists in the system
 * - The super admin has all available permissions
 * - A credential account exists for Better Auth email/password login
 * - The actor is properly configured for subsequent operations
 *
 * The super admin is essential for the seeding process as it provides the
 * necessary permissions to create all other entities in the system.
 *
 * @returns Promise that resolves to the super admin actor
 *
 * @throws {Error} When super admin creation fails
 */
export async function loadSuperAdminAndGetActor(): Promise<Actor> {
    const separator = '#'.repeat(90);
    const subSeparator = '\u2500'.repeat(90);

    logger.info(`${separator}`);
    logger.info(`${STATUS_ICONS.UserSuperAdmin}  LOADING SUPER ADMINISTRATOR`);
    logger.info(`${subSeparator}`);

    try {
        const userModel = new UserModel();

        // Resolve email: env override takes precedence over JSON default
        const envEmail = process.env.HOSPEDA_SEED_SUPER_ADMIN_EMAIL;
        const superAdminEmail = envEmail || superAdminInput.email;
        if (envEmail) {
            logger.info(
                `${STATUS_ICONS.Success} Using HOSPEDA_SEED_SUPER_ADMIN_EMAIL override: ${envEmail[0]}***@${envEmail.split('@')[1]}`
            );
        }

        // Check if super admin already exists (HOS-296: a `user_role` join, not
        // a `users.role` column filter — see `findExistingSuperAdmin`).
        const existingSuperAdmin = await findExistingSuperAdmin(getDb());

        if (existingSuperAdmin) {
            logger.success({
                msg: `${STATUS_ICONS.UserSuperAdmin} Super admin found: "${existingSuperAdmin.displayName || 'Super Admin'}" (ID: ${existingSuperAdmin.id})`
            });
            logger.info(`${subSeparator}`);

            summaryTracker.trackProcessStep('Super Admin', 'success', 'Existing super admin found');

            // Ensure credential account exists for Better Auth login
            const email = existingSuperAdmin.email || superAdminEmail;
            await ensureCredentialAccount(existingSuperAdmin.id, email);

            // HOS-296: the SUPER_ADMIN hat lives in `user_role`, not on the
            // user row. Granting is idempotent, so re-running the seed against
            // an existing super admin is a no-op — but it also SELF-HEALS an
            // account seeded before the multi-role cut, which would otherwise
            // resolve to zero roles and be unable to do anything.
            await grantSuperAdminRole(existingSuperAdmin.id);

            return {
                id: existingSuperAdmin.id,
                roles: [RoleEnum.SUPER_ADMIN],
                permissions: Object.values(PermissionEnum)
            };
        }

        // Create super admin user with forced password change on first login
        const normalizedSuperAdminInput = normalizeUserData(superAdminInput);
        const createdUser = await userModel.create({
            ...(normalizedSuperAdminInput as Record<string, unknown>),
            email: superAdminEmail,
            adminInfo: {
                notes: undefined,
                favorite: false,
                passwordChangeRequired: true
            }
        });

        if (!createdUser) {
            throw new Error('Failed to create super admin user');
        }

        const realSuperAdminId = createdUser.id;

        logger.success({
            msg: `${STATUS_ICONS.UserSuperAdmin} Super admin created: "${createdUser.displayName || 'Super Admin'}" (ID: ${realSuperAdminId})`
        });

        // Create credential account for Better Auth email/password login
        await ensureCredentialAccount(realSuperAdminId, superAdminEmail);

        // HOS-296: grant the hats in `user_role`. The `role` key still present
        // in `super-admin-user.json` is inert — `users.role` no longer exists,
        // so the insert silently drops it. Without this grant the super admin
        // resolves to ZERO roles and the whole seeded environment is unusable.
        await grantSuperAdminRole(realSuperAdminId);

        logger.info(`${subSeparator}`);

        summaryTracker.trackProcessStep(
            'Super Admin',
            'success',
            'Super admin created successfully'
        );

        return {
            id: realSuperAdminId,
            roles: [RoleEnum.SUPER_ADMIN],
            permissions: Object.values(PermissionEnum)
        };
    } catch (error) {
        logger.error(
            `${STATUS_ICONS.Error} Error loading super admin: ${(error as Error).message}`
        );
        summaryTracker.trackProcessStep(
            'Super Admin',
            'error',
            'Error loading super admin',
            (error as Error).message
        );
        throw error;
    }
}
