import { randomUUID } from 'node:crypto';
import { expect, type Locator, type Page } from '@playwright/test';
import { FakePaymentProvider } from '@repo/payments/fake';
import { createAdjustableClock } from '@repo/test-clock';
import { cleanupAddonPurchaseRows, openAddonPurchase } from './addon-purchase-flow.ts';
import type { FakeWorld } from './arrears-cycle.ts';
import { execSQL } from './db-helpers.ts';
import { startE2eFakeProvider } from './fake-provider-server.ts';
import { startE2eMailCapture } from './mail-capture-server.ts';

/** A fake provider world and namespace owned by one TEST:B10:16 case. */
export async function startAddonWorld(): Promise<{
    readonly world: FakeWorld;
    readonly namespace: string;
}> {
    const namespace = randomUUID();
    const clock = createAdjustableClock({ start: new Date() });
    const fakeServer = await startE2eFakeProvider({
        provider: new FakePaymentProvider({
            clock,
            idNamespace: namespace,
            honestAbout: [
                {
                    lie: 'M6',
                    why: 'TEST:B10:16 delivers the principal and addon approval notices.'
                },
                { lie: 'M8', why: 'TEST:B10:16 credits the principal before buying the addon.' }
            ]
        }),
        clock
    });
    try {
        return {
            world: { clock, fakeServer, mailCapture: await startE2eMailCapture() },
            namespace
        };
    } catch (error) {
        await fakeServer.close();
        throw error;
    }
}

/** Buy a recurring listing addon through the owner screen and stub its fake approval page. */
export async function buyRecurringAddon(args: {
    readonly page: Page;
    readonly productId: string;
    readonly listingId: string;
    readonly inspectSummary: (summary: Locator) => Promise<void>;
}): Promise<{ readonly instanceId: string; readonly checkoutUrl: string }> {
    await openAddonPurchase(args);
    await args.inspectSummary(args.page.getByTestId('addon-purchase-summary'));
    const isPurchase = (url: URL): boolean =>
        url.pathname === '/api/v1/protected/billing/addons/purchases';
    const isFakeCheckout = (url: URL): boolean => url.hostname === 'payments-fake.invalid';
    let resolvePurchase: (value: { readonly status: number; readonly text: string }) => void = () =>
        undefined;
    const purchaseCaptured = new Promise<{ readonly status: number; readonly text: string }>(
        (resolve) => {
            resolvePurchase = resolve;
        }
    );
    await args.page.route(isPurchase, async (route) => {
        if (route.request().method() !== 'POST') return route.continue();
        const fetched = await route.fetch();
        const text = await fetched.text();
        resolvePurchase({ status: fetched.status(), text });
        await route.fulfill({ response: fetched, body: text });
    });
    await args.page.route(isFakeCheckout, (route) =>
        route.fulfill({
            status: 200,
            contentType: 'text/html',
            body: '<!doctype html><title>Fake checkout</title>'
        })
    );
    try {
        const responsePromise = args.page.waitForResponse(
            (response) =>
                isPurchase(new URL(response.url())) && response.request().method() === 'POST'
        );
        await args.page.getByTestId('addon-purchase-confirm').click();
        const response = await purchaseCaptured;
        await responsePromise;
        expect(response.status).toBe(201);
        const body = JSON.parse(response.text) as {
            readonly data?: { readonly instanceId?: string; readonly checkoutUrl?: string };
        };
        if (!body.data?.instanceId || !body.data.checkoutUrl)
            throw new Error('Recurring addon purchase omitted its instance or checkout URL.');
        await args.page.waitForURL((url) => url.href === body.data?.checkoutUrl);
        return { instanceId: body.data.instanceId, checkoutUrl: body.data.checkoutUrl };
    } finally {
        await args.page.unroute(isPurchase);
        await args.page.unroute(isFakeCheckout);
    }
}

/** Read one acquired instance and its own complement and provider preapproval. */
export async function readAddonInstance(args: { readonly instanceId: string }): Promise<{
    readonly status: string;
    readonly complementStatus: string;
    readonly complementId: string;
    readonly authorizationId: string;
}> {
    const rows = await execSQL<{
        status: string;
        complement_status: string;
        complement_id: string;
        authorization_id: string;
    }>(
        `SELECT ai.status, s.status AS complement_status, s.id AS complement_id,
                pl.provider_id AS authorization_id
           FROM addon_instance ai
           JOIN subscription s ON s.id = ai.complement_subscription_id
           JOIN provider_link pl ON pl.subscription_id = s.id
          WHERE ai.id = $1`,
        [args.instanceId]
    );
    const row = rows[0];
    if (!row) throw new Error(`Missing acquired recurring addon ${args.instanceId}.`);
    return {
        status: row.status,
        complementStatus: row.complement_status,
        complementId: row.complement_id,
        authorizationId: row.authorization_id
    };
}

/** Count exact provider cancellation PUTs for one preapproval. */
export function countAddonCancellationPuts(args: {
    readonly world: FakeWorld;
    readonly authorizationId: string;
}): number {
    return args.world.fakeServer
        .requests()
        .filter(
            (request) =>
                request.method === 'PUT' &&
                request.path === `/preapproval/${args.authorizationId}` &&
                typeof request.body === 'object' &&
                request.body !== null &&
                (request.body as { readonly status?: unknown }).status === 'cancelled'
        ).length;
}

/** List only the provider ids created within a case namespace for diagnostics and cleanup. */
export async function addonProviderIds(args: { readonly namespace: string }): Promise<string[]> {
    const rows = await execSQL<{ provider_id: string }>(
        'SELECT provider_id FROM provider_link WHERE provider_id LIKE $1',
        [`fake-auth-${args.namespace}-%`]
    );
    return rows.map((row) => row.provider_id);
}

/** Remove case-owned addon purchases, retaining immutable catalog versions. */
export async function cleanupAddonEndToEnd(args: {
    readonly userIds: readonly string[];
    readonly providerIds: readonly string[];
}): Promise<void> {
    await cleanupAddonPurchaseRows(args);
}
