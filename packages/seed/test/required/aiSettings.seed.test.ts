/**
 * Unit tests for the AI settings seed (SPEC-211 T-002).
 *
 * Verifies idempotency and correct costCeilings seeding without a live DB.
 * All `@repo/ai-core` storage functions are mocked via vi.mock so no real
 * PostgreSQL connection is needed.
 *
 * ## Coverage
 *
 * 1. Fresh store (no ai_settings row): SKIPS (no from-scratch blob — the runtime
 *    fallback protects; synthesising `{ providers: {}, features: {} }` would fail
 *    AiSettingsValueSchema and abort the whole seed run).
 * 2. Existing row with costCeilings already set: skips (operator wins).
 * 3. Existing row with NO costCeilings: merges DEFAULT_COST_CEILINGS, preserves other fields.
 * 4. writeAiSettings is called with SYSTEM_USER_ID as actorId (merge case only).
 *
 * @module test/required/aiSettings.seed
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be declared before any imports from the modules under test.
// ---------------------------------------------------------------------------

vi.mock('@repo/ai-core', () => ({
    readAiSettings: vi.fn(),
    writeAiSettings: vi.fn(),
    DEFAULT_COST_CEILINGS: {
        globalMonthlyMicroUsd: 100_000_000,
        perFeatureMonthlyMicroUsd: {
            chat: 45_000_000,
            search: 30_000_000,
            text_improve: 15_000_000,
            support: 10_000_000
        }
    }
}));

vi.mock('@repo/db', () => ({
    SYSTEM_USER_ID: 'a0000000-0000-4000-8000-000000000001'
}));

vi.mock('../../src/utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        success: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

// ---------------------------------------------------------------------------
// Imports — after vi.mock calls so hoisting works correctly.
// ---------------------------------------------------------------------------

import * as aiCore from '@repo/ai-core';
import { seedAiSettings } from '../../src/required/aiSettings.seed.js';

const mockReadAiSettings = aiCore.readAiSettings as ReturnType<typeof vi.fn>;
const mockWriteAiSettings = aiCore.writeAiSettings as ReturnType<typeof vi.fn>;

const SYSTEM_USER_ID = 'a0000000-0000-4000-8000-000000000001';
const DEFAULT_COST_CEILINGS = aiCore.DEFAULT_COST_CEILINGS;

// ---------------------------------------------------------------------------
// Shared fixture builder
// ---------------------------------------------------------------------------

/** Builds a minimal AiSettingsValue-shaped object for test scenarios. */
function makeExistingBlob(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        providers: { openai: { enabled: true } },
        features: {},
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.resetAllMocks();
    mockWriteAiSettings.mockResolvedValue({});
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('seedAiSettings (SPEC-211 T-002)', () => {
    // -------------------------------------------------------------------------
    // 1. Fresh store — no ai_settings row yet
    // -------------------------------------------------------------------------

    describe('when no ai_settings row exists (fresh store)', () => {
        it('should SKIP and NOT call writeAiSettings (no from-scratch blob; runtime fallback protects)', async () => {
            // Arrange
            mockReadAiSettings.mockResolvedValue(null);

            // Act
            await seedAiSettings();

            // Assert — the seed must NOT synthesise a blob (that would be invalid
            // against AiSettingsValueSchema and abort the whole seed run).
            expect(mockWriteAiSettings).not.toHaveBeenCalled();
        });

        it('should resolve without error (idempotent no-op)', async () => {
            // Arrange
            mockReadAiSettings.mockResolvedValue(null);

            // Act + Assert
            await expect(seedAiSettings()).resolves.toBeUndefined();
        });
    });

    // -------------------------------------------------------------------------
    // 2. Existing row — costCeilings already set by operator
    // -------------------------------------------------------------------------

    describe('when ai_settings already has costCeilings set', () => {
        it('should NOT call writeAiSettings (operator values are preserved)', async () => {
            // Arrange — existing blob with a custom ceiling set by an operator
            const operatorCeilings = { globalMonthlyMicroUsd: 999_000_000 };
            mockReadAiSettings.mockResolvedValue(
                makeExistingBlob({ costCeilings: operatorCeilings })
            );

            // Act
            await seedAiSettings();

            // Assert — no write occurred
            expect(mockWriteAiSettings).not.toHaveBeenCalled();
        });

        it('should resolve without error when called again (idempotent)', async () => {
            // Arrange
            mockReadAiSettings.mockResolvedValue(
                makeExistingBlob({
                    costCeilings: { globalMonthlyMicroUsd: 100_000_000 }
                })
            );

            // Act + Assert — must not throw
            await expect(seedAiSettings()).resolves.toBeUndefined();
        });
    });

    // -------------------------------------------------------------------------
    // 3. Existing row — no costCeilings field present
    // -------------------------------------------------------------------------

    describe('when ai_settings exists but costCeilings is absent', () => {
        it('should write DEFAULT_COST_CEILINGS while preserving other existing fields', async () => {
            // Arrange — existing blob with providers/features but no costCeilings
            const existingBlob = makeExistingBlob();
            mockReadAiSettings.mockResolvedValue(existingBlob);

            // Act
            await seedAiSettings();

            // Assert — write was called
            expect(mockWriteAiSettings).toHaveBeenCalledOnce();

            const [callArg] = mockWriteAiSettings.mock.calls[0] as [
                { value: Record<string, unknown>; actorId: string }
            ];

            // costCeilings injected from defaults
            expect(callArg.value.costCeilings).toEqual(DEFAULT_COST_CEILINGS);

            // Existing fields preserved
            expect(callArg.value.providers).toEqual(existingBlob.providers);
            expect(callArg.value.features).toEqual(existingBlob.features);
        });

        it('should use SYSTEM_USER_ID as the actorId', async () => {
            // Arrange
            mockReadAiSettings.mockResolvedValue(makeExistingBlob());

            // Act
            await seedAiSettings();

            // Assert
            const [callArg] = mockWriteAiSettings.mock.calls[0] as [
                { value: Record<string, unknown>; actorId: string }
            ];
            expect(callArg.actorId).toBe(SYSTEM_USER_ID);
        });
    });

    // -------------------------------------------------------------------------
    // 4. Idempotency across multiple calls
    // -------------------------------------------------------------------------

    describe('idempotency across multiple invocations', () => {
        it('should skip on a fresh store, and write exactly once when a row without costCeilings appears', async () => {
            // First call — no row yet, skips (runtime fallback protects)
            mockReadAiSettings.mockResolvedValueOnce(null);
            await seedAiSettings();
            expect(mockWriteAiSettings).not.toHaveBeenCalled();

            // Second call — an operator-configured row now exists without ceilings
            mockReadAiSettings.mockResolvedValueOnce(makeExistingBlob());
            await seedAiSettings();
            expect(mockWriteAiSettings).toHaveBeenCalledOnce();

            // Third call — ceilings now present, skips
            mockReadAiSettings.mockResolvedValueOnce(
                makeExistingBlob({ costCeilings: DEFAULT_COST_CEILINGS })
            );
            await seedAiSettings();
            expect(mockWriteAiSettings).toHaveBeenCalledOnce();
        });
    });
});
