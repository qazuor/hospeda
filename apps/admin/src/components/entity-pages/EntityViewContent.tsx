import { EntityViewSection } from '@/components/entity-form';
import { EntitlementGatedSection } from '@/components/entity-form/sections/EntitlementGatedSection';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import type { PermissionEnum } from '@repo/schemas';
import type { ReactNode } from 'react';

/**
 * Props for EntityViewContent component
 */
export interface EntityViewContentProps {
    /** Entity type */
    entityType: string;
    /** Entity ID (optional, for compatibility) */
    entityId?: string;
    /** Sections to render */
    sections: SectionConfig[];
    /** Entity data */
    entity: Record<string, unknown>;
    /** User permissions */
    userPermissions: PermissionEnum[];
    /** Custom render function for sections */
    renderSection?: (section: SectionConfig, index: number) => ReactNode;
    /** Additional CSS classes */
    className?: string;
}

/**
 * Component for rendering entity content in view mode.
 * All sections are rendered eagerly since view pages only have 5-7
 * lightweight read-only sections that don't justify lazy loading complexity.
 */
export const EntityViewContent = ({
    sections,
    entity,
    userPermissions,
    renderSection,
    className
}: EntityViewContentProps) => {
    if (!entity) {
        return null;
    }

    return (
        <div className={`space-y-6 ${className || ''}`}>
            <div className="space-y-8">
                {sections.map((section, index) => {
                    if (renderSection) {
                        return renderSection(section, index);
                    }

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

                    if (section.entitlementKey) {
                        return (
                            <EntitlementGatedSection
                                key={section.id || `section-${index}`}
                                entitlementKey={section.entitlementKey}
                                sectionTitle={section.title}
                            >
                                {sectionContent}
                            </EntitlementGatedSection>
                        );
                    }

                    return sectionContent;
                })}
            </div>
        </div>
    );
};
