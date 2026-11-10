/**
 * HOS-2096 regression: DB rate overrides (`ai_settings.modelRates`) must reach
 * the cost computed when usage is recorded. Rates below are fake, test-only.
 *
 * `recordAiUsage` is replaced by a stand-in that runs the REAL cost calculator
 * over the exact args the call site passes, so the assertion is on the cost
 * that would be persisted, not on the call shape.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockResolveConfig, recorded } = vi.hoisted(() => ({
    mockResolveConfig: vi.fn(),
    recorded: [] as number[]
}));

vi.mock('@repo/ai-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/ai-core')>();
    return {
        ...actual,
        resolveConfig: mockResolveConfig,
        recordAiUsage: vi.fn(async (input: Parameters<typeof actual.recordAiUsage>[0]) => {
            const { costMicroUsd } = actual.calculateCostMicroUsd(input);
            recorded.push(costMicroUsd);
            return { id: 'row' };
        })
    };
});

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

const { meterAiUsage } = await import('../../src/utils/ai-usage-metering');
const { loadModelRateOverrides } = await import('../../src/utils/ai-rate-overrides');

const input = {
    userId: 'u1',
    feature: 'text_improve' as const,
    provider: 'openai',
    model: 'gpt-5.4-nano',
    promptTokens: 1_000_000,
    completionTokens: 1_000_000,
    latencyMs: 10,
    status: 'success' as const
};

describe('HOS-2096 rate overrides wiring', () => {
    beforeEach(() => {
        recorded.length = 0;
        mockResolveConfig.mockReset();
    });

    it('records cost > 0 for a model missing from MODEL_RATES when settings override it', async () => {
        mockResolveConfig.mockResolvedValue({
            providers: {},
            features: {},
            modelRates: {
                'gpt-5.4-nano': {
                    inputMicroUsdPerMillionTokens: 10,
                    outputMicroUsdPerMillionTokens: 20
                }
            }
        });

        await meterAiUsage(input);

        expect(recorded).toEqual([30]);
    });

    it('records 0 when settings have no override for the model', async () => {
        mockResolveConfig.mockResolvedValue({ providers: {}, features: {} });

        await meterAiUsage(input);

        expect(recorded).toEqual([0]);
    });

    it('degrades to undefined (and still meters) when settings cannot be read', async () => {
        mockResolveConfig.mockRejectedValue(new Error('db down'));

        await expect(loadModelRateOverrides()).resolves.toBeUndefined();
        await meterAiUsage(input);

        expect(recorded).toEqual([0]);
    });
});
