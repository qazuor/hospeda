/**
 * @file search-by-destination.test.ts
 * @description Tests for EventService search/count with the destinationId filter.
 *
 * SPEC-089 Track B: destinationId is resolved via event_locations.destination_id.
 * The filter must not be forwarded as-is to model.findAll (no such column on events),
 * but must be resolved to location IDs first via a subquery on event_locations.
 */

import { EventModel } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock @repo/db to control getDb() calls made by _resolveLocationIdsForDestination
vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        getDb: vi.fn()
    };
});

import * as dbModule from '@repo/db';
import { EventService } from '../../../src/services/event/event.service';
import { createMockEvent } from '../../factories/eventFactory';
import { createUser } from '../../factories/userFactory';
import { expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

/** Helper to build a chainable Drizzle-like select mock. */
function buildSelectMock(resolvedRows: { id: string }[]) {
    const whereMock = vi.fn().mockResolvedValue(resolvedRows);
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });
    return { selectMock, fromMock, whereMock };
}

const DESTINATION_UUID = 'a1a1a1a1-a1a1-4a1a-aa1a-a1a1a1a1a1a1';
const LOCATION_UUID_A = 'b2b2b2b2-b2b2-4b2b-ab2b-b2b2b2b2b2b2';
const LOCATION_UUID_B = 'c3c3c3c3-c3c3-4c3c-ac3c-c3c3c3c3c3c3';

describe('EventService — destinationId filter (SPEC-089 Track B)', () => {
    let service: EventService;
    let modelMock: EventModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    const actor = createUser({ permissions: [PermissionEnum.EVENT_SOFT_DELETE_VIEW] });

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createTypedModelMock(EventModel, ['findAll', 'findAllWithRelations', 'count']);
        loggerMock = createLoggerMock();
        service = new EventService({ model: modelMock, logger: loggerMock });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // search (EventService.search → _executeSearch)
    // ─────────────────────────────────────────────────────────────────────────

    describe('search — destinationId filter', () => {
        it('should return matching events when destination has locations with events', async () => {
            // Arrange: destination has two locations
            const { selectMock } = buildSelectMock([
                { id: LOCATION_UUID_A },
                { id: LOCATION_UUID_B }
            ]);
            (dbModule.getDb as Mock).mockReturnValue({ select: selectMock });

            const mockEvents = [
                createMockEvent({ locationId: LOCATION_UUID_A }),
                createMockEvent({ locationId: LOCATION_UUID_B })
            ];
            (modelMock.findAllWithRelations as Mock).mockResolvedValue({
                items: mockEvents,
                total: 2
            });

            // Act
            const result = await service.search(actor, {
                destinationId: DESTINATION_UUID,
                page: 1,
                pageSize: 10
            });

            // Assert
            expectSuccess(result);
            expect(result.data?.items).toHaveLength(2);
            // findAllWithRelations must have been called — destinationId is NOT in the
            // filterParams. Signature: (relations, where, pagination, ...) → where is arg 1.
            expect(modelMock.findAllWithRelations).toHaveBeenCalledTimes(1);
            const findAllCall = (modelMock.findAllWithRelations as Mock).mock.calls[0] ?? [];
            const filterParams = findAllCall[1] as Record<string, unknown>;
            // destinationId must NOT appear in the filter object forwarded to the model
            expect(filterParams).not.toHaveProperty('destinationId');
        });

        it('should return empty result when destination has no event_locations', async () => {
            // Arrange: no locations for this destination
            const { selectMock } = buildSelectMock([]);
            (dbModule.getDb as Mock).mockReturnValue({ select: selectMock });

            // Act
            const result = await service.search(actor, {
                destinationId: DESTINATION_UUID,
                page: 1,
                pageSize: 10
            });

            // Assert: short-circuit — model.findAll must NOT be called
            expectSuccess(result);
            expect(result.data?.items).toHaveLength(0);
            expect(result.data?.total).toBe(0);
            expect(modelMock.findAll).not.toHaveBeenCalled();
        });

        it('should behave identically to normal search when no destinationId is provided', async () => {
            // Arrange: getDb must NOT be called when destinationId is absent
            const allEvents = [createMockEvent(), createMockEvent()];
            (modelMock.findAllWithRelations as Mock).mockResolvedValue({
                items: allEvents,
                total: 2
            });

            // Act
            const result = await service.search(actor, { page: 1, pageSize: 10 });

            // Assert
            expectSuccess(result);
            expect(result.data?.items).toHaveLength(2);
            // getDb should not have been called (no destinationId resolution needed)
            expect(dbModule.getDb).not.toHaveBeenCalled();
        });

        it('should not leak destinationId into the model WHERE clause', async () => {
            // Regression: ensure destinationId never reaches buildWhereClause which
            // would attempt to match against a non-existent column on the events table.
            const { selectMock } = buildSelectMock([{ id: LOCATION_UUID_A }]);
            (dbModule.getDb as Mock).mockReturnValue({ select: selectMock });
            (modelMock.findAllWithRelations as Mock).mockResolvedValue({ items: [], total: 0 });

            await service.search(actor, {
                destinationId: DESTINATION_UUID,
                page: 1,
                pageSize: 10
            });

            expect(modelMock.findAllWithRelations).toHaveBeenCalledTimes(1);
            const findAllCallReg = (modelMock.findAllWithRelations as Mock).mock.calls[0] ?? [];
            const filterParamsReg = findAllCallReg[1] as Record<string, unknown>;
            expect(filterParamsReg).not.toHaveProperty('destinationId');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // count (EventService.count → _executeCount)
    // ─────────────────────────────────────────────────────────────────────────

    describe('count — destinationId filter', () => {
        it('should return 0 when destination has no event_locations', async () => {
            const { selectMock } = buildSelectMock([]);
            (dbModule.getDb as Mock).mockReturnValue({ select: selectMock });

            const result = await service.count(actor, {
                destinationId: DESTINATION_UUID,
                page: 1,
                pageSize: 10
            });

            expectSuccess(result);
            expect(result.data?.count).toBe(0);
            expect(modelMock.count).not.toHaveBeenCalled();
        });

        it('should delegate to model.count with inArray condition when locations exist', async () => {
            const { selectMock } = buildSelectMock([{ id: LOCATION_UUID_A }]);
            (dbModule.getDb as Mock).mockReturnValue({ select: selectMock });
            (modelMock.count as Mock).mockResolvedValue(3);

            const result = await service.count(actor, {
                destinationId: DESTINATION_UUID,
                page: 1,
                pageSize: 10
            });

            expectSuccess(result);
            expect(result.data?.count).toBe(3);
            expect(modelMock.count).toHaveBeenCalledTimes(1);
            // The first argument must NOT contain destinationId
            const countCall = (modelMock.count as Mock).mock.calls[0] ?? [];
            const filterParamsCount = countCall[0] as Record<string, unknown>;
            expect(filterParamsCount).not.toHaveProperty('destinationId');
        });

        it('should not call getDb when destinationId is absent', async () => {
            (modelMock.count as Mock).mockResolvedValue(5);

            const result = await service.count(actor, { page: 1, pageSize: 10 });

            expectSuccess(result);
            expect(dbModule.getDb).not.toHaveBeenCalled();
        });
    });
});
