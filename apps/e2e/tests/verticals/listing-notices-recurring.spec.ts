/**
 * TEST:V8a:7 (AC:V8a:6), row 25 of `V/19` §4, HOS-1495 (V8a.4).
 * `listing-notices.spec.ts` left row 25 out until V6.13 registered the real
 * `ficha` (HOS-1483); this file closes that gap. A recurring add-on is an
 * `ADDON` source of scope `LISTING` aimed at the listing with
 * `until = 'NO_KNOWN_DATE'` (`countRecurringListingAddons`), produced by an
 * `ACTIVE` instance of a `WHILE_SUBSCRIPTION_ALIVE` + `LISTING` version.
 * This uses only its own users, listing and add-on rows, never the global plan
 * catalog. Not `@p0`.
 */

import { randomUUID } from 'node:crypto';
import { expect, type Page, test } from '@playwright/test';
import { PublicationStatusEnum } from '@repo/schemas';
import {
    createAccommodation,
    createUser,
    markProfileCompleted
} from '../../fixtures/api-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import {
    attachSession,
    cleanupListingNoticeRows,
    readPublicationStatus,
    renameListing
} from '../../fixtures/listing-notices.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';
const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:4321';
const created = {
    userIds: [] as string[],
    listingIds: [] as string[],
    addonInstanceIds: [] as string[],
    addonProductIds: [] as string[],
    addonVersionIds: [] as string[],
    addonIds: [] as string[]
};

async function createOwner(): Promise<{ readonly id: string; readonly sessionCookie: string }> {
    const owner = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
    created.userIds.push(owner.id);
    await markProfileCompleted({ userId: owner.id });
    return owner;
}

async function createListing(input: {
    readonly ownerId: string;
    readonly name: string;
}): Promise<string> {
    const listing = await createAccommodation({
        ownerId: input.ownerId,
        slugPrefix: `v8a-recurring-${randomUUID().slice(0, 8)}`,
        publicationStatus: PublicationStatusEnum.PUBLISHED
    });
    created.listingIds.push(listing.id);
    await renameListing({ listingId: listing.id, name: input.name });
    return listing.id;
}

async function openPropertyCard(input: {
    readonly page: Page;
    readonly sessionCookie: string;
    readonly name: string;
}) {
    await seedCookieConsent(input.page);
    await attachSession({ page: input.page, sessionCookie: input.sessionCookie });
    await input.page.goto(`${WEB_URL}/es/mi-cuenta/propiedades/`);
    const list = input.page.getByRole('list', { name: 'Mis propiedades' });
    const card = list.getByRole('listitem').filter({ hasText: input.name });
    await expect(card).toHaveCount(1);
    return card;
}

function uniqueName(): string {
    return `V8a destaque recurrente ${randomUUID().slice(0, 8)}`;
}

test.describe('Listing notices of V8a, row 25 @verticals @billing', () => {
    test.afterEach(async () => {
        for (const [table, ids] of [
            ['addon_instance', created.addonInstanceIds],
            ['addon_product', created.addonProductIds],
            ['addon_version', created.addonVersionIds],
            ['addon', created.addonIds]
        ] as const) {
            for (const id of ids) {
                try {
                    await execSQL(`DELETE FROM ${table} WHERE id = $1::uuid`, [id]);
                } catch (error) {
                    const code =
                        typeof error === 'object' && error !== null && 'code' in error
                            ? error.code
                            : undefined;
                    if (table === 'addon_instance' || code !== '23503') throw error;
                    // H-8: leave uniquely-slugged catalog rows if a foreign key retains them.
                }
            }
            ids.length = 0;
        }
        const userIds = [...created.userIds];
        const listingIds = [...created.listingIds];
        created.userIds.length = 0;
        created.listingIds.length = 0;
        try {
            await cleanupListingNoticeRows({ userIds, listingIds });
        } finally {
            await cleanupTestUsers(getDbPool(), userIds);
        }
    });

    test('TEST:V8a:7 row 25: the unpublish confirmation says the recurring boost keeps being charged until it is cancelled', async ({
        page
    }) => {
        const owner = await createOwner();
        const name = uniqueName();
        const listingId = await createListing({ ownerId: owner.id, name });
        const slug = `hos1495-${randomUUID()}`;
        const addonRows = await execSQL<{
            addon_id: string;
            version_id: string;
            product_id: string;
        }>(
            `WITH addon_row AS (
                INSERT INTO addon (slug, name, description)
                VALUES ($1, $2, 'Recurring listing highlight')
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
            [slug, `Destaque recurrente ${randomUUID().slice(0, 8)}`]
        );
        const catalog = addonRows[0];
        if (!catalog) throw new Error('Failed to seed the recurring listing add-on catalog');
        created.addonIds.push(catalog.addon_id);
        created.addonVersionIds.push(catalog.version_id);
        created.addonProductIds.push(catalog.product_id);
        const instances = await execSQL<{ id: string }>(
            `INSERT INTO addon_instance (
                product_id, addon_version_id, owner_id, target_id, status, starts_at, ends_at
            ) VALUES ($1, $2, $3, $4, 'ACTIVE', NOW(), NULL)
            RETURNING id`,
            [catalog.product_id, catalog.version_id, owner.id, listingId]
        );
        const instance = instances[0];
        if (!instance) throw new Error('Failed to seed the recurring listing add-on instance');
        created.addonInstanceIds.push(instance.id);

        const card = await openPropertyCard({ page, sessionCookie: owner.sessionCookie, name });
        await card.getByRole('button', { name: 'Despublicar', exact: true }).click();

        await expect(card.getByTestId('unpublish-recurring-note')).toHaveText(
            'Tenés 1 destaque recurrente sobre esta ficha: se sigue cobrando aunque no esté publicada, hasta que lo des de baja.'
        );
        await card.getByRole('button', { name: 'Cancelar', exact: true }).click();
        expect(await readPublicationStatus({ listingId })).toBe('PUBLISHED');
    });
});
