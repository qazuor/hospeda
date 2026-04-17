/**
 * Tests for actor validation failure path (SPEC-059 GAP-053).
 *
 * Verifies that calling a service method with a null/missing actor, or an actor
 * with an undefined id, produces a ServiceError with code UNAUTHORIZED — NOT
 * a generic INTERNAL_ERROR that would obscure the root cause.
 *
 * validateActor() in src/utils/validation.ts throws ServiceError(UNAUTHORIZED)
 * and runWithLoggingAndValidation re-returns it (or re-throws inside tx).
 * These tests confirm the code path is exercised end-to-end through the service.
 */

import type { BaseModel as BaseModelDB } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '../../src/types';
import { createServiceTestInstance } from '../helpers/serviceTestFactory';
import { createBaseModelMock } from '../utils/modelMockFactory';
import { asMock } from '../utils/test-utils';
import { type TestEntity, TestService } from './base/base.service.test.setup';

vi.mock('@repo/db', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/db')>();
    return {
        ...original,
        buildSearchCondition: vi.fn()
    };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BaseCrudService — actor validation (SPEC-059 GAP-053)', () => {
    let modelMock: BaseModelDB<TestEntity>;
    let service: TestService;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createBaseModelMock<TestEntity>();
        asMock(modelMock.findOne).mockResolvedValue(null);
        asMock(modelMock.findOneWithRelations).mockResolvedValue(null);
        service = createServiceTestInstance(TestService, modelMock);
    });

    it('returns UNAUTHORIZED (not INTERNAL_ERROR) when actor is null', async () => {
        // Arrange — pass null cast to Actor so TypeScript does not block the test
        const nullActor = null as unknown as Actor;

        // Act
        const result = await service.getById(nullActor, 'any-id');

        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.UNAUTHORIZED);
        expect(result.error?.code).not.toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('returns UNAUTHORIZED (not INTERNAL_ERROR) when actor.id is undefined', async () => {
        // Arrange — actor is an object but has no id
        const missingIdActor = { permissions: [], role: 'USER' } as unknown as Actor;

        // Act
        const result = await service.getById(missingIdActor, 'any-id');

        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.UNAUTHORIZED);
        expect(result.error?.code).not.toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('returns UNAUTHORIZED when actor.permissions is not an array', async () => {
        // Arrange — actor has id but permissions field is missing
        const badActor = { id: 'user-1', role: 'USER' } as unknown as Actor;

        // Act
        const result = await service.getById(badActor, 'any-id');

        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.UNAUTHORIZED);
    });

    it('does not call model methods when actor validation fails', async () => {
        // Arrange
        const nullActor = null as unknown as Actor;

        // Act
        await service.getById(nullActor, 'any-id');

        // Assert — model must not be touched at all
        expect(asMock(modelMock.findOne)).not.toHaveBeenCalled();
        expect(asMock(modelMock.findOneWithRelations)).not.toHaveBeenCalled();
    });
});
