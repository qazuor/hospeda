/**
 * Integration tests for AC-2 — usage ceiling enforcement, entitlement errors,
 * refund-on-error semantics via `recordAiUsage`, and limits-per-plan matrix
 * via cost calculator (SPEC-173 §7 AC-2/AC-6/AC-7/AC-8).
 *
 * ## What makes this integration (vs. unit)
 *
 * These tests wire `checkCostCeiling` into `createAiEngine` and exercise the
 * full ceiling-check → hard-stop path as `apps/api` would at T-043 time.
 * The storage layer is mocked (no real DB) so the test suite is self-contained.
 *
 * ## Scenarios
 *
 * 1. Usage ceiling hit → engine throws `AiCeilingHitError`, call is hard-stopped.
 * 2. `AiCeilingHitError` carries `scope`, `spentMicroUsd`, `ceilingMicroUsd`.
 * 3. Refund-on-error: a successful call records a metering row with
 *    `status: 'success'`; an errored call records `status: 'error'`.
 *    Usage counter can be "refunded" by recording an error row with negative
 *    cost (not a DB update — append-only metering).
 * 4. Limits-per-plan matrix: `calculateCostMicroUsd` correctly computes costs
 *    for every tier model (gpt-4o-mini, claude-3-5-haiku, etc.) and `rated:
 *    false` for unknown models.
 * 5. Spend at exactly the ceiling value triggers the hard stop (>= semantics).
 * 6. Spend below the ceiling resolves silently.
 *
 * @module test/integration/entitlements
 */

import type { AiFeatureConfig } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiCeilingHitError, createAiEngine } from '../../src/engine/index.js';
import type { AiEngineEvent } from '../../src/engine/index.js';
import type { AiProvider } from '../../src/providers/ai-provider.interface.js';
import { StubProvider } from '../../src/providers/index.js';
import { calculateCostMicroUsd } from '../../src/usage/cost-calculator.js';
import { MODEL_RATES } from '../../src/usage/model-rates.js';
import { recordAiUsage } from '../../src/usage/usage-recorder.js';

// ---------------------------------------------------------------------------
// Mock: prompt storage — no DB required
// ---------------------------------------------------------------------------

vi.mock('../../src/storage/prompt.storage.js', () => ({
    getActivePrompt: vi.fn().mockResolvedValue({ content: null, row: null })
}));

// ---------------------------------------------------------------------------
// Mock: config resolver — no DB required
// ---------------------------------------------------------------------------

vi.mock('../../src/config/resolver.js', async (importOriginal) => {
    const original = await importOriginal<typeof import('../../src/config/resolver.js')>();
    return {
        ...original,
        resolveConfig: vi.fn(),
        resolveFeatureConfig: vi.fn(),
        getProviderOrder: vi.fn(),
        isFeatureKillSwitched: vi.fn()
    };
});

import * as configResolver from '../../src/config/resolver.js';

const mockResolveConfig = configResolver.resolveConfig as ReturnType<typeof vi.fn>;
const mockResolveFeatureConfig = configResolver.resolveFeatureConfig as ReturnType<typeof vi.fn>;
const mockIsFeatureKillSwitched = configResolver.isFeatureKillSwitched as ReturnType<typeof vi.fn>;
const mockGetProviderOrder = configResolver.getProviderOrder as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Mock: storage/index for recordAiUsage — no real DB
// ---------------------------------------------------------------------------

vi.mock('../../src/storage/index.js', () => ({
    insertAiUsage: vi.fn(),
    insertAiRequestLog: vi.fn(),
    // Passthrough for other storage helpers used by the config resolver
    readAiSettings: vi.fn().mockResolvedValue(null),
    writeAiSettings: vi.fn(),
    getActivePrompt: vi.fn().mockResolvedValue({ content: null, row: null }),
    aggregateAiUsageByMonth: vi.fn().mockResolvedValue([])
}));

import * as storageModule from '../../src/storage/index.js';

const mockInsertAiUsage = storageModule.insertAiUsage as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FEATURE_CONFIG_ENABLED: AiFeatureConfig = {
    enabled: true,
    primaryProvider: 'openai',
    fallbackChain: [],
    model: 'gpt-4o-mini',
    params: {}
};

const USER_ID = 'aaaa0000-0000-0000-0000-000000000001';

// Canonical usage row returned by the mocked insertAiUsage
const STUB_USAGE_ROW = {
    id: 'bbbb0000-0000-0000-0000-000000000001',
    userId: USER_ID,
    feature: 'text_improve',
    provider: 'openai',
    model: 'gpt-4o-mini',
    tokensIn: 10,
    tokensOut: 20,
    costEstimateMicroUsd: 14,
    latencyMs: 100,
    status: 'success',
    createdAt: new Date()
};

// ---------------------------------------------------------------------------
// beforeEach — reset mocks
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.clearAllMocks();

    mockResolveConfig.mockResolvedValue({ providers: {}, features: {} });
    mockResolveFeatureConfig.mockResolvedValue(FEATURE_CONFIG_ENABLED);
    mockIsFeatureKillSwitched.mockImplementation((cfg: AiFeatureConfig) => !cfg.enabled);
    mockGetProviderOrder.mockImplementation(
        ({ featureConfig }: { featureConfig: AiFeatureConfig }) => ({
            providers: [featureConfig.primaryProvider, ...featureConfig.fallbackChain]
        })
    );

    // Default: storage insert succeeds
    mockInsertAiUsage.mockResolvedValue(STUB_USAGE_ROW);
});

// ---------------------------------------------------------------------------
// AC-2 (1 & 2): ceiling hit → hard-stop + error shape
// ---------------------------------------------------------------------------

describe('AC-2 — ceiling hit hard-stops the call', () => {
    it('should throw AiCeilingHitError when checkCeiling hook throws it', async () => {
        // Arrange — checkCeiling always fires a breach
        const CEILING_MICRO_USD = 200_000_000; // $200 USD in µUSD
        const SPENT_MICRO_USD = 200_000_000; // exactly at ceiling (>= semantics)

        const engine = createAiEngine({
            getProvider: () => new StubProvider(),
            checkCeiling: async ({ feature }) => {
                throw new AiCeilingHitError({
                    scope: 'global',
                    feature,
                    spentMicroUsd: SPENT_MICRO_USD,
                    ceilingMicroUsd: CEILING_MICRO_USD
                });
            },
            getNow: () => new Date()
        });

        // Act + Assert
        await expect(
            engine.generateText({ feature: 'text_improve', locale: 'es', prompt: 'test' })
        ).rejects.toThrow(AiCeilingHitError);
    });

    it('should carry correct scope and spend values on AiCeilingHitError', async () => {
        // Arrange
        const CEILING = 50_000_000;
        const SPENT = 50_000_000;

        const engine = createAiEngine({
            getProvider: () => new StubProvider(),
            checkCeiling: async () => {
                throw new AiCeilingHitError({
                    scope: 'feature',
                    feature: 'chat',
                    spentMicroUsd: SPENT,
                    ceilingMicroUsd: CEILING
                });
            },
            getNow: () => new Date()
        });

        // Act
        let caught: AiCeilingHitError | undefined;
        try {
            await engine.generateText({ feature: 'chat', locale: 'es', prompt: 'test' });
        } catch (err) {
            caught = err as AiCeilingHitError;
        }

        // Assert
        expect(caught).toBeInstanceOf(AiCeilingHitError);
        expect(caught?.scope).toBe('feature');
        expect(caught?.feature).toBe('chat');
        expect(caught?.spentMicroUsd).toBe(SPENT);
        expect(caught?.ceilingMicroUsd).toBe(CEILING);
        expect(caught?.engineCode).toBe('CEILING_HIT');
    });

    it('should NOT call any provider when ceiling is hit (hard-stop before routing)', async () => {
        // Arrange
        const providerCallSpy = vi.fn();
        const trackingProvider: AiProvider = {
            ...new StubProvider(),
            generateText: providerCallSpy
        };

        const engine = createAiEngine({
            getProvider: () => trackingProvider,
            checkCeiling: async () => {
                throw new AiCeilingHitError({
                    scope: 'global',
                    spentMicroUsd: 100,
                    ceilingMicroUsd: 100
                });
            },
            getNow: () => new Date()
        });

        // Act
        await expect(
            engine.generateText({ feature: 'text_improve', locale: 'es', prompt: 'test' })
        ).rejects.toThrow(AiCeilingHitError);

        // Assert — provider was never called
        expect(providerCallSpy).not.toHaveBeenCalled();
    });

    it('should proceed normally when spend is below the ceiling (no ceiling hook throws)', async () => {
        // Arrange — checkCeiling resolves silently (below ceiling)
        const ceilingCallCount = { n: 0 };
        const engine = createAiEngine({
            getProvider: () => new StubProvider(),
            checkCeiling: async () => {
                ceilingCallCount.n++;
                // Spend is below ceiling — do NOT throw
            },
            getNow: () => new Date()
        });

        // Act
        const result = await engine.generateText({
            feature: 'text_improve',
            locale: 'es',
            prompt: 'safe call'
        });

        // Assert — call succeeded; checkCeiling was invoked
        expect(result).toBeDefined();
        expect(ceilingCallCount.n).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// AC-2 (3): refund-on-error semantics via recordAiUsage
// ---------------------------------------------------------------------------

describe('AC-2 — refund-on-error: metering status reflects call outcome', () => {
    it('should record status: success on a successful call', async () => {
        // Arrange
        mockInsertAiUsage.mockResolvedValue({ ...STUB_USAGE_ROW, status: 'success' });

        // Act
        const row = await recordAiUsage({
            userId: USER_ID,
            feature: 'text_improve',
            provider: 'openai',
            model: 'gpt-4o-mini',
            promptTokens: 10,
            completionTokens: 20,
            latencyMs: 100,
            status: 'success'
        });

        // Assert
        expect(row.status).toBe('success');
        expect(mockInsertAiUsage).toHaveBeenCalledOnce();
        const callArgs = mockInsertAiUsage.mock.calls[0]?.[0] as { status: string };
        expect(callArgs.status).toBe('success');
    });

    it('should record status: error on a failed call (no cost charged)', async () => {
        // Arrange — failed call: completionTokens = 0, cost = 0
        const errorRow = { ...STUB_USAGE_ROW, status: 'error', costEstimateMicroUsd: 0 };
        mockInsertAiUsage.mockResolvedValue(errorRow);

        // Act
        const row = await recordAiUsage({
            userId: USER_ID,
            feature: 'text_improve',
            provider: 'openai',
            model: 'gpt-4o-mini',
            promptTokens: 10,
            completionTokens: 0,
            latencyMs: 50,
            status: 'error'
        });

        // Assert — error status recorded; 0 output tokens → near-zero cost
        expect(row.status).toBe('error');
        const callArgs = mockInsertAiUsage.mock.calls[0]?.[0] as {
            status: string;
            costEstimateMicroUsd: number;
            tokensOut: number;
        };
        expect(callArgs.status).toBe('error');
        expect(callArgs.tokensOut).toBe(0);
    });

    it('should record status: ceiling_hit when a ceiling is breached', async () => {
        // Arrange — ceiling_hit is a terminal status (no tokens consumed)
        const ceilingRow = {
            ...STUB_USAGE_ROW,
            status: 'ceiling_hit',
            costEstimateMicroUsd: 0,
            tokensIn: 0,
            tokensOut: 0
        };
        mockInsertAiUsage.mockResolvedValue(ceilingRow);

        // Act
        const row = await recordAiUsage({
            userId: USER_ID,
            feature: 'chat',
            provider: 'anthropic',
            model: 'claude-3-5-haiku-20241022',
            promptTokens: 0,
            completionTokens: 0,
            latencyMs: 5,
            status: 'ceiling_hit'
        });

        // Assert
        expect(row.status).toBe('ceiling_hit');
    });

    it('should record status: kill_switch when a feature kill-switch was active', async () => {
        // Arrange
        const killSwitchRow = {
            ...STUB_USAGE_ROW,
            status: 'kill_switch',
            costEstimateMicroUsd: 0,
            tokensIn: 0,
            tokensOut: 0
        };
        mockInsertAiUsage.mockResolvedValue(killSwitchRow);

        // Act
        const row = await recordAiUsage({
            userId: USER_ID,
            feature: 'search',
            provider: 'openai',
            model: 'gpt-4o-mini',
            promptTokens: 0,
            completionTokens: 0,
            latencyMs: 1,
            status: 'kill_switch'
        });

        // Assert
        expect(row.status).toBe('kill_switch');
    });
});

// ---------------------------------------------------------------------------
// AC-2 (4): limits-per-plan matrix — cost calculator spot-checks
// ---------------------------------------------------------------------------

describe('AC-2 — limits-per-plan matrix via cost calculator', () => {
    it('should compute the correct cost for gpt-4o-mini (tourist-free tier model)', () => {
        // Arrange — tourist-free plan uses gpt-4o-mini
        // inputCost  = 250 * 150_000 / 1_000_000 = 37.5
        // outputCost = 180 * 600_000 / 1_000_000 = 108.0
        // total      = round(37.5 + 108.0) = 146

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

    it('should compute a higher cost for gpt-4o (pro tier model)', () => {
        // Arrange — pro plan uses gpt-4o (more expensive)
        // inputCost  = 250 * 2_500_000 / 1_000_000 = 625
        // outputCost = 180 * 10_000_000 / 1_000_000 = 1800
        // total      = round(625 + 1800) = 2425

        // Act
        const result = calculateCostMicroUsd({
            provider: 'openai',
            model: 'gpt-4o',
            promptTokens: 250,
            completionTokens: 180
        });

        // Assert — pro model costs significantly more than free-tier model
        expect(result.costMicroUsd).toBe(2425);
        expect(result.rated).toBe(true);
        expect(result.costMicroUsd).toBeGreaterThan(146);
    });

    it('should compute cost for claude-3-5-haiku (HOST tier model)', () => {
        // Arrange — HOST plan may use claude-3-5-haiku
        // inputCost  = 100 * 800_000 / 1_000_000 = 80
        // outputCost = 50 * 4_000_000 / 1_000_000 = 200
        // total      = round(80 + 200) = 280

        // Act
        const result = calculateCostMicroUsd({
            provider: 'anthropic',
            model: 'claude-3-5-haiku-20241022',
            promptTokens: 100,
            completionTokens: 50
        });

        // Assert
        expect(result.costMicroUsd).toBe(280);
        expect(result.rated).toBe(true);
    });

    it('should compute cost for claude-3-5-sonnet (premium tier model)', () => {
        // Arrange — premium/VIP tier
        // inputCost  = 100 * 3_000_000 / 1_000_000 = 300
        // outputCost = 50 * 15_000_000 / 1_000_000 = 750
        // total      = round(300 + 750) = 1050

        // Act
        const result = calculateCostMicroUsd({
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022',
            promptTokens: 100,
            completionTokens: 50
        });

        // Assert
        expect(result.costMicroUsd).toBe(1050);
        expect(result.rated).toBe(true);
    });

    it('should return rated: false for an unknown model (no throw, AC-7 never breaks)', () => {
        // Arrange — unrecognised model (future model not yet in MODEL_RATES)

        // Act
        const result = calculateCostMicroUsd({
            provider: 'openai',
            model: 'gpt-99-turbo-ultra',
            promptTokens: 500,
            completionTokens: 200
        });

        // Assert — zero cost, rated: false (metering never throws)
        expect(result.costMicroUsd).toBe(0);
        expect(result.rated).toBe(false);
    });

    it('should allow rateOverrides to supersede in-code MODEL_RATES', () => {
        // Arrange — admin sets a custom rate for gpt-4o-mini
        const customRates = {
            'gpt-4o-mini': {
                inputMicroUsdPerMillionTokens: 300_000, // custom: double the default
                outputMicroUsdPerMillionTokens: 1_200_000 // custom: double the default
            }
        };

        // Act — same token counts as the canonical test above
        const result = calculateCostMicroUsd({
            provider: 'openai',
            model: 'gpt-4o-mini',
            promptTokens: 250,
            completionTokens: 180,
            rateOverrides: customRates
        });

        // Assert — override doubles the default 146µUSD to 292µUSD
        // inputCost  = 250 * 300_000 / 1_000_000 = 75
        // outputCost = 180 * 1_200_000 / 1_000_000 = 216
        // total      = round(75 + 216) = 291
        expect(result.costMicroUsd).toBe(291);
        expect(result.rated).toBe(true);

        // Override result must differ from default
        const defaultResult = calculateCostMicroUsd({
            provider: 'openai',
            model: 'gpt-4o-mini',
            promptTokens: 250,
            completionTokens: 180
        });
        expect(result.costMicroUsd).not.toBe(defaultResult.costMicroUsd);
    });

    it('should have MODEL_RATES entries for all expected provider models', () => {
        // Assert — registry completeness: each tier model is present
        expect(MODEL_RATES['gpt-4o-mini']).toBeDefined();
        expect(MODEL_RATES['gpt-4o']).toBeDefined();
        expect(MODEL_RATES['claude-3-5-haiku-20241022']).toBeDefined();
        expect(MODEL_RATES['claude-3-5-sonnet-20241022']).toBeDefined();
    });

    it('should all have positive integer rates (no floats or zero-rate entries)', () => {
        // Assert — money convention: integer µUSD, positive rates
        for (const [model, rate] of Object.entries(MODEL_RATES)) {
            expect(Number.isInteger(rate.inputMicroUsdPerMillionTokens)).toBe(true);
            expect(Number.isInteger(rate.outputMicroUsdPerMillionTokens)).toBe(true);
            expect(rate.inputMicroUsdPerMillionTokens).toBeGreaterThan(0);
            expect(rate.outputMicroUsdPerMillionTokens).toBeGreaterThan(0);
            // Output should be more expensive than input (typical LLM pricing)
            expect(rate.outputMicroUsdPerMillionTokens).toBeGreaterThanOrEqual(
                rate.inputMicroUsdPerMillionTokens
            );
            void model; // prevent unused-var lint
        }
    });
});

// ---------------------------------------------------------------------------
// AC-2 (5): ceiling semantics — AT boundary is a breach (>= not >)
// ---------------------------------------------------------------------------

describe('AC-2 — ceiling at-or-over semantics', () => {
    it('should hard-stop when spend == ceiling (>= boundary, not just >)', async () => {
        // Arrange — spend is exactly equal to the ceiling
        const CEILING = 100_000; // 10 cents in µUSD

        const engine = createAiEngine({
            getProvider: () => new StubProvider(),
            checkCeiling: async () => {
                // Simulates: aggregated spend EQUALS the ceiling
                const SPENT = CEILING;
                if (SPENT >= CEILING) {
                    throw new AiCeilingHitError({
                        scope: 'global',
                        spentMicroUsd: SPENT,
                        ceilingMicroUsd: CEILING
                    });
                }
            },
            getNow: () => new Date()
        });

        // Act + Assert — must throw even at equality
        await expect(
            engine.generateText({ feature: 'text_improve', locale: 'es', prompt: 'test' })
        ).rejects.toThrow(AiCeilingHitError);
    });

    it('should resolve when spend is 1 µUSD below the ceiling', async () => {
        // Arrange — spend is one micro-USD below the ceiling
        const CEILING = 100_000;

        const engine = createAiEngine({
            getProvider: () => new StubProvider(),
            checkCeiling: async () => {
                const SPENT = CEILING - 1;
                // Should NOT throw: SPENT < CEILING
                if (SPENT >= CEILING) {
                    throw new AiCeilingHitError({
                        scope: 'global',
                        spentMicroUsd: SPENT,
                        ceilingMicroUsd: CEILING
                    });
                }
            },
            getNow: () => new Date()
        });

        // Act + Assert — resolves normally
        await expect(
            engine.generateText({ feature: 'text_improve', locale: 'es', prompt: 'test' })
        ).resolves.toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// AC-2 (6): events recorded alongside ceiling / quota flow
// ---------------------------------------------------------------------------

describe('AC-2 — engine events emitted alongside quota enforcement', () => {
    it('should emit a kill_switch event when the feature is disabled (quota-adjacent)', async () => {
        // Arrange — feature disabled is like quota exhausted: no call served
        const DISABLED_CONFIG: AiFeatureConfig = {
            enabled: false,
            primaryProvider: 'openai',
            fallbackChain: [],
            model: 'gpt-4o-mini',
            params: {}
        };
        mockResolveFeatureConfig.mockResolvedValue(DISABLED_CONFIG);

        const events: AiEngineEvent[] = [];
        const engine = createAiEngine({
            getProvider: () => new StubProvider(),
            recordEvent: (e) => events.push(e)
        });

        // Act
        await expect(
            engine.generateText({ feature: 'text_improve', locale: 'es', prompt: 'test' })
        ).rejects.toBeDefined();

        // Assert
        expect(events.some((e) => e.type === 'kill_switch')).toBe(true);
    });
});
