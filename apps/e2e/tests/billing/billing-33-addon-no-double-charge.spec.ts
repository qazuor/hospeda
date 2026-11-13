import { randomUUID } from 'node:crypto';
import { expect, type Locator, test } from '@playwright/test';
import { AddonPurchaseResponseSchema, PublicationStatusEnum } from '@repo/schemas';
import { z } from 'zod';
import esBilling from '../../../../packages/i18n/src/locales/es/billing.json' with { type: 'json' };
import {
    addonProviderIds,
    buyRecurringAddon,
    cleanupAddonEndToEnd,
    countAddonCancellationPuts,
    readAddonInstance,
    startAddonWorld
} from '../../fixtures/addon-end-to-end.ts';
import { ensureAddonPurchaseCatalog } from '../../fixtures/addon-purchase-flow.ts';
import {
    type CreatedUser,
    createAccommodation,
    createUser,
    markAdminToursSeen,
    markProfileCompleted
} from '../../fixtures/api-helpers.ts';
import {
    cleanupArrearsRows,
    deliverNotices,
    type FakeWorld
} from '../../fixtures/arrears-cycle.ts';
import { triggerCron } from '../../fixtures/billing-signup-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { latestOutbox, signUpCardSubscriber } from '../../fixtures/cancellation-flow.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { purgeOwnListing } from '../../fixtures/listing-notices.ts';
import { describeSweepCandidates } from '../../fixtures/sweep-candidates.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';
const ADDON_NAME = 'E2E listing boost recurring';
const PURCHASE_PRICE = /\$\s?2\.500(?:,00)?(?!\d)/;
const MAIL_TIMEOUT_MS = 30_000;
const PurchaseBodySchema = z.object({
    productId: z.string(),
    addonVersionId: z.string(),
    targetId: z.string(),
    orderRequestId: z.string(),
    payerEmail: z.string()
});
const PurchaseResponseSchema = z.object({ data: AddonPurchaseResponseSchema });

type PurchaseBody = z.infer<typeof PurchaseBodySchema>;
type PurchaseResponse = z.infer<typeof AddonPurchaseResponseSchema>;
type PrincipalRow = {
    id: string;
    status: string;
    plan_version_id: string;
    billing_option_id: string;
    next_charge_at: Date | null;
    service_ends_at: Date | null;
    cancellation_reason: string | null;
} & Record<string, unknown>;
type PrincipalProviderView = {
    status: string;
    amount: unknown;
    nextChargeAt: string | null;
};

async function inspectSummary(summary: Locator): Promise<void> {
    await expect(summary).toBeVisible();
    await expect(summary.getByRole('heading')).toHaveText(esBilling.addonPurchase.summary);
    await expect(summary).toContainText(ADDON_NAME);
    await expect(summary).toContainText(esBilling.addonPurchase.cycle.monthly);
    await expect(summary).toContainText(PURCHASE_PRICE);
}

function preapprovalPosts(world: FakeWorld) {
    return world.fakeServer
        .requests()
        .filter((request) => request.method === 'POST' && request.path === '/preapproval');
}

function externalReference(body: unknown): unknown {
    if (typeof body !== 'object' || body === null || !('external_reference' in body)) {
        throw new Error('Expected an external_reference in the fake preapproval request.');
    }
    return body.external_reference;
}

async function readPrincipal(subscriptionId: string): Promise<PrincipalRow> {
    const rows = await execSQL<PrincipalRow>(
        `SELECT id, status, plan_version_id, billing_option_id, next_charge_at,
                service_ends_at, cancellation_reason
           FROM subscription WHERE id = $1 AND class = 'PRINCIPAL'`,
        [subscriptionId]
    );
    const row = rows[0];
    if (!row) throw new Error(`Missing principal subscription ${subscriptionId}.`);
    return row;
}

async function providerView(
    world: FakeWorld,
    authorizationId: string
): Promise<PrincipalProviderView> {
    const snapshot = (await world.fakeServer.provider.readAuthorization({ authorizationId }))
        .snapshot;
    return {
        status: snapshot.status,
        amount: snapshot.amount,
        nextChargeAt: snapshot.nextChargeAt
    };
}

async function ownerAddonRows(ownerId: string) {
    return execSQL<{
        id: string;
        status: string;
        target_id: string;
        complement_subscription_id: string;
    }>(
        `SELECT id, status, target_id, complement_subscription_id
           FROM addon_instance WHERE owner_id = $1 ORDER BY created_at, id`,
        [ownerId]
    );
}

async function ownerComplements(ownerId: string) {
    return execSQL<{ id: string; status: string; provider_id: string | null }>(
        `SELECT s.id, s.status, pl.provider_id
           FROM subscription s LEFT JOIN provider_link pl ON pl.subscription_id = s.id
          WHERE s.user_id = $1 AND s.class = 'COMPLEMENTO' ORDER BY s.created_at, s.id`,
        [ownerId]
    );
}

async function postPurchase(args: {
    readonly body: PurchaseBody;
    readonly sessionCookie: string;
}): Promise<{ readonly status: number; readonly data: PurchaseResponse }> {
    const response = await fetch(`${API_URL}/api/v1/protected/billing/addons/purchases`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: args.sessionCookie },
        body: JSON.stringify(args.body)
    });
    return {
        status: response.status,
        data: PurchaseResponseSchema.parse(await response.json()).data
    };
}

async function sendMailThenCancel(args: {
    readonly world: FakeWorld;
    readonly owner: CreatedUser;
    readonly admin: CreatedUser;
    readonly authorizationId: string;
    readonly template: string;
    readonly subject: string;
    readonly bodyText: string;
}): Promise<void> {
    await expect
        .poll(
            async () =>
                (await latestOutbox({ userId: args.owner.id, template: args.template }))?.status,
            {
                message: 'A6 must queue its cancellation email before provider cancellation',
                timeout: 10_000
            }
        )
        .toBe('pending');
    expect(countAddonCancellationPuts(args)).toBe(0);
    await triggerCron({ jobName: 'email-outbox-sender', adminCookie: args.admin.sessionCookie });
    const mail = await args.world.mailCapture.waitForMail({
        to: args.owner.email,
        subject: args.subject,
        timeoutMs: MAIL_TIMEOUT_MS
    });
    expect(mail.html).toContain(args.bodyText);
    await triggerCron({
        jobName: 'billing-deferred-cancellation-retry',
        adminCookie: args.admin.sessionCookie
    });
    expect(countAddonCancellationPuts(args)).toBe(1);
}

/**
 * Preconditions: E2E API, web app, PostgreSQL, the seeded `owner-basico` plan, and the local fake
 * Mercado Pago and mail capture servers started by the suite. The test creates its own HOST,
 * SUPER_ADMIN, listings, and recurring addon purchases. The fake clock is not advanced.
 * Cleanup removes all case-owned billing rows, users, and servers after the serial suite.
 */
test.describe('TEST:2158:1 TEST:2158:2 TEST:2158:3 addon purchase without double charge @p0 @billing @clock', () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(300_000);

    let world: FakeWorld | null = null;
    let namespace = '';
    let owner: CreatedUser;
    let admin: CreatedUser;
    let userIds: string[] = [];
    let principal: { readonly subscriptionId: string; readonly authorizationId: string };
    let principalBefore: { readonly row: PrincipalRow; readonly provider: PrincipalProviderView };
    let listingA: { readonly id: string };
    let listingB: { readonly id: string };
    let raceInstanceId = '';
    let purchase: {
        readonly instanceId: string;
        readonly checkoutUrl: string;
        readonly complementId: string;
        readonly authorizationId: string;
        readonly body: PurchaseBody;
    };

    test.beforeAll(async () => {
        const started = await startAddonWorld();
        world = started.world;
        namespace = started.namespace;
        owner = await createUser({ role: 'HOST' });
        userIds.push(owner.id);
        await markProfileCompleted({ userId: owner.id });
        admin = await createUser({ role: 'SUPER_ADMIN' });
        userIds.push(admin.id);
        await markAdminToursSeen({ userId: admin.id });
    });

    test.afterAll(async () => {
        const providerIds = namespace ? await addonProviderIds({ namespace }) : [];
        try {
            console.info(
                'TEST:2158 sweep candidates before cleanup:',
                await describeSweepCandidates({
                    includeUserIds: userIds,
                    includeProviderIds: providerIds
                })
            );
        } finally {
            try {
                await world?.fakeServer.close();
            } finally {
                try {
                    await cleanupAddonEndToEnd({ userIds, providerIds });
                    await cleanupArrearsRows({ userIds });
                    await cleanupTestUsers(getDbPool(), userIds);
                } finally {
                    await world?.mailCapture.close().catch(() => undefined);
                    world = null;
                    namespace = '';
                    userIds = [];
                }
            }
        }
    });

    test('the addon preapproval carries its own complement as external_reference and leaves the principal alone', async ({
        page
    }) => {
        if (!world) throw new Error('Expected case-local fake world.');
        await seedCookieConsent(page);
        principal = await signUpCardSubscriber({ page, world, user: owner, slug: 'owner-basico' });
        principalBefore = {
            row: await readPrincipal(principal.subscriptionId),
            provider: await providerView(world, principal.authorizationId)
        };
        expect(
            principalBefore.row.status,
            'The principal plan must be active before addon purchase'
        ).toBe('ACTIVE');
        listingA = await createAccommodation({
            ownerId: owner.id,
            publicationStatus: PublicationStatusEnum.PUBLISHED
        });
        const catalog = await ensureAddonPurchaseCatalog();
        const postsBefore = preapprovalPosts(world).length;
        const sentBodies: PurchaseBody[] = [];
        const listener = (request: import('@playwright/test').Request): void => {
            const url = new URL(request.url());
            if (
                request.method() === 'POST' &&
                url.pathname === '/api/v1/protected/billing/addons/purchases'
            ) {
                sentBodies.push(PurchaseBodySchema.parse(request.postDataJSON()));
            }
        };
        page.on('request', listener);
        try {
            const bought = await buyRecurringAddon({
                page,
                productId: catalog.recurringProductId,
                listingId: listingA.id,
                inspectSummary
            });
            expect(sentBodies).toHaveLength(1);
            const body = sentBodies[0];
            if (!body) throw new Error('Expected the addon purchase request body.');
            expect(body).toEqual({
                productId: catalog.recurringProductId,
                addonVersionId: 'b10c0000-0000-4000-8000-000000000005',
                targetId: listingA.id,
                orderRequestId: expect.any(String),
                payerEmail: owner.email
            });
            const instance = await readAddonInstance({ instanceId: bought.instanceId });
            expect(preapprovalPosts(world)).toHaveLength(postsBefore + 1);
            const post = preapprovalPosts(world)[postsBefore];
            if (!post) throw new Error('Expected exactly one new addon preapproval request.');
            const escapedOrderId = body.orderRequestId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            expect(post.body).toEqual({
                reason: ADDON_NAME,
                external_reference: instance.complementId,
                payer_email: owner.email,
                back_url: expect.stringMatching(
                    new RegExp(`/es/mi-cuenta/complementos/\\?compra=${escapedOrderId}$`)
                ),
                auto_recurring: {
                    frequency: 1,
                    frequency_type: 'months',
                    transaction_amount: 2500,
                    currency_id: 'ARS'
                }
            });
            expect(post.headers?.['X-Idempotency-Key']).toBe(instance.complementId);
            expect(instance.complementId).not.toBe(principal.subscriptionId);
            expect(
                await execSQL<{ user_id: string; class: string; status: string }>(
                    'SELECT user_id, class, status FROM subscription WHERE id = $1',
                    [instance.complementId]
                )
            ).toEqual([
                { user_id: owner.id, class: 'COMPLEMENTO', status: 'PENDING_AUTHORIZATION' }
            ]);
            expect(
                (
                    await world.fakeServer.provider.readAuthorization({
                        authorizationId: instance.authorizationId
                    })
                ).snapshot.reference
            ).toBe(instance.complementId);
            expect(
                (
                    await world.fakeServer.provider.readAuthorization({
                        authorizationId: principal.authorizationId
                    })
                ).snapshot.reference
            ).toBe(principal.subscriptionId);
            expect(new Set([instance.authorizationId, principal.authorizationId]).size).toBe(2);
            expect(await providerView(world, principal.authorizationId)).toEqual(
                principalBefore.provider
            );
            purchase = {
                instanceId: bought.instanceId,
                checkoutUrl: bought.checkoutUrl,
                complementId: instance.complementId,
                authorizationId: instance.authorizationId,
                body
            };
        } finally {
            page.off('request', listener);
        }
    });

    test('replaying the same orderRequestId returns the same purchase and never creates a second preapproval', async () => {
        if (!world) throw new Error('Expected case-local fake world.');
        const postsBefore = preapprovalPosts(world).length;
        const replay = await postPurchase({
            body: purchase.body,
            sessionCookie: owner.sessionCookie
        });
        expect(replay.status).toBe(200);
        expect(replay.data).toEqual({
            outcome: 'EXISTING',
            instanceId: purchase.instanceId,
            chargeKind: 'PERIODICO',
            processing: false,
            checkoutUrl: purchase.checkoutUrl
        });
        expect(preapprovalPosts(world)).toHaveLength(postsBefore);

        await world.fakeServer.provider.approve({ authorizationId: purchase.authorizationId });
        await deliverNotices({ fakeServer: world.fakeServer });
        await expect
            .poll(
                async () => (await readAddonInstance({ instanceId: purchase.instanceId })).status,
                { message: 'A2 must activate the addon after its approval notice', timeout: 30_000 }
            )
            .toBe('ACTIVE');
        const again = await postPurchase({
            body: purchase.body,
            sessionCookie: owner.sessionCookie
        });
        expect(again.status).toBe(200);
        expect(again.data).toEqual({
            outcome: 'EXISTING',
            instanceId: purchase.instanceId,
            chargeKind: 'PERIODICO',
            processing: false,
            checkoutUrl: purchase.checkoutUrl
        });
        expect(preapprovalPosts(world)).toHaveLength(postsBefore);
        expect(await ownerAddonRows(owner.id)).toEqual([
            {
                id: purchase.instanceId,
                status: 'ACTIVE',
                target_id: listingA.id,
                complement_subscription_id: purchase.complementId
            }
        ]);
        expect(await ownerComplements(owner.id)).toEqual([
            { id: purchase.complementId, status: 'ACTIVE', provider_id: purchase.authorizationId }
        ]);
        expect(
            countAddonCancellationPuts({ world, authorizationId: purchase.authorizationId })
        ).toBe(0);

        listingB = await createAccommodation({
            ownerId: owner.id,
            publicationStatus: PublicationStatusEnum.PUBLISHED
        });
        const raceBody: PurchaseBody = {
            ...purchase.body,
            targetId: listingB.id,
            orderRequestId: `e2e-2158-race-${randomUUID()}`
        };
        const postsBeforeRace = preapprovalPosts(world).length;
        const [a, b] = await Promise.all([
            postPurchase({ body: raceBody, sessionCookie: owner.sessionCookie }),
            postPurchase({ body: raceBody, sessionCookie: owner.sessionCookie })
        ]);
        expect([a.status, b.status].sort()).toEqual([200, 201]);
        expect(a.data.instanceId).toBe(b.data.instanceId);
        raceInstanceId = a.data.instanceId;
        expect(['CREATED,EXISTING', 'CREATED,PENDING_ELSEWHERE']).toContain(
            [a.data.outcome, b.data.outcome].sort().join(',')
        );
        expect(preapprovalPosts(world)).toHaveLength(postsBeforeRace + 1);
        expect(
            await execSQL<{ id: string }>(
                'SELECT id FROM addon_instance WHERE owner_id = $1 AND target_id = $2',
                [owner.id, listingB.id]
            )
        ).toEqual([{ id: a.data.instanceId }]);
        const createdPost = preapprovalPosts(world)[postsBeforeRace];
        if (!createdPost) throw new Error('Expected the single racing addon preapproval.');
        expect(externalReference(createdPost.body)).toBe(
            (await readAddonInstance({ instanceId: a.data.instanceId })).complementId
        );
    });

    test('purging the listing cancels only the addon preapproval and leaves the principal plan unchanged', async () => {
        if (!world) throw new Error('Expected case-local fake world.');
        const principalPutsBefore = world.fakeServer
            .requests()
            .filter(
                (request) =>
                    request.method === 'PUT' &&
                    request.path === `/preapproval/${principal.authorizationId}`
            ).length;
        await purgeOwnListing({ ownerCookie: owner.sessionCookie, listingId: listingA.id });
        await sendMailThenCancel({
            world,
            owner,
            admin,
            authorizationId: purchase.authorizationId,
            template: 'billing.addon-listing-purged-cancel',
            subject: 'Cancelamos el cobro del addon de una ficha que borraste',
            bodyText: 'El addon se consumió con la ficha'
        });
        const cancelled = await readAddonInstance({ instanceId: purchase.instanceId });
        expect({ instance: cancelled.status, complement: cancelled.complementStatus }).toEqual({
            instance: 'CANCELLED',
            complement: 'CANCELLED'
        });
        expect(await readPrincipal(principal.subscriptionId)).toEqual(principalBefore.row);
        expect(await providerView(world, principal.authorizationId)).toEqual(
            principalBefore.provider
        );
        expect(
            world.fakeServer
                .requests()
                .filter(
                    (request) =>
                        request.method === 'PUT' &&
                        request.path === `/preapproval/${principal.authorizationId}`
                )
        ).toHaveLength(principalPutsBefore);
        expect(
            await execSQL<{ id: string; status: string }>(
                "SELECT id, status FROM subscription WHERE user_id = $1 AND class = 'PRINCIPAL'",
                [owner.id]
            )
        ).toEqual([{ id: principal.subscriptionId, status: 'ACTIVE' }]);
        const pendingB = await readAddonInstance({ instanceId: raceInstanceId });
        expect(pendingB.status).toBe('PENDING_AUTHORIZATION');
    });
});
