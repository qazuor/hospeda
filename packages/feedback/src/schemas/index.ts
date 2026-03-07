/**
 * @repo/feedback/schemas - Barrel export for all Zod validation schemas.
 *
 * Re-exports all schemas, inferred types, and ID constants.
 * Import from this barrel instead of importing individual schema files.
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
export {
    APP_SOURCE_IDS,
    REPORT_TYPE_IDS,
    SEVERITY_IDS,
    feedbackEnvironmentSchema,
    feedbackErrorInfoSchema,
    feedbackFormSchema
} from './feedback.schema.js';
export type {
    AppSourceId,
    FeedbackEnvironment,
    FeedbackErrorInfo,
    FeedbackFormData,
    ReportTypeId,
    SeverityId
} from './feedback.schema.js';
