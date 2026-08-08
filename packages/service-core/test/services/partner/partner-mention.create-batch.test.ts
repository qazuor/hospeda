/**
 * @fileoverview
 * Unit tests for `PartnerMentionService.createBatch` (HOS-377 T-009).
 *
 * The properties under test are the ones that make a multi-network submission
 * safe rather than merely convenient:
 * - one submission writes N rows sharing ONE server-generated batchId;
 * - a client-supplied batchId can never reach the insert (R-5);
 * - the notification fires exactly ONCE per batch, never once per row (AC-9);
 * - a failing or absent notifier never fails a mention that really happened;
 * - the generic single-row create and the unscoped search are sealed shut.
 */

import type { PartnerMentionModel } from '@repo/db';
import { PartnerMentionChannelEnum, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import type { PartnerMentionNotifyPort } from '../../../src/services/partner/partner-mention.service';
import { PartnerMentionService } from '../../../src/services/partner/partner-mention.service';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();
const PARTNER_ID = getMockId('attraction', 'pm-partner-1');
const MENTIONED_AT = new Date('2026-08-01T12:00:00.000Z');

const adminActor = createActor({ permissions: [PermissionEnum.PARTNER_MANAGE] });
const outsiderActor = createActor({ permissions: [] });

/**
 * Model stub that echoes back what it was asked to insert, stamping an id.
 * Deliberately faithful: it returns the ROWS THE SERVICE BUILT, which is what
 * makes the batchId assertions meaningful.
 */
function makeModel() {
    const createMany = vi.fn(async ({ rows }: { rows: readonly Record<string, unknown>[] }) =>
        rows.map((r, i) => ({ ...r, id: `mention-${i}` }))
    );
    return { createMany } as unknown as PartnerMentionModel & {
        createMany: ReturnType<typeof vi.fn>;
    };
}

function makeService(overrides: { notifier?: PartnerMentionNotifyPort } = {}) {
    const model = makeModel();
    const service = new PartnerMentionService({
        logger: mockLogger,
        model,
        ...overrides
    });
    return { service, model };
}

const entry = (channel: PartnerMentionChannelEnum, url: string | null) => ({ channel, url });

describe('PartnerMentionService.createBatch — batch identity', () => {
    it('writes one row per entry, all sharing a single batchId', async () => {
        const { service, model } = makeService();

        const result = await service.createBatch(adminActor, {
            partnerId: PARTNER_ID,
            mentionedAt: MENTIONED_AT,
            entries: [
                entry(PartnerMentionChannelEnum.INSTAGRAM, 'https://ig.test/1'),
                entry(PartnerMentionChannelEnum.FACEBOOK, 'https://fb.test/2'),
                entry(PartnerMentionChannelEnum.TIKTOK, 'https://tt.test/3')
            ]
        });

        expect(result.data?.mentions).toHaveLength(3);
        const rows = model.createMany.mock.calls[0]?.[0].rows as Record<string, unknown>[];
        const batchIds = new Set(rows.map((r) => r.batchId));
        expect(batchIds.size).toBe(1);
        expect([...batchIds][0]).toEqual(expect.any(String));
    });

    it('leaves batchId null for a single-entry submission', async () => {
        // There is nothing to group a lone mention with, and a batch of one would
        // make the partner-facing view render a "campaign" with one link in it.
        const { service, model } = makeService();

        await service.createBatch(adminActor, {
            partnerId: PARTNER_ID,
            mentionedAt: MENTIONED_AT,
            entries: [entry(PartnerMentionChannelEnum.WHATSAPP, null)]
        });

        const rows = model.createMany.mock.calls[0]?.[0].rows as Record<string, unknown>[];
        expect(rows[0]?.batchId).toBeNull();
    });

    it('mints a DIFFERENT batchId for each submission', async () => {
        const { service, model } = makeService();
        const body = {
            partnerId: PARTNER_ID,
            mentionedAt: MENTIONED_AT,
            entries: [
                entry(PartnerMentionChannelEnum.INSTAGRAM, 'https://ig.test/1'),
                entry(PartnerMentionChannelEnum.FACEBOOK, 'https://fb.test/2')
            ]
        };

        await service.createBatch(adminActor, body);
        await service.createBatch(adminActor, body);

        const first = (model.createMany.mock.calls[0]?.[0].rows as Record<string, unknown>[])[0]
            ?.batchId;
        const second = (model.createMany.mock.calls[1]?.[0].rows as Record<string, unknown>[])[0]
            ?.batchId;
        expect(first).not.toBe(second);
    });
});

describe('PartnerMentionService.createBatch — R-5, server-owned batchId', () => {
    it('ignores a client-supplied batchId instead of trusting it', async () => {
        // Asserting "a batchId exists" would pass even if the caller's value were
        // used. The stored value must DIFFER from the one that was sent.
        const smuggled = '11111111-1111-4111-8111-111111111111';
        const { service, model } = makeService();

        await service.createBatch(adminActor, {
            partnerId: PARTNER_ID,
            mentionedAt: MENTIONED_AT,
            batchId: smuggled,
            entries: [
                entry(PartnerMentionChannelEnum.INSTAGRAM, 'https://ig.test/1'),
                entry(PartnerMentionChannelEnum.FACEBOOK, 'https://fb.test/2')
            ]
        } as never);

        const rows = model.createMany.mock.calls[0]?.[0].rows as Record<string, unknown>[];
        expect(rows[0]?.batchId).not.toBe(smuggled);
        expect(JSON.stringify(rows)).not.toContain(smuggled);
    });

    it('takes partnerId from the argument, not from a body copy', async () => {
        const smuggled = '22222222-2222-4222-8222-222222222222';
        const { service, model } = makeService();

        await service.createBatch(adminActor, {
            partnerId: PARTNER_ID,
            mentionedAt: MENTIONED_AT,
            entries: [entry(PartnerMentionChannelEnum.WHATSAPP, null)],
            // A second, disagreeing source for who this belongs to.
            partner_id: smuggled
        } as never);

        const rows = model.createMany.mock.calls[0]?.[0].rows as Record<string, unknown>[];
        expect(rows[0]?.partnerId).toBe(PARTNER_ID);
    });

    it('stamps the acting admin as author on every row', async () => {
        const { service, model } = makeService();

        await service.createBatch(adminActor, {
            partnerId: PARTNER_ID,
            mentionedAt: MENTIONED_AT,
            entries: [
                entry(PartnerMentionChannelEnum.INSTAGRAM, 'https://ig.test/1'),
                entry(PartnerMentionChannelEnum.FACEBOOK, 'https://fb.test/2')
            ]
        });

        const rows = model.createMany.mock.calls[0]?.[0].rows as Record<string, unknown>[];
        for (const row of rows) {
            expect(row.createdById).toBe(adminActor.id);
        }
    });
});

describe('PartnerMentionService.createBatch — notification (AC-9)', () => {
    it('notifies ONCE for a four-network campaign, not four times', async () => {
        const notifier = vi.fn<PartnerMentionNotifyPort>(async () => undefined);
        const { service } = makeService({ notifier });

        await service.createBatch(adminActor, {
            partnerId: PARTNER_ID,
            mentionedAt: MENTIONED_AT,
            entries: [
                entry(PartnerMentionChannelEnum.INSTAGRAM, 'https://ig.test/1'),
                entry(PartnerMentionChannelEnum.FACEBOOK, 'https://fb.test/2'),
                entry(PartnerMentionChannelEnum.TIKTOK, 'https://tt.test/3'),
                entry(PartnerMentionChannelEnum.WHATSAPP, null)
            ]
        });

        // Four emails for one campaign is how a sender gets marked as spam.
        expect(notifier).toHaveBeenCalledTimes(1);
    });

    it('hands the notifier every mention of the batch', async () => {
        const notifier = vi.fn<PartnerMentionNotifyPort>(async () => undefined);
        const { service } = makeService({ notifier });

        await service.createBatch(adminActor, {
            partnerId: PARTNER_ID,
            mentionedAt: MENTIONED_AT,
            entries: [
                entry(PartnerMentionChannelEnum.INSTAGRAM, 'https://ig.test/1'),
                entry(PartnerMentionChannelEnum.FACEBOOK, 'https://fb.test/2')
            ]
        });

        const payload = notifier.mock.calls[0]?.[0];
        expect(payload?.mentions).toHaveLength(2);
        expect(payload?.partnerId).toBe(PARTNER_ID);
        expect(payload?.batchId).toEqual(expect.any(String));
    });

    it('still writes the rows when NO notifier is injected', async () => {
        // A context without a transport must log mentions perfectly well.
        const { service, model } = makeService();

        const result = await service.createBatch(adminActor, {
            partnerId: PARTNER_ID,
            mentionedAt: MENTIONED_AT,
            entries: [entry(PartnerMentionChannelEnum.WHATSAPP, null)]
        });

        expect(result.data?.mentions).toHaveLength(1);
        expect(model.createMany).toHaveBeenCalledTimes(1);
    });

    it('still returns the rows when the notifier THROWS', async () => {
        // The partner may have no reachable address at all — contactInfo is
        // nullable and every field inside it is nullish. A promotion that really
        // happened must not be lost because the courtesy email could not be sent.
        const notifier = vi.fn(async () => {
            throw new Error('no reachable email for this partner');
        });
        const { service, model } = makeService({ notifier });

        const result = await service.createBatch(adminActor, {
            partnerId: PARTNER_ID,
            mentionedAt: MENTIONED_AT,
            entries: [entry(PartnerMentionChannelEnum.INSTAGRAM, 'https://ig.test/1')]
        });

        expect(result.error).toBeUndefined();
        expect(result.data?.mentions).toHaveLength(1);
        expect(model.createMany).toHaveBeenCalledTimes(1);
    });
});

describe('PartnerMentionService.createBatch — permissions', () => {
    it('refuses an actor without PARTNER_MANAGE', async () => {
        const { service, model } = makeService();

        const result = await service.createBatch(outsiderActor, {
            partnerId: PARTNER_ID,
            mentionedAt: MENTIONED_AT,
            entries: [entry(PartnerMentionChannelEnum.WHATSAPP, null)]
        });

        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(model.createMany).not.toHaveBeenCalled();
    });
});

describe('PartnerMentionService — sealed generic paths', () => {
    it('refuses the inherited single-row create', async () => {
        // A row created that way would carry no batchId and trigger no
        // notification: an orphan in the log the partner is never told about.
        const { service } = makeService();
        await expect(service.create()).rejects.toThrow(/createBatch/);
    });

    it('refuses an unscoped search', async () => {
        // The search schema declares no partnerId, so a generic search would span
        // every partner's log at once.
        const { service } = makeService();
        await expect(
            (service as unknown as { _executeSearch: () => Promise<unknown> })._executeSearch()
        ).rejects.toThrow(/listForPartner/);
    });
});
