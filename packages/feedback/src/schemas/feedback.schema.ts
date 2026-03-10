/**
 * @repo/feedback - Zod validation schemas for the feedback form payload.
 *
 * Defines the complete data model for feedback reports including step 1
 * required fields, step 2 optional detail fields, user info, and the
 * auto-collected environment object.
 *
 * These schemas serve as the single source of truth for both client-side
 * form validation and server-side API input validation.
 */
import { z } from 'zod';

/**
 * Valid report type identifiers.
 *
 * Must match the `id` values in `REPORT_TYPES` config array.
 */
export const REPORT_TYPE_IDS = [
    'bug-js',
    'bug-ui-ux',
    'bug-content',
    'feature-request',
    'improvement',
    'other'
] as const;

/**
 * Valid severity level identifiers.
 *
 * Must match the `id` values in `SEVERITY_LEVELS` config array.
 */
export const SEVERITY_IDS = ['critical', 'high', 'medium', 'low'] as const;

/**
 * Valid app source identifiers.
 *
 * Identifies which app the feedback was submitted from.
 */
export const APP_SOURCE_IDS = ['web', 'admin', 'standalone'] as const;

/**
 * Schema for the error boundary error info sub-object.
 */
export const feedbackErrorInfoSchema = z.object({
    message: z.string(),
    stack: z.string().optional()
});

/**
 * Schema for the auto-collected environment data.
 *
 * All fields except `timestamp` and `appSource` are editable by the user
 * before submission (per US-07).
 */
export const feedbackEnvironmentSchema = z.object({
    /** URL where the FAB was clicked or the error occurred */
    currentUrl: z.string().url().optional(),
    /** Browser name and version, e.g. "Chrome 120" */
    browser: z.string().optional(),
    /** Operating system, e.g. "Windows 11" */
    os: z.string().optional(),
    /** Viewport dimensions, e.g. "1920x1080" */
    viewport: z.string().optional(),
    /** ISO datetime string of when the form was opened */
    timestamp: z.string().datetime(),
    /** Which app the report came from */
    appSource: z.enum(APP_SOURCE_IDS),
    /** Git commit hash or release tag (build-time env var) */
    deployVersion: z.string().optional(),
    /** Internal user ID if the user is authenticated */
    userId: z.string().optional(),
    /** Last N console.error() calls captured before the report */
    consoleErrors: z.array(z.string()).optional(),
    /** Error message and stack trace when submitted from an error boundary */
    errorInfo: feedbackErrorInfoSchema.optional()
});

/**
 * Client-side form schema (step 1 + step 2 + user info + environment).
 *
 * Attachments are typed as `File` instances for browser-side validation.
 * For server-side validation, use `feedbackApiSchema` which accepts `Buffer`.
 *
 * @example
 * ```ts
 * const result = feedbackFormSchema.safeParse(formData);
 * if (!result.success) {
 *   console.error(result.error.issues);
 * }
 * ```
 */
export const feedbackFormSchema = z.object({
    // Step 1 (required)
    /** Report category that maps to a Linear label */
    type: z.enum(REPORT_TYPE_IDS),
    /** Brief summary of the issue (5-200 characters) */
    title: z.string().min(5).max(200),
    /** Detailed description of what happened (10-5000 characters) */
    description: z.string().min(10).max(5000),

    // Step 2 (optional)
    /** Issue severity that maps to a Linear priority */
    severity: z.enum(SEVERITY_IDS).optional(),
    /** Numbered steps to reproduce the issue (max 3000 characters) */
    stepsToReproduce: z.string().max(3000).optional(),
    /** What the user expected to happen (max 1000 characters) */
    expectedResult: z.string().max(1000).optional(),
    /** What actually happened (max 1000 characters) */
    actualResult: z.string().max(1000).optional(),
    /** Screenshots uploaded directly to Linear (max 5 files) */
    attachments: z.array(z.instanceof(File)).max(5).optional(),

    // User info (required; pre-filled from auth session when available)
    /** Reporter's email address for follow-up */
    reporterEmail: z.string().email(),
    /** Reporter's display name (2-100 characters) */
    reporterName: z.string().min(2).max(100),

    // Auto-collected environment data
    environment: feedbackEnvironmentSchema
});

/**
 * TypeScript type inferred from `feedbackFormSchema`.
 *
 * Use this type throughout the feedback package and consuming apps
 * to avoid manual type duplication.
 */
export type FeedbackFormData = z.infer<typeof feedbackFormSchema>;

/**
 * TypeScript type for the environment sub-object.
 */
export type FeedbackEnvironment = z.infer<typeof feedbackEnvironmentSchema>;

/**
 * TypeScript type for the error boundary error info sub-object.
 */
export type FeedbackErrorInfo = z.infer<typeof feedbackErrorInfoSchema>;

/**
 * Union type of all valid report type ID strings.
 */
export type ReportTypeId = (typeof REPORT_TYPE_IDS)[number];

/**
 * Union type of all valid severity ID strings.
 */
export type SeverityId = (typeof SEVERITY_IDS)[number];

/**
 * Union type of all valid app source ID strings.
 */
export type AppSourceId = (typeof APP_SOURCE_IDS)[number];
