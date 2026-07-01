/**
 * Unit tests for AlertSubscriptionService (SPEC-286 T-004).
 *
 * Strategy:
 *   - Mock TouristPriceAlertModel via `createModelMock` (no real DB).
 *   - Mock AccommodationModel with a minimal `{ findById }` stub, mirroring
 *     the pattern used by `ownerPromotion.visibility.test.ts`.
 *   - Exercise the PUBLIC, native `BaseCrudService` API (`create`,
 *     `softDelete`, `list`) plus the additive `countActive()` wrapper — never
 *     protected methods directly, so the permission/hook pipeline is
 *     genuinely covered end to end.
 *
 * AAA pattern throughout. One behaviour per test.
 */

import type { AccommodationModel, TouristPriceAlertModel } from '@repo/db';
import type { PriceAlert } from '@repo/schemas';
import { PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AlertSubscriptionService } from '../../../src/services/alert/alert-subscription.service';
import { createActor, createAdminActor, createHostActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

// ---------------------------------------------------------------------------
// Shared IDs
// ---------------------------------------------------------------------------

const OWNER_ID = getMockId('user', 'price-alert-owner');
const OTHER_USER_ID = getMockId('user', 'price-alert-other-user');
const ACCOMMODATION_ID = getMockId('accommodation', 'price-alert-accommodation');
const ALERT_ID = getMockId('accommodation', 'price-alert-alert-id');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Minimal accommodation shape consumed by `_beforeCreate` — price.price is decimal pesos. */
function makeAccommodation(
    overrides: { price?: { price?: number; currency?: string } | null } = {}
) {
    return {
        id: ACCOMMODATION_ID,
        price:
            overrides.price === null ? null : { price: 20_000, currency: 'ARS', ...overrides.price }
    };
}

function makeAlert(overrides: Partial<PriceAlert> = {}): PriceAlert {
    return {
        id: ALERT_ID,
        userId: OWNER_ID,
        accommodationId: ACCOMMODATION_ID,
        basePriceSnapshot: 2_000_000,
        targetPercentDrop: 10,
        isActive: true,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        deletedAt: null,
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Suite setup
// ---------------------------------------------------------------------------

function makeService() {
    const modelMock = createModelMock();
    const accommodationModelMock = { findById: vi.fn() };
    const loggerMock = createLoggerMock();

    const service = new AlertSubscriptionService({
        logger: loggerMock,
        model: modelMock as unknown as TouristPriceAlertModel,
        accommodationModel: accommodationModelMock as unknown as AccommodationModel
    });

    return { service, modelMock, accommodationModelMock, loggerMock };
}

describe('AlertSubscriptionService.create', () => {
    it('creates a subscription with a basePriceSnapshot converted to centavos', async () => {
        // Arrange
        const { service, modelMock, accommodationModelMock } = makeService();
        const actor = createActor({ id: OWNER_ID });
        accommodationModelMock.findById.mockResolvedValue(makeAccommodation());
        modelMock.findOne.mockResolvedValue(null); // no existing subscription
        modelMock.create.mockResolvedValue(makeAlert());

        // Act
        const result = await service.create(actor, {
            accommodationId: ACCOMMODATION_ID,
            targetPercentDrop: 10
        });

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data).toMatchObject({ userId: OWNER_ID, basePriceSnapshot: 2_000_000 });
        const [payload] = modelMock.create.mock.calls[0] as [Record<string, unknown>];
        // 20_000 (decimal pesos) * 100 = 2_000_000 (integer centavos)
        expect(payload.basePriceSnapshot).toBe(2_000_000);
        expect(payload.userId).toBe(OWNER_ID);
        expect(payload.isActive).toBe(true);
    });

    it('defaults targetPercentDrop to null when omitted (any-drop alert)', async () => {
        // Arrange
        const { service, modelMock, accommodationModelMock } = makeService();
        const actor = createActor({ id: OWNER_ID });
        accommodationModelMock.findById.mockResolvedValue(makeAccommodation());
        modelMock.findOne.mockResolvedValue(null);
        modelMock.create.mockResolvedValue(makeAlert({ targetPercentDrop: null }));

        // Act
        await service.create(actor, { accommodationId: ACCOMMODATION_ID });

        // Assert
        const [payload] = modelMock.create.mock.calls[0] as [Record<string, unknown>];
        expect(payload.targetPercentDrop).toBeNull();
    });

    it('returns NOT_FOUND when the accommodation does not exist', async () => {
        // Arrange
        const { service, modelMock, accommodationModelMock } = makeService();
        const actor = createActor({ id: OWNER_ID });
        accommodationModelMock.findById.mockResolvedValue(null);

        // Act
        const result = await service.create(actor, { accommodationId: ACCOMMODATION_ID });

        // Assert
        expect(result.error?.code).toBe('NOT_FOUND');
        expect(modelMock.create).not.toHaveBeenCalled();
    });

    it('returns VALIDATION_ERROR when the accommodation has no price set', async () => {
        // Arrange
        const { service, modelMock, accommodationModelMock } = makeService();
        const actor = createActor({ id: OWNER_ID });
        accommodationModelMock.findById.mockResolvedValue(makeAccommodation({ price: null }));

        // Act
        const result = await service.create(actor, { accommodationId: ACCOMMODATION_ID });

        // Assert
        expect(result.error?.code).toBe('VALIDATION_ERROR');
        expect(modelMock.create).not.toHaveBeenCalled();
    });

    it('returns ALREADY_EXISTS when the actor already has an active alert for this accommodation', async () => {
        // Arrange
        const { service, modelMock, accommodationModelMock } = makeService();
        const actor = createActor({ id: OWNER_ID });
        accommodationModelMock.findById.mockResolvedValue(makeAccommodation());
        modelMock.findOne.mockResolvedValue(makeAlert());

        // Act
        const result = await service.create(actor, { accommodationId: ACCOMMODATION_ID });

        // Assert
        expect(result.error?.code).toBe('ALREADY_EXISTS');
        expect(modelMock.create).not.toHaveBeenCalled();
    });

    it('allows an owner (HOST role) actor to create an alert too (SPEC-216 owner-inherits-tourist)', async () => {
        // Arrange
        const { service, modelMock, accommodationModelMock } = makeService();
        const hostActor = createHostActor();
        accommodationModelMock.findById.mockResolvedValue(makeAccommodation());
        modelMock.findOne.mockResolvedValue(null);
        modelMock.create.mockResolvedValue(makeAlert({ userId: hostActor.id }));

        // Act
        const result = await service.create(hostActor, { accommodationId: ACCOMMODATION_ID });

        // Assert
        expect(result.error).toBeUndefined();
        const [payload] = modelMock.create.mock.calls[0] as [Record<string, unknown>];
        expect(payload.userId).toBe(hostActor.id);
    });
});

describe('AlertSubscriptionService.softDelete', () => {
    it('cancels the alert when the actor owns it', async () => {
        // Arrange
        const { service, modelMock } = makeService();
        const actor = createActor({ id: OWNER_ID });
        modelMock.findById.mockResolvedValue(makeAlert());
        modelMock.softDelete.mockResolvedValue(1);

        // Act
        const result = await service.softDelete(actor, ALERT_ID);

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data).toEqual({ count: 1 });
    });

    it('returns NOT_FOUND when the alert does not exist', async () => {
        // Arrange
        const { service, modelMock } = makeService();
        const actor = createActor({ id: OWNER_ID });
        modelMock.findById.mockResolvedValue(null);

        // Act
        const result = await service.softDelete(actor, ALERT_ID);

        // Assert
        expect(result.error?.code).toBe('NOT_FOUND');
        expect(modelMock.softDelete).not.toHaveBeenCalled();
    });

    it('returns FORBIDDEN when a non-owner, non-staff actor tries to cancel it', async () => {
        // Arrange
        const { service, modelMock } = makeService();
        const otherActor = createActor({ id: OTHER_USER_ID });
        modelMock.findById.mockResolvedValue(makeAlert());

        // Act
        const result = await service.softDelete(otherActor, ALERT_ID);

        // Assert
        expect(result.error?.code).toBe('FORBIDDEN');
        expect(modelMock.softDelete).not.toHaveBeenCalled();
    });

    it('allows a staff actor with ACCOMMODATION_VIEW_ALL to cancel someone else’s alert', async () => {
        // Arrange
        const { service, modelMock } = makeService();
        const staffActor = createAdminActor();
        expect(staffActor.permissions).toContain(PermissionEnum.ACCOMMODATION_VIEW_ALL);
        modelMock.findById.mockResolvedValue(makeAlert());
        modelMock.softDelete.mockResolvedValue(1);

        // Act
        const result = await service.softDelete(staffActor, ALERT_ID);

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data).toEqual({ count: 1 });
    });
});

describe('AlertSubscriptionService.list', () => {
    let service: AlertSubscriptionService;
    let modelMock: ReturnType<typeof createModelMock>;

    beforeEach(() => {
        ({ service, modelMock } = makeService());
    });

    it("returns only the actor's own alerts, forcing userId regardless of caller input", async () => {
        // Arrange
        const actor = createActor({ id: OWNER_ID });
        modelMock.findAllWithRelations.mockResolvedValue({
            items: [makeAlert()],
            total: 1
        });

        // Act — attacker attempts to inject another user's ID via `where`
        const result = await service.list(actor, {
            where: { userId: OTHER_USER_ID }
        });

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.items).toHaveLength(1);
        const [, whereClause] = modelMock.findAllWithRelations.mock.calls[0] as [
            unknown,
            Record<string, unknown>
        ];
        expect(whereClause.userId).toBe(OWNER_ID);
    });

    it('excludes soft-deleted alerts by default', async () => {
        // Arrange
        const actor = createActor({ id: OWNER_ID });
        asMock(modelMock.getTable).mockReturnValue({ deletedAt: {} });
        modelMock.findAllWithRelations.mockResolvedValue({ items: [], total: 0 });

        // Act
        await service.list(actor, {});

        // Assert
        const [, whereClause] = modelMock.findAllWithRelations.mock.calls[0] as [
            unknown,
            Record<string, unknown>
        ];
        expect(whereClause.deletedAt).toBeNull();
    });
});

describe('AlertSubscriptionService.countActive', () => {
    it("returns the actor's active subscription count", async () => {
        // Arrange
        const { service, modelMock } = makeService();
        const actor = createActor({ id: OWNER_ID });
        modelMock.count.mockResolvedValue(3);

        // Act
        const result = await service.countActive(actor);

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data).toEqual({ count: 3 });
        const [filter] = modelMock.count.mock.calls[0] as [Record<string, unknown>];
        expect(filter).toMatchObject({ userId: OWNER_ID, isActive: true, deletedAt: null });
    });

    it('forces userId to the calling actor even if a different userId is injected', async () => {
        // Arrange
        const { service, modelMock } = makeService();
        const actor = createActor({ id: OWNER_ID });
        modelMock.count.mockResolvedValue(0);

        // Act — count() is a native public method; a caller could pass an
        // arbitrary userId in params. _executeCount must ignore it.
        await service.count(actor, {
            userId: OTHER_USER_ID,
            isActive: true,
            page: 1,
            pageSize: 1
        });

        // Assert
        const [filter] = modelMock.count.mock.calls[0] as [Record<string, unknown>];
        expect(filter.userId).toBe(OWNER_ID);
    });

    it('returns 0 when the actor has no active subscriptions', async () => {
        // Arrange
        const { service, modelMock } = makeService();
        const actor = createActor({ id: OWNER_ID });
        modelMock.count.mockResolvedValue(0);

        // Act
        const result = await service.countActive(actor);

        // Assert
        expect(result.data).toEqual({ count: 0 });
    });
});

describe('AlertSubscriptionService — unsupported operations', () => {
    it('rejects update() — price alerts cannot be updated', async () => {
        // Arrange
        const { service, modelMock } = makeService();
        const actor = createActor({ id: OWNER_ID });
        modelMock.findById.mockResolvedValue(makeAlert());

        // Act
        const result = await service.update(actor, ALERT_ID, { targetPercentDrop: 20 });

        // Assert
        expect(result.error?.code).toBe('FORBIDDEN');
    });

    it('rejects hardDelete() — only soft-delete is supported', async () => {
        // Arrange
        const { service, modelMock } = makeService();
        const actor = createActor({ id: OWNER_ID });
        modelMock.findById.mockResolvedValue(makeAlert());

        // Act
        const result = await service.hardDelete(actor, ALERT_ID);

        // Assert
        expect(result.error?.code).toBe('FORBIDDEN');
    });

    it('rejects restore() — re-create instead', async () => {
        // Arrange
        const { service, modelMock } = makeService();
        const actor = createActor({ id: OWNER_ID });
        modelMock.findById.mockResolvedValue(makeAlert({ deletedAt: new Date() }));

        // Act
        const result = await service.restore(actor, ALERT_ID);

        // Assert
        expect(result.error?.code).toBe('FORBIDDEN');
    });

    it('rejects search() — use list() instead', async () => {
        // Arrange
        const { service } = makeService();
        const actor = createActor({ id: OWNER_ID });

        // Act
        const result = await service.search(actor, { page: 1, pageSize: 10 });

        // Assert
        expect(result.error?.code).toBe('FORBIDDEN');
    });
});
