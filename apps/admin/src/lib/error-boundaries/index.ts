/**
 * Error Boundaries System - React Error Handling
 *
 * This module provides a comprehensive error boundary system for the admin application
 * with different levels of error handling and recovery options.
 *
 * @example
 * ```typescript
 * import { EntityErrorBoundary, QueryErrorBoundary, GlobalErrorBoundary } from '@/lib/error-boundaries';
 *
 * // Global error boundary (at app root)
 * <GlobalErrorBoundary>
 *   <App />
 * </GlobalErrorBoundary>
 *
 * // Entity-specific error boundary
 * <EntityErrorBoundary entityName="accommodation" entityId="123">
 *   <AccommodationDetail />
 * </EntityErrorBoundary>
 *
 * // Query-specific error boundary
 * <QueryErrorBoundary queryKey={['accommodation', '123']}>
 *   <AccommodationData />
 * </QueryErrorBoundary>
 * ```
 */

// Export error boundary components
export {
    EntityErrorBoundary,
    withEntityErrorBoundary
} from './EntityErrorBoundary';

export {
    QueryErrorBoundary,
    withQueryErrorBoundary
} from './QueryErrorBoundary';

export {
    GlobalErrorBoundary,
    useErrorBoundary
} from './GlobalErrorBoundary';

/**
 * Utility components for error boundaries
 */

/**
 * Error boundary configuration for different route types
 */
export const ErrorBoundaryConfig = {
    entityDetail: (entityName: string, entityId: string) => ({
        entityName,
        entityId,
        queryKey: [entityName, 'detail', entityId]
    }),
    entityList: (entityName: string) => ({
        entityName,
        queryKey: [entityName, 'list']
    }),
    dashboard: () => ({
        queryKey: ['dashboard']
    }),
    auth: () => ({
        queryKey: ['auth']
    })
} as const;
