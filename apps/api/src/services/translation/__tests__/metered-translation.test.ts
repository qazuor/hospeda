/**
 * Unit tests for `runMeteredTranslation` (HOS-2658, spec §9.4).
 *
 * The gate, the engine, the writer path and the meter are mocked; the tests
 * assert the ORDER of the steps (manual pairs dropped before the gate and the
 * provider) and exactly which `ai_usage` rows a run produces.
 */
import { ServiceErrorCode, VerticalEnum } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

vi.mock('@repo/db', () => ({ getDb: vi.fn() }));
vi.mock('@repo/db/schemas', () => ({
    venues: { id: { name: 'id' }, translationMeta: { name: 'translation_meta' } },
    accommodations: { id: { name: 'id' }, translationMeta: { name: 'translation_meta' } }
}));
vi.mock('../../ai-translate.service.js', () => ({
    translateEntity: vi.fn(),
    persistTranslations: vi.fn()
}));
vi.mock('../../../utils/listing-access/ai-quota-gate.js', () => ({ enforceAiQuota: vi.fn() }));
vi.mock('../../../utils/ai-usage-metering.js', () => ({ meterAiUsage: vi.fn() }));

const { getDb } = await import('@repo/db');
const { translateEntity, persistTranslations } = await import('../../ai-translate.service.js');
const { enforceAiQuota } = await import('../../../utils/listing-access/ai-quota-gate.js');
const { meterAiUsage } = await import('../../../utils/ai-usage-metering.js');
const { runMeteredTranslation, TRANSLATE_QUOTA_VERTICAL } = await import(
    '../metered-translation.js'
);

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const MANUAL = { autoTranslated: false, translatedAt: '2026-11-01T00:00:00.000Z' };

function mockMeta(meta: Record<string, unknown> | null): void {
    (getDb as Mock).mockReturnValue({
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi
                        .fn()
                        .mockResolvedValue(meta === null ? [] : [{ translationMeta: meta }])
                })
            })
        })
    });
}

function engineResult(
    translations: Array<{ fieldType: string; locale: 'en' | 'pt'; success: boolean }>
) {
    return {
        entityId: 'venue-1',
        translations: translations.map((t) => ({
            ...t,
            translatedText: t.success ? `T-${t.locale}` : 'source',
            ...(t.success ? {} : { error: 'boom' })
        })),
        totalTokens: 80,
        promptTokens: 50,
        completionTokens: 30,
        provider: 'stub',
        model: 'stub-model'
    };
}

const baseInput = {
    trigger: 'on-save' as const,
    entityType: 'venue' as const,
    entityId: 'venue-1',
    vertical: VerticalEnum.VENUE,
    billedUserId: OWNER_ID,
    fields: { description: 'Barra y música' }
};

describe('runMeteredTranslation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (enforceAiQuota as Mock).mockResolvedValue(undefined);
        (persistTranslations as Mock).mockResolvedValue({
            written: [
                { field: 'description', locale: 'en' },
                { field: 'description', locale: 'pt' }
            ],
            skippedManual: [],
            found: true
        });
    });

    it('returns nothing-to-do without gate, provider or meter when every pair is MANUAL (AC-8)', async () => {
        // Arrange
        mockMeta({ description: { en: MANUAL, pt: MANUAL } });

        // Act
        const outcome = await runMeteredTranslation(baseInput);

        // Assert
        expect(outcome).toEqual({ outcome: 'nothing-to-do' });
        expect(enforceAiQuota).not.toHaveBeenCalled();
        expect(translateEntity).not.toHaveBeenCalled();
        expect(meterAiUsage).not.toHaveBeenCalled();
    });

    it('sends only the non-manual pair to the provider and meters one success row (AC-7)', async () => {
        // Arrange
        mockMeta({ description: { en: MANUAL } });
        (translateEntity as Mock).mockResolvedValue(
            engineResult([{ fieldType: 'description', locale: 'pt', success: true }])
        );
        (persistTranslations as Mock).mockResolvedValue({
            written: [{ field: 'description', locale: 'pt' }],
            skippedManual: [],
            found: true
        });

        // Act
        const outcome = await runMeteredTranslation(baseInput);

        // Assert
        expect(outcome).toEqual({ outcome: 'translated', written: 1, failed: 0 });
        expect(enforceAiQuota).toHaveBeenCalledWith({
            userId: OWNER_ID,
            vertical: VerticalEnum.VENUE,
            feature: 'translate',
            entitlementKey: 'ai_translate',
            limitKey: 'max_ai_translate_per_month'
        });
        expect(translateEntity).toHaveBeenCalledWith({
            entityType: 'venue',
            entityId: 'venue-1',
            fields: { description: 'Barra y música' },
            sourceLocale: 'es',
            targetLocales: ['en', 'pt'],
            skipPairs: new Set(['description:en'])
        });
        expect(persistTranslations).toHaveBeenCalledWith(
            'venue',
            'venue-1',
            { description: 'Barra y música' },
            expect.any(Array),
            'stub',
            'stub-model',
            'es',
            undefined
        );
        expect(meterAiUsage).toHaveBeenCalledTimes(1);
        expect((meterAiUsage as Mock).mock.calls[0]?.[0]).toEqual({
            userId: OWNER_ID,
            feature: 'translate',
            provider: 'stub',
            model: 'stub-model',
            promptTokens: 50,
            completionTokens: 30,
            latencyMs: expect.any(Number),
            status: 'success',
            logContext: { entityType: 'venue', entityId: 'venue-1', trigger: 'on-save' }
        });
    });

    it('propagates LIMIT_REACHED from the gate without calling the provider (AC-3/AC-18)', async () => {
        // Arrange
        mockMeta({});
        (enforceAiQuota as Mock).mockRejectedValue(
            new ServiceError(ServiceErrorCode.LIMIT_REACHED, 'Limit reached', {
                limitKey: 'max_ai_translate_per_month',
                currentCount: 200,
                maxAllowed: 200
            })
        );

        // Act
        const attempt = runMeteredTranslation(baseInput);

        // Assert
        await expect(attempt).rejects.toMatchObject({ code: ServiceErrorCode.LIMIT_REACHED });
        expect(translateEntity).not.toHaveBeenCalled();
        expect(persistTranslations).not.toHaveBeenCalled();
        expect(meterAiUsage).not.toHaveBeenCalled();
    });

    it('meters the spend as error and rethrows when persistence throws', async () => {
        // Arrange
        mockMeta({});
        (translateEntity as Mock).mockResolvedValue(
            engineResult([
                { fieldType: 'description', locale: 'en', success: true },
                { fieldType: 'description', locale: 'pt', success: true }
            ])
        );
        (persistTranslations as Mock).mockRejectedValue(new Error('malformed'));

        // Act
        const attempt = runMeteredTranslation(baseInput);

        // Assert
        await expect(attempt).rejects.toThrow('malformed');
        expect(meterAiUsage).toHaveBeenCalledTimes(1);
        expect((meterAiUsage as Mock).mock.calls[0]?.[0]).toEqual({
            userId: OWNER_ID,
            feature: 'translate',
            provider: 'stub',
            model: 'stub-model',
            promptTokens: 50,
            completionTokens: 30,
            latencyMs: expect.any(Number),
            status: 'error',
            logContext: { entityType: 'venue', entityId: 'venue-1', trigger: 'on-save' }
        });
    });

    it('returns all-failed and writes no success row when every call fails (AC-5/AC-19)', async () => {
        // Arrange
        mockMeta({});
        (translateEntity as Mock).mockResolvedValue(
            engineResult([
                { fieldType: 'description', locale: 'en', success: false },
                { fieldType: 'description', locale: 'pt', success: false }
            ])
        );
        (persistTranslations as Mock).mockResolvedValue({
            written: [],
            skippedManual: [],
            found: true
        });

        // Act
        const outcome = await runMeteredTranslation(baseInput);

        // Assert
        expect(outcome).toEqual({ outcome: 'all-failed' });
        expect(meterAiUsage).not.toHaveBeenCalled();
    });

    it('with overrideManual sends MANUAL pairs to the provider and asks the writer to override them (AC-16)', async () => {
        // Arrange
        mockMeta({ description: { en: MANUAL } });
        (translateEntity as Mock).mockResolvedValue(
            engineResult([{ fieldType: 'description', locale: 'en', success: true }])
        );

        // Act
        await runMeteredTranslation({
            ...baseInput,
            trigger: 'button',
            targetLocales: ['en'],
            overrideManual: true
        });

        // Assert
        expect((translateEntity as Mock).mock.calls[0]?.[0].skipPairs).toEqual(new Set());
        expect((persistTranslations as Mock).mock.calls[0]?.[7]).toEqual(
            new Set(['description:en'])
        );
    });

    it('returns nothing-to-do without a gate call when the row does not exist or no source is set', async () => {
        // Arrange
        mockMeta(null);

        // Act
        const missingRow = await runMeteredTranslation(baseInput);
        const emptySource = await runMeteredTranslation({ ...baseInput, fields: { name: '  ' } });

        // Assert
        expect(missingRow).toEqual({ outcome: 'nothing-to-do' });
        expect(emptySource).toEqual({ outcome: 'nothing-to-do' });
        expect(enforceAiQuota).not.toHaveBeenCalled();
    });
});

describe('TRANSLATE_QUOTA_VERTICAL', () => {
    it('meters every legacy protected entity type under ACCOMMODATION (OQ-3)', () => {
        expect(TRANSLATE_QUOTA_VERTICAL).toEqual({
            accommodation: VerticalEnum.ACCOMMODATION,
            destination: VerticalEnum.ACCOMMODATION,
            event: VerticalEnum.ACCOMMODATION,
            post: VerticalEnum.ACCOMMODATION
        });
    });
});
