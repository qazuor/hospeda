/**
 * Re-exports all Zod validation schemas and types from the `@repo/feedback` package.
 *
 * This file makes feedback schemas available from `@repo/schemas` as the central
 * source of truth for type-safe validation across the monorepo.
 *
 * @example
 * ```ts
 * import {
 *   feedbackFormSchema,
 *   type FeedbackFormData,
 *   REPORT_TYPE_IDS,
 * } from '@repo/schemas';
 * ```
 */
export {
    APP_SOURCE_IDS,
    REPORT_TYPE_IDS,
    SEVERITY_IDS,
    feedbackEnvironmentSchema,
    feedbackErrorInfoSchema,
    feedbackFormSchema
} from '@repo/feedback/schemas';
export type {
    AppSourceId,
    FeedbackEnvironment,
    FeedbackErrorInfo,
    FeedbackFormData,
    ReportTypeId,
    SeverityId
} from '@repo/feedback/schemas';
