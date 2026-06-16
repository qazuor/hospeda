import { describe, expect, it } from 'vitest';
import {
    type ArchiveDaily,
    deriveSeasonalClimate,
    monthToSouthernSeason
} from '../scripts/derive-destination-climate.js';

describe('monthToSouthernSeason', () => {
    it('maps months to Southern-hemisphere seasons', () => {
        expect(monthToSouthernSeason(1)).toBe('summer');
        expect(monthToSouthernSeason(2)).toBe('summer');
        expect(monthToSouthernSeason(12)).toBe('summer');
        expect(monthToSouthernSeason(4)).toBe('autumn');
        expect(monthToSouthernSeason(7)).toBe('winter');
        expect(monthToSouthernSeason(10)).toBe('spring');
    });
});

describe('deriveSeasonalClimate', () => {
    /** Two synthetic days per season across one year. */
    const daily: ArchiveDaily = {
        time: [
            '2022-01-15',
            '2022-02-15', // summer
            '2022-04-15',
            '2022-05-15', // autumn
            '2022-07-15',
            '2022-08-15', // winter
            '2022-10-15',
            '2022-11-15' // spring
        ],
        temperature_2m_max: [32, 30, 24, 22, 17, 19, 26, 28],
        temperature_2m_min: [20, 18, 13, 11, 6, 8, 14, 16],
        precipitation_sum: [50, 40, 30, 20, 5, 5, 35, 45]
    };

    it('computes rounded per-season averages', () => {
        const result = deriveSeasonalClimate({ daily });
        expect(result.seasons.summer).toEqual({ avgTempMinC: 19, avgTempMaxC: 31, rainfallMm: 90 });
        expect(result.seasons.winter).toEqual({ avgTempMinC: 7, avgTempMaxC: 18, rainfallMm: 10 });
    });

    it('picks the season closest to 24°C max as bestSeason', () => {
        const result = deriveSeasonalClimate({ daily });
        // autumn avgTempMax = 23 (closest to 24) → bestSeason
        expect(result.seasons.autumn.avgTempMaxC).toBe(23);
        expect(result.bestSeason).toBe('autumn');
    });

    it('tolerates null entries without crashing', () => {
        const withNulls: ArchiveDaily = {
            time: ['2022-01-10', '2022-01-11'],
            temperature_2m_max: [30, null],
            temperature_2m_min: [18, null],
            precipitation_sum: [10, null]
        };
        const result = deriveSeasonalClimate({ daily: withNulls });
        expect(result.seasons.summer.avgTempMaxC).toBe(30);
    });
});
