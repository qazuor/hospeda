/**
 * Unit tests for the staff `entryNote` pair write (HOS-2658, DL-6, DL-9).
 *
 * Regression: an admin/support PATCH carrying `entryNoteI18n = { es, en, pt }`
 * persisted only `es` and silently kept the stored `en`/`pt` (CI integration
 * `support-edit-route.test.ts > TEST:4.3:3`). The writer is mocked; the
 * post-write re-read is mocked at `getDb().select(...)`.
 */
import { computeTranslationSourceHash } from '@repo/service-core';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

vi.mock('@repo/db', () => ({ getDb: vi.fn() }));
vi.mock('@repo/db/schemas', () => ({
    venues: {
        id: { name: 'id' },
        entryNoteI18n: { name: 'entry_note_i18n' },
        translationMeta: { name: 'translation_meta' }
    }
}));
vi.mock('../translation-pair-writer.js', () => ({ writeTranslationPairs: vi.fn() }));

const { getDb } = await import('@repo/db');
const { writeTranslationPairs } = await import('../translation-pair-writer.js');
const { applyStaffEntryNotePairs } = await import('../staff-entry-note-pairs.js');

const VENUE_ID = '11111111-1111-4111-8111-111111111111';

function mockReread(row: Record<string, unknown> | undefined): void {
    (getDb as Mock).mockReturnValue({
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue(row ? [row] : [])
                })
            })
        })
    });
}

describe('applyStaffEntryNotePairs', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (writeTranslationPairs as Mock).mockResolvedValue({
            written: [],
            skippedManual: [],
            found: true
        });
    });

    it('writes the changed en/pt as MANUAL pairs hashed on the stored Spanish', async () => {
        // Arrange: the service kept the stored en/pt and wrote the new es.
        const updated = {
            id: VENUE_ID,
            entryNoteI18n: { es: 'Gratis hasta la 1', en: '', pt: '' }
        };
        const reread = {
            entryNoteI18n: { es: 'Gratis hasta la 1', en: 'Free until 1am', pt: 'Grátis até 1h' },
            translationMeta: { entryNote: { en: { autoTranslated: false } } }
        };
        mockReread(reread);
        const { hash } = computeTranslationSourceHash({ text: 'Gratis hasta la 1' });

        // Act
        const result = await applyStaffEntryNotePairs({
            venueId: VENUE_ID,
            body: { es: 'Gratis hasta la 1', en: 'Free until 1am', pt: 'Grátis até 1h' },
            updated
        });

        // Assert
        expect(writeTranslationPairs).toHaveBeenCalledWith({
            entityType: 'venue',
            entityId: VENUE_ID,
            writes: [
                {
                    field: 'entryNote',
                    locale: 'en',
                    value: 'Free until 1am',
                    origin: 'manual',
                    sourceHash: hash
                },
                {
                    field: 'entryNote',
                    locale: 'pt',
                    value: 'Grátis até 1h',
                    origin: 'manual',
                    sourceHash: hash
                }
            ]
        });
        expect(result.writtenLocales).toEqual(['en', 'pt']);
        expect(result.venue).toEqual({ ...updated, ...reread });
    });

    it('does not write a locale whose value equals the stored one (no AUTOMATIC -> MANUAL flip)', async () => {
        // Arrange
        const updated = {
            id: VENUE_ID,
            entryNoteI18n: { es: 'Nuevo', en: 'Auto en', pt: 'Viejo' }
        };
        mockReread({ entryNoteI18n: { es: 'Nuevo', en: 'Auto en', pt: 'Novo' } });

        // Act
        const result = await applyStaffEntryNotePairs({
            venueId: VENUE_ID,
            body: { es: 'Nuevo', en: 'Auto en', pt: 'Novo' },
            updated
        });

        // Assert
        const call = (writeTranslationPairs as Mock).mock.calls[0]?.[0] as {
            writes: { locale: string }[];
        };
        expect(call.writes.map((write) => write.locale)).toEqual(['pt']);
        expect(result.writtenLocales).toEqual(['pt']);
    });

    it('writes an explicit empty string as a MANUAL pair (staff cleared it)', async () => {
        // Arrange
        const updated = { id: VENUE_ID, entryNoteI18n: { es: 'Nota', en: 'Note', pt: 'Nota' } };
        mockReread({ entryNoteI18n: { es: 'Nota', en: '', pt: 'Nota' } });

        // Act
        const result = await applyStaffEntryNotePairs({
            venueId: VENUE_ID,
            body: { es: 'Nota', en: '', pt: 'Nota' },
            updated
        });

        // Assert
        expect(result.writtenLocales).toEqual(['en']);
    });

    it('is a no-op when every sent locale matches the stored row', async () => {
        // Arrange
        const updated = { id: VENUE_ID, entryNoteI18n: { es: 'Nota', en: 'Note', pt: 'Nota' } };

        // Act
        const result = await applyStaffEntryNotePairs({
            venueId: VENUE_ID,
            body: { es: 'Nota', en: 'Note', pt: 'Nota' },
            updated
        });

        // Assert
        expect(writeTranslationPairs).not.toHaveBeenCalled();
        expect(getDb).not.toHaveBeenCalled();
        expect(result).toEqual({ venue: updated, writtenLocales: [] });
    });

    it.each([
        ['absent', undefined],
        ['null', null],
        ['a string', 'Nota']
    ])('is a no-op when the body entryNoteI18n is %s', async (_label, body) => {
        // Arrange
        const updated = { id: VENUE_ID, entryNoteI18n: null };

        // Act
        const result = await applyStaffEntryNotePairs({ venueId: VENUE_ID, body, updated });

        // Assert
        expect(writeTranslationPairs).not.toHaveBeenCalled();
        expect(result).toEqual({ venue: updated, writtenLocales: [] });
    });

    it('skips a locale the body does not carry as a string', async () => {
        // Arrange
        const updated = { id: VENUE_ID, entryNoteI18n: { es: 'Nota', en: 'Note', pt: '' } };
        mockReread(undefined);

        // Act
        const result = await applyStaffEntryNotePairs({
            venueId: VENUE_ID,
            body: { es: 'Nota', pt: 'Nota pt' },
            updated
        });

        // Assert: the row vanished between writes, so the service's copy is kept.
        expect(result.writtenLocales).toEqual(['pt']);
        expect(result.venue).toBe(updated);
    });
});
