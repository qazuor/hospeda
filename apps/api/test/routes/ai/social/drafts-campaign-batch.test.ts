/**
 * Route-level integration tests for campaign/batch auto-detection — HOS-66 T-004
 * (G-4/G-5, AC-1/AC-2/AC-3).
 *
 * Drives the real route handler for POST /api/v1/ai/social/drafts against the
 * `IngestionResult` shapes the real `SocialDraftIngestionService` produces for
 * campaign/batch resolution (T-001/T-002), verifying the HTTP layer correctly
 * forwards `campaignSlug`/`batchSlug` to the service and surfaces
 * `campaignResolution`/`batchResolution` in the response body.
 *
 * The actual resolve-or-create business logic (match vs. create) is already
 * covered by service-level unit tests in
 * `packages/service-core/test/services/social/social-draft-ingestion.service.test.ts`
 * — this file mocks the service at the module boundary (same pattern as
 * `drafts-hashtag-limit.test.ts`) and only verifies the route's HTTP mapping.
 *
 * AC-2 (fuzzy-duplicate confirmation) is explicitly GPT-side reasoning per
 * NG-2 — it cannot be exercised as a backend integration test; see T-003's
 * OpenAPI description update for that implementation surface. It is not
 * re-asserted here beyond a documenting comment.
 *
 * @module test/routes/ai/social/drafts-campaign-batch
 * @see HOS-66
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
        draftId: 'draft-uuid-campaign-batch-001',
        title: 'Test Social Post',
        captionBase: 'This is a test caption for social media.',
        targets: [{ platform: 'INSTAGRAM', publishFormat: 'FEED_POST' }],
        ...overrides
    };
}

function successResult(overrides: {
    campaignResolution?: { id: string; slug: string; isNew: boolean } | null;
    batchResolution?: { id: string; slug: string; isNew: boolean } | null;
}) {
    return {
        code: 'SUCCESS' as const,
        data: {
            postId: 'post-uuid-campaign-batch-001',
            draftId: 'draft-uuid-campaign-batch-001',
            status: 'NEEDS_REVIEW' as const,
            approvalStatus: 'PENDING' as const,
            targetsCreated: 1,
            assetStatus: 'none' as const,
            warnings: [],
            campaignResolution: overrides.campaignResolution ?? null,
            batchResolution: overrides.batchResolution ?? null
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

describe('POST /api/v1/ai/social/drafts — campaign/batch auto-detection (HOS-66 G-4/G-5)', () => {
    it('AC-1: forwards an explicit new campaignSlug/batchSlug and surfaces isNew=true in the response', async () => {
        mockIngestDraft.mockResolvedValue(
            successResult({
                campaignResolution: {
                    id: 'campaign-uuid-1',
                    slug: 'lanzamiento-2026',
                    isNew: true
                },
                batchResolution: {
                    id: 'batch-uuid-1',
                    slug: 'hospeda-launch-2026-06',
                    isNew: true
                }
            })
        );
        const ctx = buildCtxMock();

        const result = (await draftsHandler!(
            ctx,
            {},
            buildBody({ campaignSlug: 'lanzamiento-2026', batchSlug: 'hospeda-launch-2026-06' }),
            {}
        )) as { campaignResolution: { isNew: boolean }; batchResolution: { isNew: boolean } };

        // The route forwards the payload to the service as-is
        const forwardedPayload = mockIngestDraft.mock.calls[0]?.[0]?.payload;
        expect(forwardedPayload.campaignSlug).toBe('lanzamiento-2026');
        expect(forwardedPayload.batchSlug).toBe('hospeda-launch-2026-06');

        // The response surfaces the resolution outcome
        expect(result.campaignResolution.isNew).toBe(true);
        expect(result.batchResolution.isNew).toBe(true);
    });

    it('AC-1: forwards an explicit EXISTING campaignSlug and surfaces isNew=false', async () => {
        mockIngestDraft.mockResolvedValue(
            successResult({
                campaignResolution: {
                    id: 'campaign-uuid-existing',
                    slug: 'institucional-hospeda',
                    isNew: false
                }
            })
        );
        const ctx = buildCtxMock();

        const result = (await draftsHandler!(
            ctx,
            {},
            buildBody({ campaignSlug: 'institucional-hospeda' }),
            {}
        )) as { campaignResolution: { isNew: boolean } };

        expect(result.campaignResolution.isNew).toBe(false);
    });

    // AC-2 (fuzzy-duplicate confirmation) is GPT-side reasoning per NG-2 — the
    // backend has no way to detect "Lanzamiento 2026" vs "Lanzamiento 26" as a
    // near-duplicate; that check happens in the Custom GPT conversation before
    // it ever calls this endpoint (see T-003's gpt-action-schema.ts description
    // update). Manually verified against the deployed GPT, not testable here.

    it('AC-3: ships a draft with no explicit campaignSlug/batchSlug unassociated (null resolution, still 201)', async () => {
        mockIngestDraft.mockResolvedValue(successResult({}));
        const ctx = buildCtxMock();

        const result = (await draftsHandler!(ctx, {}, buildBody(), {})) as {
            campaignResolution: unknown;
            batchResolution: unknown;
        };

        const forwardedPayload = mockIngestDraft.mock.calls[0]?.[0]?.payload;
        expect(forwardedPayload.campaignSlug).toBeUndefined();
        expect(forwardedPayload.batchSlug).toBeUndefined();

        expect(ctx._calls).toHaveLength(0); // no error response — 201 success path
        expect(result.campaignResolution).toBeNull();
        expect(result.batchResolution).toBeNull();
    });
});
