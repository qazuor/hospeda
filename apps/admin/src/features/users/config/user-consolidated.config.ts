import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import { createBasicInfoConsolidatedSection } from './sections/basic-info.consolidated';
import { createContactConsolidatedSection } from './sections/contact.consolidated';
import { createRolePermissionsConsolidatedSection } from './sections/role-permissions.consolidated';
import { createStatesConsolidatedSection } from './sections/states.consolidated';

/**
 * Consolidated configuration for Users entity
 * Combines all section configurations into a single object
 */
export interface UserConsolidatedConfig {
    sections: ConsolidatedSectionConfig[];
    metadata: {
        entityType: string;
        entityName: string;
        entityNamePlural: string;
        baseRoute: string;
    };
}

/**
 * Creates the complete consolidated configuration for the User entity
 */
export const createUserConsolidatedConfig = (): UserConsolidatedConfig => ({
    sections: [
        createBasicInfoConsolidatedSection(),
        createContactConsolidatedSection(),
        createRolePermissionsConsolidatedSection(),
        createStatesConsolidatedSection()
    ],
    metadata: {
        entityType: 'user',
        entityName: 'Usuario',
        entityNamePlural: 'Usuarios',
        baseRoute: '/access/users'
    }
});
