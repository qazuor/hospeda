import { EntityFormSection, useEntityForm } from '@/components/entity-form';
import type { FieldMediaHandlers } from '@/components/entity-form/EntityFormSection';
import {
    SectionAccordion,
    SectionAccordionItem
} from '@/components/entity-form/accordion/SectionAccordion';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-wrapped/Card';
import { useToast } from '@/components/ui/ToastProvider';
import { Badge } from '@/components/ui/badge';
import { env } from '@/env';
import { parseApiValidationErrors } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { adminLogger } from '@/utils/logger';
import { useTranslations } from '@repo/i18n';
import { AlertCircleIcon } from '@repo/icons';
import * as React from 'react';
import { type SectionSortOptions, filterAndSortSections } from './utils/section-sorter';
import { type SectionSummaryFn, computeSectionSummary } from './utils/section-summarizer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Props for EntityEditContent component
 */
export interface EntityEditContentProps {
    /** Entity type */
    entityType: string;
    /** Custom render function for sections */
    renderSection?: (section: SectionConfig, index: number) => React.ReactNode;
    /** Additional CSS classes */
    className?: string;
    /**
     * Per-field media upload/delete handlers keyed by fieldId.
     * Forwarded to EntityFormSection, which passes them to GalleryField and other media fields.
     *
     * @example
     * ```tsx
     * <EntityEditContent
     *   entityType="accommodation"
     *   fieldHandlers={{
     *     'media.gallery': {
     *       onUpload: createUploadHandler({ ... }),
     *       onDelete: (publicId) => deleteImage.mutateAsync({ publicId }),
     *     },
     *   }}
     * />
     * ```
     */
    fieldHandlers?: Record<string, FieldMediaHandlers>;
    /**
     * Optional map of per-section custom summarizer functions keyed by section id.
     * Overrides the generic summarizer for the collapsed summary display.
     */
    sectionSummarizers?: Readonly<Record<string, SectionSummaryFn>>;
    /**
     * IDs of sections to anchor at the top of the accordion (spec §4.4).
     * Typically `['states-moderation']` for staff users.
     */
    anchorSectionIds?: readonly string[];
    /**
     * When `true`, render each section as a separate always-open `Card`
     * (no accordion, no collapsed summary). Used by simpler entities
     * (catalogs and sub-entities — SPEC-154 Phase 6) where the accordion
     * adds friction without paying for itself.
     */
    flat?: boolean;
    /**
     * Optional per-field addon nodes keyed by fieldId.
     * Forwarded to EntityFormSection, which renders them below the field
     * component inside the same grid cell.
     *
     * Used by SPEC-198 to mount the AiTextImprovePanel alongside
     * description and summary fields.
     */
    fieldAddons?: Readonly<Record<string, React.ReactNode>>;
}

// ---------------------------------------------------------------------------
// Error badge for accordion header
// ---------------------------------------------------------------------------

/**
 * Small red badge shown in the SectionAccordionItem header when the section
 * has validation errors. Keeps the error visible even when the section is
 * collapsed.
 */
function SectionErrorBadge({ count }: { readonly count: number }) {
    return (
        <Badge
            variant="destructive"
            className="flex items-center gap-1 px-1.5 py-0.5 text-xs"
            data-testid="section-error-badge"
        >
            <AlertCircleIcon
                className="h-3 w-3 flex-none"
                aria-hidden="true"
            />
            {count}
        </Badge>
    );
}

// ---------------------------------------------------------------------------
// Helper: which section has each field's error
// ---------------------------------------------------------------------------

/**
 * Returns the set of section IDs that have at least one field error.
 * Used to compute error counts per section and to force-expand sections
 * with errors when the user tries to submit.
 */
function buildSectionErrorMap(
    sections: SectionConfig[],
    errors: Record<string, string | undefined>
): Map<string, number> {
    const map = new Map<string, number>();

    for (const section of sections) {
        let count = 0;
        for (const field of section.fields ?? []) {
            if (errors[field.id]) count++;
        }
        if (count > 0) map.set(section.id, count);
    }

    return map;
}

// ---------------------------------------------------------------------------
// EntityEditContent
// ---------------------------------------------------------------------------

/**
 * Component for rendering entity content in edit mode using a SectionAccordion.
 *
 * Replaces SmartNavigation / SmartBreadcrumbs / FormSidebarLayout with a single
 * accordion. Key behaviours:
 * - First section starts expanded; others collapsed.
 * - On submit validation failure, sections with errors expand automatically
 *   and show an error badge in their header.
 * - Form values are preserved while sections are collapsed (they live in the
 *   EntityFormProvider context, not in the DOM).
 */
export const EntityEditContent = ({
    entityType: _entityType,
    renderSection,
    className,
    fieldHandlers,
    sectionSummarizers,
    anchorSectionIds,
    flat = false,
    fieldAddons
}: EntityEditContentProps) => {
    const {
        values,
        errors,
        userPermissions,
        getEditableSections,
        save,
        isSaving,
        setFieldValue,
        setErrors
    } = useEntityForm();
    const { addToast } = useToast();
    const { t } = useTranslations();

    const sections = getEditableSections();

    // ------------------------------------------------------------------
    // Filter + sort sections (permissions + anchors)
    // ------------------------------------------------------------------
    const sortOptions: SectionSortOptions = {
        userPermissions,
        mode: 'edit',
        anchorIds: anchorSectionIds
    };
    const orderedSections = filterAndSortSections(sections, sortOptions);

    // ------------------------------------------------------------------
    // Error tracking per section
    // ------------------------------------------------------------------
    const sectionErrorMap = React.useMemo(
        () => buildSectionErrorMap(orderedSections, errors ?? {}),
        [orderedSections, errors]
    );

    // ------------------------------------------------------------------
    // Accordion open state: externally-forced open sections (on error)
    // ------------------------------------------------------------------
    // We use a Set of section IDs that should be forced open.
    // When a submit fails, we populate this set with all sections that have errors.
    // The SectionAccordion itself owns the toggle state; we communicate the
    // desired initial-open IDs via `defaultOpenIds`. To force-expand after an
    // error, we re-key the accordion (via `accordionKey`) so it re-initialises.
    const [accordionKey, setAccordionKey] = React.useState(0);
    const [forcedOpenIds, setForcedOpenIds] = React.useState<readonly string[]>([]);

    // Default open: first section in ordered list
    const defaultOpenIds = React.useMemo<readonly string[]>(() => {
        if (forcedOpenIds.length > 0) return forcedOpenIds;
        return orderedSections.length > 0 && orderedSections[0] ? [orderedSections[0].id] : [];
    }, [orderedSections, forcedOpenIds]);

    // ------------------------------------------------------------------
    // Save handler
    // ------------------------------------------------------------------
    const handleSave = React.useCallback(async () => {
        try {
            await save();

            addToast({
                title: t('error.form.save-success'),
                message: t('error.form.save-success-message'),
                variant: 'success'
            });
        } catch (error) {
            adminLogger.error('Failed to save entity', error);

            const tAny = t as (key: string, params?: Record<string, unknown>) => string;
            const apiBody = (error as { body?: unknown }).body;
            const fieldErrors = parseApiValidationErrors({ error: apiBody, t: tAny });

            let errorMessage = t('error.form.unexpected-error');

            if (Object.keys(fieldErrors).length > 0) {
                const fieldCount = Object.keys(fieldErrors).length;
                errorMessage =
                    fieldCount === 1
                        ? t('error.form.validation-failed-field')
                        : t('error.form.validation-failed-fields-plural', {
                              count: fieldCount
                          });
                setErrors(fieldErrors);

                // Collect sections that contain errors so we can expand them
                const errorSectionIds = orderedSections
                    .filter((section) => section.fields?.some((field) => field.id in fieldErrors))
                    .map((s) => s.id);

                if (errorSectionIds.length > 0) {
                    setForcedOpenIds(errorSectionIds);
                    // Re-key the accordion to re-apply defaultOpenIds
                    setAccordionKey((k) => k + 1);
                }
            } else if (error instanceof Error) {
                errorMessage = error.message;
            }

            addToast({
                title: t('error.form.save-failed'),
                message: errorMessage,
                variant: 'error'
            });
        }
    }, [save, addToast, t, setErrors, orderedSections]);

    /**
     * Shared per-section body builder — same logic for accordion and flat modes.
     */
    const buildSectionBody = (section: SectionConfig, index: number): React.ReactNode => {
        if (renderSection) return renderSection(section, index);

        return (
            <EntityFormSection
                key={section.id || `section-${index}`}
                config={section}
                values={values}
                errors={errors}
                onFieldChange={setFieldValue}
                onFieldBlur={(fieldId) => {
                    adminLogger.log('Field blurred:', fieldId);
                }}
                disabled={isSaving}
                entityData={values}
                userPermissions={userPermissions}
                fieldHandlers={fieldHandlers}
                fieldAddons={fieldAddons}
            />
        );
    };

    return (
        <div className={`space-y-3 ${className ?? ''}`}>
            {/* Performance metrics (development only - hidden by default) */}
            {import.meta.env.DEV && env.VITE_DEBUG_LAZY_SECTIONS && (
                <div className="mb-4 rounded bg-primary/5 p-2 text-primary text-xs">
                    Sections loaded: {orderedSections.length}
                </div>
            )}

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    handleSave();
                }}
            >
                {flat ? (
                    <div className={cn('space-y-4')}>
                        {orderedSections.map((section, index) => {
                            const errorCount = sectionErrorMap.get(section.id) ?? 0;
                            const errorBadge =
                                errorCount > 0 ? (
                                    <SectionErrorBadge count={errorCount} />
                                ) : undefined;

                            return (
                                <Card key={section.id || `section-${index}`}>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            {section.title ?? section.id}
                                            {section.badge}
                                            {errorBadge}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>{buildSectionBody(section, index)}</CardContent>
                                </Card>
                            );
                        })}
                    </div>
                ) : (
                    <SectionAccordion
                        key={accordionKey}
                        defaultOpenIds={defaultOpenIds as string[]}
                    >
                        {orderedSections.map((section, index) => {
                            const errorCount = sectionErrorMap.get(section.id) ?? 0;

                            // Collapsed summary uses current form values
                            const collapsedSummary = computeSectionSummary({
                                values: values ?? {},
                                section,
                                customFn: sectionSummarizers?.[section.id]
                            });

                            const errorBadge =
                                errorCount > 0 ? (
                                    <SectionErrorBadge count={errorCount} />
                                ) : undefined;

                            const headerBadge =
                                section.badge || errorBadge ? (
                                    <span className="flex items-center gap-1">
                                        {section.badge}
                                        {errorBadge}
                                    </span>
                                ) : undefined;

                            return (
                                <SectionAccordionItem
                                    key={section.id || `section-${index}`}
                                    id={section.id}
                                    title={section.title ?? section.id}
                                    icon={section.icon}
                                    badge={headerBadge}
                                    collapsedSummary={collapsedSummary}
                                    defaultCollapsed={index !== 0}
                                >
                                    {buildSectionBody(section, index)}
                                </SectionAccordionItem>
                            );
                        })}
                    </SectionAccordion>
                )}
            </form>
        </div>
    );
};
