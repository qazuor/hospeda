/**
 * @file Error Boundaries Module Index
 *
 * This module provides comprehensive error boundary components for different
 * levels of the application with specialized error handling and recovery.
 */

// Export error boundary components
export { EntityErrorBoundary } from './EntityErrorBoundary';
export { RouteErrorBoundary } from './RouteErrorBoundary';

// Re-export the existing global error boundary if it exists
export { GlobalErrorBoundary } from '@/lib/error-boundaries/GlobalErrorBoundary';
export { QueryErrorBoundary } from '@/lib/error-boundaries/QueryErrorBoundary';
