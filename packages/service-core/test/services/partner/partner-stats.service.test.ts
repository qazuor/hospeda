/**
 * @fileoverview
 * Unit tests for `PartnerStatsService` (HOS-1063 A-3 / A-4).
 *
 * The properties worth the most here are the ones a happy-path test would miss:
 *
 * - `getForOwner` fails CLOSED on ownership, twice — a guest never reaches the
 *   ownership filter at all, and an actor who owns no partner resolves to no
 *   row. Both answer `{ available: false }`, never a 403 (AC-6).
 * - A logo click inserts into `partner_logo_clicks` and **NOT** into
 *   `entity_views` (AC-13). Asserting only the first half passes just as well
 *   against the design OQ-2 rejected, which is the whole reason both halves are
 *   here.
 * - The service returns the NUMBERS and the fields `resolvePartnerLogoLink`
 *   reads, and decides no card visibility of its own (§7.2). A `tier` check
 *   appearing here would be a second source of truth about what the home
 *   carousel renders.
 */

import type { EntityViewModel, PartnerLogoClickModel, PartnerModel } from '@repo/db';
import {
    EntityTypeEnum,
    PartnerLogoClickDestinationEnum,
    RoleEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { PartnerStatsService } from '../../../src/services/partner/partner-stats.service';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();
const PARTNER_ID = getMockId('attraction', 'ps-partner-1');
const OWNER_ID = getMockId('user', 'ps-owner-1');

const ownerActor = createActor({ id: OWNER_ID, permissions: [] });
const guestActor = createActor({ permissions: [], roles: [RoleEnum.GUEST] });
const rolelessActor = createActor({ permissions: [], roles: [] });

const goldPartner = {
    id: PARTNER_ID,
    name: 'Bodega Ejemplo',
    slug: 'bodega-ejemplo',
    tier: 'gold',
    websiteUrl: 'https://bodega.example'
};

/**
 * Builds the service with all three models stubbed.
 *
 * Every stub is asserted against somewhere below; none is a convenience default
 * that would let a missing call go unnoticed.
 */
const makeService = (overrides: {
    partner?: Record<string, unknown> | null;
    viewStats?: Array<{ entityId: string; unique: number; total: number }>;
    clickStats?: { unique: number; total: number };
    insertClick?: ReturnType<typeof vi.fn>;
}) => {
    const findOne = vi.fn().mockResolvedValue(overrides.partner ?? null);
    const getStatsForEntities = vi.fn().mockResolvedValue(overrides.viewStats ?? []);
    const getStatsForPartner = vi
        .fn()
        .mockResolvedValue(overrides.clickStats ?? { unique: 0, total: 0 });
    const insertClick = overrides.insertClick ?? vi.fn().mockResolvedValue({ id: 'click-1' });
    const insertView = vi.fn().mockResolvedValue({ id: 'view-1' });

    const service = new PartnerStatsService({
        logger: mockLogger,
        partnerModel: { findOne } as unknown as PartnerModel,
        viewModel: { getStatsForEntities, insertView } as unknown as EntityViewModel,
        clickModel: { getStatsForPartner, insertClick } as unknown as PartnerLogoClickModel
    });

    return { service, findOne, getStatsForEntities, getStatsForPartner, insertClick, insertView };
};

describe('PartnerStatsService.getForOwner — ownership fails closed (AC-6)', () => {
    it('answers { available: false } for a GUEST and never builds an ownership filter', async () => {
        // Arrange
        const { service, findOne } = makeService({ partner: goldPartner });

        // Act
        const result = await service.getForOwner(guestActor, { windowDays: 30 });

        // Assert — the payload, AND that the query was never attempted. A guest
        // carries a REAL uuid, so reaching `findOne` at all would mean an
        // ownership filter built from a value that could coincidentally match.
        expect(result.data).toEqual({ available: false });
        expect(result.error).toBeUndefined();
        expect(findOne).not.toHaveBeenCalled();
    });

    it('answers { available: false } for an actor holding no roles at all', async () => {
        const { service, findOne } = makeService({ partner: goldPartner });

        const result = await service.getForOwner(rolelessActor, { windowDays: 30 });

        expect(result.data).toEqual({ available: false });
        expect(findOne).not.toHaveBeenCalled();
    });

    it('answers { available: false } — not a 403 — for a real user who owns no partner', async () => {
        // Arrange
        const { service, findOne } = makeService({ partner: null });

        // Act
        const result = await service.getForOwner(ownerActor, { windowDays: 30 });

        // Assert — a 403 here would confirm that some partner exists.
        expect(result.data).toEqual({ available: false });
        expect(result.error).toBeUndefined();
        expect(findOne).toHaveBeenCalledWith({ ownerUserId: OWNER_ID }, undefined);
    });
});

describe('PartnerStatsService.getForOwner — the numbers', () => {
    it("reads PARTNER views for the caller's own partner id only", async () => {
        // Arrange
        const { service, getStatsForEntities, getStatsForPartner } = makeService({
            partner: goldPartner,
            viewStats: [{ entityId: PARTNER_ID, unique: 12, total: 19 }],
            clickStats: { unique: 4, total: 5 }
        });

        // Act
        const result = await service.getForOwner(ownerActor, { windowDays: 7 });

        // Assert
        expect(getStatsForEntities).toHaveBeenCalledWith(
            { entityType: EntityTypeEnum.PARTNER, entityIds: [PARTNER_ID], windowDays: 7 },
            undefined
        );
        expect(getStatsForPartner).toHaveBeenCalledWith(
            { partnerId: PARTNER_ID, windowDays: 7 },
            undefined
        );
        expect(result.data?.views).toEqual({ unique: 12, total: 19 });
        expect(result.data?.clicks).toEqual({ unique: 4, total: 5 });
        expect(result.data?.windowDays).toBe(7);
    });

    /**
     * `getStatsForEntities` OMITS entities with no rows in the window — its
     * documented contract. Without the zero-fill in the service the payload
     * reaches the panel with `views: undefined`, which renders as a blank where
     * a number belongs rather than as the zero it actually is.
     */
    it('zero-fills views when the aggregate returns no row for the partner', async () => {
        const { service } = makeService({
            partner: goldPartner,
            viewStats: [],
            clickStats: { unique: 0, total: 0 }
        });

        const result = await service.getForOwner(ownerActor, { windowDays: 30 });

        expect(result.data?.views).toEqual({ unique: 0, total: 0 });
    });

    /**
     * §7.2 / OQ-7: the payload must carry the three fields
     * `resolvePartnerLogoLink` reads, because the WEB decides which cards render
     * and this service must not. If these stop being shipped, the panel loses
     * the only inputs that let it agree with the carousel.
     */
    it('ships tier, slug and websiteUrl so the web can resolve the logo link itself', async () => {
        const { service } = makeService({ partner: goldPartner });

        const result = await service.getForOwner(ownerActor, { windowDays: 30 });

        expect(result.data?.partner).toEqual({
            id: PARTNER_ID,
            name: 'Bodega Ejemplo',
            slug: 'bodega-ejemplo',
            tier: 'gold',
            websiteUrl: 'https://bodega.example'
        });
    });

    /**
     * The mirror of the card-gating rule: a partner whose logo links NOWHERE
     * still gets both numbers. Suppressing one here would move the "does this
     * surface exist?" decision away from `resolvePartnerLogoLink` — and it is
     * the panel, not this service, that must omit the card (G-3).
     */
    it('still returns both metrics for a partner with no page and no website', async () => {
        const { service } = makeService({
            partner: {
                id: PARTNER_ID,
                name: 'Recién creado',
                slug: null,
                tier: null,
                websiteUrl: null
            },
            viewStats: [],
            clickStats: { unique: 0, total: 0 }
        });

        const result = await service.getForOwner(ownerActor, { windowDays: 30 });

        expect(result.data?.available).toBe(true);
        expect(result.data?.views).toEqual({ unique: 0, total: 0 });
        expect(result.data?.clicks).toEqual({ unique: 0, total: 0 });
        expect(result.data?.partner?.tier).toBeUndefined();
        expect(result.data?.partner?.slug).toBeUndefined();
    });

    it('returns a typed INTERNAL_ERROR rather than throwing when the model fails', async () => {
        const { service, findOne } = makeService({ partner: goldPartner });
        findOne.mockRejectedValueOnce(new Error('connection reset'));

        const result = await service.getForOwner(ownerActor, { windowDays: 30 });

        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });
});

describe('PartnerStatsService.captureLogoClick — AC-13', () => {
    it('inserts exactly one partner_logo_clicks row and ZERO entity_views rows', async () => {
        // Arrange
        const { service, insertClick, insertView } = makeService({});

        // Act
        const result = await service.captureLogoClick({
            partnerId: PARTNER_ID,
            visitorHash: 'hash-abc',
            destination: PartnerLogoClickDestinationEnum.OWN_PAGE
        });

        // Assert — BOTH halves. The second is the whole reason OQ-2 rejected
        // reusing entity_views: a click landing there would inflate the views
        // number by however many clicks the logo got, and a test that only
        // counted the new row would pass against that rejected design.
        expect(insertClick).toHaveBeenCalledTimes(1);
        expect(insertClick).toHaveBeenCalledWith({
            partnerId: PARTNER_ID,
            visitorHash: 'hash-abc',
            destination: PartnerLogoClickDestinationEnum.OWN_PAGE
        });
        expect(insertView).not.toHaveBeenCalled();
        expect(result.data).toEqual({ recorded: true });
    });

    it('records an EXTERNAL click the same way — both destinations count', async () => {
        const { service, insertClick } = makeService({});

        await service.captureLogoClick({
            partnerId: PARTNER_ID,
            visitorHash: 'hash-def',
            destination: PartnerLogoClickDestinationEnum.EXTERNAL
        });

        expect(insertClick).toHaveBeenCalledWith(
            expect.objectContaining({ destination: PartnerLogoClickDestinationEnum.EXTERNAL })
        );
    });

    it('returns a typed error instead of throwing, so the public route can still answer 202', async () => {
        const insertClick = vi.fn().mockRejectedValue(new Error('fk violation'));
        const { service } = makeService({ insertClick });

        const result = await service.captureLogoClick({
            partnerId: PARTNER_ID,
            visitorHash: 'hash-ghi',
            destination: PartnerLogoClickDestinationEnum.EXTERNAL
        });

        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    /**
     * The visitor hash is privacy-sensitive and must never reach a log line —
     * the same contract the view capture path carries
     * (docs/guides/view-tracking-privacy.md). Asserted on the failure path
     * because that is the only path that logs.
     */
    it('never writes the visitor hash into the failure log', async () => {
        const insertClick = vi.fn().mockRejectedValue(new Error('boom'));
        const { service } = makeService({ insertClick });

        await service.captureLogoClick({
            partnerId: PARTNER_ID,
            visitorHash: 'super-secret-hash',
            destination: PartnerLogoClickDestinationEnum.EXTERNAL
        });

        // `createLoggerMock` hands back a ServiceLogger, so `.error` is typed as
        // the real method and carries no `.mock`. vi.mocked is how the rest of
        // this package reaches a mock's calls through its declared type.
        const logged = JSON.stringify(vi.mocked(mockLogger.error).mock.calls);
        expect(logged).not.toContain('super-secret-hash');
    });
});
