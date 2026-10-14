/**
 * TEST:1684:6 (e2e admin; AC-1684:4) — an admin takes a listing down and lifts
 * the moderation from the panel's listing moderation card (HOS-1684).
 *
 * TAKE_DOWN: the confirmation needs a real reason; the panel posts exactly
 * `{ action, reason }`; the listing becomes `MODERATED` and the card swaps its
 * buttons. LIFT with the switch off: the panel posts
 * `{ action, reason, keepFixRequest: false }`; the listing goes back to where
 * the API says (`UNPUBLISHED_BY_BILLING` or `PUBLISHED`, depending on the
 * owner's coverage — H8: not pinned here) and no fix request is left open.
 * The owner gets both notices.
 * Tags: @p1 @admin
 */

import { expect, test } from '@playwright/test';
import { PublicationStatusEnum } from '@repo/schemas';
import { createAccommodation, createUser, markAdminToursSeen } from '../../fixtures/api-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const ADMIN_URL = process.env.HOSPEDA_E2E_ADMIN_URL ?? 'http://localhost:3000';
const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

/** The Spanish badge label the card shows per publication state. */
const STATUS_LABEL_ES: Readonly<Record<string, string>> = {
    DRAFT: 'Borrador',
    PUBLISHED: 'Publicada',
    UNPUBLISHED_BY_BILLING: 'Sin publicar por el plan',
    ARCHIVED: 'Archivada',
    MODERATED: 'Moderada',
    PURGED: 'Eliminada'
};

interface ModerateAnswer {
    readonly data: { readonly publicationStatus: string; readonly fixRequestOpen: boolean };
}

test.describe('TEST:1684:6 AC-1684:4 listing moderation actions from the panel @p1 @admin', () => {
    const userIdsToCleanup: string[] = [];

    test.afterEach(async () => {
        if (userIdsToCleanup.length > 0) {
            await cleanupTestUsers(getDbPool(), [...userIdsToCleanup]);
            userIdsToCleanup.length = 0;
        }
    });

    test('takes a published listing down and lifts the moderation, with reasons', async ({
        page
    }) => {
        // Arrange
        const superAdmin = await createUser({ role: 'SUPER_ADMIN' }, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(superAdmin.id);
        await markAdminToursSeen({ userId: superAdmin.id });

        const owner = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(owner.id);
        const accommodation = await createAccommodation({
            ownerId: owner.id,
            publicationStatus: PublicationStatusEnum.PUBLISHED,
            slugPrefix: 'adm-09'
        });
        const listingId = accommodation.id;
        const [row] = await execSQL<{ name: string }>(
            'SELECT name FROM accommodations WHERE id = $1',
            [listingId]
        );
        const listingName = row?.name ?? '';
        expect(listingName).not.toBe('');

        const readStatus = async (): Promise<string | undefined> => {
            const [listing] = await execSQL<{ publication_status: string }>(
                'SELECT publication_status FROM accommodations WHERE id = $1',
                [listingId]
            );
            return listing?.publication_status;
        };
        const moderateResponse = () =>
            page.waitForResponse(
                (response) =>
                    response.url().endsWith(`/api/v1/admin/accommodations/${listingId}/moderate`) &&
                    response.request().method() === 'POST'
            );

        await page.context().addCookies(
            superAdmin.sessionCookie.split('; ').map((cookie) => {
                const [name, ...value] = cookie.split('=');
                return { name: (name ?? '').trim(), value: value.join('='), url: ADMIN_URL };
            })
        );

        await page.goto(`${ADMIN_URL}/accommodations/${listingId}`, {
            waitUntil: 'domcontentloaded'
        });

        // A loaded page is a prerequisite: an empty page must never satisfy it.
        await expect(
            page.getByTestId('entity-page-header').getByRole('heading', { name: listingName })
        ).toBeVisible({ timeout: 30_000 });

        const card = page.getByTestId('listing-moderation');
        const takeDownButton = card.getByTestId('listing-moderation-action-TAKE_DOWN');
        const liftButton = card.getByTestId('listing-moderation-action-LIFT');
        const dialog = page.getByTestId('listing-moderation-dialog');
        const reason = page.getByTestId('listing-moderation-reason');
        const confirm = page.getByTestId('listing-moderation-confirm');
        const result = card.getByTestId('listing-moderation-result');

        // ── TAKE_DOWN ────────────────────────────────────────────────────────
        await expect(takeDownButton).toBeVisible();
        await expect(liftButton).toHaveCount(0);

        // Act: open it; no reason (or only whitespace), no confirm
        await takeDownButton.click();
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText(listingName);
        await expect(confirm).toBeDisabled();
        await reason.fill('   ');
        await expect(confirm).toBeDisabled();

        const takeDownReason = 'Las fotos son de otra ficha';
        await reason.fill(takeDownReason);
        const takeDownPending = moderateResponse();
        await confirm.click();
        const takeDown = await takeDownPending;

        // Assert: exact body, 200, MODERATED in the answer, the base and the card
        expect(takeDown.status()).toBe(200);
        expect(takeDown.request().postDataJSON()).toEqual({
            action: 'TAKE_DOWN',
            reason: takeDownReason
        });
        const takeDownAnswer = (await takeDown.json()) as ModerateAnswer;
        expect(takeDownAnswer.data.publicationStatus).toBe('MODERATED');
        expect(await readStatus()).toBe('MODERATED');
        await expect(dialog).toBeHidden();
        await expect(result).toContainText(STATUS_LABEL_ES.MODERATED ?? 'MODERATED');

        // After the invalidation the card offers only LIFT.
        await expect(liftButton).toBeVisible({ timeout: 15_000 });
        await expect(takeDownButton).toHaveCount(0);

        // ── LIFT (switch off: close the fix request) ─────────────────────────
        await liftButton.click();
        await expect(dialog).toBeVisible();
        await expect(page.getByTestId('listing-moderation-keep-fix-request')).toHaveAttribute(
            'aria-checked',
            'false'
        );
        const liftReason = 'Ya corrigió las fotos';
        await reason.fill(liftReason);
        const liftPending = moderateResponse();
        await confirm.click();
        const lift = await liftPending;

        // Assert: exact body, 200, the base holds what the API answered, not MODERATED
        expect(lift.status()).toBe(200);
        expect(lift.request().postDataJSON()).toEqual({
            action: 'LIFT',
            reason: liftReason,
            keepFixRequest: false
        });
        const liftAnswer = (await lift.json()) as ModerateAnswer;
        expect(liftAnswer.data.fixRequestOpen).toBe(false);
        expect(liftAnswer.data.publicationStatus).not.toBe('MODERATED');
        expect(await readStatus()).toBe(liftAnswer.data.publicationStatus);
        await expect(result).toContainText(
            STATUS_LABEL_ES[liftAnswer.data.publicationStatus] ?? liftAnswer.data.publicationStatus
        );

        const [openFixRequests] = await execSQL<{ open: string }>(
            `SELECT count(*)::text AS open
               FROM fix_request
              WHERE entity_type = 'accommodation'
                AND entity_id = $1
                AND closed_at IS NULL`,
            [listingId]
        );
        expect(openFixRequests?.open).toBe('0');

        // ── The owner's notices, found by recipient and template ─────────────
        for (const template of [
            'verticals.listing-moderated',
            'verticals.listing-moderation-lifted'
        ]) {
            const notices = await execSQL<{ id: string }>(
                `SELECT id
                   FROM email_outbox
                  WHERE recipient_user_id = $1
                    AND template = $2
                    AND payload->>'listingId' = $3`,
                [owner.id, template, listingId]
            );
            expect(notices, `owner notice ${template}`).toHaveLength(1);
        }
    });
});
