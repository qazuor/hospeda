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
 * The customer-update fields `mapCoreCustomerUpdateToDrizzle` actually persists.
 * `providerCustomerIds` is deliberately absent — that omission is the real
 * behaviour this fixture exists to reproduce.
 */
const MAPPED_UPDATE_FIELDS = [
    'email',
    'name',
    'phone',
    'metadata',
    'mpCustomerId',
    'stripeCustomerId',
    'segment',
    'tier'
] as const;

/**
 * Minimal in-memory `billing_customers` store with the exact soft-delete
 * semantics the Drizzle adapter has: `delete` sets `deletedAt`, and every read
 * filters deleted rows out — which is precisely why a rolled-back row reads as
 * "no billing account".
 */
function createCustomerStorage() {
    const rows = new Map<string, QZPayCustomer>();
    const deleteSpy = vi.fn();
    let nextCreateError: Error | null = null;
    let hideNextLookupOnce = false;

    const customers = {
        create: async (input: Record<string, unknown>): Promise<QZPayCustomer> => {
            if (nextCreateError !== null) {
                const error = nextCreateError;
                nextCreateError = null;
                throw error;
            }
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
        findByExternalId: async (externalId: string): Promise<QZPayCustomer | null> => {
            if (hideNextLookupOnce) {
                hideNextLookupOnce = false;
                return null;
            }
            return (
                [...rows.values()].find(
                    (row) => row.externalId === externalId && row.deletedAt === null
                ) ?? null
            );
        },
        // Mirrors `@qazuor/qzpay-drizzle`'s real update path, NOT the shape a
        // naive `{...row, ...input}` would give. `mapCoreCustomerUpdateToDrizzle`
        // maps `email`, `name`, `phone`, `metadata`, `mpCustomerId`,
        // `stripeCustomerId` and friends — it has NO branch for
        // `providerCustomerIds`, so qzpay-core's success-path write of that field
        // is silently dropped, and `mapDrizzleCustomerToCore` rebuilds the map
        // from the `mp_customer_id` / `stripe_customer_id` COLUMNS.
        //
        // Copying the assumption instead (spreading the input verbatim) is what
        // would let a test certify a provider link that production never stores.
        update: async (
            id: string,
            input: Record<string, unknown>
        ): Promise<QZPayCustomer | null> => {
            const row = rows.get(id);
            if (!row || row.deletedAt !== null) {
                return null;
            }

            const mapped: Record<string, unknown> = {};
            for (const field of MAPPED_UPDATE_FIELDS) {
                if (input[field] !== undefined) {
                    mapped[field] = input[field];
                }
            }

            const next = { ...row, ...mapped } as QZPayCustomer & {
                mpCustomerId?: string | null;
            };
            // Rebuild the core-facing map from the columns, like the real mapper.
            const providerCustomerIds: Record<string, string> = {};
            if (next.mpCustomerId) {
                providerCustomerIds.mercadopago = next.mpCustomerId;
            }
            const stored = { ...next, providerCustomerIds } as QZPayCustomer;

            rows.set(id, stored);
            return stored;
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
        /** Make the NEXT create reject, to simulate losing a concurrent insert. */
        failNextCreateWith: (error: Error) => {
            nextCreateError = error;
        },
        /** Make the NEXT external-id lookup miss, to force the create path. */
        hideNextLookup: () => {
            hideNextLookupOnce = true;
        },
        /** Rows a caller would actually see: soft-deleted ones are invisible. */
        liveRows: () => [...rows.values()].filter((row) => row.deletedAt === null),
        storage: { customers } as unknown as QZPayStorageAdapter
    };
}

/**
 * A logger with the QZPayLogger shape whose calls can be asserted. Passing one
 * is not cosmetic: without it qzpay-core builds `createDefaultLogger`, which
 * writes to `console.*` and never reaches `@repo/logger`.
 *
 * @returns A fresh spy logger
 */
function silentLogger() {
    return {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    };
}

/** A payment adapter whose customer creation succeeds and returns a provider id. */
function createSucceedingPaymentAdapter(): QZPayPaymentAdapter {
    return {
        provider: 'mercadopago',
        customers: {
            create: vi.fn().mockResolvedValue('mp_cus_ok')
        }
    } as unknown as QZPayPaymentAdapter;
}

/**
 * Build the error shape a unique-violation ACTUALLY has in this stack.
 *
 * Drizzle 0.45.2 rethrows every query failure as
 * `new DrizzleQueryError(query, params, cause)`, whose message is
 * `Failed query: …` (no "duplicate key" text) and which carries no `code` of its
 * own. Only the wrapped pg `DatabaseError` has `code: '23505'`.
 *
 * @returns A wrapper error mirroring the production shape
 */
function wrappedUniqueViolation(): Error {
    const pgError = Object.assign(
        new Error(
            'duplicate key value violates unique constraint "billing_customers_external_id_livemode_uniq"'
        ),
        { code: '23505' }
    );

    return Object.assign(
        new Error('Failed query: insert into "billing_customers" ...\nparams: ...'),
        { cause: pgError }
    );
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
        logger: silentLogger()
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

        it('does not warn about a missing provider link on a successful create', async () => {
            // Arrange — a provider that SUCCEEDS, so nothing is degraded.
            const store = createCustomerStorage();
            const billing = createQZPayBilling({
                storage: store.storage,
                paymentAdapter: createSucceedingPaymentAdapter(),
                defaultCurrency: 'ARS',
                livemode: false,
                providerSyncErrorStrategy: 'log',
                logger: silentLogger()
            }) as QZPayBilling;
            const service = new BillingCustomerSyncService(billing, { throwOnError: false });

            // Act
            const customerId = await service.ensureCustomerExists(INPUT);

            // Assert — the row exists and NOTHING warns. This is the case that
            // catches a signal keyed on `providerCustomerIds`: the real Drizzle
            // mapper drops that field, so a successful create also comes back
            // with an empty map, and a warning keyed on it would fire on every
            // single signup until it drowned the failure it was meant to expose.
            expect(customerId).not.toBeNull();
            expect(store.liveRows()).toHaveLength(1);
            expect(apiLogger.warn).not.toHaveBeenCalled();

            const infoMessages = vi
                .mocked(apiLogger.info)
                .mock.calls.map(([, message]) => String(message));
            expect(infoMessages).toContain('Billing customer created successfully');
        });

        it('routes the provider failure through the injected logger, not console', async () => {
            // Arrange
            const logger = silentLogger();
            const store = createCustomerStorage();
            const billing = createQZPayBilling({
                storage: store.storage,
                paymentAdapter: createFailingPaymentAdapter(),
                defaultCurrency: 'ARS',
                livemode: false,
                providerSyncErrorStrategy: 'log',
                logger
            }) as QZPayBilling;
            const service = new BillingCustomerSyncService(billing, { throwOnError: false });

            // Act
            await service.ensureCustomerExists(INPUT);

            // Assert — this is the whole "stop being mute" guarantee under 'log'.
            // Production wires `qzpayLogger` here, which forwards into apiLogger;
            // without an explicit logger qzpay-core falls back to console.*.
            const errorCalls = vi.mocked(logger.error).mock.calls;
            const syncFailure = errorCalls.find(
                ([message]) => message === 'Provider sync failed during customer creation'
            );

            expect(syncFailure).toBeDefined();

            const meta = syncFailure?.[1] as Record<string, unknown>;
            expect(meta.provider).toBe('mercadopago');
            expect(meta.operation).toBe('create_customer');
            expect(meta.error).toBe(MP_FAILURE_MESSAGE);
        });
    });

    describe('race recovery once the partial UNIQUE index exists', () => {
        it('re-fetches the winner when the insert loses with a wrapped 23505', async () => {
            // Arrange — the loser of the race sees the SAME error shape production
            // raises: a DrizzleQueryError whose message never says "duplicate key"
            // and whose `code` is undefined, wrapping the pg DatabaseError.
            const store = createCustomerStorage();
            const winner = await store.storage.customers.create({
                externalId: INPUT.userId,
                email: INPUT.email,
                name: INPUT.name
            } as never);

            store.failNextCreateWith(wrappedUniqueViolation());

            const billing = createQZPayBilling({
                storage: store.storage,
                paymentAdapter: createFailingPaymentAdapter(),
                defaultCurrency: 'ARS',
                livemode: false,
                providerSyncErrorStrategy: 'log',
                logger: silentLogger()
            }) as QZPayBilling;

            // A service whose cache is cold and whose first lookup misses, so it
            // takes the create path and loses the race.
            const service = new BillingCustomerSyncService(billing, { throwOnError: false });
            store.hideNextLookup();

            // Act
            const resolved = await service.ensureCustomerExists(INPUT);

            // Assert — without unwrapping the cause chain this returns null, and
            // the caller answers "No billing account found" (400): the exact
            // symptom HOS-596 exists to remove, reintroduced by its own index.
            expect(resolved).toBe(winner.id);
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
