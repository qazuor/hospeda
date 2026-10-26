import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { FakePaymentProvider } from '@repo/payments/fake';
import { PublicationStatusEnum } from '@repo/schemas';
import { createAdjustableClock } from '@repo/test-clock';
import { createAccommodation } from '../../fixtures/api-helpers.ts';
import {
    activateCardSubscription,
    cancelRequestsFor,
    cleanupArrearsRows,
    createSubscriber,
    ensureDeadlineVersion,
    type FakeWorld,
    WEB_URL
} from '../../fixtures/arrears-cycle.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import {
    cancellationOutboxSince,
    confirmSelfCancel,
    driveToGrace,
    driveToSuspended,
    latestOutbox,
    readSubscriptionRow,
    selfCancelFromMySubscription,
    signUpCardSubscriber,
    subscriptionArticle,
    waitForPublicationStatus,
    waitForSubscriptionStatus
} from '../../fixtures/cancellation-flow.ts';
import { execSQL } from '../../fixtures/db-helpers.ts';
import { startE2eFakeProvider } from '../../fixtures/fake-provider-server.ts';
import { readPublicationStatus } from '../../fixtures/listing-notices.ts';
import { startE2eMailCapture } from '../../fixtures/mail-capture-server.ts';
import {
    confirmSignupCheckout,
    monthlyOptionForSlug,
    openSignupCheckout
} from '../../fixtures/signup-checkout.ts';

const MAIL_TIMEOUT_MS = 30_000;

/** A suspended card payer returns by S23 then a new S1 checkout (D-0). */
test.describe('TEST:1624:1 a suspended card subscriber comes back: S23, a new S1, and the listing returns @p0 @billing @clock', () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(300_000);
    let world: FakeWorld | null = null;
    const userIds: string[] = [];

    test.beforeAll(async () => {
        await ensureDeadlineVersion();
        const clock = createAdjustableClock({ start: new Date() });
        const fakeServer = await startE2eFakeProvider({
            provider: new FakePaymentProvider({
                clock,
                idNamespace: randomUUID(),
                honestAbout: [
                    {
                        lie: 'M6',
                        why: 'TEST:1624:1 verifies the captured mail order around provider cancellation.'
                    },
                    { lie: 'M8', why: 'TEST:1624:1 records the credited cycle before arrears.' }
                ]
            }),
            clock
        });
        try {
            world = { clock, fakeServer, mailCapture: await startE2eMailCapture() };
        } catch (error) {
            await fakeServer.close();
            throw error;
        }
    });

    test.afterAll(async () => {
        try {
            await cleanupArrearsRows({ userIds });
        } finally {
            await world?.mailCapture.close().catch(() => undefined);
            await world?.fakeServer.close().catch(() => undefined);
        }
    });

    test('TEST:1624:1 returns a suspended subscriber through a new subscription and restores the listing', async ({
        page
    }) => {
        if (!world) throw new Error('Expected fake provider world.');
        const fakeWorld = world;
        const subscriber = await createSubscriber();
        userIds.push(subscriber.user.id, subscriber.admin.id);
        await seedCookieConsent(page);

        let oldSubscriptionId = '';
        let oldAuthorizationId = '';
        let listingId = '';
        let newSubscriptionId = '';
        await test.step('Step 1: start a card subscription and seed one published listing', async () => {
            ({ subscriptionId: oldSubscriptionId, authorizationId: oldAuthorizationId } =
                await signUpCardSubscriber({
                    page,
                    world: fakeWorld,
                    user: subscriber.user,
                    slug: 'owner-basico'
                }));
            expect((await readSubscriptionRow({ subscriptionId: oldSubscriptionId })).status).toBe(
                'ACTIVE'
            );
            const listing = await createAccommodation({
                ownerId: subscriber.user.id,
                publicationStatus: PublicationStatusEnum.PUBLISHED,
                complete: true,
                withTrial: false
            });
            listingId = listing.id;
            expect(await readPublicationStatus({ listingId })).toBe(
                PublicationStatusEnum.PUBLISHED
            );
        });

        await test.step('Step 2: real arrears suspends the subscriber and removes listing coverage', async () => {
            await driveToGrace({
                world: fakeWorld,
                subscriptionId: oldSubscriptionId,
                authorizationId: oldAuthorizationId
            });
            await driveToSuspended({
                world: fakeWorld,
                user: subscriber.user,
                admin: subscriber.admin,
                subscriptionId: oldSubscriptionId,
                authorizationId: oldAuthorizationId
            });
            await waitForPublicationStatus({
                listingId,
                status: 'UNPUBLISHED_BY_BILLING',
                timeoutMs: 30_000
            });
        });

        await test.step('Step 3: S23 ends the suspended subscription from Mi Suscripción', async () => {
            const { preview } = await selfCancelFromMySubscription({
                page,
                subscriptionId: oldSubscriptionId
            });
            expect(preview.origin).toBe('SUSPENDED');
            const cancellationRequestedAt = new Date();
            await expect(
                await confirmSelfCancel({ page, subscriptionId: oldSubscriptionId })
            ).toContainText('El servicio terminó hoy.');
            expect((await readSubscriptionRow({ subscriptionId: oldSubscriptionId })).status).toBe(
                'CANCELLED'
            );
            // S23 mails only when it cancels a live preapproval; a real suspension already cancelled it (S23).
            expect(
                await cancellationOutboxSince({
                    userId: subscriber.user.id,
                    createdAt: cancellationRequestedAt
                })
            ).toHaveLength(0);
            expect(
                cancelRequestsFor({
                    requests: fakeWorld.fakeServer.requests(),
                    authorizationId: oldAuthorizationId
                })
            ).toHaveLength(1);
        });

        await test.step('Step 4: checkout creates a distinct pending S1 row without a succession', async () => {
            await openSignupCheckout({
                page,
                webUrl: WEB_URL,
                billingOptionId: await monthlyOptionForSlug('owner-basico')
            });
            // HOS-1896: the fresh signup navigates straight to the provider
            // checkout, so the helper reads the start response instead of the
            // pending screen and waits for that navigation.
            const { subscriptionId } = await confirmSignupCheckout({ page });
            newSubscriptionId = subscriptionId;
            expect(newSubscriptionId, 'Expected new checkout subscription id.').toBeTruthy();
            expect(newSubscriptionId).not.toBe(oldSubscriptionId);
            const row = await readSubscriptionRow({ subscriptionId: newSubscriptionId });
            expect(row.succeeds_id).toBeNull();
            expect(row.status).toBe('PENDING_AUTHORIZATION');
            const providerLink = await execSQL<{ provider_id: string }>(
                'SELECT provider_id FROM provider_link WHERE subscription_id = $1',
                [newSubscriptionId]
            );
            const authorizationId = providerLink[0]?.provider_id;
            if (!authorizationId)
                throw new Error('Expected provider authorization for new checkout.');
            await activateCardSubscription({
                fakeServer: fakeWorld.fakeServer,
                subscriptionId: newSubscriptionId
            });
            await waitForSubscriptionStatus({
                subscriptionId: newSubscriptionId,
                status: 'ACTIVE',
                timeoutMs: MAIL_TIMEOUT_MS
            });
        });

        await test.step('Step 5: activation asynchronously restores the one listing and records restitution', async () => {
            await waitForPublicationStatus({ listingId, status: 'PUBLISHED', timeoutMs: 30_000 });
            const restitution = await latestOutbox({
                userId: subscriber.user.id,
                template: 'verticals.listing-restitution'
            });
            const restoredListingIds = restitution?.payload.restoredListingIds;
            expect(restoredListingIds).toEqual([listingId]);
        });

        await test.step('Step 6: Mi Suscripción lists exactly the new active row with AU notice', async () => {
            await page.goto(`${WEB_URL}/es/mi-cuenta/suscripcion/`);
            const island = page.locator('section[aria-label="Tus suscripciones"]');
            const current = subscriptionArticle({ page, subscriptionId: newSubscriptionId });
            await expect(current).toBeVisible();
            await expect(
                current.getByTestId('my-subscription-plan-change-unavailable')
            ).toBeVisible();
            await expect(island.locator('article[data-testid="my-subscription"]')).toHaveCount(1);
        });
    });
});
