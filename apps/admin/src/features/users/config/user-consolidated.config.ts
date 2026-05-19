import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import type { useTranslations } from '@repo/i18n';
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
 * Creates the complete consolidated configuration for the User entity.
 *
 * @param t - Translation function from `useTranslations()`
 */
export const createUserConsolidatedConfig = (
    t: ReturnType<typeof useTranslations>['t']
): UserConsolidatedConfig => ({
    sections: [
        createBasicInfoConsolidatedSection(),
        createContactConsolidatedSection(),
        createRolePermissionsConsolidatedSection(),
        createStatesConsolidatedSection()
    ],
    metadata: {
        entityType: 'user',
        entityName: t('admin-entities.entities.user.singular'),
        entityNamePlural: t('admin-entities.entities.user.plural'),
        baseRoute: '/access/users'
    }
});
