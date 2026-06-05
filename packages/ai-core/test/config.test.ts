/**
 * Tests for the ai-core config resolver module (SPEC-173 T-011).
 *
 * The storage module is stubbed entirely via `vi.mock('../src/storage/index.js')`
 * so no real database connection is required.
 *
 * ## Key scenarios covered
 *
 * 1. `resolveConfig` returns the parsed blob from storage on a cache miss.
 * 2. `resolveConfig` returns an empty default when no row exists (null storage).
 * 3. `resolveConfig` returns cached data on a second call (no extra storage read).
 * 4. `resolveFeatureConfig` returns per-feature config for a known feature.
 * 5. `resolveFeatureConfig` throws `AiFeatureNotConfiguredError` for an absent
 *    feature key.
 * 6. **R-7 cache invalidation**: after `invalidateConfigCache()` the next
 *    `resolveConfig()` reads fresh data from storage, NOT the stale cache.
 * 7. **R-7 via `saveConfig`**: after `saveConfig()` the cache is cleared and
 *    the next read is fresh.
 * 8. `getProviderOrder` returns primary + fallback in the correct order.
 * 9. `isFeatureKillSwitched` returns `true`/`false` correctly.
 *
 * Each test group resets module-scope cache state by calling
 * `invalidateConfigCache()` in `beforeEach` and re-assigns mock return values
 * to ensure isolation.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the storage module BEFORE importing the modules under test.
// ---------------------------------------------------------------------------

vi.mock('../src/storage/index.js', () => ({
    readAiSettings: vi.fn(),
    writeAiSettings: vi.fn()
}));

import type { AiFeatureConfig, AiSettingsValue } from '@repo/schemas';
import {
    AiFeatureNotConfiguredError,
    getProviderOrder,
    invalidateConfigCache,
    isFeatureKillSwitched,
    resolveConfig,
    resolveFeatureConfig,
    saveConfig
} from '../src/config/index.js';
import * as storageModule from '../src/storage/index.js';

// Typed references to the mocked functions.
const mockReadAiSettings = storageModule.readAiSettings as ReturnType<typeof vi.fn>;
const mockWriteAiSettings = storageModule.writeAiSettings as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const TEXT_IMPROVE_CONFIG: AiFeatureConfig = {
    enabled: true,
    primaryProvider: 'openai',
    fallbackChain: ['anthropic'],
    model: 'gpt-4o-mini',
    params: { temperature: 0.7 }
};

const CHAT_CONFIG: AiFeatureConfig = {
    enabled: false,
    primaryProvider: 'anthropic',
    fallbackChain: [],
    model: 'claude-3-5-sonnet-20241022',
    params: {}
};

const SEARCH_CONFIG: AiFeatureConfig = {
    enabled: true,
    primaryProvider: 'openai',
    fallbackChain: [],
    model: 'gpt-4o',
    params: {}
};

const SUPPORT_CONFIG: AiFeatureConfig = {
    enabled: true,
    primaryProvider: 'openai',
    fallbackChain: [],
    model: 'gpt-4o-mini',
    params: {}
};

/** A valid full settings blob used across multiple tests. */
const VALID_SETTINGS: AiSettingsValue = {
    providers: {
        openai: { enabled: true },
        anthropic: { enabled: true }
    },
    features: {
        text_improve: TEXT_IMPROVE_CONFIG,
        chat: CHAT_CONFIG,
        search: SEARCH_CONFIG,
        support: SUPPORT_CONFIG
    }
};

/** A second blob used to verify cache invalidation returns fresh data. */
const UPDATED_SETTINGS: AiSettingsValue = {
    providers: {
        openai: { enabled: false }
    },
    features: {
        text_improve: { ...TEXT_IMPROVE_CONFIG, model: 'gpt-4o' },
        chat: CHAT_CONFIG,
        search: SEARCH_CONFIG,
        support: SUPPORT_CONFIG
    }
};

const ACTOR_ID = 'aaaaaaaa-0000-0000-0000-000000000099';

const FAKE_DB_ROW = {
    key: 'global',
    value: VALID_SETTINGS,
    updatedAt: new Date(),
    updatedBy: ACTOR_ID,
    createdAt: new Date()
};

// ---------------------------------------------------------------------------
// Reset cache + mocks before every test for full isolation.
// ---------------------------------------------------------------------------

beforeEach(() => {
    // Clear the module-scope cache so each test starts cold.
    invalidateConfigCache();
    vi.clearAllMocks();
});

afterEach(() => {
    // Guarantee cache is clean after each test too.
    invalidateConfigCache();
});

// ---------------------------------------------------------------------------
// resolveConfig — storage reads and no-config default
// ---------------------------------------------------------------------------

describe('resolveConfig', () => {
    describe('when storage returns a valid blob', () => {
        it('should return the parsed blob on first call (cache miss)', async () => {
            // Arrange
            mockReadAiSettings.mockResolvedValue(VALID_SETTINGS);

            // Act
            const result = await resolveConfig();

            // Assert
            expect(result).toEqual(VALID_SETTINGS);
            expect(mockReadAiSettings).toHaveBeenCalledTimes(1);
        });

        it('should return cached data on second call without re-reading storage', async () => {
            // Arrange
            mockReadAiSettings.mockResolvedValue(VALID_SETTINGS);

            // Act
            const first = await resolveConfig();
            const second = await resolveConfig();

            // Assert — storage was only called once
            expect(mockReadAiSettings).toHaveBeenCalledTimes(1);
            expect(first).toEqual(VALID_SETTINGS);
            expect(second).toEqual(VALID_SETTINGS);
            // Referential equality: same cached object returned
            expect(first).toBe(second);
        });
    });

    describe('when storage returns null (no row exists yet)', () => {
        it('should return an empty default config', async () => {
            // Arrange
            mockReadAiSettings.mockResolvedValue(null);

            // Act
            const result = await resolveConfig();

            // Assert
            expect(result).toEqual({ providers: {}, features: {} });
            expect(mockReadAiSettings).toHaveBeenCalledTimes(1);
        });

        it('should cache the empty default and not call storage again', async () => {
            // Arrange
            mockReadAiSettings.mockResolvedValue(null);

            // Act
            await resolveConfig();
            await resolveConfig();

            // Assert
            expect(mockReadAiSettings).toHaveBeenCalledTimes(1);
        });
    });

    describe('when storage throws', () => {
        it('should propagate the error to the caller', async () => {
            // Arrange
            mockReadAiSettings.mockRejectedValue(new Error('DB connection lost'));

            // Act + Assert
            await expect(resolveConfig()).rejects.toThrow('DB connection lost');
        });
    });
});

// ---------------------------------------------------------------------------
// resolveFeatureConfig
// ---------------------------------------------------------------------------

describe('resolveFeatureConfig', () => {
    describe('when the feature is present in the config', () => {
        it('should return the feature config for a known feature', async () => {
            // Arrange
            mockReadAiSettings.mockResolvedValue(VALID_SETTINGS);

            // Act
            const result = await resolveFeatureConfig({ feature: 'text_improve' });

            // Assert
            expect(result).toEqual(TEXT_IMPROVE_CONFIG);
        });

        it('should return the feature config for a disabled (kill-switched) feature', async () => {
            // Arrange
            mockReadAiSettings.mockResolvedValue(VALID_SETTINGS);

            // Act — 'chat' is enabled:false
            const result = await resolveFeatureConfig({ feature: 'chat' });

            // Assert — config is returned even when disabled; the engine layer
            // decides what to do with an enabled:false feature
            expect(result).toEqual(CHAT_CONFIG);
            expect(result.enabled).toBe(false);
        });

        it('should use the cache and only call storage once for two feature lookups', async () => {
            // Arrange
            mockReadAiSettings.mockResolvedValue(VALID_SETTINGS);

            // Act
            await resolveFeatureConfig({ feature: 'text_improve' });
            await resolveFeatureConfig({ feature: 'chat' });

            // Assert — both lookups share the same cached blob
            expect(mockReadAiSettings).toHaveBeenCalledTimes(1);
        });
    });

    describe('when the feature is absent from the config', () => {
        it('should throw AiFeatureNotConfiguredError for an unconfigured feature', async () => {
            // Arrange — blob has no features at all
            mockReadAiSettings.mockResolvedValue({ providers: {}, features: {} });

            // Act + Assert
            await expect(resolveFeatureConfig({ feature: 'text_improve' })).rejects.toThrow(
                AiFeatureNotConfiguredError
            );
        });

        it('should include the feature name in the error message', async () => {
            // Arrange
            mockReadAiSettings.mockResolvedValue({ providers: {}, features: {} });

            // Act + Assert
            await expect(resolveFeatureConfig({ feature: 'search' })).rejects.toThrow(
                "AI feature 'search' is not configured"
            );
        });

        it('should set the .feature property on AiFeatureNotConfiguredError', async () => {
            // Arrange
            mockReadAiSettings.mockResolvedValue({ providers: {}, features: {} });

            // Act
            let caught: AiFeatureNotConfiguredError | undefined;
            try {
                await resolveFeatureConfig({ feature: 'support' });
            } catch (err) {
                caught = err as AiFeatureNotConfiguredError;
            }

            // Assert
            expect(caught).toBeInstanceOf(AiFeatureNotConfiguredError);
            expect(caught?.feature).toBe('support');
        });
    });
});

// ---------------------------------------------------------------------------
// R-7: cache invalidation — the core freshness guarantee
// ---------------------------------------------------------------------------

describe('cache invalidation (R-7 stale-read prevention)', () => {
    it('should re-read storage after invalidateConfigCache() even within TTL', async () => {
        // Arrange — first call returns VALID_SETTINGS, second returns UPDATED_SETTINGS
        mockReadAiSettings
            .mockResolvedValueOnce(VALID_SETTINGS)
            .mockResolvedValueOnce(UPDATED_SETTINGS);

        // Act
        const first = await resolveConfig();
        invalidateConfigCache();
        const second = await resolveConfig();

        // Assert — storage called twice; second result is the fresh blob
        expect(mockReadAiSettings).toHaveBeenCalledTimes(2);
        expect(first).toEqual(VALID_SETTINGS);
        expect(second).toEqual(UPDATED_SETTINGS);
        // Different objects — not the stale cached reference
        expect(first).not.toBe(second);
    });

    it('should re-read storage after saveConfig() (implicit invalidation)', async () => {
        // Arrange
        mockReadAiSettings
            .mockResolvedValueOnce(VALID_SETTINGS)
            .mockResolvedValueOnce(UPDATED_SETTINGS);
        mockWriteAiSettings.mockResolvedValue(FAKE_DB_ROW);

        // Act — read → write (save) → read
        const before = await resolveConfig();
        await saveConfig({ value: UPDATED_SETTINGS, actorId: ACTOR_ID });
        const after = await resolveConfig();

        // Assert — storage read twice, write once; no stale cache after save
        expect(mockReadAiSettings).toHaveBeenCalledTimes(2);
        expect(mockWriteAiSettings).toHaveBeenCalledTimes(1);
        expect(before).toEqual(VALID_SETTINGS);
        expect(after).toEqual(UPDATED_SETTINGS);
    });

    it('should NOT re-read storage for a second call within TTL without invalidation', async () => {
        // Arrange — only one resolved value; if called twice the test would fail
        mockReadAiSettings.mockResolvedValue(VALID_SETTINGS);

        // Act
        await resolveConfig();
        await resolveConfig(); // Should hit cache, not storage

        // Assert
        expect(mockReadAiSettings).toHaveBeenCalledTimes(1);
    });
});

// ---------------------------------------------------------------------------
// saveConfig
// ---------------------------------------------------------------------------

describe('saveConfig', () => {
    it('should call writeAiSettings with the correct value and actorId', async () => {
        // Arrange
        mockWriteAiSettings.mockResolvedValue(FAKE_DB_ROW);

        // Act
        await saveConfig({ value: VALID_SETTINGS, actorId: ACTOR_ID });

        // Assert
        expect(mockWriteAiSettings).toHaveBeenCalledTimes(1);
        expect(mockWriteAiSettings).toHaveBeenCalledWith({
            value: VALID_SETTINGS,
            actorId: ACTOR_ID
        });
    });

    it('should propagate write errors to the caller', async () => {
        // Arrange
        mockWriteAiSettings.mockRejectedValue(new Error('constraint violation'));

        // Act + Assert
        await expect(saveConfig({ value: VALID_SETTINGS, actorId: ACTOR_ID })).rejects.toThrow(
            'constraint violation'
        );
    });
});

// ---------------------------------------------------------------------------
// getProviderOrder
// ---------------------------------------------------------------------------

describe('getProviderOrder', () => {
    it('should return primary provider first, then fallback chain', () => {
        // Arrange
        const featureConfig: AiFeatureConfig = {
            enabled: true,
            primaryProvider: 'openai',
            fallbackChain: ['anthropic', 'stub'],
            model: 'gpt-4o',
            params: {}
        };

        // Act
        const { providers } = getProviderOrder({ featureConfig });

        // Assert
        expect(providers).toEqual(['openai', 'anthropic', 'stub']);
    });

    it('should return only the primary provider when fallback chain is empty', () => {
        // Arrange
        const featureConfig: AiFeatureConfig = {
            enabled: true,
            primaryProvider: 'anthropic',
            fallbackChain: [],
            model: 'claude-3-5-sonnet-20241022',
            params: {}
        };

        // Act
        const { providers } = getProviderOrder({ featureConfig });

        // Assert
        expect(providers).toEqual(['anthropic']);
    });

    it('should preserve order when fallback chain has a single entry', () => {
        // Arrange
        const featureConfig = TEXT_IMPROVE_CONFIG; // fallbackChain: ['anthropic']

        // Act
        const { providers } = getProviderOrder({ featureConfig });

        // Assert
        expect(providers).toEqual(['openai', 'anthropic']);
    });
});

// ---------------------------------------------------------------------------
// isFeatureKillSwitched
// ---------------------------------------------------------------------------

describe('isFeatureKillSwitched', () => {
    it('should return false when enabled is true', () => {
        // Arrange
        const featureConfig = TEXT_IMPROVE_CONFIG; // enabled: true

        // Act + Assert
        expect(isFeatureKillSwitched(featureConfig)).toBe(false);
    });

    it('should return true when enabled is false', () => {
        // Arrange
        const featureConfig = CHAT_CONFIG; // enabled: false

        // Act + Assert
        expect(isFeatureKillSwitched(featureConfig)).toBe(true);
    });
});
