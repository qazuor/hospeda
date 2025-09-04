import { EntityViewSection } from '@/components/entity-form';
import { LazySectionWrapper } from '@/components/entity-form/sections/LazySectionWrapper';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { useAccommodationPage } from '@/features/accommodations/hooks/useAccommodationPage';
import { useLazySections } from '@/hooks/useLazySections';
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

    // Convert sections to proper format for lazy loading
    // Sections are already SectionConfig objects, not functions
    const sectionConfigs = sections as SectionConfig[];

    // Use lazy sections hook for performance optimization
    const { shouldLazyLoad, getMetrics } = useLazySections(sectionConfigs, {
        enabled: true,
        preloadCount: 1,
        alwaysLoad: ['basic-info'] // Always load basic info immediately
    });

    if (!entity) {
        return null;
    }

    return (
        <div className={`space-y-6 ${className || ''}`}>
            {/* Performance metrics (only in development) */}
            {process.env.NODE_ENV === 'development' && (
                <div className="rounded bg-blue-50 p-2 text-blue-800 text-xs">
                    Lazy Loading: {getMetrics().loadedCount}/{getMetrics().totalSections} sections
                    loaded
                </div>
            )}

            {sectionConfigs.map((section, index) => {
                // Use custom render function if provided
                if (renderSection) {
                    return renderSection(section, index);
                }

                // Determine if this section should be lazy loaded
                const isLazy = shouldLazyLoad(section.id);

                // Default rendering with lazy loading wrapper
                const sectionContent = (
                    <EntityViewSection
                        key={section.id || `section-${index}`}
                        config={section}
                        values={entity}
                        mode="detailed"
                        entityData={entity}
                        userPermissions={userPermissions}
                    />
                );

                if (isLazy) {
                    return (
                        <LazySectionWrapper
                            key={section.id || `section-${index}`}
                            sectionId={section.id}
                            preloadAdjacent={true}
                            rootMargin="100px"
                            threshold={0.1}
                            className="min-h-[200px]"
                        >
                            {sectionContent}
                        </LazySectionWrapper>
                    );
                }

                return sectionContent;
            })}
        </div>
    );
};
