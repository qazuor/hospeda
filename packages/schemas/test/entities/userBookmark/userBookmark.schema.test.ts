import { describe, expect, it } from 'vitest';
import { UserBookmarkSchema } from '../../../src/entities/userBookmark/userBookmark.schema.js';
import { EntityTypeEnum, LifecycleStatusEnum } from '../../../src/enums/index.js';
import {
    createMinimalUserBookmarkFixture,
    createUserBookmarkFixture
} from '../../fixtures/userBookmark.fixtures.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

const VALID_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const COLLECTION_UUID = 'c0ffee00-dead-4bee-beef-feedfacecafe';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('UserBookmarkSchema', () => {
    describe('when given a complete valid bookmark', () => {
        it('should parse a complete fixture successfully', () => {
            const fixture = createUserBookmarkFixture();
            const result = UserBookmarkSchema.safeParse(fixture);
            expect(result.success).toBe(true);
        });

        it('should parse a minimal fixture without optional fields', () => {
            const fixture = createMinimalUserBookmarkFixture();
            const result = UserBookmarkSchema.safeParse(fixture);
            expect(result.success).toBe(true);
        });
    });

    // ── collectionId field ────────────────────────────────────────────────────

    describe('collectionId field', () => {
        it('should accept null collectionId (uncollected bookmark)', () => {
            // Arrange
            const bookmark = createUserBookmarkFixture({ collectionId: null });

            // Act
            const result = UserBookmarkSchema.safeParse(bookmark);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.collectionId).toBeNull();
            }
        });

        it('should accept a valid UUID collectionId', () => {
            // Arrange
            const bookmark = createUserBookmarkFixture({ collectionId: COLLECTION_UUID });

            // Act
            const result = UserBookmarkSchema.safeParse(bookmark);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.collectionId).toBe(COLLECTION_UUID);
            }
        });

        it('should accept undefined collectionId (field absent)', () => {
            // Arrange — omit collectionId entirely
            const { collectionId: _unused, ...bookmarkWithoutCollection } =
                createUserBookmarkFixture();
            const bookmark = bookmarkWithoutCollection;

            // Act
            const result = UserBookmarkSchema.safeParse(bookmark);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.collectionId).toBeUndefined();
            }
        });

        it('should reject a non-UUID string as collectionId', () => {
            // Arrange
            const bookmark = createUserBookmarkFixture({ collectionId: 'not-a-uuid' as never });

            // Act
            const result = UserBookmarkSchema.safeParse(bookmark);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject a number as collectionId', () => {
            // Arrange
            const bookmark = createUserBookmarkFixture({ collectionId: 12345 as never });

            // Act
            const result = UserBookmarkSchema.safeParse(bookmark);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should preserve collectionId in the parsed output when provided', () => {
            // Arrange
            const bookmark = createUserBookmarkFixture({ collectionId: COLLECTION_UUID });

            // Act
            const parsed = UserBookmarkSchema.parse(bookmark);

            // Assert
            expect(parsed.collectionId).toBe(COLLECTION_UUID);
        });
    });

    // ── Required fields ───────────────────────────────────────────────────────

    describe('required fields', () => {
        it('should reject a bookmark without userId', () => {
            const { userId: _unused, ...noUserId } = createUserBookmarkFixture();
            expect(UserBookmarkSchema.safeParse(noUserId).success).toBe(false);
        });

        it('should reject a bookmark without entityId', () => {
            const { entityId: _unused, ...noEntityId } = createUserBookmarkFixture();
            expect(UserBookmarkSchema.safeParse(noEntityId).success).toBe(false);
        });

        it('should reject a bookmark without entityType', () => {
            const { entityType: _unused, ...noEntityType } = createUserBookmarkFixture();
            expect(UserBookmarkSchema.safeParse(noEntityType).success).toBe(false);
        });

        it('should reject an invalid entityType value', () => {
            const bookmark = createUserBookmarkFixture({ entityType: 'NOT_A_TYPE' as never });
            expect(UserBookmarkSchema.safeParse(bookmark).success).toBe(false);
        });

        it('should reject a non-UUID userId', () => {
            const bookmark = createUserBookmarkFixture({ userId: 'not-uuid' as never });
            expect(UserBookmarkSchema.safeParse(bookmark).success).toBe(false);
        });

        it('should reject a non-UUID entityId', () => {
            const bookmark = createUserBookmarkFixture({ entityId: 'not-uuid' as never });
            expect(UserBookmarkSchema.safeParse(bookmark).success).toBe(false);
        });
    });

    // ── Optional name / description ───────────────────────────────────────────

    describe('name field (optional)', () => {
        it('should accept null name', () => {
            const bookmark = createUserBookmarkFixture({ name: null });
            expect(UserBookmarkSchema.safeParse(bookmark).success).toBe(true);
        });

        it('should accept undefined name', () => {
            const bookmark = createUserBookmarkFixture({ name: undefined });
            expect(UserBookmarkSchema.safeParse(bookmark).success).toBe(true);
        });

        it('should accept short names (no min length on output side)', () => {
            // Must mirror UserBookmarkUpdateNotesSchema, which has no min length.
            const bookmark = createUserBookmarkFixture({ name: 'AB' });
            expect(UserBookmarkSchema.safeParse(bookmark).success).toBe(true);
        });

        it('should reject name longer than 100 characters', () => {
            const bookmark = createUserBookmarkFixture({ name: 'A'.repeat(101) });
            expect(UserBookmarkSchema.safeParse(bookmark).success).toBe(false);
        });
    });

    describe('description field (optional)', () => {
        it('should accept null description', () => {
            const bookmark = createUserBookmarkFixture({ description: null });
            expect(UserBookmarkSchema.safeParse(bookmark).success).toBe(true);
        });

        it('should accept undefined description', () => {
            const bookmark = createUserBookmarkFixture({ description: undefined });
            expect(UserBookmarkSchema.safeParse(bookmark).success).toBe(true);
        });

        it('should accept short descriptions (no min length on output side)', () => {
            // Must mirror UserBookmarkUpdateNotesSchema, which has no min length.
            // Without this, short notes saved via the inline editor fail response
            // validation and poison subsequent list reads.
            const bookmark = createUserBookmarkFixture({ description: 'Short' });
            expect(UserBookmarkSchema.safeParse(bookmark).success).toBe(true);
        });

        it('should reject description longer than 300 characters', () => {
            const bookmark = createUserBookmarkFixture({ description: 'A'.repeat(301) });
            expect(UserBookmarkSchema.safeParse(bookmark).success).toBe(false);
        });
    });

    // ── All entity types ──────────────────────────────────────────────────────

    describe('entityType enum values', () => {
        for (const entityType of Object.values(EntityTypeEnum)) {
            it(`should accept entityType = ${entityType}`, () => {
                const bookmark = createUserBookmarkFixture({
                    entityType,
                    entityId: VALID_UUID
                });
                expect(UserBookmarkSchema.safeParse(bookmark).success).toBe(true);
            });
        }
    });

    // ── lifecycleState ────────────────────────────────────────────────────────

    describe('lifecycleState field', () => {
        it('should accept ACTIVE lifecycleState', () => {
            const bookmark = createUserBookmarkFixture({
                lifecycleState: LifecycleStatusEnum.ACTIVE
            });
            expect(UserBookmarkSchema.safeParse(bookmark).success).toBe(true);
        });
    });
});
