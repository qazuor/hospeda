/**
 * The operator PIN is checked BEFORE the body is validated (HOS-425).
 *
 * ## The property, and how it was lost
 *
 * `POST /api/v1/ai/social/drafts` takes two credentials: the
 * `x-hospeda-ai-key` header and an `operatorPin` inside the body. The PIN used
 * to be checked in the handler — which runs AFTER the OpenAPI request
 * validator. So a caller holding the key but not the PIN was answered with the
 * body's validation errors, `details[].field` and all, and reached the 403 only
 * when the body happened to be well-formed: a schema oracle, and the reverse of
 * the order `docs/error-contract.md` sets (permission 403 before input shape
 * 400).
 *
 * The in-handler comment asserted the opposite — "Runs AFTER the PIN check so
 * an unauthenticated caller cannot use validation messages to probe the schema"
 * — which was true of the one line it sat next to and false of every
 * field-level rule in the same schema. Fixing the route factory to enforce
 * refinements (HOS-425) would have widened the leak from field errors to
 * cross-field ones, so the check moved to a route middleware instead, where it
 * runs first.
 *
 * ## Why this file does not mock the factory
 *
 * `social-drafts.test.ts` mocks `createApiKeyRoute` to capture the handler, so
 * it can test the gate but never its ORDER against the validator. Here the real
 * factory builds the real route, and the only assertion that matters is which
 * of the two answers comes back.
 *
 * @module test/routes/ai/social/drafts-pin-precedes-validation
 */

import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

const TEST_PIN = 'test-pin-1234';
const TEST_AI_KEY = 'test-ai-secret-key';

const { mockIngestDraft, mockGetDecryptedSocialCredential, mockGetMediaProvider } = vi.hoisted(
    () => ({
        mockIngestDraft: vi.fn(),
        mockGetDecryptedSocialCredential: vi.fn(),
        mockGetMediaProvider: vi.fn()
    })
);

// PARTIAL, not a whole-module replacement: the route factory pulls in the
// entitlement middleware, which constructs a `PlanService` at import time. A
// bare object mock leaves that `undefined` and every request dies with
// "PlanService is not a constructor" long before the assertion.
vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        SocialDraftIngestionService: vi.fn().mockImplementation(function () {
            return { ingestDraft: mockIngestDraft };
        }),
        SocialImagePipelineService: vi.fn().mockImplementation(function () {
            return { kind: 'image-pipeline' };
        })
    };
});

vi.mock('../../../../src/services/media', () => ({
    getMediaProvider: mockGetMediaProvider
}));

vi.mock('../../../../src/services/social-credential-vault.service.js', () => ({
    getDecryptedSocialCredential: mockGetDecryptedSocialCredential
}));

/**
 * A draft body that satisfies every field-level rule AND the schema's
 * cross-field rule, so the only thing that can reject it is the PIN gate.
 */
const VALID_BODY = {
    draftId: 'draft-ordering-1',
    operatorPin: TEST_PIN,
    title: 'A social draft',
    captionBase: 'A caption long enough to look like a real one.',
    targets: [{ platform: 'INSTAGRAM', publishFormat: 'FEED_POST' }]
};

/**
 * The same body with its CROSS-FIELD rule broken: `openai_file_refs` mode with
 * no file refs. Before HOS-425 the factory dropped this rule entirely.
 */
const CROSS_FIELD_VIOLATION = {
    ...VALID_BODY,
    image: { mode: 'openai_file_refs' },
    openaiFileIdRefs: []
};

/** The same body with a FIELD-level rule broken, and no valid PIN. */
const FIELD_LEVEL_VIOLATION = { ...VALID_BODY, targets: 'not-an-array' };

let app: Hono<AppBindings>;

const post = (body: unknown, headers: Record<string, string> = {}) =>
    app.request('/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'user-agent': 'vitest',
            'x-hospeda-ai-key': TEST_AI_KEY,
            ...headers
        },
        body: JSON.stringify(body)
    });

beforeEach(async () => {
    vi.resetModules();
    mockGetMediaProvider.mockReturnValue(null);
    mockIngestDraft.mockResolvedValue({
        code: 'SUCCESS',
        data: {
            postId: '77777777-7777-4777-8777-777777777777',
            draftId: VALID_BODY.draftId,
            status: 'NEEDS_REVIEW',
            approvalStatus: 'PENDING',
            targetsCreated: 1,
            assetStatus: 'none',
            warnings: []
        }
    });
    mockGetDecryptedSocialCredential.mockImplementation(async ({ key }: { key: string }) => ({
        data: { plaintext: key === 'operator_pin' ? TEST_PIN : TEST_AI_KEY }
    }));

    const { socialDraftsRoute } = await import('../../../../src/routes/ai/social/drafts');
    app = new Hono<AppBindings>();
    app.route('/', socialDraftsRoute);
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('POST /ai/social/drafts — the PIN gate runs before body validation', () => {
    it('answers 403, not 400, when the PIN is wrong AND the body breaks a field rule', async () => {
        const response = await post({ ...FIELD_LEVEL_VIOLATION, operatorPin: 'wrong-pin' });
        const payload = (await response.json()) as {
            error?: { code?: string; details?: unknown };
        };

        expect(response.status).toBe(403);
        expect(payload.error?.code).toBe('FORBIDDEN');
        // The leak being closed is the field list, so assert it is absent
        // rather than only that the status is right.
        expect(payload.error?.details).toBeUndefined();
        expect(mockIngestDraft).not.toHaveBeenCalled();
    });

    it('answers 403, not 400, when the PIN is wrong AND the body breaks the cross-field rule', async () => {
        const response = await post({ ...CROSS_FIELD_VIOLATION, operatorPin: 'wrong-pin' });

        expect(response.status).toBe(403);
        expect(mockIngestDraft).not.toHaveBeenCalled();
    });

    it('answers 400 once the PIN is right and the cross-field rule is broken', async () => {
        // The other half of the order: a caller who HAS authenticated must
        // still be told what is wrong with the body — and the refinement must
        // actually run, which is the HOS-425 fix itself.
        const response = await post(CROSS_FIELD_VIOLATION);

        expect(response.status).toBe(400);
        expect(mockIngestDraft).not.toHaveBeenCalled();
    });

    it('reaches the service when the PIN is right and the body is valid', async () => {
        // Without this the three refusals above would also pass on a route that
        // rejects everything, and the middleware reads the body, so "it did not
        // eat the stream" needs saying out loud too.
        const response = await post(VALID_BODY);

        expect(response.status).toBe(201);
        expect(mockIngestDraft).toHaveBeenCalledTimes(1);
    });
});
