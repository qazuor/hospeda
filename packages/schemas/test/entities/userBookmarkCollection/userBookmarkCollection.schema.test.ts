import { describe, expect, it } from 'vitest';
import { UserBookmarkCollectionSchema } from '../../../src/entities/userBookmarkCollection/userBookmarkCollection.schema.js';
import { LifecycleStatusEnum } from '../../../src/enums/index.js';

// ============================================================================
// FIXTURES
// ============================================================================

/** Fully-populated valid UserBookmarkCollection fixture. */
const VALID_COLLECTION = {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    userId: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Viaje al Litoral',
    description: 'Alojamientos para las vacaciones de verano',
    color: '#E57373',
    icon: 'MapPin',
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    adminInfo: null,
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
    createdById: '550e8400-e29b-41d4-a716-446655440002',
    updatedById: '550e8400-e29b-41d4-a716-446655440002',
    deletedAt: null,
    deletedById: null
} as const;

// ============================================================================
// TESTS
// ============================================================================

describe('UserBookmarkCollectionSchema', () => {
    describe('valid full input', () => {
        it('should parse a complete valid collection object', () => {
            // Arrange
            const input = { ...VALID_COLLECTION };

            // Act & Assert
            expect(() => UserBookmarkCollectionSchema.parse(input)).not.toThrow();
        });

        it('should parse when optional fields are omitted', () => {
            // Arrange
            const { description, color, icon, adminInfo, deletedAt, deletedById, ...minimal } =
                VALID_COLLECTION;

            // Act & Assert
            expect(() => UserBookmarkCollectionSchema.parse(minimal)).not.toThrow();
        });
    });

    describe('required field validation', () => {
        it('should reject input missing id', () => {
            // Arrange
            const { id: _id, ...input } = VALID_COLLECTION;

            // Act & Assert
            expect(() => UserBookmarkCollectionSchema.parse(input)).toThrow();
        });

        it('should reject input with non-UUID id', () => {
            // Arrange
            const input = { ...VALID_COLLECTION, id: 'not-a-uuid' };

            // Act & Assert
            expect(() => UserBookmarkCollectionSchema.parse(input)).toThrow();
        });

        it('should reject input missing userId', () => {
            // Arrange
            const { userId: _userId, ...input } = VALID_COLLECTION;

            // Act & Assert
            expect(() => UserBookmarkCollectionSchema.parse(input)).toThrow();
        });

        it('should reject input with non-UUID userId', () => {
            // Arrange
            const input = { ...VALID_COLLECTION, userId: 'not-a-uuid' };

            // Act & Assert
            expect(() => UserBookmarkCollectionSchema.parse(input)).toThrow();
        });

        it('should reject input missing name', () => {
            // Arrange
            const { name: _name, ...input } = VALID_COLLECTION;

            // Act & Assert
            expect(() => UserBookmarkCollectionSchema.parse(input)).toThrow();
        });
    });

    describe('name field boundaries', () => {
        it('should accept name with minimum length of 1 character', () => {
            // Arrange
            const input = { ...VALID_COLLECTION, name: 'A' };

            // Act & Assert
            expect(() => UserBookmarkCollectionSchema.parse(input)).not.toThrow();
        });

        it('should accept name with maximum length of 60 characters', () => {
            // Arrange
            const input = { ...VALID_COLLECTION, name: 'A'.repeat(60) };

            // Act & Assert
            expect(() => UserBookmarkCollectionSchema.parse(input)).not.toThrow();
        });

        it('should reject empty string name', () => {
            // Arrange
            const input = { ...VALID_COLLECTION, name: '' };

            // Act & Assert
            expect(() => UserBookmarkCollectionSchema.parse(input)).toThrow();
        });

        it('should reject name longer than 60 characters', () => {
            // Arrange
            const input = { ...VALID_COLLECTION, name: 'A'.repeat(61) };

            // Act & Assert
            expect(() => UserBookmarkCollectionSchema.parse(input)).toThrow();
        });
    });

    describe('description field boundaries', () => {
        it('should accept description with maximum length of 300 characters', () => {
            // Arrange
            const input = { ...VALID_COLLECTION, description: 'A'.repeat(300) };

            // Act & Assert
            expect(() => UserBookmarkCollectionSchema.parse(input)).not.toThrow();
        });

        it('should reject description longer than 300 characters', () => {
            // Arrange
            const input = { ...VALID_COLLECTION, description: 'A'.repeat(301) };

            // Act & Assert
            expect(() => UserBookmarkCollectionSchema.parse(input)).toThrow();
        });

        it('should accept null description', () => {
            // Arrange
            const input = { ...VALID_COLLECTION, description: null };

            // Act & Assert
            expect(() => UserBookmarkCollectionSchema.parse(input)).not.toThrow();
        });

        it('should accept undefined description (optional field)', () => {
            // Arrange
            const { description: _desc, ...input } = VALID_COLLECTION;

            // Act & Assert
            expect(() => UserBookmarkCollectionSchema.parse(input)).not.toThrow();
        });
    });

    describe('color field validation', () => {
        it('should accept valid lowercase hex color', () => {
            // Arrange
            const input = { ...VALID_COLLECTION, color: '#a1b2c3' };

            // Act & Assert
            expect(() => UserBookmarkCollectionSchema.parse(input)).not.toThrow();
        });

        it('should accept valid uppercase hex color', () => {
            // Arrange
            const input = { ...VALID_COLLECTION, color: '#A1B2C3' };

            // Act & Assert
            expect(() => UserBookmarkCollectionSchema.parse(input)).not.toThrow();
        });

        it('should accept valid mixed-case hex color', () => {
            // Arrange
            const input = { ...VALID_COLLECTION, color: '#E57373' };

            // Act & Assert
            expect(() => UserBookmarkCollectionSchema.parse(input)).not.toThrow();
        });

        it('should reject hex color without leading #', () => {
            // Arrange
            const input = { ...VALID_COLLECTION, color: 'E57373' };

            // Act & Assert
            expect(() => UserBookmarkCollectionSchema.parse(input)).toThrow();
        });

        it('should reject shorthand hex color (#RGB)', () => {
            // Arrange
            const input = { ...VALID_COLLECTION, color: '#E57' };

            // Act & Assert
            expect(() => UserBookmarkCollectionSchema.parse(input)).toThrow();
        });

        it('should reject hex color with 8 digits (#RRGGBBAA)', () => {
            // Arrange
            const input = { ...VALID_COLLECTION, color: '#E57373FF' };

            // Act & Assert
            expect(() => UserBookmarkCollectionSchema.parse(input)).toThrow();
        });

        it('should reject color with invalid characters', () => {
            // Arrange
            const input = { ...VALID_COLLECTION, color: '#GGGGGG' };

            // Act & Assert
            expect(() => UserBookmarkCollectionSchema.parse(input)).toThrow();
        });

        it('should reject plain color name as color', () => {
            // Arrange
            const input = { ...VALID_COLLECTION, color: 'red' };

            // Act & Assert
            expect(() => UserBookmarkCollectionSchema.parse(input)).toThrow();
        });

        it('should accept null color', () => {
            // Arrange
            const input = { ...VALID_COLLECTION, color: null };

            // Act & Assert
            expect(() => UserBookmarkCollectionSchema.parse(input)).not.toThrow();
        });

        it('should accept undefined color (optional field)', () => {
            // Arrange
            const { color: _color, ...input } = VALID_COLLECTION;

            // Act & Assert
            expect(() => UserBookmarkCollectionSchema.parse(input)).not.toThrow();
        });
    });

    describe('icon field boundaries', () => {
        it('should accept icon with maximum length of 40 characters', () => {
            // Arrange
            const input = { ...VALID_COLLECTION, icon: 'A'.repeat(40) };

            // Act & Assert
            expect(() => UserBookmarkCollectionSchema.parse(input)).not.toThrow();
        });

        it('should reject icon longer than 40 characters', () => {
            // Arrange
            const input = { ...VALID_COLLECTION, icon: 'A'.repeat(41) };

            // Act & Assert
            expect(() => UserBookmarkCollectionSchema.parse(input)).toThrow();
        });

        it('should accept null icon', () => {
            // Arrange
            const input = { ...VALID_COLLECTION, icon: null };

            // Act & Assert
            expect(() => UserBookmarkCollectionSchema.parse(input)).not.toThrow();
        });

        it('should accept undefined icon (optional field)', () => {
            // Arrange
            const { icon: _icon, ...input } = VALID_COLLECTION;

            // Act & Assert
            expect(() => UserBookmarkCollectionSchema.parse(input)).not.toThrow();
        });
    });

    describe('lifecycleState field', () => {
        it('should accept ACTIVE lifecycle state', () => {
            // Arrange
            const input = { ...VALID_COLLECTION, lifecycleState: LifecycleStatusEnum.ACTIVE };

            // Act & Assert
            expect(() => UserBookmarkCollectionSchema.parse(input)).not.toThrow();
        });

        it('should accept DRAFT lifecycle state', () => {
            // Arrange
            const input = { ...VALID_COLLECTION, lifecycleState: LifecycleStatusEnum.DRAFT };

            // Act & Assert
            expect(() => UserBookmarkCollectionSchema.parse(input)).not.toThrow();
        });

        it('should accept INACTIVE lifecycle state', () => {
            // Arrange
            const input = { ...VALID_COLLECTION, lifecycleState: LifecycleStatusEnum.INACTIVE };

            // Act & Assert
            expect(() => UserBookmarkCollectionSchema.parse(input)).not.toThrow();
        });

        it('should accept ARCHIVED lifecycle state', () => {
            // Arrange
            const input = { ...VALID_COLLECTION, lifecycleState: LifecycleStatusEnum.ARCHIVED };

            // Act & Assert
            expect(() => UserBookmarkCollectionSchema.parse(input)).not.toThrow();
        });

        it('should reject an unknown lifecycle state value', () => {
            // Arrange
            const input = { ...VALID_COLLECTION, lifecycleState: 'PUBLISHED' };

            // Act & Assert
            expect(() => UserBookmarkCollectionSchema.parse(input)).toThrow();
        });

        it('should default lifecycleState to ACTIVE when omitted', () => {
            // Arrange
            const { lifecycleState: _state, ...input } = VALID_COLLECTION;

            // Act
            const result = UserBookmarkCollectionSchema.parse(input);

            // Assert
            expect(result.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
        });
    });
});
