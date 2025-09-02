import type { EntityConfig } from '@/components/entity-form/types/entity-config.types';
import React from 'react';

/**
 * Context for providing stable entity configuration
 * Prevents infinite loops by memoizing entity config and its functions
 */
interface EntityConfigContextValue {
    entityConfig: EntityConfig | null;
}

const EntityConfigContext = React.createContext<EntityConfigContextValue>({
    entityConfig: null
});

/**
 * Props for EntityConfigProvider
 */
interface EntityConfigProviderProps {
    /** The entity configuration to provide */
    entityConfig: EntityConfig;
    /** Child components */
    children: React.ReactNode;
}

/**
 * Provider component that stabilizes entity configuration
 * Uses React.useMemo to prevent unnecessary re-creation of config objects
 */
export const EntityConfigProvider: React.FC<EntityConfigProviderProps> = ({
    entityConfig,
    children
}) => {
    // Simply pass through the entity config
    // The stability will be handled by using stable functions in the configuration
    const stableEntityConfig = React.useMemo(() => entityConfig, [entityConfig]);

    const contextValue = React.useMemo(
        () => ({
            entityConfig: stableEntityConfig
        }),
        [stableEntityConfig]
    );

    return (
        <EntityConfigContext.Provider value={contextValue}>{children}</EntityConfigContext.Provider>
    );
};

/**
 * Hook to access the stable entity configuration
 */
export const useEntityConfig = (): EntityConfig | null => {
    const context = React.useContext(EntityConfigContext);
    return context.entityConfig;
};

/**
 * Hook to access a specific section from the entity configuration
 */
export const useEntitySection = (sectionId: string) => {
    const entityConfig = useEntityConfig();

    if (!entityConfig) {
        return null;
    }

    // Look for the section in editSections first, then sections
    const section =
        entityConfig.editSections.find((s) => s.id === sectionId) ||
        entityConfig.sections.find((s) => s.id === sectionId);

    return section || null;
};
