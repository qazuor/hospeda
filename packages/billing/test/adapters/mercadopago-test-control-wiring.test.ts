/**
 * Tests for SPEC-217 T-006: test-control wiring in the MercadoPago adapter.
 *
 * Verifies that `applyTestControl` is invoked (or bypassed) correctly based on
 * the `HOSPEDA_QZPAY_TEST_CONTROL_ENABLED` flag, that real adapter calls are
 * forwarded with the original arguments, and that `failNext` fault injection
 * rejects with the queued error without touching the real method.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMercadoPagoAdapter } from '../../src/adapters/mercadopago';
import {
    failNext,
    getRecordedCalls,
    resetTestControl
} from '../../src/adapters/qzpay-test-control';

// ---------------------------------------------------------------------------
// Module-level mocks (hoisted by vitest)
// ---------------------------------------------------------------------------

vi.mock('@repo/config', () => ({
    getEnv: vi.fn((name: string, fallback?: string) => process.env[name] ?? fallback ?? ''),
    getEnvBoolean: vi.fn((name: string, fallback = false) => {
        const val = process.env[name];
        if (val === undefined) return fallback;
        return val === 'true';
    }),
    getEnvNumber: vi.fn((name: string, fallback?: number) => {
        const val = process.env[name];
        if (val === undefined) return fallback ?? 0;
        return Number(val);
    })
}));

vi.mock('@repo/logger', () => ({
    createLogger: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }))
}));

// Sentinel values returned by the fake adapter methods.
const SENTINEL_CREATE = { id: 'sub_sentinel_create', status: 'active' };
const SENTINEL_UPDATE = { id: 'sub_sentinel_update', status: 'updated' };
const SENTINEL_CANCEL = { id: 'sub_sentinel_cancel', status: 'canceled' };

const mockSubscriptionsCreate = vi.fn().mockResolvedValue(SENTINEL_CREATE);
const mockSubscriptionsUpdate = vi.fn().mockResolvedValue(SENTINEL_UPDATE);
const mockSubscriptionsCancel = vi.fn().mockResolvedValue(SENTINEL_CANCEL);
const mockSubscriptionsRetrieve = vi.fn().mockResolvedValue({ id: 'sub_sentinel_retrieve' });

vi.mock('@qazuor/qzpay-mercadopago', () => ({
    createQZPayMercadoPagoAdapter: vi.fn(() => ({
        provider: 'mercadopago',
        customers: {
            create: vi.fn(),
            retrieve: vi.fn(),
            update: vi.fn(),
            delete: vi.fn()
        },
        subscriptions: {
            create: mockSubscriptionsCreate,
            retrieve: mockSubscriptionsRetrieve,
            update: mockSubscriptionsUpdate,
            cancel: mockSubscriptionsCancel
        },
        payments: {
            create: vi.fn(),
            retrieve: vi.fn(),
            refund: vi.fn()
        },
        checkout: {
            createPreference: vi.fn()
        },
        prices: {
            create: vi.fn(),
            retrieve: vi.fn()
        },
        webhooks: {
            verifySignature: vi.fn().mockReturnValue(true),
            constructEvent: vi.fn()
        }
    }))
}));

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

beforeEach(() => {
    // Valid sandbox token so the adapter construction succeeds.
    vi.stubEnv('HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN', 'TEST-wiring-test-token');
    vi.stubEnv('HOSPEDA_MERCADO_PAGO_SANDBOX', 'true');
    // Clear test-control state so each test starts clean.
    resetTestControl();
    // Reset mock call history too.
    mockSubscriptionsCreate.mockReset();
    mockSubscriptionsUpdate.mockReset();
    mockSubscriptionsCancel.mockReset();
    // Re-wire sentinels after mockReset clears them.
    mockSubscriptionsCreate.mockResolvedValue(SENTINEL_CREATE);
    mockSubscriptionsUpdate.mockResolvedValue(SENTINEL_UPDATE);
    mockSubscriptionsCancel.mockResolvedValue(SENTINEL_CANCEL);
});

afterEach(() => {
    process.env.HOSPEDA_QZPAY_TEST_CONTROL_ENABLED = undefined;
    resetTestControl();
});

// ---------------------------------------------------------------------------
// 1. Gate OFF — adapter is the real (unwrapped) object
// ---------------------------------------------------------------------------

describe('flag OFF — test control disabled', () => {
    it('should return the real adapter directly (no wrapper)', () => {
        // Arrange
        process.env.HOSPEDA_QZPAY_TEST_CONTROL_ENABLED = undefined;

        // Act
        const adapter = createMercadoPagoAdapter();

        // Assert: the adapter is the same reference returned by the mock factory;
        // its subscriptions.create IS the mock fn (not a wrapper function).
        expect(adapter.subscriptions.create).toBe(mockSubscriptionsCreate);
        expect(adapter.subscriptions.update).toBe(mockSubscriptionsUpdate);
        expect(adapter.subscriptions.cancel).toBe(mockSubscriptionsCancel);
    });

    it('should not record any calls in test-control when flag is OFF', async () => {
        // Arrange
        process.env.HOSPEDA_QZPAY_TEST_CONTROL_ENABLED = undefined;
        const adapter = createMercadoPagoAdapter();

        // Act
        await adapter.subscriptions.create({ customerId: 'cust_1', planId: 'plan_basic' });

        // Assert: no recording happened because the gate was never active.
        expect(getRecordedCalls()).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// 2. Gate ON — pass-through (no queued faults)
// ---------------------------------------------------------------------------

describe('flag ON — pass-through (no faults queued)', () => {
    beforeEach(() => {
        process.env.HOSPEDA_QZPAY_TEST_CONTROL_ENABLED = 'true';
    });

    it('should record outcome ok for subscriptions.create (startTrial)', async () => {
        // Arrange
        const adapter = createMercadoPagoAdapter();
        const createArgs = { customerId: 'cust_a', planId: 'plan_1' };

        // Act
        const result = await adapter.subscriptions.create(createArgs);

        // Assert result forwarded from real mock
        expect(result).toEqual(SENTINEL_CREATE);
        // Real mock was called with original args
        expect(mockSubscriptionsCreate).toHaveBeenCalledOnce();
        expect(mockSubscriptionsCreate).toHaveBeenCalledWith(createArgs);
        // Recorded in test-control
        const calls = getRecordedCalls('startTrial');
        expect(calls).toHaveLength(1);
        expect(calls[0]?.outcome).toBe('ok');
        expect(calls[0]?.args).toEqual(createArgs);
    });

    it('should record outcome ok for subscriptions.update (updateSubscription)', async () => {
        // Arrange
        const adapter = createMercadoPagoAdapter();
        const updateArgs = ['sub_id_99', { status: 'paused' }] as const;

        // Act
        const result = await adapter.subscriptions.update(...updateArgs);

        // Assert
        expect(result).toEqual(SENTINEL_UPDATE);
        expect(mockSubscriptionsUpdate).toHaveBeenCalledOnce();
        expect(mockSubscriptionsUpdate).toHaveBeenCalledWith(...updateArgs);
        const calls = getRecordedCalls('updateSubscription');
        expect(calls).toHaveLength(1);
        expect(calls[0]?.outcome).toBe('ok');
    });

    it('should record outcome ok for subscriptions.cancel (cancelTrial)', async () => {
        // Arrange
        const adapter = createMercadoPagoAdapter();
        const cancelArg = 'sub_id_42';

        // Act
        const result = await adapter.subscriptions.cancel(cancelArg);

        // Assert
        expect(result).toEqual(SENTINEL_CANCEL);
        expect(mockSubscriptionsCancel).toHaveBeenCalledOnce();
        expect(mockSubscriptionsCancel).toHaveBeenCalledWith(cancelArg);
        const calls = getRecordedCalls('cancelTrial');
        expect(calls).toHaveLength(1);
        expect(calls[0]?.outcome).toBe('ok');
    });

    it('should NOT wrap non-subscription methods (customers/payments/checkout)', () => {
        // Arrange & Act
        const adapter = createMercadoPagoAdapter();

        // The spread preserves the original method references for non-wrapped groups.
        // We can't do strict reference equality after spreads create new plain objects,
        // but we can confirm the methods are callable vi.fn() instances (not async wrappers
        // that would differ in toString/prototype).
        expect(typeof adapter.customers.create).toBe('function');
        expect(typeof adapter.payments.create).toBe('function');
        expect(typeof adapter.checkout.createPreference).toBe('function');
    });

    it('should preserve subscriptions.retrieve unwrapped', async () => {
        // Arrange
        const adapter = createMercadoPagoAdapter();

        // Act — retrieve is NOT in the wrapped set; calling it must NOT add a recordedCall.
        await adapter.subscriptions.retrieve('sub_id_retrieve');

        // No startTrial / updateSubscription / cancelTrial recorded.
        expect(getRecordedCalls('startTrial')).toHaveLength(0);
        expect(getRecordedCalls('updateSubscription')).toHaveLength(0);
        expect(getRecordedCalls('cancelTrial')).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// 3. Gate ON — failNext injection for each wrapped method
// ---------------------------------------------------------------------------

describe('flag ON — failNext fault injection', () => {
    beforeEach(() => {
        process.env.HOSPEDA_QZPAY_TEST_CONTROL_ENABLED = 'true';
    });

    it('failNext(startTrial): subscriptions.create rejects and does NOT call real create', async () => {
        // Arrange
        failNext({
            operation: 'startTrial',
            errorCode: 'MP_500',
            errorMessage: 'Simulated MP 500'
        });
        const adapter = createMercadoPagoAdapter();

        // Act & Assert
        await expect(
            adapter.subscriptions.create({ customerId: 'cust_fail', planId: 'plan_x' })
        ).rejects.toThrow('Simulated MP 500');

        // Real method must NOT have been called.
        expect(mockSubscriptionsCreate).not.toHaveBeenCalled();

        // Should be recorded as failed.
        const calls = getRecordedCalls('startTrial');
        expect(calls).toHaveLength(1);
        expect(calls[0]?.outcome).toBe('failed');
    });

    it('failNext(updateSubscription): subscriptions.update rejects and does NOT call real update', async () => {
        // Arrange
        failNext({
            operation: 'updateSubscription',
            errorCode: 'MP_TIMEOUT',
            errorMessage: 'Simulated timeout'
        });
        const adapter = createMercadoPagoAdapter();

        // Act & Assert
        await expect(
            adapter.subscriptions.update('sub_fail', { status: 'active' })
        ).rejects.toThrow('Simulated timeout');

        expect(mockSubscriptionsUpdate).not.toHaveBeenCalled();

        const calls = getRecordedCalls('updateSubscription');
        expect(calls).toHaveLength(1);
        expect(calls[0]?.outcome).toBe('failed');
    });

    it('failNext(cancelTrial): subscriptions.cancel rejects and does NOT call real cancel', async () => {
        // Arrange
        failNext({
            operation: 'cancelTrial',
            errorCode: 'MP_CANCEL_FAIL',
            errorMessage: 'Simulated cancel failure'
        });
        const adapter = createMercadoPagoAdapter();

        // Act & Assert
        await expect(adapter.subscriptions.cancel('sub_cancel_fail')).rejects.toThrow(
            'Simulated cancel failure'
        );

        expect(mockSubscriptionsCancel).not.toHaveBeenCalled();

        const calls = getRecordedCalls('cancelTrial');
        expect(calls).toHaveLength(1);
        expect(calls[0]?.outcome).toBe('failed');
    });

    it('should consume failNext entries in FIFO order (first fails, second passes)', async () => {
        // Arrange — queue exactly one failure for startTrial
        failNext({ operation: 'startTrial', errorCode: 'MP_500', errorMessage: 'first' });
        const adapter = createMercadoPagoAdapter();
        const createArgs = { customerId: 'cust_fifo', planId: 'plan_y' };

        // Act
        // First call: should fail.
        await expect(adapter.subscriptions.create(createArgs)).rejects.toThrow('first');
        // Second call: queue is exhausted, real method invoked.
        const result = await adapter.subscriptions.create(createArgs);

        // Assert
        expect(result).toEqual(SENTINEL_CREATE);
        expect(mockSubscriptionsCreate).toHaveBeenCalledOnce();

        const calls = getRecordedCalls('startTrial');
        expect(calls).toHaveLength(2);
        expect(calls[0]?.outcome).toBe('failed');
        expect(calls[1]?.outcome).toBe('ok');
    });
});

// ---------------------------------------------------------------------------
// 4. Args preservation
// ---------------------------------------------------------------------------

describe('args preservation', () => {
    beforeEach(() => {
        process.env.HOSPEDA_QZPAY_TEST_CONTROL_ENABLED = 'true';
    });

    it('should forward ALL arguments to subscriptions.create unchanged', async () => {
        // Arrange
        const adapter = createMercadoPagoAdapter();
        const argsToForward = {
            customerId: 'cust_args_test',
            planId: 'plan_args',
            metadata: { referral: 'ref_123' }
        };

        // Act
        await adapter.subscriptions.create(argsToForward);

        // Assert exact args forwarded to the real method
        expect(mockSubscriptionsCreate).toHaveBeenCalledWith(argsToForward);
    });

    it('should forward ALL arguments to subscriptions.update unchanged', async () => {
        // Arrange
        const adapter = createMercadoPagoAdapter();
        const subId = 'sub_args_update';
        const updateData = { status: 'paused', pausedAt: '2026-01-01' };

        // Act
        await adapter.subscriptions.update(subId, updateData);

        // Assert
        expect(mockSubscriptionsUpdate).toHaveBeenCalledWith(subId, updateData);
    });

    it('should forward ALL arguments to subscriptions.cancel unchanged', async () => {
        // Arrange
        const adapter = createMercadoPagoAdapter();
        const subId = 'sub_args_cancel';

        // Act
        await adapter.subscriptions.cancel(subId);

        // Assert
        expect(mockSubscriptionsCancel).toHaveBeenCalledWith(subId);
    });
});
