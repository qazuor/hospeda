import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { AccommodationModel } from '../../src/models/accommodation.model';
import type { schema } from '../../src/schemas';

vi.mock('../../src/client', () => ({
    getDb: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('findAllWithRelations - transaction propagation', () => {
    let model: AccommodationModel;
    let getDb: ReturnType<typeof vi.fn>;
    const mockTx = {} as NodePgDatabase<typeof schema>;

    beforeEach(() => {
        model = new AccommodationModel();
        getDb = dbUtils.getDb as ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
    });

    it('works without tx parameter (regression)', async () => {
        const mockFindMany = vi.fn().mockResolvedValue([{ id: '1' }]);
        const mockCount = vi.spyOn(model, 'count').mockResolvedValue(1);
        getDb.mockReturnValue({
            query: { accommodations: { findMany: mockFindMany } }
        });

        const result = await model.findAllWithRelations({ destination: true });
        expect(result.items).toHaveLength(1);
        mockCount.mockRestore();
    });

    it('forwards tx to getClient', async () => {
        const getClientSpy = vi.spyOn(model as any, 'getClient').mockReturnValue({
            query: { accommodations: { findMany: vi.fn().mockResolvedValue([]) } }
        });
        vi.spyOn(model, 'count').mockResolvedValue(0);

        await model.findAllWithRelations({ destination: true }, {}, {}, undefined, mockTx);
        expect(getClientSpy).toHaveBeenCalledWith(mockTx);
        getClientSpy.mockRestore();
    });

    it('forwards tx to count via options object', async () => {
        const getClientSpy = vi.spyOn(model as any, 'getClient').mockReturnValue({
            query: { accommodations: { findMany: vi.fn().mockResolvedValue([]) } }
        });
        const countSpy = vi.spyOn(model, 'count').mockResolvedValue(0);

        await model.findAllWithRelations({ destination: true }, {}, {}, undefined, mockTx);
        expect(countSpy).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ tx: mockTx })
        );
        getClientSpy.mockRestore();
        countSpy.mockRestore();
    });

    it('forwards tx to findAll when no relations', async () => {
        const findAllSpy = vi.spyOn(model, 'findAll').mockResolvedValue({
            items: [],
            total: 0
        });

        await model.findAllWithRelations({}, {}, {}, undefined, mockTx);
        expect(findAllSpy).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            undefined,
            mockTx
        );
        findAllSpy.mockRestore();
    });
});
