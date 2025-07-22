import path from 'node:path';
import { UserService } from '@repo/service-core/index.js';
import exampleManifest from '../manifest-example.json';
import { STATUS_ICONS } from '../utils/icons.js';
import { createSeedFactory } from '../utils/seedFactory.js';

/**
 * Normalizer for user data
 */
const userNormalizer = (data: Record<string, unknown>) => {
    return {
        slug: data.slug as string,
        displayName: data.displayName as string | undefined,
        firstName: data.firstName as string | undefined,
        lastName: data.lastName as string | undefined,
        birthDate: data.birthDate ? new Date(data.birthDate as string) : undefined,
        contactInfo: data.contactInfo,
        location: data.location,
        socialNetworks: data.socialNetworks,
        role: data.role,
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
        role === 'SUPER_ADMIN'
            ? ` ${STATUS_ICONS.Crown}`
            : role === 'ADMIN'
              ? ` ${STATUS_ICONS.Tool}`
              : ` ${STATUS_ICONS.User}`;
    return `"${displayName}" (${role})${roleIcon}`;
};

/**
 * Users seed using Seed Factory
 */
export const seedUsers = createSeedFactory({
    entityName: 'Users',
    serviceClass: UserService,
    folder: path.resolve('src/data/user/example'),
    files: exampleManifest.users,
    normalizer: userNormalizer,
    getEntityInfo: getUserInfo
});
