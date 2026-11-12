/**
 * Unit tests for model rate resolution and missing-rate reporting (HOS-2096).
 *
 * @module test/model-rate-resolver
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/storage/index.js', () => ({
    insertAiUsage: vi.fn().mockResolvedValue({ id: 'row-1' })
}));

import * as storageModule from '../src/storage/index.js';
import {
    hasModelRate,
    reportMissingModelRate,
    resetMissingModelRateWarnings,
    resolveModelRate
} from '../src/usage/model-rate-resolver.js';
import { MODEL_RATES } from '../src/usage/model-rates.js';
import { recordAiUsage } from '../src/usage/usage-recorder.js';

const OVERRIDE = {
    inputMicroUsdPerMillionTokens: 1,
    outputMicroUsdPerMillionTokens: 2
};

describe('resolveModelRate', () => {
    it('uses the HOS-2106 gpt-5.4-mini rate', () => {
        expect(MODEL_RATES['gpt-5.4-mini']).toEqual({
            inputMicroUsdPerMillionTokens: 750_000,
            outputMicroUsdPerMillionTokens: 4_500_000
        });
    });

    it('returns the in-code rate with source "code"', () => {
        // Arrange / Act
        const result = resolveModelRate({ model: 'gpt-4o-mini' });
        // Assert
        expect(result).toEqual({ rate: MODEL_RATES['gpt-4o-mini'], source: 'code' });
    });

    it('prefers the DB override with source "db"', () => {
        const result = resolveModelRate({
            model: 'gpt-4o-mini',
            overrides: { 'gpt-4o-mini': OVERRIDE }
        });
        expect(result).toEqual({ rate: OVERRIDE, source: 'db' });
    });

    it('uses an override for a model absent from the code table', () => {
        const result = resolveModelRate({
            model: 'gpt-5.4-nano',
            overrides: { 'gpt-5.4-nano': OVERRIDE }
        });
        expect(result.source).toBe('db');
    });

    it('includes the official GPT-5.4 nano and mini default rates', () => {
        expect(resolveModelRate({ model: 'gpt-5.4-nano' })).toEqual({
            rate: {
                inputMicroUsdPerMillionTokens: 200_000,
                outputMicroUsdPerMillionTokens: 1_250_000
            },
            source: 'code'
        });
        expect(resolveModelRate({ model: 'gpt-5.4-mini' })).toEqual({
            rate: {
                inputMicroUsdPerMillionTokens: 750_000,
                outputMicroUsdPerMillionTokens: 4_500_000
            },
            source: 'code'
        });
    });

    it('reports "missing" for an unrated model', () => {
        const result = resolveModelRate({ model: 'unknown-model', overrides: {} });
        expect(result).toEqual({ rate: undefined, source: 'missing' });
    });
});

describe('hasModelRate', () => {
    it('is true for rated and false for unrated models', () => {
        expect(hasModelRate({ model: 'gpt-4o' })).toBe(true);
        expect(hasModelRate({ model: 'gpt-5.4-nano' })).toBe(true);
        expect(hasModelRate({ model: 'gpt-5.4-mini' })).toBe(true);
    });
});

describe('reportMissingModelRate', () => {
    beforeEach(() => {
        resetMissingModelRateWarnings();
    });

    it('fires the hook once per model and not again', () => {
        const hook = vi.fn();
        reportMissingModelRate({ provider: 'openai', model: 'm1', onMissingRate: hook });
        reportMissingModelRate({ provider: 'openai', model: 'm1', onMissingRate: hook });
        expect(hook).toHaveBeenCalledTimes(1);
        expect(hook).toHaveBeenCalledWith({ provider: 'openai', model: 'm1' });
    });

    it('fires separately for a different model', () => {
        const hook = vi.fn();
        reportMissingModelRate({ provider: 'openai', model: 'm1', onMissingRate: hook });
        reportMissingModelRate({ provider: 'openai', model: 'm2', onMissingRate: hook });
        expect(hook).toHaveBeenCalledTimes(2);
    });

    it('swallows a throwing hook', () => {
        const hook = vi.fn(() => {
            throw new Error('boom');
        });
        expect(() =>
            reportMissingModelRate({ provider: 'openai', model: 'm1', onMissingRate: hook })
        ).not.toThrow();
    });

    it('is a no-op without a hook', () => {
        expect(() => reportMissingModelRate({ provider: 'openai', model: 'm1' })).not.toThrow();
    });
});

describe('recordAiUsage missing-rate hook', () => {
    const base = {
        userId: 'u1',
        feature: 'chat' as const,
        provider: 'openai',
        promptTokens: 10,
        completionTokens: 10,
        latencyMs: 5,
        status: 'success'
    };

    beforeEach(() => {
        resetMissingModelRateWarnings();
        vi.mocked(storageModule.insertAiUsage).mockClear();
    });

    it('warns once and still records cost 0 for an unrated model', async () => {
        // Arrange
        const hook = vi.fn();
        // Act
        await recordAiUsage({ ...base, model: 'unlisted-model', onMissingRate: hook });
        await recordAiUsage({ ...base, model: 'unlisted-model', onMissingRate: hook });
        // Assert
        expect(hook).toHaveBeenCalledTimes(1);
        expect(storageModule.insertAiUsage).toHaveBeenCalledTimes(2);
        expect(storageModule.insertAiUsage).toHaveBeenCalledWith(
            expect.objectContaining({ costEstimateMicroUsd: 0 })
        );
    });

    it('does not warn for a rated model', async () => {
        const hook = vi.fn();
        await recordAiUsage({ ...base, model: 'gpt-4o-mini', onMissingRate: hook });
        expect(hook).not.toHaveBeenCalled();
    });
});
