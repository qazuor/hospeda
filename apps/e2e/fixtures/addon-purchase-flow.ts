import { expect, type Page } from '@playwright/test';
import { WEB_URL } from './arrears-cycle.ts';
import { execSQL } from './db-helpers.ts';
import { cleanupPermanentGrantE2eRows } from './permanent-grant-flow.ts';

const addonPurchaseCatalog = [
    {
        addonId: 'b10c0000-0000-4000-8000-000000000004',
        versionId: 'b10c0000-0000-4000-8000-000000000005',
        productId: 'b10c0000-0000-4000-8000-000000000006',
        slug: 'e2e-b10c-listing-recurring',
        name: 'E2E listing boost recurring',
        chargeKind: 'PERIODICO',
        validity: 'WHILE_SUBSCRIPTION_ALIVE',
        validityDays: null,
        cycle: 'monthly'
    }
] as const;

/** Ensure immutable, case-shared LISTING addon versions and their paid products. */
export async function ensureAddonPurchaseCatalog(): Promise<{
    readonly recurringProductId: string;
}> {
    // The E2E seed clears the catalog; these fixed rows survive individual cases.
    // addon_version is immutable, so never delete or update it during cleanup.
    for (const item of addonPurchaseCatalog) {
        await execSQL(
            `INSERT INTO addon (id, slug, name) VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING`,
            [item.addonId, item.slug, item.name]
        );
        await execSQL(
            `INSERT INTO addon_version (id, addon_id, validity, validity_days, scope_type)
             VALUES ($1, $2, $3, $4, 'LISTING') ON CONFLICT DO NOTHING`,
            [item.versionId, item.addonId, item.validity, item.validityDays]
        );
        await execSQL(
            `INSERT INTO addon_product
             (id, addon_id, version_id, price, currency, charge_kind, cycle, compatible_verticals)
             VALUES ($1, $2, $3, 250000, 'ARS', $4, $5, ARRAY['accommodation']::varchar[])
             ON CONFLICT DO NOTHING`,
            [item.productId, item.addonId, item.versionId, item.chargeKind, item.cycle]
        );
        const [row] = await execSQL<{ id: string }>(
            `SELECT ap.id FROM addon_product ap
             JOIN addon a ON a.id = ap.addon_id
             JOIN addon_version av ON av.id = ap.version_id
             WHERE ap.id = $1 AND a.id = $2 AND a.slug = $3 AND av.id = $4
               AND av.scope_type = 'LISTING' AND av.validity = $5
               AND av.validity_days IS NOT DISTINCT FROM $6::integer
               AND ap.charge_kind = $7 AND ap.cycle IS NOT DISTINCT FROM $8::text
               AND ap.price = 250000 AND ap.currency = 'ARS'
               AND 'accommodation' = ANY(ap.compatible_verticals)`,
            [
                item.productId,
                item.addonId,
                item.slug,
                item.versionId,
                item.validity,
                item.validityDays,
                item.chargeKind,
                item.cycle
            ]
        );
        if (!row) throw new Error(`Expected E2E addon purchase product ${item.productId}.`);
    }
    return {
        recurringProductId: addonPurchaseCatalog[0].productId
    };
}

/** Open the owner purchase summary after the protected offers response arrives. */
export async function openAddonPurchase(args: {
    readonly page: Page;
    readonly productId: string;
    readonly listingId: string;
}): Promise<void> {
    const responsePromise = args.page.waitForResponse(
        (response) =>
            response.url().includes('/api/v1/protected/billing/addons/offers') &&
            response.request().method() === 'GET',
        { timeout: 30_000 }
    );
    await args.page.goto(`${WEB_URL}/es/mi-cuenta/complementos/`);
    const response = await responsePromise;
    expect(response.ok(), `Addon offers HTTP ${response.status()}`).toBe(true);
    await args.page.getByTestId(`addon-offer-${args.productId}`).click();
    await args.page.getByTestId(`addon-target-${args.listingId}`).click();
    await expect(args.page.getByTestId('addon-purchase-summary')).toBeVisible();
}

/** Remove case-owned addon rows and provider tombstones, keeping catalog versions. */
export async function cleanupAddonPurchaseRows(args: {
    readonly userIds: readonly string[];
    readonly providerIds: readonly string[];
}): Promise<void> {
    await cleanupPermanentGrantE2eRows(args);
}
