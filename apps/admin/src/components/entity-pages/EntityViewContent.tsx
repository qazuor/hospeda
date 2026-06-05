import { EntityViewSection } from '@/components/entity-form';
import {
    SectionAccordion,
    SectionAccordionItem
} from '@/components/entity-form/accordion/SectionAccordion';
import { EntitlementGatedSection } from '@/components/entity-form/sections/EntitlementGatedSection';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-wrapped/Card';
import { cn } from '@/lib/utils';
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
    /**
     * When `true`, render each section as a separate always-open `Card`
     * (no accordion, no collapsed summary). Used by simpler entities
     * (catalogs and sub-entities — SPEC-154 Phase 6) where the
     * accordion adds friction without paying for itself.
     */
    flat?: boolean;
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
    flat = false,
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

    /**
     * Shared per-section body builder — same logic for accordion and flat modes.
     *
     * Sections with `customRender` bypass the standard field-grid renderer
     * entirely — the function is called directly (SPEC-197 T-016).
     */
    const buildSectionBody = (section: SectionConfig, index: number): ReactNode => {
        if (renderSection) return renderSection(section, index);

        // Custom-render sections (e.g. stats-chips) bypass the field renderer.
        if (typeof section.customRender === 'function') {
            return section.customRender();
        }

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

        return section.entitlementKey ? (
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
    };

    // ------------------------------------------------------------------
    // Flat mode — each section in its own always-open Card. No collapsed
    // summary, no toggle, no accordion semantics. Used by simpler
    // catalog / sub-entity surfaces (SPEC-154 Phase 6).
    // ------------------------------------------------------------------
    if (flat) {
        return (
            <div className={cn('space-y-4', className)}>
                {orderedSections.map((section, index) => (
                    <Card key={section.id || `section-${index}`}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                {section.title ?? section.id}
                                {section.badge}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>{buildSectionBody(section, index)}</CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    // 2. First section is open by default; rest are collapsed
    const defaultOpenIds =
        orderedSections.length > 0 && orderedSections[0] ? [orderedSections[0].id] : [];

    return (
        <div className={`space-y-3 ${className ?? ''}`}>
            <SectionAccordion defaultOpenIds={defaultOpenIds}>
                {orderedSections.map((section, index) => {
                    const collapsedSummary = computeSectionSummary({
                        values: entity,
                        section,
                        customFn: sectionSummarizers?.[section.id]
                    });

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
                            {buildSectionBody(section, index)}
                        </SectionAccordionItem>
                    );
                })}
            </SectionAccordion>
        </div>
    );
};
