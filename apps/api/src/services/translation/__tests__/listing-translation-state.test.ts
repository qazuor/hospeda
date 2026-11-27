/**
 * Unit tests for the listing translation state projection (HOS-2658, spec §8.5).
 */
import { ServiceErrorCode, VerticalEnum } from '@repo/schemas';
import { computeTranslationSourceHash } from '@repo/service-core';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

vi.mock('@repo/db', () => ({ getDb: vi.fn() }));
vi.mock('@repo/db/schemas', () => ({
    venues: { id: { name: 'id' } },
    accommodations: { id: { name: 'id' } },
    experiences: { id: { name: 'id' } }
}));
vi.mock('../../../utils/listing-access/ai-quota-gate.js', () => ({ evaluateAiQuota: vi.fn() }));
vi.mock('../../../utils/listing-access/owner-has-entitlement.js', () => ({
    ownerHasEntitlement: vi.fn()
}));
vi.mock('../../../utils/logger.js', () => ({
    apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

const { getDb } = await import('@repo/db');
const { evaluateAiQuota } = await import('../../../utils/listing-access/ai-quota-gate.js');
const { ownerHasEntitlement } = await import(
    '../../../utils/listing-access/owner-has-entitlement.js'
);
const { apiLogger } = await import('../../../utils/logger.js');
const { derivePairState, getListingTranslationState } = await import(
    '../listing-translation-state.js'
);

const hash = (text: string): string => computeTranslationSourceHash({ text }).hash;
const CASA_SOL = hash('Casa Sol');
const CASA_DEL_SOL = hash('Casa del Sol');
const AT = '2026-11-20T10:00:00.000Z';

describe('derivePairState', () => {
    it.each([
        [
            'noSource when the Spanish source is blank',
            { source: '  ', value: 'x', meta: undefined, aiStatus: 'available' },
            'noSource'
        ],
        [
            'manual for a MANUAL pair whose hash matches',
            {
                source: 'Casa Sol',
                value: 'Sun House',
                meta: { autoTranslated: false, translatedAt: AT, sourceHash: CASA_SOL },
                aiStatus: 'available'
            },
            'manual'
        ],
        [
            'stale for a MANUAL pair whose hash no longer matches (AC-11)',
            {
                source: 'Casa del Sol',
                value: 'Sun House',
                meta: { autoTranslated: false, translatedAt: AT, sourceHash: CASA_SOL },
                aiStatus: 'available'
            },
            'stale'
        ],
        [
            'manual again once the Spanish returns to the hashed text (AC-13)',
            {
                source: ' Casa Sol\r\n',
                value: 'Sun House',
                meta: { autoTranslated: false, translatedAt: AT, sourceHash: CASA_SOL },
                aiStatus: 'available'
            },
            'manual'
        ],
        [
            'manual for a legacy MANUAL pair without hash, even after a change (AC-14)',
            {
                source: 'Casa del Sol',
                value: 'Sun House',
                meta: { autoTranslated: false, translatedAt: AT },
                aiStatus: 'quota'
            },
            'manual'
        ],
        [
            'manual for a MANUAL pair cleared to empty (AC-9)',
            {
                source: 'Resumen',
                value: '',
                meta: { autoTranslated: false, translatedAt: AT, sourceHash: hash('Resumen') },
                aiStatus: 'available'
            },
            'manual'
        ],
        [
            'auto for an AUTOMATIC pair whose hash matches',
            {
                source: 'Casa del Sol',
                value: 'Sun House',
                meta: { autoTranslated: true, translatedAt: AT, sourceHash: CASA_DEL_SOL },
                aiStatus: 'quota'
            },
            'auto'
        ],
        [
            'auto for a non-empty value without hash',
            {
                source: 'Casa del Sol',
                value: 'Sun House',
                meta: { autoTranslated: true, translatedAt: AT },
                aiStatus: 'available'
            },
            'auto'
        ],
        [
            'noQuota for an AUTOMATIC pair behind the source while out of quota (AC-3)',
            {
                source: 'Casa del Sol',
                value: 'Sun House',
                meta: { autoTranslated: true, translatedAt: AT, sourceHash: CASA_SOL },
                aiStatus: 'quota'
            },
            'noQuota'
        ],
        [
            'noEntitlement for an empty pair without the plan feature (AC-4)',
            { source: 'Casa del Sol', value: '', meta: undefined, aiStatus: 'entitlement' },
            'noEntitlement'
        ],
        [
            'pending for an empty pair while AI is available (AC-5)',
            { source: 'Casa del Sol', value: '', meta: undefined, aiStatus: 'available' },
            'pending'
        ]
    ] as const)('%s', (_name, input, expected) => {
        // Arrange
        const currentHash = hash(input.source);

        // Act
        const result = derivePairState({ ...input, currentHash });

        // Assert
        expect(result).toEqual({ state: expected });
    });
});

describe('getListingTranslationState', () => {
    const OWNER_ID = '33333333-3333-4333-8333-333333333333';
    const LISTING_ID = '44444444-4444-4444-8444-444444444444';

    function mockRow(row: Record<string, unknown> | undefined): void {
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

    const venueRow = {
        id: LISTING_ID,
        ownerId: OWNER_ID,
        name: 'La Parrilla del Puerto',
        summary: 'Asado',
        description: 'Parrilla frente al río',
        richDescription: '## Menú',
        nameI18n: { es: 'La Parrilla del Puerto', en: 'The Port Grill', pt: '' },
        summaryI18n: null,
        descriptionI18n: null,
        richDescriptionI18n: { es: '## Menú', en: '## Menu', pt: '' },
        entryNoteI18n: { es: 'Gratis hasta la 1', en: 'Free until 1', pt: '' },
        translationMeta: {
            name: {
                en: {
                    autoTranslated: true,
                    translatedAt: AT,
                    sourceHash: hash('La Parrilla del Puerto')
                }
            },
            entryNote: {
                en: { autoTranslated: false, translatedAt: AT, sourceHash: hash('Gratis') }
            }
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (evaluateAiQuota as Mock).mockResolvedValue({ allowed: true });
        (ownerHasEntitlement as Mock).mockResolvedValue({ has: true });
    });

    it('projects every venue field in catalog order, including entryNote', async () => {
        // Arrange
        mockRow(venueRow);
        (evaluateAiQuota as Mock).mockResolvedValue({
            allowed: false,
            reason: 'quota',
            key: 'max_ai_translate_per_month',
            max: 200,
            count: 200
        });

        // Act
        const state = await getListingTranslationState({
            vertical: 'venue',
            listingId: LISTING_ID
        });

        // Assert
        expect(state).toEqual({
            listingId: LISTING_ID,
            vertical: 'venue',
            ai: { status: 'quota' },
            fields: [
                {
                    field: 'name',
                    source: 'La Parrilla del Puerto',
                    locales: {
                        en: { value: 'The Port Grill', state: 'auto', translatedAt: AT },
                        pt: { value: '', state: 'noQuota', translatedAt: null }
                    }
                },
                {
                    field: 'summary',
                    source: 'Asado',
                    locales: {
                        en: { value: '', state: 'noQuota', translatedAt: null },
                        pt: { value: '', state: 'noQuota', translatedAt: null }
                    }
                },
                {
                    field: 'description',
                    source: 'Parrilla frente al río',
                    locales: {
                        en: { value: '', state: 'noQuota', translatedAt: null },
                        pt: { value: '', state: 'noQuota', translatedAt: null }
                    }
                },
                {
                    field: 'richDescription',
                    source: '## Menú',
                    locales: {
                        en: { value: '## Menu', state: 'auto', translatedAt: null },
                        pt: { value: '', state: 'noQuota', translatedAt: null }
                    }
                },
                {
                    field: 'entryNote',
                    source: 'Gratis hasta la 1',
                    locales: {
                        en: { value: 'Free until 1', state: 'stale', translatedAt: AT },
                        pt: { value: '', state: 'noQuota', translatedAt: null }
                    }
                }
            ]
        });
        expect(evaluateAiQuota).toHaveBeenCalledWith({
            userId: OWNER_ID,
            vertical: VerticalEnum.VENUE,
            feature: 'translate',
            entitlementKey: 'ai_translate',
            limitKey: 'max_ai_translate_per_month'
        });
        expect(ownerHasEntitlement).toHaveBeenCalledWith({
            ownerId: OWNER_ID,
            vertical: VerticalEnum.VENUE,
            key: 'can_use_rich_description'
        });
    });

    it('drops richDescription when the owner lacks can_use_rich_description (AC-23)', async () => {
        // Arrange
        mockRow({ ...venueRow, entryNoteI18n: null });
        (ownerHasEntitlement as Mock).mockResolvedValue({ has: false });

        // Act
        const state = await getListingTranslationState({
            vertical: 'experience',
            listingId: LISTING_ID
        });

        // Assert
        expect(state.fields.map((f) => f.field)).toEqual(['name', 'summary', 'description']);
        expect(state.vertical).toBe('experience');
    });

    it('maps a missing entitlement to ai.status entitlement (AC-4)', async () => {
        // Arrange
        mockRow(venueRow);
        (evaluateAiQuota as Mock).mockResolvedValue({
            allowed: false,
            reason: 'entitlement',
            key: 'ai_translate',
            max: 0,
            count: 0
        });

        // Act
        const state = await getListingTranslationState({
            vertical: 'accommodation',
            listingId: LISTING_ID
        });

        // Assert
        expect(state.ai).toEqual({ status: 'entitlement' });
        expect(state.fields.map((f) => f.field)).toEqual([
            'name',
            'summary',
            'description',
            'richDescription'
        ]);
        expect(state.fields[1]?.locales.en.state).toBe('noEntitlement');
    });

    it('shows AI as available and warns when the availability lookup throws', async () => {
        // Arrange
        mockRow(venueRow);
        (evaluateAiQuota as Mock).mockRejectedValue(new Error('db down'));

        // Act
        const state = await getListingTranslationState({
            vertical: 'venue',
            listingId: LISTING_ID
        });

        // Assert
        expect(state.ai).toEqual({ status: 'available' });
        expect(apiLogger.warn).toHaveBeenCalledTimes(1);
    });

    it('throws NOT_FOUND when the listing row does not exist', async () => {
        // Arrange
        mockRow(undefined);

        // Act
        const attempt = getListingTranslationState({ vertical: 'venue', listingId: LISTING_ID });

        // Assert
        await expect(attempt).rejects.toMatchObject({ code: ServiceErrorCode.NOT_FOUND });
    });
});
