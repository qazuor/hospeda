/**
 * Unit tests for the settings-driven dispatch config bounds validation
 * (HOS-64 / SPEC-297a G-2, risk item R-1).
 *
 * @module test/services/social/social-dispatch-config.util
 */

import { describe, expect, it } from 'vitest';
import {
    MAKE_WEBHOOK_TIMEOUT_MS_BOUNDS,
    MAX_RETRY_COUNT_BOUNDS,
    resolveBoundedNumericSetting
} from '../../../src/services/social/social-dispatch-config.util';

describe('resolveBoundedNumericSetting', () => {
    it('should return the parsed value when it is within bounds', () => {
        const result = resolveBoundedNumericSetting({
            rawValue: '5',
            min: 1,
            max: 10,
            fallback: 3
        });
        expect(result).toBe(5);
    });

    it('should fall back when rawValue is undefined', () => {
        const result = resolveBoundedNumericSetting({
            rawValue: undefined,
            min: 1,
            max: 10,
            fallback: 3
        });
        expect(result).toBe(3);
    });

    it('should fall back when rawValue is null', () => {
        const result = resolveBoundedNumericSetting({
            rawValue: null,
            min: 1,
            max: 10,
            fallback: 3
        });
        expect(result).toBe(3);
    });

    it('should fall back when rawValue is an empty string', () => {
        const result = resolveBoundedNumericSetting({
            rawValue: '',
            min: 1,
            max: 10,
            fallback: 3
        });
        expect(result).toBe(3);
    });

    it('should fall back when rawValue is non-numeric', () => {
        const result = resolveBoundedNumericSetting({
            rawValue: 'not-a-number',
            min: 1,
            max: 10,
            fallback: 3
        });
        expect(result).toBe(3);
    });

    it('should fall back when rawValue is below min', () => {
        const result = resolveBoundedNumericSetting({
            rawValue: '0',
            min: 1,
            max: 10,
            fallback: 3
        });
        expect(result).toBe(3);
    });

    it('should fall back when rawValue is above max', () => {
        const result = resolveBoundedNumericSetting({
            rawValue: '999',
            min: 1,
            max: 10,
            fallback: 3
        });
        expect(result).toBe(3);
    });

    it('should accept a value exactly at min', () => {
        const result = resolveBoundedNumericSetting({
            rawValue: '1',
            min: 1,
            max: 10,
            fallback: 3
        });
        expect(result).toBe(1);
    });

    it('should accept a value exactly at max', () => {
        const result = resolveBoundedNumericSetting({
            rawValue: '10',
            min: 1,
            max: 10,
            fallback: 3
        });
        expect(result).toBe(10);
    });

    describe('MAX_RETRY_COUNT_BOUNDS', () => {
        it('should have the documented default and range', () => {
            expect(MAX_RETRY_COUNT_BOUNDS).toEqual({ min: 1, max: 10, fallback: 3 });
        });
    });

    describe('MAKE_WEBHOOK_TIMEOUT_MS_BOUNDS', () => {
        it('should have the documented default and range', () => {
            expect(MAKE_WEBHOOK_TIMEOUT_MS_BOUNDS).toEqual({
                min: 5_000,
                max: 120_000,
                fallback: 40_000
            });
        });
    });
});
