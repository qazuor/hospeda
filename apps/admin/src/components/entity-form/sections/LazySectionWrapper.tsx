import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import React, { Suspense, useState } from 'react';

/**
 * Props for LazySectionWrapper component
 */
export interface LazySectionWrapperProps {
    /** Unique identifier for the section */
    sectionId: string;
    /** Children to render when section is loaded */
    children: React.ReactNode;
    /** Custom loading component */
    fallback?: React.ReactNode;
    /** Whether to preload adjacent sections */
    preloadAdjacent?: boolean;
    /** Distance from viewport to start loading */
    rootMargin?: string;
    /** Threshold for intersection trigger */
    threshold?: number;
    /** Additional CSS classes */
    className?: string;
    /** Whether lazy loading is enabled */
    enabled?: boolean;
}

/**
 * Default loading component for sections
 */
const DefaultSectionLoader: React.FC<{ sectionId: string }> = () => (
    <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
        <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-blue-600 border-b-2" />
            <p className="mt-2 text-gray-600 text-sm">Loading section...</p>
        </div>
    </div>
);

/**
 * Wrapper component for lazy loading entity form sections
 * Uses IntersectionObserver to load sections only when they become visible
 *
 * @example
 * ```tsx
 * <LazySectionWrapper sectionId="basic-info" preloadAdjacent>
 *   <EntityFormSection config={sectionConfig} />
 * </LazySectionWrapper>
 * ```
 */
export const LazySectionWrapper: React.FC<LazySectionWrapperProps> = ({
    sectionId,
    children,
    fallback,
    preloadAdjacent = true,
    rootMargin = '100px',
    threshold = 0.1,
    className = '',
    enabled = true
}) => {
    const [isLoaded, setIsLoaded] = useState(!enabled);
    const [isPreloading, setIsPreloading] = useState(false);

    // Use intersection observer to detect when section should load
    const { ref, isIntersecting } = useIntersectionObserver({
        rootMargin,
        threshold,
        triggerOnce: true,
        enabled
    });

    // Use another observer for preloading adjacent sections
    const { ref: preloadRef, isIntersecting: isPreloadIntersecting } = useIntersectionObserver({
        rootMargin: preloadAdjacent ? '200px' : '0px',
        threshold: 0.01,
        triggerOnce: true,
        enabled: enabled && preloadAdjacent
    });

    // Load section when it becomes visible
    React.useEffect(() => {
        if (isIntersecting && !isLoaded) {
            setIsLoaded(true);
        }
    }, [isIntersecting, isLoaded]);

    // Preload adjacent sections
    React.useEffect(() => {
        if (isPreloadIntersecting && !isPreloading && preloadAdjacent) {
            setIsPreloading(true);
            // Trigger preload of adjacent sections
            // This could be enhanced to communicate with parent component
            // to preload specific adjacent sections
        }
    }, [isPreloadIntersecting, isPreloading, preloadAdjacent]);

    // If lazy loading is disabled, render immediately
    if (!enabled) {
        return <div className={className}>{children}</div>;
    }

    return (
        <div
            ref={(node) => {
                // Assign to main ref
                if (ref && 'current' in ref) {
                    ref.current = node;
                }
                // Assign to preload ref
                if (preloadRef && 'current' in preloadRef) {
                    preloadRef.current = node;
                }
            }}
            className={className}
            data-section-id={sectionId}
        >
            {isLoaded ? (
                <Suspense fallback={fallback || <DefaultSectionLoader sectionId={sectionId} />}>
                    {children}
                </Suspense>
            ) : (
                fallback || <DefaultSectionLoader sectionId={sectionId} />
            )}
        </div>
    );
};
