/**
 * @fileoverview
 * Unit tests for the partner payment-review surface (HOS-1299).
 *
 * The human half of the owner's decision (2026-09-09): the cron asks, this
 * decides. What has to hold:
 *
 * - `confirmed-paid` clears the flag and moves the confirmed period forward,
 *   and touches NOTHING that would take the partner down;
 * - `not-paid` archives them the way the expiry cron would — but never sets
 *   `revokedAt`, because that column earns a permanent 410 and a partner who
 *   stopped paying is a reversible outage;
 * - answering a question nobody asked is refused, or the clock would advance on
 *   a partner the system never doubted;
 * - an actor without PARTNER_MANAGE cannot answer at all.
 */

import type { PartnerModel } from '@repo/db';
import {
    LifecycleStatusEnum,
    PartnerPaymentReviewStateEnum,
    PartnerSubscriptionStatusEnum,
    PartnerTierEnum,
    PartnerTypeEnum,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { PARTNER_PAYMENT_REVIEW_AFTER_DAYS } from '../../../src/services/partner/partner.payment-review';
import { PartnerService } from '../../../src/services/partner/partner.service';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();

const PARTNER_ID = getMockId('attraction', 'partner-payment-review-1');

const adminActor = createActor({ permissions: [PermissionEnum.PARTNER_MANAGE] });
const outsiderActor = createActor({ permissions: [] });

/** An active partner the cron has already flagged. */
const makePartner = (overrides: Record<string, unknown> = {}) => ({
    id: PARTNER_ID,
    slug: 'acme-turismo',
    name: 'Acme Turismo',
    type: PartnerTypeEnum.COMMERCE,
    tier: PartnerTierEnum.SILVER,
    logoUrl: null,
    websiteUrl: null,
    description: null,
    subscriptionStatus: PartnerSubscriptionStatusEnum.ACTIVE,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    analytics: {},
    planId: null,
    subscriptionId: null,
    ownerUserId: getMockId('user', 'partner-owner-1'),
    startsAt: new Date('2026-01-15T00:00:00Z'),
    endsAt: null,
    pendingLogoUrl: null,
    pendingDescription: null,
    pendingWebsiteUrl: null,
    contentReviewState: null,
    contentReviewNote: null,
    contentApprovedAt: new Date('2026-01-10T00:00:00Z'),
    contentApprovedById: null,
    paymentReviewState: PartnerPaymentReviewStateEnum.PENDING_CONFIRMATION,
    paymentConfirmedThrough: null,
    revokedAt: null,
    revokedById: null,
    revokeReason: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
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

describe('PartnerService.reviewPayment — confirmed-paid', () => {
    it('clears the flag and moves the confirmed period forward', async () => {
        // Arrange
        const { service, model } = buildService({
            findById: vi.fn(async () => makePartner()),
            update: vi.fn(async () => makePartner({ paymentReviewState: null }))
        });
        const before = Date.now();

        // Act
        const result = await service.reviewPayment(adminActor, {
            id: PARTNER_ID,
            decision: 'confirmed-paid'
        });

        // Assert
        expect(result.error).toBeUndefined();
        const patch = writtenPatch(model);
        expect(patch.paymentReviewState).toBeNull();
        const confirmed = patch.paymentConfirmedThrough as Date;
        const windowMs = PARTNER_PAYMENT_REVIEW_AFTER_DAYS * 24 * 60 * 60 * 1000;
        expect(confirmed.getTime()).toBeGreaterThanOrEqual(before + windowMs);
        // Without the move, the very next tick re-asks about a partner an admin
        // just confirmed — the flag alone is not enough, because the cron reads
        // the clock, not the flag, to decide who is due.
        expect(confirmed.getTime()).toBeLessThan(Date.now() + windowMs + 5_000);
    });

    it('honours a confirmed-through date the admin typed', async () => {
        // Arrange
        const typed = new Date('2027-01-31T00:00:00Z');
        const { service, model } = buildService({
            findById: vi.fn(async () => makePartner()),
            update: vi.fn(async () => makePartner({ paymentReviewState: null }))
        });

        // Act
        await service.reviewPayment(adminActor, {
            id: PARTNER_ID,
            decision: 'confirmed-paid',
            confirmedThrough: typed
        });

        // Assert — an annual cash payment is exactly the case the default gets
        // wrong, and the operator is the only one who knows.
        expect(writtenPatch(model).paymentConfirmedThrough).toEqual(typed);
    });

    it('does not touch anything that would take the partner down', async () => {
        // Arrange
        const { service, model } = buildService({
            findById: vi.fn(async () => makePartner()),
            update: vi.fn(async () => makePartner({ paymentReviewState: null }))
        });

        // Act
        await service.reviewPayment(adminActor, {
            id: PARTNER_ID,
            decision: 'confirmed-paid'
        });

        // Assert — the confirming admin is saying "they are fine". A patch that
        // carried any of these would be the takedown wearing a confirmation's
        // clothes. Checked key by key, since `objectContaining` is blind to a
        // key that is present but should not be.
        const patch = writtenPatch(model);
        expect(patch).not.toHaveProperty('subscriptionStatus');
        expect(patch).not.toHaveProperty('lifecycleState');
        expect(patch).not.toHaveProperty('endsAt');
        expect(patch).not.toHaveProperty('revokedAt');
    });
});

describe('PartnerService.reviewPayment — not-paid', () => {
    it('archives the partner the way the expiry cron would', async () => {
        // Arrange
        const { service, model } = buildService({
            findById: vi.fn(async () => makePartner()),
            update: vi.fn(async () => makePartner({ paymentReviewState: null }))
        });

        // Act
        const result = await service.reviewPayment(adminActor, {
            id: PARTNER_ID,
            decision: 'not-paid'
        });

        // Assert
        expect(result.error).toBeUndefined();
        const patch = writtenPatch(model);
        expect(patch.subscriptionStatus).toBe(PartnerSubscriptionStatusEnum.CANCELLED);
        expect(patch.lifecycleState).toBe(LifecycleStatusEnum.ARCHIVED);
        expect(patch.paymentReviewState).toBeNull();
    });

    it('never sets revokedAt, so the partner earns a reversible 404 and not a 410', async () => {
        // Arrange
        const { service, model } = buildService({
            findById: vi.fn(async () => makePartner()),
            update: vi.fn(async () => makePartner({ paymentReviewState: null }))
        });

        // Act
        await service.reviewPayment(adminActor, { id: PARTNER_ID, decision: 'not-paid' });

        // Assert — `getPublicBySlug` answers 410 Gone off `revokedAt`, the one
        // irreversible answer, which tells a crawler to drop the URL for good.
        // Somebody who stopped paying may regularise and must come back with
        // their ranking; only a deliberate takedown earns the permanent answer.
        const patch = writtenPatch(model);
        expect(patch).not.toHaveProperty('revokedAt');
        expect(patch).not.toHaveProperty('revokedById');
        expect(patch).not.toHaveProperty('revokeReason');
    });
});

describe('PartnerService.reviewPayment — refusals', () => {
    it('refuses when nothing was asked about this partner', async () => {
        // Arrange
        const { service, model } = buildService({
            findById: vi.fn(async () => makePartner({ paymentReviewState: null })),
            update: vi.fn(async () => makePartner())
        });

        // Act
        const result = await service.reviewPayment(adminActor, {
            id: PARTNER_ID,
            decision: 'confirmed-paid'
        });

        // Assert — otherwise an admin could push the clock forward on a partner
        // the system never doubted, buying them a free window nobody reviewed.
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(model.update).not.toHaveBeenCalled();
    });

    it('refuses an actor without PARTNER_MANAGE', async () => {
        // Arrange
        const { service, model } = buildService({
            findById: vi.fn(async () => makePartner()),
            update: vi.fn(async () => makePartner())
        });

        // Act
        const result = await service.reviewPayment(outsiderActor, {
            id: PARTNER_ID,
            decision: 'not-paid'
        });

        // Assert
        expect(result.error).toBeDefined();
        expect(model.update).not.toHaveBeenCalled();
    });

    it('answers NOT_FOUND for a partner that does not exist', async () => {
        // Arrange
        const { service, model } = buildService({
            findById: vi.fn(async () => null),
            update: vi.fn(async () => makePartner())
        });

        // Act
        const result = await service.reviewPayment(adminActor, {
            id: PARTNER_ID,
            decision: 'confirmed-paid'
        });

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(model.update).not.toHaveBeenCalled();
    });
});
