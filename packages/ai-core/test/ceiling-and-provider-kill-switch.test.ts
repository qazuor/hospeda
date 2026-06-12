/**
 * Tests for cost-ceiling check and provider kill-switch (SPEC-173 T-017).
 *
 * ## Coverage
 *
 * ### checkCostCeiling (usage/ceiling.ts)
 * 1. No ceilings configured → resolves silently.
 * 2. Global spend below ceiling → resolves silently.
 * 3. Global spend AT ceiling (==) → throws AiCeilingHitError(scope: 'global') (AC-8 boundary).
 * 4. Global spend OVER ceiling → throws AiCeilingHitError(scope: 'global').
 * 5. Per-feature spend at ceiling → throws AiCeilingHitError(scope: 'feature').
 * 6. Per-feature spend below ceiling → resolves silently.
 * 7. Global check runs first; feature check is skipped on global breach.
 *
 * ### Engine provider kill-switch (engine.ts — routeWithFallback)
 * 8. Primary provider disabled (enabled:false) → falls back to enabled secondary.
 * 9. All providers disabled → throws AiNoEnabledProviderError.
 * 10. Provider with NO entry in providers map → NOT skipped (existing behaviour preserved).
 *
 * ### Engine ceiling hook wiring (engine.ts — createAiEngine)
 * 11. When checkCeiling throws AiCeilingHitError, the engine call rejects with it.
 * 12. When checkCeiling is absent, calls proceed normally (no regression, AC-9-adjacent).
 * 13. When getNow is absent but checkCeiling is set, hook is skipped and call proceeds.
 *
 * The storage layer and config resolver are fully stubbed — no DB connection needed.
 *
 * @module test/ceiling-and-provider-kill-switch
 */

import type { AiFeatureConfig, AiSettingsValue } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    AiCeilingHitError,
    AiFeatureDisabledError,
    AiNoEnabledProviderError,
    createAiEngine
} from '../src/engine/index.js';
import type { AiEngine, AiEngineEvent } from '../src/engine/index.js';
import type { AiProvider } from '../src/providers/ai-provider.interface.js';
import { StubProvider } from '../src/providers/index.js';
import { DEFAULT_COST_CEILINGS } from '../src/usage/model-rates.js';

// ---------------------------------------------------------------------------
// Mock: prompt-resolver — no DB required (T-034)
//
// engine.ts calls resolveSystemPrompt on every capability call.  Mock the
// entire resolver so tests in this file are unaffected by the injection.
// ---------------------------------------------------------------------------

vi.mock('../src/config/prompt-resolver.js', () => ({
    resolveSystemPrompt: vi.fn(() =>
        Promise.resolve({ content: 'default system prompt', rules: '', source: 'default' })
    ),
    invalidatePromptCache: vi.fn(),
    composeSystemPrompt: vi.fn(({ content }: { content: string; rules: string | null }) => content)
}));

// ---------------------------------------------------------------------------
// Mock: config resolver
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
// Mock: storage (aggregateAiUsageByMonth + resolveConfig dependency for ceiling.ts)
// ---------------------------------------------------------------------------

vi.mock('../src/storage/index.js', () => ({
    aggregateAiUsageByMonth: vi.fn(),
    aggregateAiUsageByUser: vi.fn(),
    aggregateAiUsageByFeature: vi.fn(),
    insertAiUsage: vi.fn(),
    insertAiRequestLog: vi.fn(),
    readAiSettings: vi.fn(),
    writeAiSettings: vi.fn(),
    getActivePrompt: vi.fn(),
    AiSettingsParseError: class AiSettingsParseError extends Error {}
}));

import * as promptResolverModule from '../src/config/prompt-resolver.js';
import * as storageModule from '../src/storage/index.js';
import { checkCostCeiling } from '../src/usage/ceiling.js';

const mockAggregateByMonth = storageModule.aggregateAiUsageByMonth as ReturnType<typeof vi.fn>;
const mockResolveSystemPrompt = promptResolverModule.resolveSystemPrompt as ReturnType<
    typeof vi.fn
>;
const mockComposeSystemPrompt = promptResolverModule.composeSystemPrompt as ReturnType<
    typeof vi.fn
>;

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-06-04T12:00:00.000Z');

const FEATURE_CONFIG_ENABLED: AiFeatureConfig = {
    enabled: true,
    primaryProvider: 'openai',
    fallbackChain: ['anthropic'],
    model: 'gpt-4o-mini',
    params: {}
};

/**
 * Builds a minimal AiSettingsValue with given providers config and optional ceilings.
 */
function makeSettingsValue(
    providers: AiSettingsValue['providers'],
    costCeilings?: AiSettingsValue['costCeilings']
): AiSettingsValue {
    // Cast: AiFeaturesMap requires all feature keys but we don't need them in these tests.
    return {
        providers,
        features: {} as AiSettingsValue['features'],
        costCeilings
    };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
    // resetAllMocks clears all state including mockResolvedValueOnce queues,
    // preventing Once-value leakage between tests.
    vi.resetAllMocks();

    // Default: empty providers map (no kill-switches active), feature enabled.
    mockResolveConfig.mockResolvedValue(makeSettingsValue({}));
    mockResolveFeatureConfig.mockResolvedValue(FEATURE_CONFIG_ENABLED);
    mockIsFeatureKillSwitched.mockImplementation((cfg: AiFeatureConfig) => !cfg.enabled);
    mockGetProviderOrder.mockImplementation(
        ({ featureConfig }: { featureConfig: AiFeatureConfig }) => ({
            providers: [featureConfig.primaryProvider, ...featureConfig.fallbackChain]
        })
    );

    // Default: aggregateAiUsageByMonth returns no rows (zero spend).
    mockAggregateByMonth.mockResolvedValue([]);

    // Restore prompt-resolver mocks after resetAllMocks so engine tests can
    // proceed (resolveSystemPrompt is called on every engine capability call).
    mockResolveSystemPrompt.mockResolvedValue({
        content: 'default system prompt',
        rules: '',
        source: 'default'
    });
    mockComposeSystemPrompt.mockImplementation(
        ({ content }: { content: string; rules: string | null }) => content
    );
});

// ---------------------------------------------------------------------------
// Engine test helpers
// ---------------------------------------------------------------------------

function makeEngine(
    providers: Map<string, AiProvider>,
    overrides: {
        checkCeiling?: (input: { feature: string; now: Date }) => Promise<void>;
        getNow?: () => Date;
        events?: AiEngineEvent[];
    } = {}
): AiEngine {
    const { checkCeiling, getNow, events } = overrides;
    return createAiEngine({
        getProvider: (id) => {
            const p = providers.get(id);
            if (!p) throw new Error(`No provider registered for id: ${id}`);
            return p;
        },
        recordEvent: events ? (e) => events.push(e) : undefined,
        checkCeiling,
        getNow
    });
}

// ---------------------------------------------------------------------------
// Part A: checkCostCeiling unit tests
// ---------------------------------------------------------------------------

describe('checkCostCeiling', () => {
    // -------------------------------------------------------------------------
    // 1. No ceilings configured → DEFAULT_COST_CEILINGS applied (SPEC-211 G-1)
    // -------------------------------------------------------------------------

    describe('when no costCeilings are configured in the blob', () => {
        it('should still enforce DEFAULT_COST_CEILINGS (ceiling is always-on)', async () => {
            // Arrange — no costCeilings in blob; spend is zero, well below defaults.
            mockResolveConfig.mockResolvedValue(makeSettingsValue({}));
            mockAggregateByMonth.mockResolvedValue([]);

            // Act + Assert — with zero spend, neither global nor feature ceiling is
            // breached so the call resolves silently, but the DB IS queried because
            // DEFAULT_COST_CEILINGS kicks in and enforcement runs.
            await expect(checkCostCeiling({ feature: 'chat', now: NOW })).resolves.toBeUndefined();

            // aggregateAiUsageByMonth MUST be called — enforcement is active.
            expect(mockAggregateByMonth).toHaveBeenCalled();
        });

        it('should throw AiCeilingHitError when global default ceiling is breached', async () => {
            // Arrange — no costCeilings blob; global spend >= 100_000_000 µUSD default.
            mockResolveConfig.mockResolvedValue(makeSettingsValue({}));
            mockAggregateByMonth.mockResolvedValueOnce([
                {
                    month: '2026-06',
                    calls: 100,
                    tokensIn: 1_000_000,
                    tokensOut: 500_000,
                    costMicroUsd: 100_000_000 // equals DEFAULT_COST_CEILINGS.globalMonthlyMicroUsd
                }
            ]);

            // Act + Assert — default global ceiling must block the call.
            await expect(checkCostCeiling({ feature: 'chat', now: NOW })).rejects.toThrow(
                AiCeilingHitError
            );
        });

        it('should throw AiCeilingHitError when per-feature default ceiling is breached', async () => {
            // Arrange — no costCeilings blob; chat feature spend >= 45_000_000 µUSD default.
            // Global query returns below global ceiling; feature query returns at feature ceiling.
            mockResolveConfig.mockResolvedValue(makeSettingsValue({}));
            // Global query: below global default (100_000_000)
            mockAggregateByMonth.mockResolvedValueOnce([
                {
                    month: '2026-06',
                    calls: 10,
                    tokensIn: 100_000,
                    tokensOut: 50_000,
                    costMicroUsd: 10_000_000
                }
            ]);
            // Feature query: AT default chat ceiling (45_000_000)
            mockAggregateByMonth.mockResolvedValueOnce([
                {
                    month: '2026-06',
                    calls: 5,
                    tokensIn: 50_000,
                    tokensOut: 25_000,
                    costMicroUsd: 45_000_000
                }
            ]);

            // Act
            let caughtErr: unknown;
            try {
                await checkCostCeiling({ feature: 'chat', now: NOW });
            } catch (err) {
                caughtErr = err;
            }

            // Assert — default per-feature ceiling enforced
            expect(caughtErr).toBeInstanceOf(AiCeilingHitError);
            const ceilErr = caughtErr as AiCeilingHitError;
            expect(ceilErr.scope).toBe('feature');
            expect(ceilErr.feature).toBe('chat');
            expect(ceilErr.ceilingMicroUsd).toBe(
                DEFAULT_COST_CEILINGS.perFeatureMonthlyMicroUsd?.chat
            );
        });
    });

    // -------------------------------------------------------------------------
    // 2. Global spend below ceiling → resolves silently
    // -------------------------------------------------------------------------

    describe('when global spend is below the ceiling', () => {
        it('should resolve without throwing', async () => {
            // Arrange — ceiling $200 (200_000_000 µUSD), spent $100 (100_000_000 µUSD)
            const globalMonthlyMicroUsd = 200_000_000;
            mockResolveConfig.mockResolvedValue(makeSettingsValue({}, { globalMonthlyMicroUsd }));
            mockAggregateByMonth.mockResolvedValue([
                {
                    month: '2026-06',
                    calls: 10,
                    tokensIn: 1000,
                    tokensOut: 500,
                    costMicroUsd: 100_000_000
                }
            ]);

            // Act + Assert
            await expect(
                checkCostCeiling({ feature: 'text_improve', now: NOW })
            ).resolves.toBeUndefined();
        });
    });

    // -------------------------------------------------------------------------
    // 3. Global spend AT ceiling (==) → throws AiCeilingHitError (AC-8 boundary)
    // -------------------------------------------------------------------------

    describe('when global spend equals the ceiling exactly (AC-8 boundary)', () => {
        it('should throw AiCeilingHitError with scope "global"', async () => {
            // Arrange — ceiling = spent = $200 (two rows summing to exactly the ceiling —
            // tests the defensive sum in the implementation).
            const globalMonthlyMicroUsd = 200_000_000;
            mockResolveConfig.mockResolvedValue(makeSettingsValue({}, { globalMonthlyMicroUsd }));
            mockAggregateByMonth.mockResolvedValue([
                {
                    month: '2026-06',
                    calls: 10,
                    tokensIn: 1000,
                    tokensOut: 500,
                    costMicroUsd: 100_000_000
                },
                {
                    month: '2026-06',
                    calls: 5,
                    tokensIn: 500,
                    tokensOut: 250,
                    costMicroUsd: 100_000_000
                }
            ]);

            // Act
            let caughtErr: unknown;
            try {
                await checkCostCeiling({ feature: 'chat', now: NOW });
            } catch (err) {
                caughtErr = err;
            }

            // Assert
            expect(caughtErr).toBeInstanceOf(AiCeilingHitError);
            const ceilErr = caughtErr as AiCeilingHitError;
            expect(ceilErr.scope).toBe('global');
            expect(ceilErr.spentMicroUsd).toBe(200_000_000);
            expect(ceilErr.ceilingMicroUsd).toBe(200_000_000);
            expect(ceilErr.feature).toBeUndefined();
            expect(ceilErr.engineCode).toBe('CEILING_HIT');
        });
    });

    // -------------------------------------------------------------------------
    // 4. Global spend OVER ceiling → throws AiCeilingHitError
    // -------------------------------------------------------------------------

    describe('when global spend exceeds the ceiling', () => {
        it('should throw AiCeilingHitError with spent and ceiling values', async () => {
            // Arrange
            const globalMonthlyMicroUsd = 200_000_000;
            mockResolveConfig.mockResolvedValue(makeSettingsValue({}, { globalMonthlyMicroUsd }));
            mockAggregateByMonth.mockResolvedValue([
                {
                    month: '2026-06',
                    calls: 20,
                    tokensIn: 2000,
                    tokensOut: 1000,
                    costMicroUsd: 250_000_000
                }
            ]);

            // Act + Assert
            await expect(checkCostCeiling({ feature: 'chat', now: NOW })).rejects.toThrow(
                AiCeilingHitError
            );
        });
    });

    // -------------------------------------------------------------------------
    // 5. Per-feature spend AT ceiling → throws AiCeilingHitError(scope: 'feature')
    // -------------------------------------------------------------------------

    describe('when per-feature spend equals the ceiling', () => {
        it('should throw AiCeilingHitError with scope "feature" and feature set', async () => {
            // Arrange — no global ceiling; chat feature ceiling = $50
            // When no globalMonthlyMicroUsd is set, the global aggregateAiUsageByMonth
            // call is skipped entirely.  The single mock value is for the feature query.
            const perFeatureMonthlyMicroUsd = { chat: 50_000_000 };
            mockResolveConfig.mockResolvedValue(
                makeSettingsValue({}, { perFeatureMonthlyMicroUsd })
            );
            mockAggregateByMonth.mockResolvedValue([
                {
                    month: '2026-06',
                    calls: 5,
                    tokensIn: 500,
                    tokensOut: 250,
                    costMicroUsd: 50_000_000
                }
            ]);

            // Act
            let caughtErr: unknown;
            try {
                await checkCostCeiling({ feature: 'chat', now: NOW });
            } catch (err) {
                caughtErr = err;
            }

            // Assert
            expect(caughtErr).toBeInstanceOf(AiCeilingHitError);
            const ceilErr = caughtErr as AiCeilingHitError;
            expect(ceilErr.scope).toBe('feature');
            expect(ceilErr.feature).toBe('chat');
            expect(ceilErr.spentMicroUsd).toBe(50_000_000);
            expect(ceilErr.ceilingMicroUsd).toBe(50_000_000);
        });
    });

    // -------------------------------------------------------------------------
    // 6. Per-feature spend below ceiling → resolves silently
    // -------------------------------------------------------------------------

    describe('when per-feature spend is below the ceiling', () => {
        it('should resolve without throwing', async () => {
            // Arrange — chat ceiling $50, spent $10
            const perFeatureMonthlyMicroUsd = { chat: 50_000_000 };
            mockResolveConfig.mockResolvedValue(
                makeSettingsValue({}, { perFeatureMonthlyMicroUsd })
            );
            mockAggregateByMonth.mockResolvedValue([
                {
                    month: '2026-06',
                    calls: 2,
                    tokensIn: 200,
                    tokensOut: 100,
                    costMicroUsd: 10_000_000
                }
            ]);

            // Act + Assert
            await expect(checkCostCeiling({ feature: 'chat', now: NOW })).resolves.toBeUndefined();
        });
    });

    // -------------------------------------------------------------------------
    // 7. Global check runs first — feature check skipped on global breach
    // -------------------------------------------------------------------------

    describe('when both global and per-feature ceilings are set and global is breached', () => {
        it('should throw AiCeilingHitError for global scope without checking feature', async () => {
            // Arrange
            const globalMonthlyMicroUsd = 100_000_000;
            const perFeatureMonthlyMicroUsd = { text_improve: 50_000_000 };
            mockResolveConfig.mockResolvedValue(
                makeSettingsValue({}, { globalMonthlyMicroUsd, perFeatureMonthlyMicroUsd })
            );
            // Global query returns over ceiling → global breach.
            mockAggregateByMonth.mockResolvedValueOnce([
                {
                    month: '2026-06',
                    calls: 15,
                    tokensIn: 1500,
                    tokensOut: 750,
                    costMicroUsd: 150_000_000
                }
            ]);

            // Act + Assert
            let caughtErr: unknown;
            try {
                await checkCostCeiling({ feature: 'text_improve', now: NOW });
            } catch (err) {
                caughtErr = err;
            }

            expect(caughtErr).toBeInstanceOf(AiCeilingHitError);
            expect((caughtErr as AiCeilingHitError).scope).toBe('global');

            // Feature query was never called (global breach short-circuits).
            expect(mockAggregateByMonth).toHaveBeenCalledTimes(1);
        });
    });

    // -------------------------------------------------------------------------
    // onThresholdAlert hook tests (SPEC-173 T-025)
    // -------------------------------------------------------------------------

    describe('onThresholdAlert hook', () => {
        // -----------------------------------------------------------------------
        // 8. Hook called with 50% band for global scope
        // -----------------------------------------------------------------------

        describe('when global spend crosses the 50% band', () => {
            it('should call the hook with thresholdPct=50 and scope="global"', async () => {
                // Arrange — ceiling $200, spent $100 (exactly 50%)
                const globalMonthlyMicroUsd = 200_000_000;
                mockResolveConfig.mockResolvedValue(
                    makeSettingsValue({}, { globalMonthlyMicroUsd })
                );
                mockAggregateByMonth.mockResolvedValue([
                    {
                        month: '2026-06',
                        calls: 10,
                        tokensIn: 1000,
                        tokensOut: 500,
                        costMicroUsd: 100_000_000
                    }
                ]);
                const hook = vi.fn();

                // Act
                await checkCostCeiling({ feature: 'chat', now: NOW, onThresholdAlert: hook });

                // Assert
                expect(hook).toHaveBeenCalledOnce();
                expect(hook).toHaveBeenCalledWith(
                    expect.objectContaining({
                        scope: 'global',
                        thresholdPct: 50,
                        spentMicroUsd: 100_000_000,
                        ceilingMicroUsd: 200_000_000,
                        period: '2026-06'
                    })
                );
                // No feature key on global scope
                expect(hook.mock.calls[0]?.[0]?.feature).toBeUndefined();
            });
        });

        // -----------------------------------------------------------------------
        // 9. Hook called with 80% band for global scope
        // -----------------------------------------------------------------------

        describe('when global spend crosses the 80% band', () => {
            it('should call the hook with thresholdPct=80 and scope="global"', async () => {
                // Arrange — ceiling $200, spent $160 (exactly 80%)
                const globalMonthlyMicroUsd = 200_000_000;
                mockResolveConfig.mockResolvedValue(
                    makeSettingsValue({}, { globalMonthlyMicroUsd })
                );
                mockAggregateByMonth.mockResolvedValue([
                    {
                        month: '2026-06',
                        calls: 10,
                        tokensIn: 1000,
                        tokensOut: 500,
                        costMicroUsd: 160_000_000
                    }
                ]);
                const hook = vi.fn();

                // Act
                await checkCostCeiling({ feature: 'chat', now: NOW, onThresholdAlert: hook });

                // Assert
                expect(hook).toHaveBeenCalledOnce();
                expect(hook.mock.calls[0]?.[0]?.thresholdPct).toBe(80);
            });
        });

        // -----------------------------------------------------------------------
        // 10. Hook called with 100% band for global scope AND error still throws
        // -----------------------------------------------------------------------

        describe('when global spend reaches 100%', () => {
            it('should call the hook with thresholdPct=100 AND still throw AiCeilingHitError', async () => {
                // Arrange — ceiling $200, spent $200 (exactly 100%)
                const globalMonthlyMicroUsd = 200_000_000;
                mockResolveConfig.mockResolvedValue(
                    makeSettingsValue({}, { globalMonthlyMicroUsd })
                );
                mockAggregateByMonth.mockResolvedValue([
                    {
                        month: '2026-06',
                        calls: 10,
                        tokensIn: 1000,
                        tokensOut: 500,
                        costMicroUsd: 200_000_000
                    }
                ]);
                const hook = vi.fn();

                // Act
                let caughtErr: unknown;
                try {
                    await checkCostCeiling({ feature: 'chat', now: NOW, onThresholdAlert: hook });
                } catch (err) {
                    caughtErr = err;
                }

                // Assert — hook fired
                expect(hook).toHaveBeenCalledOnce();
                expect(hook.mock.calls[0]?.[0]?.thresholdPct).toBe(100);

                // AND error still thrown
                expect(caughtErr).toBeInstanceOf(AiCeilingHitError);
                expect((caughtErr as AiCeilingHitError).scope).toBe('global');
            });
        });

        // -----------------------------------------------------------------------
        // 11. Hook called for feature scope with correct feature value
        // -----------------------------------------------------------------------

        describe('when per-feature spend crosses 50%', () => {
            it('should call the hook with scope="feature" and the feature name', async () => {
                // Arrange — feature ceiling $100, spent $50 (50%)
                const perFeatureMonthlyMicroUsd = { chat: 100_000_000 };
                mockResolveConfig.mockResolvedValue(
                    makeSettingsValue({}, { perFeatureMonthlyMicroUsd })
                );
                mockAggregateByMonth.mockResolvedValue([
                    {
                        month: '2026-06',
                        calls: 5,
                        tokensIn: 500,
                        tokensOut: 250,
                        costMicroUsd: 50_000_000
                    }
                ]);
                const hook = vi.fn();

                // Act
                await checkCostCeiling({ feature: 'chat', now: NOW, onThresholdAlert: hook });

                // Assert
                expect(hook).toHaveBeenCalledOnce();
                expect(hook).toHaveBeenCalledWith(
                    expect.objectContaining({
                        scope: 'feature',
                        feature: 'chat',
                        thresholdPct: 50,
                        spentMicroUsd: 50_000_000,
                        ceilingMicroUsd: 100_000_000,
                        period: '2026-06'
                    })
                );
            });
        });

        // -----------------------------------------------------------------------
        // 12. Hook called with 100% band for feature scope AND error still throws
        // -----------------------------------------------------------------------

        describe('when per-feature spend reaches 100%', () => {
            it('should call the hook with thresholdPct=100 AND still throw AiCeilingHitError', async () => {
                // Arrange — feature ceiling $50, spent $50 (100%)
                const perFeatureMonthlyMicroUsd = { chat: 50_000_000 };
                mockResolveConfig.mockResolvedValue(
                    makeSettingsValue({}, { perFeatureMonthlyMicroUsd })
                );
                mockAggregateByMonth.mockResolvedValue([
                    {
                        month: '2026-06',
                        calls: 5,
                        tokensIn: 500,
                        tokensOut: 250,
                        costMicroUsd: 50_000_000
                    }
                ]);
                const hook = vi.fn();

                // Act
                let caughtErr: unknown;
                try {
                    await checkCostCeiling({ feature: 'chat', now: NOW, onThresholdAlert: hook });
                } catch (err) {
                    caughtErr = err;
                }

                // Assert — hook fired before throw
                expect(hook).toHaveBeenCalledOnce();
                expect(hook.mock.calls[0]?.[0]?.thresholdPct).toBe(100);

                // AND error still thrown
                expect(caughtErr).toBeInstanceOf(AiCeilingHitError);
                expect((caughtErr as AiCeilingHitError).scope).toBe('feature');
            });
        });

        // -----------------------------------------------------------------------
        // 13. Hook NOT called when spend is below 50%
        // -----------------------------------------------------------------------

        describe('when global spend is below 50%', () => {
            it('should NOT call the hook', async () => {
                // Arrange — ceiling $200, spent $80 (40%)
                const globalMonthlyMicroUsd = 200_000_000;
                mockResolveConfig.mockResolvedValue(
                    makeSettingsValue({}, { globalMonthlyMicroUsd })
                );
                mockAggregateByMonth.mockResolvedValue([
                    {
                        month: '2026-06',
                        calls: 5,
                        tokensIn: 500,
                        tokensOut: 250,
                        costMicroUsd: 80_000_000
                    }
                ]);
                const hook = vi.fn();

                // Act
                await checkCostCeiling({ feature: 'chat', now: NOW, onThresholdAlert: hook });

                // Assert
                expect(hook).not.toHaveBeenCalled();
            });
        });

        // -----------------------------------------------------------------------
        // 14. When no ceilings in blob, DEFAULT_COST_CEILINGS applies — hook
        //     fires only if DEFAULT spend thresholds are crossed (SPEC-211 G-1).
        // -----------------------------------------------------------------------

        describe('when no ceilings are configured in the blob (DEFAULT_COST_CEILINGS applies)', () => {
            it('should NOT call the hook when spend is well below the default ceilings', async () => {
                // Arrange — zero spend, no blob ceilings; defaults apply but thresholds
                // are not crossed (0 < 50% of 100_000_000).
                mockResolveConfig.mockResolvedValue(makeSettingsValue({}));
                mockAggregateByMonth.mockResolvedValue([]);
                const hook = vi.fn();

                // Act
                await checkCostCeiling({ feature: 'chat', now: NOW, onThresholdAlert: hook });

                // Assert — no threshold crossed, hook silent
                expect(hook).not.toHaveBeenCalled();
            });

            it('should call the hook when spend crosses the default global 50% band', async () => {
                // Arrange — global spend at exactly 50% of DEFAULT global ceiling (50_000_000).
                // The per-feature chat query returns below the chat ceiling (45_000_000) so
                // only the global 50% alert fires and no ceiling breach is thrown.
                mockResolveConfig.mockResolvedValue(makeSettingsValue({}));
                // Global aggregate query
                mockAggregateByMonth.mockResolvedValueOnce([
                    {
                        month: '2026-06',
                        calls: 50,
                        tokensIn: 500_000,
                        tokensOut: 250_000,
                        costMicroUsd: 50_000_000 // exactly 50% of 100_000_000 global default
                    }
                ]);
                // Per-feature chat query — below the 45_000_000 chat ceiling
                mockAggregateByMonth.mockResolvedValueOnce([
                    {
                        month: '2026-06',
                        calls: 10,
                        tokensIn: 100_000,
                        tokensOut: 50_000,
                        costMicroUsd: 10_000_000 // well below 45_000_000 chat ceiling
                    }
                ]);
                const hook = vi.fn();

                // Act
                await checkCostCeiling({ feature: 'chat', now: NOW, onThresholdAlert: hook });

                // Assert — global 50% band crossed → hook fired with global scope
                expect(hook).toHaveBeenCalledWith(
                    expect.objectContaining({
                        scope: 'global',
                        thresholdPct: 50,
                        ceilingMicroUsd: DEFAULT_COST_CEILINGS.globalMonthlyMicroUsd
                    })
                );
            });
        });

        // -----------------------------------------------------------------------
        // 15. Correct period string format YYYY-MM
        // -----------------------------------------------------------------------

        describe('period string format', () => {
            it('should format period as YYYY-MM with zero-padded month', async () => {
                // Arrange — use a date with single-digit month (January = month 1)
                const nowJanuary = new Date('2026-01-15T12:00:00.000Z');
                const globalMonthlyMicroUsd = 100_000_000;
                mockResolveConfig.mockResolvedValue(
                    makeSettingsValue({}, { globalMonthlyMicroUsd })
                );
                mockAggregateByMonth.mockResolvedValue([
                    {
                        month: '2026-01',
                        calls: 5,
                        tokensIn: 500,
                        tokensOut: 250,
                        costMicroUsd: 50_000_000
                    }
                ]);
                const hook = vi.fn();

                // Act
                await checkCostCeiling({
                    feature: 'chat',
                    now: nowJanuary,
                    onThresholdAlert: hook
                });

                // Assert
                expect(hook).toHaveBeenCalledOnce();
                expect(hook.mock.calls[0]?.[0]?.period).toBe('2026-01');
            });
        });
    });

    // -------------------------------------------------------------------------
    // F5: ceiling = 0 → call blocked, no NaN band / alert
    // -------------------------------------------------------------------------

    describe('when the global ceiling is 0 (F5 zero-guard)', () => {
        it('should throw AiCeilingHitError immediately even with zero spend', async () => {
            // Arrange — ceiling $0, any positive or zero spend triggers the hard-stop.
            // deriveCrossedBand(0, 0) must not produce NaN; it returns null (no band).
            const globalMonthlyMicroUsd = 0;
            mockResolveConfig.mockResolvedValue(makeSettingsValue({}, { globalMonthlyMicroUsd }));
            // Spent = 0 (no rows); 0 >= 0 is true → hard-stop.
            mockAggregateByMonth.mockResolvedValue([]);

            const hook = vi.fn();

            // Act
            let caughtErr: unknown;
            try {
                await checkCostCeiling({ feature: 'chat', now: NOW, onThresholdAlert: hook });
            } catch (err) {
                caughtErr = err;
            }

            // Assert — ceiling hit, no NaN band, no spurious alert
            expect(caughtErr).toBeInstanceOf(AiCeilingHitError);
            const ceilErr = caughtErr as AiCeilingHitError;
            expect(ceilErr.scope).toBe('global');
            expect(ceilErr.ceilingMicroUsd).toBe(0);
            // The hook must NOT have been called — ceiling=0 yields null band
            // so no percentage alert is fired; the hard-stop is the only outcome.
            expect(hook).not.toHaveBeenCalled();
        });

        it('should also block per-feature ceiling=0', async () => {
            // Arrange — no global ceiling; chat feature ceiling = 0
            const perFeatureMonthlyMicroUsd = { chat: 0 };
            mockResolveConfig.mockResolvedValue(
                makeSettingsValue({}, { perFeatureMonthlyMicroUsd })
            );
            mockAggregateByMonth.mockResolvedValue([]);

            const hook = vi.fn();

            // Act + Assert
            await expect(
                checkCostCeiling({ feature: 'chat', now: NOW, onThresholdAlert: hook })
            ).rejects.toBeInstanceOf(AiCeilingHitError);

            // No alert fired for a zero ceiling
            expect(hook).not.toHaveBeenCalled();
        });
    });
});

// ---------------------------------------------------------------------------
// Part B: Engine provider kill-switch tests
// ---------------------------------------------------------------------------

describe('engine — provider kill-switch filtering', () => {
    // -------------------------------------------------------------------------
    // 8. Primary disabled → falls back to enabled secondary
    // -------------------------------------------------------------------------

    describe('when primaryProvider is disabled (enabled:false)', () => {
        it('should skip the primary and succeed via the fallback provider', async () => {
            // Arrange — openai disabled, anthropic enabled (no entry in map = not skipped)
            mockResolveConfig.mockResolvedValue(makeSettingsValue({ openai: { enabled: false } }));

            const stub = new StubProvider();
            // anthropic is the fallback and has NO providers map entry → kept
            const anthropicProvider: AiProvider = {
                ...stub,
                id: 'anthropic',
                generateText: (req) => stub.generateText(req)
            };
            const providers = new Map<string, AiProvider>([
                ['openai', stub], // disabled — should not be called
                ['anthropic', anthropicProvider]
            ]);
            const events: AiEngineEvent[] = [];
            const engine = makeEngine(providers, { events });

            // Act
            const result = await engine.generateText({
                feature: 'text_improve',
                locale: 'es',
                prompt: 'Hello'
            });

            // Assert — call succeeded
            expect(result.text).toBeDefined();

            // The openai provider was filtered out; the success event should be
            // for anthropic (the only provider in the filtered chain).
            const successEvent = events.find((e) => e.type === 'success');
            expect(successEvent).toBeDefined();
            expect(successEvent).toMatchObject({ type: 'success', providerId: 'anthropic' });
        });
    });

    // -------------------------------------------------------------------------
    // 9. All providers disabled → throws AiNoEnabledProviderError
    // -------------------------------------------------------------------------

    describe('when all providers in the chain are disabled', () => {
        it('should throw AiNoEnabledProviderError without calling any provider', async () => {
            // Arrange — both openai and anthropic disabled
            mockResolveConfig.mockResolvedValue(
                makeSettingsValue({
                    openai: { enabled: false },
                    anthropic: { enabled: false }
                })
            );

            const openaiSpy = vi.fn().mockResolvedValue({ text: 'ok', usage: {} });
            const openaiProvider: AiProvider = {
                ...new StubProvider(),
                id: 'openai',
                generateText: openaiSpy
            };
            const anthropicSpy = vi.fn().mockResolvedValue({ text: 'ok', usage: {} });
            const anthropicProvider: AiProvider = {
                ...new StubProvider(),
                id: 'anthropic',
                generateText: anthropicSpy
            };
            const providers = new Map<string, AiProvider>([
                ['openai', openaiProvider],
                ['anthropic', anthropicProvider]
            ]);
            const engine = makeEngine(providers);

            // Act + Assert
            await expect(
                engine.generateText({
                    feature: 'text_improve',
                    locale: 'es',
                    prompt: 'Hello'
                })
            ).rejects.toThrow(AiNoEnabledProviderError);

            // No provider should have been called.
            expect(openaiSpy).not.toHaveBeenCalled();
            expect(anthropicSpy).not.toHaveBeenCalled();
        });

        it('should set the correct feature on AiNoEnabledProviderError', async () => {
            // Arrange
            mockResolveConfig.mockResolvedValue(
                makeSettingsValue({
                    openai: { enabled: false },
                    anthropic: { enabled: false }
                })
            );
            const providers = new Map<string, AiProvider>([
                ['openai', new StubProvider()],
                ['anthropic', new StubProvider()]
            ]);
            const engine = makeEngine(providers);

            // Act
            let caughtErr: unknown;
            try {
                await engine.generateText({ feature: 'chat', locale: 'es', prompt: 'test' });
            } catch (err) {
                caughtErr = err;
            }

            // Assert
            expect(caughtErr).toBeInstanceOf(AiNoEnabledProviderError);
            expect((caughtErr as AiNoEnabledProviderError).feature).toBe('chat');
            expect((caughtErr as AiNoEnabledProviderError).engineCode).toBe('NO_ENABLED_PROVIDER');
        });
    });

    // -------------------------------------------------------------------------
    // 10. Provider with NO entry in map → NOT skipped (preserves existing behaviour)
    // -------------------------------------------------------------------------

    describe('when a provider has no entry in the providers config map', () => {
        it('should NOT skip the provider (preserved existing behaviour)', async () => {
            // Arrange — providers map is empty; both openai and anthropic have no entry.
            // Neither should be filtered out.
            mockResolveConfig.mockResolvedValue(makeSettingsValue({}));

            const stub = new StubProvider();
            const providers = new Map<string, AiProvider>([['openai', stub]]);
            const engine = makeEngine(providers);

            // Act — should succeed via openai (no entry = not skipped)
            const result = await engine.generateText({
                feature: 'text_improve',
                locale: 'es',
                prompt: 'test'
            });

            // Assert
            expect(result.text).toBeDefined();
        });
    });
});

// ---------------------------------------------------------------------------
// Part C: Engine ceiling hook wiring tests
// ---------------------------------------------------------------------------

describe('engine — ceiling hook wiring', () => {
    // -------------------------------------------------------------------------
    // 11. checkCeiling throws → engine call rejects with AiCeilingHitError
    // -------------------------------------------------------------------------

    describe('when the ceiling hook throws AiCeilingHitError', () => {
        it('should reject the engine call with that error (not swallowed)', async () => {
            // Arrange
            const ceilingErr = new AiCeilingHitError({
                scope: 'global',
                spentMicroUsd: 200_000_000,
                ceilingMicroUsd: 200_000_000
            });
            const checkCeiling = vi.fn().mockRejectedValue(ceilingErr);
            const getNow = () => NOW;

            const stub = new StubProvider();
            const providers = new Map<string, AiProvider>([['openai', stub]]);
            const engine = makeEngine(providers, { checkCeiling, getNow });

            // Act + Assert
            await expect(
                engine.generateText({
                    feature: 'text_improve',
                    locale: 'es',
                    prompt: 'Hello'
                })
            ).rejects.toThrow(AiCeilingHitError);

            expect(checkCeiling).toHaveBeenCalledOnce();
            expect(checkCeiling).toHaveBeenCalledWith({
                feature: 'text_improve',
                now: NOW
            });
        });

        it('should propagate the exact AiCeilingHitError instance', async () => {
            // Arrange
            const ceilingErr = new AiCeilingHitError({
                scope: 'feature',
                feature: 'chat',
                spentMicroUsd: 50_000_000,
                ceilingMicroUsd: 50_000_000
            });
            const checkCeiling = vi.fn().mockRejectedValue(ceilingErr);

            const stub = new StubProvider();
            const providers = new Map<string, AiProvider>([['openai', stub]]);
            const engine = makeEngine(providers, { checkCeiling, getNow: () => NOW });

            // Act
            let caughtErr: unknown;
            try {
                await engine.generateText({ feature: 'chat', locale: 'es', prompt: 'hi' });
            } catch (err) {
                caughtErr = err;
            }

            // Assert — the exact instance is propagated, not wrapped
            expect(caughtErr).toBe(ceilingErr);
            expect((caughtErr as AiCeilingHitError).scope).toBe('feature');
            expect((caughtErr as AiCeilingHitError).feature).toBe('chat');
        });
    });

    // -------------------------------------------------------------------------
    // 12. No checkCeiling hook → calls proceed normally
    // -------------------------------------------------------------------------

    describe('when checkCeiling is absent', () => {
        it('should succeed without a ceiling check (backwards-compatible, AC-9-adjacent)', async () => {
            // Arrange — no ceiling hook provided
            const stub = new StubProvider();
            const providers = new Map<string, AiProvider>([['openai', stub]]);
            const engine = createAiEngine({
                getProvider: (id) => {
                    const p = providers.get(id);
                    if (!p) throw new Error(`No provider registered for id: ${id}`);
                    return p;
                }
                // checkCeiling and getNow intentionally omitted
            });

            // Act + Assert — must not throw, returns a result
            await expect(
                engine.generateText({
                    feature: 'text_improve',
                    locale: 'es',
                    prompt: 'test'
                })
            ).resolves.toBeDefined();
        });
    });

    // -------------------------------------------------------------------------
    // 13. checkCeiling set but getNow absent → hook skipped, call proceeds
    // -------------------------------------------------------------------------

    describe('when checkCeiling is provided but getNow is absent', () => {
        it('should skip the ceiling check and succeed (getNow required to invoke hook)', async () => {
            // Arrange — checkCeiling present, getNow absent
            const checkCeiling = vi.fn().mockResolvedValue(undefined);
            const stub = new StubProvider();
            const providers = new Map<string, AiProvider>([['openai', stub]]);
            const engine = createAiEngine({
                getProvider: (id) => {
                    const p = providers.get(id);
                    if (!p) throw new Error(`No provider registered for id: ${id}`);
                    return p;
                },
                checkCeiling
                // getNow intentionally omitted
            });

            // Act + Assert
            const result = await engine.generateText({
                feature: 'text_improve',
                locale: 'es',
                prompt: 'test'
            });

            expect(result).toBeDefined();
            // Hook was NOT called because getNow was absent.
            expect(checkCeiling).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // Extra: feature kill-switch still works alongside ceiling hook
    // -------------------------------------------------------------------------

    describe('when the feature is kill-switched and ceiling hook is present', () => {
        it('should throw AiFeatureDisabledError before calling the ceiling hook', async () => {
            // Arrange — feature disabled
            mockResolveFeatureConfig.mockResolvedValue({
                enabled: false,
                primaryProvider: 'openai',
                fallbackChain: [],
                model: 'gpt-4o-mini',
                params: {}
            });
            mockIsFeatureKillSwitched.mockReturnValue(true);

            const checkCeiling = vi.fn().mockResolvedValue(undefined);
            const stub = new StubProvider();
            const providers = new Map<string, AiProvider>([['openai', stub]]);
            const engine = makeEngine(providers, { checkCeiling, getNow: () => NOW });

            // Act + Assert
            await expect(
                engine.generateText({ feature: 'chat', locale: 'es', prompt: 'hi' })
            ).rejects.toThrow(AiFeatureDisabledError);

            // Ceiling hook was NOT called — feature kill-switch fires first.
            expect(checkCeiling).not.toHaveBeenCalled();
        });
    });
});
