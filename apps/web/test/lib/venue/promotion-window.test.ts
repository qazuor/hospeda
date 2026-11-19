import { describe, expect, it } from 'vitest';
import {
    formatPromotionWindow,
    isPromotionLive,
    isPromotionWindowActive
} from '../../../src/lib/venue/promotion-window';

const window = { weekdays: [4, 5, 6], startTime: '23:00', endTime: '00:30' };

describe('promotion window client logic', () => {
    it('uses the Buenos Aires day and overnight schedule', () => {
        expect(isPromotionWindowActive({ window, now: new Date('2026-11-20T02:30:00.000Z') })).toBe(
            true
        );
        expect(isPromotionWindowActive({ window, now: new Date('2026-11-20T03:45:00.000Z') })).toBe(
            false
        );
    });

    it('looks back from Monday into a Sunday overnight window', () => {
        expect(
            isPromotionWindowActive({
                window: { weekdays: [0], startTime: '23:00', endTime: '02:00' },
                now: new Date('2026-11-23T04:00:00.000Z')
            })
        ).toBe(true);
    });

    it('also checks the absolute validity window', () => {
        expect(
            isPromotionLive({
                promo: {
                    window,
                    validFrom: '2026-11-18T00:00:00.000Z',
                    validUntil: '2026-11-19T00:00:00.000Z'
                },
                now: new Date('2026-11-20T02:30:00.000Z')
            })
        ).toBe(false);
    });

    it('formats short weekday runs and localized text', () => {
        expect(formatPromotionWindow({ window, locale: 'es' })).toBe('Jue a sáb, 23 a 00:30');
        expect(formatPromotionWindow({ window, locale: 'en' })).toBe('Thu to sat, 23 to 00:30');
        expect(formatPromotionWindow({ window, locale: 'pt' })).toBe(
            'Qui até sábado, 23 até 00:30'
        );
        expect(
            formatPromotionWindow({
                window: { weekdays: [1, 5, 6, 0], startTime: '18:00', endTime: '20:00' },
                locale: 'es'
            })
        ).toBe('Lun, vie a dom, 18 a 20');
        expect(
            formatPromotionWindow({
                window: { weekdays: [0, 1, 2, 3, 4, 5, 6], startTime: '18:00', endTime: '20:00' },
                locale: 'es'
            })
        ).toContain('Todos los días');
        expect(
            formatPromotionWindow({
                window: { weekdays: [0, 1, 2, 3, 4, 5, 6], startTime: '18:00', endTime: '20:00' },
                locale: 'pt'
            })
        ).toContain('Todos os dias');
    });
});
