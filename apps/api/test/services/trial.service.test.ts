/**
 * Trial Service Tests
 *
 * Tests for trial lifecycle management including:
 * - Trial creation
 * - Status checking
 * - Expiry detection
 * - Batch blocking
 * - Reactivation
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (hoisted — must appear before any imports that depend on them)
// ---------------------------------------------------------------------------

// withServiceTransaction mock: acquires the advisory lock and executes the callback.
// The trial service uses withServiceTransaction to acquire pg_try_advisory_xact_lock.
const {
    mockWithServiceTransaction,
    mockDbForTrial,
    mockTx,
    mockTxSelectChain,
    mockTxUpdateChain,
    mockTxInsertChain
} = vi.hoisted(() => {
    // The reconciler (HOS-171) claims its batch with a Drizzle SELECT inside the
    // lock-holding tx, then writes status + dedup event through a second
    // withServiceTransaction. Both use this same tx object.
    const txSelectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([])
    };
    const txUpdateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined)
    };
    const txInsertChain = {
        values: vi.fn().mockResolvedValue(undefined)
    };
    const tx = {
        execute: vi.fn().mockResolvedValue({
            rows: [{ pg_try_advisory_xact_lock: true }]
        }),
        select: vi.fn(() => txSelectChain),
        update: vi.fn(() => txUpdateChain),
        insert: vi.fn(() => txInsertChain)
    };
    const withSvcTx = vi.fn(async <T>(callback: (ctx: { tx: typeof tx }) => Promise<T>) =>
        callback({ tx })
    );
    const dbMock = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis()
    };
    return {
        mockWithServiceTransaction: withSvcTx,
        mockDbForTrial: dbMock,
        mockTx: tx,
        mockTxSelectChain: txSelectChain,
        mockTxUpdateChain: txUpdateChain,
        mockTxInsertChain: txInsertChain
    };
});

// Mock @repo/service-core to intercept withServiceTransaction
vi.mock('@repo/service-core', async () => {
    const actual = await vi.importActual('@repo/service-core');
    return { ...actual, withServiceTransaction: mockWithServiceTransaction };
});

// Mock @repo/db for getDb() used in blockExpiredTrials select/insert calls
vi.mock('@repo/db', async () => {
    const actual = await vi.importActual('@repo/db');
    return {
        ...actual,
        getDb: vi.fn(() => mockDbForTrial),
        billingSubscriptionEvents: {
            id: 'id',
            subscriptionId: 'subscriptionId',
            eventType: 'eventType'
        }
    };
});

// Mock drizzle-orm helpers used inside the service (and, eq, isNotNull, isNull, lt, sql)
vi.mock('drizzle-orm', async () => {
    const actual = await vi.importActual('drizzle-orm');
    return {
        ...actual,
        and: (...args: unknown[]) => ({ type: 'and', args }),
        eq: (a: unknown, b: unknown) => ({ type: 'eq', a, b }),
        isNotNull: (a: unknown) => ({ type: 'isNotNull', a }),
        isNull: (a: unknown) => ({ type: 'isNull', a }),
        lt: (a: unknown, b: unknown) => ({ type: 'lt', a, b }),
        sql: Object.assign(
            (strings: TemplateStringsArray, ..._values: unknown[]) => ({ type: 'sql', strings }),
            { raw: (s: string) => ({ type: 'sql_raw', value: s }) }
        )
    };
});

// Mock Sentry (used in blockExpiredTrials for error capture)
vi.mock('@sentry/node', () => ({
    captureException: vi.fn()
}));

// Mock clearEntitlementCache (called after blocking)
vi.mock('../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: vi.fn()
}));

// Mock apiLogger
vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

import * as Sentry from '@sentry/node';
import { clearEntitlementCache } from '../../src/middlewares/entitlement';
import { buildTrialUpgradeUrl, TrialService } from '../../src/services/trial.service';
import { env } from '../../src/utils/env';

/**
 * Stub MercadoPago adapter. The reconciler only exercises
 * `subscriptions.retrieve()` — the provider's verdict on an elapsed trial.
 */
const mockPaymentAdapter = {
    subscriptions: {
        retrieve: vi.fn()
    }
};

// Mock QZPay billing
const createMockBilling = () => {
    return {
        plans: {
            list: vi.fn(),
            get: vi.fn()
        },
        subscriptions: {
            create: vi.fn(),
            getByCustomerId: vi.fn(),
            list: vi.fn(),
            update: vi.fn(),
            cancel: vi.fn(),
            get: vi.fn()
        },
        customers: {
            get: vi.fn()
        }
    } as unknown as QZPayBilling;
};

describe('TrialService', () => {
    let trialService: TrialService;
    let mockBilling: QZPayBilling;

    beforeEach(() => {
        mockBilling = createMockBilling();
        trialService = new TrialService(mockBilling);
    });

    describe('startTrial', () => {
        it('should start trial for owner user', async () => {
            // Arrange
            const customerId = 'customer-123';
            const mockPlan = {
                id: 'plan-owner-basico',
                name: 'owner-basico', // QZPay uses name as identifier
                monthlyPriceArs: 1500000,
                // HOS-110: trial config now lives on the plan's metadata JSONB.
                metadata: { hasTrial: true, trialDays: 14 }
            };
            const mockSubscription = {
                id: 'sub-123',
                customerId,
                planId: mockPlan.id,
                status: 'trialing'
            };

            vi.spyOn(mockBilling.plans, 'list').mockResolvedValue({
                data: [mockPlan]
            } as never);
            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([] as never);
            vi.spyOn(mockBilling.subscriptions, 'create').mockResolvedValue(
                mockSubscription as never
            );

            // Act
            const result = await trialService.startTrial({
                customerId
            });

            // Assert
            expect(result).toBe('sub-123');
            expect(mockBilling.subscriptions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    customerId,
                    planId: mockPlan.id,
                    trialDays: 14,
                    metadata: expect.objectContaining({
                        autoStarted: 'true',
                        createdBy: 'trial-service'
                    })
                })
            );
        });

        // HOS-110 W1: a trial_extension promo code's extra days must add on top
        // of the plan's own base trial length, not replace it.
        describe('extraTrialDays (HOS-110 W1)', () => {
            const arrangePlan = () => {
                vi.spyOn(mockBilling.plans, 'list').mockResolvedValue({
                    data: [
                        {
                            id: 'plan-owner-basico',
                            name: 'owner-basico',
                            metadata: { hasTrial: true, trialDays: 14 }
                        }
                    ]
                } as never);
                vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue(
                    [] as never
                );
                vi.spyOn(mockBilling.subscriptions, 'create').mockResolvedValue({
                    id: 'sub-extended'
                } as never);
            };

            it('adds extraTrialDays on top of the plan base length', async () => {
                // Arrange
                arrangePlan();

                // Act — base 14 + extension 7 = 21
                await trialService.startTrial({
                    customerId: 'customer-extended',
                    extraTrialDays: 7
                });

                // Assert
                expect(mockBilling.subscriptions.create).toHaveBeenCalledWith(
                    expect.objectContaining({ trialDays: 21 })
                );
            });

            it('leaves the base trial length unchanged when extraTrialDays is omitted', async () => {
                // Arrange
                arrangePlan();

                // Act
                await trialService.startTrial({ customerId: 'customer-no-extension' });

                // Assert
                expect(mockBilling.subscriptions.create).toHaveBeenCalledWith(
                    expect.objectContaining({ trialDays: 14 })
                );
            });

            it('stamps extraTrialDaysFromPromo in the MP creation metadata when extended', async () => {
                // Arrange
                arrangePlan();

                // Act
                await trialService.startTrial({
                    customerId: 'customer-extended-meta',
                    extraTrialDays: 7
                });

                // Assert
                const createArg = (mockBilling.subscriptions.create as unknown as Mock).mock
                    .calls[0]?.[0] as { metadata: Record<string, string> };
                expect(createArg.metadata.extraTrialDaysFromPromo).toBe('7');
            });

            it('combines with HOSPEDA_TRIAL_DAYS_OVERRIDE (override is the base, extension adds on top)', async () => {
                // Arrange
                const originalOverride = env.HOSPEDA_TRIAL_DAYS_OVERRIDE;
                env.HOSPEDA_TRIAL_DAYS_OVERRIDE = 1;
                arrangePlan();

                try {
                    // Act — override base 1 + extension 7 = 8
                    await trialService.startTrial({
                        customerId: 'customer-override-plus-extension',
                        extraTrialDays: 7
                    });

                    // Assert
                    expect(mockBilling.subscriptions.create).toHaveBeenCalledWith(
                        expect.objectContaining({ trialDays: 8 })
                    );
                } finally {
                    env.HOSPEDA_TRIAL_DAYS_OVERRIDE = originalOverride;
                }
            });
        });

        // HOS-115 §5: `intendedInterval` is stamped as-is into the MP creation
        // metadata so the post-trial conversion nudge can pre-select the same
        // toggle the customer started from.
        describe('intendedInterval (HOS-115)', () => {
            const arrangePlan = () => {
                vi.spyOn(mockBilling.plans, 'list').mockResolvedValue({
                    data: [
                        {
                            id: 'plan-owner-basico',
                            name: 'owner-basico',
                            metadata: { hasTrial: true, trialDays: 14 }
                        }
                    ]
                } as never);
                vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue(
                    [] as never
                );
                vi.spyOn(mockBilling.subscriptions, 'create').mockResolvedValue({
                    id: 'sub-intended-interval'
                } as never);
            };

            it('stamps intendedInterval="annual" in the MP creation metadata when supplied', async () => {
                arrangePlan();

                await trialService.startTrial({
                    customerId: 'customer-annual-intent',
                    intendedInterval: 'annual'
                });

                const createArg = (mockBilling.subscriptions.create as unknown as Mock).mock
                    .calls[0]?.[0] as { metadata: Record<string, string> };
                expect(createArg.metadata.intendedInterval).toBe('annual');
            });

            it('stamps intendedInterval="monthly" in the MP creation metadata when supplied', async () => {
                arrangePlan();

                await trialService.startTrial({
                    customerId: 'customer-monthly-intent',
                    intendedInterval: 'monthly'
                });

                const createArg = (mockBilling.subscriptions.create as unknown as Mock).mock
                    .calls[0]?.[0] as { metadata: Record<string, string> };
                expect(createArg.metadata.intendedInterval).toBe('monthly');
            });

            it('omits intendedInterval from metadata when not supplied (e.g. accommodation-publish auto-start)', async () => {
                arrangePlan();

                await trialService.startTrial({ customerId: 'customer-no-intent' });

                const createArg = (mockBilling.subscriptions.create as unknown as Mock).mock
                    .calls[0]?.[0] as { metadata: Record<string, string> };
                expect(createArg.metadata.intendedInterval).toBeUndefined();
            });
        });

        // HOSPEDA_TRIAL_DAYS_OVERRIDE (testing-only): when set to a positive integer
        // it replaces OWNER_TRIAL_DAYS (14) so QA can exercise trial expiry after
        // e.g. 1 day. It is intentionally NOT gated by environment (NODE_ENV is
        // 'production' on both the prod and staging deployments, and testing must be
        // possible against production), so these tests assert the override applies
        // whenever set and falls back to the constant when unset.
        describe('HOSPEDA_TRIAL_DAYS_OVERRIDE', () => {
            // `env` is a live binding populated at runtime by validateApiEnv(), so
            // snapshot it inside beforeEach (not in the describe body, where it is
            // still undefined during collection).
            let originalOverride: typeof env.HOSPEDA_TRIAL_DAYS_OVERRIDE;

            beforeEach(() => {
                originalOverride = env.HOSPEDA_TRIAL_DAYS_OVERRIDE;
            });

            afterEach(() => {
                env.HOSPEDA_TRIAL_DAYS_OVERRIDE = originalOverride;
            });

            const arrangeHappyPath = () => {
                const mockPlan = {
                    id: 'plan-owner-basico',
                    name: 'owner-basico',
                    metadata: { hasTrial: true, trialDays: 14 }
                };
                vi.spyOn(mockBilling.plans, 'list').mockResolvedValue({
                    data: [mockPlan]
                } as never);
                vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue(
                    [] as never
                );
                vi.spyOn(mockBilling.subscriptions, 'create').mockResolvedValue({
                    id: 'sub-override'
                } as never);
            };

            it('uses the override trial length when set to a positive integer', async () => {
                // Arrange
                env.HOSPEDA_TRIAL_DAYS_OVERRIDE = 1;
                arrangeHappyPath();

                // Act
                await trialService.startTrial({ customerId: 'customer-override-set' });

                // Assert — the shortened trial length flows into subscriptions.create
                expect(mockBilling.subscriptions.create).toHaveBeenCalledWith(
                    expect.objectContaining({ trialDays: 1 })
                );
            });

            it('falls back to OWNER_TRIAL_DAYS (14) when the override is unset', async () => {
                // Arrange
                env.HOSPEDA_TRIAL_DAYS_OVERRIDE = undefined;
                arrangeHappyPath();

                // Act
                await trialService.startTrial({ customerId: 'customer-override-unset' });

                // Assert
                expect(mockBilling.subscriptions.create).toHaveBeenCalledWith(
                    expect.objectContaining({ trialDays: 14 })
                );
            });
        });

        // SPEC-222 Part 2 (AC-3): the MercadoPago creation payload is enriched AT
        // creation time with an environment marker and the referential
        // (triggered-by) accommodationId. No extra MP call — it rides the existing
        // subscriptions.create. PII (names/emails) must NOT be present.
        it('enriches the MP creation metadata with env marker + triggering accommodationId', async () => {
            // Arrange
            const customerId = 'customer-222';
            const mockPlan = {
                id: 'plan-owner-basico',
                name: 'owner-basico',
                metadata: { hasTrial: true, trialDays: 14 }
            };
            vi.spyOn(mockBilling.plans, 'list').mockResolvedValue({
                data: [mockPlan]
            } as never);
            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([] as never);
            vi.spyOn(mockBilling.subscriptions, 'create').mockResolvedValue({
                id: 'sub-222'
            } as never);

            // Act
            await trialService.startTrial({ customerId, accommodationId: 'acc-222' });

            // Assert
            const createArg = (mockBilling.subscriptions.create as unknown as Mock).mock
                .calls[0]?.[0] as { metadata: Record<string, string> };
            expect(createArg.metadata).toMatchObject({
                autoStarted: 'true',
                createdBy: 'trial-service',
                triggeredByAccommodationId: 'acc-222'
            });
            // Env marker present (NODE_ENV defaults to 'test' under vitest).
            expect(typeof createArg.metadata.environment).toBe('string');
            expect((createArg.metadata.environment ?? '').length).toBeGreaterThan(0);
            // PII guard: no name / email fields leak into the MP payload.
            const metaKeys = Object.keys(createArg.metadata).map((k) => k.toLowerCase());
            expect(metaKeys.some((k) => k.includes('email') || k.includes('name'))).toBe(false);
        });

        it('omits the accommodation marker when no triggering accommodation is provided', async () => {
            // Arrange
            const customerId = 'customer-223';
            const mockPlan = {
                id: 'plan-owner-basico',
                name: 'owner-basico',
                metadata: { hasTrial: true, trialDays: 14 }
            };
            vi.spyOn(mockBilling.plans, 'list').mockResolvedValue({
                data: [mockPlan]
            } as never);
            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([] as never);
            vi.spyOn(mockBilling.subscriptions, 'create').mockResolvedValue({
                id: 'sub-223'
            } as never);

            // Act — auto-start path (e.g. registration), no accommodationId
            await trialService.startTrial({ customerId });

            // Assert
            const createArg = (mockBilling.subscriptions.create as unknown as Mock).mock
                .calls[0]?.[0] as { metadata: Record<string, string> };
            expect(createArg.metadata).not.toHaveProperty('triggeredByAccommodationId');
            expect(typeof createArg.metadata.environment).toBe('string');
        });

        it('should not start trial if user already has subscription', async () => {
            // Arrange
            const customerId = 'customer-789';
            const existingSubscription = {
                id: 'sub-existing',
                customerId,
                status: 'active'
            };

            // Plan DOES declare a trial — this test must exercise the idempotency
            // guard specifically (one trial per customer, for life), not the
            // unrelated hasTrial guard which also returns null.
            vi.spyOn(mockBilling.plans, 'list').mockResolvedValue({
                data: [
                    {
                        id: 'plan-1',
                        name: 'owner-basico',
                        metadata: { hasTrial: true, trialDays: 14 }
                    }
                ]
            } as never);
            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([
                existingSubscription
            ] as never);

            // Act
            const result = await trialService.startTrial({
                customerId
            });

            // Assert
            expect(result).toBeNull();
            expect(mockBilling.subscriptions.create).not.toHaveBeenCalled();
        });

        it('should return null if billing is not enabled', async () => {
            // Arrange
            const trialServiceNoBilling = new TrialService(null);

            // Act
            const result = await trialServiceNoBilling.startTrial({
                customerId: 'customer-123'
            });

            // Assert
            expect(result).toBeNull();
        });

        // HOS-110: startTrial() generalization — trialDays is read from the
        // RESOLVED plan's own metadata (not a hardcoded constant), a `planSlug`
        // can be passed to start a trial on any plan that declares one, and the
        // entitlement cache is cleared after a successful create.
        describe('plan-driven trial config (HOS-110 generalization)', () => {
            it('defaults to DEFAULT_TRIAL_PLAN_SLUG (owner-basico) when planSlug is omitted', async () => {
                // Arrange
                const customerId = 'customer-default-slug';
                const mockPlan = {
                    id: 'plan-owner-basico',
                    name: 'owner-basico',
                    metadata: { hasTrial: true, trialDays: 14 }
                };
                const plansListSpy = vi
                    .spyOn(mockBilling.plans, 'list')
                    .mockResolvedValue({ data: [mockPlan] } as never);
                vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue(
                    [] as never
                );
                vi.spyOn(mockBilling.subscriptions, 'create').mockResolvedValue({
                    id: 'sub-default-slug'
                } as never);

                // Act — no planSlug passed
                const result = await trialService.startTrial({ customerId });

                // Assert — resolved against 'owner-basico' (the default) and succeeded
                expect(plansListSpy).toHaveBeenCalled();
                expect(result).toBe('sub-default-slug');
                expect(mockBilling.subscriptions.create).toHaveBeenCalledWith(
                    expect.objectContaining({ planId: mockPlan.id, trialDays: 14 })
                );
            });

            it('uses a custom planSlug and reads trialDays from THAT plan (not owner-basico)', async () => {
                // Arrange — mirrors owner-test-daily: hasTrial:true, trialDays:1 (HOS-110 decision #2)
                const customerId = 'customer-custom-slug';
                const testDailyPlan = {
                    id: 'plan-owner-test-daily',
                    name: 'owner-test-daily',
                    metadata: { hasTrial: true, trialDays: 1 }
                };
                vi.spyOn(mockBilling.plans, 'list').mockResolvedValue({
                    data: [testDailyPlan]
                } as never);
                vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue(
                    [] as never
                );
                vi.spyOn(mockBilling.subscriptions, 'create').mockResolvedValue({
                    id: 'sub-custom-slug'
                } as never);

                // Act
                const result = await trialService.startTrial({
                    customerId,
                    planSlug: 'owner-test-daily'
                });

                // Assert — 1-day trial (from the plan), not the owner-basico 14-day default
                expect(result).toBe('sub-custom-slug');
                expect(mockBilling.subscriptions.create).toHaveBeenCalledWith(
                    expect.objectContaining({ planId: testDailyPlan.id, trialDays: 1 })
                );
            });

            it('returns null and does not create a subscription when the resolved plan has hasTrial:false', async () => {
                // Arrange — a plan that declares no trial at all.
                const customerId = 'customer-no-trial-plan';
                const noTrialPlan = {
                    id: 'plan-no-trial',
                    name: 'tourist-free',
                    metadata: { hasTrial: false, trialDays: 0 }
                };
                vi.spyOn(mockBilling.plans, 'list').mockResolvedValue({
                    data: [noTrialPlan]
                } as never);
                const getByCustomerIdSpy = vi.spyOn(mockBilling.subscriptions, 'getByCustomerId');

                // Act
                const result = await trialService.startTrial({
                    customerId,
                    planSlug: 'tourist-free'
                });

                // Assert — no-op: no create call, and the guard short-circuits
                // before even checking for an existing subscription.
                expect(result).toBeNull();
                expect(mockBilling.subscriptions.create).not.toHaveBeenCalled();
                expect(getByCustomerIdSpy).not.toHaveBeenCalled();
            });

            it('returns null and does not create a subscription when trialDays is 0 even if hasTrial is true', async () => {
                // Arrange — malformed/inconsistent plan config: hasTrial true but
                // a non-positive trialDays. Starting a 0-day "trial" would be a bug.
                const customerId = 'customer-zero-days';
                const zeroDaysPlan = {
                    id: 'plan-zero-days',
                    name: 'owner-basico',
                    metadata: { hasTrial: true, trialDays: 0 }
                };
                vi.spyOn(mockBilling.plans, 'list').mockResolvedValue({
                    data: [zeroDaysPlan]
                } as never);

                // Act
                const result = await trialService.startTrial({ customerId });

                // Assert
                expect(result).toBeNull();
                expect(mockBilling.subscriptions.create).not.toHaveBeenCalled();
            });

            it('clears the entitlement cache after successfully creating a trial subscription', async () => {
                // Arrange
                const customerId = 'customer-cache-clear';
                const mockPlan = {
                    id: 'plan-owner-basico',
                    name: 'owner-basico',
                    metadata: { hasTrial: true, trialDays: 14 }
                };
                vi.spyOn(mockBilling.plans, 'list').mockResolvedValue({
                    data: [mockPlan]
                } as never);
                vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue(
                    [] as never
                );
                vi.spyOn(mockBilling.subscriptions, 'create').mockResolvedValue({
                    id: 'sub-cache-clear'
                } as never);

                // Act
                const result = await trialService.startTrial({ customerId });

                // Assert
                expect(result).toBe('sub-cache-clear');
                expect(clearEntitlementCache).toHaveBeenCalledWith(customerId);
            });

            it('does NOT clear the entitlement cache when the plan has no trial (no-op path)', async () => {
                // Arrange — clear prior call history first: `clearEntitlementCache` is a
                // single module-level mock shared across every test in this file (no
                // global mock-reset is configured), so earlier successful-trial tests
                // above would otherwise leave a stale recorded call.
                vi.mocked(clearEntitlementCache).mockClear();
                const customerId = 'customer-no-cache-clear';
                const noTrialPlan = {
                    id: 'plan-no-trial',
                    name: 'tourist-free',
                    metadata: { hasTrial: false, trialDays: 0 }
                };
                vi.spyOn(mockBilling.plans, 'list').mockResolvedValue({
                    data: [noTrialPlan]
                } as never);

                // Act
                await trialService.startTrial({ customerId, planSlug: 'tourist-free' });

                // Assert
                expect(clearEntitlementCache).not.toHaveBeenCalled();
            });
        });
    });

    describe('getTrialStatus', () => {
        it('should return trial status for active trial', async () => {
            // Arrange
            const customerId = 'customer-123';
            const now = new Date();
            const trialEnd = new Date(now);
            trialEnd.setDate(trialEnd.getDate() + 7); // 7 days remaining

            const mockSubscription = {
                id: 'sub-123',
                customerId,
                planId: 'plan-owner-basico',
                status: 'trialing',
                trialStart: now.toISOString(),
                trialEnd: trialEnd.toISOString()
            };

            const mockPlan = {
                id: 'plan-owner-basico',
                name: 'owner-basico'
            };

            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([
                mockSubscription
            ] as never);
            vi.spyOn(mockBilling.plans, 'get').mockResolvedValue(mockPlan as never);

            // Act
            const result = await trialService.getTrialStatus({ customerId });

            // Assert
            expect(result.isOnTrial).toBe(true);
            expect(result.isExpired).toBe(false);
            expect(result.daysRemaining).toBeGreaterThan(6);
            expect(result.daysRemaining).toBeLessThanOrEqual(7);
            expect(result.planSlug).toBe('owner-basico');
        });

        it('should return expired status for expired trial', async () => {
            // Arrange
            const customerId = 'customer-456';
            const now = new Date();
            const trialEnd = new Date(now);
            trialEnd.setDate(trialEnd.getDate() - 5); // Expired 5 days ago

            const mockSubscription = {
                id: 'sub-456',
                customerId,
                planId: 'plan-owner-basico',
                status: 'trialing',
                trialStart: new Date(now.setDate(now.getDate() - 19)).toISOString(), // Started 19 days ago
                trialEnd: trialEnd.toISOString()
            };

            const mockPlan = {
                id: 'plan-owner-basico',
                name: 'owner-basico'
            };

            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([
                mockSubscription
            ] as never);
            vi.spyOn(mockBilling.plans, 'get').mockResolvedValue(mockPlan as never);

            // Act
            const result = await trialService.getTrialStatus({ customerId });

            // Assert
            expect(result.isOnTrial).toBe(true);
            expect(result.isExpired).toBe(true);
            expect(result.daysRemaining).toBe(0);
            expect(result.planSlug).toBe('owner-basico');
        });

        it('should NOT report expired for a converted card-first subscription (AC-5, HOS-171)', async () => {
            // Arrange — the card-first shape: ONE row that carries trialEnd (qzpay
            // writes it on mode:'paid' regardless of status) AND has since become
            // `active` because MercadoPago charged at day N. Computing isExpired
            // from trialEnd alone would mark this paid-up customer as expired and
            // middlewares/trial.ts would throw HTTP 402 on every write.
            const customerId = 'customer-converted';
            const now = new Date();
            const trialStart = new Date(now);
            trialStart.setDate(trialStart.getDate() - 19);
            const trialEnd = new Date(now);
            trialEnd.setDate(trialEnd.getDate() - 5); // trial elapsed 5 days ago

            const mockSubscription = {
                id: 'sub-converted',
                customerId,
                planId: 'plan-owner-basico',
                status: 'active', // MP charged; the customer is paying
                trialStart: trialStart.toISOString(),
                trialEnd: trialEnd.toISOString()
            };

            const mockPlan = {
                id: 'plan-owner-basico',
                name: 'owner-basico'
            };

            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([
                mockSubscription
            ] as never);
            vi.spyOn(mockBilling.plans, 'get').mockResolvedValue(mockPlan as never);

            // Act
            const result = await trialService.getTrialStatus({ customerId });

            // Assert — not on trial, and crucially NOT locked out
            expect(result.isOnTrial).toBe(false);
            expect(result.isExpired).toBe(false);
            expect(result.daysRemaining).toBe(0);
        });

        it('should return not on trial if no subscription', async () => {
            // Arrange
            const customerId = 'customer-789';

            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([] as never);

            // Act
            const result = await trialService.getTrialStatus({ customerId });

            // Assert
            expect(result.isOnTrial).toBe(false);
            expect(result.isExpired).toBe(false);
            expect(result.daysRemaining).toBe(0);
            expect(result.planSlug).toBeNull();
        });

        it('should return safe default if billing disabled', async () => {
            // Arrange
            const trialServiceNoBilling = new TrialService(null);

            // Act
            const result = await trialServiceNoBilling.getTrialStatus({
                customerId: 'customer-123'
            });

            // Assert
            expect(result.isOnTrial).toBe(false);
            expect(result.isExpired).toBe(false);
            expect(result.daysRemaining).toBe(0);
            expect(result.planSlug).toBeNull();
        });

        it('should return safe defaults when no subscription exists (never had a trial)', async () => {
            // Arrange
            const customerId = 'customer-never-trial';

            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([] as never);

            // Act
            const result = await trialService.getTrialStatus({ customerId });

            // Assert — never-had-trial path
            expect(result.isOnTrial).toBe(false);
            expect(result.isExpired).toBe(false);
            expect(result.startedAt).toBeNull();
            expect(result.expiresAt).toBeNull();
            expect(result.daysRemaining).toBe(0);
            expect(result.planSlug).toBeNull();
        });

        it('should return isExpired:true with timestamps when trial was canceled without converting', async () => {
            // Arrange — canceled sub with trial_end set: trial expired without conversion.
            const customerId = 'customer-expired-canceled';
            const now = new Date();
            const trialStart = new Date(now);
            trialStart.setDate(trialStart.getDate() - 20); // started 20 days ago
            const trialEnd = new Date(now);
            trialEnd.setDate(trialEnd.getDate() - 6); // ended 6 days ago

            const canceledTrialSub = {
                id: 'sub-canceled-trial',
                customerId,
                planId: 'plan-owner-basico',
                status: 'canceled' as const,
                trialStart: trialStart.toISOString(),
                trialEnd: trialEnd.toISOString()
            };

            const mockPlan = { id: 'plan-owner-basico', name: 'owner-basico' };

            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([
                canceledTrialSub
            ] as never);
            vi.spyOn(mockBilling.plans, 'get').mockResolvedValue(mockPlan as never);

            // Act
            const result = await trialService.getTrialStatus({ customerId });

            // Assert — expired-canceled path
            expect(result.isOnTrial).toBe(false);
            expect(result.isExpired).toBe(true);
            expect(result.daysRemaining).toBe(0);
            expect(result.startedAt).toBe(trialStart.toISOString());
            expect(result.expiresAt).toBe(trialEnd.toISOString());
            expect(result.planSlug).toBe('owner-basico');
        });

        it('should NOT surface isExpired:true when trial converted to active paid plan', async () => {
            // Arrange — user converted trial to paid: canceled trialing sub + new active sub.
            // The new active sub has no trialEnd (it is a paid plan, not a trial).
            const customerId = 'customer-converted';
            const now = new Date();
            const trialStart = new Date(now);
            trialStart.setDate(trialStart.getDate() - 10);
            const trialEnd = new Date(now);
            trialEnd.setDate(trialEnd.getDate() - 2);

            const canceledTrialSub = {
                id: 'sub-old-trial',
                customerId,
                planId: 'plan-owner-basico',
                status: 'canceled',
                trialStart: trialStart.toISOString(),
                trialEnd: trialEnd.toISOString()
            };

            const activePayingSub = {
                id: 'sub-active-paid',
                customerId,
                planId: 'plan-owner-pro',
                status: 'active',
                trialStart: null,
                trialEnd: null
            };

            const mockPlan = { id: 'plan-owner-pro', name: 'owner-pro' };

            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([
                canceledTrialSub,
                activePayingSub
            ] as never);
            vi.spyOn(mockBilling.plans, 'get').mockResolvedValue(mockPlan as never);

            // Act — active paid sub should be found first; expired fallback must NOT trigger.
            const result = await trialService.getTrialStatus({ customerId });

            // Assert — current active plan is returned, not the old expired trial
            expect(result.isOnTrial).toBe(false);
            expect(result.isExpired).toBe(false);
            expect(result.planSlug).toBe('owner-pro');
        });

        describe('intendedInterval (HOS-115 §5 T-008 — nudge delivery path 2)', () => {
            it('returns the annual interval stamped on an active trial subscription', async () => {
                // Arrange
                const customerId = 'customer-interval-annual';
                const now = new Date();
                const trialEnd = new Date(now);
                trialEnd.setDate(trialEnd.getDate() + 7);

                const mockSubscription = {
                    id: 'sub-annual-trial',
                    customerId,
                    planId: 'plan-owner-basico',
                    status: 'trialing',
                    trialStart: now.toISOString(),
                    trialEnd: trialEnd.toISOString(),
                    metadata: { intendedInterval: 'annual' }
                };
                const mockPlan = { id: 'plan-owner-basico', name: 'owner-basico' };

                vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([
                    mockSubscription
                ] as never);
                vi.spyOn(mockBilling.plans, 'get').mockResolvedValue(mockPlan as never);

                // Act
                const result = await trialService.getTrialStatus({ customerId });

                // Assert
                expect(result.intendedInterval).toBe('annual');
            });

            it('returns the monthly interval stamped on an active trial subscription', async () => {
                // Arrange
                const customerId = 'customer-interval-monthly';
                const now = new Date();
                const trialEnd = new Date(now);
                trialEnd.setDate(trialEnd.getDate() + 7);

                const mockSubscription = {
                    id: 'sub-monthly-trial',
                    customerId,
                    planId: 'plan-owner-basico',
                    status: 'trialing',
                    trialStart: now.toISOString(),
                    trialEnd: trialEnd.toISOString(),
                    metadata: { intendedInterval: 'monthly' }
                };
                const mockPlan = { id: 'plan-owner-basico', name: 'owner-basico' };

                vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([
                    mockSubscription
                ] as never);
                vi.spyOn(mockBilling.plans, 'get').mockResolvedValue(mockPlan as never);

                // Act
                const result = await trialService.getTrialStatus({ customerId });

                // Assert
                expect(result.intendedInterval).toBe('monthly');
            });

            it('returns null when the active trial subscription has no metadata at all', async () => {
                // Arrange — e.g. a trial started via the accommodation-publish
                // auto-start flow, which never records an interval.
                const customerId = 'customer-interval-none';
                const now = new Date();
                const trialEnd = new Date(now);
                trialEnd.setDate(trialEnd.getDate() + 7);

                const mockSubscription = {
                    id: 'sub-no-interval-trial',
                    customerId,
                    planId: 'plan-owner-basico',
                    status: 'trialing',
                    trialStart: now.toISOString(),
                    trialEnd: trialEnd.toISOString()
                };
                const mockPlan = { id: 'plan-owner-basico', name: 'owner-basico' };

                vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([
                    mockSubscription
                ] as never);
                vi.spyOn(mockBilling.plans, 'get').mockResolvedValue(mockPlan as never);

                // Act
                const result = await trialService.getTrialStatus({ customerId });

                // Assert
                expect(result.intendedInterval).toBeNull();
            });

            it('returns null for malformed metadata (defensive against a garbage value)', async () => {
                // Arrange
                const customerId = 'customer-interval-garbage';
                const now = new Date();
                const trialEnd = new Date(now);
                trialEnd.setDate(trialEnd.getDate() + 7);

                const mockSubscription = {
                    id: 'sub-garbage-interval-trial',
                    customerId,
                    planId: 'plan-owner-basico',
                    status: 'trialing',
                    trialStart: now.toISOString(),
                    trialEnd: trialEnd.toISOString(),
                    metadata: { intendedInterval: 'weekly' }
                };
                const mockPlan = { id: 'plan-owner-basico', name: 'owner-basico' };

                vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([
                    mockSubscription
                ] as never);
                vi.spyOn(mockBilling.plans, 'get').mockResolvedValue(mockPlan as never);

                // Act
                const result = await trialService.getTrialStatus({ customerId });

                // Assert
                expect(result.intendedInterval).toBeNull();
            });

            it('returns the interval stamped on the most-recent historical (expired, canceled) trial', async () => {
                // Arrange — mirrors the "canceled without converting" fixture above,
                // but with metadata.intendedInterval set, exercising the direct-navigation
                // nudge for a user whose trial already expired.
                const customerId = 'customer-interval-historical';
                const now = new Date();
                const trialStart = new Date(now);
                trialStart.setDate(trialStart.getDate() - 20);
                const trialEnd = new Date(now);
                trialEnd.setDate(trialEnd.getDate() - 6);

                const canceledTrialSub = {
                    id: 'sub-canceled-trial-annual',
                    customerId,
                    planId: 'plan-owner-basico',
                    status: 'canceled' as const,
                    trialStart: trialStart.toISOString(),
                    trialEnd: trialEnd.toISOString(),
                    metadata: { intendedInterval: 'annual' }
                };
                const mockPlan = { id: 'plan-owner-basico', name: 'owner-basico' };

                vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([
                    canceledTrialSub
                ] as never);
                vi.spyOn(mockBilling.plans, 'get').mockResolvedValue(mockPlan as never);

                // Act
                const result = await trialService.getTrialStatus({ customerId });

                // Assert
                expect(result.isExpired).toBe(true);
                expect(result.intendedInterval).toBe('annual');
            });

            it('returns null when there is no subscription at all (never had a trial)', async () => {
                // Arrange
                const customerId = 'customer-interval-never';
                vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue(
                    [] as never
                );

                // Act
                const result = await trialService.getTrialStatus({ customerId });

                // Assert
                expect(result.intendedInterval).toBeNull();
            });

            it('returns null when billing is disabled', async () => {
                // Arrange
                const trialServiceNoBilling = new TrialService(null);

                // Act
                const result = await trialServiceNoBilling.getTrialStatus({
                    customerId: 'customer-interval-no-billing'
                });

                // Assert
                expect(result.intendedInterval).toBeNull();
            });
        });
    });

    describe('checkTrialExpiry', () => {
        it('should return true for expired trial', async () => {
            // Arrange
            const customerId = 'customer-123';
            const now = new Date();
            const trialEnd = new Date(now);
            trialEnd.setDate(trialEnd.getDate() - 1); // Expired yesterday

            const mockSubscription = {
                id: 'sub-123',
                customerId,
                planId: 'plan-owner-basico',
                status: 'trialing',
                trialEnd: trialEnd.toISOString()
            };

            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([
                mockSubscription
            ] as never);
            vi.spyOn(mockBilling.plans, 'get').mockResolvedValue({
                id: 'plan-owner-basico',
                name: 'owner-basico'
            } as never);

            // Act
            const result = await trialService.checkTrialExpiry({ customerId });

            // Assert
            expect(result).toBe(true);
        });

        it('should return false for active trial', async () => {
            // Arrange
            const customerId = 'customer-456';
            const now = new Date();
            const trialEnd = new Date(now);
            trialEnd.setDate(trialEnd.getDate() + 5); // 5 days remaining

            const mockSubscription = {
                id: 'sub-456',
                customerId,
                planId: 'plan-owner-basico',
                status: 'trialing',
                trialEnd: trialEnd.toISOString()
            };

            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([
                mockSubscription
            ] as never);
            vi.spyOn(mockBilling.plans, 'get').mockResolvedValue({
                id: 'plan-owner-basico',
                name: 'owner-basico'
            } as never);

            // Act
            const result = await trialService.checkTrialExpiry({ customerId });

            // Assert
            expect(result).toBe(false);
        });
    });

    describe('reconcileExpiredTrials (HOS-171)', () => {
        /**
         * Builds a claimed local `billing_subscriptions` row. The claim query
         * already filters to `trialing` + elapsed `trialEnd`, so every row the
         * process phase sees looks like this.
         */
        const makeClaimedRow = (overrides: Record<string, unknown> = {}) => {
            const trialEnd = new Date();
            trialEnd.setDate(trialEnd.getDate() - 2); // elapsed 2 days ago
            return {
                id: 'sub-elapsed-1',
                customerId: 'customer-1',
                planId: 'plan-1',
                status: 'trialing',
                mpSubscriptionId: 'preapproval-mp-001',
                trialStart: new Date(),
                trialEnd,
                metadata: {},
                ...overrides
            };
        };

        /** Arms the claim query to return the given rows. */
        const givenClaimedRows = (rows: unknown[]) => {
            mockTxSelectChain.limit.mockResolvedValue(rows);
        };

        /** Arms the provider's retrieve() to report the given status. */
        const givenProviderStatus = (status: string) => {
            mockPaymentAdapter.subscriptions.retrieve.mockResolvedValue({
                id: 'preapproval-mp-001',
                status
            });
        };

        /** The reconciler's required input. */
        const adapterInput = () =>
            ({ paymentAdapter: mockPaymentAdapter }) as unknown as {
                paymentAdapter: Parameters<
                    typeof trialService.reconcileExpiredTrials
                >[0]['paymentAdapter'];
            };

        beforeEach(() => {
            // The hoisted tx/db mocks are module-scoped and survive across tests,
            // so call history must be cleared explicitly — otherwise a
            // `not.toHaveBeenCalled()` assertion sees the previous test's writes.
            mockTxUpdateChain.set.mockClear();
            mockTxUpdateChain.where.mockClear();
            mockTxInsertChain.values.mockClear();
            mockTx.execute.mockClear();
            vi.mocked(clearEntitlementCache).mockClear();
            vi.mocked(Sentry.captureException).mockClear();

            // Default: lock acquired, no prior TRIAL_RECONCILED event, no rows.
            mockTx.execute.mockResolvedValue({ rows: [{ pg_try_advisory_xact_lock: true }] });
            mockDbForTrial.limit.mockResolvedValue([]);
            mockTxSelectChain.limit.mockResolvedValue([]);
            mockPaymentAdapter.subscriptions.retrieve.mockReset();
        });

        // ── AC-6 — THE regression guard ──────────────────────────────────────
        // If this test ever fails by asserting `cancel`, the job is destroying
        // money: it is terminating customers at the moment they start paying.
        it('converts an elapsed trial whose provider charge landed, and NEVER cancels it (AC-6)', async () => {
            // Arrange — MP authorized the preapproval and charged at day N
            givenClaimedRows([makeClaimedRow()]);
            givenProviderStatus('active');

            // Act
            const result = await trialService.reconcileExpiredTrials(adapterInput());

            // Assert — converted, not cancelled
            expect(result).toBe(1);
            expect(mockBilling.subscriptions.cancel).not.toHaveBeenCalled();
            expect(mockTxUpdateChain.set).toHaveBeenCalledWith(
                expect.objectContaining({ status: 'active', trialConverted: true })
            );
        });

        it('does not stamp a conversion as an expiry when a trial converts (AC-6)', async () => {
            // Arrange
            givenClaimedRows([makeClaimedRow()]);
            givenProviderStatus('active');

            // Act
            await trialService.reconcileExpiredTrials(adapterInput());

            // Assert — a converting customer is a win, not an expiry. The
            // TRIAL_EXPIRED email cannot be sent at all any more: TrialService no
            // longer takes a notification sender, so this is now structural.
            expect(mockTxInsertChain.values).not.toHaveBeenCalledWith(
                expect.objectContaining({ eventType: 'TRIAL_BLOCKED' })
            );
        });

        it('records a TRIAL_RECONCILED event carrying the outcome (AC-6)', async () => {
            // Arrange
            givenClaimedRows([makeClaimedRow()]);
            givenProviderStatus('active');

            // Act
            await trialService.reconcileExpiredTrials(adapterInput());

            // Assert
            expect(mockTxInsertChain.values).toHaveBeenCalledWith(
                expect.objectContaining({
                    eventType: 'TRIAL_RECONCILED',
                    previousStatus: 'trialing',
                    newStatus: 'active',
                    triggerSource: 'trial-reconcile-cron',
                    metadata: expect.objectContaining({ converted: true, providerStatus: 'active' })
                })
            );
        });

        // ── AC-7 — a failed first charge goes to dunning, not the graveyard ──
        it('routes a failed first charge to past_due for the dunning cron (AC-7)', async () => {
            // Arrange — MP could not charge the card at day N
            givenClaimedRows([makeClaimedRow()]);
            givenProviderStatus('past_due');

            // Act
            const result = await trialService.reconcileExpiredTrials(adapterInput());

            // Assert — past_due, never cancelled: dunning owns the retries
            expect(result).toBe(1);
            expect(mockBilling.subscriptions.cancel).not.toHaveBeenCalled();
            expect(mockTxUpdateChain.set).toHaveBeenCalledWith(
                expect.objectContaining({ status: 'past_due', trialConverted: false })
            );
        });

        // ── Mirroring the provider's other verdicts ──────────────────────────
        it('mirrors a provider cancellation locally', async () => {
            // Arrange
            givenClaimedRows([makeClaimedRow()]);
            givenProviderStatus('canceled');

            // Act
            const result = await trialService.reconcileExpiredTrials(adapterInput());

            // Assert
            expect(result).toBe(1);
            expect(mockTxUpdateChain.set).toHaveBeenCalledWith(
                expect.objectContaining({ status: 'cancelled', trialConverted: false })
            );
        });

        it('mirrors a provider pause locally', async () => {
            // Arrange
            givenClaimedRows([makeClaimedRow()]);
            givenProviderStatus('paused');

            // Act
            const result = await trialService.reconcileExpiredTrials(adapterInput());

            // Assert
            expect(result).toBe(1);
            expect(mockTxUpdateChain.set).toHaveBeenCalledWith(
                expect.objectContaining({ status: 'paused' })
            );
        });

        // ── Deferral and safety ─────────────────────────────────────────────
        it('defers to the next run when the provider is still pending', async () => {
            // Arrange — MP has not settled the charge yet
            givenClaimedRows([makeClaimedRow()]);
            givenProviderStatus('pending');

            // Act
            const result = await trialService.reconcileExpiredTrials(adapterInput());

            // Assert — no write at all; try again next tick
            expect(result).toBe(0);
            expect(mockTxUpdateChain.set).not.toHaveBeenCalled();
        });

        it('skips and alerts on an unknown provider status rather than guessing', async () => {
            // Arrange
            givenClaimedRows([makeClaimedRow()]);
            givenProviderStatus('some_new_mp_status');

            // Act
            const result = await trialService.reconcileExpiredTrials(adapterInput());

            // Assert
            expect(result).toBe(0);
            expect(mockTxUpdateChain.set).not.toHaveBeenCalled();
            expect(Sentry.captureException).toHaveBeenCalled();
        });

        it('skips and alerts when a trialing row has no provider id', async () => {
            // Arrange — cannot ask the provider, so cannot decide
            givenClaimedRows([makeClaimedRow({ mpSubscriptionId: null })]);

            // Act
            const result = await trialService.reconcileExpiredTrials(adapterInput());

            // Assert — never guess an outcome; guessing means cancelling a payer
            // or comping a freeloader
            expect(result).toBe(0);
            expect(mockPaymentAdapter.subscriptions.retrieve).not.toHaveBeenCalled();
            expect(Sentry.captureException).toHaveBeenCalled();
        });

        it('leaves the row untouched when the provider call fails', async () => {
            // Arrange
            givenClaimedRows([makeClaimedRow()]);
            mockPaymentAdapter.subscriptions.retrieve.mockRejectedValue(new Error('MP 503'));

            // Act
            const result = await trialService.reconcileExpiredTrials(adapterInput());

            // Assert — a provider outage must never mutate a subscription
            expect(result).toBe(0);
            expect(mockTxUpdateChain.set).not.toHaveBeenCalled();
            expect(mockBilling.subscriptions.cancel).not.toHaveBeenCalled();
        });

        it('continues processing the batch after one subscription fails', async () => {
            // Arrange — first row blows up at the provider, second succeeds
            givenClaimedRows([
                makeClaimedRow({ id: 'sub-fails' }),
                makeClaimedRow({ id: 'sub-ok', customerId: 'customer-2' })
            ]);
            mockPaymentAdapter.subscriptions.retrieve
                .mockRejectedValueOnce(new Error('MP 503'))
                .mockResolvedValueOnce({ id: 'preapproval-mp-001', status: 'active' });

            // Act
            const result = await trialService.reconcileExpiredTrials(adapterInput());

            // Assert
            expect(result).toBe(1);
        });

        // ── Idempotency ─────────────────────────────────────────────────────
        it('skips a subscription that already has a TRIAL_RECONCILED event', async () => {
            // Arrange — a prior run (or another replica) already settled this one
            givenClaimedRows([makeClaimedRow()]);
            mockDbForTrial.limit.mockResolvedValue([{ id: 'existing-event' }]);

            // Act
            const result = await trialService.reconcileExpiredTrials(adapterInput());

            // Assert — dedup fires BEFORE any external call
            expect(result).toBe(0);
            expect(mockPaymentAdapter.subscriptions.retrieve).not.toHaveBeenCalled();
        });

        it('drops the entitlement cache on every reconciled subscription (INV-1)', async () => {
            // Arrange
            givenClaimedRows([makeClaimedRow({ customerId: 'customer-cache' })]);
            givenProviderStatus('active');

            // Act
            await trialService.reconcileExpiredTrials(adapterInput());

            // Assert
            expect(clearEntitlementCache).toHaveBeenCalledWith('customer-cache');
        });

        // ── Concurrency + empty cases ───────────────────────────────────────
        it('returns 0 when no elapsed trials are claimed', async () => {
            // Arrange
            givenClaimedRows([]);

            // Act
            const result = await trialService.reconcileExpiredTrials(adapterInput());

            // Assert
            expect(result).toBe(0);
            expect(mockPaymentAdapter.subscriptions.retrieve).not.toHaveBeenCalled();
        });

        it('skips the run when another replica holds the advisory lock', async () => {
            // Arrange
            mockTx.execute.mockResolvedValueOnce({
                rows: [{ pg_try_advisory_xact_lock: false }]
            });

            // Act
            const result = await trialService.reconcileExpiredTrials(adapterInput());

            // Assert
            expect(result).toBe(0);
            expect(mockPaymentAdapter.subscriptions.retrieve).not.toHaveBeenCalled();
        });

        it('returns 0 when billing is not configured', async () => {
            // Arrange
            const noBillingService = new TrialService(null);

            // Act
            const result = await noBillingService.reconcileExpiredTrials(adapterInput());

            // Assert
            expect(result).toBe(0);
        });
    });

    describe('buildTrialUpgradeUrl (HOS-115 T-004, pure function)', () => {
        it('appends ?interval=annual for a valid annual intent', () => {
            const url = buildTrialUpgradeUrl({
                siteUrl: 'https://example.test',
                intendedInterval: 'annual'
            });
            expect(url).toBe('https://example.test/es/suscriptores/planes/?interval=annual');
        });

        it('appends ?interval=monthly for a valid monthly intent', () => {
            const url = buildTrialUpgradeUrl({
                siteUrl: 'https://example.test',
                intendedInterval: 'monthly'
            });
            expect(url).toBe('https://example.test/es/suscriptores/planes/?interval=monthly');
        });

        it('omits the query param when intendedInterval is undefined', () => {
            const url = buildTrialUpgradeUrl({ siteUrl: 'https://example.test' });
            expect(url).toBe('https://example.test/es/suscriptores/planes/');
        });

        it('omits the query param for an unrecognized value (defensive against malformed metadata)', () => {
            const url = buildTrialUpgradeUrl({
                siteUrl: 'https://example.test',
                intendedInterval: 'weekly'
            });
            expect(url).toBe('https://example.test/es/suscriptores/planes/');
        });

        it('points at the owner pricing page, not /mi-cuenta/suscripcion (which has no toggle)', () => {
            const url = buildTrialUpgradeUrl({ siteUrl: 'https://example.test' });
            expect(url).not.toContain('/mi-cuenta/suscripcion');
            expect(url).toContain('/suscriptores/planes/');
        });
    });

    describe('reactivateFromTrial (HOS-114)', () => {
        const PAID_PLAN_ID = 'plan-owner-pro';
        const PRICE_ID = 'price_monthly_pro';

        const URLS = {
            paymentMethodReturnUrl: 'https://hospeda.test/es/suscriptores/checkout/success/',
            notificationUrl: 'https://api.hospeda.test/api/v1/webhooks/mercadopago'
        };

        function paidMonthlyPlan(overrides: Record<string, unknown> = {}) {
            return {
                id: PAID_PLAN_ID,
                name: 'owner-pro',
                prices: [
                    {
                        id: PRICE_ID,
                        billingInterval: 'month',
                        intervalCount: 1,
                        active: true,
                        unitAmount: 3_500_000
                    }
                ],
                ...overrides
            };
        }

        function mockPaidCreateHappyPath(customerId: string) {
            vi.spyOn(mockBilling.plans, 'list').mockResolvedValue({
                data: [paidMonthlyPlan()]
            } as never);
            vi.spyOn(mockBilling.customers, 'get').mockResolvedValue({
                id: customerId,
                email: 'owner@example.com'
            } as never);
            vi.spyOn(mockBilling.subscriptions, 'create').mockResolvedValue({
                id: 'sub-paid',
                customerId,
                planId: PAID_PLAN_ID,
                status: 'incomplete',
                providerInitPoint: 'https://mp.test/checkout/reactivate-abc',
                providerSubscriptionIds: { mercadopago: 'mp_preapproval_reactivate' }
            } as never);
        }

        it('should create a real paid preapproval and return a checkoutUrl instead of cancelling the trial synchronously', async () => {
            // Arrange — `clearEntitlementCache` is a single module-level mock shared
            // across every test in this file (no global mock-reset configured); clear
            // any stale call history from earlier tests before asserting on it below.
            vi.mocked(clearEntitlementCache).mockClear();
            const customerId = 'customer-123';

            const existingTrialSub = {
                id: 'sub-trial',
                customerId,
                status: 'trialing'
            };

            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([
                existingTrialSub
            ] as never);
            mockPaidCreateHappyPath(customerId);

            // Act
            const result = await trialService.reactivateFromTrial({
                customerId,
                planId: PAID_PLAN_ID,
                urls: URLS
            });

            // Assert — new contract: full result object, checkoutUrl + incomplete status
            expect(result).toEqual({
                success: true,
                subscriptionId: 'sub-paid',
                checkoutUrl: 'https://mp.test/checkout/reactivate-abc',
                status: 'incomplete',
                message: expect.any(String)
            });

            // The old trialing sub must NOT be cancelled synchronously (deferred to
            // the webhook, HOS-114 T-007) — see spec §6.4/§6.5.
            expect(mockBilling.subscriptions.cancel).not.toHaveBeenCalled();

            // The entitlement cache must NOT be cleared here either — deferred to the
            // webhook so the old trial keeps granting entitlements during checkout.
            expect(clearEntitlementCache).not.toHaveBeenCalled();

            // The create call must use the real mode:'paid' contract, and carry the
            // superseded trial's id so the webhook can complete the swap.
            expect(mockBilling.subscriptions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    customerId,
                    planId: PAID_PLAN_ID,
                    priceId: PRICE_ID,
                    mode: 'paid',
                    billingInterval: 'monthly',
                    paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
                    notificationUrl: URLS.notificationUrl,
                    metadata: expect.objectContaining({
                        convertedFromTrial: 'true',
                        supersedesSubscriptionId: 'sub-trial'
                    })
                })
            );
        });

        it('should create the paid preapproval even if no existing trial exists (no supersedesSubscriptionId)', async () => {
            // Arrange
            const customerId = 'customer-456';

            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([] as never);
            mockPaidCreateHappyPath(customerId);

            // Act
            const result = await trialService.reactivateFromTrial({
                customerId,
                planId: PAID_PLAN_ID,
                urls: URLS
            });

            // Assert
            expect(result.subscriptionId).toBe('sub-paid');
            expect(result.checkoutUrl).toBe('https://mp.test/checkout/reactivate-abc');
            expect(mockBilling.subscriptions.cancel).not.toHaveBeenCalled();

            const createCall = vi.mocked(mockBilling.subscriptions.create).mock.calls[0]?.[0] as {
                metadata?: Record<string, unknown>;
            };
            expect(createCall.metadata).not.toHaveProperty('supersedesSubscriptionId');
        });

        it('should throw error if billing disabled', async () => {
            // Arrange
            const trialServiceNoBilling = new TrialService(null);

            // Act & Assert
            await expect(
                trialServiceNoBilling.reactivateFromTrial({
                    customerId: 'customer-123',
                    planId: 'plan-123',
                    urls: URLS
                })
            ).rejects.toThrow('Billing not enabled');
        });

        it('should propagate the plan guard rejection (unknown planId) and create no subscription', async () => {
            // Arrange
            const customerId = 'customer-789';
            vi.spyOn(mockBilling.plans, 'list').mockResolvedValue({ data: [] } as never);
            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([] as never);

            // Act & Assert
            await expect(
                trialService.reactivateFromTrial({
                    customerId,
                    planId: 'unknown-plan-id',
                    urls: URLS
                })
            ).rejects.toMatchObject({ name: 'SubscriptionCheckoutError', code: 'PLAN_NOT_FOUND' });

            expect(mockBilling.subscriptions.create).not.toHaveBeenCalled();
        });

        it('should propagate the plan guard rejection (free plan) and create no subscription', async () => {
            // Arrange
            const customerId = 'customer-free';
            vi.spyOn(mockBilling.plans, 'list').mockResolvedValue({
                data: [
                    paidMonthlyPlan({
                        id: 'plan-free',
                        prices: [
                            {
                                id: 'price-free',
                                billingInterval: 'month',
                                intervalCount: 1,
                                active: true,
                                unitAmount: 0
                            }
                        ]
                    })
                ]
            } as never);

            // Act & Assert
            await expect(
                trialService.reactivateFromTrial({
                    customerId,
                    planId: 'plan-free',
                    urls: URLS
                })
            ).rejects.toMatchObject({
                name: 'SubscriptionCheckoutError',
                code: 'INVALID_REACTIVATION_PLAN'
            });

            expect(mockBilling.subscriptions.create).not.toHaveBeenCalled();
        });

        it('should propagate the plan guard rejection (annual-only plan) and create no subscription', async () => {
            // Arrange
            const customerId = 'customer-annual';
            vi.spyOn(mockBilling.plans, 'list').mockResolvedValue({
                data: [
                    paidMonthlyPlan({
                        id: 'plan-annual-only',
                        prices: [
                            {
                                id: 'price-annual',
                                billingInterval: 'year',
                                intervalCount: 1,
                                active: true,
                                unitAmount: 35_000_000
                            }
                        ]
                    })
                ]
            } as never);

            // Act & Assert
            await expect(
                trialService.reactivateFromTrial({
                    customerId,
                    planId: 'plan-annual-only',
                    urls: URLS
                })
            ).rejects.toMatchObject({
                name: 'SubscriptionCheckoutError',
                code: 'ANNUAL_REACTIVATION_UNSUPPORTED'
            });

            expect(mockBilling.subscriptions.create).not.toHaveBeenCalled();
        });

        it('should throw CUSTOMER_NOT_FOUND and create no subscription when the billing customer is missing', async () => {
            // Arrange
            const customerId = 'customer-missing';
            vi.spyOn(mockBilling.plans, 'list').mockResolvedValue({
                data: [paidMonthlyPlan()]
            } as never);
            vi.spyOn(mockBilling.customers, 'get').mockResolvedValue(null as never);

            // Act & Assert
            await expect(
                trialService.reactivateFromTrial({
                    customerId,
                    planId: PAID_PLAN_ID,
                    urls: URLS
                })
            ).rejects.toMatchObject({
                name: 'SubscriptionCheckoutError',
                code: 'CUSTOMER_NOT_FOUND'
            });

            expect(mockBilling.subscriptions.create).not.toHaveBeenCalled();
        });

        it('should propagate MISSING_INIT_POINT and never return a checkoutUrl-less success', async () => {
            // Arrange
            const customerId = 'customer-no-init-point';
            vi.spyOn(mockBilling.plans, 'list').mockResolvedValue({
                data: [paidMonthlyPlan()]
            } as never);
            vi.spyOn(mockBilling.customers, 'get').mockResolvedValue({
                id: customerId,
                email: 'owner@example.com'
            } as never);
            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([] as never);
            vi.spyOn(mockBilling.subscriptions, 'create').mockResolvedValue({
                id: 'sub-no-init',
                customerId,
                planId: PAID_PLAN_ID,
                status: 'incomplete'
                // No providerInitPoint / providerSandboxInitPoint.
            } as never);

            // Act & Assert
            await expect(
                trialService.reactivateFromTrial({
                    customerId,
                    planId: PAID_PLAN_ID,
                    urls: URLS
                })
            ).rejects.toMatchObject({
                name: 'SubscriptionCheckoutError',
                code: 'MISSING_INIT_POINT'
            });
        });

        // ── HOS-171 §7.2: annual reactivation is now a recurring MercadoPago
        // preapproval routed through the SAME `createPaidSubscription`
        // helper as monthly (`billingInterval: 'annual'` is the only
        // difference) — the old one-time-charge `createAnnualSubscription`
        // helper no longer exists. These assertions target the shared
        // boundary the monthly tests already use: `mockBilling.subscriptions
        // .create` (never mocked at the `createPaidSubscription` level).
        describe('annual billingInterval (HOS-171 §7.2)', () => {
            const ANNUAL_PRICE_ID = 'price_annual_pro';
            const ANNUAL_URLS = {
                successUrl: 'https://hospeda.test/es/suscriptores/checkout/success/',
                cancelUrl: 'https://hospeda.test/es/suscriptores/checkout/cancel/',
                notificationUrl: 'https://api.hospeda.test/api/v1/webhooks/mercadopago'
            };

            function paidPlanWithAnnual(overrides: Record<string, unknown> = {}) {
                return {
                    id: PAID_PLAN_ID,
                    name: 'owner-pro',
                    metadata: {},
                    prices: [
                        {
                            id: PRICE_ID,
                            billingInterval: 'month',
                            intervalCount: 1,
                            active: true,
                            unitAmount: 3_500_000
                        },
                        {
                            id: ANNUAL_PRICE_ID,
                            billingInterval: 'year',
                            intervalCount: 1,
                            active: true,
                            unitAmount: 35_000_000
                        }
                    ],
                    ...overrides
                };
            }

            function mockAnnualCreateHappyPath(customerId: string) {
                vi.spyOn(mockBilling.plans, 'list').mockResolvedValue({
                    data: [paidPlanWithAnnual()]
                } as never);
                vi.spyOn(mockBilling.customers, 'get').mockResolvedValue({
                    id: customerId,
                    email: 'owner@example.com'
                } as never);
                vi.spyOn(mockBilling.subscriptions, 'create').mockResolvedValue({
                    id: 'sub-annual-local',
                    customerId,
                    planId: PAID_PLAN_ID,
                    status: 'incomplete',
                    providerInitPoint: 'https://mp.test/checkout/annual-reactivate-abc',
                    providerSubscriptionIds: { mercadopago: 'mp_preapproval_annual_reactivate' }
                } as never);
            }

            it('routes annual reactivation through createPaidSubscription (billingInterval: annual) and returns a pending_provider result', async () => {
                // Arrange
                vi.mocked(clearEntitlementCache).mockClear();
                const customerId = 'customer-annual-reactivate';
                const existingTrialSub = {
                    id: 'sub-trial-annual',
                    customerId,
                    status: 'trialing'
                };

                vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([
                    existingTrialSub
                ] as never);
                mockAnnualCreateHappyPath(customerId);

                // Act
                const result = await trialService.reactivateFromTrial({
                    customerId,
                    planId: PAID_PLAN_ID,
                    billingInterval: 'annual',
                    urls: ANNUAL_URLS
                });

                // Assert
                expect(result).toEqual({
                    success: true,
                    subscriptionId: 'sub-annual-local',
                    checkoutUrl: 'https://mp.test/checkout/annual-reactivate-abc',
                    status: 'pending_provider',
                    message: expect.any(String)
                });

                // The preapproval-create call must carry `billingInterval:
                // 'annual'` — a preapproval has a single `back_url`
                // (`urls.successUrl`), not the annual hosted-checkout shape.
                expect(mockBilling.subscriptions.create).toHaveBeenCalledWith(
                    expect.objectContaining({
                        customerId,
                        planId: PAID_PLAN_ID,
                        priceId: ANNUAL_PRICE_ID,
                        mode: 'paid',
                        billingInterval: 'annual',
                        paymentMethodReturnUrl: ANNUAL_URLS.successUrl,
                        notificationUrl: ANNUAL_URLS.notificationUrl,
                        metadata: expect.objectContaining({
                            convertedFromTrial: 'true',
                            supersedesSubscriptionId: 'sub-trial-annual'
                        })
                    })
                );

                // Still deferred to the webhook — never touched synchronously.
                expect(mockBilling.subscriptions.cancel).not.toHaveBeenCalled();
                expect(clearEntitlementCache).not.toHaveBeenCalled();
            });

            it('NG-3 regression: billingInterval omitted still routes through the unchanged monthly createPaidSubscription path', async () => {
                // Arrange
                vi.mocked(clearEntitlementCache).mockClear();
                const customerId = 'customer-ng3-from-trial';
                const existingTrialSub = {
                    id: 'sub-trial-ng3',
                    customerId,
                    status: 'trialing'
                };

                vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([
                    existingTrialSub
                ] as never);
                mockPaidCreateHappyPath(customerId);

                // Act
                const result = await trialService.reactivateFromTrial({
                    customerId,
                    planId: PAID_PLAN_ID,
                    urls: URLS
                });

                // Assert — identical shape/assertions to the pre-HOS-123 happy path.
                expect(result).toEqual({
                    success: true,
                    subscriptionId: 'sub-paid',
                    checkoutUrl: 'https://mp.test/checkout/reactivate-abc',
                    status: 'incomplete',
                    message: expect.any(String)
                });
                expect(mockBilling.subscriptions.cancel).not.toHaveBeenCalled();
                expect(clearEntitlementCache).not.toHaveBeenCalled();
                expect(mockBilling.subscriptions.create).toHaveBeenCalledWith(
                    expect.objectContaining({
                        customerId,
                        planId: PAID_PLAN_ID,
                        priceId: PRICE_ID,
                        mode: 'paid',
                        billingInterval: 'monthly',
                        paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
                        notificationUrl: URLS.notificationUrl,
                        metadata: expect.objectContaining({
                            convertedFromTrial: 'true',
                            supersedesSubscriptionId: 'sub-trial-ng3'
                        })
                    })
                );
            });

            it('propagates NO_ANNUAL_PRICE from the guard when the plan has no active annual price, and creates no subscription', async () => {
                // Arrange — plan only has a monthly price.
                const customerId = 'customer-no-annual-price';
                vi.spyOn(mockBilling.plans, 'list').mockResolvedValue({
                    data: [paidMonthlyPlan()]
                } as never);
                vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue(
                    [] as never
                );

                // Act & Assert
                await expect(
                    trialService.reactivateFromTrial({
                        customerId,
                        planId: PAID_PLAN_ID,
                        billingInterval: 'annual',
                        urls: ANNUAL_URLS
                    })
                ).rejects.toMatchObject({
                    name: 'SubscriptionCheckoutError',
                    code: 'NO_ANNUAL_PRICE'
                });

                expect(mockBilling.subscriptions.create).not.toHaveBeenCalled();
            });
        });
    });

    // ── HOS-114 T-010: `reactivateSubscription` had ZERO direct unit-test
    // coverage prior to this block — the route test (`test/routes/
    // reactivate-subscription.test.ts`) mocks the service entirely, and the
    // webhook test (`test/webhooks/subscription-logic.test.ts`) simulates
    // metadata directly without ever invoking this method. This closes that
    // gap, mirroring `reactivateFromTrial (HOS-114)` above.
    describe('reactivateSubscription (HOS-114)', () => {
        const PAID_PLAN_ID = 'plan-owner-pro';
        const PRICE_ID = 'price_monthly_pro';

        const URLS = {
            paymentMethodReturnUrl: 'https://hospeda.test/es/suscriptores/checkout/success/',
            notificationUrl: 'https://api.hospeda.test/api/v1/webhooks/mercadopago'
        };

        function paidMonthlyPlan(overrides: Record<string, unknown> = {}) {
            return {
                id: PAID_PLAN_ID,
                name: 'owner-pro',
                prices: [
                    {
                        id: PRICE_ID,
                        billingInterval: 'month',
                        intervalCount: 1,
                        active: true,
                        unitAmount: 3_500_000
                    }
                ],
                ...overrides
            };
        }

        function mockPaidCreateHappyPath(customerId: string) {
            vi.spyOn(mockBilling.plans, 'list').mockResolvedValue({
                data: [paidMonthlyPlan()]
            } as never);
            vi.spyOn(mockBilling.customers, 'get').mockResolvedValue({
                id: customerId,
                email: 'owner@example.com'
            } as never);
            vi.spyOn(mockBilling.subscriptions, 'create').mockResolvedValue({
                id: 'sub-paid-reactivated',
                customerId,
                planId: PAID_PLAN_ID,
                status: 'incomplete',
                providerInitPoint: 'https://mp.test/checkout/reactivate-sub-abc',
                providerSubscriptionIds: { mercadopago: 'mp_preapproval_reactivate_sub' }
            } as never);
        }

        it('HOS-114 regression: reactivate never produces a phantom-active sub — result is always incomplete + checkoutUrl, old canceled sub not touched synchronously', async () => {
            // Arrange
            vi.mocked(clearEntitlementCache).mockClear();
            const customerId = 'customer-canceled-1';
            const canceledSub = {
                id: 'sub-canceled',
                customerId,
                status: 'canceled',
                planId: 'plan-old'
            };

            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([
                canceledSub
            ] as never);
            mockPaidCreateHappyPath(customerId);

            // Act
            const result = await trialService.reactivateSubscription({
                customerId,
                planId: PAID_PLAN_ID,
                urls: URLS
            });

            // Assert — full result shape: never locally-active, always incomplete + checkoutUrl.
            expect(result).toEqual({
                success: true,
                subscriptionId: 'sub-paid-reactivated',
                previousPlanId: 'plan-old',
                checkoutUrl: 'https://mp.test/checkout/reactivate-sub-abc',
                status: 'incomplete',
                message: expect.any(String)
            });
            // Explicit pin of the pre-fix bug shape being gone (AC-5): the
            // pre-HOS-114 bug returned an implicitly-`active` subscription
            // with no checkoutUrl at all. Never 'active', always a checkoutUrl.
            expect(result.status).not.toBe('active');
            expect(result.checkoutUrl).toBeTruthy();

            // The old canceled sub must NOT be touched synchronously (deferred
            // to the webhook, HOS-114 T-007) — see spec §6.4/§6.5.
            expect(mockBilling.subscriptions.cancel).not.toHaveBeenCalled();

            // The entitlement cache must NOT be cleared here either.
            expect(clearEntitlementCache).not.toHaveBeenCalled();

            // The create call must use the real mode:'paid' contract, and carry
            // the superseded canceled sub's id so the webhook can complete the swap.
            expect(mockBilling.subscriptions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    customerId,
                    planId: PAID_PLAN_ID,
                    priceId: PRICE_ID,
                    mode: 'paid',
                    billingInterval: 'monthly',
                    paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
                    notificationUrl: URLS.notificationUrl,
                    metadata: expect.objectContaining({
                        reactivatedFromCanceled: 'true',
                        previousPlanId: 'plan-old',
                        supersedesSubscriptionId: 'sub-canceled'
                    })
                })
            );
        });

        it('should reject when an active subscription already exists, and create no subscription', async () => {
            // Arrange
            const customerId = 'customer-has-active';
            vi.spyOn(mockBilling.plans, 'list').mockResolvedValue({
                data: [paidMonthlyPlan()]
            } as never);
            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([
                { id: 'sub-active', customerId, status: 'active', planId: PAID_PLAN_ID }
            ] as never);

            // Act & Assert
            await expect(
                trialService.reactivateSubscription({
                    customerId,
                    planId: PAID_PLAN_ID,
                    urls: URLS
                })
            ).rejects.toThrow(/active subscription exists/i);

            expect(mockBilling.subscriptions.create).not.toHaveBeenCalled();
        });

        it('HOS-114 T-015b regression: rejects with SubscriptionCheckoutError(ACTIVE_SUBSCRIPTION_EXISTS), not a plain Error (HTTP 500)', async () => {
            // Arrange
            const customerId = 'customer-has-active-typed';
            vi.spyOn(mockBilling.plans, 'list').mockResolvedValue({
                data: [paidMonthlyPlan()]
            } as never);
            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([
                { id: 'sub-active', customerId, status: 'active', planId: PAID_PLAN_ID }
            ] as never);

            // Act & Assert
            await expect(
                trialService.reactivateSubscription({
                    customerId,
                    planId: PAID_PLAN_ID,
                    urls: URLS
                })
            ).rejects.toMatchObject({
                name: 'SubscriptionCheckoutError',
                code: 'ACTIVE_SUBSCRIPTION_EXISTS'
            });
        });

        it('should reject when no canceled subscription exists, and create no subscription', async () => {
            // Arrange
            const customerId = 'customer-no-canceled';
            vi.spyOn(mockBilling.plans, 'list').mockResolvedValue({
                data: [paidMonthlyPlan()]
            } as never);
            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([] as never);

            // Act & Assert
            await expect(
                trialService.reactivateSubscription({
                    customerId,
                    planId: PAID_PLAN_ID,
                    urls: URLS
                })
            ).rejects.toThrow(/No canceled subscription found/i);

            expect(mockBilling.subscriptions.create).not.toHaveBeenCalled();
        });

        it('HOS-114 T-015b regression: rejects with SubscriptionCheckoutError(NO_CANCELED_SUBSCRIPTION), not a plain Error (HTTP 500)', async () => {
            // Arrange
            const customerId = 'customer-no-canceled-typed';
            vi.spyOn(mockBilling.plans, 'list').mockResolvedValue({
                data: [paidMonthlyPlan()]
            } as never);
            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([] as never);

            // Act & Assert
            await expect(
                trialService.reactivateSubscription({
                    customerId,
                    planId: PAID_PLAN_ID,
                    urls: URLS
                })
            ).rejects.toMatchObject({
                name: 'SubscriptionCheckoutError',
                code: 'NO_CANCELED_SUBSCRIPTION'
            });
        });

        it('HOS-114 T-015b regression: rejects with SubscriptionCheckoutError(NO_CANCELED_SUBSCRIPTION) when only a trialing subscription exists (no canceled sub to reactivate from)', async () => {
            // Arrange: covers the second `NO_CANCELED_SUBSCRIPTION` throw site
            // (after the active/trialing guard passes but no `canceled` sub is
            // found) — distinct from the `subscriptions.length === 0` guard
            // above.
            const customerId = 'customer-only-expired-no-canceled';
            vi.spyOn(mockBilling.plans, 'list').mockResolvedValue({
                data: [paidMonthlyPlan()]
            } as never);
            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([
                { id: 'sub-expired', customerId, status: 'expired', planId: 'plan-old' }
            ] as never);

            // Act & Assert
            await expect(
                trialService.reactivateSubscription({
                    customerId,
                    planId: PAID_PLAN_ID,
                    urls: URLS
                })
            ).rejects.toMatchObject({
                name: 'SubscriptionCheckoutError',
                code: 'NO_CANCELED_SUBSCRIPTION'
            });

            expect(mockBilling.subscriptions.create).not.toHaveBeenCalled();
        });

        it('should throw CUSTOMER_NOT_FOUND and create no subscription when the billing customer is missing', async () => {
            // Arrange
            const customerId = 'customer-missing-sub';
            vi.spyOn(mockBilling.plans, 'list').mockResolvedValue({
                data: [paidMonthlyPlan()]
            } as never);
            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([
                { id: 'sub-canceled-2', customerId, status: 'canceled', planId: 'plan-old' }
            ] as never);
            vi.spyOn(mockBilling.customers, 'get').mockResolvedValue(null as never);

            // Act & Assert
            await expect(
                trialService.reactivateSubscription({
                    customerId,
                    planId: PAID_PLAN_ID,
                    urls: URLS
                })
            ).rejects.toMatchObject({
                name: 'SubscriptionCheckoutError',
                code: 'CUSTOMER_NOT_FOUND'
            });

            expect(mockBilling.subscriptions.create).not.toHaveBeenCalled();
        });

        it('should propagate MISSING_INIT_POINT and never return a checkoutUrl-less success', async () => {
            // Arrange
            const customerId = 'customer-no-init-point-sub';
            vi.spyOn(mockBilling.plans, 'list').mockResolvedValue({
                data: [paidMonthlyPlan()]
            } as never);
            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([
                { id: 'sub-canceled-3', customerId, status: 'canceled', planId: 'plan-old' }
            ] as never);
            vi.spyOn(mockBilling.customers, 'get').mockResolvedValue({
                id: customerId,
                email: 'owner@example.com'
            } as never);
            vi.spyOn(mockBilling.subscriptions, 'create').mockResolvedValue({
                id: 'sub-no-init-2',
                customerId,
                planId: PAID_PLAN_ID,
                status: 'incomplete'
                // No providerInitPoint / providerSandboxInitPoint.
            } as never);

            // Act & Assert
            await expect(
                trialService.reactivateSubscription({
                    customerId,
                    planId: PAID_PLAN_ID,
                    urls: URLS
                })
            ).rejects.toMatchObject({
                name: 'SubscriptionCheckoutError',
                code: 'MISSING_INIT_POINT'
            });
        });

        // ── HOS-171 §7.2: annual reactivation is now a recurring MercadoPago
        // preapproval routed through the SAME `createPaidSubscription`
        // helper as monthly (`billingInterval: 'annual'` is the only
        // difference) — the old one-time-charge `createAnnualSubscription`
        // helper no longer exists. Mirrors the `reactivateFromTrial` annual
        // sub-describe above, except this method's supersession marker is
        // `reactivatedFromCanceled`, never `convertedFromTrial`, and
        // `previousPlanId` must survive for both intervals.
        describe('annual billingInterval (HOS-171 §7.2)', () => {
            const ANNUAL_PRICE_ID = 'price_annual_pro_sub';
            const ANNUAL_URLS = {
                successUrl: 'https://hospeda.test/es/suscriptores/checkout/success/',
                cancelUrl: 'https://hospeda.test/es/suscriptores/checkout/cancel/',
                notificationUrl: 'https://api.hospeda.test/api/v1/webhooks/mercadopago'
            };

            function paidPlanWithAnnual(overrides: Record<string, unknown> = {}) {
                return {
                    id: PAID_PLAN_ID,
                    name: 'owner-pro',
                    metadata: {},
                    prices: [
                        {
                            id: PRICE_ID,
                            billingInterval: 'month',
                            intervalCount: 1,
                            active: true,
                            unitAmount: 3_500_000
                        },
                        {
                            id: ANNUAL_PRICE_ID,
                            billingInterval: 'year',
                            intervalCount: 1,
                            active: true,
                            unitAmount: 35_000_000
                        }
                    ],
                    ...overrides
                };
            }

            function mockAnnualCreateHappyPath(customerId: string) {
                vi.spyOn(mockBilling.plans, 'list').mockResolvedValue({
                    data: [paidPlanWithAnnual()]
                } as never);
                vi.spyOn(mockBilling.customers, 'get').mockResolvedValue({
                    id: customerId,
                    email: 'owner@example.com'
                } as never);
                vi.spyOn(mockBilling.subscriptions, 'create').mockResolvedValue({
                    id: 'sub-annual-local-reactivated',
                    customerId,
                    planId: PAID_PLAN_ID,
                    status: 'incomplete',
                    providerInitPoint: 'https://mp.test/checkout/annual-reactivate-sub-abc',
                    providerSubscriptionIds: {
                        mercadopago: 'mp_preapproval_annual_reactivate_sub'
                    }
                } as never);
            }

            it('routes annual reactivation through createPaidSubscription (billingInterval: annual), preserves previousPlanId, and returns a pending_provider result', async () => {
                // Arrange
                vi.mocked(clearEntitlementCache).mockClear();
                const customerId = 'customer-canceled-annual';
                const canceledSub = {
                    id: 'sub-canceled-annual',
                    customerId,
                    status: 'canceled',
                    planId: 'plan-old-annual'
                };

                vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([
                    canceledSub
                ] as never);
                mockAnnualCreateHappyPath(customerId);

                // Act
                const result = await trialService.reactivateSubscription({
                    customerId,
                    planId: PAID_PLAN_ID,
                    billingInterval: 'annual',
                    urls: ANNUAL_URLS
                });

                // Assert
                expect(result).toEqual({
                    success: true,
                    subscriptionId: 'sub-annual-local-reactivated',
                    previousPlanId: 'plan-old-annual',
                    checkoutUrl: 'https://mp.test/checkout/annual-reactivate-sub-abc',
                    status: 'pending_provider',
                    message: expect.any(String)
                });

                expect(mockBilling.subscriptions.create).toHaveBeenCalledWith(
                    expect.objectContaining({
                        customerId,
                        planId: PAID_PLAN_ID,
                        priceId: ANNUAL_PRICE_ID,
                        mode: 'paid',
                        billingInterval: 'annual',
                        paymentMethodReturnUrl: ANNUAL_URLS.successUrl,
                        notificationUrl: ANNUAL_URLS.notificationUrl,
                        metadata: expect.objectContaining({
                            reactivatedFromCanceled: 'true',
                            previousPlanId: 'plan-old-annual',
                            supersedesSubscriptionId: 'sub-canceled-annual'
                        })
                    })
                );

                // Must NOT stamp convertedFromTrial — that marker belongs only
                // to `reactivateFromTrial`'s trigger source; this method's is
                // `reactivatedFromCanceled` (subscription-reactivation).
                const call = vi.mocked(mockBilling.subscriptions.create).mock.calls[0]?.[0] as {
                    metadata?: Record<string, unknown>;
                };
                expect(call.metadata).not.toHaveProperty('convertedFromTrial');

                expect(mockBilling.subscriptions.cancel).not.toHaveBeenCalled();
                expect(clearEntitlementCache).not.toHaveBeenCalled();
            });

            it('NG-3 regression: billingInterval omitted still routes through the unchanged monthly createPaidSubscription path', async () => {
                // Arrange
                vi.mocked(clearEntitlementCache).mockClear();
                const customerId = 'customer-ng3-canceled';
                const canceledSub = {
                    id: 'sub-canceled-ng3',
                    customerId,
                    status: 'canceled',
                    planId: 'plan-old'
                };

                vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([
                    canceledSub
                ] as never);
                mockPaidCreateHappyPath(customerId);

                // Act
                const result = await trialService.reactivateSubscription({
                    customerId,
                    planId: PAID_PLAN_ID,
                    urls: URLS
                });

                // Assert — identical shape/assertions to the pre-HOS-123 happy path.
                expect(result).toEqual({
                    success: true,
                    subscriptionId: 'sub-paid-reactivated',
                    previousPlanId: 'plan-old',
                    checkoutUrl: 'https://mp.test/checkout/reactivate-sub-abc',
                    status: 'incomplete',
                    message: expect.any(String)
                });
                expect(mockBilling.subscriptions.cancel).not.toHaveBeenCalled();
                expect(clearEntitlementCache).not.toHaveBeenCalled();
                expect(mockBilling.subscriptions.create).toHaveBeenCalledWith(
                    expect.objectContaining({
                        customerId,
                        planId: PAID_PLAN_ID,
                        priceId: PRICE_ID,
                        mode: 'paid',
                        billingInterval: 'monthly',
                        paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
                        notificationUrl: URLS.notificationUrl,
                        metadata: expect.objectContaining({
                            reactivatedFromCanceled: 'true',
                            previousPlanId: 'plan-old',
                            supersedesSubscriptionId: 'sub-canceled-ng3'
                        })
                    })
                );
            });

            it('propagates NO_ANNUAL_PRICE from the guard when the plan has no active annual price, and creates no subscription', async () => {
                // Arrange — plan only has a monthly price.
                const customerId = 'customer-no-annual-price-sub';
                const canceledSub = {
                    id: 'sub-canceled-no-annual',
                    customerId,
                    status: 'canceled',
                    planId: 'plan-old'
                };
                vi.spyOn(mockBilling.plans, 'list').mockResolvedValue({
                    data: [paidMonthlyPlan()]
                } as never);
                vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([
                    canceledSub
                ] as never);

                // Act & Assert
                await expect(
                    trialService.reactivateSubscription({
                        customerId,
                        planId: PAID_PLAN_ID,
                        billingInterval: 'annual',
                        urls: ANNUAL_URLS
                    })
                ).rejects.toMatchObject({
                    name: 'SubscriptionCheckoutError',
                    code: 'NO_ANNUAL_PRICE'
                });

                expect(mockBilling.subscriptions.create).not.toHaveBeenCalled();
            });
        });
    });

    describe('reconcileDuplicateSubscriptions', () => {
        it('should cancel the older subscription when two active subscriptions exist', async () => {
            // Arrange — simulate the GAP-012 scenario: cancel failed during upgrade,
            // leaving both the old trialing sub and the new active sub alive.
            const customerId = 'customer-dup-001';
            const olderCreatedAt = '2026-01-10T10:00:00.000Z';
            const newerCreatedAt = '2026-01-10T10:05:00.000Z';

            const olderTrialSub = {
                id: 'sub-old-trial',
                customerId,
                status: 'trialing',
                createdAt: olderCreatedAt
            };
            const newerActiveSub = {
                id: 'sub-new-active',
                customerId,
                status: 'active',
                createdAt: newerCreatedAt
            };

            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([
                olderTrialSub,
                newerActiveSub
            ] as never);
            vi.spyOn(mockBilling.subscriptions, 'cancel').mockResolvedValue({} as never);

            // Act
            const result = await trialService.reconcileDuplicateSubscriptions({ customerId });

            // Assert — the older subscription (trialing) must be cancelled
            expect(result.cancelledCount).toBe(1);
            expect(result.cancelledIds).toContain('sub-old-trial');
            expect(result.keptId).toBe('sub-new-active');
            expect(mockBilling.subscriptions.cancel).toHaveBeenCalledTimes(1);
            expect(mockBilling.subscriptions.cancel).toHaveBeenCalledWith('sub-old-trial');
        });

        it('should cancel all older subscriptions when three or more active exist', async () => {
            // Arrange — edge case: three live subscriptions (e.g., retry storm)
            const customerId = 'customer-dup-002';

            const subs = [
                {
                    id: 'sub-a',
                    customerId,
                    status: 'active',
                    createdAt: '2026-01-10T09:00:00.000Z'
                },
                {
                    id: 'sub-b',
                    customerId,
                    status: 'active',
                    createdAt: '2026-01-10T09:30:00.000Z'
                },
                { id: 'sub-c', customerId, status: 'active', createdAt: '2026-01-10T10:00:00.000Z' }
            ];

            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue(subs as never);
            vi.spyOn(mockBilling.subscriptions, 'cancel').mockResolvedValue({} as never);

            // Act
            const result = await trialService.reconcileDuplicateSubscriptions({ customerId });

            // Assert — sub-c (newest) is kept, sub-a and sub-b are cancelled
            expect(result.cancelledCount).toBe(2);
            expect(result.cancelledIds).toContain('sub-a');
            expect(result.cancelledIds).toContain('sub-b');
            expect(result.cancelledIds).not.toContain('sub-c');
            expect(result.keptId).toBe('sub-c');
        });

        it('should be a no-op when only one active subscription exists', async () => {
            // Arrange
            const customerId = 'customer-single-001';

            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([
                {
                    id: 'sub-only',
                    customerId,
                    status: 'active',
                    createdAt: '2026-01-10T10:00:00.000Z'
                }
            ] as never);

            // Act
            const result = await trialService.reconcileDuplicateSubscriptions({ customerId });

            // Assert
            expect(result.cancelledCount).toBe(0);
            expect(result.cancelledIds).toHaveLength(0);
            expect(result.keptId).toBe('sub-only');
            expect(mockBilling.subscriptions.cancel).not.toHaveBeenCalled();
        });

        it('should be a no-op when the customer has no subscriptions', async () => {
            // Arrange
            const customerId = 'customer-empty-001';

            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([] as never);

            // Act
            const result = await trialService.reconcileDuplicateSubscriptions({ customerId });

            // Assert
            expect(result.cancelledCount).toBe(0);
            expect(result.cancelledIds).toHaveLength(0);
            expect(result.keptId).toBeNull();
            expect(mockBilling.subscriptions.cancel).not.toHaveBeenCalled();
        });

        it('should return null keptId and 0 cancelled when billing is disabled', async () => {
            // Arrange
            const trialServiceNoBilling = new TrialService(null);

            // Act
            const result = await trialServiceNoBilling.reconcileDuplicateSubscriptions({
                customerId: 'customer-123'
            });

            // Assert
            expect(result.cancelledCount).toBe(0);
            expect(result.cancelledIds).toHaveLength(0);
            expect(result.keptId).toBeNull();
        });

        it('should continue cancelling remaining duplicates if one cancel call fails', async () => {
            // Arrange — three live subs. After sorting descending by createdAt:
            //   duplicates iteration order: [sub-middle, sub-oldest]
            // First cancel call (sub-middle) fails; second (sub-oldest) succeeds.
            const customerId = 'customer-partial-fail';

            const subs = [
                {
                    id: 'sub-oldest',
                    customerId,
                    status: 'trialing',
                    createdAt: '2026-01-01T00:00:00.000Z'
                },
                {
                    id: 'sub-middle',
                    customerId,
                    status: 'trialing',
                    createdAt: '2026-01-02T00:00:00.000Z'
                },
                {
                    id: 'sub-newest',
                    customerId,
                    status: 'active',
                    createdAt: '2026-01-03T00:00:00.000Z'
                }
            ];

            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue(subs as never);
            // Sorted descending: newest, middle, oldest → duplicates: [middle, oldest]
            // First call (sub-middle) fails, second call (sub-oldest) succeeds
            vi.spyOn(mockBilling.subscriptions, 'cancel')
                .mockRejectedValueOnce(new Error('Network timeout'))
                .mockResolvedValue({} as never);

            // Act
            const result = await trialService.reconcileDuplicateSubscriptions({ customerId });

            // Assert — sub-middle cancel failed (not counted), sub-oldest cancel succeeded
            expect(result.cancelledCount).toBe(1);
            expect(result.cancelledIds).toContain('sub-oldest');
            expect(result.cancelledIds).not.toContain('sub-middle');
            expect(result.keptId).toBe('sub-newest');
            // Both cancel calls were attempted despite first failure
            expect(mockBilling.subscriptions.cancel).toHaveBeenCalledTimes(2);
        });

        it('should ignore cancelled and non-live subscriptions when counting duplicates', async () => {
            // Arrange — one active + one already-cancelled: not a duplicate scenario
            const customerId = 'customer-mixed-001';

            const subs = [
                {
                    id: 'sub-canceled',
                    customerId,
                    status: 'canceled',
                    createdAt: '2026-01-01T00:00:00.000Z'
                },
                {
                    id: 'sub-active',
                    customerId,
                    status: 'active',
                    createdAt: '2026-01-10T00:00:00.000Z'
                }
            ];

            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue(subs as never);

            // Act
            const result = await trialService.reconcileDuplicateSubscriptions({ customerId });

            // Assert — only one live subscription, no cancellation needed
            expect(result.cancelledCount).toBe(0);
            expect(result.keptId).toBe('sub-active');
            expect(mockBilling.subscriptions.cancel).not.toHaveBeenCalled();
        });

        // NOTE (HOS-114): the former "should trigger reconciliation inside
        // reactivateFromTrial when trial cancel fails" test (the GAP-012
        // end-to-end scenario) was removed here. `reactivateFromTrial` no
        // longer cancels the old trial subscription synchronously at all —
        // that responsibility moved to the webhook confirmation path
        // (HOS-114 T-007, spec §6.4/§6.5) — so `reconcileDuplicateSubscriptions`
        // is never triggered from inside `reactivateFromTrial` anymore. The
        // method itself is still fully covered by the tests above.
    });
});
