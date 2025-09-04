import { useCallback, useMemo, useRef } from 'react';

/**
 * Configuration options for smart scrolling
 */
export interface SmartScrollOptions {
    /** Offset from top when scrolling to element */
    offset?: number;
    /** Scroll behavior (smooth or auto) */
    behavior?: ScrollBehavior;
    /** Duration for custom smooth scroll (ms) */
    duration?: number;
    /** Whether to focus the element after scrolling */
    focus?: boolean;
    /** Block position for scrollIntoView */
    block?: ScrollLogicalPosition;
    /** Inline position for scrollIntoView */
    inline?: ScrollLogicalPosition;
}

/**
 * Default options for smart scrolling
 */
const DEFAULT_OPTIONS: Required<SmartScrollOptions> = {
    offset: 80, // Account for sticky headers
    behavior: 'smooth',
    duration: 500,
    focus: false,
    block: 'start',
    inline: 'nearest'
};

/**
 * Hook for intelligent scrolling with various scroll-to utilities
 * Provides smooth scrolling with offset support and focus management
 *
 * @param options - Configuration options for scrolling behavior
 * @returns Object with scroll utilities
 *
 * @example
 * ```tsx
 * const { scrollToElement, scrollToSection, scrollToError } = useSmartScroll({
 *   offset: 100,
 *   behavior: 'smooth'
 * });
 *
 * // Scroll to specific element
 * scrollToElement(elementRef.current);
 *
 * // Scroll to section by ID
 * scrollToSection('basic-info');
 *
 * // Scroll to first error
 * scrollToError(errors);
 * ```
 */
export const useSmartScroll = (userOptions: SmartScrollOptions = {}) => {
    const options = useMemo(() => ({ ...DEFAULT_OPTIONS, ...userOptions }), [userOptions]);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    /**
     * Scroll to a specific DOM element
     */
    const scrollToElement = useCallback(
        (element: Element | null, customOptions?: Partial<SmartScrollOptions>) => {
            if (!element) return;

            const finalOptions = { ...options, ...customOptions };

            // Clear any existing scroll timeout
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }

            // Use native scrollIntoView for better browser support
            element.scrollIntoView({
                behavior: finalOptions.behavior,
                block: finalOptions.block,
                inline: finalOptions.inline
            });

            // Apply custom offset if needed
            if (finalOptions.offset > 0) {
                scrollTimeoutRef.current = setTimeout(() => {
                    const elementRect = element.getBoundingClientRect();
                    const currentScrollY = window.scrollY;
                    const targetScrollY = currentScrollY + elementRect.top - finalOptions.offset;

                    window.scrollTo({
                        top: targetScrollY,
                        behavior: finalOptions.behavior
                    });
                }, 50); // Small delay to ensure scrollIntoView completes
            }

            // Focus element if requested
            if (finalOptions.focus && element instanceof HTMLElement) {
                scrollTimeoutRef.current = setTimeout(() => {
                    element.focus({ preventScroll: true });
                }, finalOptions.duration);
            }
        },
        [options]
    );

    /**
     * Scroll to a section by its ID or data attribute
     */
    const scrollToSection = useCallback(
        (sectionId: string, customOptions?: Partial<SmartScrollOptions>) => {
            // Try multiple selectors to find the section
            const selectors = [
                `#${sectionId}`,
                `[data-section-id="${sectionId}"]`,
                `[data-testid="${sectionId}"]`,
                `[id*="${sectionId}"]`
            ];

            let element: Element | null = null;
            for (const selector of selectors) {
                element = document.querySelector(selector);
                if (element) break;
            }

            if (element) {
                scrollToElement(element, customOptions);
                return true;
            }

            console.warn(`Section with ID "${sectionId}" not found`);
            return false;
        },
        [scrollToElement]
    );

    /**
     * Scroll to the first field with an error
     */
    const scrollToError = useCallback(
        (
            errors: Record<string, string | undefined>,
            customOptions?: Partial<SmartScrollOptions>
        ) => {
            const errorFields = Object.keys(errors).filter((key) => errors[key]);

            if (errorFields.length === 0) return false;

            const firstErrorField = errorFields[0];

            // Try to find the field element
            const selectors = [
                `[name="${firstErrorField}"]`,
                `[data-field-id="${firstErrorField}"]`,
                `#${firstErrorField}`,
                `[id*="${firstErrorField}"]`
            ];

            let element: Element | null = null;
            for (const selector of selectors) {
                element = document.querySelector(selector);
                if (element) break;
            }

            if (element) {
                scrollToElement(element, {
                    ...customOptions,
                    focus: true // Always focus error fields
                });
                return true;
            }

            console.warn(`Error field "${firstErrorField}" not found in DOM`);
            return false;
        },
        [scrollToElement]
    );

    /**
     * Scroll to top of page
     */
    const scrollToTop = useCallback(
        (customOptions?: Partial<SmartScrollOptions>) => {
            const finalOptions = { ...options, ...customOptions };

            window.scrollTo({
                top: 0,
                behavior: finalOptions.behavior
            });
        },
        [options]
    );

    /**
     * Scroll to next section relative to current active section
     */
    const scrollToNextSection = useCallback(
        (
            currentSectionId: string,
            sectionIds: string[],
            customOptions?: Partial<SmartScrollOptions>
        ) => {
            const currentIndex = sectionIds.indexOf(currentSectionId);
            if (currentIndex === -1 || currentIndex === sectionIds.length - 1) {
                return false; // No next section
            }

            const nextSectionId = sectionIds[currentIndex + 1];
            return scrollToSection(nextSectionId, customOptions);
        },
        [scrollToSection]
    );

    /**
     * Scroll to previous section relative to current active section
     */
    const scrollToPreviousSection = useCallback(
        (
            currentSectionId: string,
            sectionIds: string[],
            customOptions?: Partial<SmartScrollOptions>
        ) => {
            const currentIndex = sectionIds.indexOf(currentSectionId);
            if (currentIndex <= 0) {
                return false; // No previous section
            }

            const previousSectionId = sectionIds[currentIndex - 1];
            return scrollToSection(previousSectionId, customOptions);
        },
        [scrollToSection]
    );

    return {
        scrollToElement,
        scrollToSection,
        scrollToError,
        scrollToTop,
        scrollToNextSection,
        scrollToPreviousSection
    };
};
