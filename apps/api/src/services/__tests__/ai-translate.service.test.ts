import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TranslateResult } from '../ai-translate.service.js';

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
    posts: { id: { name: 'id' } },
    pointsOfInterest: { id: { name: 'id' } }
}));

vi.mock('../ai-service.factory.js', () => ({
    createConfiguredAiService: vi.fn()
}));

// ---------------------------------------------------------------------------
// Dynamic imports after mocks
// ---------------------------------------------------------------------------

const { getDb } = await import('@repo/db');
const { createConfiguredAiService } = await import('../ai-service.factory.js');
const { translateEntity, persistTranslations, loadTranslatableFields } = await import(
    '../ai-translate.service.js'
);

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

        // HOS-328: the route writes ONE ai_usage row per request whose tokens
        // are the sum across every provider call. `totalTokens` alone is not
        // enough — ai_usage prices input and output tokens at different rates,
        // so the split has to survive the aggregation.
        it('should sum promptTokens and completionTokens across every provider call', async () => {
            // Arrange: 4 fields × 2 locales = 8 calls, each 50 in / 30 out.
            setupAiServiceMock('Translated');

            // Act
            const result = await translateEntity({
                entityType: 'accommodation',
                entityId: 'test-uuid',
                fields: VALID_ACCOMMODATION_FIELDS
            });

            // Assert
            expect(result.translations).toHaveLength(8);
            expect(result.promptTokens).toBe(50 * 8);
            expect(result.completionTokens).toBe(30 * 8);
            expect(result.totalTokens).toBe(80 * 8);
        });

        it('should not count tokens for calls that failed', async () => {
            // Arrange: 1 field × 2 locales; the second call throws, so only the
            // first contributes tokens (a failed call keeps the source text and
            // must not be billed).
            setupAiServiceMock('Translated');
            // `vi.clearAllMocks()` in beforeEach clears calls but NOT queued
            // once-values or implementations, so scope both explicitly here.
            mockGenerateText.mockReset();
            mockGenerateText
                .mockResolvedValueOnce({
                    text: 'Translated',
                    usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
                    provider: 'stub',
                    model: 'stub-model',
                    finishReason: 'stop'
                })
                .mockRejectedValueOnce(new Error('provider exhausted'));

            // Act
            const result = await translateEntity({
                entityType: 'accommodation',
                entityId: 'test-uuid',
                fields: { name: 'Cabaña del Río' }
            });

            // Assert
            expect(result.translations).toHaveLength(2);
            expect(result.translations.filter((t) => t.success)).toHaveLength(1);
            expect(result.promptTokens).toBe(50);
            expect(result.completionTokens).toBe(30);
        });

        it('should report zero tokens and no provider when every call fails', async () => {
            // Arrange: this is what makes the route record status 'error'
            // instead of consuming a quota unit.
            (createConfiguredAiService as Mock).mockResolvedValue({
                generateText: mockGenerateText,
                streamText: vi.fn()
            });
            // `mockReset` first so this persistent rejection cannot be masked by
            // a previously installed implementation, and `Once` twice (1 field ×
            // 2 locales) so it cannot leak into a later test.
            mockGenerateText.mockReset();
            mockGenerateText
                .mockRejectedValueOnce(new Error('provider exhausted'))
                .mockRejectedValueOnce(new Error('provider exhausted'));

            // Act
            const result = await translateEntity({
                entityType: 'accommodation',
                entityId: 'test-uuid',
                fields: { name: 'Cabaña del Río' }
            });

            // Assert
            expect(result.translations).toHaveLength(2);
            expect(result.translations.some((t) => t.success)).toBe(false);
            expect(result.promptTokens).toBe(0);
            expect(result.completionTokens).toBe(0);
            expect(result.provider).toBe('');
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

        it('should translate pointOfInterest fields (HOS-143 G-6)', async () => {
            setupAiServiceMock('Translated');

            const result = await translateEntity({
                entityType: 'pointOfInterest',
                entityId: 'test-uuid',
                fields: {
                    name: 'Puente Internacional Gral. Artigas',
                    description: 'Une Concepción del Uruguay con Paysandú'
                }
            });

            expect(result.translations).toHaveLength(4); // 2 fields × 2 locales
        });
    });
});

// ============================================================================
// loadTranslatableFields — pointOfInterest `name` fallback (HOS-143 G-6)
// ============================================================================

describe('loadTranslatableFields — pointOfInterest name fallback (HOS-143 G-6)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('reads `name` from nameI18n.es when the row has no plain name column', async () => {
        // Arrange — POI rows never carry a plain `name` column (HOS-138); only
        // `description` is a plain column alongside `descriptionI18n`.
        (getDb as Mock).mockReturnValue({
            select: vi.fn().mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                nameI18n: { es: 'Puente Internacional', en: '', pt: '' },
                                description: 'Une dos países'
                            }
                        ])
                    })
                })
            })
        });

        // Act
        const fields = await loadTranslatableFields('pointOfInterest', 'test-uuid', 'es');

        // Assert — both fields resolved: name via the i18n fallback, description
        // via its plain column, exactly like the other four entity types.
        expect(fields).toEqual({
            name: 'Puente Internacional',
            description: 'Une dos países'
        });
    });

    it('omits `name` when nameI18n is null (no crash, no empty-string field)', async () => {
        (getDb as Mock).mockReturnValue({
            select: vi.fn().mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi
                            .fn()
                            .mockResolvedValue([{ nameI18n: null, description: 'Solo esto' }])
                    })
                })
            })
        });

        const fields = await loadTranslatableFields('pointOfInterest', 'test-uuid', 'es');

        expect(fields).toEqual({ description: 'Solo esto' });
    });
});

// ============================================================================
// translateEntity — source locale & missing-only (SPEC-212 follow-up)
// ============================================================================

describe('translateEntity — source locale and direction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('derives target locales from the source locale (en source → es + pt)', async () => {
        // Arrange
        setupAiServiceMock('traducido');

        // Act — editor works in English; translate OUT of English.
        const result = await translateEntity({
            entityType: 'accommodation',
            entityId: 'test-uuid',
            fields: { name: 'River Cabin' },
            sourceLocale: 'en'
        });

        // Assert — only es and pt, never en (the source is not translated).
        const locales = result.translations.map((t) => t.locale).sort();
        expect(locales).toEqual(['es', 'pt']);
    });

    it('builds a prompt naming the source and target languages', async () => {
        // Arrange
        setupAiServiceMock('traduzido');

        // Act
        await translateEntity({
            entityType: 'accommodation',
            entityId: 'test-uuid',
            fields: { name: 'River Cabin' },
            sourceLocale: 'en',
            targetLocales: ['pt']
        });

        // Assert — prompt reflects the actual direction, not a hardcoded Spanish source.
        const call = mockGenerateText.mock.calls[0]?.[0] as { prompt: string };
        expect(call.prompt).toContain('English');
        expect(call.prompt).toContain('Portuguese');
    });

    it('with onlyMissing, skips locales that already have a value', async () => {
        // Arrange — existing row has en filled, pt empty.
        setupAiServiceMock('traducido');
        (getDb as Mock).mockReturnValue({
            select: vi.fn().mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi
                            .fn()
                            .mockResolvedValue([
                                { nameI18n: { es: 'Cabaña', en: 'Cabin', pt: '' } }
                            ])
                    })
                })
            })
        });

        // Act
        const result = await translateEntity({
            entityType: 'accommodation',
            entityId: 'test-uuid',
            fields: { name: 'Cabaña' },
            sourceLocale: 'es',
            onlyMissing: true
        });

        // Assert — en already present is skipped; only pt is translated.
        expect(result.translations).toHaveLength(1);
        expect(result.translations[0]?.locale).toBe('pt');
        expect(result.translations.every((t) => t.locale !== 'en')).toBe(true);
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
        const translations: TranslateResult[] = [
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
        const translations: TranslateResult[] = [
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
        const translations: TranslateResult[] = [
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

    it('does NOT record meta or a value for a failed translation (so it can be retried)', async () => {
        mockLimit.mockResolvedValue([{ translationMeta: {} }]);

        const fieldValues = { name: 'Cabaña' };
        const translations: TranslateResult[] = [
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

        // A failed translation must NOT be flagged autoTranslated:false — that
        // would alias a transient failure as a permanent manual override and
        // block future retries. No meta entry is written for the failed locale.
        const meta = setArg.translationMeta as Record<
            string,
            Record<string, { autoTranslated: boolean }>
        >;
        expect(meta.name?.en).toBeUndefined();

        // The en value stays empty so the renderer falls back to Spanish.
        const i18nValue = setArg.nameI18n as { es: string; en: string; pt: string };
        expect(i18nValue.en).toBe('');
        expect(i18nValue.es).toBe('Cabaña');
    });

    it('writes the source value to the given source locale (en source)', async () => {
        // The editor worked in English, so the English column is the source of
        // truth and Portuguese is the translated target.
        const fieldValues = { name: 'River Cabin' };
        const translations: TranslateResult[] = [
            { fieldType: 'name', locale: 'pt', translatedText: 'Cabana do Rio', success: true }
        ];

        await persistTranslations(
            'accommodation',
            'test-uuid',
            fieldValues,
            translations,
            'stub',
            'stub-model',
            'en'
        );

        const setArg = mockSet.mock.calls[0]?.[0] as Record<string, unknown>;
        const nameI18n = setArg.nameI18n as { es: string; en: string; pt: string };
        expect(nameI18n.en).toBe('River Cabin');
        expect(nameI18n.pt).toBe('Cabana do Rio');
        // The canonical Spanish column must NOT be touched when it is not a
        // result locale (regression guard: locale typing must stay honest).
        expect(nameI18n.es).toBe('');
    });

    it('preserves a manual override (autoTranslated:false) against re-translation', async () => {
        // Existing en is a human override; an auto-translate run must NOT clobber it.
        mockLimit.mockResolvedValue([
            {
                nameI18n: { es: 'Cabaña', en: 'Hand-curated cabin', pt: '' },
                translationMeta: { name: { en: { autoTranslated: false, translatedAt: 'x' } } }
            }
        ]);

        const translations: TranslateResult[] = [
            { fieldType: 'name', locale: 'en', translatedText: 'Auto cabin', success: true }
        ];

        await persistTranslations(
            'accommodation',
            'test-uuid',
            { name: 'Cabaña' },
            translations,
            'stub',
            'stub-model'
        );

        const setArg = mockSet.mock.calls[0]?.[0] as Record<string, unknown>;
        const i18nValue = setArg.nameI18n as { es: string; en: string; pt: string };
        expect(i18nValue.en).toBe('Hand-curated cabin');
        const meta = setArg.translationMeta as Record<
            string,
            Record<string, { autoTranslated: boolean }>
        >;
        expect(meta.name?.en?.autoTranslated).toBe(false);
    });

    it('refuses to persist a malformed translated value instead of writing it ungated (HOS-190 regression)', async () => {
        // Regression guard: `persistTranslations` used to build `updateSet`
        // straight from `result.translatedText` (AI-provider output) and
        // write it via `db.update()` with zero runtime validation. A
        // provider response that doesn't come back as a plain string (here
        // simulated by force-casting a number past the `TranslateResult`
        // type) must now be rejected by the `I18nTextSchema` gate BEFORE any
        // DB write — never persisted silently.
        const fieldValues = { name: 'Cabaña' };
        const translations: TranslateResult[] = [
            {
                fieldType: 'name',
                locale: 'en',
                translatedText: 12345 as unknown as string,
                success: true
            }
        ];

        await expect(
            persistTranslations(
                'accommodation',
                'test-uuid',
                fieldValues,
                translations,
                'stub',
                'stub-model'
            )
        ).rejects.toThrow(/malformed i18n value/i);

        // The gate must fire before the write — db.update() never runs.
        expect(mockUpdate).not.toHaveBeenCalled();
    });
});

// ============================================================================
// translateEntity — URL protection (HOS-1030)
//
// The bug: the model reads the PATH segment of a URL as ordinary prose and
// "translates" it — `[SMOKELINK](https://ejemplo-smoke.test/pagina)` came
// back correct in Portuguese but with the URL rewritten to
// `https://ejemplo-smoke.test/page` in English, a path that does not exist
// on the host's server.
//
// These tests never assert anything about what the mocked model does to the
// SURROUNDING prose (that's not this service's job to verify) — they only
// assert the DESTINATION URL that comes back is byte-identical to the one
// that went in, in every target locale. `mockEchoingGenerateText` treats
// `ai-translate.service.ts` as a black box: it reads whatever text the
// service put in the prompt (which, if the placeholder defense works, is a
// PLACEHOLDER-bearing string with no real URL inside it — a "well-behaved"
// model has nothing left to mistranslate) and echoes it back tagged by
// locale, so a real URL only ever reappears in the result via this module's
// OWN restoreUrls() step, never because the mock happened to preserve it.
// ============================================================================

describe('translateEntity — URL protection (HOS-1030)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    /**
     * Configures `generateText` to behave like a well-behaved translator: it
     * reads the field text out of the prompt (the part after the last blank
     * line `buildTranslationPrompt` inserts) and echoes it back tagged with
     * the target locale, leaving every character — including any
     * placeholder token — untouched. This is the ONLY way a real URL can
     * end up in the final result: this service's own restoreUrls() must
     * substitute it back in from the placeholder.
     */
    function mockEchoingGenerateText(): void {
        (createConfiguredAiService as Mock).mockResolvedValue({
            generateText: mockGenerateText,
            streamText: vi.fn()
        });
        mockGenerateText.mockImplementation(
            async ({ prompt, locale }: { prompt: string; locale: string }) => {
                const segments = prompt.split('\n\n');
                const sourceText = segments[segments.length - 1] ?? prompt;
                return {
                    text: `[${locale}] ${sourceText}`,
                    usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
                    provider: 'stub',
                    model: 'stub-model',
                    finishReason: 'stop'
                };
            }
        );
    }

    it('keeps the destination of a markdown-link URL byte-identical across every locale (SMOKELINK)', async () => {
        // Arrange
        mockEchoingGenerateText();
        const url = 'https://ejemplo-smoke.test/pagina';

        // Act
        const result = await translateEntity({
            entityType: 'accommodation',
            entityId: 'test-uuid',
            fields: { description: `Reservá en [SMOKELINK](${url}) para más info` },
            targetLocales: ['en', 'pt']
        });

        // Assert — the URL must round-trip EXACTLY, in both target locales.
        expect(result.translations).toHaveLength(2);
        for (const translation of result.translations) {
            expect(translation.success).toBe(true);
            expect(translation.translatedText).toContain(`(${url})`);
            expect(translation.translatedText).not.toContain('HOSPEDA_URL');
        }
    });

    it('keeps the destination of a bare (non-markdown) URL byte-identical', async () => {
        mockEchoingGenerateText();
        const url = 'https://ejemplo-smoke.test/reservas';

        const result = await translateEntity({
            entityType: 'accommodation',
            entityId: 'test-uuid',
            fields: { summary: `Visitá ${url} para reservar` },
            targetLocales: ['en']
        });

        expect(result.translations[0]?.success).toBe(true);
        expect(result.translations[0]?.translatedText).toContain(url);
        expect(result.translations[0]?.translatedText).not.toContain('HOSPEDA_URL');
    });

    it('keeps multiple links in the same text distinct and byte-identical', async () => {
        mockEchoingGenerateText();
        const bookingUrl = 'https://ejemplo-smoke.test/reservas';
        const pricesUrl = 'https://ejemplo-smoke.test/precios';

        const result = await translateEntity({
            entityType: 'accommodation',
            entityId: 'test-uuid',
            fields: {
                description: `Mirá [Reservas](${bookingUrl}) y también [Precios](${pricesUrl})`
            },
            targetLocales: ['en']
        });

        const translatedText = result.translations[0]?.translatedText ?? '';
        expect(result.translations[0]?.success).toBe(true);
        expect(translatedText).toContain(`(${bookingUrl})`);
        expect(translatedText).toContain(`(${pricesUrl})`);
    });

    it('keeps a URL with a query string and fragment byte-identical', async () => {
        mockEchoingGenerateText();
        const url = 'https://ejemplo-smoke.test/pagina?ref=host&promo=verano#seccion';

        const result = await translateEntity({
            entityType: 'accommodation',
            entityId: 'test-uuid',
            fields: { summary: `Detalles en ${url} ahora` },
            targetLocales: ['en']
        });

        expect(result.translations[0]?.success).toBe(true);
        expect(result.translations[0]?.translatedText).toContain(url);
    });

    it('keeps a URL whose path contains balanced parentheses byte-identical', async () => {
        mockEchoingGenerateText();
        // Wikipedia-style URL with its own parens — must not be truncated at
        // the first ")" the way a naive "stop at )" scan would.
        const url = 'https://es.wikipedia.org/wiki/Concepci%C3%B3n_del_Uruguay_(Argentina)';

        const result = await translateEntity({
            entityType: 'accommodation',
            entityId: 'test-uuid',
            fields: { description: `Más info: [wiki](${url}) sobre la ciudad` },
            targetLocales: ['en']
        });

        expect(result.translations[0]?.success).toBe(true);
        expect(result.translations[0]?.translatedText).toContain(`(${url})`);
    });

    it('fails the field/locale (falling back to the source text) when the model drops the URL placeholder', async () => {
        // Arrange — a misbehaving model that strips the placeholder entirely
        // instead of echoing it back. This must NEVER leak a raw
        // `{{{HOSPEDA_URL_0}}}` token, and must NEVER silently persist text
        // with the URL missing — it must fail closed.
        (createConfiguredAiService as Mock).mockResolvedValue({
            generateText: mockGenerateText,
            streamText: vi.fn()
        });
        mockGenerateText.mockResolvedValue({
            text: 'Book here for more info', // placeholder silently dropped
            usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
            provider: 'stub',
            model: 'stub-model',
            finishReason: 'stop'
        });
        const url = 'https://ejemplo-smoke.test/pagina';
        const source = `Reservá en [SMOKELINK](${url}) para más info`;

        // Act
        const result = await translateEntity({
            entityType: 'accommodation',
            entityId: 'test-uuid',
            fields: { description: source },
            targetLocales: ['en']
        });

        // Assert — treated as an ordinary translation failure: falls back to
        // the untouched Spanish source, never to the model's corrupted text.
        expect(result.translations[0]?.success).toBe(false);
        expect(result.translations[0]?.translatedText).toBe(source);
        expect(result.translations[0]?.error).toMatch(/URL placeholder mismatch/i);
    });

    it('fails closed when the model duplicates a URL placeholder instead of echoing it once', async () => {
        (createConfiguredAiService as Mock).mockResolvedValue({
            generateText: mockGenerateText,
            streamText: vi.fn()
        });
        mockGenerateText.mockImplementation(
            async ({ prompt }: { prompt: string; locale: string }) => {
                const segments = prompt.split('\n\n');
                const sourceText = segments[segments.length - 1] ?? prompt;
                // Duplicate the (single) placeholder — corrupted, not a clean
                // 1:1 round trip, so it must still fail closed.
                return {
                    text: `${sourceText} ${sourceText}`,
                    usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
                    provider: 'stub',
                    model: 'stub-model',
                    finishReason: 'stop'
                };
            }
        );
        const url = 'https://ejemplo-smoke.test/pagina';
        const source = `Ver [SMOKELINK](${url})`;

        const result = await translateEntity({
            entityType: 'accommodation',
            entityId: 'test-uuid',
            fields: { description: source },
            targetLocales: ['en']
        });

        expect(result.translations[0]?.success).toBe(false);
        expect(result.translations[0]?.translatedText).toBe(source);
    });

    it('never persists a raw placeholder token when the mismatch fallback fires', async () => {
        (createConfiguredAiService as Mock).mockResolvedValue({
            generateText: mockGenerateText,
            streamText: vi.fn()
        });
        mockGenerateText.mockResolvedValue({
            text: 'texto sin marcador', // model dropped the placeholder
            usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
            provider: 'stub',
            model: 'stub-model',
            finishReason: 'stop'
        });

        const result = await translateEntity({
            entityType: 'accommodation',
            entityId: 'test-uuid',
            fields: { description: 'Visitá https://ejemplo-smoke.test/pagina hoy' },
            targetLocales: ['en']
        });

        for (const translation of result.translations) {
            expect(translation.translatedText).not.toContain('HOSPEDA_URL');
            expect(translation.translatedText).not.toContain('{{{');
        }
    });

    it('does not affect fields with no URL at all', async () => {
        mockEchoingGenerateText();

        const result = await translateEntity({
            entityType: 'accommodation',
            entityId: 'test-uuid',
            fields: { name: 'Cabaña del Río' },
            targetLocales: ['en']
        });

        expect(result.translations[0]?.success).toBe(true);
        expect(result.translations[0]?.translatedText).toBe('[en] Cabaña del Río');
    });
});
