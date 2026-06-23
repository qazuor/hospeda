/**
 * Unit tests for SocialImagePipelineService.
 *
 * All network and DB interactions are mocked — no real HTTP or Postgres calls.
 *
 * Covers:
 * - Success path (public_url): asset created, cloudinaryUrl set, no warnings
 * - Success path (openai_file_refs): extracts downloadUrl from first fileRef
 * - social_post_media link row created when socialPostId is provided
 * - social_post_media link NOT created when socialPostId is absent
 * - Download timeout → graceful: assetId null, cloudinaryUrl null, warning
 * - Non-2xx response → graceful
 * - Cloudinary upload error → graceful
 * - social_assets create failure → graceful
 * - social_post_media create failure → non-fatal (assetId and cloudinaryUrl still returned)
 * - Video MIME type inferred as SocialMediaTypeEnum.VIDEO
 * - openai_file_refs mode stores fileId in openaiFileRef column
 * - Empty fileRefs array → graceful
 *
 * SPEC-254 T-027.
 */

import type { SocialAssetModel, SocialPostMediaModel } from '@repo/db';
import type { ImageProvider } from '@repo/media/server';
import { InMemoryImageProvider } from '@repo/media/test-utils';
import { SocialAssetSourceEnum, SocialMediaTypeEnum } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    type GptImagePayload,
    SocialImagePipelineService
} from '../../../src/services/social/social-image-pipeline.service';
import { createModelMock } from '../../utils/modelMockFactory';

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const MOCK_ASSET_UUID = '00000000-0000-4000-8000-000000000001';
const MOCK_POST_UUID = '00000000-0000-4000-8000-000000000002';
const MOCK_ACTOR_UUID = '00000000-0000-4000-8000-000000000003';

const FAKE_IMAGE_URL = 'https://files.oaiusercontent.com/fake-image.jpg';
const FAKE_CLOUDINARY_URL =
    'https://res.cloudinary.com/test-cloud/image/upload/v1/hospeda/social/assets/generated-1';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMockAssetRow(overrides: Record<string, unknown> = {}) {
    return {
        id: MOCK_ASSET_UUID,
        source: SocialAssetSourceEnum.EXTERNAL_URL,
        cloudinaryUrl: FAKE_CLOUDINARY_URL,
        cloudinaryPublicId: 'hospeda/social/assets/generated-1',
        originalUrl: FAKE_IMAGE_URL,
        openaiFileRef: null,
        mimeType: 'image/jpeg',
        mediaType: SocialMediaTypeEnum.IMAGE,
        width: 1024,
        height: 768,
        durationSeconds: null,
        altText: null,
        caption: null,
        metadataJson: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: MOCK_ACTOR_UUID,
        updatedById: null,
        deletedAt: null,
        deletedById: null,
        ...overrides
    };
}

function buildMockPostMediaRow() {
    return {
        id: '00000000-0000-4000-8000-000000000099',
        socialPostId: MOCK_POST_UUID,
        assetId: MOCK_ASSET_UUID,
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date()
    };
}

/** Returns a Response-like object that global `fetch` can be mocked to return. */
function makeOkResponse(body: Uint8Array = new Uint8Array([1, 2, 3])): Response {
    return {
        ok: true,
        status: 200,
        statusText: 'OK',
        arrayBuffer: vi.fn().mockResolvedValue(body.buffer)
    } as unknown as Response;
}

function makeErrorResponse(status: number, statusText: string): Response {
    return {
        ok: false,
        status,
        statusText,
        arrayBuffer: vi.fn()
    } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('SocialImagePipelineService', () => {
    let mediaProvider: InMemoryImageProvider;
    let assetModelMock: ReturnType<typeof createModelMock>;
    let postMediaModelMock: ReturnType<typeof createModelMock>;
    let service: SocialImagePipelineService;

    beforeEach(() => {
        vi.clearAllMocks();
        // Use InMemoryImageProvider for the happy paths, spy on its upload method.
        mediaProvider = new InMemoryImageProvider({
            cloudName: 'test-cloud',
            width: 1024,
            height: 768
        });
        assetModelMock = createModelMock();
        postMediaModelMock = createModelMock();

        service = new SocialImagePipelineService(
            {},
            mediaProvider as unknown as ImageProvider,
            assetModelMock as unknown as SocialAssetModel,
            postMediaModelMock as unknown as SocialPostMediaModel
        );

        // Default: asset create succeeds
        assetModelMock.create.mockResolvedValue(buildMockAssetRow());
        // Default: post media create succeeds
        postMediaModelMock.create.mockResolvedValue(buildMockPostMediaRow());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // -------------------------------------------------------------------------
    // Success path — public_url
    // -------------------------------------------------------------------------

    describe('processImage — public_url mode', () => {
        it('should return assetId and cloudinaryUrl when download and upload succeed', async () => {
            // Arrange
            const image: GptImagePayload = {
                mode: 'public_url',
                url: FAKE_IMAGE_URL,
                mimeType: 'image/jpeg',
                altText: 'A nice photo'
            };
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeOkResponse());

            // Act
            const result = await service.processImage({ image, actorId: MOCK_ACTOR_UUID });

            // Assert
            expect(result.assetId).toBe(MOCK_ASSET_UUID);
            expect(result.cloudinaryUrl).not.toBeNull();
            expect(result.warnings).toHaveLength(0);
        });

        it('should pass source = EXTERNAL_URL to social_assets.create', async () => {
            // Arrange
            const image: GptImagePayload = { mode: 'public_url', url: FAKE_IMAGE_URL };
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeOkResponse());

            // Act
            await service.processImage({ image });

            // Assert
            expect(assetModelMock.create).toHaveBeenCalledWith(
                expect.objectContaining({ source: SocialAssetSourceEnum.EXTERNAL_URL })
            );
        });

        it('should set originalUrl to the provided URL', async () => {
            // Arrange
            const image: GptImagePayload = { mode: 'public_url', url: FAKE_IMAGE_URL };
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeOkResponse());

            // Act
            await service.processImage({ image });

            // Assert
            expect(assetModelMock.create).toHaveBeenCalledWith(
                expect.objectContaining({ originalUrl: FAKE_IMAGE_URL })
            );
        });

        it('should create a social_post_media row at position 0 when socialPostId is provided', async () => {
            // Arrange
            const image: GptImagePayload = { mode: 'public_url', url: FAKE_IMAGE_URL };
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeOkResponse());

            // Act
            await service.processImage({ image, socialPostId: MOCK_POST_UUID });

            // Assert
            expect(postMediaModelMock.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    socialPostId: MOCK_POST_UUID,
                    assetId: MOCK_ASSET_UUID,
                    position: 0
                })
            );
        });

        it('should NOT create a social_post_media row when socialPostId is absent', async () => {
            // Arrange
            const image: GptImagePayload = { mode: 'public_url', url: FAKE_IMAGE_URL };
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeOkResponse());

            // Act
            await service.processImage({ image });

            // Assert
            expect(postMediaModelMock.create).not.toHaveBeenCalled();
        });

        it('should infer mediaType = IMAGE for image/jpeg', async () => {
            // Arrange
            const image: GptImagePayload = {
                mode: 'public_url',
                url: FAKE_IMAGE_URL,
                mimeType: 'image/jpeg'
            };
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeOkResponse());

            // Act
            await service.processImage({ image });

            // Assert
            expect(assetModelMock.create).toHaveBeenCalledWith(
                expect.objectContaining({ mediaType: SocialMediaTypeEnum.IMAGE })
            );
        });

        it('should infer mediaType = VIDEO for video/mp4', async () => {
            // Arrange
            const image: GptImagePayload = {
                mode: 'public_url',
                url: FAKE_IMAGE_URL,
                mimeType: 'video/mp4'
            };
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeOkResponse());
            assetModelMock.create.mockResolvedValue(
                buildMockAssetRow({ mediaType: SocialMediaTypeEnum.VIDEO, mimeType: 'video/mp4' })
            );

            // Act
            await service.processImage({ image });

            // Assert
            expect(assetModelMock.create).toHaveBeenCalledWith(
                expect.objectContaining({ mediaType: SocialMediaTypeEnum.VIDEO })
            );
        });
    });

    // -------------------------------------------------------------------------
    // Success path — openai_file_refs
    // -------------------------------------------------------------------------

    describe('processImage — openai_file_refs mode', () => {
        it('should extract downloadUrl from the first fileRef and succeed', async () => {
            // Arrange
            const image: GptImagePayload = {
                mode: 'openai_file_refs',
                fileRefs: [
                    { fileId: 'file-abc123', downloadUrl: FAKE_IMAGE_URL },
                    { fileId: 'file-def456', downloadUrl: 'https://example.com/other.jpg' }
                ]
            };
            const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeOkResponse());

            // Act
            const result = await service.processImage({ image, actorId: MOCK_ACTOR_UUID });

            // Assert — only the first fileRef is processed
            expect(fetchSpy).toHaveBeenCalledWith(FAKE_IMAGE_URL, expect.anything());
            expect(result.assetId).toBe(MOCK_ASSET_UUID);
            expect(result.cloudinaryUrl).not.toBeNull();
            expect(result.warnings).toHaveLength(0);
        });

        it('should pass source = CHATGPT_FILE to social_assets.create', async () => {
            // Arrange
            const image: GptImagePayload = {
                mode: 'openai_file_refs',
                fileRefs: [{ fileId: 'file-abc123', downloadUrl: FAKE_IMAGE_URL }]
            };
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeOkResponse());

            // Act
            await service.processImage({ image });

            // Assert
            expect(assetModelMock.create).toHaveBeenCalledWith(
                expect.objectContaining({ source: SocialAssetSourceEnum.CHATGPT_FILE })
            );
        });

        it('should store the fileId in openaiFileRef column', async () => {
            // Arrange
            const image: GptImagePayload = {
                mode: 'openai_file_refs',
                fileRefs: [{ fileId: 'file-abc123', downloadUrl: FAKE_IMAGE_URL }]
            };
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeOkResponse());

            // Act
            await service.processImage({ image });

            // Assert
            expect(assetModelMock.create).toHaveBeenCalledWith(
                expect.objectContaining({ openaiFileRef: 'file-abc123' })
            );
        });

        it('should return graceful failure when fileRefs array is empty', async () => {
            // Arrange
            const image: GptImagePayload = {
                mode: 'openai_file_refs',
                fileRefs: []
            };

            // Act — no fetch call expected since downloadUrl will be ''
            const result = await service.processImage({ image });

            // Assert
            expect(result.assetId).toBeNull();
            expect(result.cloudinaryUrl).toBeNull();
            expect(result.warnings).toContain('Media upload failed; manual upload required');
        });
    });

    // -------------------------------------------------------------------------
    // Graceful failure — download timeout
    // -------------------------------------------------------------------------

    describe('processImage — download timeout', () => {
        it('should return graceful failure when fetch throws AbortError', async () => {
            // Arrange
            const image: GptImagePayload = { mode: 'public_url', url: FAKE_IMAGE_URL };
            vi.spyOn(globalThis, 'fetch').mockRejectedValue(
                Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })
            );

            // Act
            const result = await service.processImage({ image });

            // Assert — does NOT throw
            expect(result.assetId).toBeNull();
            expect(result.cloudinaryUrl).toBeNull();
            expect(result.warnings).toContain('Media upload failed; manual upload required');
            // DB should not have been touched
            expect(assetModelMock.create).not.toHaveBeenCalled();
        });

        it('should return graceful failure when fetch rejects with a network error', async () => {
            // Arrange
            const image: GptImagePayload = { mode: 'public_url', url: FAKE_IMAGE_URL };
            vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('fetch failed'));

            // Act
            const result = await service.processImage({ image });

            // Assert
            expect(result.assetId).toBeNull();
            expect(result.cloudinaryUrl).toBeNull();
            expect(result.warnings).toHaveLength(1);
            expect(assetModelMock.create).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // Graceful failure — non-2xx response
    // -------------------------------------------------------------------------

    describe('processImage — non-2xx response', () => {
        it('should return graceful failure when server returns 404', async () => {
            // Arrange
            const image: GptImagePayload = { mode: 'public_url', url: FAKE_IMAGE_URL };
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeErrorResponse(404, 'Not Found'));

            // Act
            const result = await service.processImage({ image });

            // Assert
            expect(result.assetId).toBeNull();
            expect(result.cloudinaryUrl).toBeNull();
            expect(result.warnings).toContain('Media upload failed; manual upload required');
            expect(assetModelMock.create).not.toHaveBeenCalled();
        });

        it('should return graceful failure when server returns 500', async () => {
            // Arrange
            const image: GptImagePayload = { mode: 'public_url', url: FAKE_IMAGE_URL };
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(
                makeErrorResponse(500, 'Internal Server Error')
            );

            // Act
            const result = await service.processImage({ image });

            // Assert
            expect(result.assetId).toBeNull();
            expect(result.cloudinaryUrl).toBeNull();
            expect(result.warnings).toHaveLength(1);
        });
    });

    // -------------------------------------------------------------------------
    // Graceful failure — Cloudinary upload error
    // -------------------------------------------------------------------------

    describe('processImage — Cloudinary upload error', () => {
        it('should return graceful failure when mediaProvider.upload throws', async () => {
            // Arrange
            const image: GptImagePayload = { mode: 'public_url', url: FAKE_IMAGE_URL };
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeOkResponse());
            const uploadSpy = vi
                .spyOn(mediaProvider, 'upload')
                .mockRejectedValue(new Error('Cloudinary error: quota exceeded'));

            // Act
            const result = await service.processImage({ image });

            // Assert
            expect(uploadSpy).toHaveBeenCalled();
            expect(result.assetId).toBeNull();
            expect(result.cloudinaryUrl).toBeNull();
            expect(result.warnings).toContain('Media upload failed; manual upload required');
            expect(assetModelMock.create).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // Graceful failure — DB asset creation error
    // -------------------------------------------------------------------------

    describe('processImage — social_assets create failure', () => {
        it('should return graceful failure when assetModel.create throws', async () => {
            // Arrange
            const image: GptImagePayload = { mode: 'public_url', url: FAKE_IMAGE_URL };
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeOkResponse());
            assetModelMock.create.mockRejectedValue(new Error('DB constraint violation'));

            // Act
            const result = await service.processImage({ image });

            // Assert
            expect(result.assetId).toBeNull();
            expect(result.cloudinaryUrl).toBeNull();
            expect(result.warnings).toContain('Media upload failed; manual upload required');
        });
    });

    // -------------------------------------------------------------------------
    // Non-fatal: social_post_media create failure
    // -------------------------------------------------------------------------

    describe('processImage — social_post_media create failure', () => {
        it('should still return assetId and cloudinaryUrl when post media link fails', async () => {
            // Arrange
            const image: GptImagePayload = { mode: 'public_url', url: FAKE_IMAGE_URL };
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeOkResponse());
            postMediaModelMock.create.mockRejectedValue(new Error('unique constraint violation'));

            // Act
            const result = await service.processImage({ image, socialPostId: MOCK_POST_UUID });

            // Assert — link failure is non-fatal
            expect(result.assetId).toBe(MOCK_ASSET_UUID);
            expect(result.cloudinaryUrl).not.toBeNull();
            // warnings array should remain empty (link failure is only logged, not surfaced)
            expect(result.warnings).toHaveLength(0);
        });
    });

    // -------------------------------------------------------------------------
    // createdById is forwarded to the DB row
    // -------------------------------------------------------------------------

    describe('processImage — actorId forwarding', () => {
        it('should pass actorId as createdById to social_assets.create', async () => {
            // Arrange
            const image: GptImagePayload = { mode: 'public_url', url: FAKE_IMAGE_URL };
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeOkResponse());

            // Act
            await service.processImage({ image, actorId: MOCK_ACTOR_UUID });

            // Assert
            expect(assetModelMock.create).toHaveBeenCalledWith(
                expect.objectContaining({ createdById: MOCK_ACTOR_UUID })
            );
        });

        it('should pass undefined as createdById when actorId is absent', async () => {
            // Arrange
            const image: GptImagePayload = { mode: 'public_url', url: FAKE_IMAGE_URL };
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeOkResponse());

            // Act
            await service.processImage({ image });

            // Assert
            expect(assetModelMock.create).toHaveBeenCalledWith(
                expect.objectContaining({ createdById: undefined })
            );
        });
    });
});
