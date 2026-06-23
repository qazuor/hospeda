import { describe, expect, it } from 'vitest';
import {
    AccommodationMediaSchema,
    AccommodationMediaStateSchema
} from '../accommodation.media.schema.js';

// ============================================================================
// Shared fixtures
// ============================================================================

const VALID_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const ANOTHER_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const NOW = new Date('2024-06-01T00:00:00.000Z');

/**
 * Returns a minimal valid `AccommodationMedia` payload.
 * Only fields that are non-optional in the schema are included; optional
 * fields are omitted to keep each test focused.
 */
const buildValidMedia = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    id: VALID_UUID,
    accommodationId: ANOTHER_UUID,
    url: 'https://res.cloudinary.com/hospeda/image/upload/v1/hospeda/acc/photo.jpg',
    moderationState: 'APPROVED',
    state: 'visible',
    isFeatured: false,
    sortOrder: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides
});

// ============================================================================
// AccommodationMediaStateSchema
// ============================================================================

describe('AccommodationMediaStateSchema', () => {
    it('should accept "visible"', () => {
        const result = AccommodationMediaStateSchema.safeParse('visible');
        expect(result.success).toBe(true);
    });

    it('should accept "archived"', () => {
        const result = AccommodationMediaStateSchema.safeParse('archived');
        expect(result.success).toBe(true);
    });

    it('should reject an unknown state', () => {
        const result = AccommodationMediaStateSchema.safeParse('deleted');
        expect(result.success).toBe(false);
    });

    it('should reject empty string', () => {
        const result = AccommodationMediaStateSchema.safeParse('');
        expect(result.success).toBe(false);
    });

    it('should reject non-string value', () => {
        const result = AccommodationMediaStateSchema.safeParse(42);
        expect(result.success).toBe(false);
    });

    it('should carry the zodError key in the error message on failure', () => {
        const result = AccommodationMediaStateSchema.safeParse('invalid');
        expect(result.success).toBe(false);
        if (!result.success) {
            const issue = result.error.issues[0];
            expect(issue?.message).toBe('zodError.accommodation.media.state.invalid');
        }
    });
});

// ============================================================================
// AccommodationMediaSchema — valid round-trips
// ============================================================================

describe('AccommodationMediaSchema', () => {
    describe('valid object parsing', () => {
        it('should parse a minimal valid media row', () => {
            // Arrange
            const raw = buildValidMedia();

            // Act
            const result = AccommodationMediaSchema.safeParse(raw);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.id).toBe(VALID_UUID);
                expect(result.data.accommodationId).toBe(ANOTHER_UUID);
                expect(result.data.state).toBe('visible');
                expect(result.data.isFeatured).toBe(false);
                expect(result.data.sortOrder).toBe(0);
                expect(result.data.moderationState).toBe('APPROVED');
            }
        });

        it('should accept state="archived" and isFeatured=false together', () => {
            const result = AccommodationMediaSchema.safeParse(
                buildValidMedia({ state: 'archived', isFeatured: false, sortOrder: 1 })
            );
            expect(result.success).toBe(true);
        });

        it('should accept all optional fields when provided', () => {
            const result = AccommodationMediaSchema.safeParse(
                buildValidMedia({
                    caption: 'Room interior',
                    description: 'A spacious room with natural light and river view.',
                    alt: 'Hotel room with river view',
                    publicId: 'hospeda/dev/acc/photo',
                    attribution: {
                        photographer: 'John Doe'
                    },
                    archivedAt: null,
                    deletedAt: null
                })
            );
            expect(result.success).toBe(true);
        });

        it('should coerce ISO string timestamps to Date objects', () => {
            const raw = buildValidMedia({
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-02T00:00:00.000Z'
            });
            const result = AccommodationMediaSchema.safeParse(raw);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.createdAt).toBeInstanceOf(Date);
                expect(result.data.updatedAt).toBeInstanceOf(Date);
            }
        });

        it('should accept null archivedAt (photo is visible)', () => {
            const result = AccommodationMediaSchema.safeParse(
                buildValidMedia({ archivedAt: null })
            );
            expect(result.success).toBe(true);
        });

        it('should accept a date archivedAt (photo is archived)', () => {
            const result = AccommodationMediaSchema.safeParse(
                buildValidMedia({
                    state: 'archived',
                    archivedAt: new Date('2024-05-01T00:00:00.000Z')
                })
            );
            expect(result.success).toBe(true);
        });

        it('should accept sortOrder=0 (first gallery slot)', () => {
            const result = AccommodationMediaSchema.safeParse(buildValidMedia({ sortOrder: 0 }));
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.sortOrder).toBe(0);
            }
        });

        it('should accept large sortOrder values', () => {
            const result = AccommodationMediaSchema.safeParse(buildValidMedia({ sortOrder: 49 }));
            expect(result.success).toBe(true);
        });

        it('should accept isFeatured=true with state="visible"', () => {
            const result = AccommodationMediaSchema.safeParse(
                buildValidMedia({ isFeatured: true, state: 'visible' })
            );
            expect(result.success).toBe(true);
        });
    });

    // =========================================================================
    // Required-field rejections
    // =========================================================================

    describe('required field rejections', () => {
        it('should reject when id is missing', () => {
            const { id: _id, ...rest } = buildValidMedia();
            const result = AccommodationMediaSchema.safeParse(rest);
            expect(result.success).toBe(false);
        });

        it('should reject when accommodationId is missing', () => {
            const { accommodationId: _aid, ...rest } = buildValidMedia();
            const result = AccommodationMediaSchema.safeParse(rest);
            expect(result.success).toBe(false);
        });

        it('should reject when url is missing', () => {
            const { url: _url, ...rest } = buildValidMedia();
            const result = AccommodationMediaSchema.safeParse(rest);
            expect(result.success).toBe(false);
        });

        it('should reject when moderationState is missing', () => {
            const { moderationState: _ms, ...rest } = buildValidMedia();
            const result = AccommodationMediaSchema.safeParse(rest);
            expect(result.success).toBe(false);
        });

        it('should reject when state is missing', () => {
            const { state: _state, ...rest } = buildValidMedia();
            const result = AccommodationMediaSchema.safeParse(rest);
            expect(result.success).toBe(false);
        });

        it('should reject when isFeatured is missing', () => {
            const { isFeatured: _if, ...rest } = buildValidMedia();
            const result = AccommodationMediaSchema.safeParse(rest);
            expect(result.success).toBe(false);
        });

        it('should reject when sortOrder is missing', () => {
            const { sortOrder: _so, ...rest } = buildValidMedia();
            const result = AccommodationMediaSchema.safeParse(rest);
            expect(result.success).toBe(false);
        });

        it('should reject when createdAt is missing', () => {
            const { createdAt: _ca, ...rest } = buildValidMedia();
            const result = AccommodationMediaSchema.safeParse(rest);
            expect(result.success).toBe(false);
        });

        it('should reject when updatedAt is missing', () => {
            const { updatedAt: _ua, ...rest } = buildValidMedia();
            const result = AccommodationMediaSchema.safeParse(rest);
            expect(result.success).toBe(false);
        });
    });

    // =========================================================================
    // Type/format rejections
    // =========================================================================

    describe('field type rejections', () => {
        it('should reject a non-UUID id', () => {
            const result = AccommodationMediaSchema.safeParse(
                buildValidMedia({ id: 'not-a-uuid' })
            );
            expect(result.success).toBe(false);
        });

        it('should reject a non-UUID accommodationId', () => {
            const result = AccommodationMediaSchema.safeParse(
                buildValidMedia({ accommodationId: 'bad-id' })
            );
            expect(result.success).toBe(false);
        });

        it('should reject a relative url', () => {
            const result = AccommodationMediaSchema.safeParse(
                buildValidMedia({ url: '/relative/path.jpg' })
            );
            expect(result.success).toBe(false);
        });

        it('should reject an invalid state value', () => {
            const result = AccommodationMediaSchema.safeParse(
                buildValidMedia({ state: 'pending' })
            );
            expect(result.success).toBe(false);
        });

        it('should reject a non-boolean isFeatured', () => {
            const result = AccommodationMediaSchema.safeParse(
                buildValidMedia({ isFeatured: 'true' })
            );
            expect(result.success).toBe(false);
        });

        it('should reject a float sortOrder', () => {
            const result = AccommodationMediaSchema.safeParse(buildValidMedia({ sortOrder: 1.5 }));
            expect(result.success).toBe(false);
            if (!result.success) {
                const messages = result.error.issues.map((i) => i.message);
                expect(messages).toContain('zodError.accommodation.media.sortOrder.int');
            }
        });

        it('should reject a string sortOrder', () => {
            const result = AccommodationMediaSchema.safeParse(
                buildValidMedia({ sortOrder: 'first' })
            );
            expect(result.success).toBe(false);
        });

        it('should reject an invalid moderationState value', () => {
            const result = AccommodationMediaSchema.safeParse(
                buildValidMedia({ moderationState: 'UNKNOWN' })
            );
            expect(result.success).toBe(false);
        });
    });
});
