/**
 * @repo/feedback - Beta feedback form with Linear integration
 *
 * Provides a floating feedback button (FAB), feedback form modal,
 * error boundary with report functionality, and Linear API integration.
 */

export type {
    AppSourceId,
    ColorSchemeId,
    DeviceTypeId,
    FeedbackEnvironment,
    FeedbackErrorInfo,
    FeedbackFormData,
    FeedbackInteraction,
    ReportTypeId,
    SeverityId
} from '@repo/schemas';
// Schemas
export {
    APP_SOURCE_IDS,
    COLOR_SCHEME_IDS,
    DEVICE_TYPE_IDS,
    feedbackEnvironmentSchema,
    feedbackErrorInfoSchema,
    feedbackFormSchema,
    feedbackInteractionSchema,
    REPORT_TYPE_IDS,
    SEVERITY_IDS
} from '@repo/schemas';
export type { FeedbackErrorBoundaryProps } from './components/FeedbackErrorBoundary.js';
export { FeedbackErrorBoundary } from './components/FeedbackErrorBoundary.js';
export type {
    FeedbackFABProps,
    SentryFeedbackBridgePayload
} from './components/FeedbackFAB.js';
// Components
export { FeedbackFAB } from './components/FeedbackFAB.js';
export type { FeedbackFormProps } from './components/FeedbackForm.js';
export { FeedbackForm } from './components/FeedbackForm.js';
export type { FeedbackModalProps } from './components/FeedbackModal.js';
export { FeedbackModal } from './components/FeedbackModal.js';
export type { StepBasicData, StepBasicProps } from './components/steps/StepBasic.js';
export { StepBasic } from './components/steps/StepBasic.js';
export type { StepDetailsData, StepDetailsProps } from './components/steps/StepDetails.js';
export { StepDetails } from './components/steps/StepDetails.js';
// Config
export {
    ALLOWED_FILE_TYPES,
    FEEDBACK_CONFIG,
    LINEAR_CONFIG,
    REPORT_TYPES,
    SEVERITY_LEVELS
} from './config/feedback.config.js';
export { FEEDBACK_STRINGS } from './config/strings.js';
export type { UseAutoCollectInput, UseAutoCollectResult } from './hooks/useAutoCollect.js';
// Hooks
export { useAutoCollect } from './hooks/useAutoCollect.js';
export { useConsoleCapture } from './hooks/useConsoleCapture.js';
export type { FeedbackSubmitResult, FeedbackSubmitState } from './hooks/useFeedbackSubmit.js';
export { useFeedbackSubmit } from './hooks/useFeedbackSubmit.js';
export { useKeyboardShortcut } from './hooks/useKeyboardShortcut.js';
export type { CollectEnvironmentInput } from './lib/collector.js';
// Utilities
export { collectEnvironmentData, DEFAULT_FEATURE_FLAG_PREFIXES } from './lib/collector.js';
export type { FeedbackQueryParams } from './lib/query-params.js';
export { parseFeedbackParams, serializeFeedbackParams } from './lib/query-params.js';
export {
    getLastInteractions,
    getNavigationHistory,
    installRuntimeTrackers,
    resetRuntimeTrackers,
    uninstallRuntimeTrackers
} from './lib/runtime-trackers.js';
