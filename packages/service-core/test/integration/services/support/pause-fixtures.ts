import type { VerticalsForBilling } from '@repo/billing-verticals-contract';
import {
    and,
    billingOptions,
    courtesyGrants,
    coverageLosses,
    eq,
    inArray,
    isNull,
    providerLinks,
    reconciliationMarks,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { getServiceTestDb } from '../helpers.js';
import { complementNow, type providerHarness } from './complement-fixtures.js';
import { seedCoveragePlanVersion, seedCoverageUser } from './coverage-fixtures.js';

const createAdjustableClock = ({ start }: { readonly start: Date }) => {
    let current = start;
    return {
        now: () => current,
        set: ({ at }: { readonly at: Date }) => {
            current = at;
        }
    };
};

/** Builds an adjustable fake and a provider proxy for deterministic S10 rereads. */
export function adjustablePauseHarness(
    options: {
        readonly honestM12?: boolean;
        readonly withoutRP10?: boolean;
        readonly resumeAcknowledgesOnly?: boolean;
    } = {}
) {
    const clock = createAdjustableClock({ start: complementNow });
    const fake = new FakePaymentProvider({
        clock,
        idNamespace: crypto.randomUUID(),
        ...(options.honestM12
            ? { honestAbout: [{ lie: 'M12', why: 'exercise automatic return' }] }
            : {}),
        ...(options.withoutRP10
            ? { withoutBehaviour: [{ behaviour: 'RP10', why: 'exercise unchanged calendar' }] }
            : {})
    });
    const calls: string[] = [];
    const provider = new Proxy(fake as PaymentProvider, {
        get(target, property, receiver) {
            if (property === 'resume')
                return async (input: { readonly authorizationId: string }) => {
                    calls.push(`resume:${input.authorizationId}`);
                    if (options.resumeAcknowledgesOnly)
                        return { accepted: true as const, resourceId: input.authorizationId };
                    return fake.resume(input);
                };
            if (property === 'pause')
                return async (input: { readonly authorizationId: string }) => {
                    calls.push(`pause:${input.authorizationId}`);
                    return fake.pause(input);
                };
            const method = Reflect.get(target, property, receiver);
            return typeof method === 'function' ? method.bind(target) : method;
        }
    });
    return { clock, fake, provider, calls };
}

const seededSubscriptions: string[] = [];
const seededUsers: string[] = [];

/** Seeds one card principal with a real authorization in the fake provider. */
export async function seedPausePrincipal(input: {
    readonly harness: ReturnType<typeof providerHarness>;
    readonly cycle?: 'monthly' | 'annual';
    readonly paymentMethod?: 'CARD' | 'MANUAL';
    readonly status?: string;
    readonly userId?: string;
    readonly succeedsId?: string;
}): Promise<{
    readonly subscriptionId: string;
    readonly userId: string;
    readonly planVersionId: string;
    readonly authorizationId: string;
}> {
    const authorization = await input.harness.fake.authorize({
        reference: `pause-${crypto.randomUUID()}`,
        amount: { amountMinor: 250000, currency: 'ARS' },
        cadence: { everyMonths: 1 },
        reason: 'principal pause test',
        returnUrl: 'https://example.test/return',
        payerEmail: `pause-${crypto.randomUUID()}@example.test`
    });
    await input.harness.fake.approve({ authorizationId: authorization.authorizationId });
    const db = getServiceTestDb();
    const seeded = await db.transaction(async (tx) => {
        const userId = input.userId ?? (await seedCoverageUser(tx)).userId;
        if (!input.userId) seededUsers.push(userId);
        const { planVersionId, billingOptionId } = await seedCoveragePlanVersion(
            tx,
            'accommodation'
        );
        if (input.cycle === 'annual')
            await tx
                .update(billingOptions)
                .set({ cycle: 'annual' })
                .where(eq(billingOptions.id, billingOptionId));
        const [row] = await tx
            .insert(subscriptions)
            .values({
                userId,
                vertical: 'accommodation',
                planVersionId,
                billingOptionId,
                paymentMethod: input.paymentMethod ?? 'CARD',
                status: input.status ?? 'ACTIVE',
                class: 'PRINCIPAL',
                succeedsId: input.succeedsId
            })
            .returning({ id: subscriptions.id });
        if (!row) throw new Error('pause principal missing');
        if (input.paymentMethod !== 'MANUAL')
            await tx.insert(providerLinks).values({
                subscriptionId: row.id,
                provider: 'MERCADO_PAGO',
                providerId: authorization.authorizationId
            });
        return {
            subscriptionId: row.id,
            userId,
            planVersionId,
            authorizationId: authorization.authorizationId
        };
    });
    seededSubscriptions.push(seeded.subscriptionId);
    return seeded;
}

/** Contract double for planPolicy, with a selectable allowsPause result. */
export function pausePlanPolicy(allowsPause = true): VerticalsForBilling['planPolicy'] {
    return async () => ({ graceDays: 7, allowsPause, current: true, sellable: true });
}

/** Seeds the same closed customer pause shape that S10 writes. */
export async function seedClosedPause(input: {
    readonly subscriptionId: string;
    readonly startsAt: Date;
    readonly actualEndAt: Date;
    readonly requestedMonths?: number;
}): Promise<void> {
    const requestedMonths = input.requestedMonths ?? 2;
    const expectedEndAt = new Date(input.startsAt);
    expectedEndAt.setUTCMonth(expectedEndAt.getUTCMonth() + requestedMonths);
    await getServiceTestDb().insert(subscriptionPauses).values({
        subscriptionId: input.subscriptionId,
        reason: 'CUSTOMER_REQUEST',
        requestedMonths,
        startsAt: input.startsAt,
        expectedEndAt,
        actualEndAt: input.actualEndAt
    });
}

/** Retires only rows created by this fixture; shared test tables are never truncated. */
export async function retirePauseRows(): Promise<void> {
    const db = getServiceTestDb();
    const subscriptionsToRetire = seededSubscriptions.splice(0);
    const usersToRetire = seededUsers.splice(0);
    if (subscriptionsToRetire.length) {
        await db
            .delete(courtesyGrants)
            .where(inArray(courtesyGrants.subscriptionId, subscriptionsToRetire));
        await db
            .delete(subscriptionPauses)
            .where(inArray(subscriptionPauses.subscriptionId, subscriptionsToRetire));
        await db
            .update(subscriptions)
            .set({ status: 'CANCELLED', graceStartedAt: null, graceEndsAt: null })
            .where(inArray(subscriptions.id, subscriptionsToRetire));
        const actorId = usersToRetire[0];
        if (actorId)
            await db
                .update(reconciliationMarks)
                .set({ liftedAt: complementNow, liftedBy: actorId })
                .where(
                    and(
                        inArray(reconciliationMarks.subscriptionId, subscriptionsToRetire),
                        isNull(reconciliationMarks.liftedAt)
                    )
                );
    }
    if (usersToRetire.length)
        await db.delete(coverageLosses).where(inArray(coverageLosses.userId, usersToRetire));
}
