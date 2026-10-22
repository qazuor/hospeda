import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openReconciliationMark } from '../../../src/services/billing/reconciliation/open-reconciliation-mark.service.js';
import { runTerminalReturn } from '../../../src/services/billing/reconciliation/sweep/terminal-return.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import {
    resetSeededTerminalReturnInventory,
    seedTerminalRow,
    withSeededTerminalReturnInventory
} from './support/terminal-return-fixtures.js';

const clock = { now: () => new Date('2026-11-01T10:00:00.000Z') };
const deadlines = { current: async () => ({ version: 1, values: { '16': { days: 180 } } }) };
const cause = new Error('Mercado Pago request failed (429)');

beforeAll(() => getServiceTestDb());
afterAll(closeServiceTestPool);

describe('TEST:1737:7 terminal return failure cause', () => {
    it('persists the read failure message for the seeded cancelled row', async () => {
        resetSeededTerminalReturnInventory();
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        const row = await seedTerminalRow({ status: 'CANCELLED', fake });
        await fake.cancel({ authorizationId: row.providerId! });
        await openReconciliationMark({
            subject: { kind: 'SUBSCRIPTION', subscriptionId: row.subscription.id },
            reason: 'TRANSICION_NO_DECLARADA',
            actor: { type: 'provider' },
            correlationId: crypto.randomUUID()
        });
        const provider = new Proxy(fake as unknown as PaymentProvider, {
            get(target, key, receiver) {
                if (key === 'readAuthorization')
                    return async () => {
                        throw cause;
                    };
                const value = Reflect.get(target, key, receiver) as unknown;
                return typeof value === 'function' ? value.bind(fake) : value;
            }
        });
        const result = await withSeededTerminalReturnInventory(() =>
            runTerminalReturn(
                { correlationId: crypto.randomUUID(), pageSize: 100 },
                {
                    provider,
                    clock,
                    deadlines,
                    beforeCancelNotice: { beforeCancel: async () => 'SENT' }
                }
            )
        );
        expect(result.failures).toEqual([
            expect.objectContaining({
                subscriptionId: row.subscription.id,
                message: expect.stringContaining('Mercado Pago request failed (429)')
            })
        ]);
    });
});
