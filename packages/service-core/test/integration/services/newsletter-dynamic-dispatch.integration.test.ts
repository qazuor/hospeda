import { randomUUID } from 'node:crypto';
import {
    eq,
    newsletterCampaignDeliveries,
    newsletterCampaigns,
    newsletterSubscribers,
    users
} from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { persistCampaignDispatch } from '../../../src/services/newsletter/dynamic/persist-campaign-dispatch.js';
import { NewsletterCampaignService } from '../../../src/services/newsletter/newsletter-campaign.service.js';
import {
    dynamicDocument,
    dynamicPort,
    frozenContent
} from '../../services/newsletter/dynamic/content.fixtures.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';

const creatorId = randomUUID();
const subscriberId = randomUUID();

async function createCampaign() {
    const [row] = await getServiceTestDb()
        .insert(newsletterCampaigns)
        .values({
            title: 'Dynamic dispatch test',
            subject: 'Frozen content',
            bodyJson: dynamicDocument(),
            createdBy: creatorId
        })
        .returning();
    if (!row) throw new Error('Campaign fixture was not inserted');
    return row;
}

describe('dynamic campaign dispatch transaction (real PostgreSQL)', () => {
    beforeAll(async () => {
        const db = getServiceTestDb();
        await db.insert(users).values({
            id: creatorId,
            email: `${creatorId}@dispatch.test`,
            displayName: 'Dispatch fixture',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        } as typeof users.$inferInsert);
        await db.insert(newsletterSubscribers).values({
            id: subscriberId,
            email: `${subscriberId}@dispatch.test`,
            status: 'active',
            channel: 'email',
            locale: 'es'
        });
    });
    afterAll(async () => {
        const db = getServiceTestDb();
        await db.delete(newsletterCampaigns).where(eq(newsletterCampaigns.createdBy, creatorId));
        await db.delete(newsletterSubscribers).where(eq(newsletterSubscribers.id, subscriberId));
        await db.delete(users).where(eq(users.id, creatorId));
        await closeServiceTestPool();
    });

    it('commits the JSONB snapshot and pending deliveries together', async () => {
        const campaign = await createCampaign();
        const resolvedAt = new Date('2026-11-26T12:00:00Z');
        const ids = await persistCampaignDispatch({
            campaignId: campaign.id,
            eligibleIds: [subscriberId],
            softCappedCount: 0,
            attributionSlug: 'dispatch-test',
            resolvedBodyJson: frozenContent(),
            resolvedAt
        });
        const [saved] = await getServiceTestDb()
            .select()
            .from(newsletterCampaigns)
            .where(eq(newsletterCampaigns.id, campaign.id));
        expect(saved?.resolvedBodyJson).toEqual(frozenContent());
        expect(saved?.resolvedAt).toEqual(resolvedAt);
        expect(saved?.status).toBe('sending');
        const deliveries = await getServiceTestDb()
            .select({
                id: newsletterCampaignDeliveries.id,
                subscriberId: newsletterCampaignDeliveries.subscriberId,
                status: newsletterCampaignDeliveries.status
            })
            .from(newsletterCampaignDeliveries)
            .where(eq(newsletterCampaignDeliveries.campaignId, campaign.id));
        expect(deliveries).toEqual([{ id: ids[0], subscriberId, status: 'pending' }]);
    });

    it('rolls back the delivery INSERT when the campaign UPDATE fails', async () => {
        const campaign = await createCampaign();
        await expect(
            persistCampaignDispatch({
                campaignId: campaign.id,
                eligibleIds: [subscriberId],
                softCappedCount: 0,
                // Fail after INSERT through the real varchar(64) constraint.
                attributionSlug: 'x'.repeat(65),
                resolvedBodyJson: frozenContent(),
                resolvedAt: new Date()
            })
        ).rejects.toThrow();
        const [saved] = await getServiceTestDb()
            .select()
            .from(newsletterCampaigns)
            .where(eq(newsletterCampaigns.id, campaign.id));
        expect(saved).toEqual(campaign);
        expect(
            await getServiceTestDb()
                .select()
                .from(newsletterCampaignDeliveries)
                .where(eq(newsletterCampaignDeliveries.campaignId, campaign.id))
        ).toEqual([]);
    });

    it('AC-F1-13 leaves the entire stored campaign row unchanged after testSend', async () => {
        const campaign = await createCampaign();
        const sendTestEmailFromContent = vi.fn(async () => ({
            data: { sentTo: 'preview@dispatch.test' }
        }));
        const svc = new NewsletterCampaignService(
            {},
            {
                dynamicSourcePort: dynamicPort(),
                deliveryService: {
                    sendTestEmailFromContent,
                    sendTestEmail: vi.fn(),
                    enqueueBatches: vi.fn(),
                    bulkSkipPending: vi.fn()
                }
            }
        );
        const result = await svc.testSend(
            {
                id: creatorId,
                roles: [RoleEnum.ADMIN],
                permissions: [PermissionEnum.NEWSLETTER_CAMPAIGN_SEND]
            },
            { id: campaign.id, toEmail: 'preview@dispatch.test' }
        );
        expect(result).toEqual({ data: { sentTo: 'preview@dispatch.test' } });
        expect(sendTestEmailFromContent.mock.calls).toEqual([
            [
                {
                    campaign,
                    resolvedBodyJson: frozenContent(),
                    toEmail: 'preview@dispatch.test',
                    locale: 'es'
                }
            ]
        ]);
        const [saved] = await getServiceTestDb()
            .select()
            .from(newsletterCampaigns)
            .where(eq(newsletterCampaigns.id, campaign.id));
        expect(saved).toEqual(campaign);
        expect(
            await getServiceTestDb()
                .select()
                .from(newsletterCampaignDeliveries)
                .where(eq(newsletterCampaignDeliveries.campaignId, campaign.id))
        ).toEqual([]);
    });
});
