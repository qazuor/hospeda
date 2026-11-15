import { accommodations, addonInstances, eq, getDb, inArray, permanentGrants } from '@repo/db';
import { PermanentGrantCreateResponseSchema, PermissionEnum, VerticalEnum } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { getCoverageNotices } from '../../../src/utils/listing-access/coverage-notices';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    routeClock,
    routeFake,
    spyingProvider
} from '../billing-subscription/revocation-route-fixtures';
import { ensureAccommodationCatalog } from '../listing-publication/publication-routes.helpers';
import {
    cleanupPermanentGrantRows,
    retireGrantRevokeAddons,
    seedGrantPlan,
    seedGrantRevokeAddon,
    seedGrantUser,
    seedOwnedAccommodationListing
} from './grant-fixtures';

const audit = vi.hoisted(() => vi.fn());
vi.mock('../../../src/utils/audit-logger', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    auditLog: audit
}));

const clock = routeClock();
const fake = routeFake(clock);
const providerSpy = spyingProvider(fake);
const app = initApp({ clock, paymentProvider: providerSpy.provider });

function post(path: string, body: Record<string, unknown>, actorId: string) {
    return app.request(path, {
        method: 'POST',
        headers: actorHeaders({
            id: actorId,
            role: 'SUPER_ADMIN',
            permissions: [
                PermissionEnum.ACCESS_PANEL_ADMIN,
                PermissionEnum.BILLING_GRANT_COMPLIMENTARY
            ]
        }),
        body: JSON.stringify(body)
    });
}

async function createTitledGrant(args: {
    readonly ownerId: string;
    readonly actorId: string;
    readonly listingIds: readonly string[];
    readonly label: string;
}) {
    const addons = await Promise.all(
        args.listingIds.map((listingId) =>
            seedGrantRevokeAddon({
                fake,
                userId: args.ownerId,
                vertical: VerticalEnum.ACCOMMODATION,
                compatibleVerticals: [VerticalEnum.ACCOMMODATION],
                scopeType: 'LISTING',
                targetId: listingId
            })
        )
    );
    const anchor = await seedGrantPlan(VerticalEnum.ACCOMMODATION);
    const granted = await post(
        '/api/v1/admin/billing-permanent-grants',
        {
            beneficiaryUserId: args.ownerId,
            reason: `Grant for ${args.label}`,
            includesAddons: true,
            anchors: [anchor]
        },
        args.actorId
    );
    expect(granted.status).toBe(201);
    const grant = PermanentGrantCreateResponseSchema.parse((await granted.json()).data);
    const anchorId = grant.anchorIds[0];
    if (!anchorId) throw new Error('Expected grant anchor');
    return { grantId: grant.permanentGrantId, anchorId, addons };
}

describe('HOS-2069 revoking a grant whose titled LISTING addon targets a soft-deleted listing fails closed', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
        await ensureAccommodationCatalog();
    });
    afterAll(async () => {
        await retireGrantRevokeAddons();
        await cleanupPermanentGrantRows();
        await testDb.teardown();
    });

    it('answers 409 ALREADY_EXISTS PERMANENT_GRANT_LISTING_SOFT_DELETED and revokes nothing', async () => {
        // Arrange
        const userId = await seedGrantUser('listing-soft-deleted-beneficiary');
        const actorId = await seedGrantUser('listing-soft-deleted-admin');
        const listingId = await seedOwnedAccommodationListing(userId);
        const { grantId, anchorId, addons } = await createTitledGrant({
            ownerId: userId,
            actorId,
            listingIds: [listingId],
            label: 'listing soft-deleted refusal'
        });
        const addon = addons[0];
        if (!addon) throw new Error('Expected titled addon fixture');
        await getDb()
            .update(accommodations)
            .set({ deletedAt: new Date() })
            .where(eq(accommodations.id, listingId));
        const received: unknown[] = [];
        const stopWatcher = getCoverageNotices().onCoverageChanged((event) => {
            if (event.userId === userId) received.push(event);
        });
        const cancelSpy = vi.spyOn(fake, 'cancel');
        const callsBeforeRevoke = cancelSpy.mock.calls.length;

        // Act
        const revoked = await post(
            `/api/v1/admin/billing-permanent-grants/${grantId}/revocation`,
            { reason: 'Listing addon revoke refusal' },
            actorId
        );
        stopWatcher();

        // Assert
        expect(revoked.status).toBe(409);
        expect(await revoked.json()).toMatchObject({
            error: {
                code: 'ALREADY_EXISTS',
                reason: 'PERMANENT_GRANT_LISTING_SOFT_DELETED'
            }
        });
        const [grant] = await getDb()
            .select({ revokedAt: permanentGrants.revokedAt })
            .from(permanentGrants)
            .where(eq(permanentGrants.id, grantId));
        expect(grant?.revokedAt).toBeNull();
        const [instance] = await getDb()
            .select({ status: addonInstances.status, titleAnchorId: addonInstances.titleAnchorId })
            .from(addonInstances)
            .where(eq(addonInstances.id, addon.instanceId));
        expect(instance).toMatchObject({ status: 'ACTIVE', titleAnchorId: anchorId });
        expect(received).toEqual([]);
        expect(cancelSpy.mock.calls.slice(callsBeforeRevoke)).toEqual([]);
        cancelSpy.mockRestore();
    });

    it('two titled addons, the second on a soft-deleted listing: the first is not cancelled either', async () => {
        // Arrange
        const userId = await seedGrantUser('listing-soft-deleted-rollback-beneficiary');
        const actorId = await seedGrantUser('listing-soft-deleted-rollback-admin');
        const listingIds = [
            await seedOwnedAccommodationListing(userId),
            await seedOwnedAccommodationListing(userId)
        ];
        const { grantId, anchorId, addons } = await createTitledGrant({
            ownerId: userId,
            actorId,
            listingIds,
            label: 'listing soft-deleted rollback'
        });
        const ordered = [...addons].sort((left, right) =>
            left.instanceId.localeCompare(right.instanceId)
        );
        const first = ordered[0];
        const second = ordered[1];
        if (!first || !second) throw new Error('Expected two titled addon fixtures');
        const [deletedAddon] = await getDb()
            .select({ targetId: addonInstances.targetId })
            .from(addonInstances)
            .where(eq(addonInstances.id, second.instanceId));
        if (!deletedAddon?.targetId) throw new Error('Expected LISTING addon target');
        await getDb()
            .update(accommodations)
            .set({ deletedAt: new Date() })
            .where(eq(accommodations.id, deletedAddon.targetId));

        // Act
        const revoked = await post(
            `/api/v1/admin/billing-permanent-grants/${grantId}/revocation`,
            { reason: 'Listing addon rollback refusal' },
            actorId
        );

        // Assert
        expect(revoked.status).toBe(409);
        const instances = await getDb()
            .select({
                id: addonInstances.id,
                status: addonInstances.status,
                titleAnchorId: addonInstances.titleAnchorId
            })
            .from(addonInstances)
            .where(inArray(addonInstances.id, [first.instanceId, second.instanceId]));
        expect(instances).toHaveLength(2);
        for (const instance of instances)
            expect(instance).toMatchObject({ status: 'ACTIVE', titleAnchorId: anchorId });
    });
});
