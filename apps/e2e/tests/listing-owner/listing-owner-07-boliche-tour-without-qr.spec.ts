/**
 * AC:5:3 — A VENUE_OWNER who only has a BOLICHE does not see the menu QR step
 * in the venue welcome tour, because the QR widget renders nothing for a venue
 * whose `menu` section is `absent`. The positive control is a RESTAURANT with
 * an active trial, whose `menu` section is present.
 *
 * What this spec validates:
 *   1. A brand-new owner with a single BOLICHE opens `/es/mi-cuenta/comercio/`
 *      and the venue welcome tour starts by itself.
 *   2. The tour runs to the last step and never shows
 *      `account.welcomeTour.venueQr.title` ("QR de tu menu").
 *   3. The same flow for a RESTAURANT owner with a trial DOES show that step.
 *
 * The tour starts on this page because the page mounts `TourController` next to
 * the anchors its steps target (HOS-1856). The tourist tour (which every account
 * also qualifies for) is marked seen in the fixture so the vene tour is the one
 * that runs.
 *
 * Tags: @p0 @listing-owner
 *
 * @see apps/web/src/pages/[lang]/mi-cuenta/comercio/index.astro
 * @see apps/web/src/config/tours.ts (`web.venue.welcome`)
 * @see apps/web/src/lib/venue/menu-qr-tour-anchor.ts
 */

import { expect, type Page, test } from '@playwright/test';
import { VerticalEnum } from '@repo/schemas';
import {
    type CreatedUser,
    createUser,
    getAnyCityDestinationId,
    markProfileCompleted,
    refreshSession
} from '../../fixtures/api-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { ensureListingOwnerTrial } from '../../fixtures/listing-owner-trial.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:4321';
const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

/** The `account.welcomeTour.venueQr.title` copy in `es`. */
const VENUE_QR_TITLE = 'QR de tu menu';

/** The last step of `web.venue.welcome` (`account.welcomeTour.listingViews.title`). */
const LAST_STEP_TITLE = 'Visitas a tu ficha';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Attaches the Better Auth session cookies to the browser context. */
async function authenticateContext(page: Page, sessionCookie: string): Promise<void> {
    await page.context().addCookies(
        sessionCookie.split('; ').map((part) => {
            const separator = part.indexOf('=');
            const name = separator === -1 ? part.trim() : part.slice(0, separator).trim();
            const value = separator === -1 ? '' : part.slice(separator + 1);
            return { name, value, url: WEB_URL };
        })
    );
}

/** Marks one tour as seen through the protected tour-progress endpoint. */
async function markTourSeen(options: {
    readonly sessionCookie: string;
    readonly tourId: string;
    readonly version: number;
}): Promise<void> {
    const response = await fetch(`${API_URL}/api/v1/protected/users/me/tour-progress`, {
        method: 'PATCH',
        headers: {
            'content-type': 'application/json',
            cookie: options.sessionCookie,
            Origin: WEB_URL
        },
        body: JSON.stringify({ tourId: options.tourId, version: options.version })
    });
    if (!response.ok) {
        throw new Error(
            `markTourSeen: ${response.status} ${await response.text()} for ${options.tourId}`
        );
    }
}

/** Creates a venue listing owned by the given (just created) account. */
async function createVenue(options: {
    readonly owner: CreatedUser;
    readonly name: string;
    readonly type: 'BOLICHE' | 'RESTAURANT';
    readonly destinationId: string;
}): Promise<{ readonly id: string }> {
    const response = await fetch(`${API_URL}/api/v1/protected/venues/`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            cookie: options.owner.sessionCookie,
            Origin: WEB_URL
        },
        body: JSON.stringify({
            name: options.name,
            summary: `${options.name} is a venue created by the HOS-1856 tour spec.`,
            description:
                `${options.name} exists only to give its owner a single listing so the ` +
                'venue welcome tour has a real target set. It is deleted after the run.',
            type: options.type,
            destinationId: options.destinationId
        })
    });

    const body = (await response.json()) as {
        readonly success?: boolean;
        readonly data?: { readonly id?: string };
        readonly error?: { readonly message?: string };
    };
    if (!response.ok || !body.data?.id) {
        throw new Error(
            `createVenue(${options.type}) failed: ${response.status} ${body.error?.message ?? ''}`
        );
    }
    return { id: body.data.id };
}

/** Runs the auto-started tour to its end and returns every popover title. */
async function runTourAndCollectTitles(page: Page): Promise<readonly string[]> {
    await page.locator('.driver-popover').waitFor({ state: 'visible', timeout: 20_000 });

    const titles: string[] = [];
    const title = page.locator('.driver-popover-title');

    for (let step = 0; step < 12; step += 1) {
        await title.waitFor({ state: 'visible' });
        titles.push((await title.innerText()).trim());

        const nextButton = page.locator('.driver-popover-next-btn');
        if (!(await nextButton.isVisible())) {
            await page.locator('.driver-popover-done-btn').click();
            break;
        }

        await nextButton.click();
        await page.waitForTimeout(400);
    }

    return titles;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('AC:5:3 boliche-only owner tour skips the menu QR step @p0 @listing-owner', () => {
    test.describe.configure({ mode: 'serial' });

    const ownedUserIds: string[] = [];
    let destinationId = '';

    test.beforeAll(async () => {
        destinationId = await getAnyCityDestinationId();
    });

    test.afterAll(async () => {
        if (ownedUserIds.length > 0) {
            // `cleanupTestUsers` predates venue listings (it only lists
            // `accommodations`), and its triggers-off teardown would leave
            // orphan venues behind. Delete them first, explicitly.
            await execSQL('DELETE FROM venues WHERE owner_id = ANY($1::uuid[])', [ownedUserIds]);
            await cleanupTestUsers(getDbPool(), ownedUserIds);
        }
    });

    test('boliche-only owner skips the QR step; restaurant with trial shows it', async ({
        page,
        context
    }) => {
        // ── BOLICHE-only owner ──────────────────────────────────────────────
        const bolicheOwner = await createUser({}, { apiBaseUrl: API_URL });
        ownedUserIds.push(bolicheOwner.id);

        await createVenue({
            owner: bolicheOwner,
            name: `Boliche tour ${Date.now()}`,
            type: 'BOLICHE',
            destinationId
        });

        await markProfileCompleted({ userId: bolicheOwner.id });
        // Creating the listing grants VENUE_OWNER; re-sign-in so the browser
        // session definitely carries it.
        const bolicheCookie = await refreshSession(bolicheOwner, { apiBaseUrl: API_URL });
        // Every account also holds USER, so the tourist tour outranks the venue
        // tour. Mark it seen so the venue tour is the pending one.
        await markTourSeen({
            sessionCookie: bolicheCookie,
            tourId: 'web.tourist.welcome',
            version: 1
        });
        await authenticateContext(page, bolicheCookie);
        await seedCookieConsent(page);

        await page.goto(`${WEB_URL}/es/mi-cuenta/comercio/`);

        const bolicheTitles = await runTourAndCollectTitles(page);
        expect(bolicheTitles).not.toContain(VENUE_QR_TITLE);
        expect(bolicheTitles.at(-1)).toBe(LAST_STEP_TITLE);

        // ── RESTAURANT with trial: positive control ─────────────────────────
        const restaurantOwner = await createUser({}, { apiBaseUrl: API_URL });
        ownedUserIds.push(restaurantOwner.id);

        await createVenue({
            owner: restaurantOwner,
            name: `Restaurant tour ${Date.now()}`,
            type: 'RESTAURANT',
            destinationId
        });
        await ensureListingOwnerTrial(getDbPool(), restaurantOwner.id, VerticalEnum.VENUE);

        await markProfileCompleted({ userId: restaurantOwner.id });
        const restaurantCookie = await refreshSession(restaurantOwner, { apiBaseUrl: API_URL });
        await markTourSeen({
            sessionCookie: restaurantCookie,
            tourId: 'web.tourist.welcome',
            version: 1
        });

        // Fresh context so the first owner's session and seen-state cannot leak.
        const restaurantContext = await context.browser()?.newContext();
        if (!restaurantContext) {
            throw new Error('Unable to create a second browser context');
        }
        const restaurantPage = await restaurantContext.newPage();
        try {
            await authenticateContext(restaurantPage, restaurantCookie);
            await seedCookieConsent(restaurantPage);

            await restaurantPage.goto(`${WEB_URL}/es/mi-cuenta/comercio/`);

            const restaurantTitles = await runTourAndCollectTitles(restaurantPage);
            expect(restaurantTitles).toContain(VENUE_QR_TITLE);
            expect(restaurantTitles.at(-1)).toBe(LAST_STEP_TITLE);
        } finally {
            await restaurantContext.close();
        }
    });
});
