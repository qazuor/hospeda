import {
    billingOptions,
    domainEvent,
    eq,
    getDb,
    planVersions,
    subscriptions,
    users
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { PermissionEnum } from '@repo/schemas';
import {
    activateSubscription,
    readAnchoredBillingOption,
    startSubscription
} from '@repo/service-core';
import { ensureBillingDeadlineVersion1 } from '../helpers/billing-deadline-version.js';
import { insertPlan, insertVersion } from '../plan-publication/plan-publication.helpers.js';

export const PRICE_PATH = '/api/v1/admin/billing-prices';
export const previewPath = `${PRICE_PATH}/preview`;
export async function seedActor() {
    const [actor] = await getDb()
        .insert(users)
        .values({
            email: `cycle-actor-${crypto.randomUUID()}@example.test`,
            displayName: 'Cycle price actor',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning({ id: users.id });
    if (!actor) throw new Error('Missing actor');
    return actor.id;
}

export function actorHeaders(id: string, allowed = true) {
    return {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-admin-token',
        'User-Agent': 'vitest',
        'x-mock-actor-id': id,
        'x-mock-actor-role': allowed ? 'SUPER_ADMIN' : 'ADMIN',
        'x-mock-actor-permissions': JSON.stringify(
            allowed
                ? [
                      PermissionEnum.ACCESS_PANEL_ADMIN,
                      PermissionEnum.BILLING_SET_CYCLE_PRICE,
                      PermissionEnum.MAINTENANCE_MODE_WRITE
                  ]
                : [PermissionEnum.ACCESS_PANEL_ADMIN]
        )
    };
}

/** Insert only the starting plan catalog, using an isolated slug and rank. */
export async function seedPriceVersion(
    args: { graceDays?: number; sellable?: boolean; current?: boolean } = {}
) {
    const planId = await insertPlan({
        vertical: 'accommodation',
        slug: `cycle-api-${crypto.randomUUID()}`
    });
    const rank = Math.floor(Math.random() * 1_000_000_000) + 1000;
    const planVersionId = await insertVersion({
        planId,
        vertical: 'accommodation',
        rank,
        sellable: args.sellable ?? true,
        current: args.current ?? true,
        graceDays: args.graceDays ?? 10,
        trialDays: 0,
        allowsPause: false
    });
    return { planId, planVersionId, rank };
}

export function previewBody(planVersionId: string, amount: number, cycle = 'monthly') {
    return { planVersionId, amount, cycle };
}

export function actBody(
    planVersionId: string,
    amount: number,
    expectedPreviousAmount: number | null = null,
    cycle = 'monthly'
) {
    return {
        ...previewBody(planVersionId, amount, cycle),
        expectedPreviousAmount,
        confirmed: true
    };
}

export async function priceState(planVersionId: string) {
    const options = await getDb()
        .select()
        .from(billingOptions)
        .where(eq(billingOptions.planVersionId, planVersionId));
    const events = options.length
        ? (
              await getDb()
                  .select()
                  .from(domainEvent)
                  .where(eq(domainEvent.entityId, options[0]!.id))
          ).filter((row) => row.eventType === 'billing_option.price_set')
        : [];
    return { options, events };
}

/** Start a real subscription against an option produced by action 19. */
export async function startPriceCustomer(args: {
    billingOptionId: string;
    name: string;
    activate?: boolean;
}) {
    await ensureBillingDeadlineVersion1();
    const [user] = await getDb()
        .insert(users)
        .values({
            email: `cycle-${args.name}-${crypto.randomUUID()}@example.test`,
            displayName: args.name,
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning({ id: users.id });
    if (!user) throw new Error('Missing customer');
    const clock = { now: () => new Date('2026-10-08T20:00:00.000Z') };
    const fake = new FakePaymentProvider({
        idNamespace: crypto.randomUUID(),
        clock,
        honestAbout: [{ lie: 'M1', why: 'healthy subscription fixture' }]
    });
    const started = await startSubscription(
        {
            userId: user.id,
            billingOptionId: args.billingOptionId,
            returnUrl: 'https://hospeda.example/account'
        },
        {
            provider: fake,
            clock,
            planPolicy: async ({ planVersionId }) => {
                const [version] = await getDb()
                    .select()
                    .from(planVersions)
                    .where(eq(planVersions.id, planVersionId));
                if (!version) throw new Error('Missing plan policy');
                return {
                    graceDays: version.graceDays,
                    allowsPause: version.allowsPause,
                    current: version.current,
                    sellable: version.sellable
                };
            },
            beforeCancelNotice: { beforeCancel: async () => 'SENT' },
            touristVipInheritance: { inherits: async () => false }
        }
    );
    if (args.activate) {
        await fake.approve({ authorizationId: started.authorizationId });
        const activation = await activateSubscription(started.subscriptionId, {
            provider: fake,
            clock,
            beforeCancelNotice: { beforeCancel: async () => 'SENT' },
            touristVipInheritance: { inherits: async () => false }
        });
        if (!activation.activated) throw new Error('Customer did not activate');
    }
    return { userId: user.id, subscriptionId: started.subscriptionId };
}

export async function anchoredPrice(subscriptionId: string) {
    const [subscription] = await getDb()
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
    if (!subscription?.planVersionId || !subscription.billingOptionId)
        throw new Error('Missing subscription anchor');
    return {
        planVersionId: subscription.planVersionId,
        option: await readAnchoredBillingOption({
            subscription: {
                planVersionId: subscription.planVersionId,
                billingOptionId: subscription.billingOptionId
            }
        })
    };
}
