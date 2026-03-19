import { describe, expect, it } from 'vitest';
import { ENTITY_ICONS, STATUS_ICONS, getEntityIcon, getStatusIcon } from '../../src/utils/icons.js';

describe('ENTITY_ICONS', () => {
    it('is a non-empty object', () => {
        expect(Object.keys(ENTITY_ICONS).length).toBeGreaterThan(0);
    });

    it('contains expected entity names', () => {
        expect(ENTITY_ICONS).toHaveProperty('Users');
        expect(ENTITY_ICONS).toHaveProperty('Destinations');
        expect(ENTITY_ICONS).toHaveProperty('Amenities');
        expect(ENTITY_ICONS).toHaveProperty('Default');
    });

    it('all values are non-empty strings', () => {
        for (const [key, value] of Object.entries(ENTITY_ICONS)) {
            expect(typeof value, `ENTITY_ICONS.${key} should be a string`).toBe('string');
            expect(value.length, `ENTITY_ICONS.${key} should be non-empty`).toBeGreaterThan(0);
        }
    });
});

describe('STATUS_ICONS', () => {
    it('is a non-empty object', () => {
        expect(Object.keys(STATUS_ICONS).length).toBeGreaterThan(0);
    });

    it('contains expected status keys', () => {
        expect(STATUS_ICONS).toHaveProperty('Success');
        expect(STATUS_ICONS).toHaveProperty('Error');
        expect(STATUS_ICONS).toHaveProperty('Warning');
        expect(STATUS_ICONS).toHaveProperty('Info');
        expect(STATUS_ICONS).toHaveProperty('Seed');
    });

    it('all values are non-empty strings', () => {
        for (const [key, value] of Object.entries(STATUS_ICONS)) {
            expect(typeof value, `STATUS_ICONS.${key} should be a string`).toBe('string');
            expect(value.length, `STATUS_ICONS.${key} should be non-empty`).toBeGreaterThan(0);
        }
    });
});

describe('getEntityIcon', () => {
    it('returns the correct icon for known entity names', () => {
        expect(getEntityIcon('Users')).toBe(ENTITY_ICONS.Users);
        expect(getEntityIcon('Destinations')).toBe(ENTITY_ICONS.Destinations);
        expect(getEntityIcon('Amenities')).toBe(ENTITY_ICONS.Amenities);
    });

    it('returns the Default icon for unknown entity names', () => {
        expect(getEntityIcon('UnknownEntity')).toBe(ENTITY_ICONS.Default);
        expect(getEntityIcon('')).toBe(ENTITY_ICONS.Default);
    });

    it('returns a non-empty string for any input', () => {
        const result = getEntityIcon('SomethingRandom');
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
    });
});

describe('getStatusIcon', () => {
    it('returns the Success icon for "success" status', () => {
        expect(getStatusIcon('success')).toBe(STATUS_ICONS.Success);
    });

    it('returns the Error icon for "error" status', () => {
        expect(getStatusIcon('error')).toBe(STATUS_ICONS.Error);
    });

    it('returns the Warning icon for "warning" status', () => {
        expect(getStatusIcon('warning')).toBe(STATUS_ICONS.Warning);
    });
});
