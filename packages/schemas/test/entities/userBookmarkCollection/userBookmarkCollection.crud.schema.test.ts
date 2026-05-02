import { describe, expect, it } from 'vitest';
import {
    UserBookmarkCollectionCreateInputSchema,
    UserBookmarkCollectionUpdateInputSchema
} from '../../../src/entities/userBookmarkCollection/userBookmarkCollection.crud.schema.js';

// ============================================================================
// FIXTURES
// ============================================================================

/** Minimum valid create payload. */
const VALID_CREATE_INPUT = {
    userId: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Viaje al Litoral'
} as const;

/** Full valid create payload including all optional fields. */
const FULL_CREATE_INPUT = {
    userId: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Viaje al Litoral',
    description: 'Alojamientos para las vacaciones de verano',
    color: '#E57373',
    icon: 'MapPin'
} as const;

// ============================================================================
// CREATE INPUT TESTS
// ============================================================================

describe('UserBookmarkCollectionCreateInputSchema', () => {
    describe('valid input', () => {
        it('should accept minimum required fields', () => {
            // Arrange
            const input = { ...VALID_CREATE_INPUT };

            // Act & Assert
            expect(() => UserBookmarkCollectionCreateInputSchema.parse(input)).not.toThrow();
        });

        it('should accept full input with all optional fields', () => {
            // Arrange
            const input = { ...FULL_CREATE_INPUT };

            // Act & Assert
            expect(() => UserBookmarkCollectionCreateInputSchema.parse(input)).not.toThrow();
        });

        it('should accept input when description is null', () => {
            // Arrange
            const input = { ...VALID_CREATE_INPUT, description: null };

            // Act & Assert
            expect(() => UserBookmarkCollectionCreateInputSchema.parse(input)).not.toThrow();
        });

        it('should accept input when color is null', () => {
            // Arrange
            const input = { ...VALID_CREATE_INPUT, color: null };

            // Act & Assert
            expect(() => UserBookmarkCollectionCreateInputSchema.parse(input)).not.toThrow();
        });

        it('should accept input when icon is null', () => {
            // Arrange
            const input = { ...VALID_CREATE_INPUT, icon: null };

            // Act & Assert
            expect(() => UserBookmarkCollectionCreateInputSchema.parse(input)).not.toThrow();
        });
    });

    describe('required field validation', () => {
        it('should reject input missing userId', () => {
            // Arrange
            const { userId: _userId, ...input } = VALID_CREATE_INPUT;

            // Act & Assert
            expect(() => UserBookmarkCollectionCreateInputSchema.parse(input)).toThrow();
        });

        it('should reject input with invalid userId (non-UUID)', () => {
            // Arrange
            const input = { ...VALID_CREATE_INPUT, userId: 'not-a-uuid' };

            // Act & Assert
            expect(() => UserBookmarkCollectionCreateInputSchema.parse(input)).toThrow();
        });

        it('should reject input missing name', () => {
            // Arrange
            const { name: _name, ...input } = VALID_CREATE_INPUT;

            // Act & Assert
            expect(() => UserBookmarkCollectionCreateInputSchema.parse(input)).toThrow();
        });

        it('should reject input with empty name', () => {
            // Arrange
            const input = { ...VALID_CREATE_INPUT, name: '' };

            // Act & Assert
            expect(() => UserBookmarkCollectionCreateInputSchema.parse(input)).toThrow();
        });
    });

    describe('server-generated fields are excluded', () => {
        it('should reject input containing id', () => {
            // Arrange
            const input = {
                ...VALID_CREATE_INPUT,
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
            };

            // Act & Assert
            expect(() => UserBookmarkCollectionCreateInputSchema.parse(input)).toThrow();
        });

        it('should reject input containing createdAt', () => {
            // Arrange
            const input = { ...VALID_CREATE_INPUT, createdAt: new Date() };

            // Act & Assert
            expect(() => UserBookmarkCollectionCreateInputSchema.parse(input)).toThrow();
        });

        it('should reject input containing updatedAt', () => {
            // Arrange
            const input = { ...VALID_CREATE_INPUT, updatedAt: new Date() };

            // Act & Assert
            expect(() => UserBookmarkCollectionCreateInputSchema.parse(input)).toThrow();
        });

        it('should reject input containing lifecycleState', () => {
            // Arrange
            const input = { ...VALID_CREATE_INPUT, lifecycleState: 'ACTIVE' };

            // Act & Assert
            expect(() => UserBookmarkCollectionCreateInputSchema.parse(input)).toThrow();
        });

        it('should reject input containing adminInfo', () => {
            // Arrange
            const input = { ...VALID_CREATE_INPUT, adminInfo: null };

            // Act & Assert
            expect(() => UserBookmarkCollectionCreateInputSchema.parse(input)).toThrow();
        });
    });

    describe('strict mode rejects unknown fields', () => {
        it('should reject input with unknown extra field', () => {
            // Arrange
            const input = { ...VALID_CREATE_INPUT, unknownField: 'should not be allowed' };

            // Act & Assert
            expect(() => UserBookmarkCollectionCreateInputSchema.parse(input)).toThrow();
        });
    });

    describe('field boundary validation', () => {
        it('should accept name of exactly 1 character', () => {
            // Arrange
            const input = { ...VALID_CREATE_INPUT, name: 'X' };

            // Act & Assert
            expect(() => UserBookmarkCollectionCreateInputSchema.parse(input)).not.toThrow();
        });

        it('should accept name of exactly 60 characters', () => {
            // Arrange
            const input = { ...VALID_CREATE_INPUT, name: 'A'.repeat(60) };

            // Act & Assert
            expect(() => UserBookmarkCollectionCreateInputSchema.parse(input)).not.toThrow();
        });

        it('should reject name of 61 characters', () => {
            // Arrange
            const input = { ...VALID_CREATE_INPUT, name: 'A'.repeat(61) };

            // Act & Assert
            expect(() => UserBookmarkCollectionCreateInputSchema.parse(input)).toThrow();
        });

        it('should accept description of exactly 300 characters', () => {
            // Arrange
            const input = { ...VALID_CREATE_INPUT, description: 'A'.repeat(300) };

            // Act & Assert
            expect(() => UserBookmarkCollectionCreateInputSchema.parse(input)).not.toThrow();
        });

        it('should reject description of 301 characters', () => {
            // Arrange
            const input = { ...VALID_CREATE_INPUT, description: 'A'.repeat(301) };

            // Act & Assert
            expect(() => UserBookmarkCollectionCreateInputSchema.parse(input)).toThrow();
        });

        it('should accept icon of exactly 40 characters', () => {
            // Arrange
            const input = { ...VALID_CREATE_INPUT, icon: 'A'.repeat(40) };

            // Act & Assert
            expect(() => UserBookmarkCollectionCreateInputSchema.parse(input)).not.toThrow();
        });

        it('should reject icon of 41 characters', () => {
            // Arrange
            const input = { ...VALID_CREATE_INPUT, icon: 'A'.repeat(41) };

            // Act & Assert
            expect(() => UserBookmarkCollectionCreateInputSchema.parse(input)).toThrow();
        });

        it('should accept valid hex color', () => {
            // Arrange
            const input = { ...VALID_CREATE_INPUT, color: '#42A5F5' };

            // Act & Assert
            expect(() => UserBookmarkCollectionCreateInputSchema.parse(input)).not.toThrow();
        });

        it('should reject invalid hex color', () => {
            // Arrange
            const input = { ...VALID_CREATE_INPUT, color: 'blue' };

            // Act & Assert
            expect(() => UserBookmarkCollectionCreateInputSchema.parse(input)).toThrow();
        });
    });
});

// ============================================================================
// UPDATE INPUT TESTS
// ============================================================================

describe('UserBookmarkCollectionUpdateInputSchema', () => {
    describe('valid input', () => {
        it('should accept empty object (all fields optional)', () => {
            // Act & Assert
            expect(() => UserBookmarkCollectionUpdateInputSchema.parse({})).not.toThrow();
        });

        it('should accept partial update with name only', () => {
            // Arrange
            const input = { name: 'Nuevo Nombre' };

            // Act & Assert
            expect(() => UserBookmarkCollectionUpdateInputSchema.parse(input)).not.toThrow();
        });

        it('should accept partial update with description only', () => {
            // Arrange
            const input = { description: 'Nueva descripcion' };

            // Act & Assert
            expect(() => UserBookmarkCollectionUpdateInputSchema.parse(input)).not.toThrow();
        });

        it('should accept partial update with color only', () => {
            // Arrange
            const input = { color: '#42A5F5' };

            // Act & Assert
            expect(() => UserBookmarkCollectionUpdateInputSchema.parse(input)).not.toThrow();
        });

        it('should accept partial update with icon only', () => {
            // Arrange
            const input = { icon: 'Star' };

            // Act & Assert
            expect(() => UserBookmarkCollectionUpdateInputSchema.parse(input)).not.toThrow();
        });

        it('should accept update with all editable fields', () => {
            // Arrange
            const input = {
                name: 'Actualizado',
                description: 'Descripcion actualizada',
                color: '#42A5F5',
                icon: 'Bookmark'
            };

            // Act & Assert
            expect(() => UserBookmarkCollectionUpdateInputSchema.parse(input)).not.toThrow();
        });

        it('should accept null for nullable optional fields', () => {
            // Arrange
            const input = { description: null, color: null, icon: null };

            // Act & Assert
            expect(() => UserBookmarkCollectionUpdateInputSchema.parse(input)).not.toThrow();
        });
    });

    describe('excluded fields are rejected', () => {
        it('should reject input containing userId', () => {
            // Arrange
            const input = { name: 'OK', userId: '550e8400-e29b-41d4-a716-446655440001' };

            // Act & Assert
            expect(() => UserBookmarkCollectionUpdateInputSchema.parse(input)).toThrow();
        });

        it('should reject input containing id', () => {
            // Arrange
            const input = { name: 'OK', id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' };

            // Act & Assert
            expect(() => UserBookmarkCollectionUpdateInputSchema.parse(input)).toThrow();
        });

        it('should reject input containing createdAt', () => {
            // Arrange
            const input = { name: 'OK', createdAt: new Date() };

            // Act & Assert
            expect(() => UserBookmarkCollectionUpdateInputSchema.parse(input)).toThrow();
        });

        it('should reject input containing lifecycleState', () => {
            // Arrange
            const input = { name: 'OK', lifecycleState: 'ACTIVE' };

            // Act & Assert
            expect(() => UserBookmarkCollectionUpdateInputSchema.parse(input)).toThrow();
        });
    });

    describe('strict mode rejects unknown fields', () => {
        it('should reject input with unknown extra field', () => {
            // Arrange
            const input = { name: 'OK', unknownField: 'should not be allowed' };

            // Act & Assert
            expect(() => UserBookmarkCollectionUpdateInputSchema.parse(input)).toThrow();
        });
    });

    describe('field boundary validation still applies when field is provided', () => {
        it('should reject name longer than 60 characters', () => {
            // Arrange
            const input = { name: 'A'.repeat(61) };

            // Act & Assert
            expect(() => UserBookmarkCollectionUpdateInputSchema.parse(input)).toThrow();
        });

        it('should reject description longer than 300 characters', () => {
            // Arrange
            const input = { description: 'A'.repeat(301) };

            // Act & Assert
            expect(() => UserBookmarkCollectionUpdateInputSchema.parse(input)).toThrow();
        });

        it('should reject invalid color format', () => {
            // Arrange
            const input = { color: 'not-a-color' };

            // Act & Assert
            expect(() => UserBookmarkCollectionUpdateInputSchema.parse(input)).toThrow();
        });

        it('should reject icon longer than 40 characters', () => {
            // Arrange
            const input = { icon: 'A'.repeat(41) };

            // Act & Assert
            expect(() => UserBookmarkCollectionUpdateInputSchema.parse(input)).toThrow();
        });
    });
});
