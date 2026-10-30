import {
    eq,
    payments,
    providerLinks,
    reconciliationMarkModel,
    successionRetainedPayments
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import type { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { openReconciliationMark } from '../../../src/services/billing/reconciliation/open-reconciliation-mark.service.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import {
    exitGameClock,
    exitGameFake,
    retireExitGameRows,
    runExitGameSweep,
    trackExitGameRow
} from './reconciliation-exit-game-fixtures.js';
import { seedCancellationDecision, seedSubscription } from './reconciliation-sweep-fixtures.js';
import { seedRetainedPayment } from './reconciliation-zero-call-fixtures.js';
import { seedTerminalRow } from './support/terminal-return-fixtures.js';

beforeAll(() => getServiceTestDb());
afterAll(closeServiceTestPool);
afterEach(retireExitGameRows);

describe('TEST:B11:20 el juego de salida contra el falso — comparaciones y terminales', () => {
    it('LISTA:B11 cláusula 2: cero cobros en el endpoint no es divergencia', async () => {
        // Arrange
        const { clock } = exitGameClock();
        const fake = exitGameFake({ clock });
        const row = await seedSubscription({ status: 'ACTIVE', withLink: true, fake });
        if (!row.subscription.userId || !row.providerId)
            throw new Error('Linked row is incomplete');
        trackExitGameRow(row.subscription.id, row.subscription.userId);
        const read = vi.spyOn(fake, 'readAuthorization');

        // Act
        const summary = await runExitGameSweep({ provider: fake, clock });

        // Assert
        expect(summary).toMatchObject({ divergences: 0, rowsFailed: 0 });
        expect(
            await reconciliationMarkModel.listOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: row.subscription.id }
            })
        ).toEqual([]);
        expect(read.mock.calls.some(([input]) => input.authorizationId === row.providerId)).toBe(
            true
        );
    });

    it('LISTA:B11 cláusula 3: un monto aceptado y no aplicado aparece sin webhook', async () => {
        // Arrange
        const { clock, advanceDays } = exitGameClock();
        const fake = exitGameFake({
            clock,
            honestAbout: [
                { lie: 'M6', why: 'deliver the seeded authorization notices before this case' }
            ]
        });
        const row = await seedSubscription({ status: 'ACTIVE', withLink: true, fake });
        if (!row.subscription.userId || !row.providerId)
            throw new Error('Linked row is incomplete');
        trackExitGameRow(row.subscription.id, row.subscription.userId);
        fake.moveNextCharge({
            authorizationId: row.providerId,
            at: new Date(clock.now().getTime() + 31 * 86_400_000)
        });
        fake.takeDeliveries();
        await fake.changeAmount({
            authorizationId: row.providerId,
            amount: { amountMinor: 300000, currency: 'ARS' }
        });
        const provider = providerWithoutAppliedAmount(fake);
        const retry = vi.spyOn(provider, 'changeAmount');
        const decidedAt = clock.now();
        const mutations = { findLatest: async () => ({ transition: 'S30' as const, decidedAt }) };

        // Act
        advanceDays(1);
        const first = await runExitGameSweep({ provider, clock, mutations });
        advanceDays(1);
        const second = await runExitGameSweep({ provider, clock, mutations });
        advanceDays(1);
        const third = await runExitGameSweep({ provider, clock, mutations });
        const afterThird = (await fake.takeDeliveries()).deliveries;

        // Assert
        expect(first.marksOpened).toBe(0);
        expect(second.marksOpened).toBe(0);
        expect(third).toMatchObject({ marksOpened: 1, rowsFailed: 0 });
        expect(retry).toHaveBeenCalledTimes(2);
        expect(
            await reconciliationMarkModel.listOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: row.subscription.id }
            })
        ).toEqual(
            expect.arrayContaining([expect.objectContaining({ reason: 'DIVERGENCIA_DE_MONTO' })])
        );
        expect(afterThird.some(({ body }) => body.includes(row.providerId!))).toBe(false);
    });

    it('LISTA:B11 cláusula 4: una terminal con marca o retención S19 sigue en el barrido', async () => {
        // Arrange
        const { clock } = exitGameClock();
        const fake = exitGameFake({ clock });
        const marked = await seedTerminalRow({ status: 'CANCELLED', fake });
        const retained = await seedTerminalRow({ status: 'CANCELLED', fake });
        for (const row of [marked, retained]) {
            if (!row.subscription.userId || !row.providerId)
                throw new Error('Terminal row is incomplete');
            trackExitGameRow(row.subscription.id, row.subscription.userId);
            await fake.cancel({ authorizationId: row.providerId });
        }
        await openReconciliationMark({
            subject: { kind: 'SUBSCRIPTION', subscriptionId: marked.subscription.id },
            reason: 'TRANSICION_NO_DECLARADA',
            actor: { type: 'provider' },
            correlationId: crypto.randomUUID()
        });
        const payment = await seedRetainedPayment(retained.subscription.id);
        await getServiceTestDb().insert(successionRetainedPayments).values({
            subscriptionId: retained.subscription.id,
            paymentId: payment.id,
            unpaidSince: clock.now()
        });
        const read = vi.spyOn(fake, 'readAuthorization');

        // Act
        const summary = await runExitGameSweep({ provider: fake, clock });

        // Assert
        expect(summary.terminalReturn?.stayed).toMatchObject({ OPEN_MARK: 1, OPEN_RETENTION: 1 });
        for (const row of [marked, retained])
            expect(
                read.mock.calls.some(([input]) => input.authorizationId === row.providerId)
            ).toBe(true);
    });

    it('LISTA:B11 cláusula 9 (primera mitad): CANCELLED con un cobro en recycling sigue hasta que cierra', async () => {
        // Arrange
        const { clock, set, advanceDays } = exitGameClock();
        const fake = exitGameFake({
            clock,
            honestAbout: [{ lie: 'M8', why: 'settle this seeded approval before the sweep' }]
        });
        const row = await seedTerminalRow({ status: 'CANCELLED', fake });
        if (!row.subscription.userId || !row.providerId)
            throw new Error('Terminal row is incomplete');
        trackExitGameRow(row.subscription.id, row.subscription.userId);
        set(new Date(clock.now().getTime() - 10 * 86_400_000));
        const approved = await fake.charge({
            authorizationId: row.providerId,
            amount: { amountMinor: 250000, currency: 'ARS' },
            reference: row.subscription.id
        });
        await getServiceTestDb().insert(payments).values({
            subscriptionId: row.subscription.id,
            amount: 250000,
            currency: 'ARS',
            status: 'SUCCEEDED',
            provider: 'MERCADO_PAGO',
            providerFactId: approved.chargeId,
            factAt: clock.now()
        });
        await fake.failChargeCycle({
            authorizationId: row.providerId,
            declineReason: 'test decline'
        });
        set(new Date('2026-11-01T10:00:00.000Z'));
        await fake.cancel({ authorizationId: row.providerId });
        await getServiceTestDb()
            .update(providerLinks)
            .set({ cancelledSeenAt: clock.now() })
            .where(eq(providerLinks.subscriptionId, row.subscription.id));
        const read = vi.spyOn(fake, 'readAuthorization');

        // Act
        const first = await runExitGameSweep({ provider: fake, clock });
        const listed = await fake.listCharges({ authorizationId: row.providerId });
        const charges = await Promise.all(
            listed.chargeIds.map((chargeId) => fake.readCharge({ chargeId }))
        );
        const rejected = charges.find(({ snapshot }) => snapshot.status === 'rejected');
        if (!rejected?.snapshot.expiresAt) throw new Error('The seeded rejection has no expiry');
        set(new Date(Date.parse(rejected.snapshot.expiresAt) + 1));
        const second = await runExitGameSweep({ provider: fake, clock });
        advanceDays(32);
        read.mockClear();
        const third = await runExitGameSweep({ provider: fake, clock });

        // Assert
        expect(first.terminalReturn).toMatchObject({ exempt: 0, stayed: { RECORD_OPEN: 1 } });
        expect(second.terminalReturn?.exempt).toBe(1);
        expect(third.terminalReturn?.rowsRead).toBe(0);
        expect(read.mock.calls.some(([input]) => input.authorizationId === row.providerId)).toBe(
            false
        );
    });

    it('LISTA:B11 cláusula 10: CANCEL_SCHEDULED cancelada no abre divergencia de monto', async () => {
        // Arrange
        const { clock } = exitGameClock();
        const fake = exitGameFake({ clock });
        const row = await seedSubscription({ status: 'CANCEL_SCHEDULED', withLink: true, fake });
        if (!row.subscription.userId || !row.providerId)
            throw new Error('Linked row is incomplete');
        trackExitGameRow(row.subscription.id, row.subscription.userId);
        await fake.changeAmount({
            authorizationId: row.providerId,
            amount: { amountMinor: 350000, currency: 'ARS' }
        });
        await fake.cancel({ authorizationId: row.providerId });
        await seedCancellationDecision({
            subscriptionId: row.subscription.id,
            transition: 'S11',
            decidedAt: clock.now()
        });

        // Act
        const summary = await runExitGameSweep({ provider: fake, clock });

        // Assert
        const marks = await reconciliationMarkModel.listOpen({
            subject: { kind: 'SUBSCRIPTION', subscriptionId: row.subscription.id }
        });
        expect(marks).toEqual([]);
        expect(summary.rowsFailed).toBe(0);
    });
});

function providerWithoutAppliedAmount(fake: FakePaymentProvider): PaymentProvider {
    return {
        capabilitySupport: fake.capabilitySupport,
        authorize: (input) => fake.authorize(input),
        charge: (input) => fake.charge(input),
        changeAmount: async (input) => ({ accepted: true, resourceId: input.authorizationId }),
        pause: (input) => fake.pause(input),
        resume: (input) => fake.resume(input),
        cancel: (input) => fake.cancel(input),
        refund: (input) => fake.refund(input),
        readAuthorization: (input) => fake.readAuthorization(input),
        searchAuthorizations: (input) => fake.searchAuthorizations(input),
        readCharge: (input) => fake.readCharge(input),
        listCharges: (input) => fake.listCharges(input),
        readOrder: (input) => fake.readOrder(input),
        searchOrders: (input) => fake.searchOrders(input),
        decodeNotice: (input) => fake.decodeNotice(input)
    };
}
