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
import { getLocalDateString } from '@repo/utils';
import { launchPlanMigration } from '../../../../src/services/billing/plan-migration/plan-migration-launch.service.js';
import { previewPlanMigration } from '../../../../src/services/billing/plan-migration/plan-migration-preview.service.js';
import { getServiceTestDb } from '../helpers.js';
import { seedPlanChangePromo } from './plan-change-fixtures.js';
import { createPriceIncreaseCase, migrationClock } from './plan-migration-fixtures.js';
import { S37_DAY, S37_NEXT_CHARGE_AT } from './plan-migration-s37-fixtures.js';

/** Destination list price seeded through action 19 for every S37 increase case. */
export const S37_INCREASE_TARGET_AMOUNT_MINOR = 350000;
/** Source plan price the river customer pays before the increase (seeded literal). */
export const INCREASE_CURRENT_AMOUNT_MINOR = 250000;
/** Fixed discount of the promo a journey may seed (mirrors `seedPlanChangePromo`). */
export const INCREASE_PROMO_VALUE_MINOR = 1000;

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

/** Shift a local `YYYY-MM-DD` day by a signed number of days. */
export function shiftLocalDay(day: string, days: number): string {
    const value = new Date(`${day}T12:00:00.000Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
}

/** A market-local morning on the given day, safe for the notice window comparison. */
export function localDayInstant(day: string): Date {
    return new Date(`${day}T13:00:00.000Z`);
}

/** Promo seeded alive on a journey's subscription. */
export interface IncreaseJourneyPromo {
    readonly id: string;
    readonly remainingCharges: number | null;
}

/** One real monthly or annual price-increase journey, from launch to the customer's date. */
export interface IncreaseJourney {
    readonly cycle: 'monthly' | 'annual';
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
    readonly currentAmountMinor: number;
    readonly applicationDate: string;
    readonly announcedAt: Date;
    readonly deadlineVersion: number;
    readonly promo: IncreaseJourneyPromo | null;
    readonly case: Awaited<ReturnType<typeof createPriceIncreaseCase>>;
}

/**
 * Launches a REAL price-increase migration for one card customer and moves it
 * to its application day.
 *
 * The customer and the migration come from `createPriceIncreaseCase` (c1) plus
 * `previewPlanMigration`/`launchPlanMigration` with `reason: 'PRICE_INCREASE'`;
 * the provider is a `FakePaymentProvider` holding a healthy authorization on the
 * journey clock (never a hand-written double).
 *
 * Two states are seeded because no service starts them here:
 * - the next charge is moved to the value the journey declares, because a real
 *   renewal between signup and announcement would have advanced it;
 * - a promo, when requested, is seeded through `seedPlanChangePromo` (declared
 *   seed: its code and redemption rows are not created by a redemption service).
 *
 * @param options.cycle - The customer's billing cycle (`monthly` or `annual`)
 * @param options.nextChargeAt - The customer's next charge at announcement time
 * @param options.withPromo - Seed a live fixed 1000 promo before launching
 * @param options.start - The journey clock's first instant
 * @returns Everything the end-to-end tests need
 */
export async function createIncreaseJourney(options: {
    readonly cycle: 'monthly' | 'annual';
    readonly nextChargeAt: Date;
    readonly withPromo?: boolean;
    readonly start?: Date;
}): Promise<IncreaseJourney> {
    const seeded = await createPriceIncreaseCase({
        sourceCycle: options.cycle,
        targetCycle: options.cycle,
        targetAmountMinor: S37_INCREASE_TARGET_AMOUNT_MINOR,
        nextChargeAt: options.nextChargeAt
    });
    const db = getServiceTestDb();
    await db
        .update(subscriptions)
        .set({ nextChargeAt: options.nextChargeAt, paymentMethod: 'CARD' })
        .where(eq(subscriptions.id, seeded.predecessor.id));
    const promo = options.withPromo
        ? await seedPlanChangePromo({
              subscriptionId: seeded.predecessor.id,
              userId: seeded.user.id
          })
        : null;
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
    if (!scope) throw new Error('S37 increase journey scope missing');
    const applicationDate = getLocalDateString({ instant: scope.applicationDate });

    const clock = createS37IncreaseClock(options.start ?? localDayInstant(applicationDate));
    const fake = new FakePaymentProvider({
        clock,
        idNamespace: crypto.randomUUID(),
        honestAbout: [
            { lie: 'M1', why: 'the increase journey starts from a healthy authorization' }
        ]
    });
    const authorization = await fake.authorize({
        reference: `increase-journey-${crypto.randomUUID()}`,
        amount: { amountMinor: INCREASE_CURRENT_AMOUNT_MINOR, currency: 'ARS' },
        cadence: { everyMonths: options.cycle === 'annual' ? 12 : 1 },
        reason: 'Increase journey authorization',
        returnUrl: 'https://hospeda.example/account',
        payerEmail: seeded.user.email
    });
    await fake.approve({ authorizationId: authorization.authorizationId });
    await db
        .update(providerLinks)
        .set({ providerId: authorization.authorizationId, provider: 'MERCADO_PAGO' })
        .where(eq(providerLinks.subscriptionId, seeded.predecessor.id));

    cases.push({
        migrationId: launched.planMigrationId,
        subscriptionId: seeded.predecessor.id,
        userId: seeded.user.id
    });
    return {
        cycle: options.cycle,
        migrationId: launched.planMigrationId,
        scope,
        subscriptionId: seeded.predecessor.id,
        userId: seeded.user.id,
        clock,
        fake,
        provider: fake,
        authorizationId: authorization.authorizationId,
        targetPlanVersionId: seeded.increaseTarget.id,
        targetOptionId: seeded.increaseTargetOption.id,
        targetAmountMinor: S37_INCREASE_TARGET_AMOUNT_MINOR,
        currentAmountMinor: INCREASE_CURRENT_AMOUNT_MINOR,
        applicationDate,
        announcedAt: launched.announcedAt,
        deadlineVersion: launched.deadlineVersion,
        promo: promo ? { id: promo.id, remainingCharges: promo.remainingCharges } : null,
        case: seeded
    };
}

/**
 * Moves the subscription's next charge onto its application day.
 *
 * It is a seeded state, not a service call: in production the customer's
 * renewal charge before the application date advances `next_charge_at` on its
 * own, which is what makes `S37`'s day match the scope row.
 */
export async function alignNextChargeWithApplication(journey: IncreaseJourney): Promise<void> {
    await getServiceTestDb()
        .update(subscriptions)
        .set({ nextChargeAt: localDayInstant(journey.applicationDate) })
        .where(eq(subscriptions.id, journey.subscriptionId));
}
