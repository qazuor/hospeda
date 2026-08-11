/**
 * @fileoverview
 * Unit tests for the public partner detail lookup (HOS-294 D-6, T-006).
 *
 * The gate has THREE outcomes, not two, because the HTTP layer needs to tell a
 * page that went away from one that never existed (spec D-3b):
 *
 * - `found`    — gold, ACTIVE, active subscription.
 * - `gone`     — gold but failing visibility. It was published; it is not now.
 * - `notFound` — not gold, or no row at all. This URL was never served.
 *
 * Every failing-gate case below uses a row that EXISTS. A nonexistent slug
 * resolves to `notFound` before the gate is ever consulted, so testing the gate
 * with one would assert nothing about the gate.
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
import { PartnerService } from '../../../src/services/partner/partner.service';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();
const PARTNER_ID = getMockId('attraction', 'partner-public-1');
const SLUG = 'acme-litoral';

/**
 * An anonymous visitor: exactly what the public route resolves for a request
 * with no session. It holds `ACCESS_API_PUBLIC` and no PARTNER_* permission,
 * which is the same actor the public partner LIST already serves.
 */
const publicActor = createActor({ permissions: [PermissionEnum.ACCESS_API_PUBLIC] });

/** A partner that satisfies the gate. Overrides break one condition at a time. */
const makePartner = (overrides: Record<string, unknown> = {}) => ({
    id: PARTNER_ID,
    slug: SLUG,
    name: 'Acme Litoral',
    type: PartnerTypeEnum.COMMERCE,
    tier: PartnerTierEnum.GOLD,
    logoUrl: 'https://cdn.example.com/acme.png',
    description: 'Excursiones por el Litoral.',
    websiteUrl: 'https://acme.example.com',
    contactInfo: { workEmail: 'hola@acme.com' },
    socialNetworks: { instagram: 'https://instagram.com/acme' },
    subscriptionStatus: PartnerSubscriptionStatusEnum.ACTIVE,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    analytics: {},
    planId: null,
    subscriptionId: null,
    ownerUserId: null,
    startsAt: new Date(),
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

describe('PartnerService.getPublicBySlug — the gold gate (HOS-294 D-6)', () => {
    it('returns found for a gold partner that is ACTIVE and paying', async () => {
        // Arrange
        const { service } = buildService({ findOne: vi.fn(async () => makePartner()) });

        // Act
        const result = await service.getPublicBySlug(publicActor, { slug: SLUG });

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.outcome).toBe('found');
        if (result.data?.outcome === 'found') {
            expect(result.data.partner.slug).toBe(SLUG);
        }
    });

    it('serves an anonymous visitor, who holds no PARTNER_* permission', async () => {
        // Arrange — the ficha is public. Gating it on PARTNER_VIEW_ALL (what
        // checkCanView demands) would 403 every real visitor, which is why this
        // lookup uses the same public gate the partner LIST already uses.
        const { service } = buildService({ findOne: vi.fn(async () => makePartner()) });

        // Act
        const result = await service.getPublicBySlug(publicActor, { slug: SLUG });

        // Assert
        expect(publicActor.permissions).not.toContain(PermissionEnum.PARTNER_VIEW_ALL);
        expect(publicActor.permissions).not.toContain(PermissionEnum.PARTNER_MANAGE);
        expect(result.error).toBeUndefined();
        expect(result.data?.outcome).toBe('found');
    });

    it('rejects an actor without even public API access', async () => {
        // Arrange — the gate is a real gate, not decoration.
        const { service } = buildService({ findOne: vi.fn(async () => makePartner()) });
        const strangerActor = createActor({ permissions: [] });

        // Act
        const result = await service.getPublicBySlug(strangerActor, { slug: SLUG });

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    it('returns gone for an EXISTING gold partner whose lifecycle is not ACTIVE', async () => {
        // Arrange — a revoked partner. The row is right there; the page it used
        // to serve is what went away.
        const { service } = buildService({
            findOne: vi.fn(async () =>
                makePartner({ lifecycleState: LifecycleStatusEnum.INACTIVE })
            )
        });

        // Act
        const result = await service.getPublicBySlug(publicActor, { slug: SLUG });

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.outcome).toBe('gone');
    });

    it('returns gone for an EXISTING gold partner who stopped paying', async () => {
        // Arrange
        const { service } = buildService({
            findOne: vi.fn(async () =>
                makePartner({ subscriptionStatus: PartnerSubscriptionStatusEnum.PENDING })
            )
        });

        // Act
        const result = await service.getPublicBySlug(publicActor, { slug: SLUG });

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.outcome).toBe('gone');
    });

    it('returns notFound for an EXISTING silver partner in perfect standing', async () => {
        // Arrange — the row exists, is ACTIVE and is paying. Only the tier
        // separates it from the case above, and that is the whole product
        // decision: silver never had this URL, so it is a 404, not a 410.
        const { service } = buildService({
            findOne: vi.fn(async () => makePartner({ tier: PartnerTierEnum.SILVER }))
        });

        // Act
        const result = await service.getPublicBySlug(publicActor, { slug: SLUG });

        // Assert
        expect(result.data?.outcome).toBe('notFound');
    });

    it('returns notFound when no row matches the slug', async () => {
        // Arrange
        const { service } = buildService({ findOne: vi.fn(async () => null) });

        // Act
        const result = await service.getPublicBySlug(publicActor, { slug: 'nope' });

        // Assert
        expect(result.data?.outcome).toBe('notFound');
    });

    it('never serves a soft-deleted partner, even a gold one in good standing', async () => {
        // Arrange — defense in depth on a PUBLIC read. A soft-deleted row
        // reaching this path would be a leak, and the public surface is the
        // worst place to find out the model's filter regressed.
        const { service } = buildService({
            findOne: vi.fn(async () => makePartner({ deletedAt: new Date() }))
        });

        // Act
        const result = await service.getPublicBySlug(publicActor, { slug: SLUG });

        // Assert
        expect(result.data?.outcome).toBe('notFound');
    });

    it('looks the partner up by slug alone', async () => {
        // Arrange
        const { service, model } = buildService({ findOne: vi.fn(async () => makePartner()) });

        // Act
        await service.getPublicBySlug(publicActor, { slug: SLUG });

        // Assert
        expect(model.findOne).toHaveBeenCalledWith({ slug: SLUG }, undefined);
    });
});
