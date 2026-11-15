import type { Page } from '@playwright/test';
import type { CreatedUser } from './api-helpers.ts';
import {
    activateCardSubscription,
    type FakeWorld,
    recordCreditedCycle,
    runCron,
    WEB_URL
} from './arrears-cycle.ts';
import { execSQL } from './db-helpers.ts';
import { cleanupPermanentGrantE2eRows } from './permanent-grant-flow.ts';
import {
    attachSession,
    confirmSignupCheckout,
    monthlyOptionForSlug,
    openSignupCheckout
} from './signup-checkout.ts';

/** Create a paid monthly subscription through checkout and provider notices. */
export async function openActivePlanCase(args: {
    readonly page: Page;
    readonly world: FakeWorld;
    readonly user: CreatedUser;
    readonly admin: CreatedUser;
    readonly slug: 'owner-basico' | 'owner-premium';
}): Promise<{ readonly subscriptionId: string; readonly authorizationId: string }> {
    await attachSession(args.page, args.user.sessionCookie);
    await openSignupCheckout({
        page: args.page,
        webUrl: WEB_URL,
        billingOptionId: await monthlyOptionForSlug(args.slug)
    });
    const { subscriptionId } = await confirmSignupCheckout({ page: args.page });
    const [link] = await execSQL<{ provider_id: string }>(
        'SELECT provider_id FROM provider_link WHERE subscription_id = $1',
        [subscriptionId]
    );
    if (!link) throw new Error('TEST:B8b:26 setup: missing starting provider authorization.');
    await activateCardSubscription({ fakeServer: args.world.fakeServer, subscriptionId });
    await recordCreditedCycle({
        fakeServer: args.world.fakeServer,
        subscriptionId,
        authorizationId: link.provider_id
    });
    const sweep = await runCron({
        jobName: 'billing-reconciliation-sweep',
        adminCookie: args.admin.sessionCookie
    });
    if (!sweep.success) throw new Error('TEST:B8b:26 setup: reconciliation did not succeed.');
    await args.page.goto(`${WEB_URL}/es/mi-cuenta/suscripcion/`);
    return { subscriptionId, authorizationId: link.provider_id };
}

/** Remove this case's mutable queue rows and all sweep candidates before users. */
export async function cleanupPlanChangeCase(args: {
    readonly userIds: readonly string[];
    readonly providerNamespace: string;
}): Promise<readonly string[]> {
    const providerIds = (
        await execSQL<{ provider_id: string }>(
            'SELECT provider_id FROM provider_link WHERE provider_id LIKE $1',
            [`fake-auth-${args.providerNamespace}-%`]
        )
    ).map((row) => row.provider_id);
    await execSQL(
        `DELETE FROM subscription_scheduled_change
         WHERE subscription_id IN (SELECT id FROM subscription WHERE user_id = ANY($1::uuid[]))`,
        [args.userIds]
    );
    await execSQL(
        `DELETE FROM subscription_pause
         WHERE subscription_id IN (SELECT id FROM subscription WHERE user_id = ANY($1::uuid[]))`,
        [args.userIds]
    );
    await cleanupPermanentGrantE2eRows({ userIds: args.userIds, providerIds });
    return providerIds;
}
