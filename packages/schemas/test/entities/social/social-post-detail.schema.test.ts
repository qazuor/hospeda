/**
 * Regression tests for SocialPostDetailSchema.
 *
 * These tests exist to prevent a regression where the admin detail route
 * `GET /api/v1/admin/social/posts/{id}` returned HTTP 500 because the
 * full entity SocialPostSchema was used as the response schema instead of
 * the richer detail DTO schema.  The entity schema requires `draftId` and
 * `source` (absent in the DTO) and rejects nullable strings that the DTO
 * legally returns null for.
 *
 * @see packages/schemas/src/entities/social/social-post.schema.ts
 * @see apps/api/src/routes/social/admin/posts/getById.ts
 */
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    SocialPostDetailSchema,
    SocialPostSchema
} from '../../../src/entities/social/social-post.schema.js';

// ---------------------------------------------------------------------------
// Shared fixture helpers
// ---------------------------------------------------------------------------

/** Minimal detail DTO with all nullable fields set to null. */
function makeMinimalDetail() {
    return {
        id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        title: 'Test post',
        slug: 'test-post',
        status: 'NEEDS_REVIEW',
        approvalStatus: 'PENDING',
        paused: false,
        scheduledAt: null,
        recurrenceType: 'ONCE',
        captionBase: 'Base caption text',
        finalCaption: null,
        finalHashtagsText: null,
        notes: null,
        internalNotes: null,
        gptHashtagPayloadJson: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
        hashtags: [],
        targets: [],
        media: [],
        publishLogs: []
    };
}

/** Detail DTO with all fields populated, including enriched media rows. */
function makeFullDetail() {
    return {
        id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        title: 'Full post',
        slug: 'full-post',
        status: 'APPROVED',
        approvalStatus: 'APPROVED',
        paused: false,
        scheduledAt: new Date('2024-06-15T12:00:00Z'),
        recurrenceType: 'WEEKLY',
        nextRunAt: new Date('2024-06-22T12:00:00Z'),
        recurrenceParamsJson: { weekday: 'SATURDAY' },
        batch: { id: '11111111-1111-4111-8111-111111111111', name: 'Batch A' },
        campaign: { id: '22222222-2222-4222-8222-222222222222', name: 'Campaign A' },
        captionBase: 'Base caption',
        finalCaption: 'Final caption with edits',
        finalHashtagsText: '#travel #argentina',
        notes: 'Admin note here',
        internalNotes: 'Internal team note',
        gptHashtagPayloadJson: ['#gptsuggested', '#moretags'],
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-02T00:00:00Z'),
        hashtags: ['#travel', '#argentina'],
        targets: [
            {
                id: 'target-uuid-1',
                postId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
                platformId: 'platform-uuid-1',
                platformFormatId: 'format-uuid-1',
                status: 'PENDING'
            }
        ],
        media: [
            {
                id: 'media-uuid-1',
                postId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
                assetId: 'asset-uuid-1',
                cloudinaryUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
                position: 0
            }
        ],
        publishLogs: [
            {
                id: 'log-uuid-1',
                postId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
                platformId: 'platform-uuid-1',
                status: 'SUCCESS',
                createdAt: '2024-06-15T12:05:00Z'
            }
        ]
    };
}

// ---------------------------------------------------------------------------
// SocialPostDetailSchema — valid inputs
// ---------------------------------------------------------------------------

describe('SocialPostDetailSchema', () => {
    describe('when all nullable fields are null', () => {
        it('should parse successfully (regression: was rejected by SocialPostSchema)', () => {
            // Arrange
            const input = makeMinimalDetail();

            // Act + Assert — must NOT throw
            expect(() => SocialPostDetailSchema.parse(input)).not.toThrow();
        });

        it('should preserve null values on nullable fields', () => {
            // Arrange
            const input = makeMinimalDetail();

            // Act
            const result = SocialPostDetailSchema.parse(input);

            // Assert
            expect(result.finalCaption).toBeNull();
            expect(result.finalHashtagsText).toBeNull();
            expect(result.notes).toBeNull();
            expect(result.internalNotes).toBeNull();
            expect(result.gptHashtagPayloadJson).toBeNull();
            expect(result.scheduledAt).toBeNull();
        });
    });

    describe('when all fields are populated', () => {
        it('should parse successfully with full DTO', () => {
            // Arrange
            const input = makeFullDetail();

            // Act + Assert
            expect(() => SocialPostDetailSchema.parse(input)).not.toThrow();
        });

        it('should preserve cloudinaryUrl in media rows (permissive record)', () => {
            // Arrange
            const input = makeFullDetail();

            // Act
            const result = SocialPostDetailSchema.parse(input);

            // Assert — cloudinaryUrl must survive stripWithSchema-style parsing
            expect(result.media[0]).toBeDefined();
            expect((result.media[0] as Record<string, unknown>).cloudinaryUrl).toBe(
                'https://res.cloudinary.com/demo/image/upload/sample.jpg'
            );
        });

        it('should preserve all keys of target rows', () => {
            // Arrange
            const input = makeFullDetail();

            // Act
            const result = SocialPostDetailSchema.parse(input);

            // Assert
            const target = result.targets[0] as Record<string, unknown>;
            expect(target).toBeDefined();
            expect(target.platformId).toBe('platform-uuid-1');
            expect(target.status).toBe('PENDING');
        });

        it('should coerce scheduledAt string to Date', () => {
            // Arrange
            const input = {
                ...makeFullDetail(),
                scheduledAt: '2024-06-15T12:00:00Z'
            };

            // Act
            const result = SocialPostDetailSchema.parse(input);

            // Assert
            expect(result.scheduledAt).toBeInstanceOf(Date);
        });
    });

    describe('when schema does NOT require entity-only fields', () => {
        it('should not require draftId (absent in detail DTO)', () => {
            // Arrange — no draftId provided
            const input = makeMinimalDetail();
            expect('draftId' in input).toBe(false);

            // Act + Assert — must NOT throw without draftId
            expect(() => SocialPostDetailSchema.parse(input)).not.toThrow();
        });

        it('should not require source (absent in detail DTO)', () => {
            // Arrange — no source provided
            const input = makeMinimalDetail();
            expect('source' in input).toBe(false);

            // Act + Assert
            expect(() => SocialPostDetailSchema.parse(input)).not.toThrow();
        });
    });

    describe('required fields', () => {
        it('should reject when id is missing', () => {
            // Arrange
            const { id: _id, ...input } = makeMinimalDetail();

            // Act + Assert
            expect(() => SocialPostDetailSchema.parse(input)).toThrow(ZodError);
        });

        it('should reject when captionBase is missing', () => {
            // Arrange
            const { captionBase: _captionBase, ...input } = makeMinimalDetail();

            // Act + Assert
            expect(() => SocialPostDetailSchema.parse(input)).toThrow(ZodError);
        });

        it('should reject when paused is missing', () => {
            // Arrange
            const { paused: _paused, ...input } = makeMinimalDetail();

            // Act + Assert
            expect(() => SocialPostDetailSchema.parse(input)).toThrow(ZodError);
        });
    });
});

// ---------------------------------------------------------------------------
// Prove the old code would have FAILED (regression guard)
// The full SocialPostSchema requires draftId + source and does NOT allow
// null for finalCaption / notes / internalNotes / gptHashtagPayloadJson.
// ---------------------------------------------------------------------------

describe('SocialPostSchema (entity) — demonstrates why it was wrong for detail', () => {
    it('should REJECT the minimal detail DTO (missing draftId + source)', () => {
        // Arrange
        const input = makeMinimalDetail();

        // Act + Assert — proves the old route schema was wrong
        expect(() => SocialPostSchema.parse(input)).toThrow(ZodError);
    });
});
