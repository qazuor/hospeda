/**
 * @fileoverview
 * Unit tests for the read and correction paths of `PartnerMentionService`
 * (HOS-377 T-010).
 *
 * The two properties worth the most here:
 * - `correct` re-validates the MERGED row, closing the gap the patch schema
 *   structurally cannot see (a lone `{ url: null }` on a stored INSTAGRAM row);
 * - `listForOwner` fails CLOSED on ownership and strips `internalNote` from the
 *   payload itself, not from the UI.
 */

import type { PartnerMentionModel, PartnerModel } from '@repo/db';
import {
    PartnerMentionChannelEnum,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { PartnerMentionService } from '../../../src/services/partner/partner-mention.service';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();
const PARTNER_ID = getMockId('attraction', 'pm-partner-2');
const OWNER_ID = getMockId('user', 'pm-owner-2');
const MENTION_ID = getMockId('user', 'pm-mention-2');
const AUG_01 = new Date('2026-08-01T12:00:00.000Z');

const adminActor = createActor({ permissions: [PermissionEnum.PARTNER_MANAGE] });
const outsiderActor = createActor({ permissions: [] });
const ownerActor = createActor({ id: OWNER_ID, permissions: [] });
const guestActor = createActor({ permissions: [], roles: [RoleEnum.GUEST] });

const makeMention = (overrides: Record<string, unknown> = {}) => ({
    id: MENTION_ID,
    partnerId: PARTNER_ID,
    channel: PartnerMentionChannelEnum.INSTAGRAM,
    batchId: null,
    mentionedAt: AUG_01,
    url: 'https://ig.test/1',
    internalNote: 'agreed with the owner',
    createdAt: AUG_01,
    updatedAt: AUG_01,
    createdById: null,
    updatedById: null,
    deletedAt: null,
    deletedById: null,
    ...overrides
});

function makeService(
    opts: {
        mentions?: Record<string, unknown>[];
        total?: number;
        current?: Record<string, unknown> | null;
        partner?: Record<string, unknown> | null;
    } = {}
) {
    const model = {
        findByPartner: vi.fn(async () => opts.mentions ?? []),
        countByPartner: vi.fn(async () => opts.total ?? (opts.mentions ?? []).length),
        findById: vi.fn(async () => (opts.current === undefined ? makeMention() : opts.current)),
        update: vi.fn(async (_where: unknown, data: Record<string, unknown>) => ({
            ...makeMention(),
            ...data
        }))
    } as unknown as PartnerMentionModel & Record<string, ReturnType<typeof vi.fn>>;

    const partnerModel = {
        findOne: vi.fn(async () => (opts.partner === undefined ? { id: PARTNER_ID } : opts.partner))
    } as unknown as PartnerModel & Record<string, ReturnType<typeof vi.fn>>;

    const service = new PartnerMentionService({ logger: mockLogger, model, partnerModel });
    return { service, model, partnerModel };
}

describe('PartnerMentionService.listForPartner', () => {
    it('scopes the query to the partner it was given', async () => {
        const { service, model } = makeService({ mentions: [makeMention()] });

        const result = await service.listForPartner(adminActor, { partnerId: PARTNER_ID });

        expect(result.data?.mentions).toHaveLength(1);
        expect(model.findByPartner).toHaveBeenCalledWith(
            expect.objectContaining({ partnerId: PARTNER_ID })
        );
    });

    it('reports the total of the whole filtered set, not the page length', async () => {
        // One row on this page, 137 matching the filters overall: a total taken
        // from the page would advertise a single page of a 7-page log.
        const { service, model } = makeService({ mentions: [makeMention()], total: 137 });

        const result = await service.listForPartner(adminActor, {
            partnerId: PARTNER_ID,
            filters: { pageSize: 1 }
        });

        expect(result.data?.mentions).toHaveLength(1);
        expect(result.data?.total).toBe(137);
        expect(model.countByPartner).toHaveBeenCalledWith(
            expect.objectContaining({ partnerId: PARTNER_ID })
        );
    });

    it('counts with the SAME filters it lists with', async () => {
        // A count that drops a filter the list applied answers a different
        // question, and the UI paginates against the wrong number.
        const { service, model } = makeService({ mentions: [], total: 0 });
        const filters = { channel: PartnerMentionChannelEnum.NEWSLETTER, pageSize: 5 };

        await service.listForPartner(adminActor, { partnerId: PARTNER_ID, filters });

        expect(model.findByPartner).toHaveBeenCalledWith(expect.objectContaining({ filters }));
        expect(model.countByPartner).toHaveBeenCalledWith(expect.objectContaining({ filters }));
    });

    it('refuses an actor without PARTNER_MANAGE', async () => {
        const { service, model } = makeService();

        const result = await service.listForPartner(outsiderActor, { partnerId: PARTNER_ID });

        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(model.findByPartner).not.toHaveBeenCalled();
        expect(model.countByPartner).not.toHaveBeenCalled();
    });
});

describe('PartnerMentionService.listForOwner — ownership fails closed', () => {
    it('returns an empty log for a guest, without querying anything', async () => {
        const { service, partnerModel } = makeService();

        const result = await service.listForOwner(guestActor);

        expect(result.data?.batches).toEqual([]);
        // A sentinel id must never be used to build an ownership filter.
        expect(partnerModel.findOne).not.toHaveBeenCalled();
    });

    it('returns an empty log for an authenticated user who owns no partner', async () => {
        const { service } = makeService({ partner: null });

        const result = await service.listForOwner(ownerActor);

        // Never a 403 — that would confirm a partner exists.
        expect(result.error).toBeUndefined();
        expect(result.data?.batches).toEqual([]);
    });

    it('scopes the partner lookup to the caller own id', async () => {
        const { service, partnerModel } = makeService({ mentions: [] });

        await service.listForOwner(ownerActor);

        expect(partnerModel.findOne).toHaveBeenCalledWith(
            expect.objectContaining({ ownerUserId: OWNER_ID }),
            undefined
        );
    });
});

describe('PartnerMentionService.listForOwner — shaping', () => {
    it('never exposes internalNote in the payload', async () => {
        const secret = 'do not show this to the partner';
        const { service } = makeService({
            mentions: [makeMention({ internalNote: secret })]
        });

        const result = await service.listForOwner(ownerActor);

        // Asserted on the serialized payload, not on a UI decision.
        expect(JSON.stringify(result.data)).not.toContain(secret);
    });

    it('collapses a four-network batch into ONE entry with four links', async () => {
        const batchId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
        const { service } = makeService({
            mentions: [
                makeMention({
                    id: 'ccccccc1-cccc-4ccc-8ccc-cccccccccccc',
                    batchId,
                    channel: PartnerMentionChannelEnum.INSTAGRAM
                }),
                makeMention({
                    id: 'ccccccc2-cccc-4ccc-8ccc-cccccccccccc',
                    batchId,
                    channel: PartnerMentionChannelEnum.FACEBOOK
                }),
                makeMention({
                    id: 'ccccccc3-cccc-4ccc-8ccc-cccccccccccc',
                    batchId,
                    channel: PartnerMentionChannelEnum.TIKTOK
                }),
                makeMention({
                    id: 'ccccccc4-cccc-4ccc-8ccc-cccccccccccc',
                    batchId,
                    channel: PartnerMentionChannelEnum.WHATSAPP,
                    url: null
                })
            ]
        });

        const result = await service.listForOwner(ownerActor);

        expect(result.data?.batches).toHaveLength(1);
        expect(result.data?.batches[0]?.mentions).toHaveLength(4);
    });

    it('keeps two different batches apart', async () => {
        const a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
        const b = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
        const { service } = makeService({
            mentions: [
                makeMention({ id: 'ccccccc1-cccc-4ccc-8ccc-cccccccccccc', batchId: a }),
                makeMention({ id: 'ccccccc2-cccc-4ccc-8ccc-cccccccccccc', batchId: a }),
                makeMention({ id: 'ccccccc3-cccc-4ccc-8ccc-cccccccccccc', batchId: b })
            ]
        });

        const result = await service.listForOwner(ownerActor);

        expect(result.data?.batches).toHaveLength(2);
        expect(result.data?.batches[0]?.mentions).toHaveLength(2);
        expect(result.data?.batches[1]?.mentions).toHaveLength(1);
    });

    it('gives an un-batched mention its own single-item batch', async () => {
        // One shape for the view to render, always.
        const { service } = makeService({ mentions: [makeMention({ batchId: null })] });

        const result = await service.listForOwner(ownerActor);

        expect(result.data?.batches).toHaveLength(1);
        expect(result.data?.batches[0]?.batchId).toBeNull();
        expect(result.data?.batches[0]?.mentions).toHaveLength(1);
    });

    it('preserves the newest-first order the query returned', async () => {
        const older = new Date('2026-07-01T00:00:00.000Z');
        const { service } = makeService({
            mentions: [
                makeMention({
                    id: 'ccccccc1-cccc-4ccc-8ccc-cccccccccccc',
                    batchId: null,
                    mentionedAt: AUG_01
                }),
                makeMention({
                    id: 'ccccccc2-cccc-4ccc-8ccc-cccccccccccc',
                    batchId: null,
                    mentionedAt: older
                })
            ]
        });

        const result = await service.listForOwner(ownerActor);

        expect(result.data?.batches[0]?.mentionedAt).toEqual(AUG_01);
        expect(result.data?.batches[1]?.mentionedAt).toEqual(older);
    });
});

describe('PartnerMentionService.correct — merged-row validation', () => {
    it('rejects clearing the url on a stored channel that requires one', async () => {
        // THE GAP the patch schema cannot see: { url: null } alone is a legal
        // patch, and illegal for the INSTAGRAM row it lands on.
        const { service, model } = makeService({
            current: makeMention({ channel: PartnerMentionChannelEnum.INSTAGRAM })
        });

        const result = await service.correct(adminActor, {
            partnerId: PARTNER_ID,
            id: MENTION_ID,
            data: { url: null }
        });

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(model.update).not.toHaveBeenCalled();
    });

    it('allows clearing the url on a stored WHATSAPP row', async () => {
        const { service, model } = makeService({
            current: makeMention({ channel: PartnerMentionChannelEnum.WHATSAPP, url: null })
        });

        const result = await service.correct(adminActor, {
            partnerId: PARTNER_ID,
            id: MENTION_ID,
            data: { url: null }
        });

        expect(result.error).toBeUndefined();
        expect(model.update).toHaveBeenCalled();
    });

    it('allows a date-only correction without touching the url rule', async () => {
        const { service } = makeService({
            current: makeMention({ channel: PartnerMentionChannelEnum.INSTAGRAM })
        });

        const result = await service.correct(adminActor, {
            partnerId: PARTNER_ID,
            id: MENTION_ID,
            data: { mentionedAt: new Date('2026-07-30T00:00:00.000Z') }
        });

        expect(result.error).toBeUndefined();
    });

    it('rejects switching a urlless WHATSAPP row to INSTAGRAM with no url', async () => {
        // Caught by the patch schema before the service even runs, but asserted
        // here so the end-to-end behaviour is pinned at the layer callers use.
        const { service } = makeService({
            current: makeMention({ channel: PartnerMentionChannelEnum.WHATSAPP, url: null })
        });

        const result = await service.correct(adminActor, {
            partnerId: PARTNER_ID,
            id: MENTION_ID,
            data: { channel: PartnerMentionChannelEnum.INSTAGRAM }
        });

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });

    it('404s on a mention that does not exist', async () => {
        const { service } = makeService({ current: null });

        const result = await service.correct(adminActor, {
            partnerId: PARTNER_ID,
            id: MENTION_ID,
            data: { internalNote: 'x' }
        });

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('refuses an actor without PARTNER_MANAGE', async () => {
        const { service, model } = makeService();

        const result = await service.correct(outsiderActor, {
            partnerId: PARTNER_ID,
            id: MENTION_ID,
            data: { internalNote: 'x' }
        });

        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(model.update).not.toHaveBeenCalled();
    });

    it('stamps the acting admin as the updater', async () => {
        const { service, model } = makeService();

        await service.correct(adminActor, {
            partnerId: PARTNER_ID,
            id: MENTION_ID,
            data: { internalNote: 'fixed' }
        });

        expect(model.update).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ updatedById: adminActor.id }),
            undefined
        );
    });
});

describe('PartnerMentionService.remove', () => {
    it('soft-deletes, never hard-deletes', async () => {
        // A mention announced by email that then vanishes without trace is worse
        // than one marked removed.
        const { service, model } = makeService();

        const result = await service.remove(adminActor, { partnerId: PARTNER_ID, id: MENTION_ID });

        expect(result.data?.count).toBe(1);
        expect(model.update).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ deletedAt: expect.any(Date) }),
            undefined
        );
    });

    it('records who removed it', async () => {
        const { service, model } = makeService();

        await service.remove(adminActor, { partnerId: PARTNER_ID, id: MENTION_ID });

        expect(model.update).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ deletedById: adminActor.id }),
            undefined
        );
    });

    it('404s on a mention that does not exist', async () => {
        const { service } = makeService({ current: null });

        const result = await service.remove(adminActor, { partnerId: PARTNER_ID, id: MENTION_ID });

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('refuses an actor without PARTNER_MANAGE', async () => {
        const { service, model } = makeService();

        const result = await service.remove(outsiderActor, {
            partnerId: PARTNER_ID,
            id: MENTION_ID
        });

        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(model.update).not.toHaveBeenCalled();
    });
});

describe('partner scope on the mutating paths', () => {
    // Both routes are `/admin/partners/{partnerId}/mentions/{id}`, and the two
    // path segments are supplied independently — nothing about the URL makes the
    // mention actually belong to that partner. These assert the row is checked
    // against the scope rather than the scope being decorative.
    const OTHER_PARTNER_ID = getMockId('attraction', 'pm-partner-other');

    it('correct refuses a mention belonging to another partner', async () => {
        const { service, model } = makeService();

        const result = await service.correct(adminActor, {
            partnerId: OTHER_PARTNER_ID,
            id: MENTION_ID,
            data: { internalNote: 'moved' }
        });

        // NOT_FOUND, not FORBIDDEN: a distinct code would confirm the row exists
        // under some other partner.
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(model.update).not.toHaveBeenCalled();
    });

    it('remove refuses a mention belonging to another partner', async () => {
        const { service, model } = makeService();

        const result = await service.remove(adminActor, {
            partnerId: OTHER_PARTNER_ID,
            id: MENTION_ID
        });

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(model.update).not.toHaveBeenCalled();
    });
});
