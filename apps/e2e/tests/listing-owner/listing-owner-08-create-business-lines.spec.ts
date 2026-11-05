/**
 * LISTING-OWNER-08 — AC:5:1: a new owner creates venues with business lines
 * preselected by type.
 *
 * What this validates:
 *  1. A BAR starts with BOTH catalog lines checked (`food`, `nightlife`).
 *  2. A HELADERIA has NO `nightlife` option at all and starts with `food`.
 *  3. Both selections reach the create endpoint and are persisted on the row.
 *
 * Actors: two fresh users created through the real signup API, one per venue —
 * the trial account allows a single venue, so reusing one owner would turn the
 * second create into a cap rejection (HOS-1787 leaf 5.6).
 *
 * Tags: @p0 @listing-owner
 *
 * @see apps/web/src/components/listing/editor/BusinessLinesField.client.tsx
 * @see apps/web/src/components/listing/ListingCreateForm.client.tsx
 * @see packages/schemas/src/catalog/business-lines.ts
 */

import type { BrowserContext, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import {
    createUser,
    markProfileCompleted,
    signInExistingUser
} from '../../fixtures/api-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:18321';
const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';

const VENUE_FORM_PATH = '/es/publicar/comer-y-salir/?create=1';

interface VenueFixture {
    readonly userId: string;
    readonly email: string;
    readonly password: string;
    readonly sessionCookie: string;
}

const created: VenueFixture[] = [];

/** Injects the sign-in session cookie into the Playwright context. */
async function authenticateContext(context: BrowserContext, sessionCookie: string): Promise<void> {
    const parsed = sessionCookie.split('; ').map((part) => {
        const eqIdx = part.indexOf('=');
        const name = eqIdx === -1 ? part.trim() : part.slice(0, eqIdx).trim();
        const value = eqIdx === -1 ? '' : part.slice(eqIdx + 1);
        return { name, value, url: WEB_URL };
    });
    await context.addCookies(parsed);
}

/** Creates a fresh verified, onboarded user and signs it in. */
async function createOwner(): Promise<VenueFixture> {
    const user = await createUser();
    await markProfileCompleted({ userId: user.id });
    const sessionCookie = await signInExistingUser(
        { email: user.email, password: user.password },
        { apiBaseUrl: API_URL, webBaseUrl: WEB_URL }
    );

    const fixture = {
        userId: user.id,
        email: user.email,
        password: user.password,
        sessionCookie
    };
    created.push(fixture);
    return fixture;
}

/** Picks a seeded CITY destination, if the select is rendered. */
async function selectDestination(page: Page): Promise<void> {
    const select = page.locator('#cc-destinationId');
    if ((await select.count()) === 0) return;

    const values = await select
        .locator('option')
        .evaluateAll((options) =>
            options.map((option) => (option as HTMLOptionElement).value).filter(Boolean)
        );
    if (values[0]) await select.selectOption(values[0]);
}

/** Fills the create form and submits it, returning the new venue id. */
async function createVenue(
    page: Page,
    input: {
        readonly name: string;
        readonly type: string;
        readonly summary: string;
        readonly description: string;
    }
): Promise<string> {
    await page.goto(`${WEB_URL}${VENUE_FORM_PATH}`, { waitUntil: 'load' });

    await page.getByLabel('Categoría').selectOption(input.type);
    await selectDestination(page);

    await page.getByLabel('Nombre del comercio').fill(input.name);
    await page.getByLabel('Resumen').fill(input.summary);
    await page.getByLabel('Descripción').fill(input.description);

    await page.getByTestId('listing-create-submit').click();

    await page.waitForURL(/\/mi-cuenta\/comercio\/venue\/[0-9a-f-]+\/editar/, {
        timeout: 30_000
    });

    const match = page.url().match(/\/venue\/([0-9a-f-]+)\/editar/);
    if (!match?.[1]) throw new Error(`No venue id in ${page.url()}`);
    return match[1];
}

/** Reads the persisted business lines of one venue. */
async function readBusinessLines(venueId: string): Promise<readonly string[]> {
    const rows = await execSQL<{ business_lines: string[] }>(
        'SELECT business_lines FROM venues WHERE id = $1 LIMIT 1',
        [venueId]
    );
    return rows[0]?.business_lines ?? [];
}

test.describe('LISTING-OWNER-08: owner creates venues with business lines preselected by type', () => {
    test.beforeEach(async ({ page }) => {
        await seedCookieConsent(page);
    });

    test.afterAll(async () => {
        const userIds = created.map((entry) => entry.userId);
        if (userIds.length > 0) {
            // `cleanupTestUsers` disables FK triggers, so the venues have to go
            // explicitly — otherwise they survive pointing at a deleted user.
            await execSQL('DELETE FROM venues WHERE owner_id = ANY($1::uuid[])', [userIds]);
        }
        await cleanupTestUsers(getDbPool(), userIds);
    });

    test('AC:5:1 owner creates venues with business lines preselected by type @p0 @listing-owner', async ({
        page,
        context
    }) => {
        // ── BAR: both catalog lines preselected ───────────────────────────
        const barOwner = await createOwner();
        await authenticateContext(context, barOwner.sessionCookie);

        await page.goto(`${WEB_URL}${VENUE_FORM_PATH}`, { waitUntil: 'load' });
        await page.getByLabel('Categoría').selectOption('BAR');

        await expect(page.getByTestId('business-line-food')).toBeChecked();
        await expect(page.getByTestId('business-line-nightlife')).toBeChecked();

        const barId = await createVenue(page, {
            name: `Bar de prueba ${Date.now()}`,
            type: 'BAR',
            summary: 'Bar de prueba con música y tragos',
            description: 'Un bar de prueba con barra, tragos y música para validar los rubros.'
        });

        expect(await readBusinessLines(barId)).toEqual(['food', 'nightlife']);

        // ── HELADERIA: no nightlife option, only food persisted ────────────
        const iceCreamOwner = await createOwner();
        await authenticateContext(context, iceCreamOwner.sessionCookie);

        await page.goto(`${WEB_URL}${VENUE_FORM_PATH}`, { waitUntil: 'load' });
        await page.getByLabel('Categoría').selectOption('HELADERIA');

        await expect(page.getByTestId('business-line-nightlife')).toHaveCount(0);
        await expect(page.getByTestId('business-line-food')).toBeChecked();

        const heladeriaId = await createVenue(page, {
            name: `Heladería de prueba ${Date.now()}`,
            type: 'HELADERIA',
            summary: 'Heladería de prueba con sabores artesanales',
            description: 'Una heladería de prueba con helados artesanales para validar los rubros.'
        });

        expect(await readBusinessLines(heladeriaId)).toEqual(['food']);
    });
});
