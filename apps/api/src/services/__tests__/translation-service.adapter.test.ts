/**
 * Unit tests for the translation service adapter (HOS-2658, spec §9.5).
 */
import { ServiceErrorCode, VerticalEnum } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

vi.mock('../ai-translate.service', () => ({
    translateEntity: vi.fn(),
    persistTranslations: vi.fn()
}));
vi.mock('../translation/metered-translation', () => ({ runMeteredTranslation: vi.fn() }));
vi.mock('../translation/listing-translation-state', () => ({
    LISTING_TRANSLATION_QUOTA_VERTICAL: {
        accommodation: 'accommodation',
        venue: 'venue',
        experience: 'experience'
    }
}));
vi.mock('../../utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

const { translateEntity, persistTranslations } = await import('../ai-translate.service');
const { runMeteredTranslation } = await import('../translation/metered-translation');
const { apiLogger } = await import('../../utils/logger');
const { createTranslationServiceAdapter } = await import('../translation-service.adapter');

const OWNER_ID = '77777777-7777-4777-8777-777777777777';

describe('createTranslationServiceAdapter', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('routes a billed listing save through runMeteredTranslation billed to the owner', async () => {
        // Arrange
        (runMeteredTranslation as Mock).mockResolvedValue({
            outcome: 'translated',
            written: 2,
            failed: 0
        });
        const adapter = createTranslationServiceAdapter();

        // Act
        await adapter.translate({
            entityType: 'venue',
            entityId: 'venue-1',
            fields: { description: 'Barra y música' },
            billing: { vertical: 'venue', ownerId: OWNER_ID }
        });

        // Assert
        expect(runMeteredTranslation).toHaveBeenCalledWith({
            trigger: 'on-save',
            entityType: 'venue',
            entityId: 'venue-1',
            vertical: VerticalEnum.VENUE,
            billedUserId: OWNER_ID,
            fields: { description: 'Barra y música' }
        });
        expect(translateEntity).not.toHaveBeenCalled();
        expect(persistTranslations).not.toHaveBeenCalled();
    });

    it('keeps the legacy unmetered path when billing is absent', async () => {
        // Arrange
        (translateEntity as Mock).mockResolvedValue({
            entityId: 'dest-1',
            translations: [],
            totalTokens: 0,
            promptTokens: 0,
            completionTokens: 0,
            provider: 'stub',
            model: 'm'
        });
        const adapter = createTranslationServiceAdapter();

        // Act
        await adapter.translate({
            entityType: 'destination',
            entityId: 'dest-1',
            fields: { name: 'Colón' }
        });

        // Assert
        expect(runMeteredTranslation).not.toHaveBeenCalled();
        expect(translateEntity).toHaveBeenCalledWith({
            entityType: 'destination',
            entityId: 'dest-1',
            fields: { name: 'Colón' }
        });
        expect(persistTranslations).toHaveBeenCalledTimes(1);
    });

    it('logs a gate refusal at info and never throws (AC-3/AC-4)', async () => {
        // Arrange
        (runMeteredTranslation as Mock).mockRejectedValue(
            new ServiceError(ServiceErrorCode.LIMIT_REACHED, 'Limit reached')
        );
        const adapter = createTranslationServiceAdapter();

        // Act
        await adapter.translate({
            entityType: 'accommodation',
            entityId: 'acc-1',
            fields: { summary: 'Nuevo' },
            billing: { vertical: 'accommodation', ownerId: OWNER_ID }
        });

        // Assert
        expect(apiLogger.info).toHaveBeenCalledWith(
            { entityType: 'accommodation', entityId: 'acc-1', code: 'LIMIT_REACHED' },
            'listing-translation: on-save skipped by gate'
        );
        expect(apiLogger.warn).not.toHaveBeenCalled();
    });

    it('logs an all-failed run at warn with its outcome (AC-5)', async () => {
        // Arrange
        (runMeteredTranslation as Mock).mockResolvedValue({ outcome: 'all-failed' });
        const adapter = createTranslationServiceAdapter();

        // Act
        await adapter.translate({
            entityType: 'experience',
            entityId: 'exp-1',
            fields: { name: 'Kayak' },
            billing: { vertical: 'experience', ownerId: OWNER_ID }
        });

        // Assert
        expect(apiLogger.warn).toHaveBeenCalledWith(
            { entityType: 'experience', entityId: 'exp-1', outcome: 'all-failed' },
            'listing-translation: on-save run failed'
        );
    });

    it('logs an unexpected error at warn and never throws', async () => {
        // Arrange
        (runMeteredTranslation as Mock).mockRejectedValue(new Error('db down'));
        const adapter = createTranslationServiceAdapter();

        // Act
        const run = adapter.translate({
            entityType: 'venue',
            entityId: 'venue-1',
            fields: { name: 'Bar' },
            billing: { vertical: 'venue', ownerId: OWNER_ID }
        });

        // Assert
        await expect(run).resolves.toBeUndefined();
        expect(apiLogger.warn).toHaveBeenCalledWith(
            { entityType: 'venue', entityId: 'venue-1', outcome: 'error', error: 'db down' },
            'listing-translation: on-save run failed'
        );
    });

    it('skips an unknown entity type without any engine call', async () => {
        // Arrange
        const adapter = createTranslationServiceAdapter();

        // Act
        await adapter.translate({
            entityType: 'review',
            entityId: 'r-1',
            fields: { body: 'x' },
            billing: { vertical: 'venue', ownerId: OWNER_ID }
        });

        // Assert
        expect(runMeteredTranslation).not.toHaveBeenCalled();
        expect(translateEntity).not.toHaveBeenCalled();
    });
});
