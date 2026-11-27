import { randomUUID } from 'node:crypto';
import {
    eq,
    newsletterCampaignDeliveries,
    newsletterCampaigns,
    newsletterSubscribers,
    users
} from '@repo/db';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { DynamicSourcePort } from '../../../src/services/newsletter/dynamic/dynamic-source.port.js';
import { persistCampaignDispatch } from '../../../src/services/newsletter/dynamic/persist-campaign-dispatch.js';
import { resolveCampaignPreview } from '../../../src/services/newsletter/dynamic/resolve-campaign-preview.js';
import { NewsletterCampaignService } from '../../../src/services/newsletter/newsletter-campaign.service.js';
import {
    dynamicDocument,
    dynamicPort,
    frozenCards,
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
    it('allows exactly one concurrent send and preserves the winning snapshot and counters', async () => {
        const campaign = await createCampaign();
        let arrivals = 0;
        let release: () => void = () => undefined;
        const bothResolving = new Promise<void>((resolve) => {
            release = resolve;
        });
        const enqueueBatches = vi.fn(async () => ({ data: { jobsEnqueued: 1 } }));
        const makeService = ({ name }: { name: string }) => {
            const port = dynamicPort();
            return new NewsletterCampaignService(
                {},
                {
                    dynamicSourcePort: {
                        ...port,
                        loadCards: async (input) => {
                            arrivals += 1;
                            if (arrivals === 2) release();
                            await bothResolving;
                            const cards = await port.loadCards(input);
                            return new Map(
                                [...cards].map(([id, localized]) => [
                                    id,
                                    {
                                        ...localized,
                                        es: { ...frozenCards.es, name }
                                    }
                                ])
                            );
                        }
                    },
                    deliveryService: {
                        enqueueBatches,
                        sendTestEmail: vi.fn(),
                        sendTestEmailFromContent: vi.fn(),
                        bulkSkipPending: vi.fn()
                    }
                }
            );
        };
        const actor = {
            id: creatorId,
            roles: [RoleEnum.ADMIN],
            permissions: [PermissionEnum.NEWSLETTER_CAMPAIGN_SEND]
        };
        const results = await Promise.all([
            makeService({ name: 'First snapshot' }).send(actor, {
                id: campaign.id,
                ignoreSoftCap: true
            }),
            makeService({ name: 'Second snapshot' }).send(actor, {
                id: campaign.id,
                ignoreSoftCap: true
            })
        ]);
        expect(results.filter((result) => result.data)).toHaveLength(1);
        expect(results.filter((result) => result.error)).toHaveLength(1);
        const loser = results.find((result) => result.error);
        expect(loser?.error?.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
        expect(loser?.error?.reason).toBe('CAMPAIGN_NOT_SENDABLE');
        expect(enqueueBatches).toHaveBeenCalledOnce();
        const winnerName = results[0]?.data ? 'First snapshot' : 'Second snapshot';
        const expected = structuredClone(frozenContent());
        for (const block of expected.blocks) {
            block.cards['item-a'].es.name = winnerName;
            block.cards['item-b'].es.name = winnerName;
        }
        const [saved] = await getServiceTestDb()
            .select()
            .from(newsletterCampaigns)
            .where(eq(newsletterCampaigns.id, campaign.id));
        expect(saved?.resolvedBodyJson).toEqual(expected);
        expect(saved?.totalRecipients).toBe(1);
        expect(saved?.totalSoftcapped).toBe(0);
        expect(saved?.status).toBe('sending');
        const deliveries = await getServiceTestDb()
            .select({
                subscriberId: newsletterCampaignDeliveries.subscriberId,
                status: newsletterCampaignDeliveries.status
            })
            .from(newsletterCampaignDeliveries)
            .where(eq(newsletterCampaignDeliveries.campaignId, campaign.id));
        expect(deliveries).toEqual([{ subscriberId, status: 'pending' }]);
    });
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

    describe('AC-F1-7 previewSelection (preview -> unpublish -> send)', () => {
        const [A, B, C, D, E] = [
            randomUUID(),
            randomUUID(),
            randomUUID(),
            randomUUID(),
            randomUUID()
        ];
        const actor = {
            id: creatorId,
            roles: [RoleEnum.ADMIN],
            permissions: [PermissionEnum.NEWSLETTER_CAMPAIGN_SEND]
        };

        /** Ranked [A..E]; whatever is in `unpublished` fails the shared revalidation predicate. */
        function selectionPort({ unpublished }: { unpublished: Set<string> }): DynamicSourcePort {
            const ranked: string[] = [A, B, C, D, E];
            return {
                fetchCandidates: async ({ excludeIds, limit }) =>
                    ranked
                        .filter((id) => !unpublished.has(id) && !excludeIds.includes(id))
                        .slice(0, limit),
                revalidate: async ({ ids }) => ({
                    validIds: ids.filter((id) => ranked.includes(id) && !unpublished.has(id)),
                    dropped: ids
                        .filter((id) => !ranked.includes(id) || unpublished.has(id))
                        .map((id) => ({ id, reason: 'not_published' as const }))
                }),
                loadCards: async ({ ids }) => new Map(ids.map((id) => [id, frozenCards]))
            };
        }

        function service({ port }: { port: DynamicSourcePort }) {
            return new NewsletterCampaignService(
                {},
                {
                    dynamicSourcePort: port,
                    deliveryService: {
                        enqueueBatches: vi.fn(async () => ({ data: { jobsEnqueued: 1 } })),
                        sendTestEmail: vi.fn(),
                        sendTestEmailFromContent: vi.fn(),
                        bulkSkipPending: vi.fn()
                    }
                }
            );
        }

        async function savedItemIds({ id }: { id: string }) {
            const [saved] = await getServiceTestDb()
                .select()
                .from(newsletterCampaigns)
                .where(eq(newsletterCampaigns.id, id));
            const content = saved?.resolvedBodyJson as { blocks: { itemIds: string[] }[] } | null;
            return content?.blocks.map((block) => block.itemIds);
        }

        it('sends [B, C, D] and reports A as not_published after A was unpublished post-preview', async () => {
            const campaign = await createCampaign();
            const unpublished = new Set<string>();
            const port = selectionPort({ unpublished });
            const preview = await resolveCampaignPreview({
                actor,
                id: campaign.id,
                port,
                renderNewsletterEmailFn: async () => ({
                    bodyHtml: '<p>x</p>',
                    segments: ['<p>x</p>'],
                    unresolvedBlockKeys: []
                }),
                renderTiptapEmailFn: () => '<p>x</p>'
            });
            expect(preview.blocks).toEqual([{ blockKey: 'newest-block', itemIds: [A, B, C] }]);
            // Preview stays write-free: nothing was persisted.
            expect(await savedItemIds({ id: campaign.id })).toBeUndefined();

            unpublished.add(A);
            const result = await service({ port }).send(actor, {
                id: campaign.id,
                ignoreSoftCap: true,
                previewSelection: [...preview.blocks].map(({ blockKey, itemIds }) => ({
                    blockKey,
                    itemIds: [...itemIds]
                }))
            });

            expect(result.error).toBeUndefined();
            expect(await savedItemIds({ id: campaign.id })).toEqual([[B, C, D]]);
            expect(result.data?.resolutionReport?.blocks[0]?.dropped).toEqual([
                { id: A, reason: 'not_published' }
            ]);
        });

        it('drops a forged id that is not eligible and never sends it', async () => {
            const campaign = await createCampaign();
            const forged = randomUUID();
            const result = await service({ port: selectionPort({ unpublished: new Set() }) }).send(
                actor,
                {
                    id: campaign.id,
                    ignoreSoftCap: true,
                    previewSelection: [{ blockKey: 'newest-block', itemIds: [forged, B] }]
                }
            );
            expect(result.error).toBeUndefined();
            expect(await savedItemIds({ id: campaign.id })).toEqual([[B, A, C]]);
            expect(result.data?.resolutionReport?.blocks[0]?.dropped).toEqual([
                { id: forged, reason: 'not_published' }
            ]);
        });
    });
});
