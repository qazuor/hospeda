/**
 * @file hierarchy-hooks.test.ts
 * @description Unit tests for DestinationService _beforeCreate and _beforeUpdate hooks.
 *   Tests hierarchy field computation (level, path, pathIds), parent validation,
 *   cycle detection, and descendant path updates during reparenting.
 */

import { DestinationModel } from '@repo/db';
import type { DestinationUpdateInput } from '@repo/schemas';
import { DestinationTypeEnum, PermissionEnum } from '@repo/schemas';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import * as destinationHelpers from '../../../src/services/destination/destination.helpers';
import { DestinationService } from '../../../src/services/destination/destination.service';
import type { ServiceLogger } from '../../../src/utils/service-logger';
import { createActor } from '../../factories/actorFactory';
import {
    DestinationFactoryBuilder,
    createMockDestinationCreateInput
} from '../../factories/destinationFactory';
import { getMockId } from '../../factories/utilsFactory';
import {
    expectNotFoundError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

const asMock = <T>(fn: T) => fn as unknown as Mock;

describe('DestinationService hierarchy hooks', () => {
    let service: DestinationService;
    let modelMock: DestinationModel;
    let loggerMock: ServiceLogger;
    const actor = createActor({
        permissions: [PermissionEnum.DESTINATION_CREATE, PermissionEnum.DESTINATION_UPDATE]
    });

    beforeEach(() => {
        modelMock = createTypedModelMock(DestinationModel, [
            'findChildren',
            'findDescendants',
            'findAncestors',
            'findByPath',
            'isDescendant',
            'updateDescendantPaths',
            'updateById'
        ]);
        loggerMock = createLoggerMock();
        service = createServiceTestInstance(DestinationService, modelMock, loggerMock);
        vi.spyOn(destinationHelpers, 'generateDestinationSlug').mockResolvedValue('mock-slug');
    });

    // ========================================================================
    // _beforeCreate
    // ========================================================================

    describe('_beforeCreate (via service.create)', () => {
        it('should set level=0, path=/slug, pathIds="" for root destination', async () => {
            // Arrange
            const params = createMockDestinationCreateInput({
                slug: 'argentina',
                name: 'Argentina',
                destinationType: DestinationTypeEnum.COUNTRY,
                parentDestinationId: null
            });
            asMock(modelMock.create).mockImplementation(async (data: Record<string, unknown>) => ({
                id: getMockId('destination', 'new'),
                ...data
            }));

            // Act
            const result = await service.create(actor, params);

            // Assert
            expectSuccess(result);
            const createCall = asMock(modelMock.create).mock.calls[0]?.[0] as Record<
                string,
                unknown
            >;
            expect(createCall.level).toBe(0);
            expect(createCall.path).toBe('/argentina');
            expect(createCall.pathIds).toBe('');
        });

        it('should compute hierarchy fields from parent destination', async () => {
            // Arrange
            const parentId = getMockId('destination', 'parent-country');
            const parent = new DestinationFactoryBuilder()
                .with({
                    id: parentId,
                    slug: 'argentina',
                    destinationType: DestinationTypeEnum.COUNTRY,
                    level: 0,
                    path: '/argentina',
                    pathIds: ''
                })
                .build();

            asMock(modelMock.findOne).mockResolvedValue(parent);
            asMock(modelMock.create).mockImplementation(async (data: Record<string, unknown>) => ({
                id: getMockId('destination', 'new-region'),
                ...data
            }));

            const params = createMockDestinationCreateInput({
                slug: 'litoral',
                name: 'Litoral',
                destinationType: DestinationTypeEnum.REGION,
                parentDestinationId: parentId
            });

            // Act
            const result = await service.create(actor, params);

            // Assert
            expectSuccess(result);
            const createCall = asMock(modelMock.create).mock.calls[0]?.[0] as Record<
                string,
                unknown
            >;
            expect(createCall.level).toBe(1);
            expect(createCall.path).toBe('/argentina/litoral');
            expect(createCall.pathIds).toBe(parentId);
        });

        it('should compute multi-level pathIds correctly', async () => {
            // Arrange
            const grandparentId = getMockId('destination', 'grandparent');
            const parentId = getMockId('destination', 'parent-region');
            const parent = new DestinationFactoryBuilder()
                .with({
                    id: parentId,
                    slug: 'litoral',
                    destinationType: DestinationTypeEnum.REGION,
                    level: 1,
                    path: '/argentina/litoral',
                    pathIds: grandparentId
                })
                .build();

            asMock(modelMock.findOne).mockResolvedValue(parent);
            asMock(modelMock.create).mockImplementation(async (data: Record<string, unknown>) => ({
                id: getMockId('destination', 'new-province'),
                ...data
            }));

            const params = createMockDestinationCreateInput({
                slug: 'entre-rios',
                name: 'Entre Rios',
                destinationType: DestinationTypeEnum.PROVINCE,
                parentDestinationId: parentId
            });

            // Act
            const result = await service.create(actor, params);

            // Assert
            expectSuccess(result);
            const createCall = asMock(modelMock.create).mock.calls[0]?.[0] as Record<
                string,
                unknown
            >;
            expect(createCall.level).toBe(2);
            expect(createCall.path).toBe('/argentina/litoral/entre-rios');
            expect(createCall.pathIds).toBe(`${grandparentId}/${parentId}`);
        });

        it('should return NOT_FOUND if parent destination does not exist', async () => {
            // Arrange
            const fakeParentId = getMockId('destination', 'nonexistent');
            asMock(modelMock.findOne).mockResolvedValue(null);

            const params = createMockDestinationCreateInput({
                slug: 'litoral',
                name: 'Litoral',
                destinationType: DestinationTypeEnum.REGION,
                parentDestinationId: fakeParentId
            });

            // Act
            const result = await service.create(actor, params);

            // Assert
            expectNotFoundError(result);
        });

        it('should return VALIDATION_ERROR for invalid parent-child type', async () => {
            // Arrange: COUNTRY cannot be child of CITY
            const parentId = getMockId('destination', 'city-parent');
            const parent = new DestinationFactoryBuilder()
                .with({
                    id: parentId,
                    destinationType: DestinationTypeEnum.CITY,
                    level: 4,
                    path: '/argentina/litoral/entre-rios/dept/city'
                })
                .build();

            asMock(modelMock.findOne).mockResolvedValue(parent);

            const params = createMockDestinationCreateInput({
                slug: 'region-under-city',
                name: 'Invalid Region',
                destinationType: DestinationTypeEnum.REGION,
                parentDestinationId: parentId
            });

            // Act
            const result = await service.create(actor, params);

            // Assert
            expectValidationError(result);
        });

        it('should validate parent-child adjacency: DEPARTMENT can parent CITY', async () => {
            // Arrange
            const parentId = getMockId('destination', 'dept-parent');
            const department = new DestinationFactoryBuilder()
                .with({
                    id: parentId,
                    slug: 'departamento-uruguay',
                    destinationType: DestinationTypeEnum.DEPARTMENT,
                    level: 3,
                    path: '/argentina/litoral/entre-rios/departamento-uruguay',
                    pathIds: 'id1/id2/id3'
                })
                .build();

            asMock(modelMock.findOne).mockResolvedValue(department);
            asMock(modelMock.create).mockImplementation(async (data: Record<string, unknown>) => ({
                id: getMockId('destination', 'new-city'),
                ...data
            }));

            const params = createMockDestinationCreateInput({
                slug: 'concepcion',
                name: 'Concepcion del Uruguay',
                destinationType: DestinationTypeEnum.CITY,
                parentDestinationId: parentId
            });

            // Act
            const result = await service.create(actor, params);

            // Assert
            expectSuccess(result);
            const createCall = asMock(modelMock.create).mock.calls[0]?.[0] as Record<
                string,
                unknown
            >;
            expect(createCall.level).toBe(4);
            expect(createCall.path).toBe(
                '/argentina/litoral/entre-rios/departamento-uruguay/concepcion'
            );
            expect(createCall.pathIds).toBe(`id1/id2/id3/${parentId}`);
        });
    });

    // ========================================================================
    // _beforeUpdate
    // ========================================================================

    describe('_beforeUpdate (via service.update)', () => {
        const updateActor = createActor({
            permissions: [PermissionEnum.DESTINATION_UPDATE]
        });

        it('should not modify hierarchy fields when no parent/slug change', async () => {
            // Arrange
            const destId = getMockId('destination', 'update-nochange');
            const current = new DestinationFactoryBuilder()
                .with({
                    id: destId,
                    slug: 'city',
                    destinationType: DestinationTypeEnum.CITY,
                    level: 4,
                    path: '/argentina/litoral/entre-rios/dept/city'
                })
                .build();

            asMock(modelMock.findById).mockResolvedValue(current);
            asMock(modelMock.update).mockImplementation(
                async (_id: string, data: Record<string, unknown>) => ({
                    ...current,
                    ...data
                })
            );

            const updateData: DestinationUpdateInput = {
                name: 'Updated Name'
            };

            // Act
            const result = await service.update(updateActor, destId, updateData);

            // Assert
            expectSuccess(result);
            // updateDescendantPaths should NOT be called
            expect(asMock(modelMock.updateDescendantPaths)).not.toHaveBeenCalled();
        });

        it('should recompute hierarchy fields when reparenting', async () => {
            // Arrange
            const destId = getMockId('destination', 'reparent');
            const newParentId = getMockId('destination', 'new-parent');
            const current = new DestinationFactoryBuilder()
                .with({
                    id: destId,
                    slug: 'entre-rios',
                    destinationType: DestinationTypeEnum.PROVINCE,
                    level: 2,
                    path: '/argentina/old-region/entre-rios',
                    pathIds: 'old-country-id/old-region-id',
                    parentDestinationId: getMockId('destination', 'old-parent')
                })
                .build();

            const newParent = new DestinationFactoryBuilder()
                .with({
                    id: newParentId,
                    slug: 'litoral',
                    destinationType: DestinationTypeEnum.REGION,
                    level: 1,
                    path: '/argentina/litoral',
                    pathIds: 'country-id'
                })
                .build();

            // findById for permission check, findOne for _beforeUpdate
            asMock(modelMock.findById).mockResolvedValue(current);
            asMock(modelMock.findOne).mockResolvedValue(null);
            // First findOne call is for current entity, second for new parent
            asMock(modelMock.findOne)
                .mockResolvedValueOnce(current) // lookup current
                .mockResolvedValueOnce(newParent); // lookup new parent
            asMock(modelMock.isDescendant).mockResolvedValue(false);
            asMock(modelMock.updateDescendantPaths).mockResolvedValue(undefined);
            asMock(modelMock.update).mockImplementation(
                async (_id: string, data: Record<string, unknown>) => ({
                    ...current,
                    ...data
                })
            );

            const updateData: DestinationUpdateInput = {
                parentDestinationId: newParentId
            };

            // Act
            const result = await service.update(updateActor, destId, updateData);

            // Assert
            expectSuccess(result);
            // Verify updateDescendantPaths was called (path changed)
            expect(asMock(modelMock.updateDescendantPaths)).toHaveBeenCalled();
        });

        it('should detect and reject circular hierarchy', async () => {
            // Arrange
            const destId = getMockId('destination', 'cycle-parent');
            const childId = getMockId('destination', 'cycle-child');
            const current = new DestinationFactoryBuilder()
                .with({
                    id: destId,
                    slug: 'province',
                    destinationType: DestinationTypeEnum.PROVINCE,
                    level: 2,
                    path: '/argentina/litoral/province',
                    parentDestinationId: getMockId('destination', 'region')
                })
                .build();

            asMock(modelMock.findById).mockResolvedValue(current);
            asMock(modelMock.findOne).mockResolvedValue(current);
            asMock(modelMock.isDescendant).mockResolvedValue(true); // would create cycle

            const updateData: DestinationUpdateInput = {
                parentDestinationId: childId
            };

            // Act
            const result = await service.update(updateActor, destId, updateData);

            // Assert
            expectValidationError(result);
        });

        it('should set top-level fields when moving to root (parentDestinationId=null)', async () => {
            // Arrange
            const destId = getMockId('destination', 'move-to-root');
            const current = new DestinationFactoryBuilder()
                .with({
                    id: destId,
                    slug: 'some-dest',
                    destinationType: DestinationTypeEnum.REGION,
                    level: 1,
                    path: '/argentina/some-dest',
                    pathIds: 'country-id',
                    parentDestinationId: getMockId('destination', 'old-parent')
                })
                .build();

            asMock(modelMock.findById).mockResolvedValue(current);
            asMock(modelMock.findOne).mockResolvedValue(current);
            asMock(modelMock.updateDescendantPaths).mockResolvedValue(undefined);
            asMock(modelMock.update).mockImplementation(
                async (_id: string, data: Record<string, unknown>) => ({
                    ...current,
                    ...data
                })
            );

            const updateData: DestinationUpdateInput = {
                parentDestinationId: null
            };

            // Act
            const result = await service.update(updateActor, destId, updateData);

            // Assert
            expectSuccess(result);
            const updateCall = asMock(modelMock.update).mock.calls[0]?.[1] as Record<
                string,
                unknown
            >;
            expect(updateCall.level).toBe(0);
            expect(updateCall.path).toBe('/some-dest');
            expect(updateCall.pathIds).toBe('');
        });

        it('should recompute path when only slug changes', async () => {
            // Arrange
            const parentId = getMockId('destination', 'slug-parent');
            const destId = getMockId('destination', 'slug-change');
            const parent = new DestinationFactoryBuilder()
                .with({
                    id: parentId,
                    slug: 'dept',
                    destinationType: DestinationTypeEnum.DEPARTMENT,
                    level: 3,
                    path: '/argentina/litoral/entre-rios/dept',
                    pathIds: 'id1/id2/id3'
                })
                .build();
            const current = new DestinationFactoryBuilder()
                .with({
                    id: destId,
                    slug: 'old-slug',
                    destinationType: DestinationTypeEnum.CITY,
                    level: 4,
                    path: '/argentina/litoral/entre-rios/dept/old-slug',
                    pathIds: 'id1/id2/id3/id4',
                    parentDestinationId: parentId
                })
                .build();

            asMock(modelMock.findById).mockResolvedValue(current);
            // _beforeUpdate: first findOne returns current, second returns parent
            // (since slug change with existing parent still enters the reparenting branch
            //  because newParentId = current.parentDestinationId which is non-null)
            asMock(modelMock.findOne)
                .mockResolvedValueOnce(current) // lookup current entity
                .mockResolvedValueOnce(parent); // lookup parent for path recompute
            asMock(modelMock.isDescendant).mockResolvedValue(false);
            asMock(modelMock.updateDescendantPaths).mockResolvedValue(undefined);
            asMock(modelMock.update).mockImplementation(
                async (_id: string, data: Record<string, unknown>) => ({
                    ...current,
                    ...data
                })
            );

            const updateData: DestinationUpdateInput = {
                slug: 'new-slug'
            };

            // Act
            const result = await service.update(updateActor, destId, updateData);

            // Assert
            expectSuccess(result);
            const updateCall = asMock(modelMock.update).mock.calls[0]?.[1] as Record<
                string,
                unknown
            >;
            expect(updateCall.path).toBe('/argentina/litoral/entre-rios/dept/new-slug');
            // updateDescendantPaths called because path changed
            expect(asMock(modelMock.updateDescendantPaths)).toHaveBeenCalledWith(
                destId,
                '/argentina/litoral/entre-rios/dept/old-slug',
                '/argentina/litoral/entre-rios/dept/new-slug'
            );
        });

        it('should return NOT_FOUND if new parent does not exist', async () => {
            // Arrange
            const destId = getMockId('destination', 'parent-missing');
            const fakeParentId = getMockId('destination', 'fake');
            const current = new DestinationFactoryBuilder()
                .with({
                    id: destId,
                    slug: 'dest',
                    destinationType: DestinationTypeEnum.PROVINCE,
                    level: 2,
                    path: '/argentina/litoral/dest',
                    parentDestinationId: getMockId('destination', 'old')
                })
                .build();

            asMock(modelMock.findById).mockResolvedValue(current);
            asMock(modelMock.findOne)
                .mockResolvedValueOnce(current) // lookup current
                .mockResolvedValueOnce(null); // lookup new parent - not found
            asMock(modelMock.isDescendant).mockResolvedValue(false);

            const updateData: DestinationUpdateInput = {
                parentDestinationId: fakeParentId
            };

            // Act
            const result = await service.update(updateActor, destId, updateData);

            // Assert
            expectNotFoundError(result);
        });
    });
});
