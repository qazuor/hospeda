/**
 * Feedback submission validation schemas and file validation utilities.
 *
 * Extracted from submit.ts to keep the route handler under 500 lines.
 * Contains Zod v4 schemas that mirror @repo/feedback client schemas,
 * field length limits, and magic byte validation for file attachments.
 */
import { z } from '@hono/zod-openapi';

// ─── Field limits (shared between Zod schema and sanitization) ───────────────

/** Maximum lengths for user-supplied text fields. */
export const FIELD_LIMITS = {
    title: 200,
    description: 5000,
    stepsToReproduce: 3000,
    expectedResult: 1000,
    actualResult: 1000,
    reporterName: 100,
    /** Max size of the JSON `data` field in bytes */
    dataFieldBytes: 32 * 1024
} as const;

// ─── Zod v4 schemas (API-local, mirrors @repo/feedback schemas) ──────────────

/** Valid report type identifiers (mirrors REPORT_TYPE_IDS from @repo/feedback) */
export const REPORT_TYPES_ENUM = z.enum([
    'bug-js',
    'bug-ui-ux',
    'bug-content',
    'feature-request',
    'improvement',
    'other'
]);

/** Valid severity level identifiers (mirrors SEVERITY_IDS from @repo/feedback) */
export const SEVERITY_ENUM = z.enum(['critical', 'high', 'medium', 'low']);

/** Valid app source identifiers (mirrors APP_SOURCE_IDS from @repo/feedback) */
const APP_SOURCE_ENUM = z.enum(['web', 'admin', 'standalone']);

/**
 * Server-side environment sub-schema.
 *
 * Mirrors feedbackEnvironmentSchema from @repo/feedback but uses Zod v4
 * to stay compatible with the API package's dependency.
 */
const environmentSchema = z.object({
    currentUrl: z.string().url().optional(),
    browser: z.string().optional(),
    os: z.string().optional(),
    viewport: z.string().optional(),
    timestamp: z.string().datetime(),
    appSource: APP_SOURCE_ENUM,
    deployVersion: z.string().optional(),
    userId: z.string().optional(),
    consoleErrors: z.array(z.string().max(500)).max(20).optional(),
    errorInfo: z
        .object({
            message: z.string().max(1000),
            stack: z.string().max(5000).optional()
        })
        .optional()
});

/**
 * Server-side feedback submission schema.
 *
 * Mirrors feedbackFormSchema from @repo/feedback but uses Zod v4 and
 * omits `attachments` (those are validated separately from FormData).
 */
export const feedbackSubmitSchema = z.object({
    type: REPORT_TYPES_ENUM,
    title: z.string().min(5).max(FIELD_LIMITS.title),
    description: z.string().min(10).max(FIELD_LIMITS.description),
    severity: SEVERITY_ENUM.optional(),
    stepsToReproduce: z.string().max(FIELD_LIMITS.stepsToReproduce).optional(),
    expectedResult: z.string().max(FIELD_LIMITS.expectedResult).optional(),
    actualResult: z.string().max(FIELD_LIMITS.actualResult).optional(),
    reporterEmail: z.string().email(),
    reporterName: z.string().min(2).max(FIELD_LIMITS.reporterName),
    environment: environmentSchema
});

/** Response schema for a successful feedback submission. */
export const FeedbackResponseSchema = z.object({
    linearIssueId: z.string().nullable(),
    linearIssueUrl: z.string().nullable().optional(),
    message: z.string()
});

// ─── Magic bytes file validation ─────────────────────────────────────────────

/**
 * Magic byte signatures for allowed image formats.
 * Each entry maps a MIME type to the expected leading bytes.
 */
const MAGIC_BYTES: Record<string, readonly number[]> = {
    'image/png': [0x89, 0x50, 0x4e, 0x47],
    'image/jpeg': [0xff, 0xd8, 0xff],
    'image/gif': [0x47, 0x49, 0x46, 0x38],
    'image/webp': [0x52, 0x49, 0x46, 0x46] // RIFF header (WebP starts with RIFF....WEBP)
};

/**
 * Validates that a buffer's leading bytes match the expected magic signature
 * for the declared MIME type. Prevents upload of disguised executables.
 *
 * @param params.buffer - File content buffer
 * @param params.declaredType - MIME type declared by the client
 * @returns true if the magic bytes match the declared type
 */
export function validateMagicBytes({
    buffer,
    declaredType
}: { buffer: Buffer; declaredType: string }): boolean {
    const expected = MAGIC_BYTES[declaredType];
    if (!expected) return false;

    if (buffer.length < expected.length) return false;

    for (let i = 0; i < expected.length; i++) {
        if (buffer[i] !== expected[i]) return false;
    }

    // WebP has an additional check: bytes 8-11 must be "WEBP"
    if (declaredType === 'image/webp') {
        if (buffer.length < 12) return false;
        const webpTag = String.fromCharCode(
            buffer[8] ?? 0,
            buffer[9] ?? 0,
            buffer[10] ?? 0,
            buffer[11] ?? 0
        );
        if (webpTag !== 'WEBP') return false;
    }

    return true;
}
