import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { useCallback, useMemo, useState } from 'react';

/**
 * Configuration for lazy section loading
 */
export interface LazySectionConfig {
    /** Whether lazy loading is enabled globally */
    enabled: boolean;
    /** Number of sections to preload */
    preloadCount: number;
    /** Distance from viewport to start loading */
    rootMargin: string;
    /** Threshold for intersection trigger */
    threshold: number;
    /** Sections that should always be loaded immediately */
    alwaysLoad: string[];
}

/**
 * Default configuration for lazy sections
 */
const DEFAULT_CONFIG: LazySectionConfig = {
    enabled: true,
    preloadCount: 1,
    rootMargin: '100px',
    threshold: 0.1,
    alwaysLoad: ['basic-info'] // Always load basic info immediately
};

/**
 * Hook for managing lazy loading of entity form sections
 * Provides utilities for determining which sections should be lazy loaded
 *
 * @param sections - Array of section configurations
 * @param config - Lazy loading configuration
 * @returns Object with lazy loading utilities
 *
 * @example
 * ```tsx
 * const { shouldLazyLoad, getLoadingPriority, config } = useLazySections(sections, {
 *   enabled: true,
 *   preloadCount: 2
 * });
 * ```
 */
export const useLazySections = (
    sections: SectionConfig[],
    userConfig: Partial<LazySectionConfig> = {}
) => {
    const config = useMemo(
        () => ({
            ...DEFAULT_CONFIG,
            ...userConfig
        }),
        [userConfig]
    );

    const [loadedSections, setLoadedSections] = useState<Set<string>>(new Set(config.alwaysLoad));

    /**
     * Check if a section should be lazy loaded
     */
    const shouldLazyLoad = useCallback(
        (sectionId: string): boolean => {
            if (!config.enabled) return false;
            if (config.alwaysLoad.includes(sectionId)) return false;
            return true;
        },
        [config.enabled, config.alwaysLoad]
    );

    /**
     * Get loading priority for a section (lower = higher priority)
     */
    const getLoadingPriority = useCallback(
        (sectionId: string): number => {
            const sectionIndex = sections.findIndex((s) => s.id === sectionId);

            // Always load sections have highest priority (0)
            if (config.alwaysLoad.includes(sectionId)) return 0;

            // Earlier sections have higher priority
            return sectionIndex + 1;
        },
        [sections, config.alwaysLoad]
    );

    /**
     * Mark a section as loaded
     */
    const markSectionLoaded = useCallback((sectionId: string) => {
        setLoadedSections((prev) => new Set([...prev, sectionId]));
    }, []);

    /**
     * Check if a section is loaded
     */
    const isSectionLoaded = useCallback(
        (sectionId: string): boolean => {
            return loadedSections.has(sectionId);
        },
        [loadedSections]
    );

    /**
     * Get sections that should be preloaded based on currently loaded sections
     */
    const getSectionsToPreload = useCallback((): string[] => {
        const toPreload: string[] = [];
        const loadedArray = Array.from(loadedSections);

        for (const loadedSectionId of loadedArray) {
            const loadedIndex = sections.findIndex((s) => s.id === loadedSectionId);
            if (loadedIndex === -1) continue;

            // Preload next sections
            for (let i = 1; i <= config.preloadCount; i++) {
                const nextIndex = loadedIndex + i;
                if (nextIndex < sections.length) {
                    const nextSection = sections[nextIndex];
                    if (
                        !loadedSections.has(nextSection.id) &&
                        !toPreload.includes(nextSection.id)
                    ) {
                        toPreload.push(nextSection.id);
                    }
                }
            }
        }

        return toPreload;
    }, [sections, loadedSections, config.preloadCount]);

    /**
     * Get performance metrics
     */
    const getMetrics = useCallback(() => {
        const totalSections = sections.length;
        const loadedCount = loadedSections.size;
        const lazyLoadableSections = sections.filter((s) => shouldLazyLoad(s.id)).length;

        return {
            totalSections,
            loadedCount,
            lazyLoadableSections,
            loadingProgress: totalSections > 0 ? (loadedCount / totalSections) * 100 : 0,
            sectionsToPreload: getSectionsToPreload()
        };
    }, [sections, loadedSections, shouldLazyLoad, getSectionsToPreload]);

    return {
        config,
        shouldLazyLoad,
        getLoadingPriority,
        markSectionLoaded,
        isSectionLoaded,
        getSectionsToPreload,
        getMetrics,
        loadedSections: Array.from(loadedSections)
    };
};
