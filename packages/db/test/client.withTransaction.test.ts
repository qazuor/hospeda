import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setDb, withTransaction } from '../src/client';
import type { DrizzleClient } from '../src/types';
import { DbError, TransactionRollbackError } from '../src/utils/error';

/**
 * Helper to reset the internal runtimeClient to null between tests.
 * Uses the public setDb() API since ESM live bindings prevent direct mutation.
 * @ts-expect-error setDb accepts non-null type but null is valid for test teardown.
 */
const resetDbClient = () => setDb(null as unknown as DrizzleClient);

/**
 * Builds a minimal DrizzleClient mock with a controllable `transaction` spy.
 * The default implementation immediately invokes the callback with `mockTx`.
 *
 * @param mockTx - The transaction client passed to the callback
 * @returns Object with the mock db client and a reference to the transaction spy
 */
function buildMockDb(mockTx: DrizzleClient) {
    const transactionSpy = vi.fn(async (cb: (tx: DrizzleClient) => Promise<unknown>) => cb(mockTx));
    const mockDb = { transaction: transactionSpy } as unknown as DrizzleClient;
    return { mockDb, transactionSpy };
}

/**
 * Minimal mock used as the transaction client passed into callbacks.
 * It only needs to satisfy the DrizzleClient type shape for tests.
 */
const mockTx = { _isMockTx: true } as unknown as DrizzleClient;

describe('withTransaction', () => {
    beforeEach(() => {
        resetDbClient();
    });

    afterEach(() => {
        resetDbClient();
    });

    describe('success path', () => {
        it('should execute the callback and return its result', async () => {
            // Arrange
            const expectedResult = { id: 'abc-123', name: 'Test' };
            const { mockDb } = buildMockDb(mockTx);
            setDb(mockDb);

            // Act
            const result = await withTransaction(async (_tx) => expectedResult);

            // Assert
            expect(result).toEqual(expectedResult);
        });

        it('should pass the transaction client to the callback', async () => {
            // Arrange
            const { mockDb } = buildMockDb(mockTx);
            setDb(mockDb);
            let receivedTx: DrizzleClient | undefined;

            // Act
            await withTransaction(async (tx) => {
                receivedTx = tx;
                return null;
            });

            // Assert
            expect(receivedTx).toBe(mockTx);
        });
    });

    describe('when callback throws a generic Error', () => {
        it('should wrap it in DbError and rethrow', async () => {
            // Arrange
            const originalError = new Error('Something went wrong');
            const { mockDb } = buildMockDb(mockTx);
            setDb(mockDb);

            // Act & Assert
            await expect(
                withTransaction(async (_tx) => {
                    throw originalError;
                })
            ).rejects.toBeInstanceOf(DbError);
        });

        it('should include the original message in the DbError message', async () => {
            // Arrange
            const originalError = new Error('disk full');
            const { mockDb } = buildMockDb(mockTx);
            setDb(mockDb);

            // Act & Assert
            await expect(
                withTransaction(async (_tx) => {
                    throw originalError;
                })
            ).rejects.toThrow('disk full');
        });

        it('should set the original error as the cause', async () => {
            // Arrange
            const originalError = new Error('timeout');
            const { mockDb } = buildMockDb(mockTx);
            setDb(mockDb);

            // Act
            let caughtError: unknown;
            try {
                await withTransaction(async (_tx) => {
                    throw originalError;
                });
            } catch (err) {
                caughtError = err;
            }

            // Assert
            expect(caughtError).toBeInstanceOf(DbError);
            expect((caughtError as DbError).cause).toBe(originalError);
        });
    });

    describe('when callback throws TransactionRollbackError', () => {
        it('should rethrow it directly without wrapping', async () => {
            // Arrange
            const rollbackError = new TransactionRollbackError('User already exists');
            const { mockDb } = buildMockDb(mockTx);
            setDb(mockDb);

            // Act & Assert
            await expect(
                withTransaction(async (_tx) => {
                    throw rollbackError;
                })
            ).rejects.toThrow(rollbackError);
        });

        it('should not wrap the error — it must still be a TransactionRollbackError', async () => {
            // Arrange
            const rollbackError = new TransactionRollbackError('intentional abort');
            const { mockDb } = buildMockDb(mockTx);
            setDb(mockDb);

            // Act
            let caughtError: unknown;
            try {
                await withTransaction(async (_tx) => {
                    throw rollbackError;
                });
            } catch (err) {
                caughtError = err;
            }

            // Assert
            expect(caughtError).toBeInstanceOf(TransactionRollbackError);
            expect(caughtError).not.toBeInstanceOf(DbError);
            expect((caughtError as TransactionRollbackError).message).toBe('intentional abort');
        });
    });

    describe('when callback throws DbError', () => {
        it('should rethrow it directly without wrapping', async () => {
            // Arrange
            const dbError = new DbError('user', 'create', { email: 'x' }, 'duplicate key');
            const { mockDb } = buildMockDb(mockTx);
            setDb(mockDb);

            // Act & Assert
            await expect(
                withTransaction(async (_tx) => {
                    throw dbError;
                })
            ).rejects.toThrow(dbError);
        });

        it('should preserve original DbError properties — entity, method, params', async () => {
            // Arrange
            const dbError = new DbError('accommodation', 'update', { id: '1' }, 'not found');
            const { mockDb } = buildMockDb(mockTx);
            setDb(mockDb);

            // Act
            let caughtError: unknown;
            try {
                await withTransaction(async (_tx) => {
                    throw dbError;
                });
            } catch (err) {
                caughtError = err;
            }

            // Assert
            expect(caughtError).toBeInstanceOf(DbError);
            expect((caughtError as DbError).entity).toBe('accommodation');
            expect((caughtError as DbError).method).toBe('update');
            expect((caughtError as DbError).params).toEqual({ id: '1' });
        });
    });

    describe('when callback throws an unknown non-Error value', () => {
        it('should wrap a thrown string in DbError', async () => {
            // Arrange
            const { mockDb } = buildMockDb(mockTx);
            setDb(mockDb);

            // Act & Assert
            await expect(
                withTransaction(async (_tx) => {
                    throw 'plain string error';
                })
            ).rejects.toBeInstanceOf(DbError);
        });

        it('should include the string representation in the DbError message', async () => {
            // Arrange
            const { mockDb } = buildMockDb(mockTx);
            setDb(mockDb);

            // Act
            let caughtError: unknown;
            try {
                await withTransaction(async (_tx) => {
                    throw 'unexpected failure';
                });
            } catch (err) {
                caughtError = err;
            }

            // Assert
            expect(caughtError).toBeInstanceOf(DbError);
            expect((caughtError as DbError).message).toContain('unexpected failure');
        });

        it('should wrap a thrown plain object in DbError', async () => {
            // Arrange
            const { mockDb } = buildMockDb(mockTx);
            setDb(mockDb);

            // Act & Assert
            await expect(
                withTransaction(async (_tx) => {
                    throw { code: 'EPERM', detail: 'permission denied' };
                })
            ).rejects.toBeInstanceOf(DbError);
        });
    });

    describe('when existingTx is provided', () => {
        it('should invoke the callback with the provided existingTx', async () => {
            // Arrange
            const existingTx = { _isExistingTx: true } as unknown as DrizzleClient;
            let receivedTx: DrizzleClient | undefined;

            // Act
            await withTransaction(async (tx) => {
                receivedTx = tx;
                return null;
            }, existingTx);

            // Assert
            expect(receivedTx).toBe(existingTx);
        });

        it('should NOT call getDb() or start a new transaction when existingTx is provided', async () => {
            // Arrange
            const existingTx = { _isExistingTx: true } as unknown as DrizzleClient;
            // db is uninitialized — if getDb() is called it would throw
            resetDbClient();

            // Act & Assert — no throw means getDb() was never called
            await expect(withTransaction(async (_tx) => 'ok', existingTx)).resolves.toBe('ok');
        });

        it('should return the callback result when existingTx is provided', async () => {
            // Arrange
            const existingTx = { _isExistingTx: true } as unknown as DrizzleClient;
            const expectedValue = 42;

            // Act
            const result = await withTransaction(async (_tx) => expectedValue, existingTx);

            // Assert
            expect(result).toBe(expectedValue);
        });

        it('should propagate errors thrown by the callback when existingTx is provided', async () => {
            // Arrange
            const existingTx = { _isExistingTx: true } as unknown as DrizzleClient;
            const thrownError = new Error('callback failed');

            // Act & Assert
            await expect(
                withTransaction(async (_tx) => {
                    throw thrownError;
                }, existingTx)
            ).rejects.toThrow(thrownError);
        });
    });

    describe('when database is not initialized', () => {
        it('should throw if db is not initialized and no existingTx provided', async () => {
            // Arrange — db is reset in beforeEach

            // Act & Assert
            await expect(withTransaction(async (_tx) => 'result')).rejects.toThrow(
                'Database not initialized. Call initializeDb() before using database operations.'
            );
        });
    });
});
