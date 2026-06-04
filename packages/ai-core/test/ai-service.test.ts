/**
 * Tests for AiService — the public facade (SPEC-173 T-015).
 *
 * The config resolver is stubbed via `vi.mock` so no DB connection is needed.
 * All provider calls use `StubProvider` (happy path).
 *
 * ## Scenarios covered
 *
 * 1. createAiService returns a valid AiService with all required methods.
 * 2. generateText — result contract matches expected shape.
 * 3. generateText locale defaulting — when caller omits locale, defaultLocale ('es') is used.
 * 4. generateText locale override — when caller passes 'en', 'en' reaches the provider.
 * 5. generateObject — result has .object field + metadata.
 * 6. generateObject locale defaulting.
 * 7. generateObject locale override.
 * 8. extractIntent — result has kind/confidence/entities/rawQuery.
 * 9. extractIntent locale defaulting.
 * 10. extractIntent locale override.
 * 11. moderate — result has .flagged boolean.
 * 12. moderate locale defaulting.
 * 13. embed — throws NotImplementedError (V2 stub) through the service.
 * 14. AiService.engine exposes the underlying AiEngine.
 * 15. defaultLocale defaults to 'es' when createAiService omits it.
 * 16. custom defaultLocale 'pt' is used when caller omits locale.
 */

import type { AiFeatureConfig } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AiFeatureNotConfiguredError } from '../src/config/index.js';
import { createAiService } from '../src/engine/ai-service.js';
import type { AiService } from '../src/engine/ai-service.js';
import { NotImplementedError } from '../src/providers/ai-provider.interface.js';
import { StubProvider } from '../src/providers/index.js';

// ---------------------------------------------------------------------------
// Mock config resolver — no DB required
// ---------------------------------------------------------------------------

vi.mock('../src/config/resolver.js', async (importOriginal) => {
    const original = await importOriginal<typeof import('../src/config/resolver.js')>();
    return {
        ...original,
        resolveConfig: vi.fn(),
        resolveFeatureConfig: vi.fn(),
        getProviderOrder: vi.fn(),
        isFeatureKillSwitched: vi.fn()
    };
});

import * as configResolver from '../src/config/resolver.js';

const mockResolveConfig = configResolver.resolveConfig as ReturnType<typeof vi.fn>;
const mockResolveFeatureConfig = configResolver.resolveFeatureConfig as ReturnType<typeof vi.fn>;
const mockIsFeatureKillSwitched = configResolver.isFeatureKillSwitched as ReturnType<typeof vi.fn>;
const mockGetProviderOrder = configResolver.getProviderOrder as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const FEATURE_CONFIG_ENABLED: AiFeatureConfig = {
    enabled: true,
    primaryProvider: 'stub',
    fallbackChain: [],
    model: 'stub-model-v1',
    params: {}
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.clearAllMocks();
    // resolveConfig returns an empty providers map so no provider kill-switches
    // are active — preserving all existing test expectations.
    mockResolveConfig.mockResolvedValue({ providers: {}, features: {} });
    mockResolveFeatureConfig.mockResolvedValue(FEATURE_CONFIG_ENABLED);
    mockIsFeatureKillSwitched.mockImplementation((cfg: AiFeatureConfig) => !cfg.enabled);
    mockGetProviderOrder.mockImplementation(
        ({ featureConfig }: { featureConfig: AiFeatureConfig }) => ({
            providers: [featureConfig.primaryProvider, ...featureConfig.fallbackChain]
        })
    );
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a test AiService backed by a StubProvider.
 * `defaultLocale` is configurable to test locale override behaviour.
 */
function makeService(defaultLocale?: 'es' | 'en' | 'pt'): AiService {
    const stub = new StubProvider();
    return createAiService({
        getProvider: () => stub,
        defaultLocale
    });
}

/**
 * Zod schema for testing generateObject — all fields optional so
 * StubProvider's `schema.parse({})` fallback succeeds.
 */
const TestObjectSchema = z.object({
    name: z.string().optional(),
    type: z.string().optional()
});

// ---------------------------------------------------------------------------
// 1. createAiService factory
// ---------------------------------------------------------------------------

describe('createAiService', () => {
    it('should return an object with all required AiService methods', () => {
        // Arrange + Act
        const service = makeService();

        // Assert
        expect(typeof service.generateText).toBe('function');
        expect(typeof service.generateObject).toBe('function');
        expect(typeof service.extractIntent).toBe('function');
        expect(typeof service.moderate).toBe('function');
        expect(typeof service.embed).toBe('function');
        expect(service.engine).toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// 2–4. generateText
// ---------------------------------------------------------------------------

describe('generateText', () => {
    it('should return a response with text, usage, provider, model, finishReason', async () => {
        // Arrange
        const service = makeService();

        // Act
        const result = await service.generateText({
            feature: 'text_improve',
            locale: 'es',
            prompt: 'Fix grammar: "me gustas mucho"'
        });

        // Assert — StubProvider echoes the prompt
        expect(result.text).toContain('[stub:text_improve]');
        expect(result.text).toContain('Fix grammar:');
        expect(result.usage.totalTokens).toBeGreaterThan(0);
        expect(result.provider).toBe('stub');
        expect(result.model).toBe('stub-model-v1');
        expect(result.finishReason).toBe('stop');
    });

    it('should use defaultLocale when caller omits locale', async () => {
        // Arrange — service with default 'es'
        const service = makeService('es');

        // Spy on the underlying engine to capture the resolved request.
        const engineSpy = vi.spyOn(service.engine, 'generateText');

        // Act
        await service.generateText({
            feature: 'text_improve',
            prompt: 'Hello'
            // locale intentionally omitted
        });

        // Assert — engine was called with locale 'es'
        expect(engineSpy).toHaveBeenCalledWith(expect.objectContaining({ locale: 'es' }));
    });

    it("should use the caller's locale when explicitly provided, overriding defaultLocale", async () => {
        // Arrange — service default is 'es', caller passes 'en'
        const service = makeService('es');
        const engineSpy = vi.spyOn(service.engine, 'generateText');

        // Act
        await service.generateText({
            feature: 'text_improve',
            locale: 'en',
            prompt: 'Hello'
        });

        // Assert — engine was called with the overridden locale 'en'
        expect(engineSpy).toHaveBeenCalledWith(expect.objectContaining({ locale: 'en' }));
    });

    it("should use 'es' as defaultLocale when createAiService omits defaultLocale", async () => {
        // Arrange — no defaultLocale in createAiService options
        const stub = new StubProvider();
        const service = createAiService({ getProvider: () => stub });
        const engineSpy = vi.spyOn(service.engine, 'generateText');

        // Act
        await service.generateText({
            feature: 'text_improve',
            prompt: 'Hola'
            // locale omitted
        });

        // Assert — default is 'es'
        expect(engineSpy).toHaveBeenCalledWith(expect.objectContaining({ locale: 'es' }));
    });

    it('should propagate custom defaultLocale pt to the engine', async () => {
        // Arrange
        const service = makeService('pt');
        const engineSpy = vi.spyOn(service.engine, 'generateText');

        // Act
        await service.generateText({
            feature: 'text_improve',
            prompt: 'Olá'
            // locale omitted
        });

        // Assert
        expect(engineSpy).toHaveBeenCalledWith(expect.objectContaining({ locale: 'pt' }));
    });
});

// ---------------------------------------------------------------------------
// 5–7. generateObject
// ---------------------------------------------------------------------------

describe('generateObject', () => {
    it('should return a response with .object and metadata fields', async () => {
        // Arrange
        const service = makeService();

        // Act
        const result = await service.generateObject(
            {
                feature: 'search',
                locale: 'es',
                prompt: 'Hotels in Colón'
            },
            TestObjectSchema
        );

        // Assert — object passes schema, metadata present
        expect(result.object).toBeDefined();
        expect(result.usage.totalTokens).toBeGreaterThan(0);
        expect(result.provider).toBe('stub');
        expect(result.model).toBe('stub-model-v1');
        expect(result.finishReason).toBe('stop');
    });

    it('should use defaultLocale when caller omits locale', async () => {
        // Arrange
        const service = makeService('es');
        const engineSpy = vi.spyOn(service.engine, 'generateObject');

        // Act
        await service.generateObject({ feature: 'search', prompt: 'Cabañas' }, TestObjectSchema);

        // Assert
        expect(engineSpy).toHaveBeenCalledWith(
            expect.objectContaining({ locale: 'es' }),
            TestObjectSchema
        );
    });

    it("should use the caller's locale when explicitly provided", async () => {
        // Arrange
        const service = makeService('es');
        const engineSpy = vi.spyOn(service.engine, 'generateObject');

        // Act
        await service.generateObject(
            { feature: 'search', locale: 'pt', prompt: 'Pousadas' },
            TestObjectSchema
        );

        // Assert
        expect(engineSpy).toHaveBeenCalledWith(
            expect.objectContaining({ locale: 'pt' }),
            TestObjectSchema
        );
    });
});

// ---------------------------------------------------------------------------
// 8–10. extractIntent
// ---------------------------------------------------------------------------

describe('extractIntent', () => {
    it('should return an intent with kind, confidence, entities, rawQuery', async () => {
        // Arrange
        const service = makeService();

        // Act
        const result = await service.extractIntent({
            feature: 'search',
            query: 'cabaña con pileta para 4 personas',
            locale: 'es'
        });

        // Assert — StubProvider returns deterministic intent
        expect(result.kind).toBe('stub');
        expect(result.confidence).toBe(0.99);
        expect(result.entities).toEqual({});
        expect(result.rawQuery).toBe('cabaña con pileta para 4 personas');
    });

    it('should use defaultLocale when caller omits locale', async () => {
        // Arrange
        const service = makeService('es');
        const engineSpy = vi.spyOn(service.engine, 'extractIntent');

        // Act
        await service.extractIntent({
            feature: 'search',
            query: 'hoteles céntricos'
            // locale omitted
        });

        // Assert — engine request has locale 'es'
        expect(engineSpy).toHaveBeenCalledWith(expect.objectContaining({ locale: 'es' }), 'search');
    });

    it("should use the caller's locale when explicitly provided", async () => {
        // Arrange
        const service = makeService('es');
        const engineSpy = vi.spyOn(service.engine, 'extractIntent');

        // Act
        await service.extractIntent({
            feature: 'chat',
            query: 'budget hotels',
            locale: 'en'
        });

        // Assert
        expect(engineSpy).toHaveBeenCalledWith(expect.objectContaining({ locale: 'en' }), 'chat');
    });

    it('should pass the feature routing key as the second engine argument', async () => {
        // Arrange
        const service = makeService();
        const engineSpy = vi.spyOn(service.engine, 'extractIntent');

        // Act
        await service.extractIntent({
            feature: 'support',
            query: 'cómo cancelo mi reserva'
        });

        // Assert — second arg to engine.extractIntent is the feature
        expect(engineSpy).toHaveBeenCalledWith(expect.any(Object), 'support');
    });
});

// ---------------------------------------------------------------------------
// 11–12. moderate
// ---------------------------------------------------------------------------

describe('moderate', () => {
    it('should return a response with .flagged and .categories', async () => {
        // Arrange
        const service = makeService();

        // Act
        const result = await service.moderate({
            input: 'some harmless text'
        });

        // Assert — StubProvider always returns clean
        expect(result.flagged).toBe(false);
        expect(result.categories).toEqual({});
    });

    it('should use defaultLocale when caller omits locale', async () => {
        // Arrange
        const service = makeService('es');
        const engineSpy = vi.spyOn(service.engine, 'moderate');

        // Act
        await service.moderate({ input: 'texto normal' });

        // Assert — engine called with locale 'es'
        expect(engineSpy).toHaveBeenCalledWith(expect.objectContaining({ locale: 'es' }));
    });

    it("should pass the caller's locale when provided", async () => {
        // Arrange
        const service = makeService('es');
        const engineSpy = vi.spyOn(service.engine, 'moderate');

        // Act
        await service.moderate({ input: 'normal text', locale: 'en' });

        // Assert
        expect(engineSpy).toHaveBeenCalledWith(expect.objectContaining({ locale: 'en' }));
    });
});

// ---------------------------------------------------------------------------
// 13. embed — V2 stub throws NotImplementedError
// ---------------------------------------------------------------------------

describe('embed (V2 stub)', () => {
    it('should throw NotImplementedError through the service', async () => {
        // Arrange
        const service = makeService();

        // Act + Assert
        await expect(service.embed({ text: 'alojamiento familiar' })).rejects.toThrow(
            NotImplementedError
        );
    });

    it('should include the method name in the error message', async () => {
        // Arrange
        const service = makeService();

        // Act + Assert
        await expect(service.embed({ text: 'alojamiento familiar' })).rejects.toThrow('embed');
    });
});

// ---------------------------------------------------------------------------
// 14. engine property
// ---------------------------------------------------------------------------

describe('engine property', () => {
    it('should expose the underlying AiEngine with all capability methods', () => {
        // Arrange + Act
        const service = makeService();

        // Assert
        expect(typeof service.engine.generateText).toBe('function');
        expect(typeof service.engine.generateObject).toBe('function');
        expect(typeof service.engine.extractIntent).toBe('function');
        expect(typeof service.engine.moderate).toBe('function');
        expect(typeof service.engine.streamText).toBe('function');
    });
});

// ---------------------------------------------------------------------------
// 15–16. defaultLocale default value
// ---------------------------------------------------------------------------

describe('defaultLocale', () => {
    it("should default to 'es' when createAiService is called without defaultLocale", async () => {
        // Arrange
        const stub = new StubProvider();
        const service = createAiService({ getProvider: () => stub });
        const engineSpy = vi.spyOn(service.engine, 'moderate');

        // Act
        await service.moderate({ input: 'test content' });

        // Assert — default locale 'es' was injected
        expect(engineSpy).toHaveBeenCalledWith(expect.objectContaining({ locale: 'es' }));
    });

    it("should use custom defaultLocale 'pt' for all capabilities when set", async () => {
        // Arrange
        const service = makeService('pt');
        const moderateSpy = vi.spyOn(service.engine, 'moderate');
        const generateSpy = vi.spyOn(service.engine, 'generateText');

        // Act — call two different capabilities without locale
        await service.moderate({ input: 'texto em português' });
        await service.generateText({ feature: 'text_improve', prompt: 'Melhorar' });

        // Assert — both used 'pt'
        expect(moderateSpy).toHaveBeenCalledWith(expect.objectContaining({ locale: 'pt' }));
        expect(generateSpy).toHaveBeenCalledWith(expect.objectContaining({ locale: 'pt' }));
    });
});

// ---------------------------------------------------------------------------
// Error propagation
// ---------------------------------------------------------------------------

describe('error propagation', () => {
    it('should propagate AiFeatureNotConfiguredError from generateText', async () => {
        // Arrange
        mockResolveFeatureConfig.mockRejectedValue(new AiFeatureNotConfiguredError('text_improve'));
        const service = makeService();

        // Act + Assert
        await expect(
            service.generateText({ feature: 'text_improve', prompt: 'Test' })
        ).rejects.toThrow(AiFeatureNotConfiguredError);
    });
});
