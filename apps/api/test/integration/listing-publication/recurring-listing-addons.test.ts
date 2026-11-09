import type { CoverageResponse } from '@repo/billing-verticals-contract';
import { accommodations, addonInstances, eq, getDb } from '@repo/db';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { listListingNotices } from '../../../src/services/listing-notices/listing-notices.service';
import { ListingModerationService } from '../../../src/services/listing-publication/listing-moderation.service';
import { testDb } from '../../e2e/setup/test-database';
import {
    createListing,
    createOwner,
    createVerticalDestination
} from './publication-routes.helpers';
import { deletePurgePreviewInstances, seedPurgePreviewAddon } from './purge-preview-fixtures';

const { coverageByOwner, coverageCalls } = vi.hoisted(() => ({
    coverageByOwner: new Map<string, CoverageResponse>(),
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
                        return coverageByOwner.get(args.userId) ?? { covered: false, sources: [] };
                    }
                }
            };
        }
    };
});

const listingIds: string[] = [];
const instanceIds: string[] = [];
initApp();
const moderator = new ListingModerationService();

async function listing(ownerId: string): Promise<string> {
    const destinationId = await createVerticalDestination();
    const id = await createListing({
        ownerId,
        destinationId,
        status: PublicationStatusEnum.PUBLISHED
    });
    listingIds.push(id);
    return id;
}

async function seededSource(args: {
    ownerId: string;
    targetId: string | null;
    scopeType: 'LISTING' | 'GLOBAL' | 'USER';
    name: string;
    until: Date | 'NO_KNOWN_DATE';
}) {
    // The purchase service is not wired into this publication fixture; the acquired instance and catalog are seeded.
    const { instanceId } = await seedPurgePreviewAddon({
        ownerId: args.ownerId,
        targetId: args.targetId,
        scopeType: args.scopeType,
        vertical: VerticalEnum.ACCOMMODATION,
        chargeKind: args.until === 'NO_KNOWN_DATE' ? 'PERIODICO' : 'UNA_VEZ',
        endsAt: args.until instanceof Date ? args.until : null,
        name: args.name
    });
    instanceIds.push(instanceId);
    const [instance] = await getDb()
        .select({ addonVersionId: addonInstances.addonVersionId })
        .from(addonInstances)
        .where(eq(addonInstances.id, instanceId));
    if (!instance) throw new Error('Seeded add-on instance missing');
    return {
        type: 'ADDON' as const,
        reference: { kind: 'ADDON_VERSION' as const, addonVersionId: instance.addonVersionId },
        scope: args.scopeType,
        target: args.targetId,
        since: new Date('2026-10-01T00:00:00.000Z'),
        until: args.until,
        charged: null,
        floor: null
    };
}

beforeAll(async () => {
    await testDb.setup();
});
afterEach(async () => {
    coverageByOwner.clear();
    coverageCalls.mockClear();
    await deletePurgePreviewInstances({ instanceIds: instanceIds.splice(0) });
    for (const id of listingIds.splice(0))
        await getDb().delete(accommodations).where(eq(accommodations.id, id));
});
afterAll(async () => testDb.teardown());

describe('TEST:B13b:1 TEST:B13b:2 AC:B13b:1 AC:B13b:2 the recurring features on a listing are read from fuentes', () => {
    it('names only live recurring LISTING sources aimed at A in notices and admin moderation state', async () => {
        const owner = await createOwner();
        const a = await listing(owner.id);
        const b = await listing(owner.id);
        const aSource = await seededSource({
            ownerId: owner.id,
            targetId: a,
            scopeType: 'LISTING',
            name: 'Alfa',
            until: 'NO_KNOWN_DATE'
        });
        const bSource = await seededSource({
            ownerId: owner.id,
            targetId: b,
            scopeType: 'LISTING',
            name: 'Beta',
            until: 'NO_KNOWN_DATE'
        });
        const once = await seededSource({
            ownerId: owner.id,
            targetId: a,
            scopeType: 'LISTING',
            name: 'Una vez',
            until: new Date('2026-12-01T00:00:00.000Z')
        });
        const global = await seededSource({
            ownerId: owner.id,
            targetId: null,
            scopeType: 'GLOBAL',
            name: 'Global',
            until: 'NO_KNOWN_DATE'
        });
        const user = await seededSource({
            ownerId: owner.id,
            targetId: null,
            scopeType: 'USER',
            name: 'Usuario',
            until: 'NO_KNOWN_DATE'
        });
        coverageByOwner.set(owner.id, {
            covered: true,
            sources: [bSource, once, global, aSource, user]
        });
        const notices = await listListingNotices({
            userId: owner.id,
            vertical: VerticalEnum.ACCOMMODATION
        });
        const state = await moderator.readState({ vertical: VerticalEnum.ACCOMMODATION, id: a });
        const aItem = notices.items.find((item) => item.listingId === a);
        expect(aItem?.recurringListingAddonItems).toEqual([
            { addonVersionId: aSource.reference.addonVersionId, name: 'Alfa' }
        ]);
        expect(aItem?.recurringListingAddons).toBe(1);
        expect(state.recurringListingAddons).toEqual([
            { addonVersionId: aSource.reference.addonVersionId, name: 'Alfa' }
        ]);
        expect(coverageCalls).toHaveBeenCalledWith({
            userId: owner.id,
            vertical: VerticalEnum.ACCOMMODATION
        });
    });

    it('returns an exact empty list and zero count without recurring features', async () => {
        const owner = await createOwner();
        const a = await listing(owner.id);
        coverageByOwner.set(owner.id, { covered: false, sources: [] });
        const notices = await listListingNotices({
            userId: owner.id,
            vertical: VerticalEnum.ACCOMMODATION
        });
        const state = await moderator.readState({ vertical: VerticalEnum.ACCOMMODATION, id: a });
        expect(
            notices.items.find((item) => item.listingId === a)?.recurringListingAddonItems
        ).toEqual([]);
        expect(notices.items.find((item) => item.listingId === a)?.recurringListingAddons).toBe(0);
        expect(state.recurringListingAddons).toEqual([]);
    });
});
