/**
 * Additional unit tests for SponsorshipLevelService
 *
 * Covers the uncovered permission hooks and operations:
 * - update: happy path / FORBIDDEN / INTERNAL_ERROR
 * - hardDelete: happy path / FORBIDDEN
 * - restore: happy path / FORBIDDEN
 * - count: happy path / FORBIDDEN
 * - search: happy path / FORBIDDEN
 * - _canUpdateVisibility: FORBIDDEN when insufficient permissions
 */

import type { SponsorshipLevelModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SponsorshipLevelService } from '../../../src/services/sponsorship/sponsorshipLevel.service';
import { createActor } from '../../factories/actorFactory';
import {
    createMockSponsorshipLevel,
    getMockSponsorshipLevelId
} from '../../factories/sponsorshipLevelFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

describe('SponsorshipLevelService — additional coverage', () => {
    let service: SponsorshipLevelService;
    let modelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;

    beforeEach(() => {
        modelMock = createModelMock();
        loggerMock = createLoggerMock();
        service = new SponsorshipLevelService({
            logger: loggerMock,
            model: modelMock as unknown as SponsorshipLevelModel
        });
        vi.clearAllMocks();
    });

    // ── update ──────────────────────────────────────────────────────────────

    describe('update()', () => {
        const existingLevel = createMockSponsorshipLevel({
            id: getMockSponsorshipLevelId('level-1')
        });

        it('should update a sponsorship level when actor has SPONSORSHIP_UPDATE', async () => {
            // Arrange
            const actor = createActor({
                permissions: [PermissionEnum.SPONSORSHIP_UPDATE, PermissionEnum.SPONSORSHIP_VIEW]
            });
            modelMock.findById.mockResolvedValue(existingLevel);
            modelMock.update.mockResolvedValue({ ...existingLevel, name: 'Updated Name' });

            // Act
            const result = await service.update(actor, getMockSponsorshipLevelId('level-1'), {
                name: 'Updated Name'
            });

            // Assert
            expect(result.error).toBeUndefined();
            expect(modelMock.update).toHaveBeenCalled();
        });

        it('should return FORBIDDEN when actor lacks SPONSORSHIP_UPDATE', async () => {
            // Arrange
            const actor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_VIEW] });
            modelMock.findById.mockResolvedValue(existingLevel);

            // Act
            const result = await service.update(actor, getMockSponsorshipLevelId('level-1'), {
                name: 'X'
            });

            // Assert
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });

        it('should return INTERNAL_ERROR when model.update throws', async () => {
            // Arrange
            const actor = createActor({
                permissions: [PermissionEnum.SPONSORSHIP_UPDATE, PermissionEnum.SPONSORSHIP_VIEW]
            });
            modelMock.findById.mockResolvedValue(existingLevel);
            modelMock.update.mockRejectedValue(new Error('DB error'));

            // Act
            const result = await service.update(actor, getMockSponsorshipLevelId('level-1'), {
                name: 'X'
            });

            // Assert
            expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        });
    });

    // ── hardDelete ──────────────────────────────────────────────────────────

    describe('hardDelete()', () => {
        const existingLevel = createMockSponsorshipLevel({
            id: getMockSponsorshipLevelId('level-2')
        });

        it('should hard-delete when actor has SPONSORSHIP_HARD_DELETE', async () => {
            // Arrange
            const actor = createActor({
                permissions: [
                    PermissionEnum.SPONSORSHIP_HARD_DELETE,
                    PermissionEnum.SPONSORSHIP_VIEW
                ]
            });
            modelMock.findById.mockResolvedValue(existingLevel);
            modelMock.hardDelete.mockResolvedValue(1);

            // Act
            const result = await service.hardDelete(actor, getMockSponsorshipLevelId('level-2'));

            // Assert
            expect(result.error).toBeUndefined();
            expect(modelMock.hardDelete).toHaveBeenCalled();
        });

        it('should return FORBIDDEN when actor lacks SPONSORSHIP_HARD_DELETE', async () => {
            // Arrange
            const actor = createActor({
                permissions: [PermissionEnum.SPONSORSHIP_DELETE, PermissionEnum.SPONSORSHIP_VIEW]
            });
            modelMock.findById.mockResolvedValue(existingLevel);

            // Act
            const result = await service.hardDelete(actor, getMockSponsorshipLevelId('level-2'));

            // Assert
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    // ── restore ─────────────────────────────────────────────────────────────

    describe('restore()', () => {
        const softDeletedLevel = createMockSponsorshipLevel({
            id: getMockSponsorshipLevelId('level-3'),
            deletedAt: new Date()
        });

        it('should restore when actor has SPONSORSHIP_RESTORE', async () => {
            // Arrange
            const actor = createActor({
                permissions: [PermissionEnum.SPONSORSHIP_RESTORE, PermissionEnum.SPONSORSHIP_VIEW]
            });
            modelMock.findById.mockResolvedValue(softDeletedLevel);
            modelMock.restore.mockResolvedValue(1);

            // Act
            const result = await service.restore(actor, getMockSponsorshipLevelId('level-3'));

            // Assert
            expect(result.error).toBeUndefined();
            expect(modelMock.restore).toHaveBeenCalled();
        });

        it('should return FORBIDDEN when actor lacks SPONSORSHIP_RESTORE', async () => {
            // Arrange
            const actor = createActor({
                permissions: [PermissionEnum.SPONSORSHIP_VIEW]
            });
            modelMock.findById.mockResolvedValue(softDeletedLevel);

            // Act
            const result = await service.restore(actor, getMockSponsorshipLevelId('level-3'));

            // Assert
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    // ── count ────────────────────────────────────────────────────────────────

    describe('count()', () => {
        it('should return count when actor has SPONSORSHIP_VIEW', async () => {
            // Arrange
            const actor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_VIEW] });
            modelMock.count.mockResolvedValue(7);

            // Act
            const result = await service.count(actor, { page: 1, pageSize: 20 });

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.count).toBe(7);
        });

        it('should return FORBIDDEN when actor lacks SPONSORSHIP_VIEW', async () => {
            // Arrange
            const actor = createActor({ permissions: [] });

            // Act
            const result = await service.count(actor, { page: 1, pageSize: 20 });

            // Assert
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    // ── search ───────────────────────────────────────────────────────────────

    describe('search()', () => {
        it('should return search results when actor has SPONSORSHIP_VIEW', async () => {
            // Arrange
            const actor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_VIEW] });
            const items = [createMockSponsorshipLevel({ id: getMockSponsorshipLevelId('s-1') })];
            modelMock.findAll.mockResolvedValue({ items, total: 1, page: 1, pageSize: 10 });

            // Act
            const result = await service.search(actor, { page: 1, pageSize: 20 });

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.items).toHaveLength(1);
        });

        it('should return FORBIDDEN when actor lacks SPONSORSHIP_VIEW', async () => {
            // Arrange
            const actor = createActor({ permissions: [] });

            // Act
            const result = await service.search(actor, { page: 1, pageSize: 20 });

            // Assert
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    // ── _canUpdateVisibility ─────────────────────────────────────────────────

    describe('updateVisibility()', () => {
        const existingLevel = createMockSponsorshipLevel({
            id: getMockSponsorshipLevelId('level-vis')
        });

        it('should return FORBIDDEN when actor lacks SPONSORSHIP_UPDATE for visibility change', async () => {
            // Arrange
            const actor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_VIEW] });
            modelMock.findById.mockResolvedValue(existingLevel);

            // Act
            const result = await service.updateVisibility(
                actor,
                getMockSponsorshipLevelId('level-vis'),
                'PUBLIC' as import('@repo/schemas').VisibilityEnum
            );

            // Assert
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });
});
