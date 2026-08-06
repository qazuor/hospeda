/**
 * @fileoverview
 * Unit tests for partner revocation (HOS-278 R-4).
 *
 * R-4 is "approving stops being reversible for free — define the way back".
 * The rules that make this a way back rather than a deletion:
 * - the row SURVIVES, with an author and a reason;
 * - `lifecycleState` is the switch, never `subscriptionStatus`;
 * - re-revoking never rewrites the original audit trail;
 * - the owner is told, after the write and never blocking it.
 */

import type { PartnerModel } from '@repo/db';
import {
    LifecycleStatusEnum,
    PartnerSubscriptionStatusEnum,
    PartnerTierEnum,
    PartnerTypeEnum,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import type { PartnerRevokeNotifyPort } from '../../../src/services/partner/partner.service';
import { PartnerService } from '../../../src/services/partner/partner.service';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();
const PARTNER_ID = getMockId('attraction', 'partner-revoke-1');
const OWNER_ID = getMockId('user', 'partner-owner-9');

const adminActor = createActor({ permissions: [PermissionEnum.PARTNER_MANAGE] });
const outsiderActor = createActor({ permissions: [] });

const makePartner = (overrides: Record<string, unknown> = {}) => ({
    id: PARTNER_ID,
    slug: 'acme-turismo',
    name: 'Acme Turismo',
    type: PartnerTypeEnum.COMMERCE,
    tier: PartnerTierEnum.SILVER,
    logoUrl: null,
    websiteUrl: null,
    description: null,
    contactInfo: null,
    socialNetworks: null,
    subscriptionStatus: PartnerSubscriptionStatusEnum.ACTIVE,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    analytics: {},
    planId: null,
    subscriptionId: null,
    ownerUserId: OWNER_ID,
    startsAt: new Date('2026-07-01T00:00:00Z'),
    endsAt: null,
    pendingLogoUrl: null,
    pendingDescription: null,
    pendingWebsiteUrl: null,
    contentReviewState: null,
    contentReviewNote: null,
    contentApprovedAt: new Date('2026-07-01T00:00:00Z'),
    contentApprovedById: null,
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

function buildService(
    modelOverrides: Record<string, unknown> = {},
    revokeNotifier?: PartnerRevokeNotifyPort
) {
    const model = { ...createModelMock(), ...modelOverrides };
    const service = new PartnerService({
        logger: mockLogger,
        model: model as unknown as PartnerModel,
        revokeNotifier
    });
    return { service, model };
}

const writtenPatch = (model: Record<string, unknown>): Record<string, unknown> => {
    const call = (model.update as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call, 'model.update was never called').toBeDefined();
    return call?.[1] as Record<string, unknown>;
};

describe('PartnerService.revoke — the write', () => {
    it('records the author, the timestamp and the reason', async () => {
        // Arrange
        const { service, model } = buildService({
            findById: vi.fn(async () => makePartner()),
            update: vi.fn(async () => makePartner({ revokedAt: new Date() }))
        });

        // Act
        const result = await service.revoke(adminActor, {
            id: PARTNER_ID,
            reason: 'Incumplió el acuerdo de difusión.'
        });

        // Assert
        expect(result.error).toBeUndefined();
        const patch = writtenPatch(model);
        expect(patch.revokedAt).toBeInstanceOf(Date);
        expect(patch.revokedById).toBe(adminActor.id);
        expect(patch.revokeReason).toBe('Incumplió el acuerdo de difusión.');
    });

    it('hides the partner via lifecycleState, NOT via subscriptionStatus', async () => {
        // Arrange — writing `subscriptionStatus` here would conflate "we took
        // them down" with "they stopped paying", and the billing crons read
        // that column.
        const { service, model } = buildService({
            findById: vi.fn(async () => makePartner()),
            update: vi.fn(async () => makePartner())
        });

        // Act
        await service.revoke(adminActor, { id: PARTNER_ID, reason: 'x' });

        // Assert
        const patch = writtenPatch(model);
        expect(patch.lifecycleState).toBe(LifecycleStatusEnum.INACTIVE);
        expect(patch).not.toHaveProperty('subscriptionStatus');
    });

    it('KEEPS the row — never soft-deletes it', async () => {
        // Arrange — a soft-deleted row disappears from admin queries too, and
        // a revoked partner must stay in front of the admins who revoked it.
        const { service, model } = buildService({
            findById: vi.fn(async () => makePartner()),
            update: vi.fn(async () => makePartner())
        });

        // Act
        await service.revoke(adminActor, { id: PARTNER_ID, reason: 'x' });

        // Assert
        expect(writtenPatch(model)).not.toHaveProperty('deletedAt');
        expect(model.softDelete).not.toHaveBeenCalled();
    });
});

describe('PartnerService.revoke — guards', () => {
    it('refuses a revocation with no reason', async () => {
        // Arrange — the whole point of keeping the row is that "why is this
        // partner gone?" has an answer. A blank reason leaves the same gap
        // deleting would.
        const { service, model } = buildService({
            findById: vi.fn(async () => makePartner()),
            update: vi.fn(async () => makePartner())
        });

        // Act
        const result = await service.revoke(adminActor, { id: PARTNER_ID, reason: '' });

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(model.update).not.toHaveBeenCalled();
    });

    it('refuses a reason that is only whitespace', async () => {
        // Arrange
        const { service, model } = buildService({
            findById: vi.fn(async () => makePartner()),
            update: vi.fn(async () => makePartner())
        });

        // Act
        const result = await service.revoke(adminActor, { id: PARTNER_ID, reason: '   ' });

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(model.update).not.toHaveBeenCalled();
    });

    it('treats re-revoking as a no-op that never rewrites the audit trail', async () => {
        // Arrange — overwriting would replace the ORIGINAL reason and author
        // with whoever pressed the button second, quietly rewriting the record
        // this whole mechanism exists to keep.
        const firstRevoke = new Date('2026-07-20T10:00:00Z');
        const already = makePartner({
            revokedAt: firstRevoke,
            revokedById: getMockId('user', 'first-admin'),
            revokeReason: 'El motivo original.'
        });
        const { service, model } = buildService({
            findById: vi.fn(async () => already),
            update: vi.fn(async () => already)
        });

        // Act
        const result = await service.revoke(adminActor, {
            id: PARTNER_ID,
            reason: 'Un motivo distinto.'
        });

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.partner.revokeReason).toBe('El motivo original.');
        expect(model.update).not.toHaveBeenCalled();
    });

    it('returns NOT_FOUND for a partner that does not exist', async () => {
        // Arrange
        const { service } = buildService({ findById: vi.fn(async () => null) });

        // Act
        const result = await service.revoke(adminActor, { id: PARTNER_ID, reason: 'x' });

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
        const result = await service.revoke(outsiderActor, { id: PARTNER_ID, reason: 'x' });

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(model.update).not.toHaveBeenCalled();
    });
});

describe('PartnerService.revoke — notification', () => {
    it('tells the owner, after the row is already written', async () => {
        // Arrange
        const notifyRevoked = vi.fn(async () => undefined);
        const { service, model } = buildService(
            {
                findById: vi.fn(async () => makePartner()),
                update: vi.fn(async () => makePartner({ revokedAt: new Date() }))
            },
            { notifyRevoked }
        );

        // Act
        await service.revoke(adminActor, { id: PARTNER_ID, reason: 'El motivo.' });
        await new Promise((resolve) => setImmediate(resolve));

        // Assert
        expect(model.update).toHaveBeenCalled();
        expect(notifyRevoked).toHaveBeenCalledWith({
            partnerId: PARTNER_ID,
            ownerUserId: OWNER_ID,
            partnerName: 'Acme Turismo',
            reason: 'El motivo.'
        });
    });

    it('does not notify a partner nobody owns', async () => {
        // Arrange — curated partners created by hand in the admin belong to no
        // account, and so does one whose applicant never confirmed their email.
        const notifyRevoked = vi.fn(async () => undefined);
        const { service } = buildService(
            {
                findById: vi.fn(async () => makePartner({ ownerUserId: null })),
                update: vi.fn(async () => makePartner({ ownerUserId: null }))
            },
            { notifyRevoked }
        );

        // Act
        const result = await service.revoke(adminActor, { id: PARTNER_ID, reason: 'x' });
        await new Promise((resolve) => setImmediate(resolve));

        // Assert — the revocation still succeeds; only the notice is skipped.
        expect(result.error).toBeUndefined();
        expect(notifyRevoked).not.toHaveBeenCalled();
    });

    it('still revokes when the notifier throws', async () => {
        // Arrange — the revocation is the durable outcome; the email reports
        // it. A mail server having a bad afternoon must not surface as a
        // failed revocation the admin then retries.
        const notifyRevoked = vi.fn(async () => {
            throw new Error('transport down');
        });
        const { service, model } = buildService(
            {
                findById: vi.fn(async () => makePartner()),
                update: vi.fn(async () => makePartner({ revokedAt: new Date() }))
            },
            { notifyRevoked }
        );

        // Act
        const result = await service.revoke(adminActor, { id: PARTNER_ID, reason: 'x' });
        await new Promise((resolve) => setImmediate(resolve));

        // Assert
        expect(result.error).toBeUndefined();
        expect(model.update).toHaveBeenCalled();
    });

    it('returns WITHOUT waiting for the transport', async () => {
        // Arrange — a notifier that never settles. If `revoke` awaited it, this
        // test would hang until the suite timeout; the fact that it returns is
        // the assertion. The throwing-notifier test above does NOT cover this:
        // the `.catch()` swallows the rejection either way, so awaiting still
        // succeeds — it just succeeds LATE, holding an admin's UI open behind
        // a slow mail server. Verified by mutation: swapping `void` for
        // `await` leaves every other test in this file green.
        const notifyRevoked = vi.fn(() => new Promise<void>(() => undefined));
        const { service, model } = buildService(
            {
                findById: vi.fn(async () => makePartner()),
                update: vi.fn(async () => makePartner({ revokedAt: new Date() }))
            },
            { notifyRevoked }
        );

        // Act
        const result = await Promise.race([
            service.revoke(adminActor, { id: PARTNER_ID, reason: 'x' }),
            new Promise((resolve) => setTimeout(() => resolve('TIMED_OUT'), 500))
        ]);

        // Assert
        expect(result).not.toBe('TIMED_OUT');
        expect(model.update).toHaveBeenCalled();
        expect(notifyRevoked).toHaveBeenCalled();
    });

    it('revokes fine with no notifier injected at all', async () => {
        // Arrange — omitting the port silences the notice without changing the
        // revocation, which is what makes it safe to leave out in tests and
        // preview environments.
        const { service, model } = buildService({
            findById: vi.fn(async () => makePartner()),
            update: vi.fn(async () => makePartner({ revokedAt: new Date() }))
        });

        // Act
        const result = await service.revoke(adminActor, { id: PARTNER_ID, reason: 'x' });

        // Assert
        expect(result.error).toBeUndefined();
        expect(model.update).toHaveBeenCalled();
    });
});
