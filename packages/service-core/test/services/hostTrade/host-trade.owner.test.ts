/**
 * @fileoverview
 * Unit tests for the HostTrade owner self-service surface (HOS-278 AC-7..AC-10).
 *
 * Covers:
 * - getOwn is reachable WITHOUT HOST_TRADE_VIEW (AC-7).
 * - getOwn scopes strictly by ownerUserId and degrades to null (AC-10).
 * - updateOwn applies operational fields live.
 * - updateOwn routes benefit edits to the PENDING columns, never the live ones (AC-8).
 * - updateOwn never writes an identity field (AC-9).
 */

import type { AccommodationModel, HostTradeModel } from '@repo/db';
import { HostTradeBenefitTypeEnum, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { HostTradeService } from '../../../src/services/hostTrade/host-trade.service';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();

const HT_ID = getMockId('attraction', 'ht-owner-1');
const DEST_ID = getMockId('destination', 'dest-owner-1');

/** A listing owned by `ownerUserId`. */
const makeOwnedTrade = (ownerUserId: string, overrides: Record<string, unknown> = {}) => ({
    id: HT_ID,
    slug: 'plomeria-acme',
    name: 'Plomería Acme',
    category: 'PLOMERIA',
    contact: '+54 3442 123456',
    benefit: 'No acumulable.',
    benefitType: HostTradeBenefitTypeEnum.PERCENTAGE,
    benefitValue: 10,
    pendingBenefitType: null,
    pendingBenefitValue: null,
    pendingBenefitText: null,
    benefitReviewState: null,
    destinationId: DEST_ID,
    ownerUserId,
    is24h: false,
    scheduleText: null,
    isActive: true,
    revokedAt: null,
    revokedById: null,
    revokeReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: null,
    updatedById: null,
    deletedAt: null,
    deletedById: null,
    ...overrides
});

function buildService(modelOverrides: Partial<ReturnType<typeof createModelMock>> = {}) {
    const model = { ...createModelMock(['findForHost']), ...modelOverrides };
    const accommodationModel = createModelMock();

    const service = new HostTradeService(
        { logger: mockLogger },
        model as unknown as HostTradeModel,
        accommodationModel as unknown as AccommodationModel
    );

    return { service, model };
}

/**
 * A provider: an ordinary account with NO host-trade permission at all.
 *
 * This is the actor AC-7 is about — a tourist whose application was approved.
 * Giving the test actor `HOST_TRADE_VIEW` would make every assertion below
 * pass for the wrong reason.
 */
const providerActor = createActor({ permissions: [] });

describe('HostTradeService.getOwn — AC-7 / AC-10', () => {
    it('should return the listing WITHOUT the actor holding HOST_TRADE_VIEW', async () => {
        // Arrange
        const trade = makeOwnedTrade(providerActor.id);
        const { service, model } = buildService({
            findOne: vi.fn(async () => trade)
        });

        // Act
        const result = await service.getOwn(providerActor);

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.trade?.id).toBe(HT_ID);
        expect(providerActor.permissions).not.toContain(PermissionEnum.HOST_TRADE_VIEW);
        expect(model.findOne).toHaveBeenCalledTimes(1);
    });

    it('should scope the lookup by ownerUserId and nothing else', async () => {
        // Arrange
        const { service, model } = buildService({
            findOne: vi.fn(async () => makeOwnedTrade(providerActor.id))
        });

        // Act
        await service.getOwn(providerActor);

        // Assert — the ownership filter is what makes AC-10 unreachable rather
        // than merely forbidden: there is no id in the request to point
        // somewhere else.
        expect(model.findOne).toHaveBeenCalledWith({ ownerUserId: providerActor.id }, undefined);
    });

    it('should return null, not 404, when the actor owns no listing', async () => {
        // Arrange — a 404 would make "you have no listing yet" look like a
        // broken page; a 403 would confirm one exists.
        const { service } = buildService({ findOne: vi.fn(async () => null) });

        // Act
        const result = await service.getOwn(providerActor);

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.trade).toBeNull();
    });

    it('should return null for a guest without querying at all', async () => {
        // Arrange — a guest's sentinel id is not a real users row. Building an
        // ownership filter from it could only ever match by coincidence.
        const guest = createActor({ permissions: [], roles: [] });
        const { service, model } = buildService({
            findOne: vi.fn(async () => makeOwnedTrade('someone'))
        });

        // Act
        const result = await service.getOwn(guest);

        // Assert
        expect(result.data?.trade).toBeNull();
        expect(model.findOne).not.toHaveBeenCalled();
    });
});

describe('HostTradeService.updateOwn — AC-8 / AC-9', () => {
    it('should apply operational fields immediately', async () => {
        // Arrange
        const trade = makeOwnedTrade(providerActor.id);
        const { service, model } = buildService({
            findOne: vi.fn(async () => trade),
            update: vi.fn(async () => ({ ...trade, contact: 'wa.me/5493411111111' }))
        });

        // Act
        await service.updateOwn(providerActor, {
            contact: 'wa.me/5493411111111',
            scheduleText: 'Lunes a viernes 8 a 18'
        });

        // Assert
        const [, payload] = (model.update as ReturnType<typeof vi.fn>).mock.calls[0] ?? [];
        expect(payload).toMatchObject({
            contact: 'wa.me/5493411111111',
            scheduleText: 'Lunes a viernes 8 a 18'
        });
        expect(payload).not.toHaveProperty('benefitReviewState');
    });

    it('should route a benefit edit to the PENDING columns and leave the live one alone', async () => {
        // Arrange — the vetted benefit must stay public while the new one
        // waits. Writing the live columns here is the exact bug AC-8 forbids.
        const trade = makeOwnedTrade(providerActor.id);
        const { service, model } = buildService({
            findOne: vi.fn(async () => trade),
            update: vi.fn(async () => trade)
        });

        // Act
        await service.updateOwn(providerActor, {
            benefitType: HostTradeBenefitTypeEnum.TWO_FOR_ONE,
            benefitText: 'Sólo martes.'
        });

        // Assert
        const [, payload] = (model.update as ReturnType<typeof vi.fn>).mock.calls[0] ?? [];
        expect(payload).toMatchObject({
            pendingBenefitType: HostTradeBenefitTypeEnum.TWO_FOR_ONE,
            pendingBenefitText: 'Sólo martes.',
            benefitReviewState: 'pending'
        });
        expect(payload).not.toHaveProperty('benefitType');
        expect(payload).not.toHaveProperty('benefitValue');
        expect(payload).not.toHaveProperty('benefit');
    });

    it('should never write an identity field, even when one is sent', async () => {
        // Arrange
        const trade = makeOwnedTrade(providerActor.id);
        const { service, model } = buildService({
            findOne: vi.fn(async () => trade),
            update: vi.fn(async () => trade)
        });

        // Act — the extra keys are stripped by the schema before the service
        // sees them, which is why this is not an error response.
        await service.updateOwn(providerActor, {
            contact: '+54 9 341 000 0000',
            name: 'Renamed',
            slug: 'renamed',
            category: 'ELECTRICIDAD',
            destinationId: getMockId('destination', 'other'),
            isActive: false
        } as never);

        // Assert
        const [, payload] = (model.update as ReturnType<typeof vi.fn>).mock.calls[0] ?? [];
        expect(payload).not.toHaveProperty('name');
        expect(payload).not.toHaveProperty('slug');
        expect(payload).not.toHaveProperty('category');
        expect(payload).not.toHaveProperty('destinationId');
        expect(payload).not.toHaveProperty('isActive');
        expect(payload).toMatchObject({ contact: '+54 9 341 000 0000' });
    });

    it('should fail with NOT_FOUND when the actor owns no listing', async () => {
        // Arrange
        const { service } = buildService({ findOne: vi.fn(async () => null) });

        // Act
        const result = await service.updateOwn(providerActor, { contact: '+54 9 341 000 0000' });

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should reject an invalid benefit before it reaches the review queue', async () => {
        // Arrange — a PERCENTAGE with no value.
        const trade = makeOwnedTrade(providerActor.id);
        const { service, model } = buildService({
            findOne: vi.fn(async () => trade),
            update: vi.fn(async () => trade)
        });

        // Act
        const result = await service.updateOwn(providerActor, {
            benefitType: HostTradeBenefitTypeEnum.PERCENTAGE
        });

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(model.update).not.toHaveBeenCalled();
    });
});
