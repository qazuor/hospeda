import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { MessageModel } from '../../src/models/conversation/message.model';
import * as logger from '../../src/utils/logger';

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('MessageModel', () => {
    let model: MessageModel;
    let getDb: ReturnType<typeof vi.fn>;
    let logQuery: ReturnType<typeof vi.fn>;
    let logError: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new MessageModel();
        logQuery = logger.logQuery as ReturnType<typeof vi.fn>;
        logError = logger.logError as ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
        getDb = vi.spyOn(dbUtils, 'getDb') as ReturnType<typeof vi.fn>;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getTableName', () => {
        it('should return the correct table name', () => {
            const tableName = (model as unknown as { getTableName: () => string }).getTableName();
            expect(tableName).toBe('messages');
        });
    });

    // ---------------------------------------------------------------------------
    // getLastMessagePreviews
    // ---------------------------------------------------------------------------

    describe('getLastMessagePreviews', () => {
        it('should return an empty Map without querying when ids array is empty', async () => {
            // Arrange — getDb should never be called
            getDb.mockReturnValue({});

            // Act
            const result = await model.getLastMessagePreviews([]);

            // Assert
            expect(result).toEqual(new Map());
            expect(getDb).not.toHaveBeenCalled();
            expect(logQuery).not.toHaveBeenCalled();
        });

        it('should return a Map of conversationId → body for each matching row', async () => {
            // Arrange
            const rows = [
                { conversationId: 'conv-1', body: 'Hello from conv 1' },
                { conversationId: 'conv-2', body: 'Hello from conv 2' }
            ];

            const orderByMock = vi.fn().mockResolvedValue(rows);
            const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
            const fromMock = vi.fn().mockReturnValue({ where: whereMock });
            const selectDistinctOnMock = vi.fn().mockReturnValue({ from: fromMock });

            getDb.mockReturnValue({ selectDistinctOn: selectDistinctOnMock });

            // Act
            const result = await model.getLastMessagePreviews(['conv-1', 'conv-2']);

            // Assert
            expect(result.size).toBe(2);
            expect(result.get('conv-1')).toBe('Hello from conv 1');
            expect(result.get('conv-2')).toBe('Hello from conv 2');
            expect(selectDistinctOnMock).toHaveBeenCalledOnce();
            expect(logQuery).toHaveBeenCalledWith(
                'messages',
                'getLastMessagePreviews',
                expect.any(Object),
                { count: 2 }
            );
        });

        it('should return an empty Map when no messages match', async () => {
            // Arrange
            const orderByMock = vi.fn().mockResolvedValue([]);
            const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
            const fromMock = vi.fn().mockReturnValue({ where: whereMock });
            const selectDistinctOnMock = vi.fn().mockReturnValue({ from: fromMock });

            getDb.mockReturnValue({ selectDistinctOn: selectDistinctOnMock });

            // Act
            const result = await model.getLastMessagePreviews(['conv-999']);

            // Assert
            expect(result).toEqual(new Map());
            expect(logQuery).toHaveBeenCalledWith(
                'messages',
                'getLastMessagePreviews',
                expect.any(Object),
                { count: 0 }
            );
        });

        it('should throw a DbError and log when the query fails', async () => {
            // Arrange
            const orderByMock = vi.fn().mockRejectedValue(new Error('db connection lost'));
            const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
            const fromMock = vi.fn().mockReturnValue({ where: whereMock });
            const selectDistinctOnMock = vi.fn().mockReturnValue({ from: fromMock });

            getDb.mockReturnValue({ selectDistinctOn: selectDistinctOnMock });

            // Act & Assert
            await expect(model.getLastMessagePreviews(['conv-1'])).rejects.toThrow(
                'db connection lost'
            );
            expect(logError).toHaveBeenCalledWith(
                'messages',
                'getLastMessagePreviews',
                expect.any(Object),
                expect.any(Error)
            );
        });
    });

    // ---------------------------------------------------------------------------
    // countUnreadForGuestByConversation
    // ---------------------------------------------------------------------------

    describe('countUnreadForGuestByConversation', () => {
        it('should return an empty Map without querying when ids array is empty', async () => {
            // Arrange — getDb should never be called
            getDb.mockReturnValue({});

            // Act
            const result = await model.countUnreadForGuestByConversation([]);

            // Assert
            expect(result).toEqual(new Map());
            expect(getDb).not.toHaveBeenCalled();
            expect(logQuery).not.toHaveBeenCalled();
        });

        it('should return a Map of conversationId → unread count from query rows', async () => {
            // Arrange
            const rows = [
                { conversationId: 'conv-1', total: 3 },
                { conversationId: 'conv-2', total: 0 }
            ];

            const groupByMock = vi.fn().mockResolvedValue(rows);
            const whereMock = vi.fn().mockReturnValue({ groupBy: groupByMock });
            const innerJoinMock = vi.fn().mockReturnValue({ where: whereMock });
            const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock });
            const selectMock = vi.fn().mockReturnValue({ from: fromMock });

            getDb.mockReturnValue({ select: selectMock });

            // Act
            const result = await model.countUnreadForGuestByConversation(['conv-1', 'conv-2']);

            // Assert
            expect(result.size).toBe(2);
            expect(result.get('conv-1')).toBe(3);
            expect(result.get('conv-2')).toBe(0);
            expect(selectMock).toHaveBeenCalledOnce();
            expect(logQuery).toHaveBeenCalledWith(
                'messages',
                'countUnreadForGuestByConversation',
                expect.any(Object),
                { count: 2 }
            );
        });

        it('should return an empty Map when no unread messages exist', async () => {
            // Arrange
            const groupByMock = vi.fn().mockResolvedValue([]);
            const whereMock = vi.fn().mockReturnValue({ groupBy: groupByMock });
            const innerJoinMock = vi.fn().mockReturnValue({ where: whereMock });
            const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock });
            const selectMock = vi.fn().mockReturnValue({ from: fromMock });

            getDb.mockReturnValue({ select: selectMock });

            // Act
            const result = await model.countUnreadForGuestByConversation(['conv-999']);

            // Assert
            expect(result).toEqual(new Map());
            expect(logQuery).toHaveBeenCalledWith(
                'messages',
                'countUnreadForGuestByConversation',
                expect.any(Object),
                { count: 0 }
            );
        });

        it('should coerce string totals from the DB to numbers', async () => {
            // Arrange — Postgres count() can return strings via some drivers
            const rows = [{ conversationId: 'conv-1', total: '5' }];

            const groupByMock = vi.fn().mockResolvedValue(rows);
            const whereMock = vi.fn().mockReturnValue({ groupBy: groupByMock });
            const innerJoinMock = vi.fn().mockReturnValue({ where: whereMock });
            const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock });
            const selectMock = vi.fn().mockReturnValue({ from: fromMock });

            getDb.mockReturnValue({ select: selectMock });

            // Act
            const result = await model.countUnreadForGuestByConversation(['conv-1']);

            // Assert
            expect(result.get('conv-1')).toBe(5);
            expect(typeof result.get('conv-1')).toBe('number');
        });

        it('should throw a DbError and log when the query fails', async () => {
            // Arrange
            const groupByMock = vi.fn().mockRejectedValue(new Error('timeout'));
            const whereMock = vi.fn().mockReturnValue({ groupBy: groupByMock });
            const innerJoinMock = vi.fn().mockReturnValue({ where: whereMock });
            const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock });
            const selectMock = vi.fn().mockReturnValue({ from: fromMock });

            getDb.mockReturnValue({ select: selectMock });

            // Act & Assert
            await expect(model.countUnreadForGuestByConversation(['conv-1'])).rejects.toThrow(
                'timeout'
            );
            expect(logError).toHaveBeenCalledWith(
                'messages',
                'countUnreadForGuestByConversation',
                expect.any(Object),
                expect.any(Error)
            );
        });
    });

    // ---------------------------------------------------------------------------
    // countUnreadForOwnerByConversation
    // ---------------------------------------------------------------------------

    describe('countUnreadForOwnerByConversation', () => {
        it('should return an empty Map without querying when ids array is empty', async () => {
            // Arrange — getDb should never be called
            getDb.mockReturnValue({});

            // Act
            const result = await model.countUnreadForOwnerByConversation([]);

            // Assert
            expect(result).toEqual(new Map());
            expect(getDb).not.toHaveBeenCalled();
            expect(logQuery).not.toHaveBeenCalled();
        });

        it('should return a Map of conversationId → unread count from query rows', async () => {
            // Arrange
            const rows = [
                { conversationId: 'conv-1', total: 2 },
                { conversationId: 'conv-2', total: 0 }
            ];

            const groupByMock = vi.fn().mockResolvedValue(rows);
            const whereMock = vi.fn().mockReturnValue({ groupBy: groupByMock });
            const innerJoinMock = vi.fn().mockReturnValue({ where: whereMock });
            const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock });
            const selectMock = vi.fn().mockReturnValue({ from: fromMock });

            getDb.mockReturnValue({ select: selectMock });

            // Act
            const result = await model.countUnreadForOwnerByConversation(['conv-1', 'conv-2']);

            // Assert
            expect(result.size).toBe(2);
            expect(result.get('conv-1')).toBe(2);
            expect(result.get('conv-2')).toBe(0);
            expect(selectMock).toHaveBeenCalledOnce();
            expect(logQuery).toHaveBeenCalledWith(
                'messages',
                'countUnreadForOwnerByConversation',
                expect.any(Object),
                { count: 2 }
            );
        });

        it('should return an empty Map when no unread messages exist', async () => {
            // Arrange
            const groupByMock = vi.fn().mockResolvedValue([]);
            const whereMock = vi.fn().mockReturnValue({ groupBy: groupByMock });
            const innerJoinMock = vi.fn().mockReturnValue({ where: whereMock });
            const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock });
            const selectMock = vi.fn().mockReturnValue({ from: fromMock });

            getDb.mockReturnValue({ select: selectMock });

            // Act
            const result = await model.countUnreadForOwnerByConversation(['conv-999']);

            // Assert
            expect(result).toEqual(new Map());
            expect(logQuery).toHaveBeenCalledWith(
                'messages',
                'countUnreadForOwnerByConversation',
                expect.any(Object),
                { count: 0 }
            );
        });

        it('should coerce string totals from the DB to numbers', async () => {
            // Arrange — Postgres count() can return strings via some drivers
            const rows = [{ conversationId: 'conv-1', total: '7' }];

            const groupByMock = vi.fn().mockResolvedValue(rows);
            const whereMock = vi.fn().mockReturnValue({ groupBy: groupByMock });
            const innerJoinMock = vi.fn().mockReturnValue({ where: whereMock });
            const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock });
            const selectMock = vi.fn().mockReturnValue({ from: fromMock });

            getDb.mockReturnValue({ select: selectMock });

            // Act
            const result = await model.countUnreadForOwnerByConversation(['conv-1']);

            // Assert
            expect(result.get('conv-1')).toBe(7);
            expect(typeof result.get('conv-1')).toBe('number');
        });

        it('should throw a DbError and log when the query fails', async () => {
            // Arrange
            const groupByMock = vi.fn().mockRejectedValue(new Error('connection refused'));
            const whereMock = vi.fn().mockReturnValue({ groupBy: groupByMock });
            const innerJoinMock = vi.fn().mockReturnValue({ where: whereMock });
            const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock });
            const selectMock = vi.fn().mockReturnValue({ from: fromMock });

            getDb.mockReturnValue({ select: selectMock });

            // Act & Assert
            await expect(model.countUnreadForOwnerByConversation(['conv-1'])).rejects.toThrow(
                'connection refused'
            );
            expect(logError).toHaveBeenCalledWith(
                'messages',
                'countUnreadForOwnerByConversation',
                expect.any(Object),
                expect.any(Error)
            );
        });
    });
});
