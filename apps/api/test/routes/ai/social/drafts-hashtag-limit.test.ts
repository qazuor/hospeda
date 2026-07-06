/**
 * Cross-platform hashtag-limit enforcement integration test — HOS-64 / SPEC-297a G-1.
 *
 * Drives the real route handler for POST /api/v1/ai/social/drafts (T-009's HTTP
 * mapping) against every `IngestionResult` shape the real
 * `SocialDraftIngestionService` (T-008) can produce for hashtag-limit checks,
 * covering all 3 platforms (Instagram/Facebook/X):
 *  - exactly-at-max → 201 accepted
 *  - one-over-max → 400 rejected (AC-1)
 *  - zero hashtags → 201 accepted
 *  - multi-platform draft, only one target over its limit → 400, only that
 *    platform's violation reported
 *
 * Follows the same handler-capture pattern as `social-drafts.test.ts` (route
 * factory + service are mocked at the module boundary; only the
 * `IngestionResult` returned by the mocked service varies per test) rather
 * than mocking every `@repo/db` model the real service constructs internally.
 *
 * @module test/routes/ai/social/drafts-hashtag-limit
 * @see HOS-64
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

type CapturedHandler = (
    ctx: unknown,
    params?: Record<string, unknown>,
    body?: Record<string, unknown>,
    query?: Record<string, unknown>
) => Promise<unknown>;

// ---------------------------------------------------------------------------
// Hoisted refs
// ---------------------------------------------------------------------------

const { capturedHandlers } = vi.hoisted(() => ({
    capturedHandlers: new Map<string, CapturedHandler>()
}));

const { mockIngestDraft, IngestionServiceMock, ImagePipelineMock, mockGetMediaProvider } =
    vi.hoisted(() => ({
        mockIngestDraft: vi.fn(),
        IngestionServiceMock: vi.fn().mockImplementation(function () {
            return {
                ingestDraft: mockIngestDraft
            };
        }),
        ImagePipelineMock: vi.fn().mockImplementation(function () {
            return { kind: 'image-pipeline' };
        }),
        mockGetMediaProvider: vi.fn()
    }));

vi.mock('@repo/service-core', () => ({
    SocialDraftIngestionService: IngestionServiceMock,
    SocialImagePipelineService: ImagePipelineMock
}));

vi.mock('../../../../src/services/media', () => ({
    getMediaProvider: mockGetMediaProvider
}));

vi.mock('../../../../src/utils/route-factory-tiered', () => ({
    createApiKeyRoute: vi.fn((config: { path: string; handler: CapturedHandler }) => {
        capturedHandlers.set(config.path, config.handler);
        return config.handler;
    })
}));

// The operator PIN check now reads from the social credentials vault
// (HOS-64 T-021) instead of env.HOSPEDA_OPERATOR_PIN.
const { mockGetDecryptedSocialCredential } = vi.hoisted(() => ({
    mockGetDecryptedSocialCredential: vi.fn()
}));

vi.mock('../../../../src/services/social-credential-vault.service.js', () => ({
    getDecryptedSocialCredential: mockGetDecryptedSocialCredential
}));

const TEST_PIN = 'test-pin-1234';
const TEST_AI_KEY = 'test-ai-secret-key';

vi.mock('../../../../src/utils/env', () => ({
    env: {
        HOSPEDA_AI_SOCIAL_KEY: TEST_AI_KEY
    }
}));

// ---------------------------------------------------------------------------
// Minimal context mock
// ---------------------------------------------------------------------------

function buildCtxMock() {
    const calls: Array<{ body: unknown; status: number }> = [];
    const ctx = {
        _calls: calls,
        json(body: unknown, status = 200) {
            calls.push({ body, status });
            return { __jsonResponse: true, body, status };
        },
        get(key: string) {
            if (key === 'actor') {
                return { id: 'gpt-action', name: 'Custom GPT Social Action', role: 'SYSTEM' };
            }
            return undefined;
        }
    };
    return ctx;
}

function buildBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        operatorPin: TEST_PIN,
        draftId: 'draft-uuid-hashtag-001',
        title: 'Test Social Post',
        captionBase: 'This is a test caption for social media.',
        targets: [{ platform: 'INSTAGRAM', publishFormat: 'FEED_POST' }],
        ...overrides
    };
}

function successResult(targetsCreated: number) {
    return {
        code: 'SUCCESS' as const,
        data: {
            postId: 'post-uuid-hashtag-001',
            draftId: 'draft-uuid-hashtag-001',
            status: 'NEEDS_REVIEW' as const,
            approvalStatus: 'PENDING' as const,
            targetsCreated,
            assetStatus: 'none' as const,
            warnings: []
        }
    };
}

function limitExceededResult(
    violations: Array<{ platform: string; count: number; max: number; excessBy: number }>
) {
    return {
        code: 'HASHTAG_LIMIT_EXCEEDED' as const,
        error: {
            message: 'Draft exceeds the configured hashtag limit for one or more target platforms',
            violations
        }
    };
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

let draftsHandler: CapturedHandler | undefined;

beforeEach(async () => {
    vi.clearAllMocks();
    capturedHandlers.clear();
    mockGetMediaProvider.mockReturnValue(null);
    mockGetDecryptedSocialCredential.mockResolvedValue({
        data: { key: 'operator_pin', plaintext: TEST_PIN }
    });

    await import('../../../../src/routes/ai/social/drafts');
    draftsHandler = capturedHandlers.get('/');
});

afterEach(() => {
    vi.resetModules();
    capturedHandlers.clear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/v1/ai/social/drafts — hashtag limit enforcement (all platforms)', () => {
    describe.each([
        { platform: 'INSTAGRAM', max: 30 },
        { platform: 'FACEBOOK', max: 10 },
        { platform: 'X', max: 5 }
    ])('$platform (max_hashtags = $max)', ({ platform, max }) => {
        it('accepts a draft exactly at the configured limit (201)', async () => {
            mockIngestDraft.mockResolvedValue(successResult(1));
            const ctx = buildCtxMock();

            const result = await draftsHandler!(
                ctx,
                {},
                buildBody({ targets: [{ platform, publishFormat: 'FEED_POST' }] }),
                {}
            );

            expect(ctx._calls).toHaveLength(0);
            expect(result).toMatchObject({ targetsCreated: 1 });
        });

        it('rejects a draft one over the configured limit (400, AC-1)', async () => {
            mockIngestDraft.mockResolvedValue(
                limitExceededResult([{ platform, count: max + 1, max, excessBy: 1 }])
            );
            const ctx = buildCtxMock();

            await draftsHandler!(
                ctx,
                {},
                buildBody({ targets: [{ platform, publishFormat: 'FEED_POST' }] }),
                {}
            );

            expect(ctx._calls).toHaveLength(1);
            expect(ctx._calls[0]?.status).toBe(400);
            const body = ctx._calls[0]?.body as {
                success: false;
                error: { code: string; details: unknown[] };
            };
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('HASHTAG_LIMIT_EXCEEDED');
            expect(body.error.details).toEqual([{ platform, count: max + 1, max, excessBy: 1 }]);
        });

        it('accepts a draft with zero hashtags (201)', async () => {
            mockIngestDraft.mockResolvedValue(successResult(1));
            const ctx = buildCtxMock();

            const result = await draftsHandler!(
                ctx,
                {},
                buildBody({
                    targets: [{ platform, publishFormat: 'FEED_POST' }],
                    curatedHashtags: [],
                    customHashtagSuggestions: []
                }),
                {}
            );

            expect(ctx._calls).toHaveLength(0);
            expect(result).toMatchObject({ targetsCreated: 1 });
        });
    });

    describe('multi-platform draft, only one target over its limit', () => {
        it('returns 400 reporting ONLY the violating platform', async () => {
            mockIngestDraft.mockResolvedValue(
                limitExceededResult([{ platform: 'X', count: 12, max: 5, excessBy: 7 }])
            );
            const ctx = buildCtxMock();

            await draftsHandler!(
                ctx,
                {},
                buildBody({
                    targets: [
                        { platform: 'INSTAGRAM', publishFormat: 'FEED_POST' },
                        { platform: 'X', publishFormat: 'TEXT_POST' }
                    ]
                }),
                {}
            );

            expect(ctx._calls).toHaveLength(1);
            expect(ctx._calls[0]?.status).toBe(400);
            const body = ctx._calls[0]?.body as {
                error: { details: Array<{ platform: string }> };
            };
            expect(body.error.details).toHaveLength(1);
            expect(body.error.details[0]?.platform).toBe('X');
        });
    });
});
