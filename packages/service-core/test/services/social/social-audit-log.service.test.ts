/**
 * Unit tests for SocialAuditLogService.
 *
 * All DB interactions are mocked — no real Postgres calls.
 *
 * Covers:
 * - log() calls model.create with correctly mapped columns
 * - oldValue / newValue / metadata are forwarded as *Json columns
 * - actorId defaults to null when omitted
 * - actorId is forwarded when provided
 * - When model.create REJECTS, log() does NOT throw and returns { logged: false }
 * - When model.create RESOLVES, log() returns { logged: true }
 * - SocialAuditEvent contains the core constants (POST_APPROVED, POST_REJECTED,
 *   HASHTAG_PROMOTED, TARGET_PUBLISHED at minimum)
 *
 * SPEC-254 T-032.
 */

import type { SocialAuditLogModel } from '@repo/db';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    SocialAuditEvent,
    type SocialAuditLogInput,
    SocialAuditLogService
} from '../../../src/services/social/social-audit-log.service';
import { createModelMock } from '../../utils/modelMockFactory';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTOR_UUID = '00000000-0000-4000-8000-000000000001';
const ENTITY_UUID = '00000000-0000-4000-8000-000000000002';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMinimalInput(overrides: Partial<SocialAuditLogInput> = {}): SocialAuditLogInput {
    return {
        eventType: SocialAuditEvent.POST_APPROVED,
        entityType: 'social_post',
        entityId: ENTITY_UUID,
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('SocialAuditLogService', () => {
    let modelMock: ReturnType<typeof createModelMock>;
    let service: SocialAuditLogService;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createModelMock();
        service = new SocialAuditLogService({}, modelMock as unknown as SocialAuditLogModel);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // -------------------------------------------------------------------------
    // Success path
    // -------------------------------------------------------------------------

    describe('log() — success path', () => {
        it('should return { logged: true } when model.create resolves', async () => {
            // Arrange
            modelMock.create.mockResolvedValue({ id: 'row-uuid' });
            const input = buildMinimalInput();

            // Act
            const result = await service.log(input);

            // Assert
            expect(result).toEqual({ logged: true });
        });

        it('should call model.create exactly once per log() call', async () => {
            // Arrange
            modelMock.create.mockResolvedValue({ id: 'row-uuid' });
            const input = buildMinimalInput();

            // Act
            await service.log(input);

            // Assert
            expect(modelMock.create).toHaveBeenCalledTimes(1);
        });

        it('should map eventType, entityType, entityId directly to model.create', async () => {
            // Arrange
            modelMock.create.mockResolvedValue({ id: 'row-uuid' });
            const input = buildMinimalInput({
                eventType: SocialAuditEvent.POST_REJECTED,
                entityType: 'social_post',
                entityId: ENTITY_UUID
            });

            // Act
            await service.log(input);

            // Assert
            expect(modelMock.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    eventType: 'POST_REJECTED',
                    entityType: 'social_post',
                    entityId: ENTITY_UUID
                })
            );
        });

        it('should map oldValue → oldValueJson and newValue → newValueJson', async () => {
            // Arrange
            modelMock.create.mockResolvedValue({ id: 'row-uuid' });
            const oldValue = { status: 'NEEDS_REVIEW', approvalStatus: 'PENDING' };
            const newValue = { status: 'APPROVED', approvalStatus: 'APPROVED' };
            const input = buildMinimalInput({ oldValue, newValue });

            // Act
            await service.log(input);

            // Assert
            expect(modelMock.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    oldValueJson: oldValue,
                    newValueJson: newValue
                })
            );
        });

        it('should map metadata → metadataJson', async () => {
            // Arrange
            modelMock.create.mockResolvedValue({ id: 'row-uuid' });
            const metadata = { reason: 'Off-brand content', reviewedBy: 'admin-uuid' };
            const input = buildMinimalInput({ metadata });

            // Act
            await service.log(input);

            // Assert
            expect(modelMock.create).toHaveBeenCalledWith(
                expect.objectContaining({ metadataJson: metadata })
            );
        });

        it('should forward actorId when provided', async () => {
            // Arrange
            modelMock.create.mockResolvedValue({ id: 'row-uuid' });
            const input = buildMinimalInput({ actorId: ACTOR_UUID });

            // Act
            await service.log(input);

            // Assert
            expect(modelMock.create).toHaveBeenCalledWith(
                expect.objectContaining({ actorId: ACTOR_UUID })
            );
        });
    });

    // -------------------------------------------------------------------------
    // actorId defaulting
    // -------------------------------------------------------------------------

    describe('log() — actorId defaulting', () => {
        it('should default actorId to null when actorId is omitted', async () => {
            // Arrange
            modelMock.create.mockResolvedValue({ id: 'row-uuid' });
            const input = buildMinimalInput(); // no actorId

            // Act
            await service.log(input);

            // Assert
            expect(modelMock.create).toHaveBeenCalledWith(
                expect.objectContaining({ actorId: null })
            );
        });

        it('should default actorId to null when actorId is explicitly null', async () => {
            // Arrange
            modelMock.create.mockResolvedValue({ id: 'row-uuid' });
            const input = buildMinimalInput({ actorId: null });

            // Act
            await service.log(input);

            // Assert
            expect(modelMock.create).toHaveBeenCalledWith(
                expect.objectContaining({ actorId: null })
            );
        });
    });

    // -------------------------------------------------------------------------
    // Optional fields — null / undefined handling
    // -------------------------------------------------------------------------

    describe('log() — optional fields omitted', () => {
        it('should pass undefined for oldValueJson when oldValue is omitted', async () => {
            // Arrange
            modelMock.create.mockResolvedValue({ id: 'row-uuid' });
            const input = buildMinimalInput(); // no oldValue

            // Act
            await service.log(input);

            // Assert
            expect(modelMock.create).toHaveBeenCalledWith(
                expect.objectContaining({ oldValueJson: undefined })
            );
        });

        it('should pass undefined for newValueJson when newValue is omitted', async () => {
            // Arrange
            modelMock.create.mockResolvedValue({ id: 'row-uuid' });
            const input = buildMinimalInput(); // no newValue

            // Act
            await service.log(input);

            // Assert
            expect(modelMock.create).toHaveBeenCalledWith(
                expect.objectContaining({ newValueJson: undefined })
            );
        });

        it('should pass undefined for metadataJson when metadata is omitted', async () => {
            // Arrange
            modelMock.create.mockResolvedValue({ id: 'row-uuid' });
            const input = buildMinimalInput(); // no metadata

            // Act
            await service.log(input);

            // Assert
            expect(modelMock.create).toHaveBeenCalledWith(
                expect.objectContaining({ metadataJson: undefined })
            );
        });

        it('should pass undefined for oldValueJson when oldValue is explicitly null', async () => {
            // Arrange
            modelMock.create.mockResolvedValue({ id: 'row-uuid' });
            const input = buildMinimalInput({ oldValue: null });

            // Act
            await service.log(input);

            // Assert
            expect(modelMock.create).toHaveBeenCalledWith(
                expect.objectContaining({ oldValueJson: undefined })
            );
        });
    });

    // -------------------------------------------------------------------------
    // Error swallowing — critical behavior
    // -------------------------------------------------------------------------

    describe('log() — error swallowing', () => {
        it('should NOT throw when model.create rejects with a DB error', async () => {
            // Arrange
            modelMock.create.mockRejectedValue(new Error('connection timeout'));
            const input = buildMinimalInput();

            // Act & Assert — must not throw
            await expect(service.log(input)).resolves.not.toThrow();
        });

        it('should return { logged: false } when model.create rejects', async () => {
            // Arrange
            modelMock.create.mockRejectedValue(new Error('constraint violation'));
            const input = buildMinimalInput();

            // Act
            const result = await service.log(input);

            // Assert
            expect(result).toEqual({ logged: false });
        });

        it('should NOT throw when model.create rejects with a non-Error value', async () => {
            // Arrange
            modelMock.create.mockRejectedValue('some string error');
            const input = buildMinimalInput();

            // Act & Assert
            await expect(service.log(input)).resolves.toEqual({ logged: false });
        });

        it('should not propagate after DB failure — subsequent log() calls should still work', async () => {
            // Arrange
            modelMock.create
                .mockRejectedValueOnce(new Error('first call fails'))
                .mockResolvedValue({ id: 'row-uuid' });
            const input = buildMinimalInput();

            // Act
            const first = await service.log(input);
            const second = await service.log(input);

            // Assert
            expect(first).toEqual({ logged: false });
            expect(second).toEqual({ logged: true });
        });
    });

    // -------------------------------------------------------------------------
    // SocialAuditEvent constant shape
    // -------------------------------------------------------------------------

    describe('SocialAuditEvent constant', () => {
        it('should contain POST_APPROVED', () => {
            expect(SocialAuditEvent.POST_APPROVED).toBe('POST_APPROVED');
        });

        it('should contain POST_REJECTED', () => {
            expect(SocialAuditEvent.POST_REJECTED).toBe('POST_REJECTED');
        });

        it('should contain HASHTAG_PROMOTED', () => {
            expect(SocialAuditEvent.HASHTAG_PROMOTED).toBe('HASHTAG_PROMOTED');
        });

        it('should contain TARGET_PUBLISHED', () => {
            expect(SocialAuditEvent.TARGET_PUBLISHED).toBe('TARGET_PUBLISHED');
        });

        it('should contain POST_CHANGES_REQUESTED', () => {
            expect(SocialAuditEvent.POST_CHANGES_REQUESTED).toBe('POST_CHANGES_REQUESTED');
        });

        it('should contain POST_SCHEDULED', () => {
            expect(SocialAuditEvent.POST_SCHEDULED).toBe('POST_SCHEDULED');
        });

        it('should contain POST_RESCHEDULED', () => {
            expect(SocialAuditEvent.POST_RESCHEDULED).toBe('POST_RESCHEDULED');
        });

        it('should contain POST_MARKED_READY', () => {
            expect(SocialAuditEvent.POST_MARKED_READY).toBe('POST_MARKED_READY');
        });

        it('should contain POST_PAUSED', () => {
            expect(SocialAuditEvent.POST_PAUSED).toBe('POST_PAUSED');
        });

        it('should contain POST_UNPAUSED', () => {
            expect(SocialAuditEvent.POST_UNPAUSED).toBe('POST_UNPAUSED');
        });

        it('should contain POST_ARCHIVED', () => {
            expect(SocialAuditEvent.POST_ARCHIVED).toBe('POST_ARCHIVED');
        });

        it('should contain TARGET_DISPATCH_FAILED_EXHAUSTED', () => {
            expect(SocialAuditEvent.TARGET_DISPATCH_FAILED_EXHAUSTED).toBe(
                'TARGET_DISPATCH_FAILED_EXHAUSTED'
            );
        });

        it('should contain TARGET_PUBLISH_FAILED', () => {
            expect(SocialAuditEvent.TARGET_PUBLISH_FAILED).toBe('TARGET_PUBLISH_FAILED');
        });

        it('should contain SETTING_UPDATED', () => {
            expect(SocialAuditEvent.SETTING_UPDATED).toBe('SETTING_UPDATED');
        });

        it('should contain PLATFORM_FORMAT_UPDATED', () => {
            expect(SocialAuditEvent.PLATFORM_FORMAT_UPDATED).toBe('PLATFORM_FORMAT_UPDATED');
        });

        it('should be a frozen const object (values equal their keys)', () => {
            for (const [key, value] of Object.entries(SocialAuditEvent)) {
                expect(value).toBe(key);
            }
        });
    });
});
