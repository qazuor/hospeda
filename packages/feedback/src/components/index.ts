/**
 * @repo/feedback - Components barrel export.
 *
 * Re-exports the top-level FeedbackForm orchestrator component, the
 * FeedbackModal responsive container, the FeedbackFAB floating action button,
 * the FeedbackErrorBoundary, and their associated prop types for consumption
 * by host applications.
 */

export type { FeedbackErrorBoundaryProps } from './FeedbackErrorBoundary.js';
export { FeedbackErrorBoundary } from './FeedbackErrorBoundary.js';
export type { FeedbackFABProps } from './FeedbackFAB.js';
export { FeedbackFAB } from './FeedbackFAB.js';
export type { FeedbackFormProps } from './FeedbackForm.js';
export { FeedbackForm } from './FeedbackForm.js';
export type { FeedbackModalProps } from './FeedbackModal.js';
export { FeedbackModal } from './FeedbackModal.js';
