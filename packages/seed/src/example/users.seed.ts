import { RoleEnum } from '@repo/schemas';
import { UserService } from '@repo/service-core/index.js';
import exampleManifest from '../manifest-example.json';
import { grantFixtureRole } from '../utils/fixtureRoleGrants.js';
import { STATUS_ICONS } from '../utils/icons.js';
import { createSeedFactory } from '../utils/seedFactory.js';

/**
 * Normalizer for user data
 */
const userNormalizer = (data: Record<string, unknown>) => {
    // Derive email from contactInfo when not present at top level
    const contactInfo = data.contactInfo as
        | { personalEmail?: string; workEmail?: string }
        | undefined;
    const email =
        (data.email as string) || contactInfo?.personalEmail || contactInfo?.workEmail || undefined;

    return {
        slug: data.slug as string,
        email,
        emailVerified: (data.emailVerified as boolean) ?? true,
        displayName: data.displayName as string | undefined,
        firstName: data.firstName as string | undefined,
        lastName: data.lastName as string | undefined,
        birthDate: data.birthDate ? new Date(data.birthDate as string) : undefined,
        contactInfo: data.contactInfo,
        location: data.location,
        socialNetworks: data.socialNetworks,
        // HOS-296: `role` is deliberately NOT forwarded here any more. It was
        // never reaching the database anyway once `users.role` was dropped —
        // `UserCreateInputSchema` strips the unknown key and Drizzle's
        // `.values()` iterates table columns, not object keys — it only LOOKED
        // like it worked. The hat is granted into `user_role` by the
        // `postProcess` hook below instead.
        permissions: data.permissions,
        profile: data.profile,
        settings: data.settings,
        lifecycleState: data.lifecycleState,
        visibility: data.visibility
    };
};

/**
 * Get entity info for user
 */
const getUserInfo = (item: unknown) => {
    const userData = item as Record<string, unknown>;
    const displayName = userData.displayName as string;
    const role = userData.role as string;
    const roleIcon =
        role === RoleEnum.SUPER_ADMIN
            ? ` ${STATUS_ICONS.UserSuperAdmin}`
            : role === RoleEnum.ADMIN
              ? ` ${STATUS_ICONS.UserAdmin}`
              : ` ${STATUS_ICONS.User}`;
    return `"${displayName}" (${role})${roleIcon}`;
};

/**
 * Users seed using Seed Factory.
 *
 * HOS-296: the `postProcess` hook grants each fixture the hat its JSON
 * declares. 33 of the 38 example users are `HOST` and own the example
 * accommodations, so without this hook the entire demo dataset would be owned
 * by accounts holding no roles and therefore no permissions.
 */
export const seedUsers = createSeedFactory({
    entityName: 'Users',
    serviceClass: UserService,
    folder: 'src/data/user/example',
    files: exampleManifest.users,
    normalizer: userNormalizer,
    getEntityInfo: getUserInfo,
    postProcess: async (result, item) => {
        const seedId = (item as { id?: string } | null)?.id;
        await grantFixtureRole({
            result,
            item,
            source: seedId ?? 'example user'
        });
    }
});
