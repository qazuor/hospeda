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
    // HOS-1220: reads are fail-open per feature now, so the seed asks whether the
    // blob configures every AiFeature before attempting a write the full-record
    // write schema would reject. Defaults to "complete" so the pre-existing
    // scenarios below are unaffected; the skip scenario overrides it.
    findUnconfiguredFeatures: vi.fn(() => []),
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
import { logger } from '../../src/utils/logger.js';

const mockReadAiSettings = aiCore.readAiSettings as ReturnType<typeof vi.fn>;
const mockWriteAiSettings = aiCore.writeAiSettings as ReturnType<typeof vi.fn>;
const mockFindUnconfiguredFeatures = aiCore.findUnconfiguredFeatures as ReturnType<typeof vi.fn>;

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
    // `resetAllMocks` clears implementations, not just calls — every default the
    // mock factory declared has to be restored here, or it comes back as a
    // `vi.fn()` returning `undefined`.
    vi.resetAllMocks();
    mockWriteAiSettings.mockResolvedValue({});
    mockFindUnconfiguredFeatures.mockReturnValue([]);
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

    // -------------------------------------------------------------------------
    // 5. Blob that does not configure every AI feature (HOS-1220)
    // -------------------------------------------------------------------------

    describe('when the blob does not configure every AI feature', () => {
        /**
         * Reads became fail-open per feature in HOS-1220, so this seed can now
         * receive a blob it could not previously see — reads used to throw on it.
         * Writes did NOT become fail-open: `writeAiSettings` validates against the
         * full-record schema and would throw, aborting the entire seed run over a
         * configuration gap this seed has no business filling.
         */
        it('should NOT attempt a write it knows the write schema would reject', async () => {
            // Arrange
            mockReadAiSettings.mockResolvedValue(makeExistingBlob());
            mockFindUnconfiguredFeatures.mockReturnValue(['chat_gastronomy', 'chat_experience']);

            // Act
            await seedAiSettings();

            // Assert
            expect(mockWriteAiSettings).not.toHaveBeenCalled();
        });

        it('should say which features are missing, so the gap is not silent', async () => {
            // Arrange
            mockReadAiSettings.mockResolvedValue(makeExistingBlob());
            mockFindUnconfiguredFeatures.mockReturnValue(['chat_gastronomy']);

            // Act
            await seedAiSettings();

            // Assert — skipping quietly is how a gap survives a deploy.
            const logged = JSON.stringify(vi.mocked(logger.info).mock.calls);
            expect(logged).toContain('chat_gastronomy');
        });

        it('should still write when every feature IS configured', async () => {
            // Arrange — the guard must not block the normal path.
            mockReadAiSettings.mockResolvedValue(makeExistingBlob());
            mockFindUnconfiguredFeatures.mockReturnValue([]);

            // Act
            await seedAiSettings();

            // Assert
            expect(mockWriteAiSettings).toHaveBeenCalledOnce();
        });
    });
});
