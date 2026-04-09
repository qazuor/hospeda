import type { EventOrganizerModel } from '@repo/db';
import type { ServiceContext } from '@repo/service-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { EventOrganizerService } from '../../../src/services/eventOrganizer/eventOrganizer.service';
import { createActor } from '../../factories/actorFactory';
import { createMockEventOrganizer } from '../../factories/eventOrganizerFactory';
import type { StandardModelMock } from '../../utils/modelMockFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('EventOrganizerService.searchForList', () => {
    let service: EventOrganizerService;
    let model: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;

    beforeEach(() => {
        model = createModelMock(['findAll']);
        loggerMock = createLoggerMock();
        service = new EventOrganizerService(
            { logger: loggerMock } as unknown as ServiceContext,
            model as StandardModelMock as unknown as EventOrganizerModel
        );
        // EventOrganizer list is public — any actor suffices
        actor = createActor({ permissions: [] });
    });

    it('should return { items, total } on success', async () => {
        // Arrange
        const entity = createMockEventOrganizer();
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

    it('should forward page and pageSize to model.findAll', async () => {
        // Arrange
        asMock(model.findAll).mockResolvedValueOnce({ items: [], total: 0 });

        // Act
        await service.searchForList(actor, { page: 3, pageSize: 25 });

        // Assert
        const [, opts] = asMock(model.findAll).mock.calls[0] ?? [];
        expect(opts).toMatchObject({ page: 3, pageSize: 25 });
    });

    it('should forward sortBy and sortOrder to model.findAll', async () => {
        // Arrange
        asMock(model.findAll).mockResolvedValueOnce({ items: [], total: 0 });

        // Act
        await service.searchForList(actor, {
            page: 1,
            pageSize: 10,
            sortBy: 'name',
            sortOrder: 'desc'
        });

        // Assert
        const [, opts] = asMock(model.findAll).mock.calls[0] ?? [];
        expect(opts).toMatchObject({ sortBy: 'name', sortOrder: 'desc' });
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

    it('should pass name as additionalCondition (ilike on name column)', async () => {
        // Arrange
        asMock(model.findAll).mockResolvedValueOnce({ items: [], total: 0 });

        // Act
        await service.searchForList(actor, { page: 1, pageSize: 10, name: 'organizer name' });

        // Assert -- additionalConditions (3rd arg) should contain one ilike condition
        const [, , additionalConditions] = asMock(model.findAll).mock.calls[0] ?? [];
        expect(Array.isArray(additionalConditions)).toBe(true);
        expect((additionalConditions as unknown[]).length).toBeGreaterThan(0);
    });

    it('should pass q as additionalCondition (ilike on name column)', async () => {
        // Arrange
        asMock(model.findAll).mockResolvedValueOnce({ items: [], total: 0 });

        // Act
        await service.searchForList(actor, { page: 1, pageSize: 10, q: 'search term' });

        // Assert
        const [, , additionalConditions] = asMock(model.findAll).mock.calls[0] ?? [];
        expect(Array.isArray(additionalConditions)).toBe(true);
        expect((additionalConditions as unknown[]).length).toBeGreaterThan(0);
    });

    it('should produce additionalConditions for both name and q when both are given', async () => {
        // Arrange
        asMock(model.findAll).mockResolvedValueOnce({ items: [], total: 0 });

        // Act
        await service.searchForList(actor, { page: 1, pageSize: 10, name: 'Venue', q: 'fest' });

        // Assert -- both name and q each produce one condition
        const [, , additionalConditions] = asMock(model.findAll).mock.calls[0] ?? [];
        expect((additionalConditions as unknown[]).length).toBe(2);
    });

    it('should not add additionalConditions when neither name nor q is provided', async () => {
        // Arrange
        asMock(model.findAll).mockResolvedValueOnce({ items: [], total: 0 });

        // Act
        await service.searchForList(actor, { page: 1, pageSize: 10 });

        // Assert -- empty additionalConditions when no search params
        const [, , additionalConditions] = asMock(model.findAll).mock.calls[0] ?? [];
        expect((additionalConditions as unknown[]).length).toBe(0);
    });

    it('should still produce a condition when name contains percent wildcard', async () => {
        // Arrange -- safeIlike must escape % so it is treated as a literal
        asMock(model.findAll).mockResolvedValueOnce({ items: [], total: 0 });

        // Act
        await service.searchForList(actor, { page: 1, pageSize: 10, name: '50%off' });

        // Assert -- condition still produced (escaping does not cause undefined/null)
        const [, , additionalConditions] = asMock(model.findAll).mock.calls[0] ?? [];
        expect((additionalConditions as unknown[]).length).toBeGreaterThan(0);
    });

    it('should still produce a condition when q contains underscore wildcard', async () => {
        // Arrange
        asMock(model.findAll).mockResolvedValueOnce({ items: [], total: 0 });

        // Act
        await service.searchForList(actor, { page: 1, pageSize: 10, q: 'test_event' });

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

    it('should still produce conditions when name contains all three LIKE metacharacters', async () => {
        // Arrange -- safeIlike must escape %, _, and \ before passing to ilike()
        asMock(model.findAll).mockResolvedValueOnce({ items: [], total: 0 });

        // Act
        await service.searchForList(actor, { page: 1, pageSize: 10, name: '%50_off\\path' });

        // Assert -- condition produced (escaping does not swallow the term or cause undefined)
        const [, , additionalConditions] = asMock(model.findAll).mock.calls[0] ?? [];
        expect((additionalConditions as unknown[]).length).toBeGreaterThan(0);
    });
});
