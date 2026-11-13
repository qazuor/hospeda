import { expect, test } from '@playwright/test';
import {
    PermanentGrantCreateResponseSchema,
    PermanentGrantRevocationResponseSchema
} from '@repo/schemas';
import { z } from 'zod';
import {
    addonProviderIds,
    cleanupAddonEndToEnd,
    startAddonWorld
} from '../../fixtures/addon-end-to-end.ts';
import {
    type CreatedUser,
    createUser,
    markAdminToursSeen,
    markProfileCompleted
} from '../../fixtures/api-helpers.ts';
import {
    API_URL,
    activateCardSubscription,
    cleanupArrearsRows,
    createApiCardSubscription,
    type FakeWorld
} from '../../fixtures/arrears-cycle.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import {
    createFeaturedDestination,
    currentPlanVersion,
    deleteFeaturedDestination,
    monthlyOptionForAnySlug,
    readFeaturedFlag,
    readPublicList
} from '../../fixtures/listing-featured.ts';
import { renameListing } from '../../fixtures/listing-notices.ts';
import { cleanupPermanentGrantE2eRows } from '../../fixtures/permanent-grant-flow.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

/** TEST:HOS-2138:4-5 covers paid-plan notices, courtesy and permanent grants. */
test.describe('TEST:HOS-2138:4-5 plan, grant and courtesy feature listings @p0 @billing @clock', () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(300_000);
    let world: FakeWorld | null = null;
    let namespace = '';
    let userIds: string[] = [];
    let destinationId = '';

    test.beforeEach(async () => {
        const started = await startAddonWorld();
        world = started.world;
        namespace = started.namespace;
        userIds = [];
        destinationId = (await createFeaturedDestination()).id;
    });

    test.afterEach(async () => {
        let providerIds: string[] = [];
        try {
            await world?.fakeServer.close();
            providerIds = namespace ? await addonProviderIds({ namespace }) : [];
        } finally {
            try {
                await cleanupAddonEndToEnd({ userIds, providerIds });
                await cleanupPermanentGrantE2eRows({ userIds, providerIds });
                await cleanupArrearsRows({ userIds });
                await cleanupTestUsers(getDbPool(), userIds);
                if (destinationId) await deleteFeaturedDestination({ id: destinationId });
            } finally {
                await world?.mailCapture.close().catch(() => undefined);
                world = null;
                namespace = '';
                userIds = [];
                destinationId = '';
            }
        }
    });

    test('Pro activation and a courtesy grant feature both owner listings', async () => {
        if (!world) throw new Error('Expected case-local fake world.');
        const owner = await host();
        const admin = await createUser({ role: 'SUPER_ADMIN' });
        userIds.push(admin.id);
        await markAdminToursSeen({ userId: admin.id });
        const first = await accommodation(owner, 'S');
        expect(await readFeaturedFlag({ table: 'accommodations', id: first.id })).toBe(false);
        expect(await readPublicList({ vertical: 'accommodation', destinationId })).toEqual([
            { id: first.id, isFeatured: false }
        ]);
        const plan = await createApiCardSubscription({
            user: owner,
            billingOptionId: await monthlyOptionForAnySlug({ slug: 'owner-pro' })
        });
        // Activation only: a credited charge emits a second coverage notice whose
        // featured sync could still be in flight when the later listing is inserted,
        // featuring it before the courtesy and racing the `false` precondition below.
        await activateCardSubscription({
            fakeServer: world.fakeServer,
            subscriptionId: plan.subscriptionId
        });
        await expect
            .poll(() => readFeaturedFlag({ table: 'accommodations', id: first.id }))
            .toBe(true);
        expect(await readPublicList({ vertical: 'accommodation', destinationId })).toEqual([
            { id: first.id, isFeatured: true }
        ]);

        const later = await accommodation(owner, 'T');
        expect(await readFeaturedFlag({ table: 'accommodations', id: later.id })).toBe(false);
        const courtesy = await fetch(
            `${API_URL}/api/v1/admin/billing-subscription/${plan.subscriptionId}/courtesy/grant`,
            {
                method: 'POST',
                headers: { 'content-type': 'application/json', cookie: admin.sessionCookie },
                body: JSON.stringify({
                    expectedStatus: 'ACTIVE',
                    months: 1,
                    reason: 'TEST:HOS-2138:4 courtesy',
                    confirmed: true
                })
            }
        );
        expect(courtesy.status).toBe(200);
        const courtesyResult = z
            .object({
                data: z.object({
                    outcome: z.literal('GRANTED'),
                    courtesyGrantId: z.string().uuid()
                })
            })
            .parse(await courtesy.json()).data;
        expect(courtesyResult.outcome).toBe('GRANTED');
        await expect
            .poll(() => readFeaturedFlag({ table: 'accommodations', id: later.id }))
            .toBe(true);
        expect(await readFeaturedFlag({ table: 'accommodations', id: first.id })).toBe(true);
        expect(await readPublicList({ vertical: 'accommodation', destinationId })).toEqual([
            { id: first.id, isFeatured: true },
            { id: later.id, isFeatured: true }
        ]);
        expect(
            (
                await execSQL<{ status: string }>('SELECT status FROM subscription WHERE id = $1', [
                    plan.subscriptionId
                ])
            )[0]?.status
        ).toBe('PAUSED');
    });

    test('Premium permanent grant features its listing and revocation unfeatures and lowers it', async () => {
        const grantOwner = await host();
        const controlOwner = await host();
        const admin = await createUser({ role: 'SUPER_ADMIN' });
        userIds.push(admin.id);
        await markAdminToursSeen({ userId: admin.id });
        const boosted = await accommodation(grantOwner, 'Z');
        const a = await accommodation(controlOwner, 'A');
        expect(await readPublicList({ vertical: 'accommodation', destinationId })).toEqual([
            { id: a.id, isFeatured: false },
            { id: boosted.id, isFeatured: false }
        ]);
        const plan = await currentPlanVersion({ slug: 'owner-premium' });
        const response = await fetch(`${API_URL}/api/v1/admin/billing-permanent-grants`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', cookie: admin.sessionCookie },
            body: JSON.stringify({
                beneficiaryUserId: grantOwner.id,
                reason: 'TEST:HOS-2138:5 grant',
                includesAddons: false,
                anchors: [
                    {
                        vertical: 'accommodation',
                        planId: plan.planId,
                        floorPlanVersionId: plan.versionId
                    }
                ]
            })
        });
        expect(response.status).toBe(201);
        const result = PermanentGrantCreateResponseSchema.parse(
            z.object({ data: z.unknown() }).parse(await response.json()).data
        );
        expect(result.anchorIds).toHaveLength(1);
        await expect
            .poll(() => readFeaturedFlag({ table: 'accommodations', id: boosted.id }))
            .toBe(true);
        expect(await readPublicList({ vertical: 'accommodation', destinationId })).toEqual([
            { id: boosted.id, isFeatured: true },
            { id: a.id, isFeatured: false }
        ]);
        const revoked = await fetch(
            `${API_URL}/api/v1/admin/billing-permanent-grants/${result.permanentGrantId}/revocation`,
            {
                method: 'POST',
                headers: { 'content-type': 'application/json', cookie: admin.sessionCookie },
                body: JSON.stringify({ reason: 'TEST:HOS-2138:5 revoke' })
            }
        );
        expect(revoked.status).toBe(200);
        const revokedResult = PermanentGrantRevocationResponseSchema.parse(
            z.object({ data: z.unknown() }).parse(await revoked.json()).data
        );
        expect(revokedResult.permanentGrantId).toBe(result.permanentGrantId);
        await expect
            .poll(() => readFeaturedFlag({ table: 'accommodations', id: boosted.id }))
            .toBe(false);
        // The grant cancelled any prior title (S13) and revocation restores none
        // (DEC-GRANT-008), so the owner is left uncovered and the coverage listener
        // lowers the listing: it leaves the public list instead of returning to it.
        await expect
            .poll(async () => {
                const [row] = await execSQL<{ publication_status: string }>(
                    'SELECT publication_status FROM accommodations WHERE id = $1',
                    [boosted.id]
                );
                return row?.publication_status;
            })
            .toBe('UNPUBLISHED_BY_BILLING');
        expect(await readPublicList({ vertical: 'accommodation', destinationId })).toEqual([
            { id: a.id, isFeatured: false }
        ]);
    });

    async function host(): Promise<CreatedUser> {
        const owner = await createUser({ role: 'HOST' });
        userIds.push(owner.id);
        await markProfileCompleted({ userId: owner.id });
        return owner;
    }

    async function accommodation(
        owner: CreatedUser,
        label: string
    ): Promise<{ readonly id: string }> {
        const rows = await execSQL<{ id: string }>(
            `INSERT INTO accommodations (slug, name, summary, description, type, owner_id,
                 destination_id, extra_info, policies, publication_status, inactive_since, deadlines_version)
             VALUES ($1, $2, 'E2E summary', 'E2E description', 'HOUSE', $3, $4,
                 '{"capacity":2,"bedrooms":1,"bathrooms":1}'::jsonb,
                 '{"paymentMethods":["cash"],"minNights":1}'::jsonb,
                 'PUBLISHED', NOW(), 1) RETURNING id`,
            [
                `hos2138-${crypto.randomUUID()}`,
                `HOS-2138 ${label} ${crypto.randomUUID().slice(0, 8)}`,
                owner.id,
                destinationId
            ]
        );
        const listing = rows[0];
        if (!listing) throw new Error('Accommodation insert returned no id.');
        await renameListing({
            listingId: listing.id,
            name: `HOS-2138 ${label} ${listing.id.slice(0, 8)}`
        });
        return listing;
    }
});
