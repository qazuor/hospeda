import { describe, expect, it } from 'vitest';
import { mapWmoCodeToCondition } from '../../../src/services/weather/wmo-codes.js';

describe('mapWmoCodeToCondition', () => {
    it('maps clear/cloud codes', () => {
        expect(mapWmoCodeToCondition({ weatherCode: 0 })).toBe('clear');
        expect(mapWmoCodeToCondition({ weatherCode: 1 })).toBe('mainlyClear');
        expect(mapWmoCodeToCondition({ weatherCode: 2 })).toBe('partlyCloudy');
        expect(mapWmoCodeToCondition({ weatherCode: 3 })).toBe('overcast');
    });

    it('maps fog codes', () => {
        expect(mapWmoCodeToCondition({ weatherCode: 45 })).toBe('fog');
        expect(mapWmoCodeToCondition({ weatherCode: 48 })).toBe('fog');
    });

    it('maps drizzle and freezing variants', () => {
        expect(mapWmoCodeToCondition({ weatherCode: 51 })).toBe('drizzle');
        expect(mapWmoCodeToCondition({ weatherCode: 55 })).toBe('drizzle');
        expect(mapWmoCodeToCondition({ weatherCode: 56 })).toBe('freezingRain');
        expect(mapWmoCodeToCondition({ weatherCode: 66 })).toBe('freezingRain');
    });

    it('maps rain, snow, showers and thunderstorm codes', () => {
        expect(mapWmoCodeToCondition({ weatherCode: 61 })).toBe('rain');
        expect(mapWmoCodeToCondition({ weatherCode: 65 })).toBe('rain');
        expect(mapWmoCodeToCondition({ weatherCode: 71 })).toBe('snow');
        expect(mapWmoCodeToCondition({ weatherCode: 77 })).toBe('snowGrains');
        expect(mapWmoCodeToCondition({ weatherCode: 80 })).toBe('rainShowers');
        expect(mapWmoCodeToCondition({ weatherCode: 85 })).toBe('snowShowers');
        expect(mapWmoCodeToCondition({ weatherCode: 95 })).toBe('thunderstorm');
        expect(mapWmoCodeToCondition({ weatherCode: 96 })).toBe('thunderstormHail');
        expect(mapWmoCodeToCondition({ weatherCode: 99 })).toBe('thunderstormHail');
    });

    it('falls back to unknown for unmapped codes', () => {
        expect(mapWmoCodeToCondition({ weatherCode: 4 })).toBe('unknown');
        expect(mapWmoCodeToCondition({ weatherCode: -1 })).toBe('unknown');
        expect(mapWmoCodeToCondition({ weatherCode: 1000 })).toBe('unknown');
    });
});
