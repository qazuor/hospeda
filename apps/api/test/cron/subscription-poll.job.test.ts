/**
 * Subscription Poll Cron Job Tests
 *
 * Tests the SPEC-143 Finding #17 polling fallback cron. The job runs every
 * minute and queries MercadoPago for in-flight subscription preapprovals
 * whose webhooks may have been dropped. These tests exercise the batch
 * loop, feature flag gate, advisory-lock behavior, and per-job decision
 * tree against fully mocked storage + adapter + transition function.
 *
 * Mocking strategy: mock at the smallest possible boundary so the
 * behavior under test is the cron's own orchestration logic, not the
 * downstream provider/storage internals.
 *
 * - `@repo/db`: only `sql` and `withTransaction` are touched; mocked to
 *   short-circuit the advisory lock (acquired=true by default) and
 *   forward through to the inner callback.
 * - `@repo/billing`: `createMercadoPagoAdapter` returns a stub adapter
 *   whose `subscriptions.retrieve` is per-test programmable.
 * - `getQZPayBilling`: returns a stub billing instance whose `getStorage`
 *   exposes a per-test programmable polling-jobs storage.
 * - `processSubscriptionUpdated`: mocked to surface a controllable
 *   transition result without running the real webhook handler.
 *
 * @module test/cron/subscription-poll.job
 */

import type { QZPaySubscriptionPollingJob } from '@qazuor/qzpay-core';
import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types.js';

// ---------- Mocks (must come before importing the job) ----------

vi.mock('../../src/utils/env.js', () => ({
    env: {
        HOSPEDA_BILLING_POLLING_ENABLED: true
    }
}));

vi.mock('../../src/lib/qzpay-logger.js', () => ({
    qzpayLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

const mockRetrieve = vi.fn();
const mockSearch = vi.fn();
const mockCreateMercadoPagoAdapter = vi.fn((..._args: unknown[]) => ({
    subscriptions: { retrieve: mockRetrieve },
    payments: { search: mockSearch }
}));

vi.mock('@repo/billing', () => ({
    createMercadoPagoAdapter: (...args: unknown[]) => mockCreateMercadoPagoAdapter(...args)
}));

const mockExecute = vi.fn();
vi.mock('@repo/db', () => ({
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
    withTransaction: async <T>(fn: (tx: { execute: Mock }) => Promise<T>): Promise<T> => {
        return fn({ execute: mockExecute });
    }
}));

const mockFindDuePending = vi.fn();
const mockStorageUpdate = vi.fn();
const mockFindActiveBySubscriptionId = vi.fn();
const mockGetStorage = vi.fn(() => ({
    subscriptionPollingJobs: {
        findDuePending: mockFindDuePending,
        update: mockStorageUpdate,
        findActiveBySubscriptionId: mockFindActiveBySubscriptionId,
        findById: vi.fn(),
        create: vi.fn()
    }
}));
const mockGetBilling = vi.fn(() => ({
    getStorage: mockGetStorage
}));

vi.mock('../../src/middlewares/billing.js', () => ({
    getQZPayBilling: () => mockGetBilling()
}));

const mockProcessSubscriptionUpdated = vi.fn();
vi.mock('../../src/routes/webhooks/mercadopago/subscription-logic.js', () => ({
    processSubscriptionUpdated: (...args: unknown[]) => mockProcessSubscriptionUpdated(...args)
}));

const mockConfirmAnnualSubscription = vi.fn();
const mockProcessPaymentUpdated = vi.fn();
vi.mock('../../src/routes/webhooks/mercadopago/payment-logic.js', () => ({
    confirmAnnualSubscription: (...args: unknown[]) => mockConfirmAnnualSubscription(...args),
    processPaymentUpdated: (...args: unknown[]) => mockProcessPaymentUpdated(...args)
}));

// ---------- Imports under test (after mocks) ----------

const { subscriptionPollJob } = await import('../../src/cron/jobs/subscription-poll.job.js');

// ---------- Helpers ----------

function buildJob(
    overrides: Partial<QZPaySubscriptionPollingJob> = {}
): QZPaySubscriptionPollingJob {
    const now = new Date();
    return {
        id: '00000000-0000-0000-0000-000000000001',
        subscriptionId: '11111111-1111-1111-1111-111111111111',
        provider: 'mercadopago',
        providerResourceId: 'preapproval_test',
        resourceType: 'subscription',
        status: 'pending',
        attempts: 0,
        maxAttempts: 60,
        nextPollAt: now,
        lastPolledAt: null,
        lastProviderStatus: null,
        lastError: null,
        metadata: {},
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        version: 'version-1',
        ...overrides
    };
}

function buildContext(overrides: Partial<CronJobContext> = {}): CronJobContext {
    return {
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        startedAt: new Date('2026-05-23T00:00:00Z'),
        dryRun: false,
        ...overrides
    };
}

function advisoryLockAcquired(acquired: boolean): void {
    mockExecute.mockResolvedValue({ rows: [{ acquired }] });
}

// ---------- Tests ----------

describe('subscription-poll cron job', () => {
    beforeEach(() => {
        advisoryLockAcquired(true);
        mockFindDuePending.mockResolvedValue([]);
        mockStorageUpdate.mockImplementation(async (input) => ({
            ...buildJob(),
            ...input
        }));
        mockRetrieve.mockResolvedValue({ id: 'preapproval_test', status: 'active' });
        mockProcessSubscriptionUpdated.mockResolvedValue({
            success: true,
            statusChanged: true,
            newStatus: 'active'
        });
        // Default: addon confirmation succeeds. Tests that do NOT exercise the
        // addon path do not set this, so the mock stays safe but uncalled.
        mockProcessPaymentUpdated.mockResolvedValue({ success: true, addonConfirmed: true });
        mockConfirmAnnualSubscription.mockResolvedValue({ confirmed: true });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Job configuration', () => {
        it('exposes the expected name, schedule, and enabled flag', () => {
            expect(subscriptionPollJob.name).toBe('subscription-poll');
            expect(subscriptionPollJob.schedule).toBe('* * * * *');
            expect(subscriptionPollJob.enabled).toBe(true);
            expect(subscriptionPollJob.timeoutMs).toBeLessThanOrEqual(60_000);
        });
    });

    describe('Feature flag', () => {
        it('skips immediately when HOSPEDA_BILLING_POLLING_ENABLED is false', async () => {
            const envModule = await import('../../src/utils/env.js');
            (
                envModule.env as { HOSPEDA_BILLING_POLLING_ENABLED: boolean }
            ).HOSPEDA_BILLING_POLLING_ENABLED = false;

            const result = await subscriptionPollJob.handler(buildContext());

            expect(result.success).toBe(true);
            expect(result.message).toBe('subscription_polling_disabled_by_flag');
            expect(result.processed).toBe(0);
            expect(mockFindDuePending).not.toHaveBeenCalled();

            // Reset for following tests
            (
                envModule.env as { HOSPEDA_BILLING_POLLING_ENABLED: boolean }
            ).HOSPEDA_BILLING_POLLING_ENABLED = true;
        });
    });

    describe('Pre-flight checks', () => {
        it('exits cleanly when billing is not configured', async () => {
            mockGetBilling.mockReturnValueOnce(
                null as unknown as ReturnType<typeof mockGetBilling>
            );

            const result = await subscriptionPollJob.handler(buildContext());

            expect(result.message).toBe('billing_not_configured');
            expect(result.processed).toBe(0);
        });

        it('exits cleanly when the storage adapter does not expose polling jobs', async () => {
            mockGetStorage.mockReturnValueOnce({
                subscriptionPollingJobs: undefined
            } as unknown as ReturnType<typeof mockGetStorage>);

            const result = await subscriptionPollJob.handler(buildContext());

            expect(result.message).toBe('polling_storage_unavailable');
        });

        it('exits cleanly when MercadoPago adapter cannot be constructed', async () => {
            mockCreateMercadoPagoAdapter.mockImplementationOnce(() => {
                throw new Error('MP creds missing');
            });

            const result = await subscriptionPollJob.handler(buildContext());

            expect(result.message).toBe('mp_adapter_unavailable');
        });
    });

    describe('Advisory lock', () => {
        it('skips the batch when the advisory lock is held by another worker', async () => {
            advisoryLockAcquired(false);
            mockFindDuePending.mockResolvedValue([buildJob()]);

            const result = await subscriptionPollJob.handler(buildContext());

            expect(result.message).toBe('lock_not_acquired');
            expect(result.processed).toBe(0);
            expect(mockFindDuePending).not.toHaveBeenCalled();
        });
    });

    describe('Batch processing', () => {
        it('returns 0 processed when no due jobs are found', async () => {
            mockFindDuePending.mockResolvedValue([]);

            const result = await subscriptionPollJob.handler(buildContext());

            expect(result.processed).toBe(0);
            expect(result.errors).toBe(0);
            expect(result.success).toBe(true);
        });

        it('skips real work in dryRun mode', async () => {
            mockFindDuePending.mockResolvedValue([buildJob()]);

            const result = await subscriptionPollJob.handler(buildContext({ dryRun: true }));

            expect(result.processed).toBe(1);
            expect(mockProcessSubscriptionUpdated).not.toHaveBeenCalled();
            expect(mockStorageUpdate).not.toHaveBeenCalled();
        });

        it('transitions a pending job to succeeded when MP returns active', async () => {
            const job = buildJob({ id: 'job-1' });
            mockFindDuePending.mockResolvedValue([job]);
            mockProcessSubscriptionUpdated.mockResolvedValueOnce({
                success: true,
                statusChanged: true,
                newStatus: 'active'
            });

            const result = await subscriptionPollJob.handler(buildContext());

            expect(result.processed).toBe(1);
            expect(result.errors).toBe(0);
            expect(mockProcessSubscriptionUpdated).toHaveBeenCalledTimes(1);
            // First update is the optimistic lock (lastPolledAt + attempts++).
            // Second update is the terminal transition to succeeded.
            const terminalUpdate = mockStorageUpdate.mock.calls.find(
                (call) => (call[0] as { status?: string }).status === 'succeeded'
            );
            expect(terminalUpdate).toBeDefined();
            expect(terminalUpdate?.[0]).toMatchObject({
                status: 'succeeded',
                completedAt: expect.any(Date)
            });
        });

        it('keeps the job pending and schedules next poll when MP is still pending', async () => {
            const job = buildJob({ id: 'job-2' });
            mockFindDuePending.mockResolvedValue([job]);
            mockRetrieve.mockResolvedValueOnce({ id: 'preapproval_test', status: 'pending' });
            mockProcessSubscriptionUpdated.mockResolvedValueOnce({
                success: true,
                statusChanged: false
            });

            await subscriptionPollJob.handler(buildContext());

            // No terminal update should have fired. Only the lock + reschedule.
            const terminalUpdates = mockStorageUpdate.mock.calls.filter((call) => {
                const status = (call[0] as { status?: string }).status;
                return status === 'succeeded' || status === 'failed' || status === 'timeout';
            });
            expect(terminalUpdates).toHaveLength(0);

            // Reschedule should be present (nextPollAt in the future).
            const reschedule = mockStorageUpdate.mock.calls.find((call) => {
                return (call[0] as { nextPollAt?: Date }).nextPollAt !== undefined;
            });
            expect(reschedule).toBeDefined();
        });

        it('marks the job timeout when attempts exceed maxAttempts', async () => {
            const job = buildJob({
                id: 'job-3',
                attempts: 60,
                maxAttempts: 60
            });
            mockFindDuePending.mockResolvedValue([job]);
            // Lock returns the job with incremented attempts (61 > 60)
            mockStorageUpdate.mockImplementationOnce(async (input) => ({
                ...job,
                ...input,
                attempts: 61,
                version: 'version-2'
            }));

            const result = await subscriptionPollJob.handler(buildContext());

            expect(result.processed).toBe(1);
            // processSubscriptionUpdated must NOT be called when timed out
            expect(mockProcessSubscriptionUpdated).not.toHaveBeenCalled();
            const timeoutUpdate = mockStorageUpdate.mock.calls.find(
                (call) => (call[0] as { status?: string }).status === 'timeout'
            );
            expect(timeoutUpdate).toBeDefined();
        });

        it('continues batch processing when one job throws', async () => {
            const failingJob = buildJob({ id: 'fail', providerResourceId: 'fail_res' });
            const okJob = buildJob({
                id: 'ok',
                subscriptionId: '22222222-2222-2222-2222-222222222222',
                providerResourceId: 'ok_res'
            });
            mockFindDuePending.mockResolvedValue([failingJob, okJob]);

            // First processSubscriptionUpdated throws; second succeeds.
            mockProcessSubscriptionUpdated
                .mockRejectedValueOnce(new Error('MP timeout'))
                .mockResolvedValueOnce({
                    success: true,
                    statusChanged: true,
                    newStatus: 'active'
                });

            const result = await subscriptionPollJob.handler(buildContext());

            expect(result.processed).toBe(2);
            expect(result.errors).toBe(1);
            expect(result.success).toBe(false);
        });

        it('silently exits when optimistic lock fails (concurrent worker won)', async () => {
            const job = buildJob({ id: 'race' });
            mockFindDuePending.mockResolvedValue([job]);
            // The first update (lock) returns null = lost race.
            mockStorageUpdate.mockResolvedValueOnce(null);

            const result = await subscriptionPollJob.handler(buildContext());

            expect(result.processed).toBe(0);
            // processSubscriptionUpdated must NOT have been called for this job.
            expect(mockProcessSubscriptionUpdated).not.toHaveBeenCalled();
        });
    });

    describe('One-time payment polling (SPEC-143 Finding #21)', () => {
        // Annual flow polls preference_id → payment search → confirm
        // via the idempotent payment-logic helper. None of these should
        // call processSubscriptionUpdated (that's the preapproval path).

        // Helper: when storage.update is called as the optimistic lock, it
        // must return a "locked" snapshot of the job — including the
        // resourceType + providerResourceId set on the test fixture. The
        // outer beforeEach mock uses buildJob() (default values), so each
        // test in this describe block installs its own mock that preserves
        // the fixture identity.
        function lockWithJob(job: QZPaySubscriptionPollingJob): void {
            mockStorageUpdate.mockImplementation(async (input) => ({ ...job, ...input }));
        }

        it('transitions a one_time_payment job to succeeded when a payment is approved', async () => {
            const job = buildJob({
                id: 'otp-job-1',
                resourceType: 'one_time_payment',
                providerResourceId: 'cs_annual_xyz'
            });
            mockFindDuePending.mockResolvedValue([job]);
            lockWithJob(job);
            mockSearch.mockResolvedValueOnce([
                {
                    id: '999000111',
                    status: 'succeeded',
                    amount: 25000, // cents
                    currency: 'ARS',
                    metadata: { annualSubscriptionId: job.subscriptionId }
                }
            ]);
            mockConfirmAnnualSubscription.mockResolvedValueOnce({ confirmed: true });

            const result = await subscriptionPollJob.handler(buildContext());

            expect(result.processed).toBe(1);
            expect(result.errors).toBe(0);
            // Searched by externalReference (the local checkout session id).
            expect(mockSearch).toHaveBeenCalledWith({ externalReference: 'cs_annual_xyz' });
            // Annual confirm called with major-unit amount + payment metadata.
            expect(mockConfirmAnnualSubscription).toHaveBeenCalledWith(
                expect.objectContaining({
                    annualSubscriptionId: job.subscriptionId,
                    providerPaymentId: '999000111',
                    amount: 250, // 25000 cents / 100 = 250 ARS
                    currency: 'ARS',
                    source: 'polling'
                })
            );
            // Should NOT have called the preapproval path.
            expect(mockProcessSubscriptionUpdated).not.toHaveBeenCalled();
            // Terminal succeeded update should be present.
            const terminalUpdate = mockStorageUpdate.mock.calls.find(
                (call) => (call[0] as { status?: string }).status === 'succeeded'
            );
            expect(terminalUpdate).toBeDefined();
        });

        it('keeps polling when no payment exists yet (user still on checkout page)', async () => {
            const job = buildJob({
                id: 'otp-job-2',
                resourceType: 'one_time_payment',
                providerResourceId: 'cs_pending'
            });
            mockFindDuePending.mockResolvedValue([job]);
            lockWithJob(job);
            mockSearch.mockResolvedValueOnce([]);

            const result = await subscriptionPollJob.handler(buildContext());

            expect(result.processed).toBe(1);
            expect(mockConfirmAnnualSubscription).not.toHaveBeenCalled();
            const terminalUpdates = mockStorageUpdate.mock.calls.filter((call) => {
                const status = (call[0] as { status?: string }).status;
                return status === 'succeeded' || status === 'failed' || status === 'cancelled';
            });
            expect(terminalUpdates).toHaveLength(0);
            // Reschedule fired.
            const reschedule = mockStorageUpdate.mock.calls.find((call) => {
                return (call[0] as { nextPollAt?: Date }).nextPollAt !== undefined;
            });
            expect(reschedule).toBeDefined();
        });

        it('marks the job failed when the only matching payment was rejected', async () => {
            const job = buildJob({
                id: 'otp-job-3',
                resourceType: 'one_time_payment',
                providerResourceId: 'cs_rejected'
            });
            mockFindDuePending.mockResolvedValue([job]);
            lockWithJob(job);
            mockSearch.mockResolvedValueOnce([
                { id: '111', status: 'failed', amount: 1000, currency: 'ARS' }
            ]);

            await subscriptionPollJob.handler(buildContext());

            expect(mockConfirmAnnualSubscription).not.toHaveBeenCalled();
            const terminalUpdate = mockStorageUpdate.mock.calls.find(
                (call) => (call[0] as { status?: string }).status === 'failed'
            );
            expect(terminalUpdate).toBeDefined();
        });

        it('picks the succeeded payment when multiple exist (retry-card case)', async () => {
            const job = buildJob({
                id: 'otp-job-4',
                resourceType: 'one_time_payment',
                providerResourceId: 'cs_retry'
            });
            mockFindDuePending.mockResolvedValue([job]);
            lockWithJob(job);
            // Adapter returns most-recent first; succeeded is the second.
            mockSearch.mockResolvedValueOnce([
                { id: '999', status: 'failed', amount: 1000, currency: 'ARS' },
                {
                    id: '888',
                    status: 'succeeded',
                    amount: 1000,
                    currency: 'ARS',
                    metadata: { annualSubscriptionId: job.subscriptionId }
                }
            ]);
            mockConfirmAnnualSubscription.mockResolvedValueOnce({ confirmed: true });

            await subscriptionPollJob.handler(buildContext());

            expect(mockConfirmAnnualSubscription).toHaveBeenCalledWith(
                expect.objectContaining({ providerPaymentId: '888' })
            );
        });

        it('falls back to job.subscriptionId when payment metadata lacks annualSubscriptionId', async () => {
            const job = buildJob({
                id: 'otp-job-5',
                resourceType: 'one_time_payment',
                providerResourceId: 'cs_no_meta'
            });
            mockFindDuePending.mockResolvedValue([job]);
            lockWithJob(job);
            mockSearch.mockResolvedValueOnce([
                {
                    id: '500',
                    status: 'succeeded',
                    amount: 1000,
                    currency: 'ARS',
                    // metadata omitted entirely on this payment
                    metadata: undefined
                }
            ]);

            await subscriptionPollJob.handler(buildContext());

            expect(mockConfirmAnnualSubscription).toHaveBeenCalledWith(
                expect.objectContaining({ annualSubscriptionId: job.subscriptionId })
            );
        });
    });

    describe('Addon purchase dispatch (SPEC-127 T-011)', () => {
        // The job discriminator is locked.metadata.type === 'addon_purchase'.
        // Succeeded payments for these jobs go through processPaymentUpdated
        // (not confirmAnnualSubscription) to reuse the webhook's idempotency
        // and notification path.

        function lockWithJob(job: QZPaySubscriptionPollingJob): void {
            mockStorageUpdate.mockImplementation(async (input) => ({ ...job, ...input }));
        }

        it('addon job + succeeded payment → processPaymentUpdated called with synthetic payload, returns terminal succeeded', async () => {
            const job = buildJob({
                id: 'addon-job-1',
                resourceType: 'one_time_payment',
                providerResourceId: 'cs_addon_uuid',
                metadata: {
                    type: 'addon_purchase',
                    addonSlug: 'extra-photos',
                    customerId: 'cust_aaa',
                    userId: 'user_bbb',
                    orderId: 'addon_extra-photos_cs_addon_uuid'
                }
            });
            mockFindDuePending.mockResolvedValue([job]);
            lockWithJob(job);
            mockSearch.mockResolvedValueOnce([
                {
                    id: 'mp_pay_123',
                    status: 'succeeded',
                    amount: 150000, // 1500 ARS in cents
                    currency: 'ARS',
                    metadata: {
                        addonSlug: 'extra-photos',
                        customerId: 'cust_aaa',
                        userId: 'user_bbb',
                        type: 'addon_purchase',
                        order_id: 'addon_extra-photos_cs_addon_uuid'
                    }
                }
            ]);

            const result = await subscriptionPollJob.handler(buildContext());

            expect(result.processed).toBe(1);
            expect(result.errors).toBe(0);

            // Must NOT call the annual subscription path.
            expect(mockConfirmAnnualSubscription).not.toHaveBeenCalled();

            // Must call processPaymentUpdated with synthetic payload.
            expect(mockProcessPaymentUpdated).toHaveBeenCalledTimes(1);
            const [callArg] = mockProcessPaymentUpdated.mock.calls[0] as [
                { data: Record<string, unknown>; billing: unknown; source: string }
            ];
            expect(callArg.source).toBe('polling');
            // id = MP payment id
            expect(callArg.data.id).toBe('mp_pay_123');
            // status must be 'approved' (MP canonical for succeeded)
            expect(callArg.data.status).toBe('approved');
            // transaction_amount in major units (150000 cents / 100 = 1500)
            expect(callArg.data.transaction_amount).toBe(1500);
            expect(callArg.data.currency_id).toBe('ARS');
            // metadata must carry addonSlug + customerId for processPaymentUpdated
            const meta = callArg.data.metadata as Record<string, unknown>;
            expect(meta.addonSlug).toBe('extra-photos');
            expect(meta.customerId).toBe('cust_aaa');
            // external_reference = checkout session UUID from job
            expect(callArg.data.external_reference).toBe('cs_addon_uuid');

            // Terminal succeeded update must be present.
            const terminalUpdate = mockStorageUpdate.mock.calls.find(
                (call) => (call[0] as { status?: string }).status === 'succeeded'
            );
            expect(terminalUpdate).toBeDefined();
        });

        it('annual job (no addon discriminator) + succeeded payment → confirmAnnualSubscription called, NOT processPaymentUpdated', async () => {
            const job = buildJob({
                id: 'annual-job-6',
                resourceType: 'one_time_payment',
                providerResourceId: 'cs_annual_abc',
                // metadata has no 'type' key — annual flow
                metadata: {}
            });
            mockFindDuePending.mockResolvedValue([job]);
            lockWithJob(job);
            mockSearch.mockResolvedValueOnce([
                {
                    id: 'mp_annual_999',
                    status: 'succeeded',
                    amount: 50000,
                    currency: 'ARS',
                    metadata: { annualSubscriptionId: job.subscriptionId }
                }
            ]);

            await subscriptionPollJob.handler(buildContext());

            expect(mockConfirmAnnualSubscription).toHaveBeenCalledTimes(1);
            expect(mockProcessPaymentUpdated).not.toHaveBeenCalled();
            const terminalUpdate = mockStorageUpdate.mock.calls.find(
                (call) => (call[0] as { status?: string }).status === 'succeeded'
            );
            expect(terminalUpdate).toBeDefined();
        });

        it('addon job + failed payment → terminal failure, processPaymentUpdated NOT called', async () => {
            const job = buildJob({
                id: 'addon-job-2',
                resourceType: 'one_time_payment',
                providerResourceId: 'cs_addon_fail',
                metadata: {
                    type: 'addon_purchase',
                    addonSlug: 'extra-photos',
                    customerId: 'cust_ccc',
                    userId: 'user_ddd',
                    orderId: 'addon_extra-photos_cs_addon_fail'
                }
            });
            mockFindDuePending.mockResolvedValue([job]);
            lockWithJob(job);
            mockSearch.mockResolvedValueOnce([
                { id: 'mp_fail_777', status: 'failed', amount: 150000, currency: 'ARS' }
            ]);

            const result = await subscriptionPollJob.handler(buildContext());

            expect(result.processed).toBe(1);
            expect(result.errors).toBe(0);
            expect(mockProcessPaymentUpdated).not.toHaveBeenCalled();
            expect(mockConfirmAnnualSubscription).not.toHaveBeenCalled();
            const terminalUpdate = mockStorageUpdate.mock.calls.find(
                (call) => (call[0] as { status?: string }).status === 'failed'
            );
            expect(terminalUpdate).toBeDefined();
        });

        it('addon job + no payment matches → non-terminal, keep polling, no confirmation called', async () => {
            const job = buildJob({
                id: 'addon-job-3',
                resourceType: 'one_time_payment',
                providerResourceId: 'cs_addon_nomatches',
                metadata: {
                    type: 'addon_purchase',
                    addonSlug: 'extra-photos',
                    customerId: 'cust_eee',
                    userId: 'user_fff',
                    orderId: 'addon_extra-photos_cs_addon_nomatches'
                }
            });
            mockFindDuePending.mockResolvedValue([job]);
            lockWithJob(job);
            // No matches yet — user still on the checkout page.
            mockSearch.mockResolvedValueOnce([]);

            const result = await subscriptionPollJob.handler(buildContext());

            expect(result.processed).toBe(1);
            expect(result.errors).toBe(0);
            expect(mockProcessPaymentUpdated).not.toHaveBeenCalled();
            expect(mockConfirmAnnualSubscription).not.toHaveBeenCalled();

            // No terminal update.
            const terminalUpdates = mockStorageUpdate.mock.calls.filter((call) => {
                const status = (call[0] as { status?: string }).status;
                return status === 'succeeded' || status === 'failed' || status === 'cancelled';
            });
            expect(terminalUpdates).toHaveLength(0);

            // Reschedule fired (nextPollAt bumped).
            const reschedule = mockStorageUpdate.mock.calls.find((call) => {
                return (call[0] as { nextPollAt?: Date }).nextPollAt !== undefined;
            });
            expect(reschedule).toBeDefined();
        });

        it('addon job whose payment metadata carries annualSubscriptionId → addon path confirmed, annualSubscriptionId absent from synthetic payload', async () => {
            // Regression guard for the whitelist fix: if a payment's metadata ever
            // carries a dispatch-discriminator key (annualSubscriptionId), the addon
            // path must still be taken and the key must NOT leak into the synthetic
            // payload forwarded to processPaymentUpdated.
            const job = buildJob({
                id: 'addon-job-5',
                resourceType: 'one_time_payment',
                providerResourceId: 'cs_addon_discriminator',
                metadata: {
                    type: 'addon_purchase',
                    addonSlug: 'extra-photos',
                    customerId: 'cust_iii',
                    userId: 'user_jjj',
                    orderId: 'addon_extra-photos_cs_addon_discriminator'
                }
            });
            mockFindDuePending.mockResolvedValue([job]);
            lockWithJob(job);
            mockSearch.mockResolvedValueOnce([
                {
                    id: 'mp_pay_disc',
                    status: 'succeeded',
                    amount: 150000,
                    currency: 'ARS',
                    // Malicious/erroneous: payment metadata contains a discriminator key
                    // that would route to the annual subscription branch if not whitelisted.
                    metadata: {
                        addonSlug: 'extra-photos',
                        customerId: 'cust_iii',
                        userId: 'user_jjj',
                        type: 'addon_purchase',
                        order_id: 'addon_extra-photos_cs_addon_discriminator',
                        annualSubscriptionId: 'should-never-appear-in-synthetic-payload'
                    }
                }
            ]);

            await subscriptionPollJob.handler(buildContext());

            // The addon path (processPaymentUpdated) must be called, not the annual path.
            expect(mockProcessPaymentUpdated).toHaveBeenCalledTimes(1);
            expect(mockConfirmAnnualSubscription).not.toHaveBeenCalled();

            // The synthetic metadata forwarded to processPaymentUpdated must NOT
            // contain annualSubscriptionId — the whitelist must have stripped it.
            const [callArg] = mockProcessPaymentUpdated.mock.calls[0] as [
                { data: Record<string, unknown> }
            ];
            const meta = callArg.data.metadata as Record<string, unknown>;
            expect(meta.annualSubscriptionId).toBeUndefined();
            // The addon-specific keys must still be present.
            expect(meta.addonSlug).toBe('extra-photos');
            expect(meta.customerId).toBe('cust_iii');
        });

        it('addon job + processPaymentUpdated returns success=false (generic error) → job retries via error-backoff', async () => {
            const job = buildJob({
                id: 'addon-job-4',
                resourceType: 'one_time_payment',
                providerResourceId: 'cs_addon_err',
                metadata: {
                    type: 'addon_purchase',
                    addonSlug: 'extra-photos',
                    customerId: 'cust_ggg',
                    userId: 'user_hhh',
                    orderId: 'addon_extra-photos_cs_addon_err'
                }
            });
            mockFindDuePending.mockResolvedValue([job]);
            lockWithJob(job);
            mockSearch.mockResolvedValueOnce([
                {
                    id: 'mp_pay_bad',
                    status: 'succeeded',
                    amount: 150000,
                    currency: 'ARS',
                    metadata: { addonSlug: 'extra-photos', customerId: 'cust_ggg' }
                }
            ]);
            // Generic success=false (no addonAlreadyActive flag) → should still error-backoff
            mockProcessPaymentUpdated.mockResolvedValueOnce({
                success: false,
                addonConfirmed: false
            });

            const result = await subscriptionPollJob.handler(buildContext());

            // The error should have caused a retry reschedule (not terminal succeeded).
            expect(result.errors).toBe(1);
            expect(result.success).toBe(false);
            const terminalSucceeded = mockStorageUpdate.mock.calls.find(
                (call) => (call[0] as { status?: string }).status === 'succeeded'
            );
            expect(terminalSucceeded).toBeUndefined();
        });

        // ── T-013: ADDON_ALREADY_ACTIVE → terminal succeeded ───────────────
        // When processPaymentUpdated signals addonAlreadyActive=true, the
        // polling job must go TERMINAL 'succeeded' instead of error-backoff.
        // The purchase already exists; T-012's grant reconciliation handles
        // any missing grants asynchronously.
        it('addon job + addonAlreadyActive → terminal succeeded, no error counted (SPEC-194 T-013)', async () => {
            const job = buildJob({
                id: 'addon-already-active-1',
                resourceType: 'one_time_payment',
                providerResourceId: 'cs_addon_already',
                metadata: {
                    type: 'addon_purchase',
                    addonSlug: 'extra-photos',
                    customerId: 'cust_already',
                    userId: 'user_already',
                    orderId: 'addon_extra-photos_cs_addon_already'
                }
            });
            mockFindDuePending.mockResolvedValue([job]);
            lockWithJob(job);
            mockSearch.mockResolvedValueOnce([
                {
                    id: 'mp_pay_already',
                    status: 'succeeded',
                    amount: 150000,
                    currency: 'ARS',
                    metadata: {
                        addonSlug: 'extra-photos',
                        customerId: 'cust_already',
                        type: 'addon_purchase'
                    }
                }
            ]);
            // processPaymentUpdated returns addonAlreadyActive=true — purchase already exists
            mockProcessPaymentUpdated.mockResolvedValueOnce({
                success: true,
                addonConfirmed: false,
                addonAlreadyActive: true
            });

            const result = await subscriptionPollJob.handler(buildContext());

            // Must be terminal succeeded — no error-backoff spinning
            expect(result.errors).toBe(0);
            expect(result.success).toBe(true);
            expect(result.processed).toBe(1);

            const terminalUpdate = mockStorageUpdate.mock.calls.find(
                (call) => (call[0] as { status?: string }).status === 'succeeded'
            );
            expect(terminalUpdate).toBeDefined();
            expect(terminalUpdate?.[0]).toMatchObject({
                status: 'succeeded',
                completedAt: expect.any(Date)
            });
        });

        it('addon job + addonAlreadyActive does NOT match generic success=true (addonConfirmed=true) → normal terminal succeeded path', async () => {
            // Regression guard: a normal success (addonConfirmed=true, no addonAlreadyActive)
            // must still go terminal succeeded (existing behavior must be preserved).
            const job = buildJob({
                id: 'addon-normal-success',
                resourceType: 'one_time_payment',
                providerResourceId: 'cs_addon_normal',
                metadata: {
                    type: 'addon_purchase',
                    addonSlug: 'extra-photos',
                    customerId: 'cust_normal',
                    userId: 'user_normal',
                    orderId: 'addon_extra-photos_cs_addon_normal'
                }
            });
            mockFindDuePending.mockResolvedValue([job]);
            lockWithJob(job);
            mockSearch.mockResolvedValueOnce([
                {
                    id: 'mp_pay_normal',
                    status: 'succeeded',
                    amount: 150000,
                    currency: 'ARS',
                    metadata: {
                        addonSlug: 'extra-photos',
                        customerId: 'cust_normal',
                        type: 'addon_purchase'
                    }
                }
            ]);
            // Normal success — no addonAlreadyActive flag
            mockProcessPaymentUpdated.mockResolvedValueOnce({
                success: true,
                addonConfirmed: true
            });

            const result = await subscriptionPollJob.handler(buildContext());

            expect(result.errors).toBe(0);
            expect(result.success).toBe(true);
            const terminalUpdate = mockStorageUpdate.mock.calls.find(
                (call) => (call[0] as { status?: string }).status === 'succeeded'
            );
            expect(terminalUpdate).toBeDefined();
        });
    });
});
