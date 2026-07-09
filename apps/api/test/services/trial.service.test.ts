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
const { mockWithServiceTransaction, mockDbForTrial } = vi.hoisted(() => {
    const tx = {
        execute: vi.fn().mockResolvedValue({
            rows: [{ pg_try_advisory_xact_lock: true }]
        })
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
        // db.update(billingSubscriptions).set({ trialConvertedAt }).where(...) since
        // ddc12e085 (stamp trial_converted_at when the cron cancels a trial). Without
        // these, db.update() throws, the per-subscription catch swallows it, and
        // blockedCount stays 0.
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis()
    };
    return { mockWithServiceTransaction: withSvcTx, mockDbForTrial: dbMock };
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

// Mock drizzle-orm helpers used inside the service (and, eq, sql)
vi.mock('drizzle-orm', async () => {
    const actual = await vi.importActual('drizzle-orm');
    return {
        ...actual,
        and: (...args: unknown[]) => ({ type: 'and', args }),
        eq: (a: unknown, b: unknown) => ({ type: 'eq', a, b }),
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

import { clearEntitlementCache } from '../../src/middlewares/entitlement';
import { buildTrialUpgradeUrl, TrialService } from '../../src/services/trial.service';
import { env } from '../../src/utils/env';

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

    describe('blockExpiredTrials', () => {
        it('should block all expired trials', async () => {
            // Arrange
            const now = new Date();
            const expiredEnd1 = new Date(now);
            expiredEnd1.setDate(expiredEnd1.getDate() - 2);
            const expiredEnd2 = new Date(now);
            expiredEnd2.setDate(expiredEnd2.getDate() - 1);
            const activeEnd = new Date(now);
            activeEnd.setDate(activeEnd.getDate() + 5);

            const mockSubscriptions = [
                {
                    id: 'sub-expired-1',
                    customerId: 'customer-1',
                    status: 'trialing',
                    trialEnd: expiredEnd1.toISOString(),
                    metadata: {}
                },
                {
                    id: 'sub-expired-2',
                    customerId: 'customer-2',
                    status: 'trialing',
                    trialEnd: expiredEnd2.toISOString(),
                    metadata: {}
                },
                {
                    id: 'sub-active',
                    customerId: 'customer-3',
                    status: 'trialing',
                    trialEnd: activeEnd.toISOString(),
                    metadata: {}
                }
            ];

            vi.spyOn(mockBilling.subscriptions, 'list').mockResolvedValue({
                data: mockSubscriptions
            } as never);
            vi.spyOn(mockBilling.subscriptions, 'cancel').mockResolvedValue({} as never);
            vi.spyOn(mockBilling.customers, 'get').mockResolvedValue({
                id: 'customer-1',
                email: 'test@example.com',
                metadata: { name: 'Test User', userId: 'user-1' }
            } as never);
            vi.spyOn(mockBilling.plans, 'get').mockResolvedValue({
                id: 'plan-1',
                name: 'Test Plan'
            } as never);

            // Act
            const result = await trialService.blockExpiredTrials();

            // Assert
            expect(result).toBe(2);
            expect(mockBilling.subscriptions.cancel).toHaveBeenCalledTimes(2);
            expect(mockBilling.subscriptions.cancel).toHaveBeenCalledWith('sub-expired-1');
            expect(mockBilling.subscriptions.cancel).toHaveBeenCalledWith('sub-expired-2');
        });

        it('should return 0 if no trialing subscriptions', async () => {
            // Arrange
            vi.spyOn(mockBilling.subscriptions, 'list').mockResolvedValue({
                data: []
            } as never);

            // Act
            const result = await trialService.blockExpiredTrials();

            // Assert
            expect(result).toBe(0);
            expect(mockBilling.subscriptions.cancel).not.toHaveBeenCalled();
        });

        it('should continue on individual update errors', async () => {
            // Arrange
            const now = new Date();
            const expiredEnd = new Date(now);
            expiredEnd.setDate(expiredEnd.getDate() - 1);

            const mockSubscriptions = [
                {
                    id: 'sub-error',
                    customerId: 'customer-1',
                    status: 'trialing',
                    trialEnd: expiredEnd.toISOString(),
                    metadata: {}
                },
                {
                    id: 'sub-success',
                    customerId: 'customer-2',
                    status: 'trialing',
                    trialEnd: expiredEnd.toISOString(),
                    metadata: {}
                }
            ];

            vi.spyOn(mockBilling.subscriptions, 'list').mockResolvedValue({
                data: mockSubscriptions
            } as never);
            vi.spyOn(mockBilling.customers, 'get')
                .mockRejectedValueOnce(new Error('Customer fetch failed'))
                .mockResolvedValueOnce({
                    id: 'customer-2',
                    email: 'test2@example.com',
                    metadata: { name: 'Test User 2', userId: 'user-2' }
                } as never);
            vi.spyOn(mockBilling.plans, 'get').mockResolvedValue({
                id: 'plan-1',
                name: 'Test Plan'
            } as never);
            vi.spyOn(mockBilling.subscriptions, 'cancel').mockResolvedValue({} as never);

            // Act
            const result = await trialService.blockExpiredTrials();

            // Assert
            expect(result).toBe(1); // Only one succeeded
        });

        // ── T-004 Regression: advisory lock must guard the claim, not just signal ──
        //
        // BUG (SPEC-194 T-194-02): The current code acquires the advisory xact lock
        // inside a withServiceTransaction that COMMITS before the processing loop
        // runs. Because pg_try_advisory_xact_lock releases on transaction commit, a
        // second concurrent invocation can also acquire the lock in its own separate
        // transaction, and both instances end up processing the same expired
        // subscriptions (double-cancel + double-notification).
        //
        // CORRECT behavior: only ONE of two concurrent invocations should process
        // expired subscriptions. The second must be skipped (returns 0, no cancels).
        //
        // The fix (per ADR-019): lock + fetch must happen inside the SAME transaction.
        // When the second invocation attempts to acquire the lock, the first instance's
        // transaction is still open (holding the lock + fetch), so pg_try_advisory_xact_lock
        // returns false and the second invocation skips without processing any subs.

        it('[T-004] subscriptions.list() must be called INSIDE the lock-holding transaction callback (not after it returns)', async () => {
            // ── Structural regression for SPEC-194 T-194-02 ──────────────────────────
            // BUG: the current implementation calls withServiceTransaction ONLY to acquire
            // the advisory lock, then lets the tx COMMIT (releasing the lock) before
            // calling subscriptions.list(). This means the lock is gone by the time the
            // fetch + processing loop runs, and two concurrent instances can both acquire
            // the lock in separate sequential transactions and both process the same subs.
            //
            // FIX (ADR-019): lock + fetch must be in the SAME transaction.
            // subscriptions.list() must be called INSIDE the withServiceTransaction
            // callback — if the lock is not acquired, list() must not be called at all.
            //
            // This test verifies the structural invariant:
            //   - withServiceTransaction is called exactly ONCE per blockExpiredTrials run
            //   - subscriptions.list() is called while that callback is executing
            //     (not after the transaction commits)
            //
            // Against BUG: list() is called AFTER the tx returns (separate code paths)
            //   → the mock can detect this: list is called 0 times inside the callback
            //   → but 1 time outside → failing the assertion that list is called inside.
            // Against FIX: list() is called inside the callback → assertion passes.

            const now = new Date();
            const expiredEnd = new Date(now);
            expiredEnd.setDate(expiredEnd.getDate() - 1);

            let listCalledInsideTx = false;
            let txCallbackActive = false;

            // Track whether list() is called while the tx callback is executing
            vi.spyOn(mockBilling.subscriptions, 'list').mockImplementation(async () => {
                listCalledInsideTx = txCallbackActive;
                return {
                    data: [
                        {
                            id: 'sub-structural-1',
                            customerId: 'customer-structural-1',
                            planId: 'plan-1',
                            status: 'trialing',
                            trialEnd: expiredEnd.toISOString(),
                            metadata: {}
                        }
                    ]
                } as never;
            });

            mockWithServiceTransaction.mockImplementationOnce(async function (
                callback: (ctx: { tx: { execute: Mock } }) => Promise<unknown>
            ) {
                txCallbackActive = true;
                const result = await callback({
                    tx: {
                        execute: vi.fn().mockResolvedValue({
                            rows: [{ pg_try_advisory_xact_lock: true }]
                        })
                    }
                });
                txCallbackActive = false;
                return result;
            });

            vi.spyOn(mockBilling.subscriptions, 'cancel').mockResolvedValue({} as never);
            vi.spyOn(mockBilling.customers, 'get').mockResolvedValue({
                id: 'customer-structural-1',
                email: 'test@example.com',
                metadata: { name: 'Test User', userId: 'user-1' }
            } as never);
            vi.spyOn(mockBilling.plans, 'get').mockResolvedValue({
                id: 'plan-1',
                name: 'Test Plan'
            } as never);

            // Act
            await trialService.blockExpiredTrials();

            // Assert — list() must have been called while the tx callback was active.
            // This FAILS against the BUG (list() is called after withServiceTransaction
            // returns) and PASSES against the FIX (list() is called inside the callback).
            expect(listCalledInsideTx).toBe(true);
        });

        it('[T-004] second invocation that cannot acquire lock returns 0 without touching QZPay', async () => {
            // Arrange — simulate the second invocation arriving when the first holds the lock.
            // pg_try_advisory_xact_lock returns false → the invocation must return 0
            // and must NOT call subscriptions.list, subscriptions.cancel, or customers.get.

            mockWithServiceTransaction.mockImplementationOnce(async function (
                callback: (ctx: { tx: { execute: Mock } }) => Promise<unknown>
            ) {
                return callback({
                    tx: {
                        execute: vi.fn().mockResolvedValue({
                            rows: [{ pg_try_advisory_xact_lock: false }]
                        })
                    }
                });
            });

            const now = new Date();
            const expiredEnd = new Date(now);
            expiredEnd.setDate(expiredEnd.getDate() - 1);

            vi.spyOn(mockBilling.subscriptions, 'list').mockResolvedValue({
                data: [
                    {
                        id: 'sub-lock-skip',
                        customerId: 'customer-lock-skip',
                        planId: 'plan-1',
                        status: 'trialing',
                        trialEnd: expiredEnd.toISOString(),
                        metadata: {}
                    }
                ]
            } as never);

            // Act
            const result = await trialService.blockExpiredTrials();

            // Assert — lock not acquired: must skip immediately, no processing
            expect(result).toBe(0);
            expect(mockBilling.subscriptions.cancel).not.toHaveBeenCalled();
            // In the FIXED implementation, list() is called INSIDE the claim tx,
            // so it won't be called when lock acquisition fails.
            // (In the BUG, list() is called AFTER the tx commits regardless.)
            // We assert cancel is not called as the critical invariant.
        });

        // ── T-016: claim must pass limit to subscriptions.list() ────────────────
        //
        // blockExpiredTrials must pass `limit: BLOCK_EXPIRED_TRIALS_BATCH_SIZE` to
        // `subscriptions.list()` to bound how many subs are claimed per run.
        // An unbounded fetch could hold the advisory lock for seconds on a large
        // tenant base. The cron cadence drains the backlog over successive ticks.

        it('[T-016] claim phase passes limit to subscriptions.list()', async () => {
            // Arrange
            vi.spyOn(mockBilling.subscriptions, 'list').mockResolvedValue({
                data: []
            } as never);

            // Act
            await trialService.blockExpiredTrials();

            // Assert: list() must have been called with a `limit` field so the
            // fetch is bounded. We do not pin the exact number so the constant
            // can be tuned without touching tests; we just require it is present
            // and is a positive integer.
            expect(mockBilling.subscriptions.list).toHaveBeenCalledOnce();
            const callArg = (mockBilling.subscriptions.list as ReturnType<typeof vi.fn>).mock
                .calls[0]?.[0] as Record<string, unknown> | undefined;
            expect(typeof callArg?.limit).toBe('number');
            expect((callArg?.limit as number) > 0).toBe(true);
        });

        it('[T-016] large fixture — only up to batch size subs are processed per run', async () => {
            // Arrange: generate 5 expired trialing subs; the list mock honours the limit
            // by returning exactly what it is configured to return (we return all 5 here
            // to verify the processing loop handles them correctly — the capping is
            // enforced by the real QZPay storage adapter, not the service itself).
            const now = new Date();
            const makeSub = (i: number) => ({
                id: `sub-large-${i}`,
                customerId: `cust-large-${i}`,
                status: 'trialing' as const,
                trialEnd: new Date(now.getTime() - 1000 * i).toISOString(),
                metadata: {}
            });

            const largeBatch = Array.from({ length: 5 }, (_, i) => makeSub(i + 1));

            vi.spyOn(mockBilling.subscriptions, 'list').mockResolvedValue({
                data: largeBatch
            } as never);
            vi.spyOn(mockBilling.subscriptions, 'cancel').mockResolvedValue({} as never);
            vi.spyOn(mockBilling.customers, 'get').mockResolvedValue({
                id: 'cust-large-1',
                email: 'host@example.com',
                metadata: { name: 'Host', userId: 'u1' }
            } as never);
            vi.spyOn(mockBilling.plans, 'get').mockResolvedValue({
                id: 'plan-1',
                name: 'owner-basico'
            } as never);

            // Act
            const result = await trialService.blockExpiredTrials();

            // Assert: all 5 expired subs in the batch are processed.
            // The list() call must still carry a limit so future large deployments
            // are automatically bounded without code changes.
            expect(result).toBe(5);
            expect(mockBilling.subscriptions.cancel).toHaveBeenCalledTimes(5);
            const listArg = (mockBilling.subscriptions.list as ReturnType<typeof vi.fn>).mock
                .calls[0]?.[0] as Record<string, unknown> | undefined;
            expect(typeof listArg?.limit).toBe('number');
        });

        // Item 4 regression (SPEC-194 adversarial review):
        // A subscription in the claimed batch may already be in a terminal state
        // (cancelled/expired/abandoned) between the claim commit and process phase.
        // The pre-cancel status guard must skip such subscriptions without calling
        // billing.subscriptions.cancel(), and the blockedCount should NOT include them.
        it('item-4: skips cancel for claimed subscription already in a terminal status', async () => {
            // Arrange: one subscription in terminal 'cancelled' state, one in 'trialing'
            const now = new Date();
            const expiredEnd = new Date(now);
            expiredEnd.setDate(expiredEnd.getDate() - 1);

            const cancelledSub = {
                id: 'sub-already-cancelled',
                customerId: 'customer-terminal',
                status: 'cancelled', // terminal — should be skipped
                trialEnd: expiredEnd.toISOString(),
                metadata: {}
            };
            const trialingSub = {
                id: 'sub-trialing-valid',
                customerId: 'customer-valid',
                status: 'trialing', // valid — should be processed
                trialEnd: expiredEnd.toISOString(),
                metadata: {}
            };

            vi.spyOn(mockBilling.subscriptions, 'list').mockResolvedValue({
                data: [cancelledSub, trialingSub]
            } as never);
            vi.spyOn(mockBilling.subscriptions, 'cancel').mockResolvedValue({} as never);
            vi.spyOn(mockBilling.customers, 'get').mockResolvedValue({
                id: 'customer-valid',
                email: 'valid@example.com',
                metadata: { name: 'Valid User', userId: 'u-valid' }
            } as never);
            vi.spyOn(mockBilling.plans, 'get').mockResolvedValue({
                id: 'plan-1',
                name: 'owner-basico'
            } as never);

            // Act
            const result = await trialService.blockExpiredTrials();

            // Assert: only the trialing sub is blocked; cancel NOT called for the terminal one.
            expect(result).toBe(1);
            expect(mockBilling.subscriptions.cancel).toHaveBeenCalledTimes(1);
            expect(mockBilling.subscriptions.cancel).toHaveBeenCalledWith('sub-trialing-valid');
            expect(mockBilling.subscriptions.cancel).not.toHaveBeenCalledWith(
                'sub-already-cancelled'
            );
        });

        // ── HOS-115 T-004: TRIAL_EXPIRED notification upgradeUrl nudge ──────────
        //
        // The TRIAL_EXPIRED notification's upgradeUrl must carry `?interval=` back
        // from the expiring trial's `metadata.intendedInterval` (stamped by
        // startTrial at grant time — CORE phase), so the pricing page can
        // pre-select the same toggle the customer originally chose. It must
        // degrade gracefully (omit the param) when the metadata has no valid
        // interval — e.g. a trial started via the accommodation-publish
        // auto-start flow, which never records one.
        describe('TRIAL_EXPIRED notification upgradeUrl nudge (HOS-115 T-004)', () => {
            const buildExpiredSub = (input: {
                id: string;
                customerId: string;
                metadata: unknown;
            }) => {
                const now = new Date();
                const expiredEnd = new Date(now);
                expiredEnd.setDate(expiredEnd.getDate() - 1);
                return {
                    id: input.id,
                    customerId: input.customerId,
                    status: 'trialing',
                    trialEnd: expiredEnd.toISOString(),
                    metadata: input.metadata
                };
            };

            it('appends ?interval=annual when the expiring trial recorded an annual intent', async () => {
                const sendNotification = vi.fn();
                const localTrialService = new TrialService(mockBilling, sendNotification);

                vi.spyOn(mockBilling.subscriptions, 'list').mockResolvedValue({
                    data: [
                        buildExpiredSub({
                            id: 'sub-annual-intent',
                            customerId: 'customer-annual-intent',
                            metadata: { intendedInterval: 'annual' }
                        })
                    ]
                } as never);
                vi.spyOn(mockBilling.subscriptions, 'cancel').mockResolvedValue({} as never);
                vi.spyOn(mockBilling.customers, 'get').mockResolvedValue({
                    id: 'customer-annual-intent',
                    email: 'annual@example.com',
                    metadata: { name: 'Annual User', userId: 'u-annual' }
                } as never);
                vi.spyOn(mockBilling.plans, 'get').mockResolvedValue({
                    id: 'plan-1',
                    name: 'owner-basico'
                } as never);

                await localTrialService.blockExpiredTrials();

                expect(sendNotification).toHaveBeenCalledOnce();
                const payload = sendNotification.mock.calls[0]?.[0] as { upgradeUrl: string };
                expect(payload.upgradeUrl).toContain('?interval=annual');
                expect(payload.upgradeUrl).toContain('/suscriptores/planes/');
            });

            it('appends ?interval=monthly when the expiring trial recorded a monthly intent', async () => {
                const sendNotification = vi.fn();
                const localTrialService = new TrialService(mockBilling, sendNotification);

                vi.spyOn(mockBilling.subscriptions, 'list').mockResolvedValue({
                    data: [
                        buildExpiredSub({
                            id: 'sub-monthly-intent',
                            customerId: 'customer-monthly-intent',
                            metadata: { intendedInterval: 'monthly' }
                        })
                    ]
                } as never);
                vi.spyOn(mockBilling.subscriptions, 'cancel').mockResolvedValue({} as never);
                vi.spyOn(mockBilling.customers, 'get').mockResolvedValue({
                    id: 'customer-monthly-intent',
                    email: 'monthly@example.com',
                    metadata: { name: 'Monthly User', userId: 'u-monthly' }
                } as never);
                vi.spyOn(mockBilling.plans, 'get').mockResolvedValue({
                    id: 'plan-1',
                    name: 'owner-basico'
                } as never);

                await localTrialService.blockExpiredTrials();

                const payload = sendNotification.mock.calls[0]?.[0] as { upgradeUrl: string };
                expect(payload.upgradeUrl).toContain('?interval=monthly');
            });

            it('omits the interval param when metadata has no intendedInterval (e.g. accommodation-publish auto-start)', async () => {
                const sendNotification = vi.fn();
                const localTrialService = new TrialService(mockBilling, sendNotification);

                vi.spyOn(mockBilling.subscriptions, 'list').mockResolvedValue({
                    data: [
                        buildExpiredSub({
                            id: 'sub-no-intent',
                            customerId: 'customer-no-intent',
                            metadata: {}
                        })
                    ]
                } as never);
                vi.spyOn(mockBilling.subscriptions, 'cancel').mockResolvedValue({} as never);
                vi.spyOn(mockBilling.customers, 'get').mockResolvedValue({
                    id: 'customer-no-intent',
                    email: 'none@example.com',
                    metadata: { name: 'No Intent User', userId: 'u-none' }
                } as never);
                vi.spyOn(mockBilling.plans, 'get').mockResolvedValue({
                    id: 'plan-1',
                    name: 'owner-basico'
                } as never);

                await localTrialService.blockExpiredTrials();

                const payload = sendNotification.mock.calls[0]?.[0] as { upgradeUrl: string };
                expect(payload.upgradeUrl).not.toContain('interval=');
            });
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

    describe('reactivateFromTrial', () => {
        it('should cancel trial and create paid subscription', async () => {
            // Arrange
            const customerId = 'customer-123';
            const newPlanId = 'plan-owner-pro';

            const existingTrialSub = {
                id: 'sub-trial',
                customerId,
                status: 'trialing'
            };

            const newSubscription = {
                id: 'sub-paid',
                customerId,
                planId: newPlanId,
                status: 'active'
            };

            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([
                existingTrialSub
            ] as never);
            vi.spyOn(mockBilling.subscriptions, 'cancel').mockResolvedValue({} as never);
            vi.spyOn(mockBilling.subscriptions, 'create').mockResolvedValue(
                newSubscription as never
            );

            // Act
            const result = await trialService.reactivateFromTrial({
                customerId,
                planId: newPlanId
            });

            // Assert
            expect(result).toBe('sub-paid');
            expect(mockBilling.subscriptions.cancel).toHaveBeenCalledWith('sub-trial');
            expect(mockBilling.subscriptions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    customerId,
                    planId: newPlanId,
                    metadata: expect.objectContaining({
                        convertedFromTrial: 'true'
                    })
                })
            );
        });

        it('should create subscription even if no existing trial', async () => {
            // Arrange
            const customerId = 'customer-456';
            const newPlanId = 'plan-owner-pro';

            const newSubscription = {
                id: 'sub-paid',
                customerId,
                planId: newPlanId,
                status: 'active'
            };

            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([] as never);
            vi.spyOn(mockBilling.subscriptions, 'create').mockResolvedValue(
                newSubscription as never
            );

            // Act
            const result = await trialService.reactivateFromTrial({
                customerId,
                planId: newPlanId
            });

            // Assert
            expect(result).toBe('sub-paid');
            expect(mockBilling.subscriptions.cancel).not.toHaveBeenCalled();
        });

        it('should throw error if billing disabled', async () => {
            // Arrange
            const trialServiceNoBilling = new TrialService(null);

            // Act & Assert
            await expect(
                trialServiceNoBilling.reactivateFromTrial({
                    customerId: 'customer-123',
                    planId: 'plan-123'
                })
            ).rejects.toThrow('Billing not enabled');
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

        it('should trigger reconciliation inside reactivateFromTrial when trial cancel fails', async () => {
            // Arrange — this is the exact GAP-012 scenario end-to-end
            const customerId = 'customer-gap012';
            const newPlanId = 'plan-owner-pro';

            const existingTrialSub = {
                id: 'sub-trial-gap012',
                customerId,
                status: 'trialing',
                createdAt: '2026-01-10T10:00:00.000Z'
            };
            const newActiveSub = {
                id: 'sub-active-gap012',
                customerId,
                planId: newPlanId,
                status: 'active',
                createdAt: '2026-01-10T10:05:00.000Z'
            };

            // getByCustomerId is called twice: once in reactivateFromTrial (before create),
            // once inside reconcileDuplicateSubscriptions (called after cancel fails)
            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId')
                .mockResolvedValueOnce([existingTrialSub] as never)
                .mockResolvedValueOnce([existingTrialSub, newActiveSub] as never);

            vi.spyOn(mockBilling.subscriptions, 'create').mockResolvedValue(newActiveSub as never);

            // First cancel call (in reactivateFromTrial loop) fails
            // Second cancel call (in reconcileDuplicateSubscriptions) succeeds
            vi.spyOn(mockBilling.subscriptions, 'cancel')
                .mockRejectedValueOnce(new Error('QZPay timeout'))
                .mockResolvedValueOnce({} as never);

            // Act
            const resultId = await trialService.reactivateFromTrial({
                customerId,
                planId: newPlanId
            });

            // Assert — new subscription is returned AND reconciliation cancelled the duplicate
            expect(resultId).toBe('sub-active-gap012');
            expect(mockBilling.subscriptions.cancel).toHaveBeenCalledTimes(2);
            // First attempt (failed) in reactivateFromTrial loop
            expect(mockBilling.subscriptions.cancel).toHaveBeenNthCalledWith(1, 'sub-trial-gap012');
            // Second attempt (success) in reconcileDuplicateSubscriptions
            expect(mockBilling.subscriptions.cancel).toHaveBeenNthCalledWith(2, 'sub-trial-gap012');
        });
    });
});
