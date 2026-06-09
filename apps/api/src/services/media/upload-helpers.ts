/**
 * Shared media upload helpers for admin and protected tiers.
 *
 * Extracts common upload logic (file validation, Cloudinary upload,
 * response validation) so both tiers reuse the same code without
 * duplicating the Cloudinary interaction pattern.
 */
import { resolveEnvironment, validateMediaFile } from '@repo/media/server';
import type { ImageProvider } from '@repo/media/server';
import { UploadResponseDataSchema } from '@repo/schemas';
import { Sentry } from '../../lib/sentry';
import { incrementDomainCounter } from '../../middlewares/metrics';
import { apiLogger } from '../../utils/logger';

/** Maximum file size in megabytes for entity uploads. */
const ENTITY_MAX_FILE_SIZE_MB = 5;

/** Margin above the strict file-size limit for Content-Length pre-check. */
const CONTENT_LENGTH_MARGIN = 1024;

/**
 * Result of a successful upload.
 */
export interface UploadHelperResult {
    readonly url: string;
    readonly publicId: string;
    readonly width: number;
    readonly height: number;
    readonly moderationState: 'APPROVED';
}

/**
 * Error result from the upload helper.
 */
export interface UploadHelperError {
    readonly code: string;
    readonly message: string;
    readonly status: number;
}

/**
 * Validate the Content-Length header against the max file size.
 *
 * @param contentLength - The Content-Length header value
 * @param maxMb - Maximum file size in megabytes
 * @returns null on success, error result on failure
 */
export function validateContentLength(
    contentLength: number,
    maxMb: number = ENTITY_MAX_FILE_SIZE_MB
): UploadHelperError | null {
    const maxBytes = maxMb * 1024 * 1024;
    if (contentLength > maxBytes + CONTENT_LENGTH_MARGIN) {
        return {
            code: 'PAYLOAD_TOO_LARGE',
            message: `File exceeds the ${maxMb}MB limit`,
            status: 413
        };
    }
    return null;
}

/**
 * Validate a file buffer (size, MIME type, dimensions).
 *
 * @param buffer - The file buffer
 * @param mimeType - The MIME type from the multipart form
 * @param context - The validation context ('entity' or 'avatar')
 * @param maxFileSizeMb - Maximum file size in megabytes
 * @returns null on success, error result on failure
 */
export function validateFile(
    buffer: Buffer,
    mimeType: string,
    context: 'entity' | 'avatar' = 'entity',
    maxFileSizeMb: number = ENTITY_MAX_FILE_SIZE_MB
): UploadHelperError | null {
    const validation = validateMediaFile({
        buffer,
        mimeType,
        context,
        maxFileSizeMb
    });

    if (!validation.valid) {
        return {
            code: 'UNPROCESSABLE_ENTITY',
            message: `File validation failed: ${validation.error}`,
            status: 422
        };
    }
    return null;
}

/**
 * Upload a file to Cloudinary and validate the response.
 *
 * @param provider - The image provider instance
 * @param params - Upload parameters
 * @returns The validated upload result or an error
 */
export async function uploadToProvider(
    provider: ImageProvider,
    params: {
        readonly buffer: Buffer;
        readonly folder: string;
        readonly publicId: string;
        readonly tags?: readonly string[];
        readonly overwrite?: boolean;
        readonly entityType: string;
        readonly entityId: string;
    }
): Promise<UploadHelperResult | UploadHelperError> {
    let uploadResult: Awaited<ReturnType<typeof provider.upload>>;
    try {
        uploadResult = await provider.upload({
            file: params.buffer,
            folder: params.folder,
            publicId: params.publicId,
            ...(params.tags !== undefined ? { tags: [...params.tags] } : {}),
            ...(params.overwrite !== undefined ? { overwrite: params.overwrite } : {})
        });
    } catch (uploadError) {
        apiLogger.error(
            {
                error: uploadError instanceof Error ? uploadError.message : String(uploadError),
                entityType: params.entityType,
                entityId: params.entityId
            },
            'Cloudinary upload failed'
        );
        Sentry.captureException(uploadError, {
            tags: { component: 'media-provider', operation: 'upload' },
            contexts: { media: { entityType: params.entityType, entityId: params.entityId } }
        });
        incrementDomainCounter('media_upload_total', 'failure');
        return {
            code: 'UPSTREAM_ERROR',
            message: 'Image upload failed',
            status: 502
        };
    }

    const parsedResponse = UploadResponseDataSchema.safeParse({
        url: uploadResult.url,
        publicId: uploadResult.publicId,
        width: uploadResult.width,
        height: uploadResult.height,
        moderationState: 'APPROVED'
    });

    if (!parsedResponse.success) {
        apiLogger.error(
            {
                issues: parsedResponse.error.issues.map((i) => ({
                    path: i.path.join('.'),
                    code: i.code
                })),
                entityType: params.entityType,
                entityId: params.entityId
            },
            'Cloudinary response did not match UploadResponseDataSchema'
        );
        incrementDomainCounter('media_upload_total', 'failure');
        return {
            code: 'UPSTREAM_ERROR',
            message: 'Incomplete response from image service',
            status: 502
        };
    }

    apiLogger.info(
        {
            event: 'media.upload.success',
            publicId: parsedResponse.data.publicId,
            preset: `${params.entityType}:entity`,
            entityType: params.entityType,
            entityId: params.entityId,
            actorId: params.entityId
        },
        'media upload success'
    );
    incrementDomainCounter('media_upload_total', 'success');

    return parsedResponse.data;
}

/**
 * Build the storage folder path for an entity upload.
 *
 * @param entityType - The entity type
 * @param entityId - The entity UUID
 * @returns The Cloudinary folder path
 */
export function buildEntityFolder(entityType: string, entityId: string): string {
    const environment = resolveEnvironment();
    return `hospeda/${environment}/${entityType}s/${entityId}`;
}

/** Fixed max file size in bytes for entity uploads. */
export const ENTITY_MAX_BYTES = ENTITY_MAX_FILE_SIZE_MB * 1024 * 1024;

/** Content-length margin for the pre-check. */
export const CONTENT_LENGTH_MARGIN_BYTES = CONTENT_LENGTH_MARGIN;
