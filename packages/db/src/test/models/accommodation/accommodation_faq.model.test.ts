import { LifecycleStatusEnum } from '@repo/types';
import type { AccommodationFaqId, AccommodationId, UserId } from '@repo/types/common/id.types';
import type {
    AccommodationFaqType,
    NewAccommodationFaqInputType,
    UpdateAccommodationFaqInputType
} from '@repo/types/entities/accommodation/accommodation.faq.types';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../../../../src/client';
import { AccommodationFaqModel } from '../../../../src/models/accommodation/accommodation_faq.model';
import { dbLogger } from '../../../../src/utils/logger';

vi.mock('../../../../src/utils/logger');
vi.mock('../../../../src/client');

const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    query: {}
};
(getDb as unknown as Mock).mockReturnValue(mockDb);

const baseFaq: AccommodationFaqType = {
    id: 'faq-uuid' as AccommodationFaqId,
    accommodationId: 'acc-uuid' as AccommodationId,
    question: '¿Cuál es el horario de check-in?',
    answer: 'El check-in es a partir de las 14:00.',
    category: 'horarios',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: undefined,
    createdById: 'user-uuid' as UserId,
    updatedById: 'user-uuid' as UserId,
    deletedById: undefined,
    adminInfo: undefined,
    lifecycleState: LifecycleStatusEnum.ACTIVE
};

describe('AccommodationFaqModel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getById', () => {
        it('returns faq if found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([{ ...baseFaq }]);
            const res = await AccommodationFaqModel.getById('faq-uuid');
            expect(res).toEqual(baseFaq);
        });
        it('returns undefined if not found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([]);
            const res = await AccommodationFaqModel.getById('not-exist');
            expect(res).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AccommodationFaqModel.getById('err')).rejects.toThrow(
                'Failed to get accommodation FAQ by id: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByAccommodation', () => {
        it('returns faqs array', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([{ ...baseFaq }]);
            const res = await AccommodationFaqModel.getByAccommodation('acc-uuid');
            expect(res).toEqual([baseFaq]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([]);
            const res = await AccommodationFaqModel.getByAccommodation('nope');
            expect(res).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AccommodationFaqModel.getByAccommodation('err')).rejects.toThrow(
                'Failed to get accommodation FAQs by accommodation: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('create', () => {
        it('returns created faq', async () => {
            mockDb.insert.mockReturnThis();
            mockDb.values.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ ...baseFaq }]);
            const input: NewAccommodationFaqInputType = {
                question: baseFaq.question,
                answer: baseFaq.answer,
                category: baseFaq.category,
                accommodationId: baseFaq.accommodationId,
                adminInfo: baseFaq.adminInfo,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            };
            const res = await AccommodationFaqModel.create(input);
            expect(res).toEqual(baseFaq);
        });
        it('throws if insert fails', async () => {
            mockDb.insert.mockReturnThis();
            mockDb.values.mockReturnThis();
            mockDb.returning.mockReturnValueOnce(undefined);
            const input: NewAccommodationFaqInputType = {
                question: baseFaq.question,
                answer: baseFaq.answer,
                category: baseFaq.category,
                accommodationId: baseFaq.accommodationId,
                adminInfo: baseFaq.adminInfo,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            };
            await expect(AccommodationFaqModel.create(input)).rejects.toThrow('Insert failed');
        });
        it('logs and throws on db error', async () => {
            mockDb.insert.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            const input: NewAccommodationFaqInputType = {
                question: baseFaq.question,
                answer: baseFaq.answer,
                category: baseFaq.category,
                accommodationId: baseFaq.accommodationId,
                adminInfo: baseFaq.adminInfo,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            };
            await expect(AccommodationFaqModel.create(input)).rejects.toThrow(
                'Failed to create accommodation FAQ: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('update', () => {
        it('returns updated faq', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ ...baseFaq, question: 'Nueva pregunta' }]);
            const input: UpdateAccommodationFaqInputType = { question: 'Nueva pregunta' };
            const res = await AccommodationFaqModel.update('faq-uuid', input);
            expect(res).toEqual({ ...baseFaq, question: 'Nueva pregunta' });
        });
        it('returns undefined if not found', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const input: UpdateAccommodationFaqInputType = { question: 'Nueva pregunta' };
            const res = await AccommodationFaqModel.update('not-exist', input);
            expect(res).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.update.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            const input: UpdateAccommodationFaqInputType = { question: 'Nueva pregunta' };
            await expect(AccommodationFaqModel.update('err', input)).rejects.toThrow(
                'Failed to update accommodation FAQ: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('delete', () => {
        it('returns deleted id', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ id: 'faq-uuid' }]);
            const res = await AccommodationFaqModel.delete('faq-uuid', 'user-uuid');
            expect(res).toEqual({ id: 'faq-uuid' });
        });
        it('returns undefined if not found', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const res = await AccommodationFaqModel.delete('not-exist', 'user-uuid');
            expect(res).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.update.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AccommodationFaqModel.delete('err', 'user-uuid')).rejects.toThrow(
                'Failed to delete accommodation FAQ: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('hardDelete', () => {
        it('returns true if deleted', async () => {
            mockDb.delete.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{}]);
            const res = await AccommodationFaqModel.hardDelete('faq-uuid');
            expect(res).toBe(true);
        });
        it('returns false if not found', async () => {
            mockDb.delete.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const res = await AccommodationFaqModel.hardDelete('not-exist');
            expect(res).toBe(false);
        });
        it('logs and throws on db error', async () => {
            mockDb.delete.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AccommodationFaqModel.hardDelete('err')).rejects.toThrow(
                'Failed to hard delete accommodation FAQ: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('list', () => {
        it('returns paginated faqs', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([{ ...baseFaq }]);
            const res = await AccommodationFaqModel.list({ limit: 10, offset: 0 });
            expect(res).toEqual([baseFaq]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([]);
            const res = await AccommodationFaqModel.list({ limit: 10, offset: 0 });
            expect(res).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AccommodationFaqModel.list({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to list accommodation FAQs: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('search', () => {
        it('returns found faqs', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([{ ...baseFaq }]);
            const res = await AccommodationFaqModel.search({ limit: 10, offset: 0 });
            expect(res).toEqual([baseFaq]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([]);
            const res = await AccommodationFaqModel.search({ limit: 10, offset: 0 });
            expect(res).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AccommodationFaqModel.search({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to search accommodation FAQs: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('count', () => {
        it('returns count', async () => {
            const whereMock = vi.fn().mockReturnValueOnce([{ count: 5 }]);
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnValue({ where: whereMock });
            const res = await AccommodationFaqModel.count({ limit: 10, offset: 0 });
            expect(res).toBe(5);
        });
        it('returns 0 if not found', async () => {
            const whereMock = vi.fn().mockReturnValueOnce([{}]);
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnValue({ where: whereMock });
            const res = await AccommodationFaqModel.count({ limit: 10, offset: 0 });
            expect(res).toBe(0);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AccommodationFaqModel.count({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to count accommodation FAQs: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });
});
