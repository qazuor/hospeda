import { RoleEnum } from '@repo/schemas';
import { UserService } from '@repo/service-core/index.js';
import requiredManifest from '../manifest-required.json';
import { grantFixtureRole } from '../utils/fixtureRoleGrants.js';
import { createDateTransformer, createSeedFactory, STATUS_ICONS } from '../utils/index.js';

/**
 * Seed factory for users
 *
 * Creates user records from JSON files, excluding the super admin user
 * which is loaded separately. Transforms date strings to Date objects.
 *
 * HOS-296: the only fixture this seeds is `admin-user.json` (`role: "ADMIN"`).
 * Its hats — `{USER, ADMIN}`, matching what migration `0069` backfills and what
 * every account-creating path produces — are granted into `user_role` by the
 * `postProcess` hook. Passing
 * `role` through to `UserService.create` stopped doing anything the moment
 * `users.role` was dropped, silently, because Zod strips the unknown key and
 * Drizzle's `.values()` iterates table columns rather than object keys.
 * Without the hook, `admin@hospeda.com.ar` is created holding zero roles.
 */
export const seedUsers = createSeedFactory({
    entityName: 'Users',
    serviceClass: UserService,
    folder: 'src/data/user/required',
    files: requiredManifest.users.filter((file) => file !== 'super-admin-user.json'),

    // Exclude metadata fields and transform date strings to Date objects
    normalizer: (data) => {
        // First exclude metadata fields. `role` is excluded too (HOS-296): it
        // is no longer a column, and leaving it in would look load-bearing.
        const { $schema, id, role, ...cleanData } = data as {
            $schema?: string;
            id?: string;
            role?: string;
            [key: string]: unknown;
        };

        // Then transform dates
        return createDateTransformer(['birthDate'])(cleanData);
    },

    // Custom entity info for better logging
    getEntityInfo: (item, _context) => {
        const user = item as { displayName?: string; role?: string };
        const displayName = user.displayName || 'Unknown';
        const role = user.role || 'USER';
        const roleIcon =
            role === RoleEnum.SUPER_ADMIN
                ? ` ${STATUS_ICONS.UserSuperAdmin}`
                : role === RoleEnum.ADMIN
                  ? ` ${STATUS_ICONS.UserAdmin}`
                  : ` ${STATUS_ICONS.User}`;
        return `"${displayName}" (${role})${roleIcon}`;
    },

    // Custom validation to ensure super admin is not created here.
    // NOTE (HOS-296): the normalizer now strips `role`, so this predicate — which
    // runs on the NORMALIZED payload — can no longer see it. The guard is kept
    // as defence in depth and the real protection is the `files` filter above,
    // which excludes `super-admin-user.json` outright; `postProcess` below
    // re-checks the RAW fixture, where `role` is still present.
    validateBeforeCreate: (data) => {
        const userData = data as { role?: string };
        if (userData.role === RoleEnum.SUPER_ADMIN) {
            throw new Error('Super admin user must be created separately');
        }
        return true;
    },

    // HOS-296: grant the fixture's declared hat into `user_role`.
    postProcess: async (result, item) => {
        const fixture = item as { id?: string; role?: string } | null;
        if (fixture?.role === RoleEnum.SUPER_ADMIN) {
            throw new Error('Super admin user must be created separately');
        }
        await grantFixtureRole({
            result,
            item,
            source: fixture?.id ?? 'required user'
        });
    }
});
