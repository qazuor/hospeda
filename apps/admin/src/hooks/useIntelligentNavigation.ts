import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSectionProgress } from './useSectionProgress';
import { useSmartScroll } from './useSmartScroll';

/**
 * Configuration for intelligent navigation
 */
export interface IntelligentNavigationConfig {
    /** Whether to auto-scroll to errors on validation */
    autoScrollToErrors?: boolean;
    /** Whether to auto-advance to next section on completion */
    autoAdvanceOnComplete?: boolean;
    /** Scroll offset for navigation */
    scrollOffset?: number;
    /** Whether to focus fields after scrolling */
    focusAfterScroll?: boolean;
    /** Debounce delay for auto-advance (ms) */
    autoAdvanceDelay?: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<IntelligentNavigationConfig> = {
    autoScrollToErrors: true,
    autoAdvanceOnComplete: false,
    scrollOffset: 80,
    focusAfterScroll: true,
    autoAdvanceDelay: 1000
};

/**
 * Hook for intelligent navigation in entity forms
 * Combines section progress tracking with smart scrolling
 *
 * @param sections - Array of section configurations
 * @param values - Current form values
 * @param errors - Current form errors
 * @param userPermissions - User permissions
 * @param config - Navigation configuration
 * @returns Object with navigation utilities and state
 *
 * @example
 * ```tsx
 * const {
 *   activeSection,
 *   sectionProgress,
 *   overallProgress,
 *   navigateToSection,
 *   navigateToNextSection,
 *   navigateToPreviousSection,
 *   scrollToFirstError
 * } = useIntelligentNavigation(
 *   sections,
 *   formValues,
 *   formErrors,
 *   userPermissions,
 *   { autoScrollToErrors: true }
 * );
 * ```
 */
export const useIntelligentNavigation = (
    sections: SectionConfig[],
    values: Record<string, unknown>,
    errors: Record<string, string | undefined>,
    userPermissions: string[] = [],
    userConfig: IntelligentNavigationConfig = {}
) => {
    const config = useMemo(() => ({ ...DEFAULT_CONFIG, ...userConfig }), [userConfig]);

    // State for active section
    const [activeSection, setActiveSection] = useState<string>(
        sections.length > 0 ? sections[0].id : ''
    );

    // Auto-advance timeout ref
    const [autoAdvanceTimeout, setAutoAdvanceTimeout] = useState<NodeJS.Timeout | null>(null);

    // Get section progress
    const {
        sectionProgress,
        overallProgress,
        getSectionStatus,
        sectionHasErrors,
        getNextIncompleteSection,
        getSectionsWithErrors
    } = useSectionProgress(sections, values, errors, userPermissions);

    // Get smart scroll utilities
    const { scrollToSection, scrollToError, scrollToNextSection, scrollToPreviousSection } =
        useSmartScroll({
            offset: config.scrollOffset,
            focus: config.focusAfterScroll
        });

    // Section IDs for navigation
    const sectionIds = useMemo(() => sections.map((s) => s.id), [sections]);

    /**
     * Navigate to a specific section
     */
    const navigateToSection = useCallback(
        (sectionId: string) => {
            if (!sectionIds.includes(sectionId)) {
                console.warn(`Section "${sectionId}" not found`);
                return false;
            }

            setActiveSection(sectionId);
            return scrollToSection(sectionId);
        },
        [sectionIds, scrollToSection]
    );

    /**
     * Navigate to next section
     */
    const navigateToNextSection = useCallback(() => {
        const success = scrollToNextSection(activeSection, sectionIds);
        if (success) {
            const currentIndex = sectionIds.indexOf(activeSection);
            const nextSectionId = sectionIds[currentIndex + 1];
            setActiveSection(nextSectionId);
        }
        return success;
    }, [activeSection, sectionIds, scrollToNextSection]);

    /**
     * Navigate to previous section
     */
    const navigateToPreviousSection = useCallback(() => {
        const success = scrollToPreviousSection(activeSection, sectionIds);
        if (success) {
            const currentIndex = sectionIds.indexOf(activeSection);
            const previousSectionId = sectionIds[currentIndex - 1];
            setActiveSection(previousSectionId);
        }
        return success;
    }, [activeSection, sectionIds, scrollToPreviousSection]);

    /**
     * Navigate to next incomplete section
     */
    const navigateToNextIncomplete = useCallback(() => {
        const nextIncompleteId = getNextIncompleteSection();
        if (nextIncompleteId) {
            return navigateToSection(nextIncompleteId);
        }
        return false;
    }, [getNextIncompleteSection, navigateToSection]);

    /**
     * Scroll to first error
     */
    const scrollToFirstError = useCallback(() => {
        return scrollToError(errors);
    }, [errors, scrollToError]);

    /**
     * Navigate to first section with errors
     */
    const navigateToFirstError = useCallback(() => {
        const sectionsWithErrors = getSectionsWithErrors();
        if (sectionsWithErrors.length > 0) {
            const firstErrorSection = sectionsWithErrors[0];
            navigateToSection(firstErrorSection);
            // Small delay to ensure section is visible before scrolling to field
            setTimeout(() => scrollToFirstError(), 300);
            return true;
        }
        return false;
    }, [getSectionsWithErrors, navigateToSection, scrollToFirstError]);

    /**
     * Get navigation context for current section
     */
    const getNavigationContext = useCallback(() => {
        const currentIndex = sectionIds.indexOf(activeSection);
        const currentSection = sectionProgress.find((s) => s.id === activeSection);

        return {
            currentIndex,
            isFirst: currentIndex === 0,
            isLast: currentIndex === sectionIds.length - 1,
            canGoNext: currentIndex < sectionIds.length - 1,
            canGoPrevious: currentIndex > 0,
            currentSection,
            nextSectionId:
                currentIndex < sectionIds.length - 1 ? sectionIds[currentIndex + 1] : null,
            previousSectionId: currentIndex > 0 ? sectionIds[currentIndex - 1] : null
        };
    }, [activeSection, sectionIds, sectionProgress]);

    // Auto-scroll to errors when they appear
    useEffect(() => {
        if (config.autoScrollToErrors && Object.keys(errors).length > 0) {
            const timer = setTimeout(() => {
                scrollToFirstError();
            }, 100); // Small delay to ensure DOM is updated

            return () => clearTimeout(timer);
        }
    }, [errors, config.autoScrollToErrors, scrollToFirstError]);

    // Auto-advance to next section when current is complete
    useEffect(() => {
        if (!config.autoAdvanceOnComplete) return;

        const currentSectionStatus = getSectionStatus(activeSection);

        if (currentSectionStatus === 'complete') {
            // Clear existing timeout
            if (autoAdvanceTimeout) {
                clearTimeout(autoAdvanceTimeout);
            }

            // Set new timeout for auto-advance
            const timeout = setTimeout(() => {
                const { canGoNext } = getNavigationContext();
                if (canGoNext) {
                    navigateToNextSection();
                }
            }, config.autoAdvanceDelay);

            setAutoAdvanceTimeout(timeout);
        } else {
            // Clear timeout if section is no longer complete
            if (autoAdvanceTimeout) {
                clearTimeout(autoAdvanceTimeout);
                setAutoAdvanceTimeout(null);
            }
        }

        return () => {
            if (autoAdvanceTimeout) {
                clearTimeout(autoAdvanceTimeout);
            }
        };
    }, [
        activeSection,
        getSectionStatus,
        config.autoAdvanceOnComplete,
        config.autoAdvanceDelay,
        autoAdvanceTimeout,
        getNavigationContext,
        navigateToNextSection
    ]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Only handle if no input is focused
            if (
                document.activeElement?.tagName === 'INPUT' ||
                document.activeElement?.tagName === 'TEXTAREA'
            ) {
                return;
            }

            if (event.ctrlKey || event.metaKey) {
                switch (event.key) {
                    case 'ArrowUp':
                        event.preventDefault();
                        navigateToPreviousSection();
                        break;
                    case 'ArrowDown':
                        event.preventDefault();
                        navigateToNextSection();
                        break;
                    case 'e':
                        event.preventDefault();
                        navigateToFirstError();
                        break;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [navigateToNextSection, navigateToPreviousSection, navigateToFirstError]);

    return {
        // State
        activeSection,
        sectionProgress,
        overallProgress,

        // Navigation
        navigateToSection,
        navigateToNextSection,
        navigateToPreviousSection,
        navigateToNextIncomplete,
        navigateToFirstError,
        scrollToFirstError,

        // Context
        getNavigationContext,

        // Utilities
        getSectionStatus,
        sectionHasErrors,
        getSectionsWithErrors
    };
};
