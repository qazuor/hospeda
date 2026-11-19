/**
 * @fileoverview HOS-2368: soft delete and restore of a partner schedule the
 * edge purge (partner page + home carousel), like create and update already do.
 */

import type { PartnerModel } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PartnerService } from '../../../src/services/partner/partner.service';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const { mockSchedule } = vi.hoisted(() => ({ mockSchedule: vi.fn() }));

vi.mock('../../../src/revalidation/revalidation-init.js', () => ({
    getRevalidationService: () => ({ scheduleRevalidation: mockSchedule })
}));

const PARTNER_ID = getMockId('attraction', 'partner-lifecycle-1');
const admin = createActor({ permissions: [PermissionEnum.PARTNER_MANAGE] });

function buildService({ deletedAt, count }: { deletedAt: Date | null; count: number }) {
    const model = {
        ...createModelMock(),
        findById: vi.fn(async () => ({
            id: PARTNER_ID,
            slug: 'acme-turismo',
            deletedAt
        })),
        softDelete: vi.fn(async () => count),
        restore: vi.fn(async () => count)
    };
    const service = new PartnerService({
        logger: createLoggerMock(),
        model: model as unknown as PartnerModel
    });
    return service;
}

describe('PartnerService delete and restore revalidation (HOS-2368)', () => {
    beforeEach(() => {
        mockSchedule.mockReset();
    });

    it('schedules the partner purge with id and slug after a soft delete', async () => {
        // Arrange
        const service = buildService({ deletedAt: null, count: 1 });

        // Act
        const result = await service.softDelete(admin, PARTNER_ID);

        // Assert
        expect(result.error).toBeUndefined();
        expect(mockSchedule).toHaveBeenCalledTimes(1);
        expect(mockSchedule).toHaveBeenCalledWith({
            entityType: 'partner',
            id: PARTNER_ID,
            slug: 'acme-turismo'
        });
    });

    it('schedules the partner purge with id and slug after a restore', async () => {
        // Arrange
        const service = buildService({ deletedAt: new Date(), count: 1 });

        // Act
        const result = await service.restore(admin, PARTNER_ID);

        // Assert
        expect(result.error).toBeUndefined();
        expect(mockSchedule).toHaveBeenCalledTimes(1);
        expect(mockSchedule).toHaveBeenCalledWith({
            entityType: 'partner',
            id: PARTNER_ID,
            slug: 'acme-turismo'
        });
    });

    it('does not schedule a purge when no row changed', async () => {
        // Arrange
        const service = buildService({ deletedAt: null, count: 0 });

        // Act
        await service.softDelete(admin, PARTNER_ID);

        // Assert
        expect(mockSchedule).not.toHaveBeenCalled();
    });
});
