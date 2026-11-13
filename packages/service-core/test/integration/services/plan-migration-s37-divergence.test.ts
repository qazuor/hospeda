import {
    and,
    domainEvent,
    domainEventModel,
    emailOutbox,
    eq,
    planMigrationSubscriptions,
    providerLinks,
    subscriptionScheduledChanges,
    subscriptions
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import {
    PLAN_MIGRATION_UPCOMING_TEMPLATE,
    planMigrationNoticeDedupKey
} from '../../../src/services/billing/plan-migration/plan-migration-notice.js';
import { runPlanMigrationS37ForRow } from '../../../src/services/billing/plan-migration/plan-migration-s37.service.js';
import { composePromoAmount } from '../../../src/services/billing/promo/promo-composition.js';
import {
    AMOUNT_MUTATION_RETRY_WINDOW_MS,
    createAmountComparison
} from '../../../src/services/billing/reconciliation/sweep/comparisons/amount-comparison.js';
import { createRecordedAmountMutationDecisions } from '../../../src/services/billing/reconciliation/sweep/comparisons/amount-mutation-decision.js';
import { createCutExpectedAmountPolicy } from '../../../src/services/billing/reconciliation/sweep/comparisons/expected-amount.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { seedPlanChangePromo } from './support/plan-change-fixtures.js';
import { registerPlanMigrationNoticeSerial } from './support/plan-migration-notice-serial.js';
import {
    cleanupS37Cases,
    createS37MigrationCase,
    S37_DAY,
    S37_NEXT_CHARGE_AT,
    type S37Case
} from './support/plan-migration-s37-fixtures.js';

registerPlanMigrationNoticeSerial();

const db = getServiceTestDb();
const PROMO = { discountKind: 'FIXED', value: 1_000 } as const;

afterEach(cleanupS37Cases);
afterAll(closeServiceTestPool);

function run(caseRow: S37Case, provider: PaymentProvider = caseRow.provider) {
    return runPlanMigrationS37ForRow(
        {
            planMigrationSubscriptionId: caseRow.scope.id,
            correlationId: crypto.randomUUID()
        },
        { provider, clock: caseRow.clock }
    );
}

function upcomingKey(caseRow: S37Case) {
    return planMigrationNoticeDedupKey({
        recipientUserId: caseRow.userId,
        template: PLAN_MIGRATION_UPCOMING_TEMPLATE,
        planMigrationSubscriptionId: caseRow.scope.id,
        milestone: 'mig:-7d',
        targetDate: '2026-12-11'
    });
}

async function markNoticeSent(caseRow: S37Case) {
    await db
        .update(emailOutbox)
        .set({ status: 'sent' })
        .where(eq(emailOutbox.dedupKey, upcomingKey(caseRow)));
}

async function queueRows(subscriptionId: string) {
    return db
        .select()
        .from(subscriptionScheduledChanges)
        .where(eq(subscriptionScheduledChanges.subscriptionId, subscriptionId));
}

async function scopeRowStatus(scopeId: string) {
    const [row] = await db
        .select({ status: planMigrationSubscriptions.status })
        .from(planMigrationSubscriptions)
        .where(eq(planMigrationSubscriptions.id, scopeId));
    return row?.status;
}

async function decisionEvents(subscriptionId: string) {
    return db
        .select({ id: domainEvent.id })
        .from(domainEvent)
        .where(
            and(
                eq(domainEvent.entityType, 'subscription'),
                eq(domainEvent.entityId, subscriptionId),
                eq(domainEvent.eventType, 'subscription.amount_mutation_decided'),
                eq(domainEvent.reason, 'S37')
            )
        );
}

/** Delegates every port method to the fake and overrides only `changeAmount`. */
function delegatingProvider(
    fake: FakePaymentProvider,
    changeAmount: PaymentProvider['changeAmount']
): PaymentProvider {
    return {
        capabilitySupport: fake.capabilitySupport,
        authorize: (input) => fake.authorize(input),
        charge: (input) => fake.charge(input),
        chargeOnce: (input) => fake.chargeOnce(input),
        changeAmount,
        pause: (input) => fake.pause(input),
        resume: (input) => fake.resume(input),
        cancel: (input) => fake.cancel(input),
        refund: (input) => fake.refund(input),
        refundOrder: (input) => fake.refundOrder(input),
        readAuthorization: (input) => fake.readAuthorization(input),
        searchAuthorizations: (input) => fake.searchAuthorizations(input),
        readCharge: (input) => fake.readCharge(input),
        listCharges: (input) => fake.listCharges(input),
        readOrder: (input) => fake.readOrder(input),
        searchOrders: (input) => fake.searchOrders(input),
        decodeNotice: (input) => fake.decodeNotice(input)
    };
}

function acceptsWithoutApplying(fake: FakePaymentProvider): PaymentProvider {
    return delegatingProvider(fake, async (input) => ({
        accepted: true,
        resourceId: input.authorizationId
    }));
}

async function compare(caseRow: S37Case, provider: PaymentProvider) {
    const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, caseRow.subscriptionId))
        .limit(1);
    const [providerLink] = await db
        .select()
        .from(providerLinks)
        .where(eq(providerLinks.subscriptionId, caseRow.subscriptionId))
        .limit(1);
    if (!subscription || !providerLink) throw new Error('S37 comparison anchor missing');
    const read = await provider.readAuthorization({
        authorizationId: caseRow.authorizationId
    });
    const act = { kind: 'decision' as const, startedAt: caseRow.clock.now() };
    const comparison = createAmountComparison({
        provider,
        clock: caseRow.clock,
        mutations: createRecordedAmountMutationDecisions()
    });
    return comparison({ subscription, providerLink, read, act });
}

async function expected(
    caseRow: S37Case,
    purpose:
        | { readonly kind: 'AUTHORIZATION' }
        | { readonly kind: 'PERIOD'; readonly chargeCreatedAt: Date }
) {
    const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, caseRow.subscriptionId))
        .limit(1);
    if (!subscription) throw new Error('S37 subscription missing');
    return createCutExpectedAmountPolicy().expectedAmount({ subscription, purpose });
}

async function startWithoutApplying(caseRow: S37Case) {
    expect(await run(caseRow)).toEqual({ outcome: 'NOTICE_PENDING' });
    await markNoticeSent(caseRow);
    expect(await run(caseRow, acceptsWithoutApplying(caseRow.fake))).toEqual({
        outcome: 'NOT_APPLIED'
    });
}

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B12:4 AC:B12:4 S37 sobre un pagador con tarjeta: si la mutación no se aplica',
    () => {
        it('con el falso sin aplicar la mutación, la decisión queda y la cola sigue vacía', async () => {
            const caseRow = await createS37MigrationCase();
            expect(await run(caseRow)).toEqual({ outcome: 'NOTICE_PENDING' });
            await markNoticeSent(caseRow);
            const provider = acceptsWithoutApplying(caseRow.fake);
            const changeAmount = vi.spyOn(provider, 'changeAmount');

            expect(await run(caseRow, provider)).toEqual({ outcome: 'NOT_APPLIED' });

            expect(changeAmount).toHaveBeenCalledTimes(1);
            expect(await queueRows(caseRow.subscriptionId)).toHaveLength(0);
            expect(await scopeRowStatus(caseRow.scope.id)).toBe('PENDIENTE');
            expect(await decisionEvents(caseRow.subscriptionId)).toHaveLength(1);
            vi.restoreAllMocks();
        });

        it('el barrido de ESA suscripción reintenta dentro de la ventana hacia el precio destino y la retoma cierra', async () => {
            const caseRow = await createS37MigrationCase();
            await startWithoutApplying(caseRow);

            // Day one: the sweep retries toward the destination on this row.
            caseRow.clock.set(new Date(S37_DAY.getTime() + 86_400_000));
            const changeAmount = vi.spyOn(caseRow.fake, 'changeAmount');
            expect(await compare(caseRow, caseRow.fake)).toEqual([]);
            expect(changeAmount).toHaveBeenCalledTimes(1);
            expect(changeAmount).toHaveBeenCalledWith({
                authorizationId: caseRow.authorizationId,
                amount: { amountMinor: caseRow.targetAmountMinor, currency: 'ARS' }
            });
            const applied = await caseRow.fake.readAuthorization({
                authorizationId: caseRow.authorizationId
            });
            expect(applied.snapshot.amount).toEqual({
                amountMinor: caseRow.targetAmountMinor,
                currency: 'ARS'
            });

            // The resume reads the destination and closes without mutating again.
            expect(await run(caseRow)).toEqual({ outcome: 'APPLIED_CARD', escalated: false });
            expect(changeAmount).toHaveBeenCalledTimes(1);
            expect(await queueRows(caseRow.subscriptionId)).toHaveLength(1);
        });

        it('a los 3 días se abre la 5 y la cola sigue vacía', async () => {
            const caseRow = await createS37MigrationCase();
            await startWithoutApplying(caseRow);

            caseRow.clock.set(new Date(S37_DAY.getTime() + 3 * 86_400_000 + 1));
            const divergences = await compare(caseRow, caseRow.fake);
            expect(divergences).toHaveLength(1);
            expect(divergences[0]).toMatchObject({ reason: 'DIVERGENCIA_DE_MONTO' });
            expect(divergences[0]?.detail).toContainEqual({
                field: 'reconciliation_mark.expected_minor',
                new: caseRow.targetAmountMinor
            });

            expect(await run(caseRow)).toEqual({ outcome: 'DIVERGED' });
            expect(await queueRows(caseRow.subscriptionId)).toHaveLength(0);
        });

        it('en el borde exacto de los 3 días la comparación y la retoma dan DIVERGED', async () => {
            const caseRow = await createS37MigrationCase();
            await startWithoutApplying(caseRow);

            caseRow.clock.set(new Date(S37_DAY.getTime() + AMOUNT_MUTATION_RETRY_WINDOW_MS));
            const changeAmount = vi.spyOn(caseRow.fake, 'changeAmount');
            const divergences = await compare(caseRow, caseRow.fake);
            expect(divergences).toHaveLength(1);
            expect(divergences[0]).toMatchObject({ reason: 'DIVERGENCIA_DE_MONTO' });
            expect(divergences[0]?.detail).toContainEqual({
                field: 'reconciliation_mark.expected_minor',
                new: caseRow.targetAmountMinor
            });

            expect(await run(caseRow)).toEqual({ outcome: 'DIVERGED' });
            expect(changeAmount).toHaveBeenCalledTimes(0);
            expect(await queueRows(caseRow.subscriptionId)).toHaveLength(0);
            expect(await scopeRowStatus(caseRow.scope.id)).toBe('PENDIENTE');
            vi.restoreAllMocks();
        });

        it('un milisegundo antes del borde la retoma espera al barrido sin escribir', async () => {
            const caseRow = await createS37MigrationCase();
            await startWithoutApplying(caseRow);

            caseRow.clock.set(new Date(S37_DAY.getTime() + AMOUNT_MUTATION_RETRY_WINDOW_MS - 1));
            const changeAmount = vi.spyOn(caseRow.fake, 'changeAmount');

            expect(await run(caseRow)).toEqual({ outcome: 'AWAITING_SWEEP' });

            expect(changeAmount).toHaveBeenCalledTimes(0);
            expect(await queueRows(caseRow.subscriptionId)).toHaveLength(0);
            expect(await scopeRowStatus(caseRow.scope.id)).toBe('PENDIENTE');
            expect(await decisionEvents(caseRow.subscriptionId)).toHaveLength(1);
            vi.restoreAllMocks();
        });

        it('un PaymentProviderError en la mutación deja NOT_APPLIED, la decisión y la fila PENDIENTE', async () => {
            const caseRow = await createS37MigrationCase();
            expect(await run(caseRow)).toEqual({ outcome: 'NOTICE_PENDING' });
            await markNoticeSent(caseRow);

            // The fake's own network-cut simulation makes changeAmount reject with
            // UNAVAILABLE before it touches a ledger; reads stay on the real fake.
            const cut = new FakePaymentProvider({
                clock: caseRow.clock,
                idNamespace: crypto.randomUUID(),
                simulate: [
                    {
                        simulation: 'networkCut',
                        why: 'S37 must leave the row pending when the provider cannot be reached'
                    }
                ]
            });
            const provider = delegatingProvider(caseRow.fake, (input) => cut.changeAmount(input));
            const changeAmount = vi.spyOn(cut, 'changeAmount');

            expect(await run(caseRow, provider)).toEqual({ outcome: 'NOT_APPLIED' });

            expect(changeAmount).toHaveBeenCalledTimes(1);
            vi.restoreAllMocks();
            const after = await caseRow.fake.readAuthorization({
                authorizationId: caseRow.authorizationId
            });
            expect(after.snapshot.amount).toEqual({ amountMinor: 250000, currency: 'ARS' });
            expect(await queueRows(caseRow.subscriptionId)).toHaveLength(0);
            expect(await scopeRowStatus(caseRow.scope.id)).toBe('PENDIENTE');
            expect(await decisionEvents(caseRow.subscriptionId)).toHaveLength(1);
        });

        it('un error que no es del proveedor se propaga sin escribir', async () => {
            const caseRow = await createS37MigrationCase();
            expect(await run(caseRow)).toEqual({ outcome: 'NOTICE_PENDING' });
            await markNoticeSent(caseRow);
            const provider = delegatingProvider(caseRow.fake, async () => {
                throw new Error('database unavailable');
            });

            await expect(run(caseRow, provider)).rejects.toThrow('database unavailable');

            expect(await queueRows(caseRow.subscriptionId)).toHaveLength(0);
            expect(await scopeRowStatus(caseRow.scope.id)).toBe('PENDIENTE');
            expect(await decisionEvents(caseRow.subscriptionId)).toHaveLength(1);
        });

        it('con la decisión registrada, un monto no comparable deja NOT_APPLIED sin escribir', async () => {
            const caseRow = await createS37MigrationCase();
            expect(await run(caseRow)).toEqual({ outcome: 'NOTICE_PENDING' });
            await markNoticeSent(caseRow);
            const changeAmount = vi.spyOn(caseRow.fake, 'changeAmount');

            // Declared seed: the subscription stops being a principal right after
            // the decision transaction commits and before the expected amount is read.
            const original = db.transaction.bind(db);
            let calls = 0;
            vi.spyOn(db, 'transaction').mockImplementation(((
                callback: Parameters<typeof original>[0]
            ) => {
                calls += 1;
                return original(callback).then(async (result) => {
                    if (calls === 2)
                        await db
                            .update(subscriptions)
                            .set({ class: 'COMPLEMENTO' })
                            .where(eq(subscriptions.id, caseRow.subscriptionId));
                    return result;
                });
            }) as typeof db.transaction);

            expect(await run(caseRow)).toEqual({ outcome: 'NOT_APPLIED' });

            expect(changeAmount).toHaveBeenCalledTimes(0);
            expect(await queueRows(caseRow.subscriptionId)).toHaveLength(0);
            expect(await scopeRowStatus(caseRow.scope.id)).toBe('PENDIENTE');
            expect(await decisionEvents(caseRow.subscriptionId)).toHaveLength(1);
            vi.restoreAllMocks();
        });

        it('D-1 no cambia nada fuera de su ventana: sin decisión el esperado es el de origen con su promo', async () => {
            const caseRow = await createS37MigrationCase();
            await seedPlanChangePromo({
                subscriptionId: caseRow.subscriptionId,
                userId: caseRow.userId
            });
            const composed = composePromoAmount({ listAmountMinor: 250_000, promos: [PROMO] });

            expect(await expected(caseRow, { kind: 'AUTHORIZATION' })).toEqual({
                kind: 'COMPARABLE',
                amountMinor: composed.amountMinor,
                currency: 'ARS',
                source: 'ANCHORED'
            });
            expect(
                await expected(caseRow, {
                    kind: 'PERIOD',
                    chargeCreatedAt: S37_NEXT_CHARGE_AT
                })
            ).toEqual({
                kind: 'COMPARABLE',
                amountMinor: composed.amountMinor,
                currency: 'ARS',
                source: 'ANCHORED'
            });
        });

        it('con la decisión S37, PERIOD sigue siendo el de hoy y AUTHORIZATION pasa a MIGRATION_DECIDED', async () => {
            const caseRow = await createS37MigrationCase();
            await seedPlanChangePromo({
                subscriptionId: caseRow.subscriptionId,
                userId: caseRow.userId
            });
            await startWithoutApplying(caseRow);
            const composed = composePromoAmount({ listAmountMinor: 250_000, promos: [PROMO] });

            expect(
                await expected(caseRow, {
                    kind: 'PERIOD',
                    chargeCreatedAt: S37_NEXT_CHARGE_AT
                })
            ).toEqual({
                kind: 'COMPARABLE',
                amountMinor: composed.amountMinor,
                currency: 'ARS',
                source: 'ANCHORED'
            });
            expect(await expected(caseRow, { kind: 'AUTHORIZATION' })).toEqual({
                kind: 'COMPARABLE',
                amountMinor: caseRow.targetAmountMinor,
                currency: 'ARS',
                source: 'MIGRATION_DECIDED'
            });
        });

        it('una decisión S37 vieja de otra fila no activa D-1', async () => {
            const caseRow = await createS37MigrationCase();
            await seedPlanChangePromo({
                subscriptionId: caseRow.subscriptionId,
                userId: caseRow.userId
            });
            // Declared seed: an old S37 decision that names a different scope row.
            await domainEventModel.insert({
                eventType: 'subscription.amount_mutation_decided',
                entityType: 'subscription',
                entityId: caseRow.subscriptionId,
                actorType: 'job',
                correlationId: crypto.randomUUID(),
                reason: 'S37',
                changes: [{ field: 'plan_migration_subscription.id', new: crypto.randomUUID() }],
                occurredAt: S37_DAY
            });
            const composed = composePromoAmount({ listAmountMinor: 250_000, promos: [PROMO] });

            expect(await expected(caseRow, { kind: 'AUTHORIZATION' })).toEqual({
                kind: 'COMPARABLE',
                amountMinor: composed.amountMinor,
                currency: 'ARS',
                source: 'ANCHORED'
            });
        });
    }
);
