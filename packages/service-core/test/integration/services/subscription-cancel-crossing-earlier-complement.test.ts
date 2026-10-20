import {
    addonInstances,
    coveredPeriods,
    eq,
    payments,
    receipts,
    reconciliationMarkPayments,
    reconciliationMarks,
    subscriptions
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { PermissionEnum, VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { resolveAddonSources } from '../../../src/services/billing/coverage/addon-sources.js';
import { cancelActiveSubscription } from '../../../src/services/billing/subscription/cancel-active-subscription.service.js';
import { applyS12ToPrincipal } from '../../../src/services/billing/subscription/service-end-s12.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { orphanPorts } from './support/addon-orphan-fixtures.js';
import { cancelActiveNow, retireCancelActiveRows } from './support/cancel-active-fixtures.js';
import {
    crossingClock,
    paymentsForSubscription,
    recordOn,
    retireCancelCrossingRows,
    seedCrossingActive
} from './support/cancel-crossing-fixtures.js';
import { retireComplementRows, seedCommittedComplement } from './support/complement-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';

const T0 = new Date('2026-10-13T12:00:00.000Z');
const E = new Date('2026-11-01T00:00:00.000Z');
const complementIds: string[] = [];
const owner = (id: string) => ({
    id,
    roles: [],
    permissions: [PermissionEnum.BILLING_CANCEL_SUBSCRIPTION]
});
afterEach(async () => {
    if (complementIds.length) {
        const ids = complementIds.splice(0);
        const db = getServiceTestDb();
        const marks = await db
            .select({ id: reconciliationMarks.id })
            .from(reconciliationMarks)
            .where(eq(reconciliationMarks.subscriptionId, ids[0]!));
        const markIds = marks.map((mark) => mark.id);
        if (markIds.length) {
            await db
                .delete(reconciliationMarkPayments)
                .where(eq(reconciliationMarkPayments.markId, markIds[0]!));
            await db.delete(reconciliationMarks).where(eq(reconciliationMarks.id, markIds[0]!));
        }
        const paymentRows = await db
            .select({ id: payments.id })
            .from(payments)
            .where(eq(payments.subscriptionId, ids[0]!));
        const paymentIds = paymentRows.map((row) => row.id);
        if (paymentIds.length) {
            await db.delete(receipts).where(eq(receipts.paymentId, paymentIds[0]!));
            await db.delete(coveredPeriods).where(eq(coveredPeriods.paymentId, paymentIds[0]!));
            await db.delete(payments).where(eq(payments.id, paymentIds[0]!));
        }
    }
    await retireCancelCrossingRows();
    await retireComplementRows();
    await retireCancelActiveRows();
});
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('TEST:B8a:10 (d) complementary orphan residue', () => {
    it('TEST:B8a:10 (d): extends the complement with max, then S21 closes it and hangs the residue', async () => {
        const { clock, setNow } = crossingClock(new Date('2026-10-01T00:00:00.000Z'));
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const principal = await seedCrossingActive({ fake, payment: 'payment' });
        const seeded = await seedCommittedComplement({
            fake,
            principal: { userId: principal.userId, principalId: principal.subscriptionId },
            principalStatus: 'ACTIVE',
            scopeType: 'VERTICAL_SUBSCRIPTION',
            withLink: true
        });
        complementIds.push(seeded.complementId);
        setNow(cancelActiveNow);
        await cancelActiveSubscription(
            { actor: owner(principal.userId), subscriptionId: principal.subscriptionId },
            {
                provider: fake,
                clock,
                beforeCancelNotice: outboxBeforeCancelNotice(),
                complements: seeded.policy,
                coverageNotices: { emitCoverageChanged: async () => undefined }
            }
        );
        const [before] = await getServiceTestDb()
            .select({ serviceEndsAt: subscriptions.serviceEndsAt })
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.complementId));
        expect(before?.serviceEndsAt).toEqual(E);
        setNow(T0);
        const charge = await fake.charge({
            authorizationId: seeded.authorizationId!,
            amount: { amountMinor: 10000, currency: 'ARS' },
            reference: seeded.complementId
        });
        setNow(new Date('2026-10-15T12:00:00.000Z'));
        const result = await recordOn({ fake, chargeId: charge.chargeId, clock });
        // One monthly period from T0 is November 13; V-8 requires the literal max(current, formula).
        const formula = new Date('2026-11-13T12:00:00.000Z');
        expect(result).toMatchObject({
            outcome: 'CREDITED',
            crossing: { outcome: 'EXTENDED', serviceEndsAt: formula }
        });
        const [principalAfter] = await getServiceTestDb()
            .select({ serviceEndsAt: subscriptions.serviceEndsAt })
            .from(subscriptions)
            .where(eq(subscriptions.id, principal.subscriptionId));
        expect(principalAfter?.serviceEndsAt).toEqual(E);
        const [complementAfter] = await getServiceTestDb()
            .select({ status: subscriptions.status, serviceEndsAt: subscriptions.serviceEndsAt })
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.complementId));
        expect(complementAfter).toEqual({ status: 'CANCEL_SCHEDULED', serviceEndsAt: formula });

        const db = getServiceTestDb();
        const ports = orphanPorts(db);
        const resultS12 = await db.transaction(async (raw) =>
            applyS12ToPrincipal(
                { tx: raw as never, subscriptionId: principal.subscriptionId, now: E },
                { orphanhood: ports.ports, clock }
            )
        );
        expect(resultS12.outcome).toBe('CANCELLED');
        const [principalEnded] = await db
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, principal.subscriptionId));
        const [complementEnded] = await db
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.complementId));
        const [instance] = await db
            .select({ status: addonInstances.status })
            .from(addonInstances)
            .where(eq(addonInstances.id, seeded.instanceId));
        expect(principalEnded?.status).toBe('CANCELLED');
        expect(complementEnded?.status).toBe('CANCELLED');
        expect(instance?.status).not.toBe('ACTIVE');
        const sources = await resolveAddonSources({
            userId: seeded.userId,
            vertical: VerticalEnum.ACCOMMODATION,
            ports: {
                clock: { now: () => E },
                addonPolicy: seeded.policy.addonPolicy,
                listing: seeded.policy.listing
            }
        });
        expect(sources.sources).toHaveLength(0);
        const marks = await db
            .select()
            .from(reconciliationMarks)
            .where(eq(reconciliationMarks.subscriptionId, seeded.complementId));
        const residue = marks.find(
            (mark) =>
                mark.reason === 'COMPLEMENTO_CON_PERIODO_COBRADO_POR_OTRA_CAUSA' &&
                mark.liftedAt === null
        );
        expect(residue).toBeDefined();
        const payment = (await paymentsForSubscription(seeded.complementId)).find(
            (row) => row.providerFactId === charge.chargeId
        )!;
        expect(
            await db
                .select()
                .from(reconciliationMarkPayments)
                .where(eq(reconciliationMarkPayments.markId, residue!.id))
        ).toMatchObject([expect.objectContaining({ paymentId: payment.id })]);
    });
});
