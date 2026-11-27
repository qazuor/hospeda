/**
 * Unit tests for the owner-facing listing translation operations (HOS-2658).
 */
import { ServiceErrorCode, VerticalEnum } from '@repo/schemas';
import { computeTranslationSourceHash, ServiceError } from '@repo/service-core';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

vi.mock('@repo/db', () => ({ getDb: vi.fn() }));
vi.mock('@repo/db/schemas', () => ({
    venues: { id: { name: 'id' } },
    accommodations: { id: { name: 'id' } }
}));
vi.mock('../translation-pair-writer.js', () => ({ writeTranslationPairs: vi.fn() }));
vi.mock('../metered-translation.js', () => ({ runMeteredTranslation: vi.fn() }));
vi.mock('../listing-translation-state.js', () => ({
    getListingTranslationState: vi.fn(),
    LISTING_TRANSLATION_QUOTA_VERTICAL: {
        accommodation: 'accommodation',
        venue: 'venue',
        experience: 'experience'
    }
}));
vi.mock('../../../utils/listing-access/ai-quota-gate.js', () => ({ enforceAiQuota: vi.fn() }));

const { getDb } = await import('@repo/db');
const { writeTranslationPairs } = await import('../translation-pair-writer.js');
const { runMeteredTranslation } = await import('../metered-translation.js');
const { getListingTranslationState } = await import('../listing-translation-state.js');
const { enforceAiQuota } = await import('../../../utils/listing-access/ai-quota-gate.js');
const { writeManualTranslation, translateListingFieldWithAi } = await import(
    '../listing-translation.service.js'
);

const OWNER_ID = '55555555-5555-4555-8555-555555555555';
const LISTING_ID = '66666666-6666-4666-8666-666666666666';
const STATE = { listingId: LISTING_ID, vertical: 'venue', ai: { status: 'available' }, fields: [] };

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

async function caught(promise: Promise<unknown>): Promise<ServiceError> {
    try {
        await promise;
    } catch (error) {
        if (error instanceof ServiceError) return error;
        throw error;
    }
    throw new Error('expected a ServiceError');
}

describe('writeManualTranslation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getListingTranslationState as Mock).mockResolvedValue(STATE);
        (writeTranslationPairs as Mock).mockResolvedValue({
            written: [{ field: 'description', locale: 'en' }],
            skippedManual: [],
            found: true
        });
    });

    it('writes one manual pair with the current source hash and never calls the gate (AC-6)', async () => {
        // Arrange
        mockRow({ id: LISTING_ID, ownerId: OWNER_ID, description: 'Parrilla frente al río' });

        // Act
        const result = await writeManualTranslation({
            vertical: 'venue',
            listingId: LISTING_ID,
            field: 'description',
            locale: 'en',
            value: 'Fixed'
        });

        // Assert
        expect(result).toEqual(STATE);
        expect(writeTranslationPairs).toHaveBeenCalledWith({
            entityType: 'venue',
            entityId: LISTING_ID,
            writes: [
                {
                    field: 'description',
                    locale: 'en',
                    value: 'Fixed',
                    origin: 'manual',
                    sourceHash: computeTranslationSourceHash({ text: 'Parrilla frente al río' })
                        .hash
                }
            ]
        });
        expect(enforceAiQuota).not.toHaveBeenCalled();
        expect(runMeteredTranslation).not.toHaveBeenCalled();
        expect(getListingTranslationState).toHaveBeenCalledWith({
            vertical: 'venue',
            listingId: LISTING_ID
        });
    });

    it('throws NOT_FOUND when the listing row does not exist', async () => {
        // Arrange
        mockRow(undefined);

        // Act
        const error = await caught(
            writeManualTranslation({
                vertical: 'venue',
                listingId: LISTING_ID,
                field: 'name',
                locale: 'pt',
                value: ''
            })
        );

        // Assert
        expect(error.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(writeTranslationPairs).not.toHaveBeenCalled();
    });
});

describe('translateListingFieldWithAi', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getListingTranslationState as Mock).mockResolvedValue(STATE);
        (runMeteredTranslation as Mock).mockResolvedValue({
            outcome: 'translated',
            written: 1,
            failed: 0
        });
    });

    it('runs the metered button translation billed to the owner and returns the state (AC-16)', async () => {
        // Arrange
        mockRow({ id: LISTING_ID, ownerId: OWNER_ID, description: 'Parrilla frente al río' });

        // Act
        const result = await translateListingFieldWithAi({
            vertical: 'venue',
            listingId: LISTING_ID,
            field: 'description',
            locales: ['en']
        });

        // Assert
        expect(result).toEqual(STATE);
        expect(runMeteredTranslation).toHaveBeenCalledWith({
            trigger: 'button',
            entityType: 'venue',
            entityId: LISTING_ID,
            vertical: VerticalEnum.VENUE,
            billedUserId: OWNER_ID,
            fields: { description: 'Parrilla frente al río' },
            targetLocales: ['en'],
            overrideManual: true
        });
    });

    it('defaults to both locales', async () => {
        // Arrange
        mockRow({ id: LISTING_ID, ownerId: OWNER_ID, name: 'Bar' });

        // Act
        await translateListingFieldWithAi({
            vertical: 'venue',
            listingId: LISTING_ID,
            field: 'name'
        });

        // Assert
        expect((runMeteredTranslation as Mock).mock.calls[0]?.[0].targetLocales).toEqual([
            'en',
            'pt'
        ]);
    });

    it('rejects an empty Spanish source with VALIDATION_ERROR NO_SOURCE_TEXT (AC-20)', async () => {
        // Arrange
        mockRow({ id: LISTING_ID, ownerId: OWNER_ID, entryNoteI18n: null });

        // Act
        const error = await caught(
            translateListingFieldWithAi({
                vertical: 'venue',
                listingId: LISTING_ID,
                field: 'entryNote'
            })
        );

        // Assert
        expect(error.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(error.details).toEqual({ reason: 'NO_SOURCE_TEXT' });
        expect(error.reason).toBe('NO_SOURCE_TEXT');
        expect(runMeteredTranslation).not.toHaveBeenCalled();
    });

    it('maps an all-failed run to PROVIDER_ERROR (AC-19)', async () => {
        // Arrange
        mockRow({ id: LISTING_ID, ownerId: OWNER_ID, name: 'Bar' });
        (runMeteredTranslation as Mock).mockResolvedValue({ outcome: 'all-failed' });

        // Act
        const error = await caught(
            translateListingFieldWithAi({ vertical: 'venue', listingId: LISTING_ID, field: 'name' })
        );

        // Assert
        expect(error.code).toBe(ServiceErrorCode.PROVIDER_ERROR);
        expect(getListingTranslationState).not.toHaveBeenCalled();
    });

    it('propagates the gate ServiceError untouched (AC-17)', async () => {
        // Arrange
        mockRow({ id: LISTING_ID, ownerId: OWNER_ID, name: 'Bar' });
        (runMeteredTranslation as Mock).mockRejectedValue(
            new ServiceError(ServiceErrorCode.ENTITLEMENT_REQUIRED, 'Entitlement required', {
                entitlementKey: 'ai_translate'
            })
        );

        // Act
        const error = await caught(
            translateListingFieldWithAi({ vertical: 'venue', listingId: LISTING_ID, field: 'name' })
        );

        // Assert
        expect(error.code).toBe(ServiceErrorCode.ENTITLEMENT_REQUIRED);
        expect(error.details).toEqual({ entitlementKey: 'ai_translate' });
    });
});
