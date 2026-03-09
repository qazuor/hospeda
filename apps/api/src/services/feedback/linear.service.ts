import { LinearClient } from '@linear/sdk';
import type {
    FEEDBACK_CONFIG as FeedbackConfigType,
    REPORT_TYPES as ReportTypesType,
    SEVERITY_LEVELS as SeverityLevelsType
} from '@repo/feedback/config';
import { createLogger } from '@repo/logger';

const logger = createLogger('linear-feedback-service');

// ---------------------------------------------------------------------------
// Markdown / content safety helpers
// ---------------------------------------------------------------------------

/** Allowed presigned URL hosts for SSRF prevention (GAP-031-48) */
const ALLOWED_UPLOAD_HOST_PATTERN = /^https:\/\/[a-z0-9-]+\.s3[a-z0-9.-]*\.amazonaws\.com\//i;

/** Patterns that indicate sensitive data in console errors (GAP-031-24) */
const SENSITIVE_PATTERNS = /sk_live_|pk_live_|Bearer |api_key=|apikey=|secret=|password=|token=/gi;

/** Redact server paths like /home/user/... or /app/... (GAP-031-24) */
const SERVER_PATH_PATTERN = /\/(home|app|usr|var|tmp)\/[^\s)]+/g;

/**
 * Escape Markdown special characters in user-supplied text to prevent
 * injection of links, images, and formatting in Linear issues.
 *
 * @param text - Raw user text
 * @returns Text with Markdown metacharacters escaped
 */
function escapeMarkdown(text: string): string {
    return text
        .replace(/([\\`*_{}[\]()#+\-.!|])/g, '\\$1')
        .replace(/!\[/g, '\\!\\[')
        .replace(/\[([^\]]+)\]\(/g, '\\[$1\\](');
}

/**
 * Sanitize a console error string: redact API keys, server paths,
 * and truncate to a safe length.
 *
 * @param entry - Raw console error text
 * @param maxLength - Maximum length after sanitization
 * @returns Sanitized string
 */
function sanitizeConsoleError(entry: string, maxLength = 500): string {
    return entry
        .replace(SENSITIVE_PATTERNS, '[REDACTED]')
        .replace(SERVER_PATH_PATTERN, '/[redacted-path]')
        .slice(0, maxLength);
}

/**
 * Truncate a stack trace to `maxLines` and redact server paths.
 *
 * @param stack - Raw stack trace
 * @param maxLines - Maximum number of lines to keep
 * @returns Truncated and redacted stack trace
 */
function truncateStack(stack: string, maxLines = 10): string {
    const lines = stack.split('\n').slice(0, maxLines);
    return lines.join('\n').replace(SERVER_PATH_PATTERN, '/[redacted-path]').replace(/`/g, "'");
}

// ---------------------------------------------------------------------------
// Types for the injected config (mirrors @repo/feedback/config shapes)
// ---------------------------------------------------------------------------

/** Shape of a single report type entry */
interface ReportTypeEntry {
    readonly id: string;
    readonly label: string;
    readonly linearLabelId: string;
}

/** Shape of a single severity level entry */
interface SeverityLevelEntry {
    readonly id: string;
    readonly label: string;
    readonly description: string;
    readonly linearPriority: number;
}

/** Shape of the Linear config sub-object */
interface LinearConfigEntry {
    readonly teamId: string;
    readonly projectId?: string;
    readonly defaultStateId?: string;
    readonly labels: {
        readonly source: {
            readonly web: string;
            readonly admin: string;
            readonly standalone: string;
        };
        readonly environment: {
            readonly beta: string;
        };
    };
}

/** Minimal feedback config shape needed by this service */
interface FeedbackConfigInput {
    readonly linear: LinearConfigEntry;
    readonly reportTypes: readonly ReportTypeEntry[];
    readonly severityLevels: readonly SeverityLevelEntry[];
}

// Type aliases for exported type compatibility
export type { FeedbackConfigType, ReportTypesType, SeverityLevelsType };

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/**
 * Result from uploading a file to Linear.
 */
export interface LinearFileUploadResult {
    /** CDN URL of the uploaded asset */
    assetUrl: string;
}

/**
 * Result from creating a Linear issue.
 */
export interface LinearIssueResult {
    /** Linear internal issue UUID */
    issueId: string;
    /** Full public URL to the issue (e.g. https://linear.app/team/issue/ABC-123) */
    issueUrl: string;
    /** Human-readable issue identifier (e.g. ABC-123) */
    issueIdentifier: string;
}

/**
 * File attachment to upload and embed in the Linear issue body.
 */
export interface FeedbackAttachment {
    /** Raw file bytes */
    buffer: Buffer;
    /** File name including extension (e.g. "screenshot.png") */
    filename: string;
    /** MIME type (e.g. "image/png") */
    contentType: string;
    /** File size in bytes */
    size: number;
}

/**
 * Environment metadata collected by the feedback widget.
 */
export interface FeedbackEnvironment {
    /** Page URL where the report was triggered */
    currentUrl?: string;
    /** Browser name and version */
    browser?: string;
    /** Operating system */
    os?: string;
    /** Viewport dimensions (e.g. "1440x900") */
    viewport?: string;
    /** ISO 8601 timestamp of when the report was submitted */
    timestamp: string;
    /** Application deploy version or commit SHA */
    deployVersion?: string;
    /** Authenticated user ID, if any */
    userId?: string;
    /** Recent console error messages captured by the widget */
    consoleErrors?: string[];
    /** Uncaught JS error details */
    errorInfo?: {
        message: string;
        stack?: string;
    };
}

/**
 * Full input for creating a Linear issue from a user feedback report.
 */
export interface CreateFeedbackIssueInput {
    /** Human-readable report type label (e.g. "Error de JavaScript") */
    reportType: string;
    /** Report type ID used to look up the corresponding Linear label (e.g. "bug-js") */
    reportTypeId: string;
    /** Short issue title provided by the user */
    title: string;
    /** Detailed description provided by the user */
    description: string;
    /** Display name of the reporter */
    reporterName: string;
    /** Email address of the reporter */
    reporterEmail: string;
    /**
     * Severity level ID for priority mapping (e.g. "critical", "high", "medium", "low").
     * When omitted the issue is created with Medium priority.
     */
    severityId?: string;
    /** Steps the user followed before encountering the problem */
    stepsToReproduce?: string;
    /** What the user expected to happen */
    expectedResult?: string;
    /** What actually happened */
    actualResult?: string;
    /**
     * Source application label key.
     * Must be a key of `LINEAR_CONFIG.labels.source` (e.g. "web", "admin", "standalone").
     */
    appSource: string;
    /** Browser / device environment at the time of the report */
    environment: FeedbackEnvironment;
    /** Optional file attachments to upload and embed in the issue body */
    attachments?: FeedbackAttachment[];
}

// ---------------------------------------------------------------------------
// Constructor input
// ---------------------------------------------------------------------------

/**
 * Constructor parameters for {@link LinearFeedbackService}.
 */
export interface LinearFeedbackServiceInput {
    /** Linear API key with write access to the target team */
    apiKey: string;
    /**
     * Feedback configuration that provides Linear IDs, report types and severity levels.
     * Pass `FEEDBACK_CONFIG` from `@repo/feedback/config`.
     */
    feedbackConfig: FeedbackConfigInput;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * High-level service that creates Linear issues from user feedback reports.
 *
 * Responsibilities:
 * - Upload binary attachments via Linear's two-step presigned-URL flow
 * - Build a structured Markdown body from all report fields
 * - Map severity IDs to Linear priority numbers
 * - Collect the correct Linear label IDs (report type + source app)
 * - Create the issue via the Linear GraphQL API
 *
 * @example
 * ```ts
 * import { FEEDBACK_CONFIG } from '@repo/feedback/config';
 *
 * const service = new LinearFeedbackService({
 *   apiKey: env.HOSPEDA_LINEAR_API_KEY,
 *   feedbackConfig: FEEDBACK_CONFIG,
 * });
 *
 * const result = await service.createIssue({
 *   reportType: 'Error de JavaScript',
 *   reportTypeId: 'bug-js',
 *   title: 'Crash on checkout page',
 *   description: 'Page throws unhandled exception when clicking Pay.',
 *   reporterName: 'Ana Lopez',
 *   reporterEmail: 'ana@example.com',
 *   appSource: 'web',
 *   environment: { timestamp: new Date().toISOString() },
 * });
 * ```
 */
export class LinearFeedbackService {
    private readonly client: LinearClient;
    private readonly feedbackConfig: FeedbackConfigInput;

    constructor({ apiKey, feedbackConfig }: LinearFeedbackServiceInput) {
        this.client = new LinearClient({ apiKey });
        this.feedbackConfig = feedbackConfig;
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Upload a single file to Linear using the two-step presigned-URL flow.
     *
     * Steps:
     * 1. Call `fileUpload` mutation to obtain a presigned S3 URL and asset URL.
     * 2. HTTP PUT the file bytes to the presigned URL, including `Content-Type`
     *    and any additional headers returned by Linear. Omitting `Content-Type`
     *    causes Linear's S3 bucket to return 403.
     *
     * @param file - File bytes and metadata
     * @returns CDN asset URL for embedding in issue body
     * @throws {Error} When Linear returns no upload data or the PUT fails
     *
     * @example
     * ```ts
     * const { assetUrl } = await service.uploadFile({
     *   buffer: imageBuffer,
     *   filename: 'screenshot.png',
     *   contentType: 'image/png',
     *   size: imageBuffer.length,
     * });
     * ```
     */
    async uploadFile(file: FeedbackAttachment): Promise<LinearFileUploadResult> {
        logger.info(
            { filename: file.filename, contentType: file.contentType, size: file.size },
            'Uploading file to Linear'
        );

        const uploadPayload = await this.client.fileUpload(
            file.contentType,
            file.filename,
            file.size
        );

        const uploadData = uploadPayload.uploadFile;
        if (!uploadData) {
            throw new Error('Linear fileUpload returned no upload data');
        }

        const headers: Record<string, string> = {
            'Content-Type': file.contentType,
            'cache-control': 'max-age=31536000'
        };

        if (uploadData.headers) {
            for (const header of uploadData.headers) {
                if (header.key && header.value) {
                    headers[header.key] = header.value;
                }
            }
        }

        // Validate that the upload URL is a legitimate S3 host (GAP-031-48: SSRF)
        if (!ALLOWED_UPLOAD_HOST_PATTERN.test(uploadData.uploadUrl)) {
            const hostname = new URL(uploadData.uploadUrl).hostname;
            throw new Error(`Unexpected upload URL host: ${hostname}`);
        }

        // Log without query params to avoid leaking S3 credentials (GAP-031-55)
        const urlForLog = new URL(uploadData.uploadUrl);
        logger.debug(
            { uploadHost: urlForLog.hostname, uploadPath: urlForLog.pathname },
            'PUT file to Linear presigned URL'
        );

        const uploadResponse = await fetch(uploadData.uploadUrl, {
            method: 'PUT',
            headers,
            body: Uint8Array.from(file.buffer)
        });

        if (!uploadResponse.ok) {
            throw new Error(
                `Linear file upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`
            );
        }

        logger.info({ assetUrl: uploadData.assetUrl }, 'File uploaded to Linear successfully');

        return { assetUrl: uploadData.assetUrl };
    }

    /**
     * Create a Linear issue from a feedback report.
     *
     * The method:
     * 1. Uploads all attachments in sequence and collects asset URLs.
     * 2. Builds the Markdown issue body from all report fields and embedded images.
     * 3. Maps the severity ID to a Linear priority number (1=Urgent .. 4=Low).
     * 4. Collects label IDs (report-type label + source-app label).
     * 5. Creates the issue via `createIssue` mutation.
     *
     * @param input - Full feedback report data
     * @returns Issue ID, public URL and human-readable identifier
     * @throws {Error} When any upload fails or the issue creation returns no issue
     *
     * @example
     * ```ts
     * const result = await service.createIssue(input);
     * console.log(result.issueUrl); // https://linear.app/team/issue/ABC-42
     * ```
     */
    async createIssue(input: CreateFeedbackIssueInput): Promise<LinearIssueResult> {
        // 1. Upload attachments sequentially to preserve order
        const assetUrls: string[] = [];
        if (input.attachments && input.attachments.length > 0) {
            for (const attachment of input.attachments) {
                const { assetUrl } = await this.uploadFile(attachment);
                assetUrls.push(assetUrl);
            }
        }

        // 2. Build markdown body
        const body = this.buildIssueBody(input, assetUrls);

        // 3. Map severity to priority
        const priority = this.mapSeverityToPriority(input.severityId);

        // 4. Collect label IDs
        const labelIds = this.collectLabels(input);

        const { linear } = this.feedbackConfig;

        logger.info(
            {
                title: input.title,
                teamId: linear.teamId,
                priority,
                labelCount: labelIds.length,
                attachmentCount: assetUrls.length
            },
            'Creating Linear issue from feedback'
        );

        // 5. Create the issue (use reportTypeId in title per spec, GAP-031-39)
        const issuePayload = await this.client.createIssue({
            teamId: linear.teamId,
            title: `[${input.reportTypeId}] ${input.title}`,
            description: body,
            priority,
            labelIds,
            ...(linear.projectId && !linear.projectId.startsWith('PLACEHOLDER_')
                ? { projectId: linear.projectId }
                : {}),
            ...(linear.defaultStateId && !linear.defaultStateId.startsWith('PLACEHOLDER_')
                ? { stateId: linear.defaultStateId }
                : {})
        });

        const resolvedIssue = await issuePayload.issue;

        if (!resolvedIssue) {
            throw new Error('Linear createIssue returned no issue');
        }

        const result: LinearIssueResult = {
            issueId: resolvedIssue.id,
            issueUrl: resolvedIssue.url,
            issueIdentifier: resolvedIssue.identifier
        };

        logger.info(result, 'Linear issue created from feedback');

        return result;
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Build the Markdown body for the Linear issue.
     *
     * Sections are only included when the relevant data is present, keeping
     * the issue body concise for minimal reports.
     *
     * @param input - Feedback report input
     * @param assetUrls - CDN URLs of uploaded attachments (may be empty)
     * @returns Markdown string for the issue `description` field
     */
    private buildIssueBody(input: CreateFeedbackIssueInput, assetUrls: readonly string[]): string {
        const sections: string[] = [];

        // Reporter (escape user-supplied text to prevent Markdown injection, GAP-031-38)
        sections.push(
            `## Reportado por\n**${escapeMarkdown(input.reporterName)}** (${escapeMarkdown(input.reporterEmail)})`
        );

        // Description
        sections.push(`## Descripcion\n${escapeMarkdown(input.description)}`);

        // Severity label (informational - priority is set as a field)
        if (input.severityId) {
            const severityEntry = this.feedbackConfig.severityLevels.find(
                (s) => s.id === input.severityId
            );
            const label = severityEntry ? severityEntry.label : input.severityId;
            sections.push(`**Severidad:** ${label}`);
        }

        // Steps to reproduce
        if (input.stepsToReproduce) {
            sections.push(`## Pasos para reproducir\n${escapeMarkdown(input.stepsToReproduce)}`);
        }

        // Expected / actual results
        if (input.expectedResult) {
            sections.push(`## Resultado esperado\n${escapeMarkdown(input.expectedResult)}`);
        }
        if (input.actualResult) {
            sections.push(`## Resultado actual\n${escapeMarkdown(input.actualResult)}`);
        }

        // Embedded images
        if (assetUrls.length > 0) {
            const images = assetUrls.map((url, i) => `![attachment-${i + 1}](${url})`).join('\n');
            sections.push(`## Capturas\n${images}`);
        }

        // Environment metadata
        const env = input.environment;
        const envLines: string[] = [];
        if (env.currentUrl) envLines.push(`- **URL:** ${env.currentUrl}`);
        if (env.browser) envLines.push(`- **Navegador:** ${env.browser}`);
        if (env.os) envLines.push(`- **SO:** ${env.os}`);
        if (env.viewport) envLines.push(`- **Viewport:** ${env.viewport}`);
        envLines.push(`- **Timestamp:** ${env.timestamp}`);
        if (env.deployVersion) envLines.push(`- **Version:** ${env.deployVersion}`);
        if (env.userId) envLines.push(`- **User ID:** ${env.userId}`);
        sections.push(`## Entorno\n${envLines.join('\n')}`);

        // Console errors (sanitized: redact API keys, paths, truncate each, GAP-031-24)
        if (env.consoleErrors && env.consoleErrors.length > 0) {
            const sanitized = env.consoleErrors.map((e) => sanitizeConsoleError(e));
            sections.push(`## Errores de consola\n\`\`\`\n${sanitized.join('\n')}\n\`\`\``);
        }

        // Uncaught JS error (truncate & escape stack, GAP-031-20/54)
        if (env.errorInfo) {
            const escapedMessage = escapeMarkdown(env.errorInfo.message);
            const stackPart = env.errorInfo.stack
                ? `\n\`\`\`\n${truncateStack(env.errorInfo.stack)}\n\`\`\``
                : '';
            sections.push(`## Error\n**${escapedMessage}**${stackPart}`);
        }

        // Footer
        sections.push(`---\n*Fuente: ${input.appSource}*`);

        return sections.join('\n\n');
    }

    /**
     * Map a severity ID to a Linear priority number.
     *
     * Uses the `severityLevels` from the injected config so that priority
     * values stay in sync with the config definition.
     *
     * Linear priority scale: 1 = Urgent, 2 = High, 3 = Medium, 4 = Low.
     * Falls back to 3 (Medium) when `severityId` is not provided or unrecognised.
     *
     * @param severityId - Severity level ID (e.g. "critical", "high")
     * @returns Linear priority integer (1-4)
     */
    private mapSeverityToPriority(severityId?: string): number {
        if (!severityId) return 3;

        const entry = this.feedbackConfig.severityLevels.find((s) => s.id === severityId);
        return entry?.linearPriority ?? 3;
    }

    /**
     * Collect Linear label IDs for the issue.
     *
     * Includes:
     * - The label for the report type (e.g. "Bug JS")
     * - The label for the source app (e.g. "Source: Web")
     *
     * Labels whose IDs still start with `PLACEHOLDER_` are silently excluded
     * so that issues can still be created before real Linear IDs are configured.
     *
     * @param input - Feedback report input (needs `reportTypeId` and `appSource`)
     * @returns Array of valid Linear label UUIDs
     */
    private collectLabels(input: CreateFeedbackIssueInput): string[] {
        const labelIds: string[] = [];

        // Report type label
        const reportType = this.feedbackConfig.reportTypes.find((r) => r.id === input.reportTypeId);
        if (reportType && !reportType.linearLabelId.startsWith('PLACEHOLDER_')) {
            labelIds.push(reportType.linearLabelId);
        }

        // Source app label (GAP-031-17: type-safe guard instead of unsafe cast)
        const sourceLabels = this.feedbackConfig.linear.labels.source;
        const validSources = ['web', 'admin', 'standalone'] as const;
        if (validSources.includes(input.appSource as (typeof validSources)[number])) {
            const sourceLabelId = sourceLabels[input.appSource as keyof typeof sourceLabels];
            if (sourceLabelId && !sourceLabelId.startsWith('PLACEHOLDER_')) {
                labelIds.push(sourceLabelId);
            }
        } else {
            logger.warn({ appSource: input.appSource }, 'Invalid appSource for label lookup');
        }

        // Environment (beta) label (GAP-031-32: spec requires report + source + beta)
        const betaLabelId = this.feedbackConfig.linear.labels.environment.beta;
        if (betaLabelId && !betaLabelId.startsWith('PLACEHOLDER_')) {
            labelIds.push(betaLabelId);
        }

        return labelIds;
    }
}
