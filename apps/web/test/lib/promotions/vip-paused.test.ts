/**
 * HOS-2589 D-8 / AC-36: the in-app notice lists the promotions the pause holds.
 */
import { describe, expect, it } from 'vitest';
import { listVipPausedTitles } from '../../../src/lib/promotions/vip-paused';

describe('listVipPausedTitles', () => {
    it('lists only stamped promotions that are not active again', () => {
        const { titles } = listVipPausedTitles({
            items: [
                {
                    title: 'Paused',
                    lifecycleState: 'INACTIVE',
                    vipPausedAt: '2026-11-20T00:00:00Z'
                },
                { title: 'Resumed', lifecycleState: 'ACTIVE', vipPausedAt: '2026-11-20T00:00:00Z' },
                { title: 'Owner paused', lifecycleState: 'INACTIVE', vipPausedAt: null },
                { title: 'No stamp', lifecycleState: 'DRAFT' }
            ]
        });
        expect(titles).toEqual(['Paused']);
    });
});
