/** HOS-2658 AC-22: the save-bar PATCH never carries listing translations. */
import { describe, expect, it } from 'vitest';
import { buildPatchPayload } from '../../../../src/components/listing/editor/listing-patch-payload';
import { buildEditData } from './edit-data-fixture';

/** The shared fixture leaves out the experience checklists. */
const CHECKLISTS = { whatToBring: [], requirements: [], meetingPointDirections: [] };

describe('buildPatchPayload (HOS-2658)', () => {
    it.each([
        'venue',
        'experience'
    ] as const)('sends only the changed Spanish fields for %s, never an *I18n key', (vertical) => {
        // Arrange
        const baseline = buildEditData({
            ...CHECKLISTS,
            name: 'Casa Sol',
            summary: 'Resumen',
            description: 'A'
        });
        const current = buildEditData({
            ...CHECKLISTS,
            name: 'Casa del Sol',
            summary: 'Resumen nuevo',
            description: 'B'
        });

        // Act
        const payload = buildPatchPayload({ current, baseline, vertical });

        // Assert
        expect(payload).toStrictEqual({
            name: 'Casa del Sol',
            summary: 'Resumen nuevo',
            description: 'B'
        });
    });

    it('still sends entryNoteI18n, the only Spanish source of the entry note', () => {
        // Arrange
        const baseline = buildEditData();
        const current = buildEditData({
            entryNoteI18n: { es: 'Gratis hasta la 1', en: 'stale', pt: 'stale' }
        });

        // Act
        const payload = buildPatchPayload({ current, baseline, vertical: 'venue' });

        // Assert
        expect(payload).toStrictEqual({
            entryNoteI18n: { es: 'Gratis hasta la 1', en: 'stale', pt: 'stale' }
        });
    });
});
