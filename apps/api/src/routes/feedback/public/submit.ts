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
import { ALLOWED_FILE_TYPES, FEEDBACK_CONFIG } from '@repo/feedback/config';
import { REPORT_TYPES } from '@repo/feedback/config';
import type { NotificationPayload } from '@repo/notifications';
import { NotificationType } from '@repo/notifications';
import type { Context } from 'hono';
import { sanitizeEmail, sanitizeFileName, sanitizeString } from '../../../middlewares/sanitization';
import {
    type CreateFeedbackIssueInput,
    type FeedbackAttachment,
    LinearFeedbackService
} from '../../../services/feedback/linear.service';
import { withRetry } from '../../../services/feedback/retry';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';
import { sendNotification } from '../../../utils/notification-helper';
import { createSimpleRoute } from '../../../utils/route-factory';
import {
    FIELD_LIMITS,
    FeedbackResponseSchema,
    feedbackSubmitSchema,
    validateMagicBytes
} from './validation';

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
 * Uses FEEDBACK_CONFIG.severityLevels as the single source of truth.
 *
 * @param severityId - Severity identifier (e.g. "critical") or undefined
 * @returns Display label or undefined when not provided
 */
function resolveSeverityLabel(severityId?: string): string | undefined {
    if (!severityId) return undefined;
    const entry = FEEDBACK_CONFIG.severityLevels.find((s) => s.id === severityId);
    return entry?.label ?? severityId;
}

/**
 * Lazy singleton for LinearFeedbackService.
 *
 * Avoids re-creating the service (and its underlying LinearClient) on every
 * request. Returns null when the Linear API key is not configured.
 */
let linearServiceInstance: LinearFeedbackService | null = null;
let linearServiceChecked = false;

function getLinearService(): LinearFeedbackService | null {
    if (linearServiceChecked) return linearServiceInstance;
    linearServiceChecked = true;

    const apiKey = env.HOSPEDA_LINEAR_API_KEY;
    if (!apiKey) {
        apiLogger.warn('HOSPEDA_LINEAR_API_KEY not set - Linear issue creation is disabled');
        return null;
    }

    linearServiceInstance = new LinearFeedbackService({
        apiKey,
        feedbackConfig: FEEDBACK_CONFIG
    });
    return linearServiceInstance;
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
    path: '/',
    summary: 'Submit beta feedback',
    description:
        'Accepts multipart form data with a JSON data field and optional image attachments. ' +
        'Rate limited to 30 submissions per IP per hour.',
    tags: ['Feedback'],
    responseSchema: FeedbackResponseSchema,
    handler: async (ctx: Context) => {
        // ── 0. Kill switch: reject early when feedback is disabled ────────────
        if (env.HOSPEDA_FEEDBACK_ENABLED === false) {
            return ctx.json(
                {
                    success: false,
                    error: { code: 'SERVICE_UNAVAILABLE', message: 'Feedback disabled' }
                },
                503
            );
        }

        // ── 1. Body size limit before parsing (GAP-031-49: anti-DoS) ─────────
        const contentLength = Number(ctx.req.header('content-length') ?? 0);
        const maxBodySize =
            FEEDBACK_CONFIG.maxAttachments * FEEDBACK_CONFIG.maxFileSize + 64 * 1024;
        if (contentLength > maxBodySize) {
            return ctx.json(
                {
                    success: false,
                    error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request too large' }
                },
                413
            );
        }

        // ── 2. Parse multipart form data ─────────────────────────────────────
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

        // ── 3. Honeypot check (bots fill hidden `website` field) ─────────────
        const honeypot = formData.get('website');
        if (honeypot) {
            apiLogger.debug('Feedback honeypot triggered - silent discard');
            return { linearIssueId: null, message: 'Reporte recibido' };
        }

        // ── 4. Extract and parse JSON data field ─────────────────────────────
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

        // ── Size limit on JSON data field before parsing (GAP-031-52) ────────
        if (dataStr.length > FIELD_LIMITS.dataFieldBytes) {
            return ctx.json(
                {
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: 'Campo "data" demasiado grande' }
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

        // ── 5. Validate with Zod ─────────────────────────────────────────────
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

        // ── 5b. Sanitize ALL user-supplied fields against XSS ────────────
        const validated = {
            ...parsed,
            title: sanitizeString(parsed.title, undefined, FIELD_LIMITS.title),
            description: sanitizeString(parsed.description, undefined, FIELD_LIMITS.description),
            reporterName: sanitizeString(parsed.reporterName, undefined, FIELD_LIMITS.reporterName),
            reporterEmail: sanitizeEmail(parsed.reporterEmail),
            stepsToReproduce: parsed.stepsToReproduce
                ? sanitizeString(
                      parsed.stepsToReproduce,
                      undefined,
                      FIELD_LIMITS.stepsToReproduce,
                      true
                  )
                : undefined,
            expectedResult: parsed.expectedResult
                ? sanitizeString(
                      parsed.expectedResult,
                      undefined,
                      FIELD_LIMITS.expectedResult,
                      true
                  )
                : undefined,
            actualResult: parsed.actualResult
                ? sanitizeString(parsed.actualResult, undefined, FIELD_LIMITS.actualResult, true)
                : undefined,
            environment: {
                ...parsed.environment,
                browser: parsed.environment.browser
                    ? sanitizeString(parsed.environment.browser, undefined, 200)
                    : undefined,
                os: parsed.environment.os
                    ? sanitizeString(parsed.environment.os, undefined, 200)
                    : undefined,
                viewport: parsed.environment.viewport
                    ? sanitizeString(parsed.environment.viewport, undefined, 100)
                    : undefined,
                deployVersion: parsed.environment.deployVersion
                    ? sanitizeString(parsed.environment.deployVersion, undefined, 100)
                    : undefined,
                consoleErrors: parsed.environment.consoleErrors?.map((e) =>
                    sanitizeString(e, undefined, 500)
                ),
                errorInfo: parsed.environment.errorInfo
                    ? {
                          message: sanitizeString(
                              parsed.environment.errorInfo.message,
                              undefined,
                              1000
                          ),
                          stack: parsed.environment.errorInfo.stack
                              ? sanitizeString(parsed.environment.errorInfo.stack, undefined, 2000)
                              : undefined
                      }
                    : undefined
            }
        };

        // ── 6. Validate attachments ──────────────────────────────────────────
        const rawFiles = formData.getAll('attachments');

        // Validate count BEFORE processing any files (GAP-031-26: anti-DoS)
        if (rawFiles.length > FEEDBACK_CONFIG.maxAttachments) {
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
                            message: 'Tipo de archivo no permitido'
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
                            message: 'Archivo demasiado grande'
                        }
                    },
                    400
                );
            }

            attachments.push(entry);
        }

        // ── 7. Log submission for audit trail ────────────────────────────────
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

        // ── 8. Convert File objects to FeedbackAttachment buffers ────────────
        // Process sequentially to avoid holding all buffers in memory at once
        // (GAP-031-50: 5x10MB = 50MB simultaneous with Promise.all)
        const feedbackAttachments: FeedbackAttachment[] = [];
        for (const file of attachments) {
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Validate magic bytes match declared MIME type (GAP-031-21)
            if (!validateMagicBytes({ buffer, declaredType: file.type })) {
                apiLogger.warn(
                    { filename: file.name, declaredType: file.type },
                    'Attachment magic bytes do not match declared MIME type'
                );
                return ctx.json(
                    {
                        success: false,
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'El archivo no es una imagen valida'
                        }
                    },
                    400
                );
            }

            feedbackAttachments.push({
                buffer,
                filename: sanitizeFileName(file.name),
                contentType: file.type,
                size: file.size
            });
        }

        // ── 9. Attempt Linear issue creation with exponential backoff ─────────
        const reportTypeLabel = resolveReportTypeLabel(validated.type);
        const linearService = getLinearService();

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
                    logger: apiLogger,
                    isRetriable: (err) => {
                        // Don't retry client errors (4xx) - only network/server errors
                        const msg = err.message;
                        return !(
                            msg.includes('400') ||
                            msg.includes('401') ||
                            msg.includes('403') ||
                            msg.includes('404') ||
                            msg.includes('422')
                        );
                    }
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

        // ── 10. Email fallback when Linear is unavailable or all retries failed ─
        const fallbackPayload: NotificationPayload = {
            type: NotificationType.FEEDBACK_REPORT,
            recipientEmail: env.HOSPEDA_FEEDBACK_FALLBACK_EMAIL ?? FEEDBACK_CONFIG.fallbackEmail,
            recipientName: 'Hospeda Feedback Team',
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
            await sendNotification(fallbackPayload, {
                skipDb: true,
                skipLogging: true,
                emailAttachments:
                    feedbackAttachments.length > 0
                        ? feedbackAttachments.map((att) => ({
                              filename: att.filename,
                              content: att.buffer,
                              contentType: att.contentType
                          }))
                        : undefined
            });
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
