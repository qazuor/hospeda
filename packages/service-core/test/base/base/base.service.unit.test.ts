import { RoleEnum, ServiceErrorCode } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { BaseService } from '../../../src/base/base.service';
import { ServiceError } from '../../../src/types';
import { createLoggerMock } from '../../utils/modelMockFactory';

const ctx = { logger: createLoggerMock() };

class TestBaseService extends BaseService {
    constructor() {
        super(ctx, 'TestEntity');
    }
    // Expose protected for testing
    public getAndValidateEntity = this._getAndValidateEntity;
    public runWithValidation = this.runWithLoggingAndValidation;
    public getLogger() {
        return this.logger;
    }
}

describe('BaseService: runWithLoggingAndValidation', () => {
    let service: TestBaseService;
    beforeEach(() => {
        vi.clearAllMocks();
        service = new TestBaseService();
    });
    it('should return data on valid input', async () => {
        const schema = z.object({ foo: z.string() });
        const execute = vi.fn().mockResolvedValue('ok');
        const result = await service.runWithValidation({
            methodName: 'test',
            input: { actor: { id: '1', role: RoleEnum.USER, permissions: [] }, foo: 'bar' },
            schema,
            execute
        });
        expect(result.data).toBe('ok');
        expect(result.error).toBeUndefined();
        expect(execute).toHaveBeenCalled();
    });
    it('should return validation error on invalid input', async () => {
        const schema = z.object({ foo: z.string() });
        const execute = vi.fn();
        const result = await service.runWithValidation({
            methodName: 'test',
            input: { actor: { id: '1', role: RoleEnum.USER, permissions: [] }, foo: 123 },
            schema,
            execute
        });
        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(execute).not.toHaveBeenCalled();
    });
    it('should return internal error if execute throws', async () => {
        const schema = z.object({ foo: z.string() });
        const execute = vi.fn().mockRejectedValue(new Error('fail'));
        const result = await service.runWithValidation({
            methodName: 'test',
            input: { actor: { id: '1', role: RoleEnum.USER, permissions: [] }, foo: 'bar' },
            schema,
            execute
        });
        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });
});

describe('BaseService: _getAndValidateEntity', () => {
    let service: TestBaseService;
    beforeEach(() => {
        service = new TestBaseService();
    });
    it('should return entity if found and permission passes', async () => {
        const model = { findById: vi.fn().mockResolvedValue({ id: '1' }) };
        const permission = vi.fn();
        const entity = await service.getAndValidateEntity(
            model,
            '1',
            { id: 'a', role: RoleEnum.USER, permissions: [] },
            'TestEntity',
            permission
        );
        expect(entity).toEqual({ id: '1' });
        expect(permission).toHaveBeenCalled();
    });
    it('should throw if entity not found', async () => {
        const model = { findById: vi.fn().mockResolvedValue(null) };
        await expect(
            service.getAndValidateEntity(
                model,
                '1',
                { id: 'a', role: RoleEnum.USER, permissions: [] },
                'TestEntity'
            )
        ).rejects.toThrow(ServiceError);
    });
    it('should throw if permission check fails', async () => {
        const model = { findById: vi.fn().mockResolvedValue({ id: '1' }) };
        const permission = vi.fn().mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'forbidden');
        });
        await expect(
            service.getAndValidateEntity(
                model,
                '1',
                { id: 'a', role: RoleEnum.USER, permissions: [] },
                'TestEntity',
                permission
            )
        ).rejects.toThrow(ServiceError);
    });
});
