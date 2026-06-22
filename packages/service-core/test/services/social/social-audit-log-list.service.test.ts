/**
 * Unit tests for SocialAuditLogService.list — SPEC-254 T-037.
 *
 * Covers:
 * - FORBIDDEN when actor lacks SOCIAL_AUDIT_LOG_VIEW
 * - Happy path: returns items + total from model
 * - Equality filters: entityType, entityId, eventType, actorId forwarded in where clause
 * - Date-range filters: createdAtFrom/To produce SQL conditions (model called with conditions array)
 * - Pagination defaults: page=1, pageSize=20
 * - pageSize capped at 100
 * - sortBy=createdAt, sortOrder=desc always passed
 *
 * SPEC-254 T-037.
 */

import type { SocialAuditLogModel } from '@repo/db';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    type ListAuditLogsInput,
    SocialAuditLogService
} from '../../../src/services/social/social-audit-log.service';
import type { Actor } from '../../../src/types';
import { createModelMock } from '../../utils/modelMockFactory';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTOR_ID = '00000000-0000-4000-8000-000000000010';
const ENTITY_ID = '00000000-0000-4000-8000-000000000020';

// ---------------------------------------------------------------------------
// Actor fixtures
// ---------------------------------------------------------------------------

function buildActor(hasView: boolean): Actor {
    return {
        id: ACTOR_ID,
        role: RoleEnum.ADMIN,
        permissions: hasView ? [PermissionEnum.SOCIAL_AUDIT_LOG_VIEW] : []
    };
}

// ---------------------------------------------------------------------------
// Helper to build minimal input
// ---------------------------------------------------------------------------

function buildInput(overrides: Partial<ListAuditLogsInput> = {}): ListAuditLogsInput {
    return {
        actor: buildActor(true),
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('SocialAuditLogService.list — SPEC-254 T-037', () => {
    let modelMock: ReturnType<typeof createModelMock>;
    let service: SocialAuditLogService;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createModelMock();
        service = new SocialAuditLogService(
            { logger: undefined },
            modelMock as unknown as SocialAuditLogModel
        );
        // Default: return empty list
        modelMock.findAll.mockResolvedValue({ items: [], total: 0 });
    });

    // -------------------------------------------------------------------------
    // FORBIDDEN
    // -------------------------------------------------------------------------

    describe('FORBIDDEN', () => {
        it('returns FORBIDDEN when actor lacks SOCIAL_AUDIT_LOG_VIEW', async () => {
            // Arrange
            const input = buildInput({ actor: buildActor(false) });

            // Act
            const result = await service.list(input);

            // Assert
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(result.data).toBeUndefined();
            expect(modelMock.findAll).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // Happy path
    // -------------------------------------------------------------------------

    describe('happy path', () => {
        it('returns data with items and total from the model', async () => {
            // Arrange
            const fakeItems = [{ id: '1', eventType: 'POST_APPROVED' }];
            modelMock.findAll.mockResolvedValue({ items: fakeItems, total: 1 });

            // Act
            const result = await service.list(buildInput());

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.items).toHaveLength(1);
            expect(result.data?.total).toBe(1);
        });

        it('calls model.findAll with sortBy=createdAt and sortOrder=desc', async () => {
            // Arrange / Act
            await service.list(buildInput());

            // Assert
            const [, opts] = modelMock.findAll.mock.calls[0];
            expect(opts.sortBy).toBe('createdAt');
            expect(opts.sortOrder).toBe('desc');
        });
    });

    // -------------------------------------------------------------------------
    // Pagination defaults
    // -------------------------------------------------------------------------

    describe('pagination', () => {
        it('defaults to page=1 and pageSize=20 when not provided', async () => {
            // Arrange / Act
            await service.list(buildInput({ filters: {} }));

            // Assert
            const [, opts] = modelMock.findAll.mock.calls[0];
            expect(opts.page).toBe(1);
            expect(opts.pageSize).toBe(20);
        });

        it('caps pageSize at 100 even if caller passes 200', async () => {
            // Arrange / Act
            await service.list(buildInput({ filters: { pageSize: 200 } }));

            // Assert
            const [, opts] = modelMock.findAll.mock.calls[0];
            expect(opts.pageSize).toBe(100);
        });

        it('passes explicit page and pageSize through unchanged (within limits)', async () => {
            // Arrange / Act
            await service.list(buildInput({ filters: { page: 3, pageSize: 50 } }));

            // Assert
            const [, opts] = modelMock.findAll.mock.calls[0];
            expect(opts.page).toBe(3);
            expect(opts.pageSize).toBe(50);
        });
    });

    // -------------------------------------------------------------------------
    // Equality filters → where clause
    // -------------------------------------------------------------------------

    describe('equality filters', () => {
        it('forwards entityType to the where clause', async () => {
            // Arrange / Act
            await service.list(buildInput({ filters: { entityType: 'social_post' } }));

            // Assert
            const [where] = modelMock.findAll.mock.calls[0];
            expect(where.entityType).toBe('social_post');
        });

        it('forwards entityId to the where clause', async () => {
            // Arrange / Act
            await service.list(buildInput({ filters: { entityId: ENTITY_ID } }));

            // Assert
            const [where] = modelMock.findAll.mock.calls[0];
            expect(where.entityId).toBe(ENTITY_ID);
        });

        it('forwards eventType to the where clause', async () => {
            // Arrange / Act
            await service.list(buildInput({ filters: { eventType: 'POST_APPROVED' } }));

            // Assert
            const [where] = modelMock.findAll.mock.calls[0];
            expect(where.eventType).toBe('POST_APPROVED');
        });

        it('forwards actorId to the where clause', async () => {
            // Arrange / Act
            await service.list(buildInput({ filters: { actorId: ACTOR_ID } }));

            // Assert
            const [where] = modelMock.findAll.mock.calls[0];
            expect(where.actorId).toBe(ACTOR_ID);
        });

        it('omits keys not present in filters (no undefined keys in where)', async () => {
            // Arrange / Act
            await service.list(buildInput({ filters: {} }));

            // Assert
            const [where] = modelMock.findAll.mock.calls[0];
            expect(Object.keys(where)).toHaveLength(0);
        });
    });

    // -------------------------------------------------------------------------
    // Date-range filters → SQL conditions
    // -------------------------------------------------------------------------

    describe('date-range filters', () => {
        it('passes a non-empty conditions array when createdAtFrom is provided', async () => {
            // Arrange / Act
            await service.list(
                buildInput({
                    filters: { createdAtFrom: new Date('2025-01-01') }
                })
            );

            // Assert
            const [, , conditions] = modelMock.findAll.mock.calls[0];
            expect(Array.isArray(conditions)).toBe(true);
            expect(conditions).toHaveLength(1);
        });

        it('passes a non-empty conditions array when createdAtTo is provided', async () => {
            // Arrange / Act
            await service.list(
                buildInput({
                    filters: { createdAtTo: new Date('2025-12-31') }
                })
            );

            // Assert
            const [, , conditions] = modelMock.findAll.mock.calls[0];
            expect(Array.isArray(conditions)).toBe(true);
            expect(conditions).toHaveLength(1);
        });

        it('passes two conditions when both createdAtFrom and createdAtTo are set', async () => {
            // Arrange / Act
            await service.list(
                buildInput({
                    filters: {
                        createdAtFrom: new Date('2025-01-01'),
                        createdAtTo: new Date('2025-12-31')
                    }
                })
            );

            // Assert
            const [, , conditions] = modelMock.findAll.mock.calls[0];
            expect(conditions).toHaveLength(2);
        });

        it('passes undefined conditions when no date filters are provided', async () => {
            // Arrange / Act
            await service.list(buildInput({ filters: {} }));

            // Assert
            const [, , conditions] = modelMock.findAll.mock.calls[0];
            expect(conditions).toBeUndefined();
        });
    });
});
