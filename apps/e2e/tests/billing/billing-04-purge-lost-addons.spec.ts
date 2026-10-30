import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { PublicationStatusEnum } from '@repo/schemas';
import {
    createAccommodation,
    createUser,
    markProfileCompleted
} from '../../fixtures/api-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { attachSession, renameListing } from '../../fixtures/listing-notices.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';
const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:4321';
const created = { userIds: [] as string[], addonInstanceIds: [] as string[] };

test.describe('TEST:B13a:3 AC:B13a:4 the delete confirmation names the lost add-ons @billing', () => {
    test.afterEach(async () => {
        if (created.addonInstanceIds.length > 0) {
            await execSQL('DELETE FROM addon_instance WHERE id = ANY($1::uuid[])', [
                created.addonInstanceIds
            ]);
        }
        created.addonInstanceIds.length = 0;
        const userIds = [...created.userIds];
        created.userIds.length = 0;
        if (userIds.length > 0) await cleanupTestUsers(getDbPool(), userIds);
    });

    test('lists the add-on on one listing and an empty enumeration on the other', async ({
        page
    }) => {
        const owner = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        created.userIds.push(owner.id);
        await markProfileCompleted({ userId: owner.id });

        const withAddon = await createAccommodation({
            ownerId: owner.id,
            slugPrefix: 'billing-04-with-addon',
            publicationStatus: PublicationStatusEnum.DRAFT
        });
        const withoutAddon = await createAccommodation({
            ownerId: owner.id,
            slugPrefix: 'billing-04-without-addon',
            publicationStatus: PublicationStatusEnum.DRAFT
        });
        const addonName = `Fotos extra ${randomUUID().slice(0, 8)}`;
        const addonSlug = `hos1618-${randomUUID()}`;
        const addonRows = await execSQL<{
            addon_id: string;
            version_id: string;
            product_id: string;
        }>(
            `WITH addon_row AS (
                INSERT INTO addon (slug, name, description)
                VALUES ($1, $2, 'Extra listing photos')
                RETURNING id
            ), version_row AS (
                INSERT INTO addon_version (addon_id, validity, validity_days, scope_type)
                SELECT id, 'WHILE_SUBSCRIPTION_ALIVE', NULL, 'LISTING'
                FROM addon_row
                RETURNING id, addon_id
            ), product_row AS (
                INSERT INTO addon_product (
                    addon_id, version_id, price, currency, charge_kind, cycle, compatible_verticals
                )
                SELECT addon_id, id, 250000, 'ARS', 'PERIODICO', 'monthly', ARRAY['accommodation']::varchar[]
                FROM version_row
                RETURNING id
            )
            SELECT addon_row.id AS addon_id, version_row.id AS version_id, product_row.id AS product_id
            FROM addon_row CROSS JOIN version_row CROSS JOIN product_row`,
            [addonSlug, addonName]
        );
        const fixture = addonRows[0];
        if (!fixture) throw new Error('Failed to seed the purge preview add-on catalog');
        const instances = await execSQL<{ id: string }>(
            `INSERT INTO addon_instance (
                product_id, addon_version_id, owner_id, target_id, status, starts_at, ends_at
            ) VALUES ($1, $2, $3, $4, 'ACTIVE', NOW(), NULL)
            RETURNING id`,
            [fixture.product_id, fixture.version_id, owner.id, withAddon.id]
        );
        const instance = instances[0];
        if (!instance) throw new Error('Failed to seed the purge preview add-on instance');
        created.addonInstanceIds.push(instance.id);

        const withAddonName = `B13a2 con addon ${randomUUID().slice(0, 8)}`;
        const withoutAddonName = `B13a2 sin addon ${randomUUID().slice(0, 8)}`;
        await renameListing({ listingId: withAddon.id, name: withAddonName });
        await renameListing({ listingId: withoutAddon.id, name: withoutAddonName });

        await seedCookieConsent(page);
        await attachSession({ page, sessionCookie: owner.sessionCookie });
        await page.goto(`${WEB_URL}/es/mi-cuenta/propiedades/`);
        const list = page.getByRole('list', { name: 'Mis propiedades' });
        const addonCard = list.getByRole('listitem').filter({ hasText: withAddonName });
        await expect(addonCard).toHaveCount(1);
        await addonCard.getByRole('button', { name: 'Eliminar', exact: true }).click();
        const lostAddons = addonCard.getByTestId('purge-lost-addons');
        await expect(lostAddons).toHaveAttribute('data-count', '1');
        await expect(addonCard.getByTestId('purge-lost-addon')).toContainText(addonName);
        await expect(addonCard.getByTestId('purge-lost-addon')).toContainText(/\$\s?2\.500,00/);
        await addonCard.getByRole('button', { name: 'Cancelar', exact: true }).click();

        const emptyCard = list.getByRole('listitem').filter({ hasText: withoutAddonName });
        await expect(emptyCard).toHaveCount(1);
        await emptyCard.getByRole('button', { name: 'Eliminar', exact: true }).click();
        await expect(emptyCard.getByTestId('purge-lost-addons')).toHaveAttribute('data-count', '0');
    });
});
