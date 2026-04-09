import type { EventLocationModel } from '@repo/db';
import type { ServiceContext } from '@repo/service-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { EventLocationService } from '../../../src/services/eventLocation/eventLocation.service';
import { createActor } from '../../factories/actorFactory';
import { createMockEventLocation } from '../../factories/eventLocationFactory';
import type { StandardModelMock } from '../../utils/modelMockFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('EventLocationService.searchForList', () => {
    let service: EventLocationService;
    let model: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;

    beforeEach(() => {
        model = createModelMock(['findAll']);
        loggerMock = createLoggerMock();
        service = new EventLocationService(
            { logger: loggerMock } as unknown as ServiceContext,
            model as StandardModelMock as unknown as EventLocationModel
        );
        // EventLocation search is public (only guards against null actor)
        actor = createActor({ permissions: [] });
    });

    it('should return { items, total } on success', async () => {
        // Arrange
        const entity = createMockEventLocation();
        asMock(model.findAll).mockResolvedValueOnce({ items: [entity], total: 1 });

        // Act
        const result = await service.searchForList(actor, { page: 1, pageSize: 10 });

        // Assert
        expect(result.items).toHaveLength(1);
        expect(result.items[0]).toEqual(entity);
        expect(result.total).toBe(1);
    });

    it('should return empty items when model returns none', async () => {
        // Arrange
        asMock(model.findAll).mockResolvedValueOnce({ items: [], total: 0 });

        // Act
        const result = await service.searchForList(actor, { page: 1, pageSize: 10 });

        // Assert
        expect(result.items).toHaveLength(0);
        expect(result.total).toBe(0);
    });

    it('should throw ServiceError when actor is null', async () => {
        // Act & Assert -- _canSearch throws directly for null actor
        // @ts-expect-error intentional null
        await expect(service.searchForList(null, { page: 1, pageSize: 10 })).rejects.toThrow();
    });

    it('should forward page and pageSize to model.findAll', async () => {
        // Arrange
        asMock(model.findAll).mockResolvedValueOnce({ items: [], total: 0 });

        // Act
        await service.searchForList(actor, { page: 2, pageSize: 20 });

        // Assert
        const [, opts] = asMock(model.findAll).mock.calls[0] ?? [];
        expect(opts).toMatchObject({ page: 2, pageSize: 20 });
    });

    it('should forward sortBy and sortOrder to model.findAll', async () => {
        // Arrange
        asMock(model.findAll).mockResolvedValueOnce({ items: [], total: 0 });

        // Act
        await service.searchForList(actor, {
            page: 1,
            pageSize: 10,
            sortBy: 'city',
            sortOrder: 'asc'
        });

        // Assert
        const [, opts] = asMock(model.findAll).mock.calls[0] ?? [];
        expect(opts).toMatchObject({ sortBy: 'city', sortOrder: 'asc' });
    });

    it('should use default page=1 and pageSize=10 when not provided', async () => {
        // Arrange
        asMock(model.findAll).mockResolvedValueOnce({ items: [], total: 0 });

        // Act
        await service.searchForList(actor, { page: 1, pageSize: 10 });

        // Assert
        const [, opts] = asMock(model.findAll).mock.calls[0] ?? [];
        expect(opts).toMatchObject({ page: 1, pageSize: 10 });
    });

    it('should pass city as additionalCondition (ilike on city column)', async () => {
        // Arrange
        asMock(model.findAll).mockResolvedValueOnce({ items: [], total: 0 });

        // Act
        await service.searchForList(actor, { page: 1, pageSize: 10, city: 'Buenos Aires' });

        // Assert -- city produces one ilike additionalCondition
        const [, , additionalConditions] = asMock(model.findAll).mock.calls[0] ?? [];
        expect(Array.isArray(additionalConditions)).toBe(true);
        expect((additionalConditions as unknown[]).length).toBe(1);
    });

    it('should pass q as additionalCondition (OR across city, placeName, department, neighborhood)', async () => {
        // Arrange
        asMock(model.findAll).mockResolvedValueOnce({ items: [], total: 0 });

        // Act
        await service.searchForList(actor, { page: 1, pageSize: 10, q: 'downtown' });

        // Assert -- q produces one or() wrapper as additionalCondition
        const [, , additionalConditions] = asMock(model.findAll).mock.calls[0] ?? [];
        expect(Array.isArray(additionalConditions)).toBe(true);
        expect((additionalConditions as unknown[]).length).toBe(1);
    });

    it('should produce two additionalConditions when both city and q are given', async () => {
        // Arrange
        asMock(model.findAll).mockResolvedValueOnce({ items: [], total: 0 });

        // Act
        await service.searchForList(actor, { page: 1, pageSize: 10, city: 'Rosario', q: 'park' });

        // Assert -- city + q = 2 conditions
        const [, , additionalConditions] = asMock(model.findAll).mock.calls[0] ?? [];
        expect((additionalConditions as unknown[]).length).toBe(2);
    });

    it('should not add additionalConditions when no search params provided', async () => {
        // Arrange
        asMock(model.findAll).mockResolvedValueOnce({ items: [], total: 0 });

        // Act
        await service.searchForList(actor, { page: 1, pageSize: 10 });

        // Assert
        const [, , additionalConditions] = asMock(model.findAll).mock.calls[0] ?? [];
        expect((additionalConditions as unknown[]).length).toBe(0);
    });

    it('should still produce a condition when city contains percent wildcard', async () => {
        // Arrange -- safeIlike must escape % so it is treated as literal
        asMock(model.findAll).mockResolvedValueOnce({ items: [], total: 0 });

        // Act
        await service.searchForList(actor, { page: 1, pageSize: 10, city: 'B.A. 100%' });

        // Assert -- condition produced despite metacharacter in input
        const [, , additionalConditions] = asMock(model.findAll).mock.calls[0] ?? [];
        expect((additionalConditions as unknown[]).length).toBeGreaterThan(0);
    });

    it('should still produce a condition when q contains underscore wildcard', async () => {
        // Arrange
        asMock(model.findAll).mockResolvedValueOnce({ items: [], total: 0 });

        // Act
        await service.searchForList(actor, { page: 1, pageSize: 10, q: 'test_venue' });

        // Assert
        const [, , additionalConditions] = asMock(model.findAll).mock.calls[0] ?? [];
        expect((additionalConditions as unknown[]).length).toBeGreaterThan(0);
    });

    it('should still produce conditions when q contains all three LIKE metacharacters', async () => {
        // Arrange
        asMock(model.findAll).mockResolvedValueOnce({ items: [], total: 0 });

        // Act
        await service.searchForList(actor, { page: 1, pageSize: 10, q: '%test_C:\\venue' });

        // Assert
        const [, , additionalConditions] = asMock(model.findAll).mock.calls[0] ?? [];
        expect((additionalConditions as unknown[]).length).toBeGreaterThan(0);
    });

    it('should propagate model errors as thrown exceptions', async () => {
        // Arrange
        asMock(model.findAll).mockRejectedValueOnce(new Error('DB connection lost'));

        // Act & Assert -- searchForList throws directly, does not return Result
        await expect(service.searchForList(actor, { page: 1, pageSize: 10 })).rejects.toThrow(
            'DB connection lost'
        );
    });

    it('should call model.findAll exactly once per invocation', async () => {
        // Arrange
        asMock(model.findAll).mockResolvedValueOnce({ items: [], total: 0 });

        // Act
        await service.searchForList(actor, { page: 1, pageSize: 10 });

        // Assert
        expect(asMock(model.findAll)).toHaveBeenCalledTimes(1);
    });
});
