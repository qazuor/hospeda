/**
 * Unit tests for SocialDraftIngestionService.
 *
 * All DB interactions are mocked — no real Postgres calls.
 * The image pipeline is stubbed via a minimal mock.
 *
 * Covers:
 * - Duplicate draftId → CONFLICT result
 * - Status override is always enforced (status=NEEDS_REVIEW, approvalStatus=PENDING, paused=false)
 * - Lenient hashtag validation: unknown hashtags → warnings, valid ones → post_hashtags rows created
 * - customHashtagSuggestions stored in gptHashtagPayloadJson, NOT linked via post_hashtags
 * - Zero valid targets → ZERO_VALID_TARGETS result
 * - Invalid target dropped → warning emitted, remaining valid targets proceed
 * - Image pipeline failure → draft still created, assetStatus='pending', warning added
 * - No image in payload → assetStatus='none', no pipeline call
 * - Audit row failure (social_ai_requests) → non-fatal, draft still returned SUCCESS
 * - Successful path: postId, draftId, status, approvalStatus, targetsCreated returned correctly
 *
 * SPEC-254 T-028.
 */

import { InMemoryImageProvider } from '@repo/media/test-utils';
import {
    SocialApprovalStatusEnum,
    SocialMediaTypeEnum,
    SocialPlatformEnum,
    SocialPostStatusEnum,
    SocialPublishFormatEnum,
    SocialSourceEnum
} from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import type {
    IngestDraftInput,
    IngestionResult
} from '../../../src/services/social/social-draft-ingestion.service';
import { SocialDraftIngestionService } from '../../../src/services/social/social-draft-ingestion.service';
import { SocialImagePipelineService as RealSocialImagePipelineService } from '../../../src/services/social/social-image-pipeline.service';
import type { SocialImagePipelineService } from '../../../src/services/social/social-image-pipeline.service';
import { SocialPublishDispatchService } from '../../../src/services/social/social-publish-dispatch.service';
import { createModelMock } from '../../utils/modelMockFactory';

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const POST_UUID = '00000000-0000-4000-8000-000000000001';
const HASHTAG_UUID = '00000000-0000-4000-8000-000000000002';
const PLATFORM_FORMAT_UUID = '00000000-0000-4000-8000-000000000003';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function buildPayload(
    overrides: Partial<IngestDraftInput['payload']> = {}
): IngestDraftInput['payload'] {
    return {
        operatorPin: '1234',
        draftId: 'gpt-draft-abc123',
        title: 'Test Post',
        captionBase: 'This is the caption',
        targets: [
            {
                platform: SocialPlatformEnum.INSTAGRAM,
                publishFormat: SocialPublishFormatEnum.FEED_POST
            }
        ],
        curatedHashtags: ['#playa'],
        customHashtagSuggestions: ['#novelTag'],
        notes: 'Some notes',
        ...overrides
    } as IngestDraftInput['payload'];
}

function buildPlatformFormatRow(overrides: Record<string, unknown> = {}) {
    return {
        id: PLATFORM_FORMAT_UUID,
        platform: 'INSTAGRAM',
        publishFormat: 'FEED_POST',
        mediaType: 'IMAGE',
        enabled: true,
        mvpEnabled: true,
        ...overrides
    };
}

function buildPostRow(overrides: Record<string, unknown> = {}) {
    return {
        id: POST_UUID,
        draftId: 'gpt-draft-abc123',
        title: 'Test Post',
        slug: 'test-post',
        source: SocialSourceEnum.CHATGPT,
        status: SocialPostStatusEnum.NEEDS_REVIEW,
        approvalStatus: SocialApprovalStatusEnum.PENDING,
        paused: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides
    };
}

function buildHashtagRow(overrides: Record<string, unknown> = {}) {
    return {
        id: HASHTAG_UUID,
        hashtag: '#playa',
        normalizedHashtag: '#playa',
        active: true,
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Minimal image pipeline mock
// ---------------------------------------------------------------------------

function buildImagePipelineMock(result: {
    assetId: string | null;
    cloudinaryUrl: string | null;
    warnings: string[];
}): SocialImagePipelineService {
    return {
        processImage: vi.fn().mockResolvedValue(result),
        // HOS-65 T-018: per-target dispatch also reaches for these two methods.
        // Stubbed here so existing single-image tests (which never call them)
        // keep working unmodified, and new per-target tests can override them.
        processImages: vi.fn().mockResolvedValue([result]),
        processVideo: vi.fn().mockResolvedValue(result)
    } as unknown as SocialImagePipelineService;
}

// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------

function buildService(
    overrides: {
        postModel?: ReturnType<typeof createModelMock>;
        postTargetModel?: ReturnType<typeof createModelMock>;
        postHashtagModel?: ReturnType<typeof createModelMock>;
        aiRequestModel?: ReturnType<typeof createModelMock>;
        hashtagModel?: ReturnType<typeof createModelMock>;
        platformFormatModel?: ReturnType<typeof createModelMock>;
        campaignModel?: ReturnType<typeof createModelMock>;
        batchModel?: ReturnType<typeof createModelMock>;
        audienceModel?: ReturnType<typeof createModelMock>;
        footerModel?: ReturnType<typeof createModelMock>;
        hashtagSetModel?: ReturnType<typeof createModelMock>;
        settingModel?: ReturnType<typeof createModelMock>;
        imagePipeline?: SocialImagePipelineService | null;
    } = {}
) {
    // Only create a new mock when the caller did NOT supply one.
    // If the caller supplied a model, honour whatever mocks it already has set —
    // do NOT overwrite them with defaults (that was the original bug that caused
    // CONFLICT / ZERO_VALID_TARGETS tests to silently pass through to SUCCESS).
    const postModel =
        overrides.postModel ??
        (() => {
            const m = createModelMock();
            m.findOne.mockResolvedValue(null);
            m.create.mockResolvedValue(buildPostRow());
            return m;
        })();
    const postTargetModel =
        overrides.postTargetModel ??
        (() => {
            const m = createModelMock();
            m.create.mockResolvedValue({ id: 'target-uuid' });
            return m;
        })();
    const postHashtagModel =
        overrides.postHashtagModel ??
        (() => {
            const m = createModelMock();
            m.create.mockResolvedValue({ id: 'hashtag-link-uuid' });
            return m;
        })();
    const aiRequestModel =
        overrides.aiRequestModel ??
        (() => {
            const m = createModelMock();
            m.create.mockResolvedValue({ id: 'ai-req-uuid' });
            return m;
        })();
    const hashtagModel =
        overrides.hashtagModel ??
        (() => {
            const m = createModelMock();
            m.findOne.mockResolvedValue(buildHashtagRow());
            return m;
        })();
    const platformFormatModel =
        overrides.platformFormatModel ??
        (() => {
            const m = createModelMock();
            m.findOne.mockResolvedValue(buildPlatformFormatRow());
            return m;
        })();
    const campaignModel =
        overrides.campaignModel ??
        (() => {
            const m = createModelMock();
            m.findOne.mockResolvedValue(null);
            return m;
        })();
    const batchModel =
        overrides.batchModel ??
        (() => {
            const m = createModelMock();
            m.findOne.mockResolvedValue(null);
            return m;
        })();
    const audienceModel =
        overrides.audienceModel ??
        (() => {
            const m = createModelMock();
            m.findOne.mockResolvedValue(null);
            return m;
        })();
    const footerModel =
        overrides.footerModel ??
        (() => {
            const m = createModelMock();
            m.findOne.mockResolvedValue(null);
            return m;
        })();
    const hashtagSetModel =
        overrides.hashtagSetModel ??
        (() => {
            const m = createModelMock();
            m.findOne.mockResolvedValue(null);
            return m;
        })();

    const settingModel =
        overrides.settingModel ??
        (() => {
            const m = createModelMock();
            // Empty by default — the service falls back to the same defaults
            // catalog.ts advertises to the GPT (30/10/5), so existing fixtures
            // (1 curated + 1 custom = 2 hashtags) stay well within limits.
            m.findAll.mockResolvedValue({ items: [] });
            return m;
        })();

    const imagePipeline =
        overrides.imagePipeline !== undefined
            ? overrides.imagePipeline
            : buildImagePipelineMock({
                  assetId: 'asset-uuid',
                  cloudinaryUrl: 'https://res.cloudinary.com/test/image/upload/v1/test.jpg',
                  warnings: []
              });

    return new SocialDraftIngestionService(
        {},
        imagePipeline ?? undefined,
        postModel as never,
        postTargetModel as never,
        postHashtagModel as never,
        aiRequestModel as never,
        hashtagModel as never,
        platformFormatModel as never,
        campaignModel as never,
        batchModel as never,
        audienceModel as never,
        footerModel as never,
        hashtagSetModel as never,
        settingModel as never
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SocialDraftIngestionService.ingestDraft', () => {
    // --- Duplicate draftId ---

    describe('when a post with the same draftId already exists', () => {
        it('should return CONFLICT result', async () => {
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(buildPostRow());

            const service = buildService({ postModel });
            const result = await service.ingestDraft({
                payload: buildPayload(),
                actorId: 'actor-id'
            });

            expect(result.code).toBe('CONFLICT');
        });

        it('should not create any DB rows on CONFLICT', async () => {
            const postModel = createModelMock();
            const postTargetModel = createModelMock();
            postModel.findOne.mockResolvedValue(buildPostRow());

            const service = buildService({ postModel, postTargetModel });
            await service.ingestDraft({ payload: buildPayload(), actorId: 'actor-id' });

            expect(postTargetModel.create).not.toHaveBeenCalled();
        });
    });

    // --- Status override ---

    describe('status override (hard rule)', () => {
        it('should always create post with status=NEEDS_REVIEW regardless of payload', async () => {
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(null);
            postModel.create.mockResolvedValue(buildPostRow());
            const platformFormatModel = createModelMock();
            platformFormatModel.findOne.mockResolvedValue(buildPlatformFormatRow());

            const service = buildService({ postModel, platformFormatModel });
            await service.ingestDraft({ payload: buildPayload(), actorId: 'actor-id' });

            const createCall = postModel.create.mock.calls[0]?.[0];
            expect(createCall?.status).toBe(SocialPostStatusEnum.NEEDS_REVIEW);
            expect(createCall?.approvalStatus).toBe(SocialApprovalStatusEnum.PENDING);
            expect(createCall?.paused).toBe(false);
        });
    });

    // --- Hashtag handling ---

    describe('lenient hashtag validation', () => {
        it('should create post_hashtags rows for known hashtags', async () => {
            const postHashtagModel = createModelMock();
            postHashtagModel.create.mockResolvedValue({ id: 'ph-uuid' });
            const hashtagModel = createModelMock();
            hashtagModel.findOne.mockResolvedValue(buildHashtagRow());

            const service = buildService({ postHashtagModel, hashtagModel });
            const result = await service.ingestDraft({
                payload: buildPayload({ curatedHashtags: ['#playa'] }),
                actorId: 'actor-id'
            });

            expect(result.code).toBe('SUCCESS');
            expect(postHashtagModel.create).toHaveBeenCalledOnce();
        });

        it('should drop unknown hashtags and add a warning', async () => {
            const hashtagModel = createModelMock();
            // #unknown is not in catalog
            hashtagModel.findOne.mockResolvedValue(null);

            const service = buildService({ hashtagModel });
            const result = (await service.ingestDraft({
                payload: buildPayload({ curatedHashtags: ['#unknown'] }),
                actorId: 'actor-id'
            })) as Extract<IngestionResult, { code: 'SUCCESS' }>;

            expect(result.code).toBe('SUCCESS');
            const warn = result.data.warnings.find((w) => w.field === 'curatedHashtags');
            expect(warn).toBeDefined();
            expect(warn?.message).toContain('#unknown');
        });

        it('should NOT link customHashtagSuggestions via post_hashtags', async () => {
            const postHashtagModel = createModelMock();
            postHashtagModel.create.mockResolvedValue({ id: 'ph-uuid' });
            const hashtagModel = createModelMock();
            // Make curatedHashtags empty so no post_hashtags rows from that path
            hashtagModel.findOne.mockResolvedValue(null);

            const service = buildService({ postHashtagModel, hashtagModel });
            await service.ingestDraft({
                payload: buildPayload({
                    curatedHashtags: [],
                    customHashtagSuggestions: ['#termasCDU', '#litoral2026']
                }),
                actorId: 'actor-id'
            });

            expect(postHashtagModel.create).not.toHaveBeenCalled();
        });

        it('should store customHashtagSuggestions in gptHashtagPayloadJson', async () => {
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(null);
            postModel.create.mockResolvedValue(buildPostRow());
            const hashtagModel = createModelMock();
            hashtagModel.findOne.mockResolvedValue(null);
            const platformFormatModel = createModelMock();
            platformFormatModel.findOne.mockResolvedValue(buildPlatformFormatRow());

            const service = buildService({ postModel, hashtagModel, platformFormatModel });
            await service.ingestDraft({
                payload: buildPayload({
                    curatedHashtags: [],
                    customHashtagSuggestions: ['#termasCDU']
                }),
                actorId: 'actor-id'
            });

            const createCall = postModel.create.mock.calls[0]?.[0];
            expect(createCall?.gptHashtagPayloadJson).toEqual(['#termasCDU']);
        });
    });

    // --- Target validation ---

    describe('target validation', () => {
        it('should return ZERO_VALID_TARGETS when no enabled format matches any target', async () => {
            const platformFormatModel = createModelMock();
            // All targets disabled
            platformFormatModel.findOne.mockResolvedValue(null);

            const service = buildService({ platformFormatModel });
            const result = await service.ingestDraft({
                payload: buildPayload({
                    targets: [
                        {
                            platform: SocialPlatformEnum.INSTAGRAM,
                            publishFormat: SocialPublishFormatEnum.REEL
                        }
                    ]
                }),
                actorId: 'actor-id'
            });

            expect(result.code).toBe('ZERO_VALID_TARGETS');
        });

        it('should include warnings for rejected targets', async () => {
            const platformFormatModel = createModelMock();
            platformFormatModel.findOne.mockResolvedValue(null);

            const service = buildService({ platformFormatModel });
            const result = (await service.ingestDraft({
                payload: buildPayload(),
                actorId: 'actor-id'
            })) as Extract<IngestionResult, { code: 'ZERO_VALID_TARGETS' }>;

            expect(result.error.warnings.length).toBeGreaterThan(0);
            expect(result.error.warnings[0]?.field).toMatch(/targets/);
        });

        it('should drop invalid target but proceed with remaining valid targets', async () => {
            const platformFormatModel = createModelMock();
            // INSTAGRAM/FEED_POST enabled, FACEBOOK/PHOTO_POST not
            platformFormatModel.findOne.mockImplementation(
                async (where: Record<string, unknown>) => {
                    if (where.platform === 'INSTAGRAM') return buildPlatformFormatRow();
                    return null;
                }
            );

            const service = buildService({ platformFormatModel });
            const result = (await service.ingestDraft({
                payload: buildPayload({
                    targets: [
                        {
                            platform: SocialPlatformEnum.INSTAGRAM,
                            publishFormat: SocialPublishFormatEnum.FEED_POST
                        },
                        {
                            platform: SocialPlatformEnum.FACEBOOK,
                            publishFormat: SocialPublishFormatEnum.PHOTO_POST
                        }
                    ]
                }),
                actorId: 'actor-id'
            })) as Extract<IngestionResult, { code: 'SUCCESS' }>;

            expect(result.code).toBe('SUCCESS');
            expect(result.data.targetsCreated).toBe(1);
            const warn = result.data.warnings.find((w) => w.field.startsWith('targets['));
            expect(warn).toBeDefined();
        });
    });

    // --- Image pipeline ---

    describe('image pipeline', () => {
        it('should return assetStatus=none when no image in payload', async () => {
            const imagePipeline = buildImagePipelineMock({
                assetId: null,
                cloudinaryUrl: null,
                warnings: []
            });

            const service = buildService({ imagePipeline });
            const result = (await service.ingestDraft({
                payload: buildPayload({ image: undefined }),
                actorId: 'actor-id'
            })) as Extract<IngestionResult, { code: 'SUCCESS' }>;

            expect(result.code).toBe('SUCCESS');
            expect(result.data.assetStatus).toBe('none');
            expect(imagePipeline.processImage).not.toHaveBeenCalled();
        });

        it('should return assetStatus=uploaded when image pipeline succeeds', async () => {
            const imagePipeline = buildImagePipelineMock({
                assetId: 'asset-uuid',
                cloudinaryUrl: 'https://res.cloudinary.com/test/image/upload/v1/test.jpg',
                warnings: []
            });

            const service = buildService({ imagePipeline });
            const result = (await service.ingestDraft({
                payload: buildPayload({
                    image: { mode: 'public_url', url: 'https://example.com/img.jpg' }
                }),
                actorId: 'actor-id'
            })) as Extract<IngestionResult, { code: 'SUCCESS' }>;

            expect(result.code).toBe('SUCCESS');
            expect(result.data.assetStatus).toBe('uploaded');
        });

        it('should still create draft when image pipeline fails (graceful degradation)', async () => {
            const imagePipeline = buildImagePipelineMock({
                assetId: null,
                cloudinaryUrl: null,
                warnings: ['Media upload failed; manual upload required']
            });

            const service = buildService({ imagePipeline });
            const result = (await service.ingestDraft({
                payload: buildPayload({
                    image: { mode: 'public_url', url: 'https://example.com/broken.jpg' }
                }),
                actorId: 'actor-id'
            })) as Extract<IngestionResult, { code: 'SUCCESS' }>;

            // Draft is created even when media upload fails
            expect(result.code).toBe('SUCCESS');
            expect(result.data.assetStatus).toBe('pending');
            // Warning from the image pipeline is merged into draft warnings
            const imageWarn = result.data.warnings.find((w) => w.field === 'image');
            expect(imageWarn).toBeDefined();
        });

        it('should thread root openaiFileIdRefs into the image pipeline for openai_file_refs mode', async () => {
            // Arrange — root-level openaiFileIdRefs (injected by OpenAI at the request body root)
            const imagePipeline = buildImagePipelineMock({
                assetId: 'asset-uuid',
                cloudinaryUrl: 'https://res.cloudinary.com/test/image/upload/v1/ai.jpg',
                warnings: []
            });
            const mockProcessImage = imagePipeline.processImage as ReturnType<typeof vi.fn>;

            const service = buildService({ imagePipeline });
            await service.ingestDraft({
                payload: buildPayload({
                    image: { mode: 'openai_file_refs' },
                    // openaiFileIdRefs lives at payload ROOT (not inside image)
                    openaiFileIdRefs: [
                        {
                            download_link: 'https://files.oaiusercontent.com/fake.jpg',
                            id: 'file-abc123'
                        }
                    ]
                }),
                actorId: 'actor-id'
            });

            // Assert — processImage must be called with openaiFileIdRefs merged in
            expect(mockProcessImage).toHaveBeenCalledOnce();
            const callArg = mockProcessImage.mock.calls[0]?.[0] as {
                image: { mode: string; openaiFileIdRefs: unknown[] };
            };
            expect(callArg.image.mode).toBe('openai_file_refs');
            expect(callArg.image.openaiFileIdRefs).toHaveLength(1);
            expect(
                (callArg.image.openaiFileIdRefs[0] as { download_link: string }).download_link
            ).toBe('https://files.oaiusercontent.com/fake.jpg');
        });
    });

    // --- Per-target media dispatch (HOS-65 T-018) ---

    describe('per-target media dispatch (HOS-65 T-018)', () => {
        /** Returns a distinct `social_post_targets` row id for each successive call. */
        function buildSequentialPostTargetModel() {
            const m = createModelMock();
            let callCount = 0;
            m.create.mockImplementation(async () => {
                callCount += 1;
                return { id: `target-${callCount}` };
            });
            return m;
        }

        it('scopes each target own assets to its own dispatch — no cross-target leak', async () => {
            const platformFormatModel = createModelMock();
            platformFormatModel.findOne.mockImplementation(
                async (where: Record<string, unknown>) => {
                    if (where.platform === SocialPlatformEnum.INSTAGRAM) {
                        return buildPlatformFormatRow({
                            platform: 'INSTAGRAM',
                            publishFormat: 'FEED_POST',
                            mediaType: 'IMAGE'
                        });
                    }
                    if (where.platform === SocialPlatformEnum.FACEBOOK) {
                        return buildPlatformFormatRow({
                            platform: 'FACEBOOK',
                            publishFormat: 'PHOTO_POST',
                            mediaType: 'IMAGE'
                        });
                    }
                    return null;
                }
            );
            const postTargetModel = buildSequentialPostTargetModel();
            const imagePipeline = buildImagePipelineMock({
                assetId: 'asset-uuid',
                cloudinaryUrl: 'https://res.cloudinary.com/test/image/upload/v1/test.jpg',
                warnings: []
            });

            const service = buildService({ platformFormatModel, postTargetModel, imagePipeline });
            const result = (await service.ingestDraft({
                payload: buildPayload({
                    targets: [
                        {
                            platform: SocialPlatformEnum.INSTAGRAM,
                            publishFormat: SocialPublishFormatEnum.FEED_POST,
                            assets: [
                                { image: { mode: 'public_url', url: 'https://example.com/a.jpg' } }
                            ]
                        },
                        {
                            platform: SocialPlatformEnum.FACEBOOK,
                            publishFormat: SocialPublishFormatEnum.PHOTO_POST,
                            assets: [
                                { image: { mode: 'public_url', url: 'https://example.com/b.jpg' } }
                            ]
                        }
                    ]
                }),
                actorId: 'actor-id'
            })) as Extract<IngestionResult, { code: 'SUCCESS' }>;

            expect(result.code).toBe('SUCCESS');
            const processImageMock = imagePipeline.processImage as ReturnType<typeof vi.fn>;
            expect(processImageMock).toHaveBeenCalledTimes(2);

            const callForA = processImageMock.mock.calls.find(
                (call) =>
                    (call[0] as { image: { url?: string } }).image.url ===
                    'https://example.com/a.jpg'
            );
            const callForB = processImageMock.mock.calls.find(
                (call) =>
                    (call[0] as { image: { url?: string } }).image.url ===
                    'https://example.com/b.jpg'
            );

            expect(callForA?.[0]).toMatchObject({ socialPostTargetId: 'target-1' });
            expect(callForB?.[0]).toMatchObject({ socialPostTargetId: 'target-2' });
        });

        it('applies the legacy root image fallback to every IMAGE-needing target when none carry their own assets', async () => {
            const platformFormatModel = createModelMock();
            platformFormatModel.findOne.mockImplementation(
                async (where: Record<string, unknown>) => {
                    if (where.platform === SocialPlatformEnum.INSTAGRAM) {
                        return buildPlatformFormatRow({
                            platform: 'INSTAGRAM',
                            publishFormat: 'FEED_POST',
                            mediaType: 'IMAGE'
                        });
                    }
                    if (where.platform === SocialPlatformEnum.FACEBOOK) {
                        return buildPlatformFormatRow({
                            platform: 'FACEBOOK',
                            publishFormat: 'PHOTO_POST',
                            mediaType: 'IMAGE'
                        });
                    }
                    return null;
                }
            );
            const postTargetModel = buildSequentialPostTargetModel();
            const imagePipeline = buildImagePipelineMock({
                assetId: 'asset-uuid',
                cloudinaryUrl: 'https://res.cloudinary.com/test/image/upload/v1/test.jpg',
                warnings: []
            });

            const service = buildService({ platformFormatModel, postTargetModel, imagePipeline });
            const result = (await service.ingestDraft({
                payload: buildPayload({
                    targets: [
                        {
                            platform: SocialPlatformEnum.INSTAGRAM,
                            publishFormat: SocialPublishFormatEnum.FEED_POST
                        },
                        {
                            platform: SocialPlatformEnum.FACEBOOK,
                            publishFormat: SocialPublishFormatEnum.PHOTO_POST
                        }
                    ],
                    image: { mode: 'public_url', url: 'https://example.com/legacy.jpg' }
                }),
                actorId: 'actor-id'
            })) as Extract<IngestionResult, { code: 'SUCCESS' }>;

            expect(result.code).toBe('SUCCESS');
            const processImageMock = imagePipeline.processImage as ReturnType<typeof vi.fn>;
            expect(processImageMock).toHaveBeenCalledTimes(2);
            expect(processImageMock).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({
                    image: expect.objectContaining({ url: 'https://example.com/legacy.jpg' }),
                    socialPostTargetId: 'target-1'
                })
            );
            expect(processImageMock).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({
                    image: expect.objectContaining({ url: 'https://example.com/legacy.jpg' }),
                    socialPostTargetId: 'target-2'
                })
            );
        });

        it('dispatches zero media calls for a TEXT_POST/NONE target even with a legacy root image present', async () => {
            const platformFormatModel = createModelMock();
            platformFormatModel.findOne.mockResolvedValue(
                buildPlatformFormatRow({
                    platform: 'X',
                    publishFormat: 'TEXT_POST',
                    mediaType: 'NONE'
                })
            );
            const imagePipeline = buildImagePipelineMock({
                assetId: null,
                cloudinaryUrl: null,
                warnings: []
            });

            const service = buildService({ platformFormatModel, imagePipeline });
            const result = (await service.ingestDraft({
                payload: buildPayload({
                    targets: [
                        {
                            platform: SocialPlatformEnum.X,
                            publishFormat: SocialPublishFormatEnum.TEXT_POST
                        }
                    ],
                    image: { mode: 'public_url', url: 'https://example.com/legacy.jpg' }
                }),
                actorId: 'actor-id'
            })) as Extract<IngestionResult, { code: 'SUCCESS' }>;

            expect(result.code).toBe('SUCCESS');
            expect(result.data.assetStatus).toBe('none');
            expect(imagePipeline.processImage).not.toHaveBeenCalled();
            expect(imagePipeline.processImages).not.toHaveBeenCalled();
            expect(imagePipeline.processVideo).not.toHaveBeenCalled();
        });
    });

    // --- Audit row failure ---

    describe('social_ai_requests audit row', () => {
        it('should return SUCCESS even when audit row creation fails', async () => {
            const aiRequestModel = createModelMock();
            aiRequestModel.create.mockRejectedValue(new Error('DB constraint violation'));

            const service = buildService({ aiRequestModel });
            const result = await service.ingestDraft({
                payload: buildPayload(),
                actorId: 'actor-id'
            });

            // Audit failure is non-fatal
            expect(result.code).toBe('SUCCESS');
        });
    });

    // --- Success path ---

    describe('successful ingestion', () => {
        it('should return correct postId, draftId, status, approvalStatus, and targetsCreated', async () => {
            const service = buildService();
            const result = (await service.ingestDraft({
                payload: buildPayload(),
                actorId: 'actor-id'
            })) as Extract<IngestionResult, { code: 'SUCCESS' }>;

            expect(result.code).toBe('SUCCESS');
            expect(result.data.postId).toBe(POST_UUID);
            expect(result.data.draftId).toBe('gpt-draft-abc123');
            expect(result.data.status).toBe('NEEDS_REVIEW');
            expect(result.data.approvalStatus).toBe('PENDING');
            expect(result.data.targetsCreated).toBe(1);
        });

        it('should create one post_targets row per valid target', async () => {
            const postTargetModel = createModelMock();
            postTargetModel.create.mockResolvedValue({ id: 'target-uuid' });
            const platformFormatModel = createModelMock();
            platformFormatModel.findOne.mockResolvedValue(buildPlatformFormatRow());

            const service = buildService({ postTargetModel, platformFormatModel });
            await service.ingestDraft({
                payload: buildPayload({
                    targets: [
                        {
                            platform: SocialPlatformEnum.INSTAGRAM,
                            publishFormat: SocialPublishFormatEnum.FEED_POST
                        }
                    ]
                }),
                actorId: 'actor-id'
            });

            expect(postTargetModel.create).toHaveBeenCalledOnce();
        });

        it('should create exactly 3 social_post_targets rows for a draft with 3 valid targets (AC-3 fan-out, HOS-65 T-022)', async () => {
            const postTargetModel = createModelMock();
            let callCount = 0;
            postTargetModel.create.mockImplementation(async () => {
                callCount += 1;
                return { id: `target-${callCount}` };
            });
            const platformFormatModel = createModelMock();
            platformFormatModel.findOne.mockResolvedValue(buildPlatformFormatRow());

            const service = buildService({ postTargetModel, platformFormatModel });
            const result = (await service.ingestDraft({
                payload: buildPayload({
                    targets: [
                        {
                            platform: SocialPlatformEnum.INSTAGRAM,
                            publishFormat: SocialPublishFormatEnum.FEED_POST
                        },
                        {
                            platform: SocialPlatformEnum.FACEBOOK,
                            publishFormat: SocialPublishFormatEnum.PHOTO_POST
                        },
                        {
                            platform: SocialPlatformEnum.X,
                            publishFormat: SocialPublishFormatEnum.TEXT_POST
                        }
                    ]
                }),
                actorId: 'actor-id'
            })) as Extract<IngestionResult, { code: 'SUCCESS' }>;

            expect(result.code).toBe('SUCCESS');
            expect(result.data.targetsCreated).toBe(3);
            expect(postTargetModel.create).toHaveBeenCalledTimes(3);
        });
    });

    // --- Campaign/batch resolve-or-create (HOS-66 T-001, G-4/G-5) ---

    describe('campaign/batch resolve-or-create', () => {
        const NEW_CAMPAIGN_UUID = '00000000-0000-4000-8000-000000000010';
        const EXISTING_CAMPAIGN_UUID = '00000000-0000-4000-8000-000000000011';
        const NEW_BATCH_UUID = '00000000-0000-4000-8000-000000000020';
        const EXISTING_BATCH_UUID = '00000000-0000-4000-8000-000000000021';

        it('creates a new active campaign when campaignSlug has no match, and associates the post', async () => {
            const campaignModel = createModelMock();
            campaignModel.findOne.mockResolvedValue(null);
            campaignModel.create.mockResolvedValue({
                id: NEW_CAMPAIGN_UUID,
                slug: 'lanzamiento-2026',
                name: 'Lanzamiento 2026',
                active: true
            });
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(null);
            postModel.create.mockResolvedValue(buildPostRow());

            const service = buildService({ campaignModel, postModel });
            const result = await service.ingestDraft({
                payload: buildPayload({ campaignSlug: 'lanzamiento-2026' }),
                actorId: 'actor-id'
            });

            expect(result.code).toBe('SUCCESS');
            expect(campaignModel.create).toHaveBeenCalledOnce();
            expect(campaignModel.create).toHaveBeenCalledWith(
                expect.objectContaining({ slug: 'lanzamiento-2026', active: true })
            );
            const createCall = postModel.create.mock.calls[0]?.[0];
            expect(createCall?.campaignId).toBe(NEW_CAMPAIGN_UUID);
        });

        it('does not create a campaign when campaignSlug matches an existing row', async () => {
            const campaignModel = createModelMock();
            campaignModel.findOne.mockResolvedValue({
                id: EXISTING_CAMPAIGN_UUID,
                slug: 'institucional-hospeda',
                name: 'Institucional Hospeda',
                active: true
            });
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(null);
            postModel.create.mockResolvedValue(buildPostRow());

            const service = buildService({ campaignModel, postModel });
            await service.ingestDraft({
                payload: buildPayload({ campaignSlug: 'institucional-hospeda' }),
                actorId: 'actor-id'
            });

            expect(campaignModel.create).not.toHaveBeenCalled();
            const createCall = postModel.create.mock.calls[0]?.[0];
            expect(createCall?.campaignId).toBe(EXISTING_CAMPAIGN_UUID);
        });

        it('creates a new active batch when batchSlug has no match, and associates the post', async () => {
            const batchModel = createModelMock();
            batchModel.findOne.mockResolvedValue(null);
            batchModel.create.mockResolvedValue({
                id: NEW_BATCH_UUID,
                slug: 'hospeda-launch-2026-06',
                name: 'Hospeda Launch 2026 06',
                active: true
            });
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(null);
            postModel.create.mockResolvedValue(buildPostRow());

            const service = buildService({ batchModel, postModel });
            const result = await service.ingestDraft({
                payload: buildPayload({ batchSlug: 'hospeda-launch-2026-06' }),
                actorId: 'actor-id'
            });

            expect(result.code).toBe('SUCCESS');
            expect(batchModel.create).toHaveBeenCalledOnce();
            expect(batchModel.create).toHaveBeenCalledWith(
                expect.objectContaining({ slug: 'hospeda-launch-2026-06', active: true })
            );
            const createCall = postModel.create.mock.calls[0]?.[0];
            expect(createCall?.batchId).toBe(NEW_BATCH_UUID);
        });

        it('does not create a batch when batchSlug matches an existing row', async () => {
            const batchModel = createModelMock();
            batchModel.findOne.mockResolvedValue({
                id: EXISTING_BATCH_UUID,
                slug: 'hospeda-launch-2026-06',
                name: 'Hospeda Launch 2026 06',
                active: true
            });
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(null);
            postModel.create.mockResolvedValue(buildPostRow());

            const service = buildService({ batchModel, postModel });
            await service.ingestDraft({
                payload: buildPayload({ batchSlug: 'hospeda-launch-2026-06' }),
                actorId: 'actor-id'
            });

            expect(batchModel.create).not.toHaveBeenCalled();
            const createCall = postModel.create.mock.calls[0]?.[0];
            expect(createCall?.batchId).toBe(EXISTING_BATCH_UUID);
        });

        it('echoes campaignResolution/batchResolution with isNew=true on the response when both are newly created (HOS-66 T-002)', async () => {
            const campaignModel = createModelMock();
            campaignModel.findOne.mockResolvedValue(null);
            campaignModel.create.mockResolvedValue({
                id: NEW_CAMPAIGN_UUID,
                slug: 'lanzamiento-2026',
                name: 'Lanzamiento 2026',
                active: true
            });
            const batchModel = createModelMock();
            batchModel.findOne.mockResolvedValue(null);
            batchModel.create.mockResolvedValue({
                id: NEW_BATCH_UUID,
                slug: 'hospeda-launch-2026-06',
                name: 'Hospeda Launch 2026 06',
                active: true
            });

            const service = buildService({ campaignModel, batchModel });
            const result = (await service.ingestDraft({
                payload: buildPayload({
                    campaignSlug: 'lanzamiento-2026',
                    batchSlug: 'hospeda-launch-2026-06'
                }),
                actorId: 'actor-id'
            })) as Extract<IngestionResult, { code: 'SUCCESS' }>;

            expect(result.code).toBe('SUCCESS');
            expect(result.data.campaignResolution).toEqual({
                id: NEW_CAMPAIGN_UUID,
                slug: 'lanzamiento-2026',
                isNew: true
            });
            expect(result.data.batchResolution).toEqual({
                id: NEW_BATCH_UUID,
                slug: 'hospeda-launch-2026-06',
                isNew: true
            });
        });

        it('echoes campaignResolution/batchResolution with isNew=false when both match existing rows (HOS-66 T-002)', async () => {
            const campaignModel = createModelMock();
            campaignModel.findOne.mockResolvedValue({
                id: EXISTING_CAMPAIGN_UUID,
                slug: 'institucional-hospeda',
                name: 'Institucional Hospeda',
                active: true
            });
            const batchModel = createModelMock();
            batchModel.findOne.mockResolvedValue({
                id: EXISTING_BATCH_UUID,
                slug: 'hospeda-launch-2026-06',
                name: 'Hospeda Launch 2026 06',
                active: true
            });

            const service = buildService({ campaignModel, batchModel });
            const result = (await service.ingestDraft({
                payload: buildPayload({
                    campaignSlug: 'institucional-hospeda',
                    batchSlug: 'hospeda-launch-2026-06'
                }),
                actorId: 'actor-id'
            })) as Extract<IngestionResult, { code: 'SUCCESS' }>;

            expect(result.data.campaignResolution).toEqual({
                id: EXISTING_CAMPAIGN_UUID,
                slug: 'institucional-hospeda',
                isNew: false
            });
            expect(result.data.batchResolution).toEqual({
                id: EXISTING_BATCH_UUID,
                slug: 'hospeda-launch-2026-06',
                isNew: false
            });
        });

        it('returns null campaignResolution/batchResolution when neither slug was submitted (HOS-66 T-002)', async () => {
            const service = buildService();
            const result = (await service.ingestDraft({
                payload: buildPayload(),
                actorId: 'actor-id'
            })) as Extract<IngestionResult, { code: 'SUCCESS' }>;

            expect(result.data.campaignResolution).toBeNull();
            expect(result.data.batchResolution).toBeNull();
        });

        it('REGRESSION: audienceSlug/footerSlug/baseHashtagSetSlug stay resolve-only (never create)', async () => {
            const audienceModel = createModelMock();
            audienceModel.findOne.mockResolvedValue(null);
            const footerModel = createModelMock();
            footerModel.findOne.mockResolvedValue(null);
            const hashtagSetModel = createModelMock();
            hashtagSetModel.findOne.mockResolvedValue(null);
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(null);
            postModel.create.mockResolvedValue(buildPostRow());

            const service = buildService({
                audienceModel,
                footerModel,
                hashtagSetModel,
                postModel
            });
            const result = await service.ingestDraft({
                payload: buildPayload({
                    audienceSlug: 'unknown-audience',
                    footerSlug: 'unknown-footer',
                    baseHashtagSetSlug: 'unknown-set'
                }),
                actorId: 'actor-id'
            });

            expect(result.code).toBe('SUCCESS');
            expect(audienceModel.create).not.toHaveBeenCalled();
            expect(footerModel.create).not.toHaveBeenCalled();
            expect(hashtagSetModel.create).not.toHaveBeenCalled();
            const createCall = postModel.create.mock.calls[0]?.[0];
            expect(createCall?.audienceId).toBeUndefined();
            expect(createCall?.footerId).toBeUndefined();
            expect(createCall?.baseHashtagSetId).toBeUndefined();
        });
    });

    // --- Hashtag limit enforcement (HOS-64 / SPEC-297a G-1) ---

    describe('hashtag limit enforcement', () => {
        function buildSettingModelWithMaxHashtagsX(max: number) {
            const m = createModelMock();
            m.findAll.mockResolvedValue({
                items: [{ key: 'max_hashtags_x', value: String(max) }]
            });
            return m;
        }

        it('REGRESSION (AC-2): rejects a draft whose total hashtag count exceeds the configured max_hashtags_x', async () => {
            const settingModel = buildSettingModelWithMaxHashtagsX(5);
            const postTargetModel = createModelMock();
            postTargetModel.create.mockResolvedValue({ id: 'target-uuid' });

            const service = buildService({ settingModel, postTargetModel });
            const result = await service.ingestDraft({
                payload: buildPayload({
                    targets: [
                        {
                            platform: SocialPlatformEnum.X,
                            publishFormat: SocialPublishFormatEnum.TEXT_POST
                        }
                    ],
                    // 6 total hashtags (curated + custom) — one over the configured max of 5.
                    curatedHashtags: ['#uno', '#dos', '#tres'],
                    customHashtagSuggestions: ['#cuatro', '#cinco', '#seis']
                }),
                actorId: 'actor-id'
            });

            expect(result.code).toBe('HASHTAG_LIMIT_EXCEEDED');
            // Before the fix this draft was silently ingested (code === 'SUCCESS').
            expect(postTargetModel.create).not.toHaveBeenCalled();
        });

        it('accepts a draft exactly at the configured limit', async () => {
            const settingModel = buildSettingModelWithMaxHashtagsX(5);
            const service = buildService({ settingModel });

            const result = await service.ingestDraft({
                payload: buildPayload({
                    targets: [
                        {
                            platform: SocialPlatformEnum.X,
                            publishFormat: SocialPublishFormatEnum.TEXT_POST
                        }
                    ],
                    curatedHashtags: ['#uno', '#dos', '#tres'],
                    customHashtagSuggestions: ['#cuatro', '#cinco']
                }),
                actorId: 'actor-id'
            });

            expect(result.code).toBe('SUCCESS');
        });

        it('rejects when only ONE of several target platforms exceeds its limit', async () => {
            const settingModel = createModelMock();
            settingModel.findAll.mockResolvedValue({
                items: [
                    { key: 'max_hashtags_x', value: '5' },
                    { key: 'max_hashtags_instagram', value: '30' }
                ]
            });
            const platformFormatModel = createModelMock();
            platformFormatModel.findOne.mockResolvedValue(buildPlatformFormatRow());

            const service = buildService({ settingModel, platformFormatModel });
            const result = await service.ingestDraft({
                payload: buildPayload({
                    targets: [
                        {
                            platform: SocialPlatformEnum.INSTAGRAM,
                            publishFormat: SocialPublishFormatEnum.FEED_POST
                        },
                        {
                            platform: SocialPlatformEnum.X,
                            publishFormat: SocialPublishFormatEnum.TEXT_POST
                        }
                    ],
                    // 6 hashtags: fine for Instagram (max 30), over the limit for X (max 5).
                    curatedHashtags: ['#uno', '#dos', '#tres'],
                    customHashtagSuggestions: ['#cuatro', '#cinco', '#seis']
                }),
                actorId: 'actor-id'
            });

            expect(result.code).toBe('HASHTAG_LIMIT_EXCEEDED');
        });

        it('falls back to the catalog.ts defaults (30/10/5) when no setting row exists', async () => {
            const settingModel = createModelMock();
            settingModel.findAll.mockResolvedValue({ items: [] });

            const service = buildService({ settingModel });
            const result = await service.ingestDraft({
                payload: buildPayload({
                    targets: [
                        {
                            platform: SocialPlatformEnum.X,
                            publishFormat: SocialPublishFormatEnum.TEXT_POST
                        }
                    ],
                    curatedHashtags: ['#uno', '#dos', '#tres', '#cuatro', '#cinco'],
                    customHashtagSuggestions: ['#seis']
                }),
                actorId: 'actor-id'
            });

            // Default max_hashtags_x is 5 (catalog.ts) — 6 submitted hashtags exceed it.
            expect(result.code).toBe('HASHTAG_LIMIT_EXCEEDED');
        });

        it('HOS-65 FIX 4: rejects a LINKEDIN draft that exceeds the default max of 5 hashtags', async () => {
            // Before the fix, `maxByPlatform` was built from a hardcoded
            // Instagram/Facebook/X literal, so LINKEDIN (and TIKTOK) had no
            // configured max and `checkHashtagLimits` silently skipped them.
            const platformFormatModel = createModelMock();
            platformFormatModel.findOne.mockResolvedValue(
                buildPlatformFormatRow({
                    platform: 'LINKEDIN',
                    publishFormat: 'TEXT_POST',
                    mediaType: 'NONE'
                })
            );
            // Empty settings → LinkedIn falls back to the default max of 5.
            const service = buildService({ platformFormatModel });

            const result = await service.ingestDraft({
                payload: buildPayload({
                    targets: [
                        {
                            platform: SocialPlatformEnum.LINKEDIN,
                            publishFormat: SocialPublishFormatEnum.TEXT_POST
                        }
                    ],
                    // 6 total hashtags — one over LinkedIn's default max of 5.
                    curatedHashtags: ['#uno', '#dos', '#tres', '#cuatro', '#cinco', '#seis'],
                    customHashtagSuggestions: []
                }),
                actorId: 'actor-id'
            });

            expect(result.code).toBe('HASHTAG_LIMIT_EXCEEDED');
            if (result.code !== 'HASHTAG_LIMIT_EXCEEDED') throw new Error('expected rejection');
            expect(
                result.error.violations.some((v) => v.platform === SocialPlatformEnum.LINKEDIN)
            ).toBe(true);
        });

        it('HOS-65 FIX 4: rejects a TIKTOK draft that exceeds the default max of 5 hashtags', async () => {
            const platformFormatModel = createModelMock();
            platformFormatModel.findOne.mockResolvedValue(
                buildPlatformFormatRow({
                    platform: 'TIKTOK',
                    publishFormat: 'VIDEO_POST',
                    mediaType: 'VIDEO'
                })
            );
            const service = buildService({ platformFormatModel });

            const result = await service.ingestDraft({
                payload: buildPayload({
                    targets: [
                        {
                            platform: SocialPlatformEnum.TIKTOK,
                            publishFormat: SocialPublishFormatEnum.VIDEO_POST
                        }
                    ],
                    curatedHashtags: ['#uno', '#dos', '#tres', '#cuatro', '#cinco', '#seis'],
                    customHashtagSuggestions: []
                }),
                actorId: 'actor-id'
            });

            expect(result.code).toBe('HASHTAG_LIMIT_EXCEEDED');
            if (result.code !== 'HASHTAG_LIMIT_EXCEEDED') throw new Error('expected rejection');
            expect(
                result.error.violations.some((v) => v.platform === SocialPlatformEnum.TIKTOK)
            ).toBe(true);
        });

        it('does not create any DB rows when the hashtag limit is exceeded', async () => {
            const settingModel = buildSettingModelWithMaxHashtagsX(5);
            const postModel = createModelMock();
            postModel.findOne.mockResolvedValue(null);
            postModel.create.mockResolvedValue(buildPostRow());
            const aiRequestModel = createModelMock();
            aiRequestModel.create.mockResolvedValue({ id: 'ai-req-uuid' });

            const service = buildService({ settingModel, postModel, aiRequestModel });
            await service.ingestDraft({
                payload: buildPayload({
                    targets: [
                        {
                            platform: SocialPlatformEnum.X,
                            publishFormat: SocialPublishFormatEnum.TEXT_POST
                        }
                    ],
                    curatedHashtags: ['#uno', '#dos', '#tres', '#cuatro', '#cinco', '#seis']
                }),
                actorId: 'actor-id'
            });

            expect(postModel.create).not.toHaveBeenCalled();
            expect(aiRequestModel.create).not.toHaveBeenCalled();
        });
    });
});

// ---------------------------------------------------------------------------
// HOS-65 T-023/T-024/T-026: full-chain verification harness
//
// These tests are DELIBERATELY different from the scripted-mock tests above:
// they wire a REAL `SocialImagePipelineService` and a REAL
// `SocialPublishDispatchService` to STATEFUL in-memory fake models (not
// `vi.fn().mockResolvedValue(...)` mocks with canned return values). The
// pipeline's writes and the dispatch service's reads share the SAME store
// instances, so a genuine wiring bug (wrong id threaded through, wrong filter
// key, a format not mapped) surfaces as a real query miss/assertion failure —
// not a scripted mock silently papering over it. No real DB or network is
// used (fetch and the Cloudinary upload are the only mocked/faked I/O).
// ---------------------------------------------------------------------------

interface FakeCrudRow extends Record<string, unknown> {
    id: string;
}

/**
 * Minimal, STATEFUL in-memory fake for a `BaseModelImpl`-shaped CRUD model
 * (`create`/`findOne`/`findAll`). See the file-level comment above for why
 * this exists instead of a scripted mock.
 */
function createFakeCrudModel<T extends FakeCrudRow>() {
    const store = new Map<string, T>();
    let counter = 0;

    function matches(row: T, where: Record<string, unknown>): boolean {
        return Object.entries(where).every(([key, value]) => row[key] === value);
    }

    return {
        async create(data: Partial<T>): Promise<T> {
            counter += 1;
            const id = (data.id as string | undefined) ?? `fake-${counter}`;
            const row = { ...data, id } as T;
            store.set(id, row);
            return row;
        },
        async findOne(where: Record<string, unknown>): Promise<T | null> {
            for (const row of store.values()) {
                if (matches(row, where)) return row;
            }
            return null;
        },
        async findAll(
            where: Record<string, unknown>,
            options?: { sortBy?: string; sortOrder?: 'asc' | 'desc' }
        ): Promise<{ items: T[]; total: number }> {
            let items = Array.from(store.values()).filter((row) => matches(row, where));
            if (options?.sortBy) {
                const sortKey = options.sortBy;
                const dir = options.sortOrder === 'desc' ? -1 : 1;
                items = [...items].sort((a, b) => {
                    const aVal = a[sortKey];
                    const bVal = b[sortKey];
                    if (typeof aVal === 'number' && typeof bVal === 'number') {
                        return (aVal - bVal) * dir;
                    }
                    return 0;
                });
            }
            return { items, total: items.length };
        }
    };
}

/**
 * Builds a REAL `SocialImagePipelineService` and a REAL
 * `SocialPublishDispatchService`, sharing the same fake
 * assetModel/postMediaModel/postTargetMediaModel stores between them. The
 * dispatch service's `platformFormatModel.findOne` is seeded from
 * `platformFormatRows` (looked up by `id`, matching `buildMakePayload`'s real
 * query shape: `{ id: target.platformFormatId }`).
 */
function buildFullChainHarness(platformFormatRows: Array<Record<string, unknown>>) {
    const assetModel = createFakeCrudModel<FakeCrudRow>();
    const postMediaModel = createFakeCrudModel<FakeCrudRow>();
    const postTargetMediaModel = createFakeCrudModel<FakeCrudRow>();

    const pipelineSettingModel = createModelMock();
    pipelineSettingModel.findOne.mockResolvedValue(undefined);

    const mediaProvider = new InMemoryImageProvider({ cloudName: 'test-cloud' });

    const realPipeline = new RealSocialImagePipelineService(
        {},
        mediaProvider as never,
        assetModel as never,
        postMediaModel as never,
        pipelineSettingModel as never,
        postTargetMediaModel as never
    );

    const dispatchPlatformFormatModel = createModelMock();
    dispatchPlatformFormatModel.findOne.mockImplementation(
        async (where: Record<string, unknown>) =>
            platformFormatRows.find((row) => row.id === where.id) ?? null
    );

    const dispatchService = new SocialPublishDispatchService(
        { logger: undefined },
        createModelMock() as never, // postModel — buildMakePayload receives `post` directly
        createModelMock() as never, // targetModel — buildMakePayload receives `target` directly
        postMediaModel as never,
        dispatchPlatformFormatModel as never,
        createModelMock() as never, // footerModel — unused when post.footerId is null
        assetModel as never,
        createModelMock() as never, // publishLogModel — unused by buildMakePayload
        createModelMock() as never, // settingModel — unused by buildMakePayload
        { log: vi.fn() } as never, // auditLog — unused by buildMakePayload
        postTargetMediaModel as never
    );

    return {
        realPipeline,
        dispatchService,
        assetModel,
        postMediaModel,
        postTargetMediaModel,
        mediaProvider
    };
}

describe('HOS-65 end-to-end verification (T-023/T-024/T-026)', () => {
    const STORY_PLATFORM_FORMAT_ID = 'pf-instagram-story';
    const FEED_PLATFORM_FORMAT_ID = 'pf-facebook-feed';
    const LINKEDIN_VIDEO_PLATFORM_FORMAT_ID = 'pf-linkedin-video';
    const CAROUSEL_PLATFORM_FORMAT_ID = 'pf-instagram-carousel';

    // Mirrors the real seeded rows (T-010, packages/seed/src/required/socialAutomation.seed.ts).
    const PLATFORM_FORMAT_ROWS = [
        {
            id: STORY_PLATFORM_FORMAT_ID,
            platform: 'INSTAGRAM',
            publishFormat: 'STORY',
            mediaType: 'IMAGE',
            makeChannelKey: 'instagram_story_image',
            enabled: true
        },
        {
            id: FEED_PLATFORM_FORMAT_ID,
            platform: 'FACEBOOK',
            publishFormat: 'FEED_POST',
            mediaType: 'IMAGE',
            makeChannelKey: 'facebook_feed_image',
            enabled: true
        },
        {
            id: LINKEDIN_VIDEO_PLATFORM_FORMAT_ID,
            platform: 'LINKEDIN',
            publishFormat: 'VIDEO_POST',
            mediaType: 'VIDEO',
            makeChannelKey: 'linkedin_video_video',
            enabled: true
        },
        {
            id: CAROUSEL_PLATFORM_FORMAT_ID,
            platform: 'INSTAGRAM',
            publishFormat: 'CAROUSEL',
            mediaType: 'IMAGE',
            makeChannelKey: 'instagram_carousel_image',
            enabled: true
        }
    ];

    /** Ingestion-side platform-format lookup — queried by `{platform, publishFormat, enabled}`. */
    function buildIngestionPlatformFormatModel(rows: Array<Record<string, unknown>>) {
        const m = createModelMock();
        m.findOne.mockImplementation(
            async (where: Record<string, unknown>) =>
                rows.find(
                    (row) =>
                        row.platform === where.platform && row.publishFormat === where.publishFormat
                ) ?? null
        );
        return m;
    }

    /** Sequential-id `social_post_targets` mock, keyed for later lookup by publishFormat. */
    function buildSequentialPostTargetModel() {
        const m = createModelMock();
        let counter = 0;
        const idByFormat: Record<string, string> = {};
        m.create.mockImplementation(async (data: Record<string, unknown>) => {
            counter += 1;
            const id = `target-${counter}`;
            idByFormat[data.publishFormat as string] = id;
            return { id };
        });
        return { model: m, idByFormat };
    }

    it('T-023: STORY end-to-end publish + media isolation from a co-target of a different format', async () => {
        // Arrange
        vi.spyOn(globalThis, 'fetch').mockImplementation(
            async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })
        );

        const harness = buildFullChainHarness(PLATFORM_FORMAT_ROWS);
        const { model: postTargetModel, idByFormat } = buildSequentialPostTargetModel();

        const service = buildService({
            imagePipeline: harness.realPipeline,
            platformFormatModel: buildIngestionPlatformFormatModel(PLATFORM_FORMAT_ROWS),
            postTargetModel
        });

        const STORY_IMAGE_URL = 'https://example.com/story.jpg';
        const FEED_IMAGE_URL = 'https://example.com/feed.jpg';

        // Act — ingest a draft with a STORY target (own asset) and a FEED_POST
        // co-target of a DIFFERENT format (own, different asset) on the same post.
        const result = (await service.ingestDraft({
            payload: buildPayload({
                targets: [
                    {
                        platform: SocialPlatformEnum.INSTAGRAM,
                        publishFormat: SocialPublishFormatEnum.STORY,
                        assets: [{ image: { mode: 'public_url', url: STORY_IMAGE_URL } }]
                    },
                    {
                        platform: SocialPlatformEnum.FACEBOOK,
                        publishFormat: SocialPublishFormatEnum.FEED_POST,
                        assets: [{ image: { mode: 'public_url', url: FEED_IMAGE_URL } }]
                    }
                ]
            }),
            actorId: 'actor-id'
        })) as Extract<IngestionResult, { code: 'SUCCESS' }>;

        expect(result.code).toBe('SUCCESS');
        expect(result.data.assetStatus).toBe('uploaded');

        const storyTargetId = idByFormat.STORY;
        const feedTargetId = idByFormat.FEED_POST;
        expect(storyTargetId).toBeDefined();
        expect(feedTargetId).toBeDefined();

        // Assert — the pipeline persisted a social_assets row (mediaType=IMAGE)
        // AND a social_post_target_media link row scoped SPECIFICALLY to the
        // STORY target — not to the FEED_POST co-target.
        const storyLinkRows = (
            await harness.postTargetMediaModel.findAll({ socialPostTargetId: storyTargetId })
        ).items;
        expect(storyLinkRows).toHaveLength(1);

        const storyMediaRow = await harness.postMediaModel.findOne({
            id: storyLinkRows[0]?.socialPostMediaId
        });
        expect(storyMediaRow).not.toBeNull();

        const storyAsset = await harness.assetModel.findOne({ id: storyMediaRow?.assetId });
        expect(storyAsset?.mediaType).toBe(SocialMediaTypeEnum.IMAGE);
        expect(storyAsset?.originalUrl).toBe(STORY_IMAGE_URL);
        const storyCloudinaryUrl = storyAsset?.cloudinaryUrl as string;
        expect(storyCloudinaryUrl).toBeTruthy();

        const feedLinkRows = (
            await harness.postTargetMediaModel.findAll({ socialPostTargetId: feedTargetId })
        ).items;
        expect(feedLinkRows).toHaveLength(1);
        const feedMediaRow = await harness.postMediaModel.findOne({
            id: feedLinkRows[0]?.socialPostMediaId
        });
        const feedAsset = await harness.assetModel.findOne({ id: feedMediaRow?.assetId });
        const feedCloudinaryUrl = feedAsset?.cloudinaryUrl as string;
        expect(feedCloudinaryUrl).toBeTruthy();
        expect(feedCloudinaryUrl).not.toBe(storyCloudinaryUrl);

        // Assert — buildMakePayload resolves exactly 1 mediaUrl for the STORY
        // target, and it is the STORY asset's own URL (never the FEED_POST one).
        const postRow = {
            id: result.data.postId,
            finalCaption: null,
            captionBase: 'Caption',
            finalHashtagsText: null,
            footerId: null,
            scheduledAt: null,
            timezone: 'UTC'
        };
        const storyTargetRow = {
            id: storyTargetId,
            platformFormatId: STORY_PLATFORM_FORMAT_ID,
            platform: 'INSTAGRAM',
            publishFormat: 'STORY'
        };
        const feedTargetRow = {
            id: feedTargetId,
            platformFormatId: FEED_PLATFORM_FORMAT_ID,
            platform: 'FACEBOOK',
            publishFormat: 'FEED_POST'
        };

        const { payload: storyPayload } = await harness.dispatchService.buildMakePayload({
            target: storyTargetRow,
            post: postRow
        });
        expect(storyPayload.mediaUrls).toEqual([storyCloudinaryUrl]);
        expect(storyPayload.mediaUrls).not.toContain(feedCloudinaryUrl);

        // Assert — the FEED_POST co-target does NOT receive the STORY asset.
        const { payload: feedPayload } = await harness.dispatchService.buildMakePayload({
            target: feedTargetRow,
            post: postRow
        });
        expect(feedPayload.mediaUrls).toEqual([feedCloudinaryUrl]);
        expect(feedPayload.mediaUrls).not.toContain(storyCloudinaryUrl);
    });

    it('T-024: VIDEO_POST end-to-end publish on LinkedIn', async () => {
        // Arrange
        vi.spyOn(globalThis, 'fetch').mockImplementation(
            async () => new Response(new Uint8Array([1, 2, 3, 4, 5]), { status: 200 })
        );

        const harness = buildFullChainHarness(PLATFORM_FORMAT_ROWS);
        // Cloudinary reports a duration WITHIN the VIDEO_POST limit (60s) — this
        // exercises the actual preset-consultation path (HOS-65 T-021) rather
        // than merely asserting a hardcoded value; a duration OVER the limit is
        // already covered as a dedicated rejection test in
        // social-image-pipeline.service.test.ts (HOS-65 T-021).
        const VIDEO_DURATION_SECONDS = 45;
        vi.spyOn(harness.mediaProvider, 'upload').mockResolvedValue({
            url: 'https://res.cloudinary.com/test-cloud/video/upload/v1/linkedin-clip',
            publicId: 'linkedin-clip',
            width: 1920,
            height: 1080,
            durationSeconds: VIDEO_DURATION_SECONDS
        });

        const { model: postTargetModel, idByFormat } = buildSequentialPostTargetModel();

        const service = buildService({
            imagePipeline: harness.realPipeline,
            platformFormatModel: buildIngestionPlatformFormatModel(PLATFORM_FORMAT_ROWS),
            postTargetModel
        });

        const VIDEO_URL = 'https://example.com/linkedin-clip.mp4';

        // Act — ingest a draft with a single VIDEO_POST target on LinkedIn
        // carrying its own video asset.
        const result = (await service.ingestDraft({
            payload: buildPayload({
                targets: [
                    {
                        platform: SocialPlatformEnum.LINKEDIN,
                        publishFormat: SocialPublishFormatEnum.VIDEO_POST,
                        assets: [{ video: { mode: 'public_url', url: VIDEO_URL } }]
                    }
                ]
            }),
            actorId: 'actor-id'
        })) as Extract<IngestionResult, { code: 'SUCCESS' }>;

        expect(result.code).toBe('SUCCESS');
        expect(result.data.assetStatus).toBe('uploaded');

        const videoTargetId = idByFormat.VIDEO_POST;
        expect(videoTargetId).toBeDefined();

        // Assert — processVideo persisted the asset with mediaType=VIDEO and the
        // duration reported from the (mocked) Cloudinary response — proving the
        // VIDEO_POST preset was consulted (HOS-65 T-021) and did not incorrectly
        // reject a within-limits video.
        const linkRows = (
            await harness.postTargetMediaModel.findAll({ socialPostTargetId: videoTargetId })
        ).items;
        expect(linkRows).toHaveLength(1);
        const mediaRow = await harness.postMediaModel.findOne({
            id: linkRows[0]?.socialPostMediaId
        });
        expect(mediaRow).not.toBeNull();
        const asset = await harness.assetModel.findOne({ id: mediaRow?.assetId });
        expect(asset?.mediaType).toBe(SocialMediaTypeEnum.VIDEO);
        expect(asset?.durationSeconds).toBe(VIDEO_DURATION_SECONDS);
        expect(asset?.originalUrl).toBe(VIDEO_URL);
        const videoCloudinaryUrl = asset?.cloudinaryUrl as string;
        expect(videoCloudinaryUrl).toBeTruthy();

        // Assert — buildMakePayload resolves exactly 1 mediaUrl (the video),
        // and the target resolves against the LinkedIn VIDEO_POST platform-format
        // row (T-010) via its makeChannelKey.
        const postRow = {
            id: result.data.postId,
            finalCaption: null,
            captionBase: 'Caption',
            finalHashtagsText: null,
            footerId: null,
            scheduledAt: null,
            timezone: 'UTC'
        };
        const videoTargetRow = {
            id: videoTargetId,
            platformFormatId: LINKEDIN_VIDEO_PLATFORM_FORMAT_ID,
            platform: 'LINKEDIN',
            publishFormat: 'VIDEO_POST'
        };

        const { payload } = await harness.dispatchService.buildMakePayload({
            target: videoTargetRow,
            post: postRow
        });

        expect(payload.mediaUrls).toEqual([videoCloudinaryUrl]);
        expect(payload.makeChannelKey).toBe('linkedin_video_video');
        expect(payload.platform).toBe('LINKEDIN');
    });

    it('T-026: media isolation across co-targets of different formats (CAROUSEL N-assets vs STORY 1-asset)', async () => {
        // Arrange
        vi.spyOn(globalThis, 'fetch').mockImplementation(
            async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })
        );

        const harness = buildFullChainHarness(PLATFORM_FORMAT_ROWS);
        const { model: postTargetModel, idByFormat } = buildSequentialPostTargetModel();

        const service = buildService({
            imagePipeline: harness.realPipeline,
            platformFormatModel: buildIngestionPlatformFormatModel(PLATFORM_FORMAT_ROWS),
            postTargetModel
        });

        const CAROUSEL_URLS = [
            'https://example.com/carousel-a.jpg',
            'https://example.com/carousel-b.jpg',
            'https://example.com/carousel-c.jpg'
        ];
        const STORY_URL = 'https://example.com/vertical-story.jpg';

        // Act — ingest a draft with a CAROUSEL target (3 images) and a STORY
        // co-target (1 vertical image) on the same post.
        const result = (await service.ingestDraft({
            payload: buildPayload({
                targets: [
                    {
                        platform: SocialPlatformEnum.INSTAGRAM,
                        publishFormat: SocialPublishFormatEnum.CAROUSEL,
                        assets: CAROUSEL_URLS.map((url) => ({
                            image: { mode: 'public_url' as const, url }
                        }))
                    },
                    {
                        platform: SocialPlatformEnum.INSTAGRAM,
                        publishFormat: SocialPublishFormatEnum.STORY,
                        assets: [{ image: { mode: 'public_url', url: STORY_URL } }]
                    }
                ]
            }),
            actorId: 'actor-id'
        })) as Extract<IngestionResult, { code: 'SUCCESS' }>;

        expect(result.code).toBe('SUCCESS');

        const carouselTargetId = idByFormat.CAROUSEL;
        const storyTargetId = idByFormat.STORY;
        expect(carouselTargetId).toBeDefined();
        expect(storyTargetId).toBeDefined();

        const postRow = {
            id: result.data.postId,
            finalCaption: null,
            captionBase: 'Caption',
            finalHashtagsText: null,
            footerId: null,
            scheduledAt: null,
            timezone: 'UTC'
        };
        const carouselTargetRow = {
            id: carouselTargetId,
            platformFormatId: CAROUSEL_PLATFORM_FORMAT_ID,
            platform: 'INSTAGRAM',
            publishFormat: 'CAROUSEL'
        };
        const storyTargetRow = {
            id: storyTargetId,
            platformFormatId: STORY_PLATFORM_FORMAT_ID,
            platform: 'INSTAGRAM',
            publishFormat: 'STORY'
        };

        // Assert — the CAROUSEL target resolves exactly its own 3 URLs, in order,
        // and none of the STORY sibling's asset.
        const { payload: carouselPayload } = await harness.dispatchService.buildMakePayload({
            target: carouselTargetRow,
            post: postRow
        });
        expect(carouselPayload.mediaUrls).toHaveLength(3);

        // Assert — the STORY target resolves exactly its own 1 URL, and none of
        // the CAROUSEL sibling's assets.
        const { payload: storyPayload } = await harness.dispatchService.buildMakePayload({
            target: storyTargetRow,
            post: postRow
        });
        expect(storyPayload.mediaUrls).toHaveLength(1);

        // Cross-check by ORIGINAL source URL (originalUrl, preserved verbatim by
        // the pipeline) rather than the synthesized Cloudinary URL, since the
        // InMemoryImageProvider assigns cloudinary URLs by upload order, not by
        // target — this is the only way to unambiguously attribute each
        // resolved mediaUrl back to the asset it came from.
        async function cloudinaryUrlForOriginal(originalUrl: string): Promise<string> {
            const { items: assets } = await harness.assetModel.findAll({ originalUrl });
            expect(assets).toHaveLength(1);
            return assets[0]?.cloudinaryUrl as string;
        }

        const carouselCloudinaryUrls = await Promise.all(
            CAROUSEL_URLS.map((url) => cloudinaryUrlForOriginal(url))
        );
        const storyCloudinaryUrl = await cloudinaryUrlForOriginal(STORY_URL);

        expect(carouselPayload.mediaUrls).toEqual(carouselCloudinaryUrls);
        expect(carouselPayload.mediaUrls).not.toContain(storyCloudinaryUrl);
        expect(storyPayload.mediaUrls).toEqual([storyCloudinaryUrl]);
        for (const url of carouselCloudinaryUrls) {
            expect(storyPayload.mediaUrls).not.toContain(url);
        }
    });

    it('T-026 follow-up: a partial mid-carousel upload failure leaves a position GAP that buildMakePayload still resolves correctly, in order (no crash, no off-by-one)', async () => {
        // Arrange — this directly probes the position-gap concern: processImages
        // (HOS-65 T-012) numbers `social_post_target_media.position` by each
        // asset's ORIGINAL array index, not by a renumbered successful-only
        // count. If the middle of 3 carousel assets fails to download, the
        // surviving link rows land at position 0 and 2 (position 1 is a GAP,
        // never created) — buildMakePayload's CAROUSEL resolution must still
        // return exactly the 2 survivors, correctly ordered, unaffected by the gap.
        const OK_URL_0 = 'https://example.com/gap-a.jpg';
        const FAILING_URL_1 = 'https://example.com/gap-b-fails.jpg';
        const OK_URL_2 = 'https://example.com/gap-c.jpg';

        vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
            if (String(input) === FAILING_URL_1) {
                throw new Error('simulated network failure for the middle carousel asset');
            }
            return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
        });

        const harness = buildFullChainHarness(PLATFORM_FORMAT_ROWS);
        const { model: postTargetModel, idByFormat } = buildSequentialPostTargetModel();

        const service = buildService({
            imagePipeline: harness.realPipeline,
            platformFormatModel: buildIngestionPlatformFormatModel(PLATFORM_FORMAT_ROWS),
            postTargetModel
        });

        // Act
        const result = (await service.ingestDraft({
            payload: buildPayload({
                targets: [
                    {
                        platform: SocialPlatformEnum.INSTAGRAM,
                        publishFormat: SocialPublishFormatEnum.CAROUSEL,
                        assets: [OK_URL_0, FAILING_URL_1, OK_URL_2].map((url) => ({
                            image: { mode: 'public_url' as const, url }
                        }))
                    }
                ]
            }),
            actorId: 'actor-id'
        })) as Extract<IngestionResult, { code: 'SUCCESS' }>;

        expect(result.code).toBe('SUCCESS');
        // The overall draft still reports uploaded (2 of 3 assets succeeded) —
        // graceful degradation, per the pipeline's per-asset isolation contract.
        expect(result.data.assetStatus).toBe('uploaded');
        // One warning surfaces for the failed middle asset.
        expect(result.data.warnings.some((w) => w.field === 'image')).toBe(true);

        const carouselTargetId = idByFormat.CAROUSEL;
        expect(carouselTargetId).toBeDefined();

        // Assert — exactly 2 link rows exist (position 1 is a genuine gap, never created)
        const linkRows = (
            await harness.postTargetMediaModel.findAll({ socialPostTargetId: carouselTargetId })
        ).items;
        expect(linkRows).toHaveLength(2);
        const positions = linkRows.map((row) => row.position).sort();
        expect(positions).toEqual([0, 2]);

        // Assert — buildMakePayload still resolves exactly the 2 survivors, in
        // the correct relative order (position 0's asset before position 2's),
        // despite the gap.
        const postRow = {
            id: result.data.postId,
            finalCaption: null,
            captionBase: 'Caption',
            finalHashtagsText: null,
            footerId: null,
            scheduledAt: null,
            timezone: 'UTC'
        };
        const carouselTargetRow = {
            id: carouselTargetId,
            platformFormatId: CAROUSEL_PLATFORM_FORMAT_ID,
            platform: 'INSTAGRAM',
            publishFormat: 'CAROUSEL'
        };

        const { payload } = await harness.dispatchService.buildMakePayload({
            target: carouselTargetRow,
            post: postRow
        });

        expect(payload.mediaUrls).toHaveLength(2);

        const asset0 = (await harness.assetModel.findAll({ originalUrl: OK_URL_0 })).items[0];
        const asset2 = (await harness.assetModel.findAll({ originalUrl: OK_URL_2 })).items[0];
        expect(payload.mediaUrls).toEqual([asset0?.cloudinaryUrl, asset2?.cloudinaryUrl]);
    });
});
