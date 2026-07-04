/**
 * Tests for CreateSocialDraftResponseSchema's campaignResolution/batchResolution
 * fields (HOS-66 T-002, G-4/G-5).
 *
 * These fields let the GPT/operator confirm whether a campaign/batch slug was
 * matched to an existing row or a new one was created (T-001's
 * resolve-or-create behavior). Additive per the schema-compat policy — a
 * response without them must still parse (existing callers unaffected).
 *
 * @see packages/schemas/src/entities/social/social-draft.http.schema.ts
 */
import { describe, expect, it } from 'vitest';
import { CreateSocialDraftResponseSchema } from '../../../src/entities/social/social-draft.http.schema.js';

function makeBaseResponse(overrides: Record<string, unknown> = {}) {
    return {
        postId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
        draftId: 'gpt-draft-abc123',
        status: 'NEEDS_REVIEW',
        approvalStatus: 'PENDING',
        targetsCreated: 1,
        assetStatus: 'none',
        warnings: [],
        ...overrides
    };
}

describe('CreateSocialDraftResponseSchema', () => {
    it('parses a response with no campaignResolution/batchResolution (backward compat)', () => {
        const result = CreateSocialDraftResponseSchema.safeParse(makeBaseResponse());
        expect(result.success).toBe(true);
    });

    it('parses a response with campaignResolution/batchResolution set to null', () => {
        const result = CreateSocialDraftResponseSchema.safeParse(
            makeBaseResponse({ campaignResolution: null, batchResolution: null })
        );
        expect(result.success).toBe(true);
    });

    it('parses a response with campaignResolution/batchResolution objects (isNew: true)', () => {
        const result = CreateSocialDraftResponseSchema.safeParse(
            makeBaseResponse({
                campaignResolution: {
                    id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
                    slug: 'lanzamiento-2026',
                    isNew: true
                },
                batchResolution: {
                    id: 'bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee',
                    slug: 'hospeda-launch-2026-06',
                    isNew: false
                }
            })
        );
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.campaignResolution?.isNew).toBe(true);
            expect(result.data.batchResolution?.isNew).toBe(false);
        }
    });
});
