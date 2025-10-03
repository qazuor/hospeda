/**
 * HTTP Field Factory Tests - Phase 2.5 Optimizations
 */
import { describe, expect, it } from 'vitest';
import { CommonHttpFields, HttpFieldFactories } from '../../src/utils/http-field.factory.js';

describe('HTTP Field Factory', () => {
    describe('HttpFieldFactories', () => {
        it('should create price fields with proper validation', () => {
            const minPriceField = HttpFieldFactories.priceField({ field: 'min' });
            const maxPriceField = HttpFieldFactories.priceField({ field: 'max' });

            // Valid prices
            expect(minPriceField.parse('100')).toBe(100);
            expect(maxPriceField.parse('500')).toBe(500);
            expect(minPriceField.parse(undefined)).toBeUndefined();

            // Invalid prices
            expect(() => minPriceField.parse('-50')).toThrow();
        });

        it('should create guest fields with proper validation', () => {
            const minGuestField = HttpFieldFactories.guestField({ field: 'min' });
            const maxGuestField = HttpFieldFactories.guestField({ field: 'max' });

            // Valid guest counts
            expect(minGuestField.parse('2')).toBe(2);
            expect(maxGuestField.parse('8')).toBe(8);

            // Invalid guest counts
            expect(() => minGuestField.parse('0')).toThrow();
            expect(() => maxGuestField.parse('100')).toThrow();
        });

        it('should create coordinate fields with proper validation', () => {
            const latField = HttpFieldFactories.coordinateField('latitude');
            const lngField = HttpFieldFactories.coordinateField('longitude');

            // Valid coordinates
            expect(latField.parse('25.7617')).toBe(25.7617);
            expect(lngField.parse('-80.1918')).toBe(-80.1918);

            // Invalid coordinates
            expect(() => latField.parse('100')).toThrow(); // lat > 90
            expect(() => lngField.parse('200')).toThrow(); // lng > 180
        });

        it('should create boolean fields with coercion', () => {
            const boolField = HttpFieldFactories.booleanField('testBoolean');

            // Zod's coercion behavior for boolean fields:
            // - Strings: any non-empty string coerces to true (including 'false', '0')
            // - Empty string or undefined: false/undefined
            expect(boolField.parse('true')).toBe(true);
            expect(boolField.parse('1')).toBe(true);
            expect(boolField.parse('0')).toBe(true); // '0' is a non-empty string, so it's true
            expect(boolField.parse(undefined)).toBeUndefined();
        });

        it('should create array fields from comma-separated strings', () => {
            const arrayField = HttpFieldFactories.arrayField();
            const uuidArrayField = HttpFieldFactories.uuidArrayField();

            // Array field
            expect(arrayField.parse('tag1,tag2,tag3')).toEqual(['tag1', 'tag2', 'tag3']);
            expect(arrayField.parse('')).toEqual([]);

            // UUID array field should validate UUIDs
            const validUuids =
                '123e4567-e89b-12d3-a456-426614174000,987fcdeb-51a2-43d8-b456-426614174001';
            expect(() => uuidArrayField.parse(validUuids)).not.toThrow();
            expect(() => uuidArrayField.parse('invalid-uuid,another-invalid')).toThrow();
        });
    });

    describe('CommonHttpFields', () => {
        it('should provide pre-configured common fields', () => {
            // Test that all common fields are functions that return schemas
            expect(typeof CommonHttpFields.minPrice).toBe('function');
            expect(typeof CommonHttpFields.maxPrice).toBe('function');
            expect(typeof CommonHttpFields.minGuests).toBe('function');
            expect(typeof CommonHttpFields.maxGuests).toBe('function');
            expect(typeof CommonHttpFields.latitude).toBe('function');
            expect(typeof CommonHttpFields.longitude).toBe('function');
            expect(typeof CommonHttpFields.isActive).toBe('function');
            expect(typeof CommonHttpFields.amenities).toBe('function');
        });

        it('should create working field instances', () => {
            const minPriceSchema = CommonHttpFields.minPrice();
            const isActiveSchema = CommonHttpFields.isActive();
            const amenitiesSchema = CommonHttpFields.amenities();

            // Test actual parsing
            expect(minPriceSchema.parse('100')).toBe(100);
            expect(isActiveSchema.parse('true')).toBe(true);

            // Test with valid UUIDs
            const validUuids =
                '123e4567-e89b-12d3-a456-426614174000,987fcdeb-51a2-43d8-b456-426614174001';
            expect(() => amenitiesSchema.parse(validUuids)).not.toThrow();
        });
    });
});
