/**
 * Unit tests for the single translation writer (HOS-2658, spec §8.4).
 *
 * The database is mocked at `getDb().transaction`: the transaction callback
 * receives a fake `tx` whose `select(...).from(...).where(...).for('update')`
 * chain resolves the stored row, and whose `update(...).set(...)` records the
 * written values.
 */
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

vi.mock('@repo/db', () => ({ getDb: vi.fn() }));
vi.mock('@repo/db/schemas', () => ({
    accommodations: { id: { name: 'id' }, translationMeta: { name: 'translation_meta' } },
    venues: { id: { name: 'id' }, translationMeta: { name: 'translation_meta' } }
}));

const { getDb } = await import('@repo/db');
const { writeTranslationPairs } = await import('../translation-pair-writer.js');

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const FIXED_NOW = '2026-11-26T12:00:00.000Z';

interface FakeDb {
    readonly forMock: Mock;
    readonly setMock: Mock;
    readonly updateMock: Mock;
}

function mockStoredRow(row: Record<string, unknown> | undefined): FakeDb {
    const forMock = vi.fn().mockResolvedValue(row ? [row] : []);
    const setMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    const updateMock = vi.fn().mockReturnValue({ set: setMock });
    const tx = {
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({ for: forMock })
            })
        }),
        update: updateMock
    };
    (getDb as Mock).mockReturnValue({
        transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx))
    });
    return { forMock, setMock, updateMock };
}

function writtenSet(db: FakeDb): Record<string, unknown> {
    return db.setMock.mock.calls[0]?.[0] as Record<string, unknown>;
}

describe('writeTranslationPairs', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date(FIXED_NOW));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('reads the row FOR UPDATE inside a transaction', async () => {
        // Arrange
        const db = mockStoredRow({ translationMeta: {}, descriptionI18n: null });

        // Act
        await writeTranslationPairs({
            entityType: 'accommodation',
            entityId: 'acc-1',
            writes: [
                {
                    field: 'description',
                    locale: 'en',
                    value: 'Fixed',
                    origin: 'manual',
                    sourceHash: HASH_A
                }
            ]
        });

        // Assert
        expect(db.forMock).toHaveBeenCalledWith('update');
    });

    it('writes a manual pair leaving es and the other locale untouched (AC-6)', async () => {
        // Arrange
        const db = mockStoredRow({
            descriptionI18n: { es: 'Casa linda', en: 'Nice house', pt: 'Casa bonita' },
            translationMeta: {
                description: {
                    pt: { autoTranslated: true, translatedAt: 'x', sourceHash: HASH_B }
                }
            }
        });

        // Act
        const result = await writeTranslationPairs({
            entityType: 'accommodation',
            entityId: 'acc-1',
            writes: [
                {
                    field: 'description',
                    locale: 'en',
                    value: 'Fixed',
                    origin: 'manual',
                    sourceHash: HASH_A
                }
            ]
        });

        // Assert
        expect(result).toEqual({
            written: [{ field: 'description', locale: 'en' }],
            skippedManual: [],
            found: true
        });
        expect(writtenSet(db)).toEqual({
            descriptionI18n: { es: 'Casa linda', en: 'Fixed', pt: 'Casa bonita' },
            translationMeta: {
                description: {
                    en: { autoTranslated: false, translatedAt: FIXED_NOW, sourceHash: HASH_A },
                    pt: { autoTranslated: true, translatedAt: 'x', sourceHash: HASH_B }
                }
            }
        });
    });

    it('persists an empty manual value as a legitimate edit (AC-9)', async () => {
        // Arrange
        const db = mockStoredRow({
            summaryI18n: { es: 'Resumen', en: 'Summary', pt: 'Resumo' },
            translationMeta: {}
        });

        // Act
        await writeTranslationPairs({
            entityType: 'accommodation',
            entityId: 'acc-1',
            writes: [
                { field: 'summary', locale: 'pt', value: '', origin: 'manual', sourceHash: HASH_A }
            ]
        });

        // Assert
        expect(writtenSet(db)).toEqual({
            summaryI18n: { es: 'Resumen', en: 'Summary', pt: '' },
            translationMeta: {
                summary: {
                    pt: { autoTranslated: false, translatedAt: FIXED_NOW, sourceHash: HASH_A }
                }
            }
        });
    });

    it('skips an ai write onto a MANUAL pair and writes the rest (AC-7)', async () => {
        // Arrange
        const manualMeta = { autoTranslated: false, translatedAt: 'then', sourceHash: HASH_B };
        const db = mockStoredRow({
            descriptionI18n: { es: 'Viejo', en: 'Hand made', pt: '' },
            translationMeta: { description: { en: manualMeta } }
        });

        // Act
        const result = await writeTranslationPairs({
            entityType: 'accommodation',
            entityId: 'acc-1',
            writes: [
                {
                    field: 'description',
                    locale: 'en',
                    value: 'AI en',
                    origin: 'ai',
                    sourceHash: HASH_A,
                    provider: 'stub',
                    model: 'stub-model'
                },
                {
                    field: 'description',
                    locale: 'pt',
                    value: 'AI pt',
                    origin: 'ai',
                    sourceHash: HASH_A,
                    provider: 'stub',
                    model: 'stub-model'
                }
            ],
            sourceMirror: { description: 'Nuevo' }
        });

        // Assert
        expect(result).toEqual({
            written: [{ field: 'description', locale: 'pt' }],
            skippedManual: [{ field: 'description', locale: 'en' }],
            found: true
        });
        expect(writtenSet(db)).toEqual({
            descriptionI18n: { es: 'Nuevo', en: 'Hand made', pt: 'AI pt' },
            translationMeta: {
                description: {
                    en: manualMeta,
                    pt: {
                        autoTranslated: true,
                        translatedAt: FIXED_NOW,
                        provider: 'stub',
                        model: 'stub-model',
                        sourceHash: HASH_A
                    }
                }
            }
        });
    });

    it('writes an ai pair over a MANUAL pair when overrideManual is set (AC-16)', async () => {
        // Arrange
        const db = mockStoredRow({
            nameI18n: { es: 'Casa', en: 'Hand', pt: 'Mão' },
            translationMeta: {
                name: {
                    en: { autoTranslated: false, translatedAt: 'then' },
                    pt: { autoTranslated: false, translatedAt: 'then' }
                }
            }
        });

        // Act
        const result = await writeTranslationPairs({
            entityType: 'accommodation',
            entityId: 'acc-1',
            writes: [
                {
                    field: 'name',
                    locale: 'en',
                    value: 'House',
                    origin: 'ai',
                    sourceHash: HASH_A,
                    provider: 'stub',
                    model: 'm',
                    overrideManual: true
                }
            ],
            sourceMirror: { name: 'Casa' }
        });

        // Assert
        expect(result.written).toEqual([{ field: 'name', locale: 'en' }]);
        expect(writtenSet(db)).toEqual({
            nameI18n: { es: 'Casa', en: 'House', pt: 'Mão' },
            translationMeta: {
                name: {
                    en: {
                        autoTranslated: true,
                        translatedAt: FIXED_NOW,
                        provider: 'stub',
                        model: 'm',
                        sourceHash: HASH_A
                    },
                    pt: { autoTranslated: false, translatedAt: 'then' }
                }
            }
        });
    });

    it('starts a missing column from empty locales and issues no update when everything is skipped', async () => {
        // Arrange
        const db = mockStoredRow({
            nameI18n: null,
            translationMeta: { name: { en: { autoTranslated: false, translatedAt: 'then' } } }
        });

        // Act
        const result = await writeTranslationPairs({
            entityType: 'accommodation',
            entityId: 'acc-1',
            writes: [{ field: 'name', locale: 'en', value: 'AI', origin: 'ai', sourceHash: HASH_A }]
        });

        // Assert
        expect(result).toEqual({
            written: [],
            skippedManual: [{ field: 'name', locale: 'en' }],
            found: true
        });
        expect(db.updateMock).not.toHaveBeenCalled();
    });

    it('returns found:false and writes nothing when the row does not exist', async () => {
        // Arrange
        const db = mockStoredRow(undefined);

        // Act
        const result = await writeTranslationPairs({
            entityType: 'accommodation',
            entityId: 'missing',
            writes: [
                { field: 'name', locale: 'en', value: 'x', origin: 'manual', sourceHash: HASH_A }
            ]
        });

        // Assert
        expect(result).toEqual({ written: [], skippedManual: [], found: false });
        expect(db.updateMock).not.toHaveBeenCalled();
    });

    it('gates entryNoteI18n with the 200-character venue schema and writes nothing', async () => {
        // Arrange
        const db = mockStoredRow({
            entryNoteI18n: { es: 'Gratis', en: '', pt: '' },
            translationMeta: {}
        });

        // Act
        const attempt = writeTranslationPairs({
            entityType: 'venue',
            entityId: 'venue-1',
            writes: [
                {
                    field: 'entryNote',
                    locale: 'en',
                    value: 'x'.repeat(201),
                    origin: 'manual',
                    sourceHash: HASH_A
                }
            ]
        });

        // Assert
        await expect(attempt).rejects.toThrow(/malformed i18n value for column "entryNoteI18n"/);
        expect(db.updateMock).not.toHaveBeenCalled();
    });

    it('rejects a malformed source hash through TranslationMetaSchema', async () => {
        // Arrange
        const db = mockStoredRow({ nameI18n: null, translationMeta: {} });

        // Act
        const attempt = writeTranslationPairs({
            entityType: 'accommodation',
            entityId: 'acc-1',
            writes: [
                {
                    field: 'name',
                    locale: 'en',
                    value: 'x',
                    origin: 'manual',
                    sourceHash: 'NOT-A-HASH'
                }
            ]
        });

        // Assert
        await expect(attempt).rejects.toThrow(/malformed translationMeta/);
        expect(db.updateMock).not.toHaveBeenCalled();
    });

    it('rejects a field that is not translatable for the entity type', async () => {
        // Arrange
        mockStoredRow({ translationMeta: {} });

        // Act
        const attempt = writeTranslationPairs({
            entityType: 'accommodation',
            entityId: 'acc-1',
            writes: [
                {
                    field: 'entryNote',
                    locale: 'en',
                    value: 'x',
                    origin: 'manual',
                    sourceHash: HASH_A
                }
            ]
        });

        // Assert
        await expect(attempt).rejects.toThrow(/"entryNote" is not translatable for accommodation/);
    });
});
