/**
 * Feedback Zod validation schemas — relocated from @repo/feedback (SPEC-189).
 *
 * These are the canonical definitions for the feedback form payload.
 * The @repo/feedback package re-exports them from here via its
 * ./schemas and ./schemas/server barrels.
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
 * Valid device type identifiers derived from viewport / UA hints.
 */
export const DEVICE_TYPE_IDS = ['mobile', 'tablet', 'desktop'] as const;

/**
 * Valid color scheme identifiers (light or dark mode preference).
 */
export const COLOR_SCHEME_IDS = ['light', 'dark'] as const;

/**
 * Valid interaction event types we track.
 *
 * `click` covers button/link presses, `submit` covers form submissions.
 * Other event types are intentionally left out to bound the buffer noise.
 */
export const INTERACTION_EVENT_IDS = ['click', 'submit'] as const;

/**
 * Schema for a single recorded user interaction.
 *
 * Captures structural info plus a few non-sensitive enrichments (visible
 * label, target href, short DOM path) so reviewers can actually figure out
 * what the user did. Inputs in private fields and elements marked with
 * `data-feedback-skip` / `data-private` are filtered out at capture time.
 */
export const feedbackInteractionSchema = z.object({
    /** Element tag (e.g. "BUTTON", "A", "INPUT") */
    type: z.string(),
    /** Short selector hint: id, first className, or tag-only fallback */
    selector: z.string(),
    /** ISO datetime string */
    timestamp: z.string(),
    /** Event kind that produced this interaction */
    event: z.enum(INTERACTION_EVENT_IDS).optional(),
    /** Visible text of the element (truncated to 60 chars) */
    text: z.string().max(60).optional(),
    /** `aria-label` value when present (truncated to 60 chars) */
    ariaLabel: z.string().max(60).optional(),
    /** href for `<a>` targets (same-origin links only, max 200 chars) */
    href: z.string().max(200).optional(),
    /** Short DOM ancestry path, e.g. `nav>div>button` (max 120 chars) */
    domPath: z.string().max(120).optional()
});

/**
 * Schema for the auto-collected environment data.
 *
 * All fields except `timestamp`, `appSource`, and `userId` are editable by
 * the user before submission (per US-07).
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
    consoleErrors: z.array(z.string().max(500)).max(20).optional(),
    /** Error message and stack trace when submitted from an error boundary */
    errorInfo: feedbackErrorInfoSchema.optional(),
    /** BCP 47 language tag, e.g. "es-AR", "en-US" (from navigator.language) */
    locale: z.string().optional(),
    /** IANA timezone, e.g. "America/Argentina/Buenos_Aires" */
    timezone: z.string().optional(),
    /** Device class derived from viewport width and UA hints */
    deviceType: z.enum(DEVICE_TYPE_IDS).optional(),
    /** Network Information API effective type, e.g. "4g", "3g", "slow-2g" */
    connectionType: z.string().optional(),
    /** User's resolved color scheme preference */
    colorScheme: z.enum(COLOR_SCHEME_IDS).optional(),
    /**
     * App-level feature flags read from localStorage (configurable prefix).
     * Values are truncated to 200 characters per entry.
     */
    featureFlags: z.record(z.string(), z.string()).optional(),
    /** Last N visited URLs (path + search), most-recent last */
    navigationHistory: z.array(z.string()).optional(),
    /** Last N user clicks (privacy-preserving structural info only) */
    lastInteractions: z.array(feedbackInteractionSchema).optional(),
    /** Most recent Sentry event ID at the time the form was opened */
    sentryEventId: z.string().optional()
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
    environment: feedbackEnvironmentSchema,

    /** Cloudflare Turnstile invisible-widget verification token (populated client-side, verified server-side). Optional so submissions without Turnstile configured still parse. */
    cfTurnstileToken: z.string().optional()
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
 * TypeScript type for a single recorded user interaction.
 */
export type FeedbackInteraction = z.infer<typeof feedbackInteractionSchema>;

/**
 * Union type of valid device type IDs.
 */
export type DeviceTypeId = (typeof DEVICE_TYPE_IDS)[number];

/**
 * Union type of valid color scheme IDs.
 */
export type ColorSchemeId = (typeof COLOR_SCHEME_IDS)[number];

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
