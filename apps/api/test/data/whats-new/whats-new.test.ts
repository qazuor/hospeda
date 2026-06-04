/**
 * @file whats-new.test.ts
 *
 * Tests for the curated What's New data file (SPEC-175 T-004).
 *
 * Validates that:
 * - The module imports without throwing (empty catalog is valid).
 * - An invalid fixture (missing required `es` title) fails WhatsNewCatalogSchema.parse.
 *
 * @see SPEC-175 §6.3, AC-16
 */
import { WhatsNewEntrySchema } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { whatsNewEntries } from '../../../src/data/whats-new/whats-new';

const WhatsNewCatalogSchema = z.array(WhatsNewEntrySchema).min(0);

describe('whats-new data file', () => {
    describe('module import', () => {
        it('should import whatsNewEntries without throwing', () => {
            // Assert — if the import above failed, the test file would not have loaded
            expect(whatsNewEntries).toBeDefined();
            expect(Array.isArray(whatsNewEntries)).toBe(true);
        });

        it('should export an array (empty catalog is valid)', () => {
            // Assert
            expect(whatsNewEntries.length).toBeGreaterThanOrEqual(0);
        });
    });

    describe('WhatsNewCatalogSchema validation', () => {
        it('should accept an empty array', () => {
            // Arrange & Act & Assert
            expect(() => WhatsNewCatalogSchema.parse([])).not.toThrow();
        });

        it('should accept a valid entry', () => {
            // Arrange
            const validEntry = {
                id: '2026-05-29-test-feature',
                publishedAt: '2026-05-29T00:00:00Z',
                highlight: true,
                title: { es: 'Nueva funcionalidad', en: 'New feature' },
                body: { es: 'Descripción de la funcionalidad.' }
            };

            // Act & Assert
            expect(() => WhatsNewCatalogSchema.parse([validEntry])).not.toThrow();
        });

        it('should reject an entry with missing required `es` title', () => {
            // Arrange — missing `es` in title (only has `en`)
            const invalidEntry = {
                id: '2026-05-01-bad-entry',
                publishedAt: '2026-05-01T00:00:00Z',
                highlight: false,
                title: { en: 'Title only in English' },
                body: { es: 'Cuerpo válido' }
            };

            // Act & Assert
            expect(() => WhatsNewCatalogSchema.parse([invalidEntry])).toThrow();
        });

        it('should reject an entry with missing required `es` body', () => {
            // Arrange — body has no `es`
            const invalidEntry = {
                id: '2026-05-02-bad-body',
                publishedAt: '2026-05-02T00:00:00Z',
                highlight: false,
                title: { es: 'Título válido' },
                body: { en: 'Body only in English' }
            };

            // Act & Assert
            expect(() => WhatsNewCatalogSchema.parse([invalidEntry])).toThrow();
        });

        it('should reject an entry with an invalid publishedAt (not ISO datetime)', () => {
            // Arrange
            const invalidEntry = {
                id: '2026-05-03-bad-date',
                publishedAt: 'not-a-date',
                highlight: false,
                title: { es: 'Título' },
                body: { es: 'Cuerpo' }
            };

            // Act & Assert
            expect(() => WhatsNewCatalogSchema.parse([invalidEntry])).toThrow();
        });

        it('should reject an entry with a non-kebab-case id', () => {
            // Arrange — id with uppercase letters
            const invalidEntry = {
                id: 'Entry_With_Underscores',
                publishedAt: '2026-05-04T00:00:00Z',
                highlight: false,
                title: { es: 'Título' },
                body: { es: 'Cuerpo' }
            };

            // Act & Assert
            expect(() => WhatsNewCatalogSchema.parse([invalidEntry])).toThrow();
        });

        it('should reject an entry with an unknown role value', () => {
            // Arrange
            const invalidEntry = {
                id: '2026-05-05-bad-role',
                publishedAt: '2026-05-05T00:00:00Z',
                highlight: false,
                title: { es: 'Título' },
                body: { es: 'Cuerpo' },
                roles: ['UNKNOWN_ROLE']
            };

            // Act & Assert
            expect(() => WhatsNewCatalogSchema.parse([invalidEntry])).toThrow();
        });

        it('should accept an entry with an absent roles field (universal broadcast)', () => {
            // Arrange
            const entry = {
                id: '2026-05-06-no-roles',
                publishedAt: '2026-05-06T00:00:00Z',
                highlight: false,
                title: { es: 'Para todos' },
                body: { es: 'Visible para todos los roles.' }
            };

            // Act & Assert
            expect(() => WhatsNewCatalogSchema.parse([entry])).not.toThrow();
        });
    });
});
