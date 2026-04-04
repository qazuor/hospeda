/**
 * @fileoverview
 * Test suite for the AccommodationService._canAdminList() override.
 * Covers:
 * - Rejection of actors without admin access (from base class)
 * - Rejection of actors with admin access but without ACCOMMODATION_VIEW_ALL
 * - Acceptance of actors with both admin access and ACCOMMODATION_VIEW_ALL
 * - Correct call order (super._canAdminList before checkCanAdminList)
 */
import type { AccommodationModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as accommodationPermissions from '../../../src/services/accommodation/accommodation.permissions';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import type { Actor } from '../../../src/types';
import { ServiceError } from '../../../src/types';
import { ActorFactoryBuilder } from '../../factories/actorFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

type CanAdminListAccessor = { _canAdminList: (actor: Actor) => void };

const mockLogger = createLoggerMock();

describe('AccommodationService._canAdminList()', () => {
    let service: AccommodationService;
    let model: ReturnType<typeof createModelMock>;

    beforeEach(() => {
        model = createModelMock();
        service = new AccommodationService(
            { logger: mockLogger },
            model as unknown as AccommodationModel
        );
        vi.restoreAllMocks();
    });

    it('rejects actor without admin access permissions', () => {
        const actor = new ActorFactoryBuilder()
            .withId('no-admin-1')
            .withPermissions([PermissionEnum.ACCOMMODATION_VIEW_ALL])
            .build();

        try {
            (service as unknown as CanAdminListAccessor)._canAdminList(actor);
            throw new Error('Should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(ServiceError);
            if (err instanceof ServiceError) {
                expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
                expect(err.message).toMatch('Admin access required for admin list operations');
            }
        }
    });

    it('rejects actor with admin access but without ACCOMMODATION_VIEW_ALL', () => {
        const actor = new ActorFactoryBuilder()
            .withId('admin-no-entity-1')
            .withPermissions([PermissionEnum.ACCESS_PANEL_ADMIN])
            .build();

        try {
            (service as unknown as CanAdminListAccessor)._canAdminList(actor);
            throw new Error('Should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(ServiceError);
            if (err instanceof ServiceError) {
                expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
                expect(err.message).toMatch('ACCOMMODATION_VIEW_ALL required for admin list');
            }
        }
    });

    it('allows actor with admin access AND ACCOMMODATION_VIEW_ALL', () => {
        const actor = new ActorFactoryBuilder()
            .withId('admin-with-entity-1')
            .withPermissions([
                PermissionEnum.ACCESS_PANEL_ADMIN,
                PermissionEnum.ACCOMMODATION_VIEW_ALL
            ])
            .build();

        expect(() => {
            (service as unknown as CanAdminListAccessor)._canAdminList(actor);
        }).not.toThrow();
    });

    it('calls super._canAdminList() before checkCanAdminList()', () => {
        const callOrder: string[] = [];

        const superSpy = vi
            .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(service)), '_canAdminList')
            .mockImplementation(() => {
                callOrder.push('super._canAdminList');
            });

        const checkSpy = vi
            .spyOn(accommodationPermissions, 'checkCanAdminList')
            .mockImplementation(() => {
                callOrder.push('checkCanAdminList');
            });

        const actor = new ActorFactoryBuilder()
            .withId('admin-1')
            .withPermissions([
                PermissionEnum.ACCESS_PANEL_ADMIN,
                PermissionEnum.ACCOMMODATION_VIEW_ALL
            ])
            .build();

        (service as unknown as CanAdminListAccessor)._canAdminList(actor);

        expect(callOrder).toEqual(['super._canAdminList', 'checkCanAdminList']);

        superSpy.mockRestore();
        checkSpy.mockRestore();
    });
});
