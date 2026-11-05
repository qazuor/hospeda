import { eq, getDb, partners, sql, subscriptions } from '@repo/db';
import { PartnerStatsSchema, RoleEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { actorHeaders, createOwner } from '../listing-publication/publication-routes.helpers';
import {
    createdPartnerIds,
    createdUserIds,
    seedPartner,
    seedPlan
} from './partner-presence.helpers';

const app = initApp();
const db = getDb;

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});
afterEach(async () => {
    for (const id of createdPartnerIds.splice(0))
        await db().delete(partners).where(eq(partners.id, id));
    for (const userId of createdUserIds.splice(0)) {
        await db().execute(
            sql`DELETE FROM payment WHERE subscription_id IN (SELECT id FROM subscription WHERE user_id = ${userId}::uuid)`
        );
        await db().delete(subscriptions).where(eq(subscriptions.userId, userId));
        await db().execute(sql`DELETE FROM users WHERE id = ${userId}::uuid`);
    }
});
afterAll(async () => testDb.teardown());

async function readStats(ownerId: string) {
    const response = await app.request('/api/v1/protected/partners/mine/stats', {
        headers: actorHeaders({ id: ownerId, role: RoleEnum.USER })
    });
    expect(response.status).toBe(200);
    return PartnerStatsSchema.parse((await response.json()).data);
}

describe('AC:V7:16 — owner stats read public-page presence', () => {
    it('reports Gold, Silver, moderated, and no-partner states', async () => {
        const gold = await seedPlan('GOLD');
        const silver = await seedPlan('SILVER');
        const goldPartner = await seedPartner({ gold, silver });
        const silverPartner = await seedPartner({ gold, silver, tier: 'SILVER' });
        const moderatedPartner = await seedPartner({ gold, silver, moderated: true });

        expect(await readStats(goldPartner.owner!.id)).toEqual({
            available: true,
            partner: {
                id: goldPartner.partner.id,
                name: goldPartner.partner.name,
                slug: goldPartner.partner.slug,
                websiteUrl: undefined,
                hasPublicPage: true
            },
            windowDays: 30,
            views: { unique: 0, total: 0 },
            clicks: { unique: 0, total: 0 }
        });
        expect(await readStats(silverPartner.owner!.id)).toEqual({
            available: true,
            partner: {
                id: silverPartner.partner.id,
                name: silverPartner.partner.name,
                slug: silverPartner.partner.slug,
                websiteUrl: undefined,
                hasPublicPage: false
            },
            windowDays: 30,
            views: { unique: 0, total: 0 },
            clicks: { unique: 0, total: 0 }
        });
        expect(await readStats(moderatedPartner.owner!.id)).toEqual({
            available: true,
            partner: {
                id: moderatedPartner.partner.id,
                name: moderatedPartner.partner.name,
                slug: moderatedPartner.partner.slug,
                websiteUrl: undefined,
                hasPublicPage: false
            },
            windowDays: 30,
            views: { unique: 0, total: 0 },
            clicks: { unique: 0, total: 0 }
        });
        const noPartnerOwner = await createOwner();
        createdUserIds.push(noPartnerOwner.id);
        expect(await readStats(noPartnerOwner.id)).toEqual({ available: false });
    });
});
