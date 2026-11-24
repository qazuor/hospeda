/**
 * HOS-2589: the tourist-facing owner-promotion reads. The SQL itself is exercised
 * against a real database by the staging smoke; these tests pin the in-process
 * logic over the rows a query returns: the search-badge merge of targeted and
 * owner-wide promotions (D-6, AC-33/34) and the idempotent VIP pause (D-8, AC-39).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { OwnerPromotionTouristModel } from '../../src/models/owner-promotion/ownerPromotion.tourist.model';
import { DbError } from '../../src/utils/error';

vi.mock('../../src/utils/logger', () => ({ logQuery: vi.fn(), logError: vi.fn() }));

const A1 = 'acc-1';
const A2 = 'acc-2';
const A3 = 'acc-3';

describe('OwnerPromotionTouristModel', () => {
    let model: OwnerPromotionTouristModel;
    let getDb: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new OwnerPromotionTouristModel();
        vi.clearAllMocks();
        getDb = vi.spyOn(dbUtils, 'getDb') as ReturnType<typeof vi.fn>;
    });

    afterEach(() => vi.restoreAllMocks());

    function groupedRows(rows: unknown[]) {
        const groupBy = vi.fn().mockResolvedValue(rows);
        const db = {
            select: vi.fn().mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({ groupBy })
                })
            })
        };
        getDb.mockReturnValue(db);
        return db;
    }

    describe('findAccommodationPromotionPresence', () => {
        it('merges targeted and owner-wide presence per accommodation', async () => {
            groupedRows([
                { targetId: A1, ownerId: 'o1', hasPlus: true, hasVip: false },
                { targetId: null, ownerId: 'o1', hasPlus: false, hasVip: true },
                { targetId: A3, ownerId: 'o2', hasPlus: false, hasVip: true }
            ]);

            const presence = await model.findAccommodationPromotionPresence({
                listings: [
                    { id: A1, ownerId: 'o1' },
                    { id: A2, ownerId: 'o1' },
                    { id: A3, ownerId: 'o2' }
                ]
            });

            expect(presence.get(A1)).toEqual({ hasFreePromotion: true, hasVipPromotion: true });
            expect(presence.get(A2)).toEqual({ hasFreePromotion: false, hasVipPromotion: true });
            expect(presence.get(A3)).toEqual({ hasFreePromotion: false, hasVipPromotion: true });
        });

        it('leaves a place without promotions out of the map', async () => {
            groupedRows([]);
            const presence = await model.findAccommodationPromotionPresence({
                listings: [{ id: A1, ownerId: 'o1' }]
            });
            expect(presence.has(A1)).toBe(false);
        });

        it('skips the query for an empty page', async () => {
            const presence = await model.findAccommodationPromotionPresence({ listings: [] });
            expect(presence.size).toBe(0);
            expect(getDb).not.toHaveBeenCalled();
        });

        it('wraps a driver failure in a DbError', async () => {
            getDb.mockReturnValue({
                select: () => {
                    throw new Error('boom');
                }
            });
            await expect(
                model.findAccommodationPromotionPresence({ listings: [{ id: A1, ownerId: 'o1' }] })
            ).rejects.toBeInstanceOf(DbError);
        });
    });

    describe('pauseVipPromotions (AC-39)', () => {
        function updateReturning(ids: string[]) {
            const set = vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue(ids.map((id) => ({ id })))
                })
            });
            getDb.mockReturnValue({ update: vi.fn().mockReturnValue({ set }) });
            return set;
        }

        it('pauses to INACTIVE with the stamp and returns the ids it touched', async () => {
            const now = new Date('2026-11-24T00:00:00Z');
            const set = updateReturning(['p1']);

            const paused = await model.pauseVipPromotions({ ids: ['p1', 'p2'], now });

            expect(paused).toEqual(['p1']);
            expect(set).toHaveBeenCalledWith({
                lifecycleState: 'INACTIVE',
                vipPausedAt: now,
                updatedAt: now
            });
        });

        it('a second run that matches no ACTIVE vip row returns nothing', async () => {
            updateReturning([]);
            expect(await model.pauseVipPromotions({ ids: ['p1'], now: new Date() })).toEqual([]);
        });

        it('does not query for an empty batch', async () => {
            expect(await model.pauseVipPromotions({ ids: [], now: new Date() })).toEqual([]);
            expect(getDb).not.toHaveBeenCalled();
        });
    });
});
