/**
 * @fileoverview
 * Unit tests for the partner content-review surface (HOS-278 AC-11).
 *
 * Covers:
 * - reviewContent promotes the pending trio onto the live columns on approve.
 * - reviewContent stamps `contentApprovedAt` — the payment gate — exactly once.
 * - reviewContent discards the pending copy and records a reason on reject.
 * - The two payment surfaces refuse to run until content has been approved.
 * - A partner created by an admin is payable without a review round-trip.
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
import {
    isPartnerContentApprovedForPayment,
    PartnerService
} from '../../../src/services/partner/partner.service';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();

const PARTNER_ID = getMockId('attraction', 'partner-review-1');

/** An admin who may manage partners. */
const adminActor = createActor({ permissions: [PermissionEnum.PARTNER_MANAGE] });

/** Someone authenticated who may not. */
const outsiderActor = createActor({ permissions: [] });

/** A partner with a submission waiting on review, and nothing approved yet. */
const makePartner = (overrides: Record<string, unknown> = {}) => ({
    id: PARTNER_ID,
    slug: 'acme-turismo',
    name: 'Acme Turismo',
    type: PartnerTypeEnum.COMMERCE,
    tier: PartnerTierEnum.SILVER,
    logoUrl: null,
    websiteUrl: null,
    description: null,
    subscriptionStatus: PartnerSubscriptionStatusEnum.PENDING,
    lifecycleState: LifecycleStatusEnum.DRAFT,
    analytics: {},
    planId: null,
    subscriptionId: null,
    ownerUserId: getMockId('user', 'partner-owner-1'),
    startsAt: null,
    endsAt: null,
    pendingLogoUrl: 'https://cdn.example.com/acme-logo.png',
    pendingDescription: 'Excursiones por el Litoral.',
    pendingWebsiteUrl: 'https://acme-turismo.example.com',
    contentReviewState: PartnerContentReviewStateEnum.PENDING,
    contentReviewNote: null,
    contentApprovedAt: null,
    contentApprovedById: null,
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-01T00:00:00Z'),
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

/** The payload the model was asked to write, for the single update call. */
const writtenPatch = (model: Record<string, unknown>): Record<string, unknown> => {
    const call = (model.update as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call, 'model.update was never called').toBeDefined();
    return call?.[1] as Record<string, unknown>;
};

describe('PartnerService.reviewContent — approve', () => {
    it('promotes the pending trio onto the live columns and clears it', async () => {
        // Arrange
        const existing = makePartner();
        const { service, model } = buildService({
            findById: vi.fn(async () => existing),
            update: vi.fn(async () => makePartner({ contentApprovedAt: new Date() }))
        });

        // Act
        const result = await service.reviewContent(adminActor, {
            id: PARTNER_ID,
            decision: 'approve'
        });

        // Assert
        expect(result.error).toBeUndefined();
        const patch = writtenPatch(model);
        expect(patch.logoUrl).toBe('https://cdn.example.com/acme-logo.png');
        expect(patch.description).toBe('Excursiones por el Litoral.');
        expect(patch.websiteUrl).toBe('https://acme-turismo.example.com');
        expect(patch.pendingLogoUrl).toBeNull();
        expect(patch.pendingDescription).toBeNull();
        expect(patch.pendingWebsiteUrl).toBeNull();
        expect(patch.contentReviewState).toBe(PartnerContentReviewStateEnum.APPROVED);
    });

    it('stamps contentApprovedAt — the payment gate — with the reviewing admin', async () => {
        // Arrange
        const { service, model } = buildService({
            findById: vi.fn(async () => makePartner()),
            update: vi.fn(async () => makePartner())
        });

        // Act
        await service.reviewContent(adminActor, { id: PARTNER_ID, decision: 'approve' });

        // Assert — without this the partner clears review and still cannot pay,
        // which is AC-11 failing in the direction nobody notices.
        const patch = writtenPatch(model);
        expect(patch.contentApprovedAt).toBeInstanceOf(Date);
        expect(patch.contentApprovedById).toBe(adminActor.id);
    });

    it('leaves an EARLIER contentApprovedAt untouched on a re-approval', async () => {
        // Arrange — a published partner who edited their logo. The date records
        // when content FIRST cleared review; overwriting it would turn a fact
        // about the partner into a fact about their latest edit.
        const firstApproval = new Date('2026-07-10T12:00:00Z');
        const { service, model } = buildService({
            findById: vi.fn(async () =>
                makePartner({
                    contentApprovedAt: firstApproval,
                    contentApprovedById: getMockId('user', 'first-admin')
                })
            ),
            update: vi.fn(async () => makePartner({ contentApprovedAt: firstApproval }))
        });

        // Act
        await service.reviewContent(adminActor, { id: PARTNER_ID, decision: 'approve' });

        // Assert
        const patch = writtenPatch(model);
        expect(patch).not.toHaveProperty('contentApprovedAt');
        expect(patch).not.toHaveProperty('contentApprovedById');
    });

    it('writes null when the submission deliberately cleared a text', async () => {
        // Arrange — the partner removed their description. Keeping the previous
        // prose beside a new logo is how a listing ends up saying something
        // nobody wrote.
        const { service, model } = buildService({
            findById: vi.fn(async () =>
                makePartner({ description: 'Texto viejo.', pendingDescription: null })
            ),
            update: vi.fn(async () => makePartner())
        });

        // Act
        await service.reviewContent(adminActor, { id: PARTNER_ID, decision: 'approve' });

        // Assert
        expect(writtenPatch(model).description).toBeNull();
    });
});

describe('PartnerService.reviewContent — reject', () => {
    it('discards the pending copy, records the reason, and does NOT open payment', async () => {
        // Arrange
        const { service, model } = buildService({
            findById: vi.fn(async () => makePartner()),
            update: vi.fn(async () => makePartner())
        });

        // Act
        const result = await service.reviewContent(adminActor, {
            id: PARTNER_ID,
            decision: 'reject',
            note: 'El logo está pixelado.'
        });

        // Assert
        expect(result.error).toBeUndefined();
        const patch = writtenPatch(model);
        expect(patch.contentReviewState).toBe(PartnerContentReviewStateEnum.REJECTED);
        expect(patch.contentReviewNote).toBe('El logo está pixelado.');
        expect(patch.pendingLogoUrl).toBeNull();
        expect(patch).not.toHaveProperty('logoUrl');
        expect(patch).not.toHaveProperty('contentApprovedAt');
    });

    it('refuses a rejection with no reason', async () => {
        // Arrange — a rejection the partner cannot act on is the failure mode
        // keeping `rejected` as a state was meant to avoid.
        const { service, model } = buildService({
            findById: vi.fn(async () => makePartner()),
            update: vi.fn(async () => makePartner())
        });

        // Act
        const result = await service.reviewContent(adminActor, {
            id: PARTNER_ID,
            decision: 'reject'
        });

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(model.update).not.toHaveBeenCalled();
    });

    it('refuses a rejection whose reason is only whitespace', async () => {
        // Arrange
        const { service, model } = buildService({
            findById: vi.fn(async () => makePartner()),
            update: vi.fn(async () => makePartner())
        });

        // Act
        const result = await service.reviewContent(adminActor, {
            id: PARTNER_ID,
            decision: 'reject',
            note: '   '
        });

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(model.update).not.toHaveBeenCalled();
    });
});

describe('PartnerService.reviewContent — preconditions', () => {
    it('refuses when there is no pending submission to resolve', async () => {
        // Arrange
        const { service, model } = buildService({
            findById: vi.fn(async () => makePartner({ contentReviewState: null })),
            update: vi.fn(async () => makePartner())
        });

        // Act
        const result = await service.reviewContent(adminActor, {
            id: PARTNER_ID,
            decision: 'approve'
        });

        // Assert — an approval with nothing pending would stamp the payment
        // gate on content no admin ever saw.
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(model.update).not.toHaveBeenCalled();
    });

    it('refuses to re-resolve a submission that was already approved', async () => {
        // Arrange
        const { service, model } = buildService({
            findById: vi.fn(async () =>
                makePartner({
                    contentReviewState: PartnerContentReviewStateEnum.APPROVED,
                    pendingLogoUrl: null,
                    pendingDescription: null,
                    pendingWebsiteUrl: null
                })
            ),
            update: vi.fn(async () => makePartner())
        });

        // Act
        const result = await service.reviewContent(adminActor, {
            id: PARTNER_ID,
            decision: 'approve'
        });

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(model.update).not.toHaveBeenCalled();
    });

    it('reads the review STATE, not the pending columns', async () => {
        // Arrange — a submission that only rewrote the description leaves both
        // other pending columns null. Inferring "is there anything pending?"
        // from their presence would call this nothing to review.
        const { service, model } = buildService({
            findById: vi.fn(async () =>
                makePartner({ pendingLogoUrl: null, pendingWebsiteUrl: null })
            ),
            update: vi.fn(async () => makePartner())
        });

        // Act
        const result = await service.reviewContent(adminActor, {
            id: PARTNER_ID,
            decision: 'approve'
        });

        // Assert
        expect(result.error).toBeUndefined();
        expect(model.update).toHaveBeenCalledTimes(1);
    });

    it('returns NOT_FOUND for a partner that does not exist', async () => {
        // Arrange
        const { service } = buildService({ findById: vi.fn(async () => null) });

        // Act
        const result = await service.reviewContent(adminActor, {
            id: PARTNER_ID,
            decision: 'approve'
        });

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('refuses an actor without PARTNER_MANAGE', async () => {
        // Arrange
        const { service, model } = buildService({
            findById: vi.fn(async () => makePartner()),
            update: vi.fn(async () => makePartner())
        });

        // Act
        const result = await service.reviewContent(outsiderActor, {
            id: PARTNER_ID,
            decision: 'approve'
        });

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(model.update).not.toHaveBeenCalled();
    });
});

describe('isPartnerContentApprovedForPayment — the AC-11 gate', () => {
    it('is false while no admin has ever approved the content', () => {
        expect(isPartnerContentApprovedForPayment({ contentApprovedAt: null })).toBe(false);
        expect(isPartnerContentApprovedForPayment({ contentApprovedAt: undefined })).toBe(false);
    });

    it('is true once the content has been approved', () => {
        expect(isPartnerContentApprovedForPayment({ contentApprovedAt: new Date() })).toBe(true);
    });

    it('stays true for a partner whose LATEST edit is back under review', () => {
        // Arrange — the live listing is still the approved one, so cutting off
        // billing here would punish the partner for keeping it current.
        const partner = makePartner({
            contentApprovedAt: new Date('2026-07-10T12:00:00Z'),
            contentReviewState: PartnerContentReviewStateEnum.PENDING
        });

        // Act + Assert
        expect(isPartnerContentApprovedForPayment(partner)).toBe(true);
    });
});

describe('PartnerService.create — a hand-created partner is payable immediately', () => {
    it('stamps contentApprovedAt so the admin workflow needs no review round-trip', async () => {
        // Arrange — content typed into the admin by someone holding
        // PARTNER_MANAGE has already passed the only review AC-11 asks for.
        // Without this stamp, every partner an admin creates by hand lands in a
        // review queue nobody put it in and cannot be charged.
        const { service, model } = buildService({
            create: vi.fn(async (data: Record<string, unknown>) => makePartner(data))
        });

        // Act
        const result = await service.create(adminActor, {
            slug: 'acme-turismo',
            name: 'Acme Turismo',
            type: PartnerTypeEnum.COMMERCE,
            tier: PartnerTierEnum.SILVER,
            subscriptionStatus: PartnerSubscriptionStatusEnum.PENDING,
            lifecycleState: LifecycleStatusEnum.DRAFT
        });

        // Assert
        expect(result.error).toBeUndefined();
        const createCall = (model.create as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(createCall, 'model.create was never called').toBeDefined();
        const written = createCall?.[0] as Record<string, unknown>;
        expect(written.contentApprovedAt).toBeInstanceOf(Date);
        expect(written.contentApprovedById).toBe(adminActor.id);
    });
});

describe('PartnerService.registerManualPayment — AC-11 gate', () => {
    it('refuses to activate a partner whose content was never approved', async () => {
        // Arrange — this path skips MercadoPago but still flips the partner to
        // ACTIVE, which is what actually publishes them.
        const { service, model } = buildService({
            findById: vi.fn(async () => makePartner({ contentApprovedAt: null })),
            update: vi.fn(async () => makePartner())
        });

        // Act + Assert
        await expect(service.registerManualPayment(adminActor, PARTNER_ID)).rejects.toThrow(
            /content has not been approved/i
        );
        expect(model.update).not.toHaveBeenCalled();
    });

    it('activates a partner whose content is approved', async () => {
        // Arrange
        const approved = makePartner({ contentApprovedAt: new Date('2026-07-10T12:00:00Z') });
        const { service, model } = buildService({
            findById: vi.fn(async () => approved),
            update: vi.fn(async () => ({
                ...approved,
                subscriptionStatus: PartnerSubscriptionStatusEnum.ACTIVE,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            }))
        });

        // Act
        const result = await service.registerManualPayment(adminActor, PARTNER_ID);

        // Assert
        expect(result.subscriptionStatus).toBe(PartnerSubscriptionStatusEnum.ACTIVE);
        expect(writtenPatch(model).lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
    });
});
