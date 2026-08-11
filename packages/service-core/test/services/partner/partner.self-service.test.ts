/**
 * @fileoverview
 * Unit tests for the partner owner self-service surface (HOS-278 D3).
 *
 * Covers:
 * - getOwn is reachable WITHOUT any PARTNER_* permission (AC-7).
 * - getOwn scopes strictly by ownerUserId and degrades to null.
 * - updateOwn applies contact and social edits live.
 * - updateOwn routes content edits to the PENDING columns, never the live ones.
 * - updateOwn never writes an identity or commercial field.
 */

import type { PartnerModel } from '@repo/db';
import {
    LifecycleStatusEnum,
    PartnerContentReviewStateEnum,
    PartnerSubscriptionStatusEnum,
    PartnerTierEnum,
    PartnerTypeEnum,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { PartnerService } from '../../../src/services/partner/partner.service';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();
const PARTNER_ID = getMockId('attraction', 'partner-self-1');

/**
 * A partner: an ordinary account with NO partner permission at all.
 *
 * This is the actor AC-7 is about. Giving the test actor `PARTNER_VIEW_ALL`
 * would make every assertion below pass for the wrong reason.
 */
const partnerActor = createActor({ permissions: [] });

const makeOwnedPartner = (ownerUserId: string, overrides: Record<string, unknown> = {}) => ({
    id: PARTNER_ID,
    slug: 'acme-turismo',
    name: 'Acme Turismo',
    type: PartnerTypeEnum.COMMERCE,
    tier: PartnerTierEnum.SILVER,
    logoUrl: 'https://cdn.example.com/live.png',
    description: 'Texto vivo.',
    websiteUrl: 'https://acme.example.com',
    contactInfo: { workEmail: 'hola@acme.com' },
    socialNetworks: { instagram: 'https://instagram.com/acme' },
    subscriptionStatus: PartnerSubscriptionStatusEnum.PENDING,
    lifecycleState: LifecycleStatusEnum.DRAFT,
    analytics: {},
    planId: null,
    subscriptionId: null,
    ownerUserId,
    startsAt: null,
    endsAt: null,
    pendingLogoUrl: null,
    pendingDescription: null,
    pendingWebsiteUrl: null,
    contentReviewState: null,
    contentReviewNote: null,
    contentApprovedAt: null,
    contentApprovedById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: null,
    updatedById: null,
    deletedAt: null,
    deletedById: null,
    ...overrides
});

function buildService(modelOverrides: Record<string, unknown> = {}) {
    const model = { ...createModelMock(), ...modelOverrides };
    const service = new PartnerService({
        logger: mockLogger,
        model: model as unknown as PartnerModel
    });
    return { service, model };
}

const writtenPatch = (model: Record<string, unknown>): Record<string, unknown> => {
    const call = (model.update as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call, 'model.update was never called').toBeDefined();
    return call?.[1] as Record<string, unknown>;
};

describe('PartnerService.getOwn — AC-7', () => {
    it('returns the partner WITHOUT the actor holding any PARTNER_* permission', async () => {
        // Arrange
        const partner = makeOwnedPartner(partnerActor.id);
        const { service, model } = buildService({ findOne: vi.fn(async () => partner) });

        // Act
        const result = await service.getOwn(partnerActor);

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.partner?.id).toBe(PARTNER_ID);
        expect(partnerActor.permissions).not.toContain(PermissionEnum.PARTNER_VIEW_ALL);
        expect(partnerActor.permissions).not.toContain(PermissionEnum.PARTNER_MANAGE);
        expect(model.findOne).toHaveBeenCalledTimes(1);
    });

    it('scopes the lookup by ownerUserId and nothing else', async () => {
        // Arrange
        const { service, model } = buildService({
            findOne: vi.fn(async () => makeOwnedPartner(partnerActor.id))
        });

        // Act
        await service.getOwn(partnerActor);

        // Assert — the ownership filter is what makes reading someone else's
        // listing unreachable rather than merely forbidden: there is no id in
        // the request to point somewhere else.
        expect(model.findOne).toHaveBeenCalledWith({ ownerUserId: partnerActor.id }, undefined);
    });

    it('returns null, not 404, when the actor owns no partner', async () => {
        // Arrange — a 404 would make "you have no listing yet" look like a
        // broken page; a 403 would confirm one exists.
        const { service } = buildService({ findOne: vi.fn(async () => null) });

        // Act
        const result = await service.getOwn(partnerActor);

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.partner).toBeNull();
    });

    it('returns null for a guest without querying at all', async () => {
        // Arrange — a guest's sentinel id is not a real users row. Building an
        // ownership filter from it could only ever match by coincidence.
        const guest = createActor({ permissions: [], roles: [] });
        const { service, model } = buildService({
            findOne: vi.fn(async () => makeOwnedPartner('someone'))
        });

        // Act
        const result = await service.getOwn(guest);

        // Assert
        expect(result.data?.partner).toBeNull();
        expect(model.findOne).not.toHaveBeenCalled();
    });
});

describe('PartnerService.updateOwn — routing', () => {
    it('applies contact and social edits to the LIVE columns immediately', async () => {
        // Arrange
        const existing = makeOwnedPartner(partnerActor.id);
        const { service, model } = buildService({
            findOne: vi.fn(async () => existing),
            update: vi.fn(async () => existing)
        });

        // Act
        const result = await service.updateOwn(partnerActor, {
            contactInfo: { workPhone: '+543442999999' },
            socialNetworks: { instagram: 'https://instagram.com/nuevo' }
        });

        // Assert
        expect(result.error).toBeUndefined();
        const patch = writtenPatch(model);
        expect(patch.contactInfo).toEqual({ workPhone: '+543442999999' });
        expect(patch.socialNetworks).toEqual({ instagram: 'https://instagram.com/nuevo' });
        expect(patch).not.toHaveProperty('contentReviewState');
    });

    it('routes a content edit to the PENDING columns, never the live ones', async () => {
        // Arrange — the whole point of §6.3 step 4: a published partner must
        // not have their listing change before an admin has looked at it.
        const existing = makeOwnedPartner(partnerActor.id);
        const { service, model } = buildService({
            findOne: vi.fn(async () => existing),
            update: vi.fn(async () => existing)
        });

        // Act
        await service.updateOwn(partnerActor, { description: 'Texto propuesto.' });

        // Assert
        const patch = writtenPatch(model);
        expect(patch.pendingDescription).toBe('Texto propuesto.');
        expect(patch.contentReviewState).toBe(PartnerContentReviewStateEnum.PENDING);
        expect(patch).not.toHaveProperty('description');
        expect(patch).not.toHaveProperty('logoUrl');
        expect(patch).not.toHaveProperty('websiteUrl');
    });

    it('clears a previous rejection note when a new submission arrives', async () => {
        // Arrange — leaving the old note would have the partner staring at a
        // rejection that no longer describes what is in the queue.
        const existing = makeOwnedPartner(partnerActor.id, {
            contentReviewState: PartnerContentReviewStateEnum.REJECTED,
            contentReviewNote: 'El logo está pixelado.'
        });
        const { service, model } = buildService({
            findOne: vi.fn(async () => existing),
            update: vi.fn(async () => existing)
        });

        // Act
        await service.updateOwn(partnerActor, {
            logoUrl: 'https://cdn.example.com/mejor.png'
        });

        // Assert
        expect(writtenPatch(model).contentReviewNote).toBeNull();
    });

    it('leaves the review state alone when only contact data changed', async () => {
        // Arrange — the inverse guard. If every save parked the listing in
        // review, a partner could never fix a phone number without losing
        // their published content for a day.
        const existing = makeOwnedPartner(partnerActor.id);
        const { service, model } = buildService({
            findOne: vi.fn(async () => existing),
            update: vi.fn(async () => existing)
        });

        // Act
        await service.updateOwn(partnerActor, { contactInfo: { workPhone: '+543442999999' } });

        // Assert
        expect(writtenPatch(model)).not.toHaveProperty('contentReviewState');
    });

    it('never writes the approval stamp, whatever the payload claims', async () => {
        // Arrange — an owner who could set `contentApprovedAt` would approve
        // their own content, which is AC-11 defeated in one field. The schema
        // strips it; this pins that the service does not reintroduce it.
        const existing = makeOwnedPartner(partnerActor.id);
        const { service, model } = buildService({
            findOne: vi.fn(async () => existing),
            update: vi.fn(async () => existing)
        });

        // Act
        await service.updateOwn(partnerActor, {
            description: 'Texto propuesto.',
            contentApprovedAt: new Date(),
            subscriptionStatus: PartnerSubscriptionStatusEnum.ACTIVE
        } as Parameters<typeof service.updateOwn>[1]);

        // Assert
        const patch = writtenPatch(model);
        expect(patch).not.toHaveProperty('contentApprovedAt');
        expect(patch).not.toHaveProperty('subscriptionStatus');
    });
});

describe('PartnerService.updateOwn — ownership', () => {
    it('returns NOT_FOUND when the actor owns no partner', async () => {
        // Arrange
        const { service, model } = buildService({
            findOne: vi.fn(async () => null),
            update: vi.fn(async () => null)
        });

        // Act
        const result = await service.updateOwn(partnerActor, { description: 'x' });

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(model.update).not.toHaveBeenCalled();
    });

    it('returns NOT_FOUND for a guest without querying at all', async () => {
        // Arrange
        const guest = createActor({ permissions: [], roles: [] });
        const { service, model } = buildService({
            findOne: vi.fn(async () => makeOwnedPartner('someone')),
            update: vi.fn(async () => null)
        });

        // Act
        const result = await service.updateOwn(guest, { description: 'x' });

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(model.findOne).not.toHaveBeenCalled();
        expect(model.update).not.toHaveBeenCalled();
    });

    it('updates by the id it RESOLVED, not by anything the caller supplied', async () => {
        // Arrange
        const existing = makeOwnedPartner(partnerActor.id);
        const { service, model } = buildService({
            findOne: vi.fn(async () => existing),
            update: vi.fn(async () => existing)
        });

        // Act
        await service.updateOwn(partnerActor, { description: 'x' });

        // Assert
        const where = (model.update as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
        expect(where).toEqual({ id: PARTNER_ID });
    });
});
