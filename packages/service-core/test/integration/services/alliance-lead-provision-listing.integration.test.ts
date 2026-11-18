/**
 * HOS-2339 AC-4.4: two concurrent `provisionListing` retries create exactly one
 * `host_trades` row. The lead is locked `FOR UPDATE` inside the transaction and
 * `provisionedHostTradeId` is read after the lock, so the second caller sees the
 * first one's commit and answers `already-provisioned`.
 *
 * Needs real commits (the lock only means something across two connections), so
 * every row carries a unique run tag and is deleted afterwards.
 */
import {
    allianceLeads,
    destinations,
    eq,
    hostTradeCategories,
    hostTradeCategoryGroups,
    hostTrades,
    inArray,
    rHostTradeCategory,
    users
} from '@repo/db';
import { LifecycleStatusEnum, PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AllianceLeadService } from '../../../src/services/alliance-lead/alliance-lead.service';
import type { Actor } from '../../../src/types';
import { createLoggerMock } from '../../utils/modelMockFactory';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';

const dbAvailable = isServiceTestDbAvailable();
const RUN = crypto.randomUUID().slice(0, 8);

const admin: Actor = {
    id: '00000000-0000-4000-a000-000000002339',
    roles: [RoleEnum.SUPER_ADMIN],
    permissions: [PermissionEnum.ALLIANCE_LEAD_MANAGE]
};

describe.skipIf(!dbAvailable)('AllianceLeadService.provisionListing: real DB (HOS-2339)', () => {
    const ids = {
        group: crypto.randomUUID(),
        category: crypto.randomUUID(),
        destination: crypto.randomUUID(),
        lead: crypto.randomUUID(),
        raceLead: crypto.randomUUID()
    };
    const raceName = `Race Biz ${RUN}`;
    const slug = `c-${RUN}-conc`;

    beforeAll(async () => {
        const db = getServiceTestDb();
        await db.insert(users).values({
            id: admin.id,
            email: `lead-prov-admin-${RUN}@example.com`,
            displayName: 'Lead Provision Admin',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        } as typeof users.$inferInsert);
        await db.insert(hostTradeCategoryGroups).values({
            id: ids.group,
            slug: `g-${RUN}-conc`,
            nameI18n: { es: 'g', en: 'g', pt: 'g' },
            displayWeight: 10
        });
        await db.insert(hostTradeCategories).values({
            id: ids.category,
            slug,
            groupId: ids.group,
            nameI18n: { es: 'c', en: 'c', pt: 'c' },
            displayWeight: 50,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });
        await db.insert(destinations).values({
            id: ids.destination,
            slug: `lead-prov-dest-${RUN}`,
            name: 'Lead Provision Destination',
            destinationType: 'CITY',
            level: 4,
            path: `/lead-prov/${ids.destination}`,
            summary: 'Lead provision destination summary',
            description: 'Lead provision destination description',
            location: {
                state: 'Entre Rios',
                country: 'Argentina',
                coordinates: { lat: '-32.48', long: '-58.23' }
            },
            media: {
                featuredImage: {
                    moderationState: 'APPROVED',
                    url: 'https://example.com/lead-prov.jpg'
                }
            },
            lifecycleState: 'ACTIVE'
        } as typeof destinations.$inferInsert);
        await db.insert(allianceLeads).values({
            id: ids.lead,
            kind: 'service_provider',
            contactName: 'Lead Contact',
            email: `lead-prov-${RUN}@example.com`,
            message: 'Quiero sumarme',
            status: 'approved',
            businessName: `Lead Prov Biz ${RUN}`,
            destinationId: ids.destination,
            categorySlugs: [slug]
        } as typeof allianceLeads.$inferInsert);
    });

    afterAll(async () => {
        const db = getServiceTestDb();
        const raceTrades = await db.select().from(hostTrades).where(eq(hostTrades.name, raceName));
        const raceIds = raceTrades.map((t) => t.id);
        await db.delete(allianceLeads).where(eq(allianceLeads.id, ids.raceLead));
        if (raceIds.length > 0) {
            await db
                .delete(rHostTradeCategory)
                .where(inArray(rHostTradeCategory.hostTradeId, raceIds));
            await db.delete(hostTrades).where(inArray(hostTrades.id, raceIds));
        }
        const [lead] = await db.select().from(allianceLeads).where(eq(allianceLeads.id, ids.lead));
        const providerIds = lead?.provisionedHostTradeId ? [lead.provisionedHostTradeId] : [];
        await db.delete(allianceLeads).where(eq(allianceLeads.id, ids.lead));
        if (providerIds.length > 0) {
            await db
                .delete(rHostTradeCategory)
                .where(inArray(rHostTradeCategory.hostTradeId, providerIds));
            await db.delete(hostTrades).where(inArray(hostTrades.id, providerIds));
        }
        await db.delete(hostTradeCategories).where(eq(hostTradeCategories.id, ids.category));
        await db.delete(hostTradeCategoryGroups).where(eq(hostTradeCategoryGroups.id, ids.group));
        await db.delete(destinations).where(eq(destinations.id, ids.destination));
        await db.delete(users).where(eq(users.id, admin.id));
        await closeServiceTestPool();
    });

    it('creates exactly one listing for two concurrent retries (AC-4.4)', async () => {
        const service = new AllianceLeadService({ logger: createLoggerMock() });

        const [a, b] = await Promise.all([
            service.provisionListing({ actor: admin, id: ids.lead }),
            service.provisionListing({ actor: admin, id: ids.lead })
        ]);

        expect(a.error).toBeUndefined();
        expect(b.error).toBeUndefined();
        const outcomes = [a.data?.provisioning, b.data?.provisioning];
        expect(outcomes.filter((o) => o?.provisioned === true)).toHaveLength(1);
        expect(
            outcomes.filter((o) => o?.provisioned === false && o.reason === 'already-provisioned')
        ).toHaveLength(1);

        const db = getServiceTestDb();
        const rows = await db
            .select()
            .from(hostTrades)
            .where(eq(hostTrades.destinationId, ids.destination));
        expect(rows).toHaveLength(1);
        const [lead] = await db.select().from(allianceLeads).where(eq(allianceLeads.id, ids.lead));
        expect(lead?.provisionedHostTradeId).toBe(rows[0]?.id);
    });

    it('creates exactly one listing when a re-approval races a retry', async () => {
        const db = getServiceTestDb();
        await db.insert(allianceLeads).values({
            id: ids.raceLead,
            kind: 'service_provider',
            contactName: 'Race Contact',
            email: `lead-race-${RUN}@example.com`,
            message: 'Quiero sumarme',
            status: 'approved',
            businessName: raceName,
            destinationId: ids.destination,
            categorySlugs: [slug]
        } as typeof allianceLeads.$inferInsert);
        const service = new AllianceLeadService({ logger: createLoggerMock() });

        const [a, b] = await Promise.all([
            service.markHandled({
                actor: admin,
                id: ids.raceLead,
                input: { status: 'approved' }
            }),
            service.provisionListing({ actor: admin, id: ids.raceLead })
        ]);

        expect(a.error).toBeUndefined();
        expect(b.error).toBeUndefined();
        const rows = await db.select().from(hostTrades).where(eq(hostTrades.name, raceName));
        expect(rows).toHaveLength(1);
        const [lead] = await db
            .select()
            .from(allianceLeads)
            .where(eq(allianceLeads.id, ids.raceLead));
        expect(lead?.provisionedHostTradeId).toBe(rows[0]?.id);
    });
});
