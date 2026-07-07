/**
 * @file gastronomy-type-icons.test.ts
 * @description Unit tests for the gastronomy-type → icon resolver. Verifies
 * that every value of `GastronomyTypeEnum` maps to a defined icon component
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
import { GastronomyTypeEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    GASTRONOMY_TYPE_FALLBACK_ICON,
    getGastronomyTypeIcon
} from '../../src/lib/gastronomy-type-icons';

describe('getGastronomyTypeIcon', () => {
    it('returns RestaurantIcon for RESTAURANT', () => {
        expect(getGastronomyTypeIcon({ type: 'RESTAURANT' })).toBe(RestaurantIcon);
    });

    it('returns BarServiceIcon for BAR', () => {
        expect(getGastronomyTypeIcon({ type: 'BAR' })).toBe(BarServiceIcon);
    });

    it('returns CoffeeIcon for CAFE', () => {
        expect(getGastronomyTypeIcon({ type: 'CAFE' })).toBe(CoffeeIcon);
    });

    it('returns TraditionalGrillIcon for PARRILLA', () => {
        expect(getGastronomyTypeIcon({ type: 'PARRILLA' })).toBe(TraditionalGrillIcon);
    });

    it('returns TraditionalPubIcon for CERVECERIA', () => {
        expect(getGastronomyTypeIcon({ type: 'CERVECERIA' })).toBe(TraditionalPubIcon);
    });

    it('returns SnowflakeIcon for HELADERIA', () => {
        expect(getGastronomyTypeIcon({ type: 'HELADERIA' })).toBe(SnowflakeIcon);
    });

    it('returns TraditionalBakeryIcon for PANADERIA', () => {
        expect(getGastronomyTypeIcon({ type: 'PANADERIA' })).toBe(TraditionalBakeryIcon);
    });

    it('returns PackageIcon for ROTISERIA', () => {
        expect(getGastronomyTypeIcon({ type: 'ROTISERIA' })).toBe(PackageIcon);
    });

    it('returns MotorhomeParkingIcon for FOOD_TRUCK', () => {
        expect(getGastronomyTypeIcon({ type: 'FOOD_TRUCK' })).toBe(MotorhomeParkingIcon);
    });

    it('is case-insensitive for the input type', () => {
        expect(getGastronomyTypeIcon({ type: 'restaurant' })).toBe(RestaurantIcon);
        expect(getGastronomyTypeIcon({ type: 'Food_Truck' })).toBe(MotorhomeParkingIcon);
    });

    it('falls back to GASTRONOMY_TYPE_FALLBACK_ICON for unknown types', () => {
        expect(getGastronomyTypeIcon({ type: 'spaceship' })).toBe(GASTRONOMY_TYPE_FALLBACK_ICON);
        expect(getGastronomyTypeIcon({ type: '' })).toBe(GASTRONOMY_TYPE_FALLBACK_ICON);
    });

    it('exposes ForkKnifeIcon as the fallback icon', () => {
        expect(GASTRONOMY_TYPE_FALLBACK_ICON).toBe(ForkKnifeIcon);
    });

    it('covers every value of GastronomyTypeEnum with a defined icon component', () => {
        const allTypes = Object.values(GastronomyTypeEnum);
        expect(allTypes.length).toBeGreaterThan(0);
        for (const type of allTypes) {
            const icon = getGastronomyTypeIcon({ type });
            expect(icon).toBeDefined();
            expect(typeof icon).toBe('function');
        }
    });
});
