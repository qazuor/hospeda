/**
 * Unit tests for `readSourceText` (HOS-2658, spec §9.6).
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@repo/db/schemas', () => ({}));

const { readSourceText } = await import('../read-source-text.js');

describe('readSourceText', () => {
    it('resolves venue entryNote from entryNoteI18n.es (no plain column)', () => {
        // Arrange
        const row = {
            name: 'Bar del Puerto',
            entryNoteI18n: { es: 'Gratis hasta la 1', en: 'Free until 1', pt: '' }
        };

        // Act
        const result = readSourceText({ entityType: 'venue', row, field: 'entryNote' });

        // Assert
        expect(result).toEqual({ text: 'Gratis hasta la 1' });
    });

    it('prefers the plain column for venue name over nameI18n.es', () => {
        // Arrange
        const row = {
            name: 'Bar del Puerto',
            nameI18n: { es: 'Viejo nombre', en: 'Old name', pt: '' }
        };

        // Act
        const result = readSourceText({ entityType: 'venue', row, field: 'name' });

        // Assert
        expect(result).toEqual({ text: 'Bar del Puerto' });
    });

    it('keeps the pointOfInterest name fallback to nameI18n.es', () => {
        // Arrange
        const row = { nameI18n: { es: 'Puente Internacional', en: '', pt: '' } };

        // Act
        const result = readSourceText({ entityType: 'pointOfInterest', row, field: 'name' });

        // Assert
        expect(result).toEqual({ text: 'Puente Internacional' });
    });

    it('does not fall back when the plain column exists but is null', () => {
        // Arrange
        const row = {
            richDescription: null,
            richDescriptionI18n: { es: 'Texto viejo', en: '', pt: '' }
        };

        // Act
        const result = readSourceText({
            entityType: 'experience',
            row,
            field: 'richDescription'
        });

        // Assert
        expect(result).toEqual({ text: '' });
    });

    it('returns an empty text when neither source exists', () => {
        // Arrange / Act
        const result = readSourceText({
            entityType: 'venue',
            row: { entryNoteI18n: null },
            field: 'entryNote'
        });

        // Assert
        expect(result).toEqual({ text: '' });
    });
});
