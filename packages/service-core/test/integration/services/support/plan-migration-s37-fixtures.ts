import type { Clock } from '@repo/billing-verticals-contract';
import {
    and,
    billingOptions,
    emailOutbox,
    eq,
    inArray,
    manualPayments,
    planMigrationSubscriptions,
    planMigrations,
    providerLinks,
    subscriptionScheduledChanges,
    subscriptions,
    users
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { launchPlanMigration } from '../../../../src/services/billing/plan-migration/plan-migration-launch.service.js';
import { previewPlanMigration } from '../../../../src/services/billing/plan-migration/plan-migration-preview.service.js';
import { getServiceTestDb } from '../helpers.js';
import {
    cleanupPlanMigrationCases,
    createPlanMigrationCase,
    migrationClock,
    setMigrationTargetCycle
} from './plan-migration-fixtures.js';

/** Destination list price seeded through action 19 for every S37 case. */
export const S37_TARGET_AMOUNT_MINOR = 300000;
/**
 * The row's next charge, which is also its migration application day.
 * It is before noon UTC on purpose: a queue effective at the application date's
 * noon would not be due yet when `MP5` opens the period at this instant.
 */
export const S37_NEXT_CHARGE_AT = new Date('2026-12-11T11:00:00.000Z');
/** Seven local days before {@link S37_NEXT_CHARGE_AT}. */
export const S37_DAY = new Date('2026-12-04T13:00:00.000Z');

/** A clock the test can move, like the notice batch tests use. */
export interface S37Clock extends Clock {
    set(at: Date): void;
}

function createS37Clock(start: Date): S37Clock {
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
    readonly scopeId: string;
    readonly subscriptionId: string;
    readonly userId: string;
}> = [];
const extraRecipients: string[] = [];

/** A launched retirement migration over one real card or seeded-manual principal. */
export interface S37Case {
    readonly migrationId: string;
    readonly scope: typeof planMigrationSubscriptions.$inferSelect;
    readonly subscriptionId: string;
    readonly userId: string;
    readonly clock: S37Clock;
    readonly fake: FakePaymentProvider;
    readonly provider: PaymentProvider;
    readonly authorizationId: string;
    readonly targetPlanVersionId: string;
    readonly targetOptionId: string;
    readonly targetAmountMinor: number;
    readonly case: Awaited<ReturnType<typeof createPlanMigrationCase>>;
}

/**
 * Launches a real retirement migration and leaves ONE `PENDIENTE` `ACTIVE` row.
 *
 * The principal and the migration come from `createPlanMigrationCase` +
 * `previewPlanMigration`/`launchPlanMigration`. Two states are seeded because
 * no service starts them here: the next charge is moved to the application day
 * (a real renewal would have advanced it), and the MANUAL payer is the shared
 * fixture's card subscription flipped to `MANUAL` (manual signup only exists for
 * manual-only verticals).
 *
 * For card cases the provider link is repointed to a fresh fake authorization
 * on the case clock, so a decision can be read fresh at the S37 instant.
 *
 * @param options.paymentMethod - CARD (default) or MANUAL
 * @param options.start - The case clock's start instant
 * @returns Everything a S37 test needs
 */
export async function createS37MigrationCase(
    options: { readonly paymentMethod?: 'CARD' | 'MANUAL'; readonly start?: Date } = {}
): Promise<S37Case> {
    const paymentMethod = options.paymentMethod ?? 'CARD';
    const seeded = await createPlanMigrationCase();
    const db = getServiceTestDb();
    await db
        .update(subscriptions)
        .set({ nextChargeAt: S37_NEXT_CHARGE_AT, paymentMethod })
        .where(eq(subscriptions.id, seeded.predecessor.id));
    await setMigrationTargetCycle({
        actor: seeded.actor,
        planVersionId: seeded.targetPlanVersionId,
        cycle: 'monthly',
        amount: S37_TARGET_AMOUNT_MINOR
    });
    const input = {
        sourcePlanVersionId: seeded.planVersionId,
        targetPlanVersionId: seeded.targetPlanVersionId
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
    if (!scope) throw new Error('S37 migration scope missing');
    const [targetOption] = await db
        .select({ id: billingOptions.id })
        .from(billingOptions)
        .where(
            and(
                eq(billingOptions.planVersionId, seeded.targetPlanVersionId),
                eq(billingOptions.cycle, 'monthly')
            )
        )
        .limit(1);
    if (!targetOption) throw new Error('S37 destination monthly option missing');

    const clock = createS37Clock(options.start ?? S37_DAY);
    let fake = seeded.fake;
    let provider: PaymentProvider = seeded.provider;
    let authorizationId = seeded.started.authorizationId;
    if (paymentMethod === 'CARD') {
        fake = new FakePaymentProvider({
            clock,
            idNamespace: crypto.randomUUID(),
            honestAbout: [
                { lie: 'M1', why: 'S37 card fixture starts from a healthy authorization' }
            ]
        });
        const authorization = await fake.authorize({
            reference: `s37-${crypto.randomUUID()}`,
            amount: { amountMinor: 250000, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'S37 fixture authorization',
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
        scopeId: scope.id,
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
        targetPlanVersionId: seeded.targetPlanVersionId,
        targetOptionId: targetOption.id,
        targetAmountMinor: S37_TARGET_AMOUNT_MINOR,
        case: seeded
    };
}

/** Registers a recipient user so its outbox rows and the user are removed with the case. */
export function trackS37Recipient(userId: string): void {
    extraRecipients.push(userId);
}

/** Removes only what S37 cases created; catalog versions stay untouched. */
export async function cleanupS37Cases(): Promise<void> {
    const db = getServiceTestDb();
    const own = cases.splice(0);
    const recipients = [...extraRecipients.splice(0)];
    const recipientsOfCase = own.map((entry) => entry.userId);
    const allRecipients = [...recipientsOfCase, ...recipients];
    if (allRecipients.length)
        await db.delete(emailOutbox).where(inArray(emailOutbox.recipientUserId, allRecipients));
    if (own.length) {
        const subscriptionIds = own.map((entry) => entry.subscriptionId);
        await db
            .delete(subscriptionScheduledChanges)
            .where(inArray(subscriptionScheduledChanges.subscriptionId, subscriptionIds));
        await db
            .delete(manualPayments)
            .where(inArray(manualPayments.subscriptionId, subscriptionIds));
        const migrationIds = own.map((entry) => entry.migrationId);
        await db
            .delete(planMigrationSubscriptions)
            .where(inArray(planMigrationSubscriptions.planMigrationId, migrationIds));
        await db.delete(planMigrations).where(inArray(planMigrations.id, migrationIds));
    }
    for (const id of recipients) await db.delete(users).where(eq(users.id, id));
    await cleanupPlanMigrationCases();
}
