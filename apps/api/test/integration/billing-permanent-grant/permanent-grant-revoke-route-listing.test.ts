import type { CoverageChangedEvent } from '@repo/billing-verticals-contract';
import { accommodations, addonInstances, eq, getDb, providerLinks, subscriptions } from '@repo/db';
import {
    PermanentGrantRevocationResponseSchema,
    PermissionEnum,
    VerticalEnum
} from '@repo/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
let app: ReturnType<typeof initApp>;

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

async function instanceRow(instanceId: string) {
    const [row] = await getDb()
        .select({ status: addonInstances.status, titleAnchorId: addonInstances.titleAnchorId })
        .from(addonInstances)
        .where(eq(addonInstances.id, instanceId));
    return row;
}

describe('TEST:B5:13 AC:B5:26 — revoking through the route turns off a LISTING addon over the production ficha', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
        await ensureAccommodationCatalog();
        app = initApp({ clock, paymentProvider: providerSpy.provider });
    });
    beforeEach(() => audit.mockClear());
    afterAll(async () => {
        await retireGrantRevokeAddons();
        await cleanupPermanentGrantRows();
        await testDb.teardown();
    });

    it('keeps the published ficha while cancelling its titled addon and emitting ADDON REMOVED', async () => {
        const userId = await seedGrantUser('listing-revoke-beneficiary');
        const actorId = await seedGrantUser('listing-revoke-admin');
        const listingId = await seedOwnedAccommodationListing(userId);
        const addon = await seedGrantRevokeAddon({
            fake,
            userId,
            vertical: VerticalEnum.ACCOMMODATION,
            compatibleVerticals: [VerticalEnum.ACCOMMODATION],
            scopeType: 'LISTING',
            targetId: listingId
        });
        const anchor = await seedGrantPlan(VerticalEnum.ACCOMMODATION);
        const granted = await post(
            '/api/v1/admin/billing-permanent-grants',
            {
                beneficiaryUserId: userId,
                reason: 'Grant for listing addon revocation',
                includesAddons: true,
                anchors: [anchor]
            },
            actorId
        );
        expect(granted.status).toBe(201);
        const grantData = (await granted.json()).data as {
            permanentGrantId: string;
            anchorIds: string[];
        };
        const grantId = grantData.permanentGrantId;
        const titled = await instanceRow(addon.instanceId);
        expect(titled).toMatchObject({ status: 'ACTIVE', titleAnchorId: grantData.anchorIds[0] });
        const [complement] = await getDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, addon.complementId));
        expect(complement?.status).toBe('CANCELLED');
        const [link] = await getDb()
            .select({ authorizationId: providerLinks.providerId })
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, addon.complementId));
        expect(link?.authorizationId).toEqual(expect.any(String));

        const received: CoverageChangedEvent[] = [];
        const stopWatcher = getCoverageNotices().onCoverageChanged((event) => {
            if (event.userId === userId) received.push(event);
        });
        const cancelSpy = vi.spyOn(fake, 'cancel');
        const callsBeforeRevoke = cancelSpy.mock.calls.length;
        const revoked = await post(
            `/api/v1/admin/billing-permanent-grants/${grantId}/revocation`,
            { reason: 'Listing addon revoked' },
            actorId
        );
        stopWatcher();
        expect(revoked.status).toBe(200);
        const parsed = PermanentGrantRevocationResponseSchema.parse((await revoked.json()).data);
        expect(parsed.cancelledAddonInstanceIds).toEqual([addon.instanceId]);
        expect(await instanceRow(addon.instanceId)).toMatchObject({ status: 'CANCELLED' });
        const [listing] = await getDb()
            .select({
                deletedAt: accommodations.deletedAt,
                status: accommodations.publicationStatus
            })
            .from(accommodations)
            .where(eq(accommodations.id, listingId));
        expect(listing).toEqual({ deletedAt: null, status: 'PUBLISHED' });
        expect(received.filter((event) => event.sourceType === 'ADDON')).toEqual([
            { userId, vertical: VerticalEnum.ACCOMMODATION, sourceType: 'ADDON', change: 'REMOVED' }
        ]);
        expect(
            cancelSpy.mock.calls
                .slice(callsBeforeRevoke)
                .filter(([call]) => call.authorizationId === link?.authorizationId)
        ).toEqual([]);
        cancelSpy.mockRestore();
    });
});
