import { SYSTEM_USER_EMAIL, SYSTEM_USER_ID, UserModel } from '@repo/db';
import { LifecycleStatusEnum, RoleEnum, VisibilityEnum } from '@repo/schemas';
import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import { summaryTracker } from '../utils/summaryTracker.js';

/**
 * Minimal interface for the user model operations used by this seed.
 * Allows injecting a mock in tests without coupling to the concrete UserModel.
 *
 * @internal
 */
export interface UserModelPort {
    findOne(filter: Partial<Record<string, unknown>>): Promise<Record<string, unknown> | null>;
    create(data: Partial<Record<string, unknown>>): Promise<Record<string, unknown>>;
}

/**
 * Seeds the reserved system user into the `users` table.
 *
 * The system user is a non-loginable account with a fixed UUID (`SYSTEM_USER_ID`)
 * used as `assignedById` for all automated tag assignments: seed data, cron jobs,
 * webhooks, and any operation that has no real human actor.
 *
 * This seed MUST run before any other required seed that references
 * `SYSTEM_USER_ID` (e.g. INTERNAL tags, SYSTEM tags, PostTags).
 *
 * Idempotent: if a user with `SYSTEM_USER_ID` already exists, the seed logs
 * and skips without error.
 *
 * Reference: SPEC-086 R-1, D-005, AC-F20
 *
 * @param userModelOverride - Optional model to use instead of `UserModel`.
 *   Pass a mock in tests to avoid needing a live database connection.
 * @returns Promise that resolves when the system user is present in the DB
 *
 * @throws {Error} When the database insert fails for a reason other than duplication
 *
 * @example
 * ```ts
 * await seedSystemUser();
 * // Inserts: id=SYSTEM_USER_ID, email=SYSTEM_USER_EMAIL, role=SYSTEM
 * ```
 */
export async function seedSystemUser(userModelOverride?: UserModelPort): Promise<void> {
    const separator = '#'.repeat(90);

    logger.info(`${separator}`);
    logger.info(`${STATUS_ICONS.Seed}  SEEDING SYSTEM USER (SPEC-086 R-1)`);

    const userModel: UserModelPort = userModelOverride ?? new UserModel();

    try {
        // Check if the system user already exists — idempotency guard
        const existing = await userModel.findOne({ id: SYSTEM_USER_ID });

        if (existing) {
            logger.info(
                `${STATUS_ICONS.Success} System user already exists (id: ${SYSTEM_USER_ID}), skipping.`
            );
            summaryTracker.trackSuccess('System User');
            return;
        }

        // Insert the system user with the fixed UUID.
        // - `role = SYSTEM`: non-loginable, no permissions, used only as assignedById.
        // - `emailVerified = false`: intentionally not verified — this account cannot log in.
        // - `banned = true`: belt-and-suspenders to prevent any auth attempt from succeeding.
        // - No `accounts` row is created, so Better Auth cannot issue a session for this user.
        // - `lifecycleState = ACTIVE`: required so FK references to this user are valid.
        // - `visibility = PRIVATE`: never shown in public user listings.
        // - `slug`: omitted — the $defaultFn on the `users` table auto-generates it.
        await userModel.create({
            id: SYSTEM_USER_ID,
            email: SYSTEM_USER_EMAIL,
            emailVerified: false,
            role: RoleEnum.SYSTEM,
            displayName: 'System',
            firstName: 'System',
            lastName: 'User',
            banned: true,
            banReason: 'Reserved non-loginable system account (SPEC-086 D-005)',
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            visibility: VisibilityEnum.PRIVATE
        });

        logger.success({
            msg: `${STATUS_ICONS.Success} System user created (id: ${SYSTEM_USER_ID}, email: ${SYSTEM_USER_EMAIL})`
        });

        summaryTracker.trackSuccess('System User');
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`${STATUS_ICONS.Error} Failed to seed system user: ${message}`);
        summaryTracker.trackError('System User', 'system-user', message);
        throw error;
    }
}
