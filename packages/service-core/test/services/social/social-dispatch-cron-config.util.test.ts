/**
 * Unit tests for the settings-driven dispatch cron cadence validation
 * (HOS-64 / SPEC-297a G-2).
 *
 * @module test/services/social/social-dispatch-cron-config.util
 */

import { describe, expect, it } from 'vitest';
import {
    DEFAULT_DISPATCH_CRON_CADENCE,
    DISPATCH_CRON_CADENCE_KEY,
    isValidCronExpression,
    resolveDispatchCronCadence
} from '../../../src/services/social/social-dispatch-cron-config.util';

describe('isValidCronExpression', () => {
    it('should accept the default every-5-minutes expression', () => {
        expect(isValidCronExpression('*/5 * * * *')).toBe(true);
    });

    it('should accept a fully-wildcarded expression', () => {
        expect(isValidCronExpression('* * * * *')).toBe(true);
    });

    it('should accept fixed values in every field', () => {
        expect(isValidCronExpression('0 0 1 1 0')).toBe(true);
    });

    it('should accept ranges and lists', () => {
        expect(isValidCronExpression('0 9-17 * * 1-5')).toBe(true);
        expect(isValidCronExpression('0,30 * * * *')).toBe(true);
    });

    it('should reject an expression with fewer than 5 fields', () => {
        expect(isValidCronExpression('* * * *')).toBe(false);
    });

    it('should reject an expression with more than 5 fields', () => {
        expect(isValidCronExpression('* * * * * *')).toBe(false);
    });

    it('should reject non-cron text', () => {
        expect(isValidCronExpression('not a cron expression')).toBe(false);
    });

    it('should reject a field with invalid characters', () => {
        expect(isValidCronExpression('*/5 * * JAN *')).toBe(false);
    });

    it('should tolerate surrounding whitespace', () => {
        expect(isValidCronExpression('  */5 * * * *  ')).toBe(true);
    });
});

describe('resolveDispatchCronCadence', () => {
    it('should return the raw value when it is a valid cron expression', () => {
        expect(resolveDispatchCronCadence({ rawValue: '*/10 * * * *' })).toBe('*/10 * * * *');
    });

    it('should fall back when rawValue is undefined', () => {
        expect(resolveDispatchCronCadence({ rawValue: undefined })).toBe(
            DEFAULT_DISPATCH_CRON_CADENCE
        );
    });

    it('should fall back when rawValue is null', () => {
        expect(resolveDispatchCronCadence({ rawValue: null })).toBe(DEFAULT_DISPATCH_CRON_CADENCE);
    });

    it('should fall back when rawValue is an empty string', () => {
        expect(resolveDispatchCronCadence({ rawValue: '' })).toBe(DEFAULT_DISPATCH_CRON_CADENCE);
    });

    it('should fall back when rawValue is a malformed cron expression', () => {
        expect(resolveDispatchCronCadence({ rawValue: 'every 5 minutes' })).toBe(
            DEFAULT_DISPATCH_CRON_CADENCE
        );
    });

    it('should trim whitespace from a valid raw value', () => {
        expect(resolveDispatchCronCadence({ rawValue: '  */15 * * * *  ' })).toBe('*/15 * * * *');
    });

    describe('DISPATCH_CRON_CADENCE_KEY', () => {
        it('should be the documented social_settings key', () => {
            expect(DISPATCH_CRON_CADENCE_KEY).toBe('dispatch_cron_cadence');
        });
    });

    describe('DEFAULT_DISPATCH_CRON_CADENCE', () => {
        it('should be the current literal cron cadence', () => {
            expect(DEFAULT_DISPATCH_CRON_CADENCE).toBe('*/5 * * * *');
        });
    });
});
