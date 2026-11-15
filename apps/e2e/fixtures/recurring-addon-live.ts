import { randomUUID } from 'node:crypto';
import { expect, type Page } from '@playwright/test';
import { FAKE_NOTICE_DELAY_MS } from '@repo/payments/fake';
import { AddonPurchaseResponseSchema, PublicationStatusEnum } from '@repo/schemas';
import { z } from 'zod';
import { ensureAddonPurchaseCatalog } from './addon-purchase-flow.ts';
import { type CreatedUser, createAccommodation, markProfileCompleted } from './api-helpers.ts';
import { API_URL, deliverNotices, type FakeWorld } from './arrears-cycle.ts';
import { signUpCardSubscriber } from './cancellation-flow.ts';
import { execSQL } from './db-helpers.ts';

const AddonRowSchema = z.object({
    version_id: z.uuid(),
    name: z.string().min(1)
});
const InstanceRowSchema = z.object({
    status: z.string(),
    complement_subscription_id: z.uuid()
});
const ProviderLinkSchema = z.object({ provider_id: z.string().min(1) });

/** A paid owner, published listing, and API-purchased ACTIVE recurring feature. */
export interface RecurringAddonLive {
    readonly listingId: string;
    readonly instanceId: string;
    readonly addonVersionId: string;
    readonly addonName: string;
    readonly complementSubscriptionId: string;
    readonly addonAuthorizationId: string;
    readonly principalAuthorizationId: string;
}

/** Build the state through the principal checkout, protected add-on API, and provider notice. */
export async function createRecurringAddonLive(args: {
    readonly page: Page;
    readonly world: FakeWorld;
    readonly owner: CreatedUser;
}): Promise<RecurringAddonLive> {
    await markProfileCompleted({ userId: args.owner.id });
    const principal = await signUpCardSubscriber({
        page: args.page,
        world: args.world,
        user: args.owner,
        slug: 'owner-basico'
    });
    // E2E setup seeds the immutable catalog and the PUBLISHED listing; no API creates this catalog.
    const catalog = await ensureAddonPurchaseCatalog();
    const listing = await createAccommodation({
        ownerId: args.owner.id,
        publicationStatus: PublicationStatusEnum.PUBLISHED,
        slugPrefix: 'b13b-recurring'
    });
    const [rawAddon] = await execSQL<{ version_id: string; name: string }>(
        `SELECT ap.version_id, a.name FROM addon_product ap
         JOIN addon a ON a.id = ap.addon_id WHERE ap.id = $1`,
        [catalog.recurringProductId]
    );
    const addon = AddonRowSchema.parse(rawAddon);
    // Purchase is setup, not the tested UI action. It still uses the real protected route.
    const purchase = await fetch(`${API_URL}/api/v1/protected/billing/addons/purchases`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: args.owner.sessionCookie },
        body: JSON.stringify({
            productId: catalog.recurringProductId,
            targetId: listing.id,
            orderRequestId: `b13b-${randomUUID()}`,
            addonVersionId: addon.version_id
        })
    });
    if (purchase.status !== 201) throw new Error(`Addon purchase HTTP ${purchase.status}`);
    const purchased = z
        .object({ data: AddonPurchaseResponseSchema })
        .parse(await purchase.json()).data;
    const [rawInstance] = await execSQL<{
        status: string;
        complement_subscription_id: string;
    }>(
        `SELECT status, complement_subscription_id FROM addon_instance WHERE id = $1 AND owner_id = $2`,
        [purchased.instanceId, args.owner.id]
    );
    const instance = InstanceRowSchema.parse(rawInstance);
    const [rawLink] = await execSQL<{ provider_id: string }>(
        'SELECT provider_id FROM provider_link WHERE subscription_id = $1',
        [instance.complement_subscription_id]
    );
    const link = ProviderLinkSchema.parse(rawLink);
    await args.world.fakeServer.provider.approve({ authorizationId: link.provider_id });
    await deliverNotices({ fakeServer: args.world.fakeServer, advanceMs: FAKE_NOTICE_DELAY_MS });
    await expect
        .poll(
            async () =>
                (
                    await execSQL<{ status: string }>(
                        'SELECT status FROM addon_instance WHERE id = $1',
                        [purchased.instanceId]
                    )
                )[0]?.status
        )
        .toBe('ACTIVE');
    return {
        listingId: listing.id,
        instanceId: purchased.instanceId,
        addonVersionId: addon.version_id,
        addonName: addon.name,
        complementSubscriptionId: instance.complement_subscription_id,
        addonAuthorizationId: link.provider_id,
        principalAuthorizationId: principal.authorizationId
    };
}
