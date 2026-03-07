/**
 * POST /api/v1/public/feedback
 *
 * Accepts multipart form data with a JSON `data` field and optional
 * `attachments` files. Validates the submission against the feedback
 * schema, checks file constraints, silently discards bot submissions
 * via honeypot, and then:
 *
 * 1. Attempts to create a Linear issue (up to 3 retries, exponential backoff).
 * 2. On Linear failure, sends a fallback email via @repo/notifications.
 * 3. Returns a structured success response in both cases.
 */
import { z } from '@hono/zod-openapi';
import { ALLOWED_FILE_TYPES, FEEDBACK_CONFIG } from '@repo/feedback/config';
import { REPORT_TYPES } from '@repo/feedback/config';
import type { NotificationPayload } from '@repo/notifications';
import { NotificationType } from '@repo/notifications';
import type { Context } from 'hono';
import { sanitizeString } from '../../middlewares/sanitization';
import {
    type CreateFeedbackIssueInput,
    type FeedbackAttachment,
    LinearFeedbackService
} from '../../services/feedback/linear.service';
import { withRetry } from '../../services/feedback/retry';
import { env } from '../../utils/env';
import { apiLogger } from '../../utils/logger';
import { sendNotification } from '../../utils/notification-helper';
import { createSimpleRoute } from '../../utils/route-factory';

// ─── Zod v4 schemas (API-local, mirrors @repo/feedback schemas) ──────────────

/** Valid report type identifiers (mirrors REPORT_TYPE_IDS from @repo/feedback) */
const REPORT_TYPES_ENUM = z.enum([
    'bug-js',
    'bug-ui-ux',
    'bug-content',
    'feature-request',
    'improvement',
    'other'
]);

/** Valid severity level identifiers (mirrors SEVERITY_IDS from @repo/feedback) */
const SEVERITY_ENUM = z.enum(['critical', 'high', 'medium', 'low']);

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
    consoleErrors: z.array(z.string()).optional(),
    errorInfo: z
        .object({
            message: z.string(),
            stack: z.string().optional()
        })
        .optional()
});

/**
 * Server-side feedback submission schema.
 *
 * Mirrors feedbackFormSchema from @repo/feedback but uses Zod v4 and
 * omits `attachments` (those are validated separately from FormData).
 */
const feedbackSubmitSchema = z.object({
    type: REPORT_TYPES_ENUM,
    title: z.string().min(5).max(200),
    description: z.string().min(10).max(5000),
    severity: SEVERITY_ENUM.optional(),
    stepsToReproduce: z.string().max(3000).optional(),
    expectedResult: z.string().max(1000).optional(),
    actualResult: z.string().max(1000).optional(),
    reporterEmail: z.string().email(),
    reporterName: z.string().min(2).max(100),
    environment: environmentSchema
});

/**
 * Response schema for a successful feedback submission.
 */
const FeedbackResponseSchema = z.object({
    linearIssueId: z.string().nullable(),
    linearIssueUrl: z.string().nullable().optional(),
    message: z.string()
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Resolve the human-readable label for a report type ID.
 *
 * Falls back to the raw ID if no matching entry is found.
 *
 * @param reportTypeId - Report type identifier (e.g. "bug-js")
 * @returns Display label (e.g. "Error de JavaScript")
 */
function resolveReportTypeLabel(reportTypeId: string): string {
    const entry = REPORT_TYPES.find((r) => r.id === reportTypeId);
    return entry?.label ?? reportTypeId;
}

/**
 * Resolve the human-readable severity label for an optional severity ID.
 *
 * @param severityId - Severity identifier (e.g. "critical") or undefined
 * @returns Display label or undefined when not provided
 */
function resolveSeverityLabel(severityId?: string): string | undefined {
    if (!severityId) return undefined;
    const SEVERITY_LABELS: Record<string, string> = {
        critical: 'Critico',
        high: 'Alto',
        medium: 'Medio',
        low: 'Bajo'
    };
    return SEVERITY_LABELS[severityId] ?? severityId;
}

/**
 * Build and return a lazy-initialized LinearFeedbackService.
 *
 * Returns null when the Linear API key is not configured in the environment.
 */
function buildLinearService(): LinearFeedbackService | null {
    const apiKey = env.HOSPEDA_LINEAR_API_KEY;
    if (!apiKey) {
        apiLogger.warn('HOSPEDA_LINEAR_API_KEY not set - Linear issue creation is disabled');
        return null;
    }

    return new LinearFeedbackService({
        apiKey,
        feedbackConfig: FEEDBACK_CONFIG
    });
}

// ─── Route ───────────────────────────────────────────────────────────────────

/**
 * POST /feedback - Submit a beta feedback report.
 *
 * Accepts multipart/form-data with:
 * - `data`        (required) JSON string of FeedbackFormData fields
 * - `attachments` (optional) up to 5 image files (PNG/JPEG/WebP/GIF, max 10MB each)
 * - `website`     (optional) honeypot field - if non-empty the request is a bot
 *
 * Integration flow:
 * 1. Validate form data and attachments.
 * 2. Attempt to create a Linear issue with up to 3 retries (1s / 2s / 4s backoff).
 * 3. If all retries fail, send a fallback email notification.
 * 4. Return success to the caller regardless of the integration outcome.
 */
export const submitFeedbackRoute = createSimpleRoute({
    method: 'post',
    path: '/feedback',
    summary: 'Submit beta feedback',
    description:
        'Accepts multipart form data with a JSON data field and optional image attachments. ' +
        'Rate limited to 30 submissions per IP per hour.',
    tags: ['Feedback'],
    responseSchema: FeedbackResponseSchema,
    handler: async (ctx: Context) => {
        // ── 1. Parse multipart form data ─────────────────────────────────────
        let formData: FormData;
        try {
            formData = await ctx.req.formData();
        } catch {
            return ctx.json(
                {
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: 'Invalid multipart form data' }
                },
                400
            );
        }

        // ── 2. Honeypot check (bots fill hidden `website` field) ─────────────
        const honeypot = formData.get('website');
        if (honeypot) {
            apiLogger.debug('Feedback honeypot triggered - silent discard');
            return { linearIssueId: null, message: 'Reporte recibido' };
        }

        // ── 3. Extract and parse JSON data field ─────────────────────────────
        const dataStr = formData.get('data');
        if (!dataStr || typeof dataStr !== 'string') {
            return ctx.json(
                {
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: 'Campo "data" requerido' }
                },
                400
            );
        }

        let rawData: unknown;
        try {
            rawData = JSON.parse(dataStr);
        } catch {
            return ctx.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Campo "data" no es JSON valido'
                    }
                },
                400
            );
        }

        // ── 4. Validate with Zod ─────────────────────────────────────────────
        const parseResult = feedbackSubmitSchema.safeParse(rawData);
        if (!parseResult.success) {
            return ctx.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Datos invalidos',
                        details: parseResult.error.issues.map((issue) => ({
                            field: issue.path.join('.'),
                            message: issue.message
                        }))
                    }
                },
                400
            );
        }

        const parsed = parseResult.data;

        // ── 4b. Sanitize user-supplied text fields against XSS ───────────
        const validated = {
            ...parsed,
            title: sanitizeString(parsed.title, undefined, 200),
            description: sanitizeString(parsed.description, undefined, 5000),
            reporterName: sanitizeString(parsed.reporterName, undefined, 100),
            stepsToReproduce: parsed.stepsToReproduce
                ? sanitizeString(parsed.stepsToReproduce, undefined, 5000)
                : undefined,
            expectedResult: parsed.expectedResult
                ? sanitizeString(parsed.expectedResult, undefined, 2000)
                : undefined,
            actualResult: parsed.actualResult
                ? sanitizeString(parsed.actualResult, undefined, 2000)
                : undefined
        };

        // ── 5. Validate attachments ──────────────────────────────────────────
        const rawFiles = formData.getAll('attachments');
        const attachments: File[] = [];

        for (const entry of rawFiles) {
            if (!(entry instanceof File)) {
                continue;
            }

            if (!ALLOWED_FILE_TYPES.includes(entry.type as (typeof ALLOWED_FILE_TYPES)[number])) {
                return ctx.json(
                    {
                        success: false,
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: `Tipo de archivo no permitido: ${entry.type}`
                        }
                    },
                    400
                );
            }

            if (entry.size > FEEDBACK_CONFIG.maxFileSize) {
                return ctx.json(
                    {
                        success: false,
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: `Archivo demasiado grande: ${entry.name}`
                        }
                    },
                    400
                );
            }

            attachments.push(entry);
        }

        if (attachments.length > FEEDBACK_CONFIG.maxAttachments) {
            return ctx.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: `Maximo ${FEEDBACK_CONFIG.maxAttachments} archivos permitidos`
                    }
                },
                400
            );
        }

        // ── 6. Log submission for audit trail ────────────────────────────────
        apiLogger.info(
            {
                feedbackType: validated.type,
                severity: validated.severity,
                appSource: validated.environment.appSource,
                attachmentCount: attachments.length,
                titleLength: validated.title.length
            },
            'Feedback submission received'
        );

        // ── 7. Convert File objects to FeedbackAttachment buffers ────────────
        const feedbackAttachments: FeedbackAttachment[] = await Promise.all(
            attachments.map(async (file) => {
                const arrayBuffer = await file.arrayBuffer();
                return {
                    buffer: Buffer.from(arrayBuffer),
                    filename: file.name,
                    contentType: file.type,
                    size: file.size
                };
            })
        );

        // ── 8. Attempt Linear issue creation with exponential backoff ─────────
        const reportTypeLabel = resolveReportTypeLabel(validated.type);
        const linearService = buildLinearService();

        if (linearService) {
            const issueInput: CreateFeedbackIssueInput = {
                reportType: reportTypeLabel,
                reportTypeId: validated.type,
                title: validated.title,
                description: validated.description,
                reporterName: validated.reporterName,
                reporterEmail: validated.reporterEmail,
                severityId: validated.severity,
                stepsToReproduce: validated.stepsToReproduce,
                expectedResult: validated.expectedResult,
                actualResult: validated.actualResult,
                appSource: validated.environment.appSource,
                environment: {
                    currentUrl: validated.environment.currentUrl,
                    browser: validated.environment.browser,
                    os: validated.environment.os,
                    viewport: validated.environment.viewport,
                    timestamp: validated.environment.timestamp,
                    deployVersion: validated.environment.deployVersion,
                    userId: validated.environment.userId,
                    consoleErrors: validated.environment.consoleErrors,
                    errorInfo: validated.environment.errorInfo
                },
                attachments: feedbackAttachments.length > 0 ? feedbackAttachments : undefined
            };

            try {
                const issueResult = await withRetry({
                    fn: () => linearService.createIssue(issueInput),
                    maxRetries: 3,
                    logger: apiLogger
                });

                apiLogger.info(
                    { issueId: issueResult.issueId, issueUrl: issueResult.issueUrl },
                    'Feedback Linear issue created successfully'
                );

                return {
                    linearIssueId: issueResult.issueId,
                    linearIssueUrl: issueResult.issueUrl,
                    message: `Reporte recibido. Issue creado: ${issueResult.issueIdentifier}`
                };
            } catch (linearError) {
                const linearErrorMsg =
                    linearError instanceof Error ? linearError.message : String(linearError);

                apiLogger.error(
                    { error: linearErrorMsg, feedbackType: validated.type },
                    'All Linear retries exhausted - falling back to email notification'
                );
            }
        }

        // ── 9. Email fallback when Linear is unavailable or all retries failed ─
        const fallbackPayload: NotificationPayload = {
            type: NotificationType.FEEDBACK_REPORT,
            recipientEmail: validated.reporterEmail,
            recipientName: validated.reporterName,
            userId: validated.environment.userId ?? null,
            reportType: reportTypeLabel,
            reportTitle: validated.title,
            reportDescription: validated.description,
            severity: resolveSeverityLabel(validated.severity),
            stepsToReproduce: validated.stepsToReproduce,
            expectedResult: validated.expectedResult,
            actualResult: validated.actualResult,
            feedbackEnvironment: {
                currentUrl: validated.environment.currentUrl,
                browser: validated.environment.browser,
                os: validated.environment.os,
                viewport: validated.environment.viewport,
                timestamp: validated.environment.timestamp,
                appSource: validated.environment.appSource,
                deployVersion: validated.environment.deployVersion,
                userId: validated.environment.userId,
                consoleErrors: validated.environment.consoleErrors,
                errorInfo: validated.environment.errorInfo
            }
        };

        try {
            await sendNotification(fallbackPayload, { skipDb: true, skipLogging: true });
        } catch (emailError: unknown) {
            apiLogger.error(
                { error: emailError instanceof Error ? emailError.message : String(emailError) },
                'Feedback email fallback also failed'
            );
        }

        return {
            linearIssueId: null,
            linearIssueUrl: null,
            message: 'Tu reporte fue enviado por email. Lo revisaremos a la brevedad.'
        };
    },
    options: {
        skipAuth: true,
        customRateLimit: {
            requests: FEEDBACK_CONFIG.rateLimit,
            windowMs: 3_600_000
        }
    }
});
