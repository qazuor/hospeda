/**
 * Unit tests for ai-core usage module (SPEC-173 T-016).
 *
 * Coverage:
 *   - calculateCostMicroUsd: canonical gpt-4o-mini 250/180 → 146 µUSD.
 *   - calculateCostMicroUsd: rateOverrides takes precedence over MODEL_RATES.
 *   - calculateCostMicroUsd: unknown model → { costMicroUsd: 0, rated: false }.
 *   - recordAiUsage: correct AC-7 fields forwarded to insertAiUsage; no real DB.
 *
 * The DB (insertAiUsage) is stubbed entirely via vi.mock so NO real database
 * connection is required.
 *
 * @module test/usage
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock storage BEFORE importing modules under test
// ---------------------------------------------------------------------------

vi.mock('../src/storage/index.js', () => ({
    insertAiUsage: vi.fn()
}));

import * as storageModule from '../src/storage/index.js';
import { calculateCostMicroUsd } from '../src/usage/cost-calculator.js';
import { MODEL_RATES } from '../src/usage/model-rates.js';
import { recordAiUsage } from '../src/usage/usage-recorder.js';

const mockInsertAiUsage = storageModule.insertAiUsage as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// calculateCostMicroUsd
// ---------------------------------------------------------------------------

describe('calculateCostMicroUsd', () => {
    describe('when given a known model (gpt-4o-mini)', () => {
        it('should compute 146 µUSD for 250 prompt + 180 completion tokens', () => {
            // Arrange
            // inputCost  = 250 * 150_000 / 1_000_000 =  37.5
            // outputCost = 180 * 600_000 / 1_000_000 = 108.0
            // total      = round(37.5 + 108.0)       = 146

            // Act
            const result = calculateCostMicroUsd({
                provider: 'openai',
                model: 'gpt-4o-mini',
                promptTokens: 250,
                completionTokens: 180
            });

            // Assert
            expect(result.costMicroUsd).toBe(146);
            expect(result.rated).toBe(true);
        });

        it('should return rated: true for a known model', () => {
            // Arrange + Act
            const result = calculateCostMicroUsd({
                provider: 'openai',
                model: 'gpt-4o-mini',
                promptTokens: 1,
                completionTokens: 1
            });

            // Assert
            expect(result.rated).toBe(true);
        });

        it('should return integer result (Math.round applied)', () => {
            // Arrange — 1 token of gpt-4o-mini: 150_000 / 1_000_000 = 0.15 → round to 0
            const result = calculateCostMicroUsd({
                provider: 'openai',
                model: 'gpt-4o-mini',
                promptTokens: 1,
                completionTokens: 0
            });

            // Assert
            expect(Number.isInteger(result.costMicroUsd)).toBe(true);
            expect(result.costMicroUsd).toBe(0);
        });
    });

    describe('when rateOverrides are provided', () => {
        it('should use the override rate instead of MODEL_RATES default', () => {
            // Arrange — override gpt-4o-mini with a doubled rate
            const customRate = {
                inputMicroUsdPerMillionTokens: 300_000,
                outputMicroUsdPerMillionTokens: 1_200_000
            };
            // inputCost  = 250 * 300_000 / 1_000_000 =  75.0
            // outputCost = 180 * 1_200_000 / 1_000_000 = 216.0
            // total      = round(75.0 + 216.0) = 291

            // Act
            const result = calculateCostMicroUsd({
                provider: 'openai',
                model: 'gpt-4o-mini',
                promptTokens: 250,
                completionTokens: 180,
                rateOverrides: { 'gpt-4o-mini': customRate }
            });

            // Assert
            expect(result.costMicroUsd).toBe(291);
            expect(result.rated).toBe(true);
        });

        it('should fall back to MODEL_RATES for a model not in rateOverrides', () => {
            // Arrange — override only covers a different model
            const result = calculateCostMicroUsd({
                provider: 'openai',
                model: 'gpt-4o-mini',
                promptTokens: 250,
                completionTokens: 180,
                rateOverrides: {
                    'some-other-model': {
                        inputMicroUsdPerMillionTokens: 1,
                        outputMicroUsdPerMillionTokens: 1
                    }
                }
            });

            // Assert — should use in-code default
            expect(result.costMicroUsd).toBe(146);
            expect(result.rated).toBe(true);
        });

        it('should allow overriding with a rate for a model not in MODEL_RATES', () => {
            // Arrange
            const novelRate = {
                inputMicroUsdPerMillionTokens: 500_000,
                outputMicroUsdPerMillionTokens: 2_000_000
            };
            // inputCost  = 100 * 500_000 / 1_000_000 =  50.0
            // outputCost = 100 * 2_000_000 / 1_000_000 = 200.0
            // total      = 250

            // Act
            const result = calculateCostMicroUsd({
                provider: 'openai',
                model: 'gpt-5-turbo',
                promptTokens: 100,
                completionTokens: 100,
                rateOverrides: { 'gpt-5-turbo': novelRate }
            });

            // Assert
            expect(result.costMicroUsd).toBe(250);
            expect(result.rated).toBe(true);
        });
    });

    describe('when given an unknown model', () => {
        it('should return { costMicroUsd: 0, rated: false }', () => {
            // Arrange + Act
            const result = calculateCostMicroUsd({
                provider: 'openai',
                model: 'gpt-99-hypothetical',
                promptTokens: 1000,
                completionTokens: 1000
            });

            // Assert
            expect(result.costMicroUsd).toBe(0);
            expect(result.rated).toBe(false);
        });

        it('should not throw for an unknown model', () => {
            // Arrange + Act + Assert — must never throw
            expect(() =>
                calculateCostMicroUsd({
                    provider: 'unknown-provider',
                    model: 'completely-unknown-model',
                    promptTokens: 9999,
                    completionTokens: 9999
                })
            ).not.toThrow();
        });
    });

    describe('MODEL_RATES coverage', () => {
        it('should contain gpt-4o', () => {
            expect(MODEL_RATES['gpt-4o']).toBeDefined();
            expect(MODEL_RATES['gpt-4o']?.inputMicroUsdPerMillionTokens).toBe(2_500_000);
            expect(MODEL_RATES['gpt-4o']?.outputMicroUsdPerMillionTokens).toBe(10_000_000);
        });

        it('should contain gpt-4o-mini', () => {
            expect(MODEL_RATES['gpt-4o-mini']).toBeDefined();
            expect(MODEL_RATES['gpt-4o-mini']?.inputMicroUsdPerMillionTokens).toBe(150_000);
        });

        it('should contain claude-3-5-sonnet-20241022', () => {
            expect(MODEL_RATES['claude-3-5-sonnet-20241022']).toBeDefined();
            expect(MODEL_RATES['claude-3-5-sonnet-20241022']?.inputMicroUsdPerMillionTokens).toBe(
                3_000_000
            );
        });

        it('should contain claude-3-5-haiku-20241022', () => {
            expect(MODEL_RATES['claude-3-5-haiku-20241022']).toBeDefined();
            expect(MODEL_RATES['claude-3-5-haiku-20241022']?.outputMicroUsdPerMillionTokens).toBe(
                4_000_000
            );
        });
    });
});

// ---------------------------------------------------------------------------
// recordAiUsage
// ---------------------------------------------------------------------------

describe('recordAiUsage', () => {
    const INSERTED_ROW = {
        id: 'aaaaaaaa-0000-0000-0000-000000000001',
        userId: 'bbbbbbbb-0000-0000-0000-000000000001',
        feature: 'text_improve',
        provider: 'openai',
        model: 'gpt-4o-mini',
        tokensIn: 250,
        tokensOut: 180,
        costEstimateMicroUsd: 146,
        latencyMs: 820,
        status: 'success',
        createdAt: new Date()
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockInsertAiUsage.mockResolvedValue(INSERTED_ROW);
    });

    describe('when called with a known model', () => {
        it('should forward correct AC-7 fields to insertAiUsage', async () => {
            // Arrange
            const input = {
                userId: INSERTED_ROW.userId,
                feature: 'text_improve',
                provider: 'openai',
                model: 'gpt-4o-mini',
                promptTokens: 250,
                completionTokens: 180,
                latencyMs: 820,
                status: 'success'
            };

            // Act
            await recordAiUsage(input);

            // Assert
            expect(mockInsertAiUsage).toHaveBeenCalledOnce();
            const passedArg = mockInsertAiUsage.mock.calls[0]?.[0] as Record<string, unknown>;

            expect(passedArg).toBeDefined();
            expect(passedArg.userId).toBe(INSERTED_ROW.userId);
            expect(passedArg.feature).toBe('text_improve');
            expect(passedArg.provider).toBe('openai');
            expect(passedArg.model).toBe('gpt-4o-mini');
            expect(passedArg.tokensIn).toBe(250);
            expect(passedArg.tokensOut).toBe(180);
            expect(passedArg.latencyMs).toBe(820);
            expect(passedArg.status).toBe('success');
        });

        it('should compute costEstimateMicroUsd via the calculator (146 for 250/180 gpt-4o-mini)', async () => {
            // Arrange + Act
            await recordAiUsage({
                userId: INSERTED_ROW.userId,
                feature: 'text_improve',
                provider: 'openai',
                model: 'gpt-4o-mini',
                promptTokens: 250,
                completionTokens: 180,
                latencyMs: 820,
                status: 'success'
            });

            // Assert
            const passedArg = mockInsertAiUsage.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(passedArg.costEstimateMicroUsd).toBe(146);
        });

        it('should return the row from insertAiUsage', async () => {
            // Arrange + Act
            const result = await recordAiUsage({
                userId: INSERTED_ROW.userId,
                feature: 'text_improve',
                provider: 'openai',
                model: 'gpt-4o-mini',
                promptTokens: 250,
                completionTokens: 180,
                latencyMs: 820,
                status: 'success'
            });

            // Assert
            expect(result).toEqual(INSERTED_ROW);
        });
    });

    describe('when userId is null (system-initiated call)', () => {
        it('should forward null userId to insertAiUsage', async () => {
            // Arrange
            const nullUserRow = { ...INSERTED_ROW, userId: null };
            mockInsertAiUsage.mockResolvedValue(nullUserRow);

            // Act
            await recordAiUsage({
                userId: null,
                feature: 'text_improve',
                provider: 'openai',
                model: 'gpt-4o-mini',
                promptTokens: 10,
                completionTokens: 10,
                latencyMs: 100,
                status: 'success'
            });

            // Assert
            const passedArg = mockInsertAiUsage.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(passedArg.userId).toBeNull();
        });
    });

    describe('when the model is unknown', () => {
        it('should pass costEstimateMicroUsd: 0 without throwing', async () => {
            // Arrange
            const unknownModelRow = {
                ...INSERTED_ROW,
                model: 'unknown-model',
                costEstimateMicroUsd: 0
            };
            mockInsertAiUsage.mockResolvedValue(unknownModelRow);

            // Act — must not throw even though model is unrecognised
            await recordAiUsage({
                userId: null,
                feature: 'chat',
                provider: 'openai',
                model: 'unknown-model',
                promptTokens: 100,
                completionTokens: 100,
                latencyMs: 200,
                status: 'success'
            });

            // Assert
            const passedArg = mockInsertAiUsage.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(passedArg.costEstimateMicroUsd).toBe(0);
        });
    });

    describe('when rateOverrides are provided', () => {
        it('should use the override rate for cost calculation', async () => {
            // Arrange — 1M-token rate so 1 token = 1 µUSD input + 1 µUSD output
            const overrideRow = { ...INSERTED_ROW, costEstimateMicroUsd: 2 };
            mockInsertAiUsage.mockResolvedValue(overrideRow);

            // Act
            await recordAiUsage({
                userId: null,
                feature: 'text_improve',
                provider: 'openai',
                model: 'gpt-4o-mini',
                promptTokens: 1,
                completionTokens: 1,
                latencyMs: 50,
                status: 'success',
                rateOverrides: {
                    'gpt-4o-mini': {
                        inputMicroUsdPerMillionTokens: 1_000_000,
                        outputMicroUsdPerMillionTokens: 1_000_000
                    }
                }
            });

            // Assert — 1 * 1_000_000/1_000_000 + 1 * 1_000_000/1_000_000 = round(2) = 2
            const passedArg = mockInsertAiUsage.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(passedArg.costEstimateMicroUsd).toBe(2);
        });
    });
});
