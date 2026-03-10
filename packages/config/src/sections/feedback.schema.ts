import { z } from 'zod';

/**
 * Feedback system configuration schema.
 *
 * Controls the in-app feedback feature that creates Linear issues
 * when users submit feedback, with an email fallback when Linear
 * is unavailable.
 */
export const FeedbackSchema = z.object({
    /**
     * Linear API key used to create issues from user feedback.
     * Required in production. Optional in development.
     */
    HOSPEDA_LINEAR_API_KEY: z
        .string()
        .min(1, 'Linear API key must not be empty when provided')
        .optional(),

    /**
     * Fallback email address for feedback submissions when Linear
     * is unavailable or returns an error.
     * @default 'feedback@hospeda.com'
     */
    HOSPEDA_FEEDBACK_FALLBACK_EMAIL: z
        .string()
        .email('Must be a valid email address')
        .default('feedback@hospeda.com'),

    /**
     * Kill switch for the entire feedback feature.
     * Set to 'false' to disable the feedback widget across all surfaces.
     * @default 'true'
     */
    HOSPEDA_FEEDBACK_ENABLED: z
        .string()
        .default('true')
        .transform((val) => val.toLowerCase() !== 'false')
});

/**
 * Inferred TypeScript type from the feedback configuration schema.
 *
 * After parsing, `HOSPEDA_FEEDBACK_ENABLED` is a `boolean` (transformed
 * from the raw string environment variable).
 */
export type FeedbackConfig = z.infer<typeof FeedbackSchema>;

/**
 * Parses and validates feedback-related environment variables.
 *
 * @param env - Raw environment variables object (e.g. `process.env`)
 * @returns Validated and typed feedback configuration
 * @throws {z.ZodError} If any variable fails validation
 *
 * @example
 * ```ts
 * const config = parseFeedbackSchema(process.env);
 * if (config.HOSPEDA_FEEDBACK_ENABLED) {
 *   await submitToLinear(config.HOSPEDA_LINEAR_API_KEY, feedback);
 * }
 * ```
 */
export function parseFeedbackSchema(env: Record<string, string | undefined>): FeedbackConfig {
    return FeedbackSchema.parse({
        HOSPEDA_LINEAR_API_KEY: env.HOSPEDA_LINEAR_API_KEY,
        HOSPEDA_FEEDBACK_FALLBACK_EMAIL: env.HOSPEDA_FEEDBACK_FALLBACK_EMAIL,
        HOSPEDA_FEEDBACK_ENABLED: env.HOSPEDA_FEEDBACK_ENABLED
    });
}
