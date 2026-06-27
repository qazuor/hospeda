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

import {
    SocialApprovalStatusEnum,
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
import type { SocialImagePipelineService } from '../../../src/services/social/social-image-pipeline.service';
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
        processImage: vi.fn().mockResolvedValue(result)
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
        hashtagSetModel as never
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
    });
});
