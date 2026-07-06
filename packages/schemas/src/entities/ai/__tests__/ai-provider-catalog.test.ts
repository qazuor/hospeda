import { describe, expect, it } from 'vitest';
import { getKnownProvider, KNOWN_PROVIDERS } from '../ai-provider-catalog.js';

describe('KNOWN_PROVIDERS', () => {
    it('should contain at least one curated provider', () => {
        // Arrange / Act / Assert
        expect(KNOWN_PROVIDERS.length).toBeGreaterThan(0);
    });

    it('should have unique provider ids', () => {
        // Arrange
        const ids = KNOWN_PROVIDERS.map((p) => p.id);

        // Act
        const uniqueIds = new Set(ids);

        // Assert
        expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have a non-empty label, apiKeyPlaceholder, baseURL and id for every provider', () => {
        // Arrange / Act / Assert
        for (const provider of KNOWN_PROVIDERS) {
            expect(provider.id.length).toBeGreaterThan(0);
            expect(provider.label.length).toBeGreaterThan(0);
            expect(provider.apiKeyPlaceholder.length).toBeGreaterThan(0);
            expect(provider.baseURL.length).toBeGreaterThan(0);
        }
    });

    it('should have at least one suggested model for every provider', () => {
        // Arrange / Act / Assert
        for (const provider of KNOWN_PROVIDERS) {
            expect(Array.isArray(provider.models)).toBe(true);
            expect(provider.models.length).toBeGreaterThan(0);
        }
    });

    it('should have a non-empty keyUrl for every provider that needs an API key', () => {
        // Arrange / Act / Assert
        for (const provider of KNOWN_PROVIDERS) {
            if (provider.needsApiKey) {
                expect(provider.keyUrl.length).toBeGreaterThan(0);
            }
        }
    });

    it('should allow an empty keyUrl for providers that do not need an API key (e.g. ollama)', () => {
        // Arrange
        const ollama = getKnownProvider('ollama');

        // Act / Assert
        expect(ollama).toBeDefined();
        expect(ollama?.needsApiKey).toBe(false);
        expect(ollama?.keyUrl).toBe('');
    });

    it('should include the well-known providers referenced by the admin credentials page', () => {
        // Arrange
        const expectedIds = [
            'openai',
            'anthropic',
            'google',
            'deepseek',
            'groq',
            'together',
            'mistral',
            'moonshot',
            'zhipu',
            'baidu',
            'ollama'
        ];

        // Act
        const actualIds = KNOWN_PROVIDERS.map((p) => p.id);

        // Assert
        for (const id of expectedIds) {
            expect(actualIds).toContain(id);
        }
    });
});

describe('getKnownProvider', () => {
    it('should return the matching provider metadata for a known id', () => {
        // Arrange
        const id = 'openai';

        // Act
        const result = getKnownProvider(id);

        // Assert
        expect(result).toBeDefined();
        expect(result?.id).toBe('openai');
        expect(result?.label).toBe('OpenAI (GPT)');
    });

    it('should return undefined when given an id not in the curated catalog', () => {
        // Arrange
        const id = 'my-fully-custom-provider';

        // Act
        const result = getKnownProvider(id);

        // Assert
        expect(result).toBeUndefined();
    });
});
