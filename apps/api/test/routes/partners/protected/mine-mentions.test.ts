/**
 * Tests for `GET /api/v1/protected/partners/mine/mentions` (HOS-377 T-018).
 *
 * Two properties are worth the most here, and neither is about happy-path
 * shape:
 *
 * 1. **`internalNote` never reaches the wire.** It is admin-only context about
 *    a partner, and the route deliberately does not strip it — the service
 *    does. This suite asserts on the SERIALIZED payload rather than on a field
 *    list, so a note nested somewhere unexpected still fails.
 * 2. **Ownership decides the scope, and it fails closed.** The cross-owner case
 *    is exercised against a partner row that genuinely EXISTS and belongs to
 *    somebody else. A fabricated id would be filtered out before any ownership
 *    logic ran, and the test would pass while proving nothing.
 *
 * The service is exercised for real against a stubbed model, not mocked out:
 * the stripping and the ownership filter are precisely what is under test, and
 * a stubbed `listForOwner` would assert only that the route forwards a value.
 *
 * @module test/routes/partners/protected/mine-mentions
 */

import type { PartnerMentionModel, PartnerModel } from '@repo/db';
import { PartnerMentionChannelEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Everything a `vi.mock` factory touches must be hoisted with it: the factories
// run before any module-level `const` in this file is initialized, and
// `mine-mentions.ts` constructs its service at import time.
const { getActorMock, findOneMock, findByPartnerMock } = vi.hoisted(() => ({
    getActorMock: vi.fn(),
    findOneMock: vi.fn(),
    findByPartnerMock: vi.fn()
}));

// The real factory wires auth middleware that transitively pulls in the whole
// @repo/db surface; this module only needs the exported handler.
vi.mock('../../../../src/utils/route-factory', () => ({
    createProtectedRoute: vi.fn((options: unknown) => options)
}));
vi.mock('../../../../src/utils/route-factory.js', () => ({
    createProtectedRoute: vi.fn((options: unknown) => options)
}));

vi.mock('../../../../src/utils/actor', () => ({
    getActorFromContext: getActorMock
}));

const OWNER_ID = '00000000-0000-4000-a000-0000000000a1';
const OTHER_OWNER_ID = '00000000-0000-4000-a000-0000000000a2';
const MY_PARTNER_ID = '00000000-0000-4000-a000-0000000000b1';
const OTHER_PARTNER_ID = '00000000-0000-4000-a000-0000000000b2';
const BATCH_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SECRET_NOTE = 'owner asked us to push this hard before the long weekend';
const AUG_01 = new Date('2026-08-01T12:00:00.000Z');

/**
 * Two partners exist, owned by two different accounts. The cross-owner test
 * depends on BOTH rows being real: an ownership filter can only be shown to
 * work if there is something it correctly declines to return.
 */
const PARTNERS = [
    { id: MY_PARTNER_ID, ownerUserId: OWNER_ID },
    { id: OTHER_PARTNER_ID, ownerUserId: OTHER_OWNER_ID }
];

const makeMention = (overrides: Record<string, unknown> = {}) => ({
    id: '00000000-0000-4000-a000-0000000000c1',
    partnerId: MY_PARTNER_ID,
    channel: PartnerMentionChannelEnum.INSTAGRAM,
    batchId: null,
    mentionedAt: AUG_01,
    url: 'https://ig.test/1',
    internalNote: SECRET_NOTE,
    createdAt: AUG_01,
    updatedAt: AUG_01,
    createdById: OWNER_ID,
    updatedById: OWNER_ID,
    deletedAt: null,
    deletedById: null,
    ...overrides
});

/** Rows keyed by the partner that owns them, so a wrong scope returns wrong data. */
const MENTIONS_BY_PARTNER: Record<string, Record<string, unknown>[]> = {
    [MY_PARTNER_ID]: [
        makeMention({ id: 'c1', batchId: BATCH_ID, channel: PartnerMentionChannelEnum.INSTAGRAM }),
        makeMention({ id: 'c2', batchId: BATCH_ID, channel: PartnerMentionChannelEnum.FACEBOOK })
    ],
    [OTHER_PARTNER_ID]: [
        makeMention({
            id: 'd1',
            partnerId: OTHER_PARTNER_ID,
            url: 'https://ig.test/not-yours'
        })
    ]
};

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    // The REAL service, given stub models: the stripping and the ownership
    // filter under test are its behaviour, not the route's.
    class PartnerMentionServiceWithStubs extends actual.PartnerMentionService {
        constructor(ctx: Record<string, unknown>) {
            super({
                ...ctx,
                model: { findByPartner: findByPartnerMock } as unknown as PartnerMentionModel,
                partnerModel: { findOne: findOneMock } as unknown as PartnerModel
            } as ConstructorParameters<typeof actual.PartnerMentionService>[0]);
        }
    }
    return { ...actual, PartnerMentionService: PartnerMentionServiceWithStubs };
});

import { handleGetMyMentions } from '../../../../src/routes/partners/protected/mine-mentions';

// The handler reads only the actor, so the Hono context is never touched.
const ctx = {} as Parameters<typeof handleGetMyMentions>[0];

const asOwner = (id: string) => ({ id, roles: [RoleEnum.USER], permissions: [] });

beforeEach(() => {
    vi.clearAllMocks();
    findOneMock.mockImplementation(
        async (where: { ownerUserId?: string }) =>
            PARTNERS.find((p) => p.ownerUserId === where.ownerUserId) ?? null
    );
    findByPartnerMock.mockImplementation(
        async ({ partnerId }: { partnerId: string }) => MENTIONS_BY_PARTNER[partnerId] ?? []
    );
});

describe('GET /protected/partners/mine/mentions — internalNote leak', () => {
    it('never serializes internalNote', async () => {
        getActorMock.mockReturnValue(asOwner(OWNER_ID));

        const result = await handleGetMyMentions(ctx);

        // Asserted on the payload as it goes over the wire, not on a field list
        // — a note surfacing under an unexpected key still fails this.
        expect(JSON.stringify(result)).not.toContain(SECRET_NOTE);
    });

    it('drops the audit authors too, not just the note', async () => {
        getActorMock.mockReturnValue(asOwner(OWNER_ID));

        const result = await handleGetMyMentions(ctx);
        const mention = result.batches[0]?.mentions[0] as Record<string, unknown> | undefined;

        expect(mention).toBeDefined();
        expect(mention).not.toHaveProperty('internalNote');
        expect(mention).not.toHaveProperty('createdById');
        expect(mention).not.toHaveProperty('updatedById');
        expect(mention).not.toHaveProperty('deletedById');
    });

    it('still returns the fields the log exists to show', async () => {
        getActorMock.mockReturnValue(asOwner(OWNER_ID));

        const result = await handleGetMyMentions(ctx);
        const mention = result.batches[0]?.mentions[0] as Record<string, unknown>;

        // Stripping that took the link with it would defeat the whole feature:
        // the promise is a verifiable record, and the URL is the verification.
        expect(mention.url).toBe('https://ig.test/1');
        expect(mention.channel).toBe(PartnerMentionChannelEnum.INSTAGRAM);
        expect(mention.mentionedAt).toEqual(AUG_01);
    });
});

describe('GET /protected/partners/mine/mentions — ownership', () => {
    it('returns only the caller own partner log', async () => {
        getActorMock.mockReturnValue(asOwner(OWNER_ID));

        const result = await handleGetMyMentions(ctx);

        expect(findByPartnerMock).toHaveBeenCalledWith(
            expect.objectContaining({ partnerId: MY_PARTNER_ID })
        );
        expect(JSON.stringify(result)).not.toContain('not-yours');
    });

    it("never reaches another owner's partner, which EXISTS and has mentions", async () => {
        // The other partner is a real row with a real log. That is the point:
        // an invented id would be filtered out before ownership was consulted,
        // and this test would pass without the gate having run.
        getActorMock.mockReturnValue(asOwner(OTHER_OWNER_ID));

        const result = await handleGetMyMentions(ctx);

        // The other owner legitimately sees THEIR own log...
        expect(findByPartnerMock).toHaveBeenCalledWith(
            expect.objectContaining({ partnerId: OTHER_PARTNER_ID })
        );
        // ...and never the first owner's.
        expect(findByPartnerMock).not.toHaveBeenCalledWith(
            expect.objectContaining({ partnerId: MY_PARTNER_ID })
        );
        expect(JSON.stringify(result)).not.toContain('https://ig.test/1');
    });

    it('answers an empty log — not 403 — for a user who owns no partner', async () => {
        getActorMock.mockReturnValue(asOwner('00000000-0000-4000-a000-0000000000ff'));

        const result = await handleGetMyMentions(ctx);

        // A 403 would confirm that some partner exists.
        expect(result.batches).toEqual([]);
        expect(findByPartnerMock).not.toHaveBeenCalled();
    });

    it('never builds an ownership filter out of a guest sentinel id', async () => {
        getActorMock.mockReturnValue({
            id: 'guest-sentinel',
            roles: [RoleEnum.GUEST],
            permissions: []
        });

        const result = await handleGetMyMentions(ctx);

        expect(result.batches).toEqual([]);
        expect(findOneMock).not.toHaveBeenCalled();
    });
});

describe('GET /protected/partners/mine/mentions — grouping', () => {
    it('collapses a submission into ONE batch carrying its channels (AC-10)', async () => {
        getActorMock.mockReturnValue(asOwner(OWNER_ID));

        const result = await handleGetMyMentions(ctx);

        expect(result.batches).toHaveLength(1);
        expect(result.batches[0]?.batchId).toBe(BATCH_ID);
        expect(result.batches[0]?.mentions).toHaveLength(2);
    });
});
