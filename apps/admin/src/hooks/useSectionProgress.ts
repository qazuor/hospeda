import type { FieldConfig } from '@/components/entity-form/types/field-config.types';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { useCallback, useMemo } from 'react';

/**
 * Section completion status
 */
export type SectionStatus = 'empty' | 'partial' | 'complete' | 'error' | 'disabled';

/**
 * Section progress information
 */
export interface SectionProgress {
    /** Section ID */
    id: string;
    /** Section title */
    title: string;
    /** Current status */
    status: SectionStatus;
    /** Number of completed fields */
    completedFields: number;
    /** Total number of fields */
    totalFields: number;
    /** Completion percentage (0-100) */
    completionPercentage: number;
    /** Whether section has errors */
    hasErrors: boolean;
    /** Number of errors in section */
    errorCount: number;
    /** Whether section is required */
    isRequired: boolean;
    /** Whether section is visible */
    isVisible: boolean;
}

/**
 * Overall progress summary
 */
export interface OverallProgress {
    /** Total completion percentage */
    completionPercentage: number;
    /** Number of completed sections */
    completedSections: number;
    /** Total number of sections */
    totalSections: number;
    /** Number of sections with errors */
    sectionsWithErrors: number;
    /** Whether all required sections are complete */
    allRequiredComplete: boolean;
    /** Whether form is ready for submission */
    readyForSubmission: boolean;
}

/**
 * Hook for tracking section and overall form progress
 * Provides detailed progress information for navigation and UX
 *
 * @param sections - Array of section configurations
 * @param values - Current form values
 * @param errors - Current form errors
 * @param userPermissions - User permissions for visibility checks
 * @returns Object with progress utilities and data
 *
 * @example
 * ```tsx
 * const { sectionProgress, overallProgress, getSectionStatus } = useSectionProgress(
 *   sections,
 *   formValues,
 *   formErrors,
 *   userPermissions
 * );
 *
 * // Get progress for specific section
 * const basicInfoProgress = sectionProgress.find(s => s.id === 'basic-info');
 *
 * // Check if section is complete
 * const isComplete = getSectionStatus('basic-info') === 'complete';
 * ```
 */
export const useSectionProgress = (
    sections: SectionConfig[],
    values: Record<string, unknown>,
    errors: Record<string, string | undefined>,
    userPermissions: string[] = []
) => {
    /**
     * Check if a field is visible based on permissions and conditions
     */
    const isFieldVisible = useCallback(
        (field: FieldConfig) => {
            // Check view permissions
            if (field.permissions?.view) {
                const hasViewPermission = field.permissions.view.some((permission: string) =>
                    userPermissions.includes(permission)
                );
                if (!hasViewPermission) return false;
            }

            // Check visibleIf condition
            if (field.visibleIf) {
                // Simple implementation - can be enhanced with more complex logic
                return true; // For now, assume visible
            }

            return true;
        },
        [userPermissions]
    );

    /**
     * Check if a field has a meaningful value
     */
    const isFieldComplete = useCallback((_field: FieldConfig, value: unknown) => {
        if (value === null || value === undefined) return false;

        if (typeof value === 'string') {
            return value.trim().length > 0;
        }

        if (Array.isArray(value)) {
            return value.length > 0;
        }

        if (typeof value === 'object') {
            return Object.keys(value).length > 0;
        }

        return true;
    }, []);

    /**
     * Calculate progress for a single section
     */
    const calculateSectionProgress = useCallback(
        (section: SectionConfig): SectionProgress => {
            const visibleFields = section.fields.filter(isFieldVisible);
            const totalFields = visibleFields.length;

            if (totalFields === 0) {
                return {
                    id: section.id,
                    title: section.title || section.id,
                    status: 'disabled',
                    completedFields: 0,
                    totalFields: 0,
                    completionPercentage: 0,
                    hasErrors: false,
                    errorCount: 0,
                    isRequired: false, // SectionConfig doesn't have required property
                    isVisible: true
                };
            }

            let completedFields = 0;
            let errorCount = 0;

            for (const field of visibleFields) {
                const fieldValue = values[field.id];
                const fieldError = errors[field.id];

                if (fieldError) {
                    errorCount++;
                }

                if (isFieldComplete(field, fieldValue)) {
                    completedFields++;
                }
            }

            const completionPercentage = Math.round((completedFields / totalFields) * 100);
            const hasErrors = errorCount > 0;

            // Determine status
            let status: SectionStatus;
            if (hasErrors) {
                status = 'error';
            } else if (completedFields === 0) {
                status = 'empty';
            } else if (completedFields === totalFields) {
                status = 'complete';
            } else {
                status = 'partial';
            }

            return {
                id: section.id,
                title: section.title || section.id,
                status,
                completedFields,
                totalFields,
                completionPercentage,
                hasErrors,
                errorCount,
                isRequired: false, // SectionConfig doesn't have required property
                isVisible: true
            };
        },
        [values, errors, isFieldVisible, isFieldComplete]
    );

    /**
     * Calculate progress for all sections
     */
    const sectionProgress = useMemo(() => {
        return sections.map(calculateSectionProgress);
    }, [sections, calculateSectionProgress]);

    /**
     * Calculate overall progress
     */
    const overallProgress = useMemo((): OverallProgress => {
        const visibleSections = sectionProgress.filter((s) => s.isVisible && s.totalFields > 0);
        const totalSections = visibleSections.length;

        if (totalSections === 0) {
            return {
                completionPercentage: 0,
                completedSections: 0,
                totalSections: 0,
                sectionsWithErrors: 0,
                allRequiredComplete: true,
                readyForSubmission: false
            };
        }

        const completedSections = visibleSections.filter((s) => s.status === 'complete').length;
        const sectionsWithErrors = visibleSections.filter((s) => s.hasErrors).length;
        const requiredSections = visibleSections.filter((s) => s.isRequired);
        const completedRequiredSections = requiredSections.filter((s) => s.status === 'complete');

        const totalCompletionPercentage = visibleSections.reduce(
            (sum, section) => sum + section.completionPercentage,
            0
        );
        const completionPercentage = Math.round(totalCompletionPercentage / totalSections);

        const allRequiredComplete = completedRequiredSections.length === requiredSections.length;
        const readyForSubmission = allRequiredComplete && sectionsWithErrors === 0;

        return {
            completionPercentage,
            completedSections,
            totalSections,
            sectionsWithErrors,
            allRequiredComplete,
            readyForSubmission
        };
    }, [sectionProgress]);

    /**
     * Get status for a specific section
     */
    const getSectionStatus = useCallback(
        (sectionId: string): SectionStatus => {
            const section = sectionProgress.find((s) => s.id === sectionId);
            return section?.status || 'empty';
        },
        [sectionProgress]
    );

    /**
     * Get completion percentage for a specific section
     */
    const getSectionCompletion = useCallback(
        (sectionId: string): number => {
            const section = sectionProgress.find((s) => s.id === sectionId);
            return section?.completionPercentage || 0;
        },
        [sectionProgress]
    );

    /**
     * Check if section has errors
     */
    const sectionHasErrors = useCallback(
        (sectionId: string): boolean => {
            const section = sectionProgress.find((s) => s.id === sectionId);
            return section?.hasErrors || false;
        },
        [sectionProgress]
    );

    /**
     * Get next incomplete section
     */
    const getNextIncompleteSection = useCallback((): string | null => {
        const incompleteSection = sectionProgress.find(
            (s) => s.isVisible && s.totalFields > 0 && s.status !== 'complete'
        );
        return incompleteSection?.id || null;
    }, [sectionProgress]);

    /**
     * Get sections with errors
     */
    const getSectionsWithErrors = useCallback((): string[] => {
        return sectionProgress.filter((s) => s.hasErrors).map((s) => s.id);
    }, [sectionProgress]);

    return {
        sectionProgress,
        overallProgress,
        getSectionStatus,
        getSectionCompletion,
        sectionHasErrors,
        getNextIncompleteSection,
        getSectionsWithErrors
    };
};
