import { UserService } from '@repo/service-core/index.js';
import requiredManifest from '../manifest-required.json';
import { createDateTransformer, createSeedFactory } from '../utils/index.js';

/**
 * Seed factory for users
 *
 * Creates user records from JSON files, excluding the super admin user
 * which is loaded separately. Transforms date strings to Date objects.
 */
export const seedUsers = createSeedFactory({
    entityName: 'Users',
    serviceClass: UserService,
    folder: 'src/data/user/required',
    files: requiredManifest.users.filter((file) => file !== 'super-admin-user.json'),

    // Exclude metadata fields and transform date strings to Date objects
    normalizer: (data) => {
        // First exclude metadata fields
        const { $schema, id, ...cleanData } = data as {
            $schema?: string;
            id?: string;
            [key: string]: unknown;
        };

        // Then transform dates
        return createDateTransformer(['birthDate'])(cleanData);
    },

    // Custom entity info for better logging
    getEntityInfo: (item) => {
        const user = item as { displayName?: string; role?: string };
        const displayName = user.displayName || 'Unknown';
        const role = user.role || 'USER';
        const roleIcon = role === 'SUPER_ADMIN' ? ' 👑' : role === 'ADMIN' ? ' 🔧' : ' 👤';
        return `"${displayName}" (${role})${roleIcon}`;
    },

    // Custom validation to ensure super admin is not created here
    validateBeforeCreate: (data) => {
        const userData = data as { role?: string };
        if (userData.role === 'SUPER_ADMIN') {
            throw new Error('Super admin user must be created separately');
        }
        return true;
    }
});
