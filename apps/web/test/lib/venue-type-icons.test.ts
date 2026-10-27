/**
 * @file venue-type-icons.test.ts
 * @description Unit tests for the gastronomy-type → icon resolver. Verifies
 * that every value of `VenueTypeEnum` maps to a defined icon component
 * and that unknown values fall back to the generic fallback icon (HOS-97).
 */

import {
    BarServiceIcon,
    CoffeeIcon,
    ForkKnifeIcon,
    MotorhomeParkingIcon,
    PackageIcon,
    RestaurantIcon,
    SnowflakeIcon,
    TraditionalBakeryIcon,
    TraditionalGrillIcon,
    TraditionalPubIcon
} from '@repo/icons';
import { VenueTypeEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { getVenueTypeIcon, VENUE_TYPE_FALLBACK_ICON } from '../../src/lib/venue-type-icons';

describe('getGastronomyTypeIcon', () => {
    it('returns RestaurantIcon for RESTAURANT', () => {
        expect(getVenueTypeIcon({ type: 'RESTAURANT' })).toBe(RestaurantIcon);
    });

    it('returns BarServiceIcon for BAR', () => {
        expect(getVenueTypeIcon({ type: 'BAR' })).toBe(BarServiceIcon);
    });

    it('returns CoffeeIcon for CAFE', () => {
        expect(getVenueTypeIcon({ type: 'CAFE' })).toBe(CoffeeIcon);
    });

    it('returns TraditionalGrillIcon for PARRILLA', () => {
        expect(getVenueTypeIcon({ type: 'PARRILLA' })).toBe(TraditionalGrillIcon);
    });

    it('returns TraditionalPubIcon for CERVECERIA', () => {
        expect(getVenueTypeIcon({ type: 'CERVECERIA' })).toBe(TraditionalPubIcon);
    });

    it('returns SnowflakeIcon for HELADERIA', () => {
        expect(getVenueTypeIcon({ type: 'HELADERIA' })).toBe(SnowflakeIcon);
    });

    it('returns TraditionalBakeryIcon for PANADERIA', () => {
        expect(getVenueTypeIcon({ type: 'PANADERIA' })).toBe(TraditionalBakeryIcon);
    });

    it('returns PackageIcon for ROTISERIA', () => {
        expect(getVenueTypeIcon({ type: 'ROTISERIA' })).toBe(PackageIcon);
    });

    it('returns MotorhomeParkingIcon for FOOD_TRUCK', () => {
        expect(getVenueTypeIcon({ type: 'FOOD_TRUCK' })).toBe(MotorhomeParkingIcon);
    });

    it('is case-insensitive for the input type', () => {
        expect(getVenueTypeIcon({ type: 'restaurant' })).toBe(RestaurantIcon);
        expect(getVenueTypeIcon({ type: 'Food_Truck' })).toBe(MotorhomeParkingIcon);
    });

    it('falls back to GASTRONOMY_TYPE_FALLBACK_ICON for unknown types', () => {
        expect(getVenueTypeIcon({ type: 'spaceship' })).toBe(VENUE_TYPE_FALLBACK_ICON);
        expect(getVenueTypeIcon({ type: '' })).toBe(VENUE_TYPE_FALLBACK_ICON);
    });

    it('exposes ForkKnifeIcon as the fallback icon', () => {
        expect(VENUE_TYPE_FALLBACK_ICON).toBe(ForkKnifeIcon);
    });

    it('covers every value of GastronomyTypeEnum with a defined icon component', () => {
        const allTypes = Object.values(VenueTypeEnum);
        expect(allTypes.length).toBeGreaterThan(0);
        for (const type of allTypes) {
            const icon = getVenueTypeIcon({ type });
            expect(icon).toBeDefined();
            expect(typeof icon).toBe('function');
        }
    });
});
