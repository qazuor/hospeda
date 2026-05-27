import { EntityViewSection } from '@/components/entity-form';
import {
    SectionAccordion,
    SectionAccordionItem
} from '@/components/entity-form/accordion/SectionAccordion';
import { EntitlementGatedSection } from '@/components/entity-form/sections/EntitlementGatedSection';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import type { PermissionEnum } from '@repo/schemas';
import type { ReactNode } from 'react';
import { type SectionSortOptions, filterAndSortSections } from './utils/section-sorter';
import { type SectionSummaryFn, computeSectionSummary } from './utils/section-summarizer';

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
    /** Custom render function for sections — receives the section and its open panel content */
    renderSection?: (section: SectionConfig, index: number) => ReactNode;
    /**
     * Optional map of per-section custom summarizer functions keyed by section id.
     * When provided for a section id, overrides the generic summarizer for that section.
     */
    sectionSummarizers?: Readonly<Record<string, SectionSummaryFn>>;
    /**
     * IDs of sections to anchor at the top of the accordion (spec §4.4).
     * Typically used to put "states-moderation" first for staff.
     * When undefined, sections are shown in config order after permission filtering.
     */
    anchorSectionIds?: readonly string[];
    /** Additional CSS classes */
    className?: string;
}

/**
 * Component for rendering entity content in view mode.
 *
 * Replaces the flat section list with a SectionAccordion so each section is
 * collapsible and shows a summary when collapsed. Sections are filtered by
 * user permissions and optionally reordered with anchor sections first.
 *
 * The first non-anchored section defaults to open; all others start collapsed.
 */
export const EntityViewContent = ({
    entityType: _entityType,
    entityId: _entityId,
    sections,
    entity,
    userPermissions,
    renderSection,
    sectionSummarizers,
    anchorSectionIds,
    className
}: EntityViewContentProps) => {
    if (!entity) {
        return null;
    }

    // 1. Filter by permissions + apply anchor ordering
    const sortOptions: SectionSortOptions = {
        userPermissions,
        mode: 'view',
        anchorIds: anchorSectionIds
    };
    const orderedSections = filterAndSortSections(sections, sortOptions);

    // 2. First section is open by default; rest are collapsed
    const defaultOpenIds =
        orderedSections.length > 0 && orderedSections[0] ? [orderedSections[0].id] : [];

    return (
        <div className={`space-y-3 ${className ?? ''}`}>
            <SectionAccordion defaultOpenIds={defaultOpenIds}>
                {orderedSections.map((section, index) => {
                    // Collapsed summary
                    const collapsedSummary = computeSectionSummary({
                        values: entity,
                        section,
                        customFn: sectionSummarizers?.[section.id]
                    });

                    // Section body
                    let sectionBody: ReactNode;

                    if (renderSection) {
                        sectionBody = renderSection(section, index);
                    } else {
                        const viewSection = (
                            <EntityViewSection
                                key={section.id || `section-${index}`}
                                config={section}
                                values={entity}
                                mode="detailed"
                                entityData={entity}
                                userPermissions={userPermissions}
                            />
                        );

                        sectionBody = section.entitlementKey ? (
                            <EntitlementGatedSection
                                key={section.id || `section-${index}`}
                                entitlementKey={section.entitlementKey}
                                sectionTitle={section.title}
                            >
                                {viewSection}
                            </EntitlementGatedSection>
                        ) : (
                            viewSection
                        );
                    }

                    return (
                        <SectionAccordionItem
                            key={section.id || `section-${index}`}
                            id={section.id}
                            title={section.title ?? section.id}
                            icon={section.icon}
                            badge={section.badge}
                            collapsedSummary={collapsedSummary}
                            defaultCollapsed={index !== 0}
                        >
                            {sectionBody}
                        </SectionAccordionItem>
                    );
                })}
            </SectionAccordion>
        </div>
    );
};
