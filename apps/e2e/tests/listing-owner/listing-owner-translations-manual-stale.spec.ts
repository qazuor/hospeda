/**
 * LISTING-OWNER-TRANSLATIONS — a manual translation survives a Spanish edit
 * and is flagged stale until the owner confirms it again (HOS-2658).
 *
 * Actor: venue-owner-julieta@local.test (role VENUE_OWNER).
 * Listing: cafe-del-palacio-colon (venue). A different venue than
 * LISTING-OWNER-03 uses, so the two files never fight over `translation_meta`
 * under `fullyParallel`.
 *
 * Flow (never clicks «Traducir con IA», so it needs no AI provider):
 *   1. On the translations page the owner types «Descripción (EN)» and presses
 *      that pair's «Guardar» → `PUT …/translations` answers 200.
 *   2. In «Datos básicos» she changes the Spanish description and saves the
 *      section (PATCH).
 *   3. Back on translations, the EN description still holds her text and shows
 *      the stale alert («El texto en español cambió…»).
 *   4. She presses «Guardar» again without editing; the alert disappears.
 *
 * Tags: @p1 @listing-owner @editor
 *
 * Preconditions:
 *   - e2e:seed has run (pnpm --filter hospeda-e2e e2e:seed).
 *   - venue-owner-julieta@local.test exists with role VENUE_OWNER and owns
 *     cafe-del-palacio-colon.
 *   - Web and API servers are running (playwright.config webServer).
 *
 * Cleanup: `description`, `description_i18n` and `translation_meta` of the
 * venue are restored in `afterAll`.
 *
 * @see .specs/HOS-2658-one-listing-translation-model/spec.md
 * @see apps/web/src/components/account/editor/ListingTranslationsSection.client.tsx
 */

import { type BrowserContext, expect, type Page, test } from '@playwright/test';
import { signInExistingUser } from '../../fixtures/api-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL } from '../../fixtures/db-helpers.ts';
import {
    listingEditorUrl,
    saveListingEditor,
    waitForListingEditorHydration
} from '../../fixtures/listing-editor-helpers.ts';
import { setReactInputValue } from '../../fixtures/react19-input-helpers.ts';

const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:4321';
const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

const JULIETA = {
    email: 'venue-owner-julieta@local.test',
    password: 'Password123!'
} as const;

const VENUE_SLUG = 'cafe-del-palacio-colon';

const STALE_COPY = /el texto en español cambió/i;

type VenueTranslationRow = {
    readonly id: string;
    readonly description: string | null;
    readonly description_i18n: Record<string, string> | null;
    readonly translation_meta: Record<string, unknown> | null;
};

/** Injects the Better Auth session cookies into the browser context. */
async function authenticateContext(context: BrowserContext, sessionCookie: string): Promise<void> {
    const cookies = sessionCookie.split('; ').map((part) => {
        const eqIdx = part.indexOf('=');
        const name = eqIdx === -1 ? part.trim() : part.slice(0, eqIdx).trim();
        const value = eqIdx === -1 ? '' : part.slice(eqIdx + 1);
        return { name, value, url: WEB_URL };
    });
    await context.addCookies(cookies);
}

/** The translations section (a kit Section titled «Contenido por idioma»). */
function translationsSection({ page }: { readonly page: Page }) {
    return page.getByRole('region', { name: /contenido por idioma/i });
}

/** Presses one pair's «Guardar» and resolves with the PUT response. */
async function saveTranslationPair({
    page,
    venueId,
    pair
}: {
    readonly page: Page;
    readonly venueId: string;
    readonly pair: string;
}) {
    const put = page.waitForResponse(
        (response) =>
            response.url().includes(`/api/v1/protected/venues/${venueId}/translations`) &&
            response.request().method() === 'PUT',
        { timeout: 15_000 }
    );
    await translationsSection({ page })
        .locator(`[data-pair="${pair}"]`)
        .getByRole('button', { name: /^\s*guardar\s*$/i })
        .click();
    return put;
}

test.describe('LISTING-OWNER-TRANSLATIONS: manual translation goes stale after a Spanish edit @p1 @listing-owner @editor', () => {
    let original: VenueTranslationRow;

    test.beforeAll(async () => {
        const rows = await execSQL<VenueTranslationRow>(
            'SELECT id, description, description_i18n, translation_meta FROM venues WHERE slug = $1 LIMIT 1',
            [VENUE_SLUG]
        );
        const row = rows[0];
        if (!row) {
            throw new Error(`Venue '${VENUE_SLUG}' not found — run e2e:seed first`);
        }
        original = row;
    });

    test.afterAll(async () => {
        if (!original) return;
        await execSQL(
            'UPDATE venues SET description = $1, description_i18n = $2::jsonb, translation_meta = $3::jsonb WHERE id = $4',
            [
                original.description,
                JSON.stringify(original.description_i18n),
                JSON.stringify(original.translation_meta ?? {}),
                original.id
            ]
        );
    });

    test.beforeEach(async ({ page }) => {
        await seedCookieConsent(page);
    });

    test('owner saves Descripción (EN), edits the Spanish source, sees the stale alert and confirms it', async ({
        page,
        context
    }) => {
        test.setTimeout(120_000);
        const venueId = original.id;

        const sessionCookie = await signInExistingUser(
            { email: JULIETA.email, password: JULIETA.password },
            { apiBaseUrl: API_URL, webBaseUrl: WEB_URL }
        );
        await authenticateContext(context, sessionCookie);

        const translationsUrl = listingEditorUrl({
            webUrl: WEB_URL,
            vertical: 'venue',
            listingId: venueId,
            section: 'traducciones'
        });

        // ── 1. Manual EN description ─────────────────────────────────────
        await page.goto(translationsUrl, { waitUntil: 'load' });
        await waitForListingEditorHydration({ page });
        const descriptionEn = translationsSection({ page }).getByLabel(/^Descripción \(EN\)/);
        await expect(descriptionEn).toBeEditable({ timeout: 15_000 });

        const manualText = `E2E manual EN description ${Date.now()}, written by the owner.`;
        await setReactInputValue(descriptionEn, manualText);
        const firstSave = await saveTranslationPair({ page, venueId, pair: 'description:en' });
        expect(firstSave.ok(), `PUT failed: ${firstSave.status()}`).toBe(true);

        // ── 2. Change the Spanish source in «Datos básicos» ──────────────
        await page.goto(
            listingEditorUrl({
                webUrl: WEB_URL,
                vertical: 'venue',
                listingId: venueId,
                section: 'datos'
            }),
            { waitUntil: 'load' }
        );
        await waitForListingEditorHydration({ page });
        const descriptionEs = page.getByLabel('Descripción', { exact: true });
        await expect(descriptionEs).toBeEditable({ timeout: 15_000 });
        await setReactInputValue(
            descriptionEs,
            `Descripción en español cambiada por la prueba e2e ${Date.now()}, con largo suficiente.`
        );
        const patch = await saveListingEditor({ page, pathPattern: /\/protected\/venues\// });
        expect(patch.ok(), `PATCH failed: ${patch.status()}`).toBe(true);

        // ── 3. The manual text survived and is flagged stale ─────────────
        await page.goto(translationsUrl, { waitUntil: 'load' });
        await waitForListingEditorHydration({ page });
        const section = translationsSection({ page });
        await expect(section.getByLabel(/^Descripción \(EN\)/)).toHaveValue(manualText, {
            timeout: 15_000
        });
        const pair = section.locator('[data-pair="description:en"]');
        await expect(pair.getByText(STALE_COPY)).toBeVisible({ timeout: 10_000 });

        // ── 4. Confirming it again clears the alert ──────────────────────
        const secondSave = await saveTranslationPair({ page, venueId, pair: 'description:en' });
        expect(secondSave.ok(), `PUT failed: ${secondSave.status()}`).toBe(true);
        await expect(pair.getByText(STALE_COPY)).toHaveCount(0, { timeout: 10_000 });
        await expect(section.getByLabel(/^Descripción \(EN\)/)).toHaveValue(manualText);
    });
});
