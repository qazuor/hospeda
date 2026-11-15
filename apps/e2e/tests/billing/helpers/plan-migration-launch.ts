import type { Browser, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { computeApplicationDate } from '@repo/service-core';
import { z } from 'zod';
import type { CreatedUser } from '../../../fixtures/api-helpers.ts';
import { type FakeWorld, runCron } from '../../../fixtures/arrears-cycle.ts';
import { readSubscriptionRow } from '../../../fixtures/cancellation-flow.ts';
import { execSQL } from '../../../fixtures/db-helpers.ts';
import {
    createMigrationPlan,
    priceMigrationVersion,
    publishMigrationVersion,
    subscribeMigrationCustomer
} from '../../../fixtures/plan-migration-flow.ts';
import {
    type CardCase,
    createPausableMigrationPlan,
    pauseOwn,
    seedManualPayer,
    startCardCase
} from './plan-migration-cases.ts';

/** Noon in Buenos Aires: the instant of a local day that no offset moves. */
const MARKET_NOON = 'T15:00:00.000Z';

/** The market-noon instant of a local day (`YYYY-MM-DD`). */
export function anchorOf(day: string): Date {
    return new Date(`${day}${MARKET_NOON}`);
}

const RetirementDeadline = z.object({
    '12': z.object({
        noticeDays: z.number().int().positive(),
        contactDays: z.array(z.number().int().positive()).min(1)
    })
});

/** A cohort member with a card authorization in the fake. */
export type Customer = CardCase & { readonly user: CreatedUser };

/** Everything the launch needs: the two plans and one subscription of each case. */
export interface MigrationCohort {
    readonly sourcePlanId: string;
    readonly sourceVersionId: string;
    readonly targetVersionId: string;
    readonly targetOptionId: string;
    /** Local day every dated member of the cohort will migrate on. */
    readonly applicationDay: string;
    readonly deadlineVersion: number;
    readonly noticeDays: number;
    readonly contactDays: readonly number[];
    readonly card: Customer;
    readonly planChanger: Customer;
    readonly canceller: Customer;
    readonly abandoner: Customer;
    readonly paused: Customer;
    readonly grace: Customer;
    readonly manual: { readonly user: CreatedUser; readonly subscriptionId: string };
}

/**
 * Build the retired plan's cohort before the launch reads it.
 *
 * - card: web checkout (the payer `S37` mutates);
 * - planChanger, canceller, grace: API card checkouts, active;
 * - paused: API card checkout, then a real self-pause;
 * - abandoner: API card checkout left `PENDING_AUTHORIZATION`;
 * - manual: seeded manual payer whose next charge is the cohort's application day.
 *
 * Then it prices a sellable successor, and retires the source by publishing a
 * non-sellable version (action 18). `onSourceVersion` reports the source version
 * id as soon as it exists, so the caller's cleanup sees it even on a failure.
 */
export async function buildMigrationCohort(args: {
    readonly page: Page;
    readonly browser: Browser;
    readonly world: FakeWorld;
    readonly admin: CreatedUser;
    readonly users: readonly CreatedUser[];
    readonly limitKey: string;
    readonly rank: number;
    readonly price: number;
    readonly newPrice: number;
    readonly onSourceVersion: (versionId: string) => void;
}): Promise<MigrationCohort> {
    const { page, admin, world } = args;
    const [cardUser, changerUser, cancellerUser, abandonerUser, pausedUser, graceUser, manualUser] =
        args.users;
    if (!cardUser || !changerUser || !cancellerUser || !abandonerUser)
        throw new Error('Expected seven cohort users.');
    if (!pausedUser || !graceUser || !manualUser) throw new Error('Expected seven cohort users.');
    const source = await createPausableMigrationPlan({
        page,
        admin,
        label: 'retired',
        limitKey: args.limitKey,
        rank: args.rank
    });
    args.onSourceVersion(source.versionId);
    const sourceOption = await priceMigrationVersion({
        page,
        admin,
        versionId: source.versionId,
        amount: args.price
    });
    const context = await args.browser.newContext();
    let cardSubscriptionId = '';
    try {
        cardSubscriptionId = await subscribeMigrationCustomer({
            page: await context.newPage(),
            world,
            user: cardUser,
            billingOptionId: sourceOption
        });
    } finally {
        await context.close();
    }
    const [cardLink] = await execSQL<{ provider_id: string }>(
        'SELECT provider_id FROM provider_link WHERE subscription_id = $1',
        [cardSubscriptionId]
    );
    if (!cardLink) throw new Error('Expected the card checkout authorization.');
    const card = {
        user: cardUser,
        subscriptionId: cardSubscriptionId,
        authorizationId: cardLink.provider_id
    };
    const startCase = async (user: CreatedUser, activate: boolean): Promise<Customer> => ({
        user,
        ...(await startCardCase({ world, user, billingOptionId: sourceOption, activate }))
    });
    const planChanger = await startCase(changerUser, true);
    const canceller = await startCase(cancellerUser, true);
    const paused = await startCase(pausedUser, true);
    const grace = await startCase(graceUser, true);
    const abandoner = await startCase(abandonerUser, false);

    const target = await createMigrationPlan({
        page,
        admin,
        label: 'successor',
        limitKey: args.limitKey,
        limitValue: 3,
        rank: args.rank + 1
    });
    const targetOptionId = await priceMigrationVersion({
        page,
        admin,
        versionId: target.versionId,
        amount: args.newPrice
    });
    // The sweep copies each provider next charge onto its subscription (HOS-1685).
    await runCron({ jobName: 'billing-reconciliation-sweep', adminCookie: admin.sessionCookie });
    await pauseOwn({ user: paused.user, subscriptionId: paused.subscriptionId, months: 4 });
    expect((await readSubscriptionRow({ subscriptionId: paused.subscriptionId })).status).toBe(
        'PAUSED'
    );

    const [anchor] = await execSQL<{ next_charge_at: Date | null }>(
        'SELECT next_charge_at FROM subscription WHERE id = $1',
        [card.subscriptionId]
    );
    if (!anchor?.next_charge_at) throw new Error('Expected the card next charge after the sweep.');
    const [deadlines] = await execSQL<{ version: number; values: unknown }>(
        'SELECT version, "values" FROM billing_deadline_version ORDER BY version DESC LIMIT 1'
    );
    if (!deadlines) throw new Error('Expected a billing deadline version.');
    const retirement = RetirementDeadline.parse(deadlines.values)['12'];
    // Same rule the launch applies (plan-migration-application-date.ts).
    const applicationDay = computeApplicationDate({
        nextChargeAt: new Date(anchor.next_charge_at),
        cycle: 'monthly',
        announcedAt: world.clock.now(),
        noticeDays: retirement.noticeDays
    });
    const manual = {
        user: manualUser,
        subscriptionId: await seedManualPayer({
            user: manualUser,
            planVersionId: source.versionId,
            billingOptionId: sourceOption,
            nextChargeAt: anchorOf(applicationDay),
            now: world.clock.now()
        })
    };
    await publishMigrationVersion({
        page,
        admin,
        planId: source.planId,
        rank: args.rank + 2,
        sellable: false,
        limitKey: args.limitKey,
        limitValue: 2
    });
    return {
        sourcePlanId: source.planId,
        sourceVersionId: source.versionId,
        targetVersionId: target.versionId,
        targetOptionId,
        applicationDay,
        deadlineVersion: deadlines.version,
        noticeDays: retirement.noticeDays,
        contactDays: retirement.contactDays,
        card,
        planChanger,
        canceller,
        abandoner,
        paused,
        grace,
        manual
    };
}
