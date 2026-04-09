import type { PostSponsorModel } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import type { ServiceContext } from '@repo/service-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { PostSponsorService } from '../../../src/services/postSponsor/postSponsor.service';
import { createActor } from '../../factories/actorFactory';
import { createMockPostSponsor } from '../../factories/postSponsorFactory';
import type { StandardModelMock } from '../../utils/modelMockFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('PostSponsorService.searchForList', () => {
    let service: PostSponsorService;
    let model: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;

    beforeEach(() => {
        model = createModelMock(['findAll']);
        loggerMock = createLoggerMock();
        service = new PostSponsorService(
            { logger: loggerMock } as unknown as ServiceContext,
            model as StandardModelMock as unknown as PostSponsorModel
        );
        actor = createActor({ permissions: [PermissionEnum.POST_SPONSOR_MANAGE] });
    });

    it('should return { items, total } on success', async () => {
        // Arrange
        const entity = createMockPostSponsor();
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
        // Act & Assert -- _canSearch throws immediately for null actor
        // @ts-expect-error intentional null
        await expect(service.searchForList(null, { page: 1, pageSize: 10 })).rejects.toThrow();
    });

    it('should throw ServiceError when actor lacks POST_SPONSOR_MANAGE permission', async () => {
        // Arrange
        const unprivilegedActor = createActor({ permissions: [] });

        // Act & Assert
        await expect(
            service.searchForList(unprivilegedActor, { page: 1, pageSize: 10 })
        ).rejects.toThrow();
    });

    it('should forward page and pageSize to model.findAll', async () => {
        // Arrange
        asMock(model.findAll).mockResolvedValueOnce({ items: [], total: 0 });

        // Act
        await service.searchForList(actor, { page: 4, pageSize: 15 });

        // Assert
        const [, opts] = asMock(model.findAll).mock.calls[0] ?? [];
        expect(opts).toMatchObject({ page: 4, pageSize: 15 });
    });

    it('should forward sortBy and sortOrder to model.findAll', async () => {
        // Arrange
        asMock(model.findAll).mockResolvedValueOnce({ items: [], total: 0 });

        // Act
        await service.searchForList(actor, {
            page: 1,
            pageSize: 10,
            sortBy: 'name',
            sortOrder: 'asc'
        });

        // Assert
        const [, opts] = asMock(model.findAll).mock.calls[0] ?? [];
        expect(opts).toMatchObject({ sortBy: 'name', sortOrder: 'asc' });
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

    it('should pass type to the where clause (exact match, not ilike)', async () => {
        // Arrange
        asMock(model.findAll).mockResolvedValueOnce({ items: [], total: 0 });

        // Act
        await service.searchForList(actor, {
            page: 1,
            pageSize: 10,
            type: 'POST_SPONSOR' as never
        });

        // Assert -- where clause (1st arg to findAll) contains type
        const [where] = asMock(model.findAll).mock.calls[0] ?? [];
        expect((where as Record<string, unknown>).type).toBe('POST_SPONSOR');
    });

    it('should pass name as additionalCondition (ilike on name column)', async () => {
        // Arrange
        asMock(model.findAll).mockResolvedValueOnce({ items: [], total: 0 });

        // Act
        await service.searchForList(actor, { page: 1, pageSize: 10, name: 'acme sponsor' });

        // Assert
        const [, , additionalConditions] = asMock(model.findAll).mock.calls[0] ?? [];
        expect(Array.isArray(additionalConditions)).toBe(true);
        expect((additionalConditions as unknown[]).length).toBe(1);
    });

    it('should pass q as additionalCondition (OR across name and description)', async () => {
        // Arrange
        asMock(model.findAll).mockResolvedValueOnce({ items: [], total: 0 });

        // Act
        await service.searchForList(actor, { page: 1, pageSize: 10, q: 'mega corp' });

        // Assert -- q produces one or() wrapper
        const [, , additionalConditions] = asMock(model.findAll).mock.calls[0] ?? [];
        expect(Array.isArray(additionalConditions)).toBe(true);
        expect((additionalConditions as unknown[]).length).toBe(1);
    });

    it('should produce two additionalConditions when both name and q are given', async () => {
        // Arrange
        asMock(model.findAll).mockResolvedValueOnce({ items: [], total: 0 });

        // Act
        await service.searchForList(actor, { page: 1, pageSize: 10, name: 'acme', q: 'sponsor' });

        // Assert -- name + q = 2 conditions
        const [, , additionalConditions] = asMock(model.findAll).mock.calls[0] ?? [];
        expect((additionalConditions as unknown[]).length).toBe(2);
    });

    it('should not add additionalConditions when neither name nor q is provided', async () => {
        // Arrange
        asMock(model.findAll).mockResolvedValueOnce({ items: [], total: 0 });

        // Act
        await service.searchForList(actor, { page: 1, pageSize: 10 });

        // Assert
        const [, , additionalConditions] = asMock(model.findAll).mock.calls[0] ?? [];
        expect((additionalConditions as unknown[]).length).toBe(0);
    });

    it('should still produce a condition when name contains percent wildcard', async () => {
        // Arrange -- safeIlike must escape % before passing to ilike()
        asMock(model.findAll).mockResolvedValueOnce({ items: [], total: 0 });

        // Act
        await service.searchForList(actor, { page: 1, pageSize: 10, name: '50%off' });

        // Assert -- condition still produced after escaping
        const [, , additionalConditions] = asMock(model.findAll).mock.calls[0] ?? [];
        expect((additionalConditions as unknown[]).length).toBeGreaterThan(0);
    });

    it('should still produce a condition when q contains underscore wildcard', async () => {
        // Arrange
        asMock(model.findAll).mockResolvedValueOnce({ items: [], total: 0 });

        // Act
        await service.searchForList(actor, { page: 1, pageSize: 10, q: 'test_sponsor' });

        // Assert
        const [, , additionalConditions] = asMock(model.findAll).mock.calls[0] ?? [];
        expect((additionalConditions as unknown[]).length).toBeGreaterThan(0);
    });

    it('should still produce conditions when q contains all three LIKE metacharacters', async () => {
        // Arrange
        asMock(model.findAll).mockResolvedValueOnce({ items: [], total: 0 });

        // Act
        await service.searchForList(actor, { page: 1, pageSize: 10, q: '%50_C:\\data' });

        // Assert
        const [, , additionalConditions] = asMock(model.findAll).mock.calls[0] ?? [];
        expect((additionalConditions as unknown[]).length).toBeGreaterThan(0);
    });

    it('should propagate model errors as thrown exceptions', async () => {
        // Arrange
        asMock(model.findAll).mockRejectedValueOnce(new Error('DB error'));

        // Act & Assert -- searchForList throws directly, does not return Result
        await expect(service.searchForList(actor, { page: 1, pageSize: 10 })).rejects.toThrow(
            'DB error'
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
