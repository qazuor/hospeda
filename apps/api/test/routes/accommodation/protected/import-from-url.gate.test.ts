/**
 * Unit tests for the lazy AI entitlement/quota gate of the import route
 * (SPEC-222 T-021 — covers review note N2).
 *
 * `buildImportAiExtract` is the highest-bug-density part of the route: it decides
 * whether Strategy B runs, sets the degrade-clean `blockedReason`, meters usage,
 * and maps the model output. These branches are exercised here deterministically
 * with the entitlement helpers, the AI service factory, and the metering
 * functions mocked — no Hono app, no network.
 */

import type { Actor } from '@repo/service-core';
import type { Context } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mockHasEntitlement,
    mockGetRemainingLimit,
    mockGetMonthlyCallCount,
    mockRecordAiUsage,
    mockGenerateObject
} = vi.hoisted(() => ({
    mockHasEntitlement: vi.fn(),
    mockGetRemainingLimit: vi.fn(),
    mockGetMonthlyCallCount: vi.fn(),
    mockRecordAiUsage: vi.fn(),
    mockGenerateObject: vi.fn()
}));

vi.mock('../../../../src/middlewares/entitlement', async (importActual) => {
    const actual = await importActual<typeof import('../../../../src/middlewares/entitlement')>();
    return {
        ...actual,
        hasEntitlement: mockHasEntitlement,
        getRemainingLimit: mockGetRemainingLimit
    };
});

vi.mock('@repo/ai-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/ai-core')>();
    return {
        ...actual,
        getMonthlyCallCount: mockGetMonthlyCallCount,
        recordAiUsage: mockRecordAiUsage
    };
});

vi.mock('../../../../src/services/ai-service.factory', () => ({
    createConfiguredAiService: vi.fn(async () => ({ generateObject: mockGenerateObject }))
}));

import { buildImportAiExtract } from '../../../../src/routes/accommodation/protected/import-from-url';
import type { AiGateState } from '../../../../src/routes/accommodation/protected/import-from-url.ai';

/** Fake Hono context exposing only the `billingLoadFailed` var the gate reads. */
function fakeContext(billingLoadFailed: boolean): Context {
    return {
        get: (key: string) => (key === 'billingLoadFailed' ? billingLoadFailed : undefined)
    } as unknown as Context;
}

const actor = { id: 'user-1', permissions: [] } as unknown as Actor;

function runPort(opts: { billingLoadFailed?: boolean }) {
    const gate: AiGateState = { blockedReason: null };
    const port = buildImportAiExtract({
        c: fakeContext(opts.billingLoadFailed ?? false),
        actor,
        gate
    });
    return { gate, port };
}

const GOOD_AI_RESULT = {
    object: { name: 'Cabaña del Río', description: 'Junto al río' },
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    provider: 'openai',
    model: 'gpt-4o-mini',
    finishReason: 'stop'
};

describe('buildImportAiExtract gate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('degrades silently (null, no blockedReason) when billing context failed to load', async () => {
        // Arrange
        const { gate, port } = runPort({ billingLoadFailed: true });

        // Act
        const result = await port({ text: 'page', locale: 'es' });

        // Assert
        expect(result).toBeNull();
        expect(gate.blockedReason).toBeNull();
        expect(mockHasEntitlement).not.toHaveBeenCalled();
    });

    it('blocks with reason "entitlement" when the plan lacks the AI entitlement', async () => {
        // Arrange
        mockHasEntitlement.mockReturnValue(false);
        const { gate, port } = runPort({});

        // Act
        const result = await port({ text: 'page', locale: 'es' });

        // Assert
        expect(result).toBeNull();
        expect(gate.blockedReason).toBe('entitlement');
        expect(mockGenerateObject).not.toHaveBeenCalled();
    });

    it('blocks with reason "entitlement" when the plan limit is 0 (disabled)', async () => {
        // Arrange
        mockHasEntitlement.mockReturnValue(true);
        mockGetRemainingLimit.mockReturnValue(0);
        const { gate, port } = runPort({});

        // Act
        const result = await port({ text: 'page', locale: 'es' });

        // Assert
        expect(result).toBeNull();
        expect(gate.blockedReason).toBe('entitlement');
    });

    it('blocks with reason "quota" when the monthly count has reached the limit', async () => {
        // Arrange
        mockHasEntitlement.mockReturnValue(true);
        mockGetRemainingLimit.mockReturnValue(5);
        mockGetMonthlyCallCount.mockResolvedValue(5);
        const { gate, port } = runPort({});

        // Act
        const result = await port({ text: 'page', locale: 'es' });

        // Assert
        expect(result).toBeNull();
        expect(gate.blockedReason).toBe('quota');
        expect(mockGenerateObject).not.toHaveBeenCalled();
    });

    it('extracts and meters usage on the happy path (unlimited plan)', async () => {
        // Arrange
        mockHasEntitlement.mockReturnValue(true);
        mockGetRemainingLimit.mockReturnValue(-1);
        mockGenerateObject.mockResolvedValue(GOOD_AI_RESULT);
        const { gate, port } = runPort({});

        // Act
        const result = await port({ text: 'page text', locale: 'es' });

        // Assert
        expect(gate.blockedReason).toBeNull();
        expect(result?.sourcePlatform).toBe('generic');
        expect(result?.name).toEqual({ value: 'Cabaña del Río', source: 'ai' });
        expect(mockGetMonthlyCallCount).not.toHaveBeenCalled(); // -1 skips the count query
        expect(mockRecordAiUsage).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'user-1',
                feature: 'accommodation_import',
                provider: 'openai',
                model: 'gpt-4o-mini',
                promptTokens: 100,
                completionTokens: 50,
                status: 'success'
            })
        );
    });

    it('proceeds when under the monthly quota', async () => {
        // Arrange
        mockHasEntitlement.mockReturnValue(true);
        mockGetRemainingLimit.mockReturnValue(5);
        mockGetMonthlyCallCount.mockResolvedValue(2);
        mockGenerateObject.mockResolvedValue(GOOD_AI_RESULT);
        const { gate, port } = runPort({});

        // Act
        const result = await port({ text: 'page', locale: 'es' });

        // Assert
        expect(result?.name).toEqual({ value: 'Cabaña del Río', source: 'ai' });
        expect(gate.blockedReason).toBeNull();
    });

    it('degrades silently (null, no blockedReason) when the AI provider throws', async () => {
        // Arrange
        mockHasEntitlement.mockReturnValue(true);
        mockGetRemainingLimit.mockReturnValue(-1);
        mockGenerateObject.mockRejectedValue(new Error('provider unconfigured'));
        const { gate, port } = runPort({});

        // Act
        const result = await port({ text: 'page', locale: 'es' });

        // Assert
        expect(result).toBeNull();
        expect(gate.blockedReason).toBeNull();
        expect(mockRecordAiUsage).not.toHaveBeenCalled();
    });

    it('returns null when the AI output fails schema validation', async () => {
        // Arrange: name is a number — AccommodationImportAiOutputSchema rejects it.
        mockHasEntitlement.mockReturnValue(true);
        mockGetRemainingLimit.mockReturnValue(-1);
        mockGenerateObject.mockResolvedValue({ ...GOOD_AI_RESULT, object: { name: 123 } });
        const { port } = runPort({});

        // Act
        const result = await port({ text: 'page', locale: 'es' });

        // Assert
        expect(result).toBeNull();
        expect(mockRecordAiUsage).not.toHaveBeenCalled();
    });

    it('still returns the extraction when metering fails (best-effort)', async () => {
        // Arrange
        mockHasEntitlement.mockReturnValue(true);
        mockGetRemainingLimit.mockReturnValue(-1);
        mockGenerateObject.mockResolvedValue(GOOD_AI_RESULT);
        mockRecordAiUsage.mockRejectedValue(new Error('db down'));
        const { gate, port } = runPort({});

        // Act
        const result = await port({ text: 'page', locale: 'es' });

        // Assert
        expect(result?.name).toEqual({ value: 'Cabaña del Río', source: 'ai' });
        expect(gate.blockedReason).toBeNull();
    });
});
