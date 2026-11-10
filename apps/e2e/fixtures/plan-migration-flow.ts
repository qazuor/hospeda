import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import {
    CreatePlanRequestSchema,
    PublishPlanVersionRequestSchema,
    SetCyclePriceRequestSchema
} from '@repo/schemas';
import { z } from 'zod';
import type { CreatedUser } from './api-helpers.ts';
import {
    API_URL,
    activateCardSubscription,
    type FakeWorld,
    recordCreditedCycle
} from './arrears-cycle.ts';
import { seedCookieConsent } from './browser-helpers.ts';
import { execSQL } from './db-helpers.ts';
import { attachSession, confirmSignupCheckout, openSignupCheckout } from './signup-checkout.ts';

const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:18321';
const PlanId = z.object({ data: z.object({ id: z.string().uuid() }) });
const PriceId = z.object({
    data: z.object({ billingOption: z.object({ id: z.string().uuid() }) })
});

/** Create an isolated action 18 plan and its first published version. */
export async function createMigrationPlan(args: {
    readonly page: Page;
    readonly admin: CreatedUser;
    readonly label: string;
    readonly limitKey: string;
    readonly limitValue: number;
    readonly rank: number;
}): Promise<{ readonly planId: string; readonly versionId: string }> {
    const headers = { cookie: args.admin.sessionCookie };
    const plan = await args.page.request.post(`${API_URL}/api/v1/admin/plan-catalog/plans`, {
        headers,
        data: CreatePlanRequestSchema.parse({
            vertical: 'accommodation',
            slug: `migration-${args.label}-${randomUUID()}`,
            name: `Migration ${args.label}`,
            role: null
        })
    });
    expect(plan.ok(), await plan.text()).toBe(true);
    const planId = PlanId.parse(await plan.json()).data.id;
    const versionId = await publishMigrationVersion({
        page: args.page,
        admin: args.admin,
        planId,
        rank: args.rank,
        sellable: true,
        limitKey: args.limitKey,
        limitValue: args.limitValue
    });
    return { planId, versionId };
}

/** Publish a new immutable version through administrative action 18. */
export async function publishMigrationVersion(args: {
    readonly page: Page;
    readonly admin: CreatedUser;
    readonly planId: string;
    readonly rank: number;
    readonly sellable: boolean;
    readonly limitKey: string;
    readonly limitValue: number;
}): Promise<string> {
    const response = await args.page.request.post(
        `${API_URL}/api/v1/admin/plan-catalog/plans/${args.planId}/versions`,
        {
            headers: { cookie: args.admin.sessionCookie },
            data: PublishPlanVersionRequestSchema.parse({
                rank: args.rank,
                sellable: args.sellable,
                trialDays: 0,
                graceDays: 10,
                allowsPause: false,
                inheritsTouristVip: false,
                entitlements: [],
                limits: [{ key: args.limitKey, value: args.limitValue }],
                cycles: ['monthly'],
                confirmed: true
            })
        }
    );
    expect(response.ok(), await response.text()).toBe(true);
    return PlanId.parse(await response.json()).data.id;
}

/** Set the monthly list price through administrative action 19. */
export async function priceMigrationVersion(args: {
    readonly page: Page;
    readonly admin: CreatedUser;
    readonly versionId: string;
    readonly amount: number;
}): Promise<string> {
    const response = await args.page.request.post(`${API_URL}/api/v1/admin/billing-prices`, {
        headers: { cookie: args.admin.sessionCookie },
        data: SetCyclePriceRequestSchema.parse({
            planVersionId: args.versionId,
            cycle: 'monthly',
            amount: args.amount,
            expectedPreviousAmount: null,
            confirmed: true
        })
    });
    expect(response.ok(), await response.text()).toBe(true);
    return PriceId.parse(await response.json()).data.billingOption.id;
}

/** Start and activate a card subscription via the web checkout and fake notices. */
export async function subscribeMigrationCustomer(args: {
    readonly page: Page;
    readonly world: FakeWorld;
    readonly user: CreatedUser;
    readonly billingOptionId: string;
}): Promise<string> {
    await seedCookieConsent(args.page);
    await attachSession(args.page, args.user.sessionCookie);
    await openSignupCheckout({
        page: args.page,
        webUrl: WEB_URL,
        billingOptionId: args.billingOptionId
    });
    const { subscriptionId } = await confirmSignupCheckout({ page: args.page });
    const [link] = await execSQL<{ provider_id: string }>(
        'SELECT provider_id FROM provider_link WHERE subscription_id = $1',
        [subscriptionId]
    );
    if (!link) throw new Error('Expected checkout provider authorization.');
    await activateCardSubscription({ fakeServer: args.world.fakeServer, subscriptionId });
    await recordCreditedCycle({
        fakeServer: args.world.fakeServer,
        subscriptionId,
        authorizationId: link.provider_id
    });
    return subscriptionId;
}
