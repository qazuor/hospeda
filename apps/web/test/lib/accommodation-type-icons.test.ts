/**
 * @file accommodation-type-icons.test.ts
 * @description Unit tests for the accommodation-type → icon resolver. Verifies
 * that every value of `AccommodationTypeEnum` maps to a defined icon component
 * and that unknown values fall back to the generic `AccommodationIcon`.
 */

import {
    AccommodationIcon,
    BedroomsIcon,
    BuildingIcon,
    BuildingsIcon,
    CarIcon,
    HistoricHouseIcon,
    HomeIcon,
    PoolIcon,
    TentIcon,
    TreeIcon,
    UsersIcon
} from '@repo/icons';
import { AccommodationTypeEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { getAccommodationTypeIcon } from '../../src/lib/accommodation-type-icons';

describe('getAccommodationTypeIcon', () => {
    it('returns BuildingsIcon for APARTMENT', () => {
        expect(getAccommodationTypeIcon({ type: 'apartment' })).toBe(BuildingsIcon);
    });

    it('returns HomeIcon for HOUSE', () => {
        expect(getAccommodationTypeIcon({ type: 'house' })).toBe(HomeIcon);
    });

    it('returns HistoricHouseIcon for COUNTRY_HOUSE', () => {
        expect(getAccommodationTypeIcon({ type: 'country_house' })).toBe(HistoricHouseIcon);
    });

    it('returns TreeIcon for CABIN', () => {
        expect(getAccommodationTypeIcon({ type: 'cabin' })).toBe(TreeIcon);
    });

    it('returns BuildingIcon for HOTEL', () => {
        expect(getAccommodationTypeIcon({ type: 'hotel' })).toBe(BuildingIcon);
    });

    it('returns UsersIcon for HOSTEL', () => {
        expect(getAccommodationTypeIcon({ type: 'hostel' })).toBe(UsersIcon);
    });

    it('returns TentIcon for CAMPING', () => {
        expect(getAccommodationTypeIcon({ type: 'camping' })).toBe(TentIcon);
    });

    it('returns BedroomsIcon for ROOM', () => {
        expect(getAccommodationTypeIcon({ type: 'room' })).toBe(BedroomsIcon);
    });

    it('returns CarIcon for MOTEL', () => {
        expect(getAccommodationTypeIcon({ type: 'motel' })).toBe(CarIcon);
    });

    it('returns PoolIcon for RESORT', () => {
        expect(getAccommodationTypeIcon({ type: 'resort' })).toBe(PoolIcon);
    });

    it('uses each icon at most once across the canonical mapping (no duplicates)', () => {
        const icons = Object.values(AccommodationTypeEnum).map((type) =>
            getAccommodationTypeIcon({ type })
        );
        const unique = new Set(icons);
        expect(unique.size).toBe(icons.length);
    });

    it('is case-insensitive for the input type', () => {
        expect(getAccommodationTypeIcon({ type: 'HOTEL' })).toBe(BuildingIcon);
        expect(getAccommodationTypeIcon({ type: 'Country_House' })).toBe(HistoricHouseIcon);
    });

    it('falls back to AccommodationIcon for unknown types', () => {
        expect(getAccommodationTypeIcon({ type: 'spaceship' })).toBe(AccommodationIcon);
        expect(getAccommodationTypeIcon({ type: '' })).toBe(AccommodationIcon);
    });

    it('covers every value of AccommodationTypeEnum', () => {
        const allTypes = Object.values(AccommodationTypeEnum);
        for (const type of allTypes) {
            const icon = getAccommodationTypeIcon({ type });
            expect(icon).toBeDefined();
            expect(typeof icon).toBe('function');
        }
    });
});
