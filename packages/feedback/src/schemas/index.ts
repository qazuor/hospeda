/**
 * @repo/feedback/schemas - Barrel export for all Zod validation schemas.
 *
 * Re-exports all schemas, inferred types, and ID constants from @repo/schemas
 * (the canonical definitions since SPEC-189).
 *
 * @example
 * ```ts
 * import {
 *   feedbackFormSchema,
 *   type FeedbackFormData,
 *   REPORT_TYPE_IDS,
 * } from '@repo/feedback/schemas';
 * ```
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
