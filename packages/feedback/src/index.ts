/**
 * @repo/feedback - Beta feedback form with Linear integration
 *
 * Provides a floating feedback button (FAB), feedback form modal,
 * error boundary with report functionality, and Linear API integration.
 */

// Components
export { FeedbackFAB } from './components/FeedbackFAB.js';
export type { FeedbackFABProps } from './components/FeedbackFAB.js';
export { FeedbackForm } from './components/FeedbackForm.js';
export type { FeedbackFormProps } from './components/FeedbackForm.js';
export { FeedbackModal } from './components/FeedbackModal.js';
export type { FeedbackModalProps } from './components/FeedbackModal.js';
export { FeedbackErrorBoundary } from './components/FeedbackErrorBoundary.js';
export type { FeedbackErrorBoundaryProps } from './components/FeedbackErrorBoundary.js';
export { StepBasic } from './components/steps/StepBasic.js';
export type { StepBasicData, StepBasicProps } from './components/steps/StepBasic.js';
export { StepDetails } from './components/steps/StepDetails.js';
export type { StepDetailsData, StepDetailsProps } from './components/steps/StepDetails.js';

// Hooks
export { useAutoCollect } from './hooks/useAutoCollect.js';
export type { UseAutoCollectInput, UseAutoCollectResult } from './hooks/useAutoCollect.js';
export { useConsoleCapture } from './hooks/useConsoleCapture.js';
export { useKeyboardShortcut } from './hooks/useKeyboardShortcut.js';
export { useFeedbackSubmit } from './hooks/useFeedbackSubmit.js';
export type { FeedbackSubmitResult, FeedbackSubmitState } from './hooks/useFeedbackSubmit.js';

// Config
export {
    FEEDBACK_CONFIG,
    REPORT_TYPES,
    SEVERITY_LEVELS,
    LINEAR_CONFIG,
    ALLOWED_FILE_TYPES
} from './config/feedback.config.js';
export { FEEDBACK_STRINGS } from './config/strings.js';

// Schemas
export {
    feedbackFormSchema,
    feedbackEnvironmentSchema,
    feedbackErrorInfoSchema,
    REPORT_TYPE_IDS,
    SEVERITY_IDS,
    APP_SOURCE_IDS
} from './schemas/feedback.schema.js';
export type {
    FeedbackFormData,
    FeedbackEnvironment,
    FeedbackErrorInfo,
    ReportTypeId,
    SeverityId,
    AppSourceId
} from './schemas/feedback.schema.js';

// Utilities
export { collectEnvironmentData } from './lib/collector.js';
export type { CollectEnvironmentInput } from './lib/collector.js';
export { serializeFeedbackParams, parseFeedbackParams } from './lib/query-params.js';
export type { FeedbackQueryParams } from './lib/query-params.js';
