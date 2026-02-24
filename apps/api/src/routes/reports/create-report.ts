import { createLogger } from '@repo/logger';
import { bodyLimit } from 'hono/body-limit';
import { protectedAuthMiddleware } from '../../middlewares/authorization';
import {
    ALLOWED_FILE_TYPES,
    BugReportFormSchema,
    MAX_FILES,
    MAX_FILE_SIZE,
    PRIORITY_LABELS,
    SEVERITY_LABELS
} from '../../schemas/bug-report.schema';
import {
    createLinearBugReport,
    getLinearLabels,
    uploadFileToLinear
} from '../../services/linear.service';
import { detectBrowser, detectPlatform } from '../../utils/browser-detection';
import { createRouter } from '../../utils/create-app';
import { buildBugReportMarkdown } from '../../utils/markdown-builder';

const logger = createLogger('reports:create');

/**
 * POST /api/v1/reports/create
 * Creates a bug report in Linear from multipart form data.
 * Expects: multipart/form-data with "data" (JSON) and optional "files" fields.
 * Requires authentication (protected route).
 */
const app = createRouter();

// Apply body limit of 60MB for this route to allow file uploads
app.use('/create', bodyLimit({ maxSize: 60 * 1024 * 1024 }));

// Require authenticated user - delegates auth check to middleware
app.use('/create', protectedAuthMiddleware());

app.post('/create', async (c) => {
    try {
        // Parse multipart form data
        const formData = await c.req.formData();
        const dataField = formData.get('data');

        if (!dataField || typeof dataField !== 'string') {
            return c.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Missing "data" field in form data'
                    }
                },
                400
            );
        }

        // Parse and validate JSON data
        let parsedData: unknown;
        try {
            parsedData = JSON.parse(dataField);
        } catch {
            return c.json(
                {
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON in "data" field' }
                },
                400
            );
        }

        const validationResult = BugReportFormSchema.safeParse(parsedData);
        if (!validationResult.success) {
            return c.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid form data',
                        details: validationResult.error.flatten().fieldErrors
                    }
                },
                400
            );
        }

        const data = validationResult.data;

        // Collect files from form data
        const files: File[] = [];
        const fileEntries = formData.getAll('files');
        for (const entry of fileEntries) {
            if (entry instanceof File && entry.size > 0) {
                files.push(entry);
            }
        }

        // Validate file count
        if (files.length > MAX_FILES) {
            return c.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: `Maximum ${MAX_FILES} files allowed, received ${files.length}`
                    }
                },
                400
            );
        }

        // Validate each file
        for (const file of files) {
            if (file.size > MAX_FILE_SIZE) {
                return c.json(
                    {
                        success: false,
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: `File "${file.name}" exceeds maximum size of 10MB`
                        }
                    },
                    400
                );
            }

            if (!ALLOWED_FILE_TYPES.includes(file.type as (typeof ALLOWED_FILE_TYPES)[number])) {
                return c.json(
                    {
                        success: false,
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: `File type "${file.type}" is not allowed for "${file.name}"`
                        }
                    },
                    400
                );
            }
        }

        // Upload files to Linear
        const attachments: Array<{ fileName: string; assetUrl: string }> = [];
        for (const file of files) {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const result = await uploadFileToLinear({
                    buffer,
                    mimeType: file.type,
                    fileName: file.name,
                    fileSize: file.size
                });
                attachments.push({ fileName: file.name, assetUrl: result.assetUrl });
            } catch (error) {
                logger.warn({
                    message: 'Failed to upload file to Linear',
                    fileName: file.name,
                    error: error instanceof Error ? error.message : String(error)
                });
                // Continue with other files even if one fails
            }
        }

        // Resolve label names for the markdown
        let categoryName: string | null = null;
        const tagNames: string[] = [];

        if (data.categoryLabelId || (data.tagLabelIds && data.tagLabelIds.length > 0)) {
            try {
                const labelsResult = await getLinearLabels();
                const labelsMap = new Map(labelsResult.data.map((l) => [l.id, l.name]));

                if (data.categoryLabelId) {
                    categoryName = labelsMap.get(data.categoryLabelId) ?? null;
                }

                for (const tagId of data.tagLabelIds) {
                    const tagName = labelsMap.get(tagId);
                    if (tagName) {
                        tagNames.push(tagName);
                    }
                }
            } catch {
                logger.warn({ message: 'Failed to resolve label names for markdown' });
            }
        }

        // Build label IDs array for the Linear issue
        const labelIds: string[] = [];
        if (data.categoryLabelId) {
            labelIds.push(data.categoryLabelId);
        }
        if (data.tagLabelIds) {
            labelIds.push(...data.tagLabelIds);
        }

        // Try to find severity label and auto-detected labels from Linear
        try {
            const labelsResult = await getLinearLabels();
            const severityLabel = labelsResult.data.find((l) => l.name === data.severity);
            if (severityLabel) {
                labelIds.push(severityLabel.id);
            } else {
                logger.warn({
                    message: 'Severity label not found in Linear',
                    severity: data.severity
                });
            }

            // Auto-detect and apply source, browser, and platform labels
            const autoLabelNames = [
                'source:form',
                detectBrowser({ userAgent: data.metadata.userAgent }),
                detectPlatform({
                    userAgent: data.metadata.userAgent,
                    screenResolution: data.metadata.screenResolution
                })
            ];

            for (const name of autoLabelNames) {
                const label = labelsResult.data.find((l) => l.name === name);
                if (label) {
                    labelIds.push(label.id);
                }
            }
        } catch {
            logger.warn({ message: 'Failed to look up severity/auto labels' });
        }

        // Build markdown body
        const markdownBody = buildBugReportMarkdown({
            reporter: {
                name: data.reporterName,
                email: data.reporterEmail
            },
            priority: PRIORITY_LABELS[data.priority] ?? 'Media',
            severity: SEVERITY_LABELS[data.severity] ?? data.severity,
            category: categoryName,
            description: data.description,
            stepsToReproduce: data.stepsToReproduce ?? null,
            expectedBehavior: data.expectedBehavior ?? null,
            actualBehavior: data.actualBehavior ?? null,
            attachments,
            metadata: data.metadata,
            tags: tagNames
        });

        // Create issue in Linear
        const result = await createLinearBugReport({
            title: data.title,
            markdownBody,
            priority: data.priority,
            labelIds
        });

        logger.info({
            message: 'Bug report created successfully',
            issueId: result.issueId,
            identifier: result.identifier
        });

        return c.json(
            {
                success: true,
                data: {
                    issueId: result.issueId,
                    issueUrl: result.issueUrl,
                    identifier: result.identifier
                }
            },
            201
        );
    } catch (error) {
        logger.error({
            message: 'Failed to create bug report',
            error: error instanceof Error ? error.message : String(error)
        });

        return c.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message:
                        error instanceof Error &&
                        error.message.includes('Linear integration not configured')
                            ? error.message
                            : 'Failed to create bug report. Please try again later.'
                }
            },
            500
        );
    }
});

export { app as createReportRoute };
