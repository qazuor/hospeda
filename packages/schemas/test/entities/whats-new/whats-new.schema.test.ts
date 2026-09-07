/**
 * Unit tests for `WhatsNewEntrySchema` and `WhatsNewEntryI18nSchema` (SPEC-175 T-001).
 *
 * Covers the Zod schema validation rules defined in
 * `packages/schemas/src/entities/whats-new/whats-new.schema.ts`.
 */
import { describe, expect, it } from 'vitest';
import {
    WhatsNewEntryI18nSchema,
    WhatsNewEntrySchema
} from '../../../src/entities/whats-new/whats-new.schema.js';

// ---------------------------------------------------------------------------
// Shared valid fixture
// ---------------------------------------------------------------------------

const VALID_ENTRY = {
    id: 'test-entry-001',
    publishedAt: '2026-05-29T00:00:00Z',
    highlight: true,
    title: { es: 'Título de prueba', en: 'Test title', pt: 'Título de teste' },
    body: { es: 'Cuerpo de prueba', en: 'Test body' }
} as const;

// ---------------------------------------------------------------------------
// WhatsNewEntryI18nSchema
// ---------------------------------------------------------------------------

describe('WhatsNewEntryI18nSchema', () => {
    describe('when given valid input', () => {
        it('should parse with es only', () => {
            // Arrange
            const input = { es: 'Texto en español' };

            // Act
            const result = WhatsNewEntryI18nSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.es).toBe('Texto en español');
                expect(result.data.en).toBeUndefined();
                expect(result.data.pt).toBeUndefined();
            }
        });

        it('should parse with all three locales', () => {
            // Arrange
            const input = { es: 'Hola', en: 'Hello', pt: 'Olá' };

            // Act
            const result = WhatsNewEntryI18nSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('when given invalid input', () => {
        it('should reject when es is missing', () => {
            // Arrange
            const input = { en: 'Hello only' };

            // Act
            const result = WhatsNewEntryI18nSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject when es is an empty string', () => {
            // Arrange
            const input = { es: '' };

            // Act
            const result = WhatsNewEntryI18nSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });
});

// ---------------------------------------------------------------------------
// WhatsNewEntrySchema — valid entry
// ---------------------------------------------------------------------------

describe('WhatsNewEntrySchema', () => {
    describe('when given a valid entry', () => {
        it('should parse a complete valid entry', () => {
            // Arrange + Act
            const result = WhatsNewEntrySchema.safeParse(VALID_ENTRY);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should default highlight to false when not provided', () => {
            // Arrange
            const input = {
                id: 'no-highlight',
                publishedAt: '2026-05-29T00:00:00Z',
                title: { es: 'Sin highlight' },
                body: { es: 'Cuerpo' }
            };

            // Act
            const result = WhatsNewEntrySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.highlight).toBe(false);
            }
        });

        it('should parse an entry without optional fields (roles, image)', () => {
            // Arrange
            const input = {
                id: 'minimal-entry',
                publishedAt: '2026-05-29T00:00:00Z',
                title: { es: 'Mínimo' },
                body: { es: 'Cuerpo mínimo' }
            };

            // Act
            const result = WhatsNewEntrySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.roles).toBeUndefined();
                expect(result.data.image).toBeUndefined();
            }
        });

        it('should parse an entry with a valid image URL', () => {
            // Arrange
            const input = {
                ...VALID_ENTRY,
                image: 'https://cdn.example.com/whats-new/screenshot.png'
            };

            // Act
            const result = WhatsNewEntrySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should parse an entry with a subset of valid roles', () => {
            // Arrange
            const input = {
                ...VALID_ENTRY,
                roles: ['ADMIN', 'SUPER_ADMIN']
            };

            // Act
            const result = WhatsNewEntrySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should parse an entry targeting only HOST and EDITOR', () => {
            // Arrange
            const input = { ...VALID_ENTRY, roles: ['HOST', 'EDITOR'] };

            // Act
            const result = WhatsNewEntrySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('when the title is invalid', () => {
        it('should reject when title.es is missing', () => {
            // Arrange — missing required `es` title
            const input = {
                ...VALID_ENTRY,
                title: { en: 'English only' }
            };

            // Act
            const result = WhatsNewEntrySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('when publishedAt is invalid', () => {
        it('should reject a non-ISO publishedAt string', () => {
            // Arrange — plain date string is not a valid ISO datetime
            const input = {
                ...VALID_ENTRY,
                publishedAt: '2026-05-29'
            };

            // Act
            const result = WhatsNewEntrySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject an arbitrary string as publishedAt', () => {
            // Arrange
            const input = { ...VALID_ENTRY, publishedAt: 'not-a-date' };

            // Act
            const result = WhatsNewEntrySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('when roles contains an unknown value', () => {
        it('should reject a role string that is not in RoleEnum at all', () => {
            // Arrange — 'UNKNOWN_ROLE' is not a real role of any kind
            const input = { ...VALID_ENTRY, roles: ['ADMIN', 'UNKNOWN_ROLE'] };

            // Act
            const result = WhatsNewEntrySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject GUEST as an audience role (never reaches the protected endpoint, HOS-964)', () => {
            // Arrange
            const input = { ...VALID_ENTRY, roles: ['GUEST'] };

            // Act
            const result = WhatsNewEntrySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject SYSTEM as an audience role (non-loginable, HOS-964)', () => {
            // Arrange
            const input = { ...VALID_ENTRY, roles: ['SYSTEM'] };

            // Act
            const result = WhatsNewEntrySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject COMMERCE_OWNER as an audience role (retiring, HOS-964)', () => {
            // Arrange
            const input = { ...VALID_ENTRY, roles: ['COMMERCE_OWNER'] };

            // Act
            const result = WhatsNewEntrySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject CLIENT_MANAGER as an audience role (owner decision 2026-09-07, not a technical exclusion)', () => {
            // Arrange
            const input = { ...VALID_ENTRY, roles: ['CLIENT_MANAGER'] };

            // Act
            const result = WhatsNewEntrySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('when roles targets a role added by HOS-964', () => {
        it('should accept USER as an audience role', () => {
            // Arrange
            const input = { ...VALID_ENTRY, roles: ['USER'] };

            // Act
            const result = WhatsNewEntrySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept GASTRONOMY_OWNER and EXPERIENCE_OWNER together', () => {
            // Arrange
            const input = { ...VALID_ENTRY, roles: ['GASTRONOMY_OWNER', 'EXPERIENCE_OWNER'] };

            // Act
            const result = WhatsNewEntrySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept SPONSOR', () => {
            // Arrange
            const input = { ...VALID_ENTRY, roles: ['SPONSOR'] };

            // Act
            const result = WhatsNewEntrySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('when id is invalid', () => {
        it('should reject an id with uppercase letters (not kebab-case)', () => {
            // Arrange
            const input = { ...VALID_ENTRY, id: 'TestEntry' };

            // Act
            const result = WhatsNewEntrySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject an id with spaces', () => {
            // Arrange
            const input = { ...VALID_ENTRY, id: 'test entry 001' };

            // Act
            const result = WhatsNewEntrySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject an id with special characters', () => {
            // Arrange
            const input = { ...VALID_ENTRY, id: 'test_entry_001' };

            // Act
            const result = WhatsNewEntrySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject an empty id string', () => {
            // Arrange
            const input = { ...VALID_ENTRY, id: '' };

            // Act
            const result = WhatsNewEntrySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('when image URL is invalid', () => {
        it('should reject a non-URL image value', () => {
            // Arrange
            const input = { ...VALID_ENTRY, image: 'not-a-url' };

            // Act
            const result = WhatsNewEntrySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });
});
