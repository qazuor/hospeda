/**
 * Tests for runWithLoggingAndValidation error-rethrow behavior.
 *
 * Verifies that:
 * - ServiceError is rethrown when ctx.tx is present (inside transaction)
 * - ServiceError is returned as { error } when ctx.tx is absent (backward compat)
 * - Unknown errors are wrapped and rethrown when ctx.tx is present
 * - Unknown errors are returned as { error } when ctx.tx is absent
 * - DbError is always rethrown regardless of tx presence
 */

import { RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { BaseService } from '../../src/base/base.service';
import type { Actor, ServiceContext } from '../../src/types';
import { ServiceError } from '../../src/types';
import { createLoggerMock } from '../utils/modelMockFactory';
import '../setupTest';

const loggerCtx = { logger: createLoggerMock() };

const validActor: Actor = {
    id: 'actor-1',
    role: RoleEnum.USER,
    permissions: []
};

const mockTx = {
    execute: vi.fn().mockResolvedValue(undefined)
};

const ctxWithTx: ServiceContext = { tx: mockTx as unknown as ServiceContext['tx'], hookState: {} };

/**
 * Concrete test service exposing runWithLoggingAndValidation for testing.
 */
class TestRethrowService extends BaseService {
    constructor() {
        super(loggerCtx, 'TestRethrowEntity');
    }

    /**
     * Executes runWithLoggingAndValidation with a controllable execute callback.
     */
    async doWork({
        actor,
        value,
        ctx,
        executeFn
    }: {
        actor: Actor;
        value: string;
        ctx?: ServiceContext;
        executeFn: () => Promise<unknown>;
    }) {
        return this.runWithLoggingAndValidation({
            methodName: 'doWork',
            input: { actor, value },
            schema: z.object({ value: z.string() }),
            ctx,
            execute: async (_validData, _actor, _execCtx) => {
                return executeFn();
            }
        });
    }
}

describe('BaseService: runWithLoggingAndValidation error-rethrow', () => {
    let service: TestRethrowService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new TestRethrowService();
    });

    it('should rethrow ServiceError when ctx.tx is present', async () => {
        const serviceError = new ServiceError(ServiceErrorCode.FORBIDDEN, 'forbidden action');

        await expect(
            service.doWork({
                actor: validActor,
                value: 'test',
                ctx: ctxWithTx,
                executeFn: async () => {
                    throw serviceError;
                }
            })
        ).rejects.toThrow(ServiceError);
    });

    it('should return { error } when ctx.tx is absent (backward compat)', async () => {
        const serviceError = new ServiceError(ServiceErrorCode.FORBIDDEN, 'forbidden action');

        const result = await service.doWork({
            actor: validActor,
            value: 'test',
            executeFn: async () => {
                throw serviceError;
            }
        });

        expect(result.error).toBeDefined();
        expect(result.error!.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should rethrow unknown errors wrapped as ServiceError when ctx.tx is present', async () => {
        await expect(
            service.doWork({
                actor: validActor,
                value: 'test',
                ctx: ctxWithTx,
                executeFn: async () => {
                    throw new TypeError('unexpected');
                }
            })
        ).rejects.toThrow();

        // Verify the thrown error is a ServiceError wrapping the original
        try {
            await service.doWork({
                actor: validActor,
                value: 'test',
                ctx: ctxWithTx,
                executeFn: async () => {
                    throw new TypeError('unexpected');
                }
            });
        } catch (error) {
            expect(error).toBeInstanceOf(ServiceError);
            expect((error as ServiceError).code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        }
    });

    it('should return { error } for unknown errors when no tx', async () => {
        const result = await service.doWork({
            actor: validActor,
            value: 'test',
            executeFn: async () => {
                throw new TypeError('unexpected');
            }
        });

        expect(result.error).toBeDefined();
        expect(result.error!.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should always rethrow DbError regardless of tx (with tx)', async () => {
        const dbError = Object.assign(new Error('db failure'), { name: 'DbError' });

        await expect(
            service.doWork({
                actor: validActor,
                value: 'test',
                ctx: ctxWithTx,
                executeFn: async () => {
                    throw dbError;
                }
            })
        ).rejects.toThrow();
    });

    it('should always rethrow DbError regardless of tx (without tx)', async () => {
        const dbError = Object.assign(new Error('db failure'), { name: 'DbError' });

        await expect(
            service.doWork({
                actor: validActor,
                value: 'test',
                executeFn: async () => {
                    throw dbError;
                }
            })
        ).rejects.toThrow();
    });
});
