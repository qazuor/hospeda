import type { Clock } from '@repo/billing-verticals-contract';
import {
    emailOutbox,
    eq,
    inArray,
    planMigrationSubscriptions,
    planMigrations,
    providerLinks,
    subscriptionScheduledChanges,
    subscriptions
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { launchPlanMigration } from '../../../../src/services/billing/plan-migration/plan-migration-launch.service.js';
import { previewPlanMigration } from '../../../../src/services/billing/plan-migration/plan-migration-preview.service.js';
import { getServiceTestDb } from '../helpers.js';
import { createPriceIncreaseCase, migrationClock } from './plan-migration-fixtures.js';
import { S37_DAY, S37_NEXT_CHARGE_AT } from './plan-migration-s37-fixtures.js';

/** Destination list price seeded through action 19 for every S37 increase case. */
export const S37_INCREASE_TARGET_AMOUNT_MINOR = 350000;

/** A clock the test can move, like the retirement S37 fixture uses. */
export interface S37IncreaseClock extends Clock {
    set(at: Date): void;
}

function createS37IncreaseClock(start: Date): S37IncreaseClock {
    let current = new Date(start);
    return {
        now: () => new Date(current),
        set: (at) => {
            current = new Date(at);
        }
    };
}

const cases: Array<{
    readonly migrationId: string;
    readonly subscriptionId: string;
    readonly userId: string;
}> = [];

/** A launched price-increase migration over one real card or seeded-manual principal. */
export interface S37IncreaseCase {
    readonly migrationId: string;
    readonly scope: typeof planMigrationSubscriptions.$inferSelect;
    readonly subscriptionId: string;
    readonly userId: string;
    readonly clock: S37IncreaseClock;
    readonly fake: FakePaymentProvider;
    readonly provider: PaymentProvider;
    readonly authorizationId: string;
    readonly targetPlanVersionId: string;
    readonly targetOptionId: string;
    readonly targetAmountMinor: number;
    readonly case: Awaited<ReturnType<typeof createPriceIncreaseCase>>;
}

/**
 * Launches a real price-increase migration and leaves ONE `PENDIENTE` `ACTIVE` row.
 *
 * The case comes from `createPriceIncreaseCase` (the same assembly c1 built) and
 * the migration is launched through `previewPlanMigration` + `launchPlanMigration`
 * with `reason: 'PRICE_INCREASE'`. Two states are seeded because no service sets
 * them here: the next charge is moved to the S37 application day (a real renewal
 * would have advanced it), and the MANUAL payer is the shared fixture's card
 * subscription flipped to `MANUAL`.
 *
 * For card cases the provider link is repointed to a fresh fake authorization on
 * the case clock, so a decision can be read fresh at the S37 instant.
 *
 * @param options.paymentMethod - CARD (default) or MANUAL
 * @param options.start - The case clock's start instant
 * @param options.nextChargeAt - Overrides the seeded next charge (and thus the application day)
 * @returns Everything a S37 increase test needs
 */
export async function createS37IncreaseCase(
    options: {
        readonly paymentMethod?: 'CARD' | 'MANUAL';
        readonly start?: Date;
        readonly nextChargeAt?: Date;
    } = {}
): Promise<S37IncreaseCase> {
    const paymentMethod = options.paymentMethod ?? 'CARD';
    const nextChargeAt = options.nextChargeAt ?? S37_NEXT_CHARGE_AT;
    const seeded = await createPriceIncreaseCase({
        nextChargeAt,
        targetAmountMinor: S37_INCREASE_TARGET_AMOUNT_MINOR
    });
    const db = getServiceTestDb();
    await db
        .update(subscriptions)
        .set({ nextChargeAt, paymentMethod })
        .where(eq(subscriptions.id, seeded.predecessor.id));
    const input = {
        sourcePlanVersionId: seeded.planVersionId,
        targetPlanVersionId: seeded.increaseTarget.id,
        reason: 'PRICE_INCREASE' as const
    };
    const preview = await previewPlanMigration({
        actor: seeded.actor,
        input,
        verticals: seeded.verticals,
        clock: migrationClock
    });
    const launched = await launchPlanMigration({
        actor: seeded.actor,
        input: { ...input, cohortFingerprint: preview.cohortFingerprint },
        verticals: seeded.verticals,
        clock: migrationClock
    });
    const [scope] = await db
        .select()
        .from(planMigrationSubscriptions)
        .where(eq(planMigrationSubscriptions.planMigrationId, launched.planMigrationId));
    if (!scope) throw new Error('S37 increase scope missing');

    const clock = createS37IncreaseClock(options.start ?? S37_DAY);
    let fake = seeded.fake;
    let provider: PaymentProvider = seeded.provider;
    let authorizationId = seeded.started.authorizationId;
    if (paymentMethod === 'CARD') {
        fake = new FakePaymentProvider({
            clock,
            idNamespace: crypto.randomUUID(),
            honestAbout: [
                { lie: 'M1', why: 'S37 increase fixture starts from a healthy authorization' }
            ]
        });
        const authorization = await fake.authorize({
            reference: `s37-increase-${crypto.randomUUID()}`,
            amount: { amountMinor: 250000, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'S37 increase fixture authorization',
            returnUrl: 'https://hospeda.example/account',
            payerEmail: seeded.user.email
        });
        await fake.approve({ authorizationId: authorization.authorizationId });
        await db
            .update(providerLinks)
            .set({ providerId: authorization.authorizationId, provider: 'MERCADO_PAGO' })
            .where(eq(providerLinks.subscriptionId, seeded.predecessor.id));
        provider = fake;
        authorizationId = authorization.authorizationId;
    }

    cases.push({
        migrationId: launched.planMigrationId,
        subscriptionId: seeded.predecessor.id,
        userId: seeded.user.id
    });
    return {
        migrationId: launched.planMigrationId,
        scope,
        subscriptionId: seeded.predecessor.id,
        userId: seeded.user.id,
        clock,
        fake,
        provider,
        authorizationId,
        targetPlanVersionId: seeded.increaseTarget.id,
        targetOptionId: seeded.increaseTargetOption.id,
        targetAmountMinor: S37_INCREASE_TARGET_AMOUNT_MINOR,
        case: seeded
    };
}

/**
 * Removes only what S37 increase cases created; catalog versions stay untouched.
 *
 * It does NOT call `cleanupPlanMigrationCases`: that helper deletes the shared
 * subscriptions, so it must run after EVERY case fixture (this one and the
 * retirement `cleanupS37Cases`) has removed its participation rows.
 */
export async function cleanupIncreaseCases(): Promise<void> {
    const db = getServiceTestDb();
    const own = cases.splice(0);
    if (own.length) {
        const userIds = own.map((entry) => entry.userId);
        const subscriptionIds = own.map((entry) => entry.subscriptionId);
        const migrationIds = own.map((entry) => entry.migrationId);
        await db.delete(emailOutbox).where(inArray(emailOutbox.recipientUserId, userIds));
        await db
            .delete(subscriptionScheduledChanges)
            .where(inArray(subscriptionScheduledChanges.subscriptionId, subscriptionIds));
        await db
            .delete(planMigrationSubscriptions)
            .where(inArray(planMigrationSubscriptions.planMigrationId, migrationIds));
        await db.delete(planMigrations).where(inArray(planMigrations.id, migrationIds));
    }
}
