import { randomUUID } from 'node:crypto';
import { expect, type Page, test } from '@playwright/test';
import { FAKE_NOTICE_DELAY_MS, FakePaymentProvider } from '@repo/payments/fake';
import { AddonPurchaseResponseSchema, PublicationStatusEnum } from '@repo/schemas';
import { createAdjustableClock } from '@repo/test-clock';
import { z } from 'zod';
import { formatCurrency } from '../../../../packages/i18n/src/formatting.ts';
import esBilling from '../../../../packages/i18n/src/locales/es/admin-billing.json' with {
    type: 'json'
};
import { cleanupAddonPurchaseRows } from '../../fixtures/addon-purchase-flow.ts';
import {
    type CreatedUser,
    createAccommodation,
    createUser,
    markAdminToursSeen,
    markProfileCompleted
} from '../../fixtures/api-helpers.ts';
import {
    API_URL,
    cleanupArrearsRows,
    deliverNotices,
    type FakeWorld
} from '../../fixtures/arrears-cycle.ts';
import { signUpCardSubscriber } from '../../fixtures/cancellation-flow.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { startE2eFakeProvider } from '../../fixtures/fake-provider-server.ts';
import { startE2eMailCapture } from '../../fixtures/mail-capture-server.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const ADMIN_URL = process.env.HOSPEDA_E2E_ADMIN_URL ?? 'http://localhost:18300';
const copy = esBilling.addonCatalogEditor;
const price = 250000;

async function useAdminSession(page: Page, cookie: string): Promise<void> {
    await page.context().addCookies(
        cookie.split('; ').map((part) => {
            const [name, ...value] = part.split('=');
            return { name: name ?? '', value: value.join('='), url: ADMIN_URL };
        })
    );
}

/** TEST:B13b:3 drives the editor UI after a protected API purchase used as setup. */
test.describe('TEST:B13b:3 AC:B13b:3 AC:B13b:4 the action 20 editor @p0 @admin @billing @clock', () => {
    test.setTimeout(300_000);
    let world: FakeWorld | null = null;
    let namespace = '';
    let superAdmin: CreatedUser | null = null;
    let owner: CreatedUser | null = null;
    let admin: CreatedUser | null = null;
    let addonId: string | null = null;
    let productId: string | null = null;

    test.beforeEach(async () => {
        namespace = randomUUID();
        const clock = createAdjustableClock({ start: new Date() });
        const fakeServer = await startE2eFakeProvider({
            provider: new FakePaymentProvider({
                clock,
                idNamespace: namespace,
                honestAbout: [
                    {
                        lie: 'M6',
                        why: 'TEST:B13b:3 needs a credited principal for its API purchase.'
                    },
                    { lie: 'M8', why: 'TEST:B13b:3 needs the paid principal cycle in the API.' }
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
        superAdmin = await createUser({ role: 'SUPER_ADMIN' }, { apiBaseUrl: API_URL });
        owner = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        admin = await createUser({ role: 'ADMIN' }, { apiBaseUrl: API_URL });
        await markAdminToursSeen({ userId: superAdmin.id });
        await markAdminToursSeen({ userId: admin.id });
        await markProfileCompleted({ userId: owner.id });
    });

    test.afterEach(async () => {
        const userIds = [superAdmin?.id, owner?.id, admin?.id].filter((id): id is string =>
            Boolean(id)
        );
        const providerIds = namespace
            ? (
                  await execSQL<{ provider_id: string }>(
                      'SELECT provider_id FROM provider_link WHERE provider_id LIKE $1',
                      [`fake-auth-${namespace}-%`]
                  )
              ).map((row) => row.provider_id)
            : [];
        try {
            await world?.fakeServer.close();
        } finally {
            try {
                await cleanupAddonPurchaseRows({ userIds, providerIds });
                await cleanupArrearsRows({ userIds });
                await cleanupTestUsers(getDbPool(), userIds);
                if (productId)
                    await execSQL('DELETE FROM addon_product WHERE id = $1', [productId]);
                // Immutable addon_version rows and their addon identity remain for audit.
            } finally {
                await world?.mailCapture.close().catch(() => undefined);
                world = null;
                superAdmin = null;
                owner = null;
                admin = null;
                addonId = null;
                productId = null;
                namespace = '';
            }
        }
    });

    test('Publicar una versión muestra qué cambia contra la vigente y deja las compras previas en su versión', async ({
        page,
        browser
    }) => {
        if (!world || !superAdmin || !owner)
            throw new Error('Expected case-local actors and fake world.');
        const [key] = await execSQL<{ key: string }>(
            "SELECT key FROM catalog_key WHERE kind = 'limit' ORDER BY key LIMIT 1"
        );
        if (!key) throw new Error('Expected a seeded limit catalog key.');
        const slug = `b13b-editor-${namespace}`;
        const name = `E2E action 20 ${namespace.slice(0, 8)}`;
        await useAdminSession(page, superAdmin.sessionCookie);
        await page.goto(`${ADMIN_URL}/billing/addon-catalog`);
        await expect(page.getByTestId('addon-catalog-screen')).toBeVisible();
        await page.getByTestId('addon-catalog-create').click();
        const dialog = page.getByRole('dialog', { name: copy.createTitle });
        await dialog.getByLabel(copy.slug).fill(slug);
        await dialog.getByLabel(copy.name).fill(name);
        await dialog.getByLabel(copy.price).fill(String(price));
        await dialog.getByRole('button', { name: copy.addLimit }).click();
        await dialog.getByLabel(`${copy.limitKey} 1`).fill(key.key);
        await dialog.getByLabel(`${copy.limitValue} 1`).fill('3');
        await dialog.getByTestId('addon-create-submit').click();
        await expect(dialog).toHaveCount(0);
        const [created] = await execSQL<{
            addon_id: string;
            product_id: string;
            version_id: string;
        }>(
            `SELECT a.id AS addon_id, ap.id AS product_id, ap.version_id
             FROM addon a JOIN addon_product ap ON ap.addon_id = a.id WHERE a.slug = $1`,
            [slug]
        );
        if (!created) throw new Error('Expected editor-created addon product.');
        addonId = created.addon_id;
        productId = created.product_id;
        const oldVersionId = created.version_id;
        const row = page.getByTestId(`addon-catalog-row-${addonId}`);
        await expect(row).toContainText(name);
        await expect(row).toContainText(
            formatCurrency({ value: price / 100, locale: 'es-AR', currency: 'ARS' })
        );

        const ownerContext = await browser.newContext();
        try {
            const ownerPage = await ownerContext.newPage();
            await signUpCardSubscriber({
                page: ownerPage,
                world,
                user: owner,
                slug: 'owner-basico'
            });
        } finally {
            await ownerContext.close();
        }
        // The PUBLISHED listing is seeded setup; its authoring workflow is outside action 20.
        const listing = await createAccommodation({
            ownerId: owner.id,
            publicationStatus: PublicationStatusEnum.PUBLISHED,
            slugPrefix: 'b13b-editor'
        });
        // Purchase is setup through the real protected API and fake provider, not the editor action.
        const purchase = await fetch(`${API_URL}/api/v1/protected/billing/addons/purchases`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', cookie: owner.sessionCookie },
            body: JSON.stringify({
                productId,
                targetId: listing.id,
                orderRequestId: `b13b-${randomUUID()}`,
                addonVersionId: oldVersionId
            })
        });
        expect(purchase.status).toBe(201);
        const purchased = z
            .object({ data: AddonPurchaseResponseSchema })
            .parse(await purchase.json()).data;
        const [instance] = await execSQL<{ complement_subscription_id: string }>(
            'SELECT complement_subscription_id FROM addon_instance WHERE id = $1 AND owner_id = $2',
            [purchased.instanceId, owner.id]
        );
        if (!instance) throw new Error('Expected API-purchased addon instance.');
        const [link] = await execSQL<{ provider_id: string }>(
            'SELECT provider_id FROM provider_link WHERE subscription_id = $1',
            [instance.complement_subscription_id]
        );
        if (!link) throw new Error('Expected addon authorization.');
        await world.fakeServer.provider.approve({ authorizationId: link.provider_id });
        await deliverNotices({ fakeServer: world.fakeServer, advanceMs: FAKE_NOTICE_DELAY_MS });
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

        await row.getByTestId(`addon-version-new-${addonId}`).click();
        await row.getByLabel(`${copy.limitValue} 1`).fill('5');
        await row.getByTestId('addon-version-preview').click();
        const review = row.getByTestId('addon-version-review');
        await expect(review).toBeVisible();
        const change = review.getByTestId(`addon-version-change-changed-limit:${key.key}`);
        expect((await change.locator('td').allTextContents()).map((value) => value.trim())).toEqual(
            [`limit:${key.key}`, copy.kinds.changed, '3', '5']
        );
        await expect(review.locator('[data-testid^="addon-version-change-"]')).toHaveCount(1);
        await expect(review.getByTestId('addon-version-live-count')).toHaveText(
            copy.liveCount.replace('{count}', '1')
        );
        await expect(review.getByTestId('addon-version-anchored-note')).toHaveText(
            copy.anchoredNote
        );
        await review.getByTestId('addon-version-publish').click();
        await expect(page.getByTestId('addon-version-published')).toHaveText(copy.published);
        const [after] = await execSQL<{
            current_version_id: string;
            purchased_version_id: string;
            price: number;
        }>(
            `SELECT ap.version_id AS current_version_id, ai.addon_version_id AS purchased_version_id, ap.price
             FROM addon_product ap JOIN addon_instance ai ON ai.product_id = ap.id
             WHERE ap.id = $1 AND ai.id = $2`,
            [productId, purchased.instanceId]
        );
        const [newVersion] = await execSQL<{ id: string }>(
            `SELECT av.id FROM addon_version av JOIN addon_version_limit l ON l.addon_version_id = av.id
             WHERE av.addon_id = $1 AND l.key = $2 AND l.value = 5 ORDER BY av.created_at DESC LIMIT 1`,
            [addonId, key.key]
        );
        if (!newVersion) throw new Error('Expected the editor-created new version.');
        expect(after).toEqual({
            current_version_id: newVersion.id,
            purchased_version_id: oldVersionId,
            price
        });
    });

    test('un admin sin SUPER_ADMIN no tiene el editor', async ({ page }) => {
        if (!admin) throw new Error('Expected case-local ADMIN.');
        await useAdminSession(page, admin.sessionCookie);
        await page.goto(`${ADMIN_URL}/dashboard`);
        await expect(page.locator('a[href="/billing/addon-catalog"]')).toHaveCount(0);
        await page.goto(`${ADMIN_URL}/billing/addon-catalog`);
        await expect(page.getByTestId('addon-catalog-screen')).toHaveCount(0);
        const forbidden = await fetch(`${API_URL}/api/v1/admin/addon-catalog`, {
            headers: { cookie: admin.sessionCookie }
        });
        expect(forbidden.status).toBe(403);
    });
});
