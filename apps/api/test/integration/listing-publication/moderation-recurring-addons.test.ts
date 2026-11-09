import type { CoverageResponse } from '@repo/billing-verticals-contract';
import { accommodations, addonInstances, emailOutbox, eq, getDb } from '@repo/db';
import { PermissionEnum, PublicationStatusEnum, RoleEnum, VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    createListing,
    createOwner,
    createVerticalDestination,
    readResponse
} from './publication-routes.helpers';
import { deletePurgePreviewInstances, seedPurgePreviewAddon } from './purge-preview-fixtures';

const { coverageByOwner, failRead, coverageCalls } = vi.hoisted(() => ({
    coverageByOwner: new Map<string, CoverageResponse>(),
    failRead: { value: false },
    coverageCalls: vi.fn()
}));
vi.mock('../../../src/utils/listing-access/ports', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/utils/listing-access/ports')>();
    return {
        ...actual,
        getListingAccessPorts: () => {
            const ports = actual.getListingAccessPorts();
            return {
                ...ports,
                billing: {
                    ...ports.billing,
                    coverage: async (args: { userId: string; vertical: VerticalEnum }) => {
                        coverageCalls(args);
                        if (failRead.value) throw new Error('coverage unavailable');
                        return coverageByOwner.get(args.userId) ?? { covered: false, sources: [] };
                    }
                }
            };
        }
    };
});

const app = initApp();
const listingIds: string[] = [];
const instanceIds: string[] = [];

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});
afterEach(async () => {
    coverageByOwner.clear();
    failRead.value = false;
    coverageCalls.mockClear();
    await deletePurgePreviewInstances({ instanceIds: instanceIds.splice(0) });
    for (const id of listingIds.splice(0))
        await getDb().delete(accommodations).where(eq(accommodations.id, id));
});
afterAll(async () => testDb.teardown());

describe('TEST:B13b:1 AC:B13b:1 the moderation notice names recurring features and offers the withdrawal', () => {
    async function moderateWithCoverage(failingRead: boolean) {
        const owner = await createOwner();
        const admin = await createOwner();
        const destinationId = await createVerticalDestination();
        const listingId = await createListing({
            ownerId: owner.id,
            destinationId,
            status: PublicationStatusEnum.PUBLISHED
        });
        listingIds.push(listingId);
        // The publication fixture does not wire purchaseAddon; seed only the catalog and acquired instance.
        const { instanceId } = await seedPurgePreviewAddon({
            ownerId: owner.id,
            targetId: listingId,
            scopeType: 'LISTING',
            vertical: VerticalEnum.ACCOMMODATION,
            chargeKind: 'PERIODICO',
            name: 'Destaque Alfa'
        });
        instanceIds.push(instanceId);
        const [instance] = await getDb()
            .select({ addonVersionId: addonInstances.addonVersionId })
            .from(addonInstances)
            .where(eq(addonInstances.id, instanceId));
        if (!instance) throw new Error('Seeded add-on instance missing');
        coverageByOwner.set(owner.id, {
            covered: true,
            sources: [
                {
                    type: 'ADDON',
                    reference: { kind: 'ADDON_VERSION', addonVersionId: instance.addonVersionId },
                    scope: 'LISTING',
                    target: listingId,
                    since: new Date('2026-10-01T00:00:00.000Z'),
                    until: 'NO_KNOWN_DATE',
                    charged: null,
                    floor: null
                }
            ]
        });
        failRead.value = failingRead;
        const response = await readResponse(
            await app.request(`/api/v1/admin/accommodations/${listingId}/moderate`, {
                method: 'POST',
                headers: actorHeaders({
                    id: admin.id,
                    role: RoleEnum.ADMIN,
                    permissions: [
                        PermissionEnum.ACCESS_PANEL_ADMIN,
                        PermissionEnum.ACCESS_API_ADMIN,
                        PermissionEnum.LISTING_MODERATE
                    ]
                }),
                body: JSON.stringify({ action: 'TAKE_DOWN', reason: 'Fotos incorrectas' })
            })
        );
        const notices = await getDb()
            .select({ template: emailOutbox.template, payload: emailOutbox.payload })
            .from(emailOutbox)
            .where(eq(emailOutbox.recipientUserId, owner.id));
        return { response, notices, ownerId: owner.id, listingId };
    }

    it('queues the owner notice with the recurring feature name', async () => {
        const { response, notices, ownerId, listingId } = await moderateWithCoverage(false);
        expect(response.status).toBe(200);
        expect(notices).toEqual([
            {
                template: 'verticals.listing-moderated',
                payload: {
                    vertical: VerticalEnum.ACCOMMODATION,
                    listingId,
                    reason: 'Fotos incorrectas',
                    fixRequestOpen: false,
                    recurringListingAddons: [{ name: 'Destaque Alfa' }]
                }
            }
        ]);
        expect(coverageCalls).toHaveBeenCalledWith({
            userId: ownerId,
            vertical: VerticalEnum.ACCOMMODATION
        });
    });

    it('still moderates and queues the legacy notice when the names read fails', async () => {
        const { response, notices } = await moderateWithCoverage(true);
        expect(response.status).toBe(200);
        expect(notices).toHaveLength(1);
        expect(notices[0]?.template).toBe('verticals.listing-moderated');
        expect(notices[0]?.payload).toEqual({
            vertical: VerticalEnum.ACCOMMODATION,
            listingId: listingIds[0],
            reason: 'Fotos incorrectas',
            fixRequestOpen: false
        });
    });
});
