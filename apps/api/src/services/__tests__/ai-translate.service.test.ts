import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGenerateText = vi.fn();

vi.mock('@repo/db', () => ({
    getDb: vi.fn()
}));

// Use dynamic import for schemas to avoid import resolution issues
vi.mock('@repo/db/schemas', () => ({
    accommodations: { id: { name: 'id' } },
    destinations: { id: { name: 'id' } },
    events: { id: { name: 'id' } },
    posts: { id: { name: 'id' } }
}));

vi.mock('../ai-service.factory.js', () => ({
    createConfiguredAiService: vi.fn()
}));

// ---------------------------------------------------------------------------
// Dynamic imports after mocks
// ---------------------------------------------------------------------------

const { getDb } = await import('@repo/db');
const { createConfiguredAiService } = await import('../ai-service.factory.js');
const { translateEntity, persistTranslations } = await import('../ai-translate.service.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_ACCOMMODATION_FIELDS = {
    name: 'Cabaña del Río',
    summary: 'Hermosa cabaña junto al río Uruguay',
    description: 'Una cabaña acogedora con todas las comodidades',
    richDescription: 'Incluye parrilla, pileta y quincho'
};

function setupAiServiceMock(translatedText = 'Translated text') {
    (createConfiguredAiService as Mock).mockResolvedValue({
        generateText: mockGenerateText,
        streamText: vi.fn()
    });

    mockGenerateText.mockResolvedValue({
        text: translatedText,
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
        provider: 'stub',
        model: 'stub-model',
        finishReason: 'stop'
    });
}

// ============================================================================
// translateEntity
// ============================================================================

describe('translateEntity', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('when translating accommodation fields', () => {
        it('should translate all fields to English and Portuguese', async () => {
            // Arrange
            setupAiServiceMock('Translated');

            // Act
            const result = await translateEntity({
                entityType: 'accommodation',
                entityId: 'test-uuid',
                fields: VALID_ACCOMMODATION_FIELDS
            });

            // Assert
            expect(result.entityId).toBe('test-uuid');
            expect(result.translations).toHaveLength(8); // 4 fields × 2 locales

            // Verify English translations
            const enResults = result.translations.filter((t) => t.locale === 'en');
            expect(enResults).toHaveLength(4);
            for (const t of enResults) {
                expect(t.success).toBe(true);
                expect(t.translatedText).toBe('Translated');
            }

            // Verify Portuguese translations
            const ptResults = result.translations.filter((t) => t.locale === 'pt');
            expect(ptResults).toHaveLength(4);
            for (const t of ptResults) {
                expect(t.success).toBe(true);
                expect(t.translatedText).toBe('Translated');
            }
        });

        it('should call aiService.generateText with feature=translate and correct locale', async () => {
            // Arrange
            setupAiServiceMock('River Cabin');

            // Act
            await translateEntity({
                entityType: 'accommodation',
                entityId: 'test-uuid',
                fields: { name: 'Cabaña del Río' }
            });

            // Assert
            expect(mockGenerateText).toHaveBeenCalledTimes(2); // 1 field × 2 locales
            const enCall = mockGenerateText.mock.calls.find(
                (call: unknown[]) => (call[0] as Record<string, unknown>)?.locale === 'en'
            );
            expect(enCall).toBeDefined();
            const ptCall = mockGenerateText.mock.calls.find(
                (call: unknown[]) => (call[0] as Record<string, unknown>)?.locale === 'pt'
            );
            expect(ptCall).toBeDefined();
        });

        it('should skip empty or whitespace-only fields', async () => {
            // Arrange
            setupAiServiceMock();

            // Act
            const result = await translateEntity({
                entityType: 'accommodation',
                entityId: 'test-uuid',
                fields: {
                    name: 'Cabaña del Río',
                    summary: '   ',
                    description: ''
                }
            });

            // Assert — only name should be translated (not empty summary, not empty description)
            expect(result.translations).toHaveLength(2); // 1 field × 2 locales
        });

        it('should handle translation failure gracefully', async () => {
            // Arrange
            mockGenerateText.mockRejectedValueOnce(new Error('API error'));
            mockGenerateText.mockResolvedValueOnce({
                text: 'Cabana',
                usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            });
            (createConfiguredAiService as Mock).mockResolvedValue({
                generateText: mockGenerateText,
                streamText: vi.fn()
            });

            // Act
            const result = await translateEntity({
                entityType: 'accommodation',
                entityId: 'test-uuid',
                fields: { name: 'Cabaña' }
            });

            // Assert — EN fails, PT succeeds
            const enResult = result.translations.find((t) => t.locale === 'en');
            expect(enResult?.success).toBe(false);
            expect(enResult?.translatedText).toBe('Cabaña'); // falls back to original

            const ptResult = result.translations.find((t) => t.locale === 'pt');
            expect(ptResult?.success).toBe(true);
        });

        it('should support custom targetLocales', async () => {
            // Arrange
            setupAiServiceMock('Cabin');

            // Act
            const result = await translateEntity({
                entityType: 'accommodation',
                entityId: 'test-uuid',
                fields: { name: 'Cabaña' },
                targetLocales: ['en']
            });

            // Assert
            expect(result.translations).toHaveLength(1); // 1 field × 1 locale
            expect(result.translations[0]?.locale).toBe('en');
        });
    });

    describe('when validating entity types', () => {
        it('should translate destination fields', async () => {
            setupAiServiceMock('Translated');

            const result = await translateEntity({
                entityType: 'destination',
                entityId: 'test-uuid',
                fields: {
                    name: 'Concepción del Uruguay',
                    summary: 'Ciudad histórica',
                    description: 'Fundada en 1783'
                }
            });

            expect(result.translations).toHaveLength(6); // 3 fields × 2 locales
        });

        it('should translate event fields', async () => {
            setupAiServiceMock('Translated');

            const result = await translateEntity({
                entityType: 'event',
                entityId: 'test-uuid',
                fields: {
                    name: 'Fiesta del Río',
                    summary: 'Evento anual',
                    description: 'Celebración tradicional'
                }
            });

            expect(result.translations).toHaveLength(6); // 3 fields × 2 locales
        });

        it('should translate post fields', async () => {
            setupAiServiceMock('Translated');

            const result = await translateEntity({
                entityType: 'post',
                entityId: 'test-uuid',
                fields: {
                    title: 'Guía turística',
                    summary: 'Resumen de actividades',
                    content: 'Texto completo...'
                }
            });

            expect(result.translations).toHaveLength(6); // 3 fields × 2 locales
        });
    });
});

// ============================================================================
// persistTranslations
// ============================================================================

describe('persistTranslations', () => {
    const mockGetDb = getDb as Mock;
    const mockUpdate = vi.fn().mockReturnThis();
    const mockSet = vi.fn().mockReturnThis();
    const mockWhere = vi.fn().mockReturnThis();
    const mockFrom = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockLimit = vi.fn().mockReturnThis();

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetDb.mockReturnValue({
            select: mockSelect,
            update: mockUpdate,
            from: mockFrom,
            where: mockWhere,
            eq: vi.fn()
        });
        mockSelect.mockReturnValue({ from: mockFrom });
        mockFrom.mockReturnValue({ where: mockWhere });
        mockWhere.mockReturnValue({ limit: mockLimit });
        mockLimit.mockResolvedValue([{ translationMeta: {} }]);
        mockUpdate.mockReturnValue({ set: mockSet });
        mockSet.mockReturnValue({ where: mockWhere });
    });

    it('should update i18n columns with translated values', async () => {
        // Arrange
        const fieldValues = { name: 'Cabaña del Río', summary: 'Hermosa cabaña' };
        const translations = [
            { fieldType: 'name', locale: 'en', translatedText: 'River Cabin', success: true },
            { fieldType: 'name', locale: 'pt', translatedText: 'Cabana do Rio', success: true },
            {
                fieldType: 'summary',
                locale: 'en',
                translatedText: 'Beautiful cabin',
                success: true
            },
            { fieldType: 'summary', locale: 'pt', translatedText: 'Bela cabana', success: true }
        ];

        // Act
        await persistTranslations(
            'accommodation',
            'test-uuid',
            fieldValues,
            translations,
            'stub',
            'stub-model'
        );

        // Assert
        expect(mockSet).toHaveBeenCalled();
        const setArg = mockSet.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(setArg).toBeDefined();
        expect(setArg.nameI18n).toBeDefined();
        expect(setArg.summaryI18n).toBeDefined();
        expect(setArg.translationMeta).toBeDefined();
    });

    it('should preserve Spanish values in I18nText', async () => {
        const fieldValues = { name: 'Cabaña del Río' };
        const translations = [
            { fieldType: 'name', locale: 'en', translatedText: 'River Cabin', success: true }
        ];

        await persistTranslations(
            'accommodation',
            'test-uuid',
            fieldValues,
            translations,
            'stub',
            'stub-model'
        );

        const setArg = mockSet.mock.calls[0]?.[0] as Record<string, unknown>;
        const nameI18n = setArg.nameI18n as Record<string, string>;
        expect(nameI18n.es).toBe('Cabaña del Río');
    });

    it('should track autoTranslated status in metadata', async () => {
        const fieldValues = { name: 'Cabaña' };
        const translations = [
            { fieldType: 'name', locale: 'en', translatedText: 'Cabin', success: true }
        ];

        await persistTranslations(
            'accommodation',
            'test-uuid',
            fieldValues,
            translations,
            'stub',
            'stub-model'
        );

        const setArg = mockSet.mock.calls[0]?.[0] as Record<string, unknown>;
        const meta = setArg.translationMeta as Record<
            string,
            Record<string, { autoTranslated: boolean }>
        >;
        expect(meta.name?.en?.autoTranslated).toBe(true);
    });

    it('should mark failed translations properly', async () => {
        mockLimit.mockResolvedValue([{ translationMeta: {} }]);

        const fieldValues = { name: 'Cabaña' };
        const translations = [
            {
                fieldType: 'name',
                locale: 'en',
                translatedText: 'Cabaña',
                success: false,
                error: 'API error'
            }
        ];

        await persistTranslations(
            'accommodation',
            'test-uuid',
            fieldValues,
            translations,
            'stub',
            'stub-model'
        );

        const setArg = mockSet.mock.calls[0]?.[0] as Record<string, unknown>;
        const meta = setArg.translationMeta as Record<
            string,
            Record<string, { autoTranslated: boolean }>
        >;
        expect(meta.name?.en?.autoTranslated).toBe(false);
    });
});
