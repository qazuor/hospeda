import { LinearClient } from '@linear/sdk';
import type { IssueLabel } from '@linear/sdk';
import { createLogger } from '@repo/logger';
import { env } from '../utils/env';

const logger = createLogger('linear-service');

/**
 * Linear label representation
 */
export interface LinearLabel {
    id: string;
    name: string;
    color: string;
    parentName: string | null;
}

/**
 * File upload parameters
 */
export interface UploadFileParams {
    buffer: Buffer;
    mimeType: string;
    fileName: string;
    fileSize: number;
}

/**
 * Bug report creation parameters
 */
export interface CreateBugReportParams {
    title: string;
    markdownBody: string;
    priority: number;
    labelIds: string[];
}

/**
 * Bug report creation result
 */
export interface CreateBugReportResult {
    issueId: string;
    issueUrl: string;
    identifier: string;
}

/**
 * Cached labels with expiry timestamp
 */
interface CachedLabels {
    data: LinearLabel[];
    expiresAt: number;
}

/**
 * Singleton Linear client instance
 */
let linearClient: LinearClient | null = null;

/**
 * In-memory cache for labels (5-minute TTL)
 */
const labelsCache = new Map<string, CachedLabels>();

/**
 * Cache TTL in milliseconds (5 minutes)
 */
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Lazy-initialize and return the Linear client
 * @throws {Error} If Linear environment variables are not configured
 */
function getLinearClient(): LinearClient {
    if (linearClient) {
        return linearClient;
    }

    const apiKey = env.HOSPEDA_LINEAR_API_KEY;
    const teamId = env.HOSPEDA_LINEAR_TEAM_ID;

    if (!apiKey || !teamId) {
        throw new Error(
            'Linear integration not configured. Set HOSPEDA_LINEAR_API_KEY and HOSPEDA_LINEAR_TEAM_ID.'
        );
    }

    logger.info({ teamId }, 'Initializing Linear client');
    linearClient = new LinearClient({ apiKey });

    return linearClient;
}

/**
 * Transform Linear SDK IssueLabel to LinearLabel
 */
async function transformLabel(label: IssueLabel): Promise<LinearLabel> {
    const parent = await label.parent;

    return {
        id: label.id,
        name: label.name,
        color: label.color,
        parentName: parent?.name ?? null
    };
}

/**
 * Get team labels from Linear with in-memory caching
 * @returns Promise with array of Linear labels
 */
export async function getLinearLabels(): Promise<{ data: LinearLabel[] }> {
    const client = getLinearClient();
    const teamId = env.HOSPEDA_LINEAR_TEAM_ID;

    if (!teamId) {
        throw new Error('HOSPEDA_LINEAR_TEAM_ID not configured');
    }

    // Check cache
    const cached = labelsCache.get(teamId);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
        logger.debug({ teamId, count: cached.data.length }, 'Returning cached labels');
        return { data: cached.data };
    }

    logger.info({ teamId }, 'Fetching labels from Linear');

    try {
        const team = await client.team(teamId);
        const labelsConnection = await team.labels();
        const labels = labelsConnection.nodes;

        // Transform labels
        const transformedLabels = await Promise.all(labels.map(transformLabel));

        // Cache results
        labelsCache.set(teamId, {
            data: transformedLabels,
            expiresAt: now + CACHE_TTL
        });

        logger.info({ teamId, count: transformedLabels.length }, 'Labels fetched and cached');

        return { data: transformedLabels };
    } catch (error) {
        logger.error({ teamId, error }, 'Failed to fetch Linear labels');
        throw error;
    }
}

/**
 * Upload a file to Linear via fileUpload mutation
 * @param params - File upload parameters
 * @returns Promise with asset URL
 */
export async function uploadFileToLinear(params: UploadFileParams): Promise<{ assetUrl: string }> {
    const { buffer, mimeType, fileName, fileSize } = params;
    const client = getLinearClient();

    logger.info({ fileName, mimeType, fileSize }, 'Uploading file to Linear');

    try {
        // Get presigned upload URL from Linear
        const uploadPayload = await client.fileUpload(mimeType, fileName, fileSize);

        if (!uploadPayload?.uploadFile) {
            throw new Error('Failed to get upload URL from Linear');
        }

        const { uploadUrl, assetUrl, headers } = uploadPayload.uploadFile;

        // Prepare headers for S3 upload
        const uploadHeaders: Record<string, string> = {
            'Content-Type': mimeType,
            'Content-Length': fileSize.toString()
        };

        // Merge any additional headers from Linear
        if (headers) {
            for (const header of headers) {
                if (header.key && header.value) {
                    uploadHeaders[header.key] = header.value;
                }
            }
        }

        // Upload file to presigned URL
        logger.debug({ uploadUrl }, 'Uploading to presigned URL');
        const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: uploadHeaders,
            body: Uint8Array.from(buffer)
        });

        if (!uploadResponse.ok) {
            throw new Error(
                `Failed to upload file to storage: ${uploadResponse.status} ${uploadResponse.statusText}`
            );
        }

        logger.info({ assetUrl }, 'File uploaded successfully');

        return { assetUrl };
    } catch (error) {
        logger.error({ fileName, error }, 'File upload to Linear failed');
        throw error;
    }
}

/**
 * Create a bug report issue in Linear
 * @param params - Bug report parameters
 * @returns Promise with issue details
 */
export async function createLinearBugReport(
    params: CreateBugReportParams
): Promise<CreateBugReportResult> {
    const { title, markdownBody, priority, labelIds } = params;
    const client = getLinearClient();
    const teamId = env.HOSPEDA_LINEAR_TEAM_ID;

    if (!teamId) {
        throw new Error('HOSPEDA_LINEAR_TEAM_ID not configured');
    }

    logger.info(
        { title, teamId, priority, labelCount: labelIds.length },
        'Creating Linear bug report'
    );

    try {
        const issuePayload = await client.createIssue({
            teamId,
            title,
            description: markdownBody,
            priority,
            labelIds
        });

        const issue = await issuePayload.issue;

        if (!issue) {
            throw new Error('Issue creation returned no issue object');
        }

        const result: CreateBugReportResult = {
            issueId: issue.id,
            issueUrl: issue.url,
            identifier: issue.identifier
        };

        logger.info(result, 'Linear bug report created');

        return result;
    } catch (error) {
        logger.error({ title, teamId, error }, 'Failed to create Linear bug report');
        throw error;
    }
}
