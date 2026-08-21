/**
 * HOS-596 regression — a `billing_customers` row must SURVIVE a MercadoPago failure.
 *
 * The defect these tests pin down does not live in Hospeda code: qzpay-core's
 * `customers.create()` inserts the local row, calls the payment provider and,
 * under `providerSyncErrorStrategy: 'throw'`, UNDOES its own insert
 * (`storage.customers.delete`) before rethrowing. `ensureCustomerExists` then
 * swallows the error (`throwOnError: false`) and returns `null`, which every
 * caller reports as "No billing account found" (400/422).
 *
 * So these tests drive the REAL `createQZPayBilling` facade — not a mocked one —
 * over an in-memory storage adapter and a payment adapter that always fails.
 * A mocked facade could not reproduce the rollback, and a test that cannot
 * reproduce it cannot prove the fix.
 *
 * The `'throw'` case is kept as an executed control: it asserts the row IS
 * destroyed under the old configuration, so a green `'log'` case cannot be green
 * for the wrong reason.
 */

// ─── Module mocks — declared before imports ──────────────────────────────────
// Partial mock: everything real except `apiLogger`, whose calls are asserted.

vi.mock('../../src/utils/logger', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../src/utils/logger')>();
    return {
        ...actual,
        apiLogger: {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn()
        }
    };
});

import {
    createQZPayBilling,
    type QZPayBilling,
    type QZPayCustomer,
    type QZPayPaymentAdapter,
    type QZPayStorageAdapter
} from '@qazuor/qzpay-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingCustomerSyncService } from '../../src/services/billing-customer-sync';
import { apiLogger } from '../../src/utils/logger';

/** The MercadoPago error text the adapter rejects with, asserted in the logs. */
const MP_FAILURE_MESSAGE = 'MercadoPago 400: customer already exists (code 101)';

/**
 * Minimal in-memory `billing_customers` store with the exact soft-delete
 * semantics the Drizzle adapter has: `delete` sets `deletedAt`, and every read
 * filters deleted rows out — which is precisely why a rolled-back row reads as
 * "no billing account".
 */
function createCustomerStorage() {
    const rows = new Map<string, QZPayCustomer>();
    const deleteSpy = vi.fn();

    const customers = {
        create: async (input: Record<string, unknown>): Promise<QZPayCustomer> => {
            const row = {
                id: `cus_${rows.size + 1}`,
                externalId: String(input.externalId),
                email: String(input.email),
                name: (input.name as string | null) ?? null,
                phone: null,
                providerCustomerIds: {},
                metadata: (input.metadata as Record<string, unknown>) ?? {},
                livemode: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null
            } as unknown as QZPayCustomer;
            rows.set(row.id, row);
            return row;
        },
        findById: async (id: string): Promise<QZPayCustomer | null> => {
            const row = rows.get(id);
            return row && row.deletedAt === null ? row : null;
        },
        findByExternalId: async (externalId: string): Promise<QZPayCustomer | null> =>
            [...rows.values()].find(
                (row) => row.externalId === externalId && row.deletedAt === null
            ) ?? null,
        update: async (
            id: string,
            input: Record<string, unknown>
        ): Promise<QZPayCustomer | null> => {
            const row = rows.get(id);
            if (!row || row.deletedAt !== null) {
                return null;
            }
            const next = { ...row, ...input } as QZPayCustomer;
            rows.set(id, next);
            return next;
        },
        delete: async (id: string): Promise<void> => {
            deleteSpy(id);
            const row = rows.get(id);
            if (row) {
                rows.set(id, { ...row, deletedAt: new Date() } as QZPayCustomer);
            }
        },
        list: async () => ({ data: [], total: 0 })
    };

    return {
        deleteSpy,
        /** Rows a caller would actually see: soft-deleted ones are invisible. */
        liveRows: () => [...rows.values()].filter((row) => row.deletedAt === null),
        storage: { customers } as unknown as QZPayStorageAdapter
    };
}

/** A payment adapter whose customer creation always fails, like MP did in prod. */
function createFailingPaymentAdapter(): QZPayPaymentAdapter {
    return {
        provider: 'mercadopago',
        customers: {
            create: vi.fn().mockRejectedValue(new Error(MP_FAILURE_MESSAGE))
        }
    } as unknown as QZPayPaymentAdapter;
}

/**
 * Build a real QZPay facade over the failing provider, at the given strategy.
 * `'throw'` is the pre-HOS-596 configuration; `'log'` is what
 * `getQZPayBilling({ forCustomerSync: true })` now hands to the sync service.
 */
function buildBilling(strategy: 'throw' | 'log') {
    const store = createCustomerStorage();
    const billing = createQZPayBilling({
        storage: store.storage,
        paymentAdapter: createFailingPaymentAdapter(),
        defaultCurrency: 'ARS',
        livemode: false,
        providerSyncErrorStrategy: strategy,
        logger: {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn()
        }
    }) as QZPayBilling;

    return { billing, store };
}

const INPUT = { userId: 'user_596', email: 'owner@example.com', name: 'Owner' };

describe('HOS-596 — billing customer survives a provider failure', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("control: providerSyncErrorStrategy 'throw' (the defect)", () => {
        it('destroys the local row it just created and reports no customer', async () => {
            // Arrange
            const { billing, store } = buildBilling('throw');
            const service = new BillingCustomerSyncService(billing, { throwOnError: false });

            // Act
            const customerId = await service.ensureCustomerExists(INPUT);

            // Assert — this is the production symptom, reproduced.
            expect(customerId).toBeNull();
            expect(store.deleteSpy).toHaveBeenCalledTimes(1);
            expect(store.liveRows()).toHaveLength(0);
        });

        it('leaves a later lookup with nothing to find (the 400 on a pure GET)', async () => {
            // Arrange
            const { billing, store } = buildBilling('throw');
            const service = new BillingCustomerSyncService(billing, { throwOnError: false });
            await service.ensureCustomerExists(INPUT);

            // Act
            const found = await billing.customers.getByExternalId(INPUT.userId);

            // Assert
            expect(found).toBeNull();
            expect(store.liveRows()).toHaveLength(0);
        });
    });

    describe("fix: providerSyncErrorStrategy 'log' (the customer-sync facade)", () => {
        it('keeps the local row and returns its id', async () => {
            // Arrange
            const { billing, store } = buildBilling('log');
            const service = new BillingCustomerSyncService(billing, { throwOnError: false });

            // Act
            const customerId = await service.ensureCustomerExists(INPUT);

            // Assert
            expect(customerId).not.toBeNull();
            expect(store.deleteSpy).not.toHaveBeenCalled();

            const live = store.liveRows();
            expect(live).toHaveLength(1);
            expect(live[0]?.id).toBe(customerId);
            expect(live[0]?.externalId).toBe(INPUT.userId);
        });

        it('leaves a row a subsequent request can find, so checkout stops 400ing', async () => {
            // Arrange
            const { billing } = buildBilling('log');
            const first = new BillingCustomerSyncService(billing, { throwOnError: false });
            const created = await first.ensureCustomerExists(INPUT);

            // Act — a fresh service instance, so the in-process cache cannot
            // mask a missing row: this read goes to storage.
            const second = new BillingCustomerSyncService(billing, { throwOnError: false });
            const resolved = await second.ensureCustomerExists(INPUT);

            // Assert
            expect(created).not.toBeNull();
            expect(resolved).toBe(created);
        });

        it('does not create a second row on retry', async () => {
            // Arrange
            const { billing, store } = buildBilling('log');
            const service = new BillingCustomerSyncService(billing, { throwOnError: false });

            // Act
            await service.ensureCustomerExists(INPUT);
            service.clearCache();
            await service.ensureCustomerExists(INPUT);

            // Assert — the duplicate rows seen in production were the retry
            // symptom of the row disappearing; with the row alive there is
            // nothing to duplicate.
            expect(store.liveRows()).toHaveLength(1);
        });

        it('warns that the customer has no provider link instead of failing mute', async () => {
            // Arrange
            const { billing } = buildBilling('log');
            const service = new BillingCustomerSyncService(billing, { throwOnError: false });

            // Act
            const customerId = await service.ensureCustomerExists(INPUT);

            // Assert — a degraded customer must be greppable per account, not
            // inferred later from a checkout that mysteriously fails.
            expect(apiLogger.warn).toHaveBeenCalledTimes(1);

            const [payload, message] = vi.mocked(apiLogger.warn).mock.calls[0] as [
                Record<string, unknown>,
                string
            ];

            expect(payload.userId).toBe(INPUT.userId);
            expect(payload.customerId).toBe(customerId);
            expect(message).toContain('HOS-596');
            expect(message).toContain('WITHOUT a provider link');

            // And the success log must NOT have fired for a half-created customer.
            const infoMessages = vi.mocked(apiLogger.info).mock.calls.map(([, msg]) => String(msg));
            expect(infoMessages).not.toContain('Billing customer created successfully');
        });
    });

    describe('provider-error diagnostics', () => {
        it('logs provider, operation and the provider message when the error propagates', async () => {
            // Arrange — `throwOnError: false` keeps the route contract, so this
            // error log is the only trace the failure leaves.
            const { billing } = buildBilling('throw');
            const service = new BillingCustomerSyncService(billing, { throwOnError: false });

            // Act
            await service.ensureCustomerExists(INPUT);

            // Assert
            expect(apiLogger.error).toHaveBeenCalledTimes(1);

            const [payload] = vi.mocked(apiLogger.error).mock.calls[0] as [
                Record<string, unknown>,
                string
            ];

            expect(payload.provider).toBe('mercadopago');
            expect(payload.providerOperation).toBe('create_customer');
            // MercadoPago's own text — including its error code — is what makes
            // the failure diagnosable; the wrapper message alone does not carry it.
            expect(payload.providerError).toBe(MP_FAILURE_MESSAGE);
        });
    });
});
