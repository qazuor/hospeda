/**
 * Unit tests for SocialImagePipelineService.
 *
 * All network and DB interactions are mocked — no real HTTP or Postgres calls.
 *
 * Covers:
 * - Success path (public_url): asset created, cloudinaryUrl set, no warnings
 * - Success path (openai_file_refs): extracts download_link from first openaiFileIdRef
 * - social_post_media link row created when socialPostId is provided
 * - social_post_media link NOT created when socialPostId is absent
 * - Download timeout → graceful: assetId null, cloudinaryUrl null, warning
 * - Non-2xx response → graceful
 * - Cloudinary upload error → graceful
 * - social_assets create failure → graceful
 * - social_post_media create failure → non-fatal (assetId and cloudinaryUrl still returned)
 * - Video MIME type inferred as SocialMediaTypeEnum.VIDEO
 * - openai_file_refs mode stores id in openaiFileRef column
 * - Empty openaiFileIdRefs array → graceful
 *
 * SPEC-254 T-027.
 */

import type {
    SocialAssetModel,
    SocialPostMediaModel,
    SocialPostTargetMediaModel,
    SocialSettingModel
} from '@repo/db';
import type { ImageProvider } from '@repo/media/server';
import { InMemoryImageProvider } from '@repo/media/test-utils';
import { SocialAssetSourceEnum, SocialMediaTypeEnum } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    type GptImagePayload,
    type GptVideoPayload,
    SocialImagePipelineService
} from '../../../src/services/social/social-image-pipeline.service';
import { createModelMock } from '../../utils/modelMockFactory';

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const MOCK_ASSET_UUID = '00000000-0000-4000-8000-000000000001';
const MOCK_POST_UUID = '00000000-0000-4000-8000-000000000002';
const MOCK_ACTOR_UUID = '00000000-0000-4000-8000-000000000003';
const MOCK_TARGET_UUID = '00000000-0000-4000-8000-000000000004';
const MOCK_TARGET_MEDIA_UUID = '00000000-0000-4000-8000-000000000005';

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

function buildMockPostMediaRow(overrides: Record<string, unknown> = {}) {
    return {
        id: '00000000-0000-4000-8000-000000000099',
        socialPostId: MOCK_POST_UUID,
        assetId: MOCK_ASSET_UUID,
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides
    };
}

function buildMockTargetMediaRow(overrides: Record<string, unknown> = {}) {
    return {
        id: MOCK_TARGET_MEDIA_UUID,
        socialPostTargetId: MOCK_TARGET_UUID,
        socialPostMediaId: '00000000-0000-4000-8000-000000000099',
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides
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
    let settingModelMock: ReturnType<typeof createModelMock>;
    let postTargetMediaModelMock: ReturnType<typeof createModelMock>;
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
        settingModelMock = createModelMock();
        postTargetMediaModelMock = createModelMock();

        service = new SocialImagePipelineService(
            {},
            mediaProvider as unknown as ImageProvider,
            assetModelMock as unknown as SocialAssetModel,
            postMediaModelMock as unknown as SocialPostMediaModel,
            settingModelMock as unknown as SocialSettingModel,
            postTargetMediaModelMock as unknown as SocialPostTargetMediaModel
        );

        // Default: asset create succeeds
        assetModelMock.create.mockResolvedValue(buildMockAssetRow());
        // Default: post media create succeeds
        postMediaModelMock.create.mockResolvedValue(buildMockPostMediaRow());
        // Default: no social_settings rows configured — every getter falls back
        settingModelMock.findOne.mockResolvedValue(undefined);
        // Default: target-media link create succeeds
        postTargetMediaModelMock.create.mockResolvedValue(buildMockTargetMediaRow());
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
        it('should extract download_link from the first openaiFileIdRef and succeed', async () => {
            // Arrange
            const image: GptImagePayload = {
                mode: 'openai_file_refs',
                openaiFileIdRefs: [
                    {
                        download_link: FAKE_IMAGE_URL,
                        id: 'file-abc123',
                        name: 'img.jpg',
                        mime_type: 'image/jpeg'
                    },
                    { download_link: 'https://example.com/other.jpg', id: 'file-def456' }
                ]
            };
            const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeOkResponse());

            // Act
            const result = await service.processImage({ image, actorId: MOCK_ACTOR_UUID });

            // Assert — only the first openaiFileIdRef is processed
            expect(fetchSpy).toHaveBeenCalledWith(FAKE_IMAGE_URL, expect.anything());
            expect(result.assetId).toBe(MOCK_ASSET_UUID);
            expect(result.cloudinaryUrl).not.toBeNull();
            expect(result.warnings).toHaveLength(0);
        });

        it('should pass source = CHATGPT_FILE to social_assets.create', async () => {
            // Arrange
            const image: GptImagePayload = {
                mode: 'openai_file_refs',
                openaiFileIdRefs: [{ download_link: FAKE_IMAGE_URL, id: 'file-abc123' }]
            };
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeOkResponse());

            // Act
            await service.processImage({ image });

            // Assert
            expect(assetModelMock.create).toHaveBeenCalledWith(
                expect.objectContaining({ source: SocialAssetSourceEnum.CHATGPT_FILE })
            );
        });

        it('should store the id in openaiFileRef column', async () => {
            // Arrange
            const image: GptImagePayload = {
                mode: 'openai_file_refs',
                openaiFileIdRefs: [{ download_link: FAKE_IMAGE_URL, id: 'file-abc123' }]
            };
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeOkResponse());

            // Act
            await service.processImage({ image });

            // Assert
            expect(assetModelMock.create).toHaveBeenCalledWith(
                expect.objectContaining({ openaiFileRef: 'file-abc123' })
            );
        });

        it('should return graceful failure when openaiFileIdRefs array is empty', async () => {
            // Arrange
            const image: GptImagePayload = {
                mode: 'openai_file_refs',
                openaiFileIdRefs: []
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

        it('should persist createdById as undefined when actorId is not a valid UUID (regression: gpt-action FK)', async () => {
            // Regression: `social_assets.created_by_id` is a uuid FK to `users`.
            // The GPT API-key actor id is the synthetic string 'gpt-action', which
            // is NOT a UUID — passing it caused the insert to fail with
            // "invalid input syntax for type uuid" and the asset row was lost.
            // Arrange
            const image: GptImagePayload = { mode: 'public_url', url: FAKE_IMAGE_URL };
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeOkResponse());

            // Act
            await service.processImage({ image, actorId: 'gpt-action' });

            // Assert
            expect(assetModelMock.create).toHaveBeenCalledWith(
                expect.objectContaining({ createdById: undefined })
            );
        });
    });

    // -------------------------------------------------------------------------
    // Settings-driven config (HOS-64 G-2)
    // -------------------------------------------------------------------------

    describe('settings-driven config', () => {
        it('uses a custom social_assets_folder from settings when uploading', async () => {
            // Arrange
            const uploadSpy = vi.spyOn(mediaProvider, 'upload');
            settingModelMock.findOne.mockImplementation(async (query: Record<string, unknown>) => {
                if (query.key === 'social_assets_folder') {
                    return { key: 'social_assets_folder', value: 'custom/folder/path' };
                }
                return undefined;
            });
            const image: GptImagePayload = { mode: 'public_url', url: FAKE_IMAGE_URL };
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeOkResponse());

            // Act
            await service.processImage({ image });

            // Assert
            expect(uploadSpy).toHaveBeenCalledWith(
                expect.objectContaining({ folder: 'custom/folder/path' })
            );
        });

        it('falls back to hospeda/social/assets when social_assets_folder is missing', async () => {
            // Arrange — beforeEach already leaves settingModelMock.findOne resolving undefined
            const uploadSpy = vi.spyOn(mediaProvider, 'upload');
            const image: GptImagePayload = { mode: 'public_url', url: FAKE_IMAGE_URL };
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeOkResponse());

            // Act
            await service.processImage({ image });

            // Assert
            expect(uploadSpy).toHaveBeenCalledWith(
                expect.objectContaining({ folder: 'hospeda/social/assets' })
            );
        });

        it('falls back to hospeda/social/assets when social_assets_folder is an empty string', async () => {
            // Arrange
            const uploadSpy = vi.spyOn(mediaProvider, 'upload');
            settingModelMock.findOne.mockImplementation(async (query: Record<string, unknown>) => {
                if (query.key === 'social_assets_folder') {
                    return { key: 'social_assets_folder', value: '' };
                }
                return undefined;
            });
            const image: GptImagePayload = { mode: 'public_url', url: FAKE_IMAGE_URL };
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeOkResponse());

            // Act
            await service.processImage({ image });

            // Assert
            expect(uploadSpy).toHaveBeenCalledWith(
                expect.objectContaining({ folder: 'hospeda/social/assets' })
            );
        });

        it('uses a custom download_timeout_ms from settings for the download abort timer', async () => {
            // Arrange
            const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
            settingModelMock.findOne.mockImplementation(async (query: Record<string, unknown>) => {
                if (query.key === 'download_timeout_ms') {
                    return { key: 'download_timeout_ms', value: '5000' };
                }
                return undefined;
            });
            const image: GptImagePayload = { mode: 'public_url', url: FAKE_IMAGE_URL };
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeOkResponse());

            // Act
            await service.processImage({ image });

            // Assert — the configured value (5000ms), not the hard-coded 15000ms default
            expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
        });

        it('falls back to the default 15000ms timeout when download_timeout_ms is missing', async () => {
            // Arrange — beforeEach already leaves settingModelMock.findOne resolving undefined
            const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
            const image: GptImagePayload = { mode: 'public_url', url: FAKE_IMAGE_URL };
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeOkResponse());

            // Act
            await service.processImage({ image });

            // Assert
            expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 15_000);
        });

        it('falls back to the default 15000ms timeout when download_timeout_ms is non-numeric', async () => {
            // Arrange
            const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
            settingModelMock.findOne.mockImplementation(async (query: Record<string, unknown>) => {
                if (query.key === 'download_timeout_ms') {
                    return { key: 'download_timeout_ms', value: 'not-a-number' };
                }
                return undefined;
            });
            const image: GptImagePayload = { mode: 'public_url', url: FAKE_IMAGE_URL };
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeOkResponse());

            // Act
            await service.processImage({ image });

            // Assert
            expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 15_000);
        });
    });

    // -------------------------------------------------------------------------
    // social_post_target_media link row (HOS-65 T-011)
    // -------------------------------------------------------------------------

    describe('processImage — social_post_target_media link (HOS-65 G-3)', () => {
        it('should create a social_post_target_media link row when socialPostTargetId is provided', async () => {
            // Arrange
            const image: GptImagePayload = { mode: 'public_url', url: FAKE_IMAGE_URL };
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeOkResponse());
            postMediaModelMock.create.mockResolvedValue(
                buildMockPostMediaRow({ id: 'media-row-uuid' })
            );

            // Act
            await service.processImage({
                image,
                socialPostId: MOCK_POST_UUID,
                socialPostTargetId: MOCK_TARGET_UUID
            });

            // Assert
            expect(postTargetMediaModelMock.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    socialPostTargetId: MOCK_TARGET_UUID,
                    socialPostMediaId: 'media-row-uuid',
                    position: 0
                })
            );
        });

        it('should NOT create a social_post_target_media link row when socialPostTargetId is absent', async () => {
            // Arrange
            const image: GptImagePayload = { mode: 'public_url', url: FAKE_IMAGE_URL };
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeOkResponse());

            // Act
            await service.processImage({ image, socialPostId: MOCK_POST_UUID });

            // Assert
            expect(postTargetMediaModelMock.create).not.toHaveBeenCalled();
        });

        it('should not attempt the link row when socialPostId is absent even if socialPostTargetId is provided', async () => {
            // Arrange — no social_post_media row is created without a socialPostId,
            // so there is no socialPostMediaId to link.
            const image: GptImagePayload = { mode: 'public_url', url: FAKE_IMAGE_URL };
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeOkResponse());

            // Act
            await service.processImage({ image, socialPostTargetId: MOCK_TARGET_UUID });

            // Assert
            expect(postMediaModelMock.create).not.toHaveBeenCalled();
            expect(postTargetMediaModelMock.create).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // processImages — N-asset pipeline (HOS-65 T-012)
    // -------------------------------------------------------------------------

    describe('processImages — N-asset pipeline (HOS-65 G-3)', () => {
        beforeEach(() => {
            // Each social_post_media.create call gets a distinct id keyed by its
            // requested position, so assertions can trace media rows to link rows.
            postMediaModelMock.create.mockImplementation(async (data: Record<string, unknown>) =>
                buildMockPostMediaRow({ id: `media-row-${data.position}`, ...data })
            );
        });

        it('processes a single asset (N=1) at position 0 with one link row', async () => {
            // Arrange
            const image: GptImagePayload = { mode: 'public_url', url: FAKE_IMAGE_URL };
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeOkResponse());

            // Act
            const results = await service.processImages([
                { image, socialPostId: MOCK_POST_UUID, socialPostTargetId: MOCK_TARGET_UUID }
            ]);

            // Assert
            expect(results).toHaveLength(1);
            expect(results[0]?.assetId).toBe(MOCK_ASSET_UUID);
            expect(postMediaModelMock.create).toHaveBeenCalledTimes(1);
            expect(postMediaModelMock.create).toHaveBeenCalledWith(
                expect.objectContaining({ position: 0 })
            );
            expect(postTargetMediaModelMock.create).toHaveBeenCalledTimes(1);
            expect(postTargetMediaModelMock.create).toHaveBeenCalledWith(
                expect.objectContaining({ socialPostMediaId: 'media-row-0', position: 0 })
            );
        });

        it('processes N=3 assets writing sequential positions 0/1/2 on media rows and link rows', async () => {
            // Arrange
            const images: GptImagePayload[] = [
                { mode: 'public_url', url: 'https://example.com/a.jpg' },
                { mode: 'public_url', url: 'https://example.com/b.jpg' },
                { mode: 'public_url', url: 'https://example.com/c.jpg' }
            ];
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeOkResponse());

            // Act
            const results = await service.processImages(
                images.map((image) => ({
                    image,
                    socialPostId: MOCK_POST_UUID,
                    socialPostTargetId: MOCK_TARGET_UUID
                }))
            );

            // Assert
            expect(results).toHaveLength(3);
            for (const result of results) {
                expect(result.assetId).toBe(MOCK_ASSET_UUID);
            }
            expect(postMediaModelMock.create).toHaveBeenCalledTimes(3);
            expect(postMediaModelMock.create).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({ position: 0 })
            );
            expect(postMediaModelMock.create).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({ position: 1 })
            );
            expect(postMediaModelMock.create).toHaveBeenNthCalledWith(
                3,
                expect.objectContaining({ position: 2 })
            );
            expect(postTargetMediaModelMock.create).toHaveBeenCalledTimes(3);
            expect(postTargetMediaModelMock.create).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({ socialPostMediaId: 'media-row-0', position: 0 })
            );
            expect(postTargetMediaModelMock.create).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({ socialPostMediaId: 'media-row-1', position: 1 })
            );
            expect(postTargetMediaModelMock.create).toHaveBeenNthCalledWith(
                3,
                expect.objectContaining({ socialPostMediaId: 'media-row-2', position: 2 })
            );
        });

        it('isolates a mid-array failure: siblings still succeed and no orphan link row is created for the failed asset', async () => {
            // Arrange — index 1's download fails, indices 0 and 2 succeed.
            const images: GptImagePayload[] = [
                { mode: 'public_url', url: 'https://example.com/a.jpg' },
                { mode: 'public_url', url: 'https://example.com/b.jpg' },
                { mode: 'public_url', url: 'https://example.com/c.jpg' }
            ];
            vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
                if (url === 'https://example.com/b.jpg') {
                    throw new Error('network error');
                }
                return makeOkResponse();
            });

            // Act
            const results = await service.processImages(
                images.map((image) => ({
                    image,
                    socialPostId: MOCK_POST_UUID,
                    socialPostTargetId: MOCK_TARGET_UUID
                }))
            );

            // Assert — siblings unaffected
            expect(results).toHaveLength(3);
            expect(results[0]?.assetId).toBe(MOCK_ASSET_UUID);
            expect(results[2]?.assetId).toBe(MOCK_ASSET_UUID);

            // Assert — failed asset returns the graceful-fail shape
            expect(results[1]?.assetId).toBeNull();
            expect(results[1]?.cloudinaryUrl).toBeNull();
            expect(results[1]?.warnings).toContain('Media upload failed; manual upload required');

            // Assert — only 2 media rows created (indices 0 and 2), no row for index 1
            expect(postMediaModelMock.create).toHaveBeenCalledTimes(2);
            expect(postMediaModelMock.create).toHaveBeenCalledWith(
                expect.objectContaining({ position: 0 })
            );
            expect(postMediaModelMock.create).toHaveBeenCalledWith(
                expect.objectContaining({ position: 2 })
            );
            expect(postMediaModelMock.create).not.toHaveBeenCalledWith(
                expect.objectContaining({ position: 1 })
            );

            // Assert — only 2 link rows created, no orphan link row for the failed asset
            expect(postTargetMediaModelMock.create).toHaveBeenCalledTimes(2);
            expect(postTargetMediaModelMock.create).not.toHaveBeenCalledWith(
                expect.objectContaining({ position: 1 })
            );
        });
    });

    // -------------------------------------------------------------------------
    // processVideo (HOS-65 T-013)
    // -------------------------------------------------------------------------

    describe('processVideo — public_url mode (HOS-65 G-3)', () => {
        const FAKE_VIDEO_URL = 'https://example.com/fake-video.mp4';

        it('persists a social_assets row with mediaType=VIDEO and durationSeconds set, plus a link row', async () => {
            // Arrange
            const video: GptVideoPayload = {
                mode: 'public_url',
                url: FAKE_VIDEO_URL,
                mimeType: 'video/mp4'
            };
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeOkResponse());
            vi.spyOn(mediaProvider, 'upload').mockResolvedValue({
                url: FAKE_CLOUDINARY_URL,
                publicId: 'hospeda/social/assets/generated-video-1',
                width: 1080,
                height: 1920,
                durationSeconds: 42
            });
            assetModelMock.create.mockResolvedValue(
                buildMockAssetRow({ mediaType: SocialMediaTypeEnum.VIDEO, durationSeconds: 42 })
            );

            // Act
            const result = await service.processVideo({
                video,
                socialPostId: MOCK_POST_UUID,
                socialPostTargetId: MOCK_TARGET_UUID,
                actorId: MOCK_ACTOR_UUID
            });

            // Assert — result shape
            expect(result.assetId).toBe(MOCK_ASSET_UUID);
            expect(result.cloudinaryUrl).not.toBeNull();
            expect(result.warnings).toHaveLength(0);

            // Assert — mediaType forced to VIDEO, durationSeconds persisted
            expect(assetModelMock.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    mediaType: SocialMediaTypeEnum.VIDEO,
                    durationSeconds: 42
                })
            );

            // Assert — link rows created (media + target-media)
            expect(postMediaModelMock.create).toHaveBeenCalledWith(
                expect.objectContaining({ socialPostId: MOCK_POST_UUID, position: 0 })
            );
            expect(postTargetMediaModelMock.create).toHaveBeenCalledWith(
                expect.objectContaining({ socialPostTargetId: MOCK_TARGET_UUID, position: 0 })
            );
        });

        it('returns the graceful-fail shape without throwing and without a link row when the download fails', async () => {
            // Arrange
            const video: GptVideoPayload = { mode: 'public_url', url: FAKE_VIDEO_URL };
            vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'));

            // Act
            const result = await service.processVideo({
                video,
                socialPostId: MOCK_POST_UUID,
                socialPostTargetId: MOCK_TARGET_UUID
            });

            // Assert
            expect(result.assetId).toBeNull();
            expect(result.cloudinaryUrl).toBeNull();
            expect(result.warnings).toContain('Media upload failed; manual upload required');
            expect(assetModelMock.create).not.toHaveBeenCalled();
            expect(postMediaModelMock.create).not.toHaveBeenCalled();
            expect(postTargetMediaModelMock.create).not.toHaveBeenCalled();
        });

        it('returns the graceful-fail shape without a link row when the Cloudinary upload fails', async () => {
            // Arrange
            const video: GptVideoPayload = { mode: 'public_url', url: FAKE_VIDEO_URL };
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeOkResponse());
            vi.spyOn(mediaProvider, 'upload').mockRejectedValue(new Error('Cloudinary error'));

            // Act
            const result = await service.processVideo({
                video,
                socialPostId: MOCK_POST_UUID,
                socialPostTargetId: MOCK_TARGET_UUID
            });

            // Assert
            expect(result.assetId).toBeNull();
            expect(result.cloudinaryUrl).toBeNull();
            expect(result.warnings).toContain('Media upload failed; manual upload required');
            expect(assetModelMock.create).not.toHaveBeenCalled();
            expect(postTargetMediaModelMock.create).not.toHaveBeenCalled();
        });
    });
});
