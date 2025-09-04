import { EntityViewSection } from '@/components/entity-form';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { useAccommodationPage } from '@/features/accommodations/hooks/useAccommodationPage';
import type { ReactNode } from 'react';

/**
 * Props for EntityViewContent component
 */
export interface EntityViewContentProps {
    /** Entity type */
    entityType: string;
    /** Entity ID */
    entityId: string;
    /** Custom render function for sections */
    renderSection?: (section: SectionConfig, index: number) => ReactNode;
    /** Additional CSS classes */
    className?: string;
}

/**
 * Component for rendering entity content in view mode
 * Renders sections using EntityViewSection components
 */
export const EntityViewContent = ({
    entityId,
    renderSection,
    className
}: EntityViewContentProps) => {
    const { sections, userPermissions, entity } = useAccommodationPage(entityId);

    if (!entity) {
        return null;
    }

    return (
        <div className={`space-y-6 ${className || ''}`}>
            {sections.map((sectionFn, index) => {
                // Handle both function and direct section config
                const section =
                    typeof sectionFn === 'function'
                        ? (sectionFn as () => SectionConfig)()
                        : sectionFn;

                // Use custom render function if provided
                if (renderSection) {
                    return renderSection(section, index);
                }

                // Default rendering
                return (
                    <EntityViewSection
                        key={section.id || `section-${index}`}
                        config={section}
                        values={entity}
                        mode="detailed"
                        entityData={entity}
                        userPermissions={userPermissions}
                    />
                );
            })}
        </div>
    );
};
