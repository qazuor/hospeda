/**
 * UNCOVERED-OWNER — an owner with no coverage can read a listing but not edit it.
 *
 * Actors: a HOST whose accommodation trial is spent and who holds no subscription.
 * Tags: @p0 @verticals @billing @entitlement
 *
 * The rule (HOS-1884, replacing the retired host-03 / host-04 specs): coverage
 * gates WRITES, never READS. The owner keeps seeing their own listing, and the
 * moment they try to change a PUBLISHED one the API answers
 * `403 ENTITLEMENT_REQUIRED`.
 *
 * What "no coverage" means in the current model (measured, HOS-1884 step 1):
 * `resolveTrialAndBaseSources` ALWAYS appends the BASE source, so a spent trial
 * leaves `sources = [BASE]` and `covered = false` (BASE is not a TITLE source).
 * Step 5 of `resolveListingAccess` only rejects an EMPTY `sources` list, so it
 * lets this owner through, and the refusal comes from step 6: the BASE plan does
 * not carry `edit_accommodation_info`, so the response is
 * `ENTITLEMENT_REQUIRED` with `details.entitlementKey = 'edit_accommodation_info'`
 * (not `reason: 'NO_COVERAGE'`, which the bootstrap sources can never produce).
 * The twin integration test pins the same decision with no HTTP in between:
 * `packages/verticals/test/integration/listing-edit-uncovered-owner.integration.test.ts`.
 *
 * Two owners, not one flipped mid-test: the effective set is cached per user, so
 * reusing an owner after changing their trial would read the stale answer.
 *
 * @see packages/verticals/src/authorization/resolve-listing-access.ts
 * @see apps/api/src/middlewares/listing-access.ts
 */

import { expect, test } from '@playwright/test';
import { PublicationStatusEnum } from '@repo/schemas';
import { createAccommodation, createUser } from '../../fixtures/api-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

interface ErrorBody {
    readonly success?: boolean;
    readonly error?: {
        readonly code?: string;
        readonly details?: { readonly entitlementKey?: string | null };
    };
}

interface ProtectedAccommodationBody {
    readonly data?: { readonly id?: string; readonly name?: string };
}

test.describe('UNCOVERED-OWNER: read yes, edit no @p0 @verticals @billing @entitlement', () => {
    const userIds: string[] = [];

    test.afterEach(async () => {
        if (userIds.length > 0) {
            await cleanupTestUsers(getDbPool(), userIds);
            userIds.length = 0;
        }
    });

    /** A HOST with a PUBLISHED accommodation; `createAccommodation` grants the active trial. */
    async function createOwnerWithPublishedListing() {
        const owner = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        userIds.push(owner.id);
        const listing = await createAccommodation({
            ownerId: owner.id,
            publicationStatus: PublicationStatusEnum.PUBLISHED,
            slugPrefix: 'uncovered-owner'
        });
        return { owner, listing };
    }

    async function readName(listingId: string): Promise<string | undefined> {
        const rows = await execSQL<{ name: string }>(
            'SELECT name FROM accommodations WHERE id = $1',
            [listingId]
        );
        return rows[0]?.name;
    }

    test('owner with a spent trial and no subscription reads the listing (200) but cannot edit it (403 ENTITLEMENT_REQUIRED)', async ({
        page
    }) => {
        // Arrange: spend the trial. `ck_trial_clock_order` needs ends_at >= started_at,
        // so the clock moves as a whole.
        const { owner, listing } = await createOwnerWithPublishedListing();
        await execSQL(
            `UPDATE trial
                SET status = 'TRIAL_EXPIRED',
                    started_at = NOW() - INTERVAL '31 days',
                    ends_at = NOW() - INTERVAL '1 day'
              WHERE user_id = $1 AND vertical = 'accommodation'`,
            [owner.id]
        );
        const nameBefore = await readName(listing.id);

        // Act
        const read = await page.request.get(
            `${API_URL}/api/v1/protected/accommodations/${listing.id}`,
            { headers: { cookie: owner.sessionCookie } }
        );
        const edit = await page.request.put(
            `${API_URL}/api/v1/protected/accommodations/${listing.id}`,
            {
                data: { name: 'Uncovered owner edit that must be refused' },
                headers: { cookie: owner.sessionCookie }
            }
        );

        // Assert: reading is untouched by the lack of coverage...
        expect(read.status(), 'owner must still read their own listing').toBe(200);
        const readBody = (await read.json()) as ProtectedAccommodationBody;
        expect(readBody.data?.id).toBe(listing.id);

        // ...writing is refused with the entitlement the BASE plan lacks...
        expect(edit.status(), 'edit without coverage must be refused').toBe(403);
        const editBody = (await edit.json()) as ErrorBody;
        expect(editBody.error?.code).toBe('ENTITLEMENT_REQUIRED');
        expect(editBody.error?.details?.entitlementKey).toBe('edit_accommodation_info');

        // ...and nothing was written.
        expect(await readName(listing.id)).toBe(nameBefore);
    });

    test('control: an owner WITH coverage (active trial) passes the same PUT', async ({ page }) => {
        // Arrange: the active trial `createAccommodation` grants is the only difference.
        const { owner, listing } = await createOwnerWithPublishedListing();
        const newName = `Covered owner edit ${Date.now()}`;

        // Act
        const edit = await page.request.put(
            `${API_URL}/api/v1/protected/accommodations/${listing.id}`,
            { data: { name: newName }, headers: { cookie: owner.sessionCookie } }
        );

        // Assert
        expect(edit.status(), `covered owner edit failed: ${await edit.text()}`).toBe(200);
        expect(await readName(listing.id)).toBe(newName);
    });
});
