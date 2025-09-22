import { describe, expect, it } from 'vitest';
import {
    FacebookUrlRegex,
    InstagramUrlRegex,
    InternationalPhoneRegex,
    SlugRegex,
    TimeRegExp,
    isValidLatitude,
    isValidLongitude,
    omittedSystemFieldsForActions
} from '../../src/utils/utils.js';

describe('Regular Expressions', () => {
    describe('SlugRegex', () => {
        it('should validate correct slug formats', () => {
            const validSlugs = [
                'simple-slug',
                'slug-with-numbers-123',
                'a',
                'single-word',
                'multi-word-slug-with-many-parts',
                'slug123',
                '123-slug',
                'slug-123-end'
            ];

            for (const slug of validSlugs) {
                expect(SlugRegex.test(slug)).toBe(true);
            }
        });

        it('should reject invalid slug formats', () => {
            const invalidSlugs = [
                'Slug-With-Capitals',
                'slug_with_underscores',
                'slug with spaces',
                'slug.with.dots',
                'slug@with#symbols',
                '-starting-with-dash',
                'ending-with-dash-',
                'double--dash',
                '',
                'slug-',
                '-slug'
            ];

            for (const slug of invalidSlugs) {
                expect(SlugRegex.test(slug)).toBe(false);
            }
        });
    });

    describe('TimeRegExp', () => {
        it('should validate correct time formats (24h)', () => {
            const validTimes = ['00:00', '12:30', '23:59', '01:15', '09:45', '15:30', '20:00'];

            for (const time of validTimes) {
                expect(TimeRegExp.test(time)).toBe(true);
            }
        });

        it('should reject invalid time formats', () => {
            const invalidTimes = [
                '24:00', // Hour too high
                '12:60', // Minute too high
                '1:30', // Missing leading zero for hour
                '12:5', // Missing leading zero for minute
                '12:30:45', // Seconds not allowed
                '12-30', // Wrong separator
                '12:30 AM', // AM/PM not allowed
                'noon',
                '',
                '25:30',
                '12:99'
            ];

            for (const time of invalidTimes) {
                expect(TimeRegExp.test(time)).toBe(false);
            }
        });
    });

    describe('InternationalPhoneRegex', () => {
        it('should validate correct international phone formats', () => {
            const validPhones = [
                '+1234567890',
                '+12345678901',
                '+123456789012345',
                '+54111234567',
                '+442079460958',
                '+15551234567'
            ];

            for (const phone of validPhones) {
                expect(InternationalPhoneRegex.test(phone)).toBe(true);
            }
        });

        it('should reject invalid phone formats', () => {
            const invalidPhones = [
                '1234567890', // Missing +
                '+0123456789', // Starts with 0
                '+', // Just +
                '+1', // Too short
                '+123456789012345678901', // Too long
                'phone number',
                '+abc123456',
                ''
            ];

            for (const phone of invalidPhones) {
                expect(InternationalPhoneRegex.test(phone)).toBe(false);
            }
        });
    });

    describe('Social Media URL Regexes', () => {
        describe('FacebookUrlRegex', () => {
            it('should validate Facebook URLs', () => {
                const validUrls = [
                    'https://www.facebook.com/profile',
                    'http://www.facebook.com/page',
                    'https://facebook.com/user',
                    'http://facebook.com/group'
                ];

                for (const url of validUrls) {
                    expect(FacebookUrlRegex.test(url)).toBe(true);
                }
            });

            it('should reject non-Facebook URLs', () => {
                const invalidUrls = [
                    'https://instagram.com/profile',
                    'https://twitter.com/user',
                    'facebook.com/profile', // Missing protocol
                    'https://fakebook.com/profile',
                    ''
                ];

                for (const url of invalidUrls) {
                    expect(FacebookUrlRegex.test(url)).toBe(false);
                }
            });
        });

        describe('InstagramUrlRegex', () => {
            it('should validate Instagram URLs', () => {
                const validUrls = [
                    'https://www.instagram.com/profile',
                    'http://www.instagram.com/profile',
                    'https://instagram.com/user',
                    'http://instagram.com/user'
                ];

                for (const url of validUrls) {
                    expect(InstagramUrlRegex.test(url)).toBe(true);
                }
            });

            it('should reject non-Instagram URLs', () => {
                const invalidUrls = [
                    'https://facebook.com/profile',
                    'instagram.com/profile', // Missing protocol
                    'https://not-instagram.com/profile',
                    ''
                ];

                for (const url of invalidUrls) {
                    expect(InstagramUrlRegex.test(url)).toBe(false);
                }
            });
        });
    });
});

describe('Coordinate Validation Functions', () => {
    describe('isValidLatitude', () => {
        it('should validate correct latitude values', () => {
            const validLatitudes = [
                '0',
                '90',
                '-90',
                '45.123456',
                '-45.123456',
                '0.0',
                '89.999999',
                '-89.999999'
            ];

            for (const lat of validLatitudes) {
                expect(isValidLatitude(lat)).toBe(true);
            }
        });

        it('should reject invalid latitude values', () => {
            // Test each value individually to identify the problematic one
            expect(isValidLatitude('91')).toBe(false); // Too high
            expect(isValidLatitude('-91')).toBe(false); // Too low
            expect(isValidLatitude('90.1')).toBe(false); // Slightly over
            expect(isValidLatitude('-90.1')).toBe(false); // Slightly under
            expect(isValidLatitude('abc')).toBe(false); // Not a number
            expect(isValidLatitude('')).toBe(false); // Empty string
            expect(isValidLatitude('45.123.456')).toBe(false); // Multiple decimals

            // Test special cases separately for better debugging
            expect(isValidLatitude('NaN')).toBe(false);
            expect(isValidLatitude('Infinity')).toBe(false);
            expect(isValidLatitude('-Infinity')).toBe(false);
        });

        it('should handle boundary values correctly', () => {
            expect(isValidLatitude('90')).toBe(true);
            expect(isValidLatitude('-90')).toBe(true);
            expect(isValidLatitude('90.0')).toBe(true);
            expect(isValidLatitude('-90.0')).toBe(true);
        });
    });

    describe('isValidLongitude', () => {
        it('should validate correct longitude values', () => {
            const validLongitudes = [
                '0',
                '180',
                '-180',
                '90.123456',
                '-90.123456',
                '0.0',
                '179.999999',
                '-179.999999'
            ];

            for (const lng of validLongitudes) {
                expect(isValidLongitude(lng)).toBe(true);
            }
        });

        it('should reject invalid longitude values', () => {
            // Test each value individually to identify the problematic one
            expect(isValidLongitude('181')).toBe(false); // Too high
            expect(isValidLongitude('-181')).toBe(false); // Too low
            expect(isValidLongitude('180.1')).toBe(false); // Slightly over
            expect(isValidLongitude('-180.1')).toBe(false); // Slightly under
            expect(isValidLongitude('abc')).toBe(false); // Not a number
            expect(isValidLongitude('')).toBe(false); // Empty string
            expect(isValidLongitude('90.123.456')).toBe(false); // Multiple decimals

            // Test special cases separately for better debugging
            expect(isValidLongitude('NaN')).toBe(false);
            expect(isValidLongitude('Infinity')).toBe(false);
            expect(isValidLongitude('-Infinity')).toBe(false);
        });

        it('should handle boundary values correctly', () => {
            expect(isValidLongitude('180')).toBe(true);
            expect(isValidLongitude('-180')).toBe(true);
            expect(isValidLongitude('180.0')).toBe(true);
            expect(isValidLongitude('-180.0')).toBe(true);
        });
    });
});

describe('System Fields Configuration', () => {
    describe('omittedSystemFieldsForActions', () => {
        it('should contain expected system fields', () => {
            const expectedFields = ['id', 'createdAt', 'updatedAt', 'deletedAt', 'deletedById'];

            for (const field of expectedFields) {
                expect(omittedSystemFieldsForActions).toContain(field);
            }
        });

        it('should have correct number of fields', () => {
            expect(omittedSystemFieldsForActions).toHaveLength(5);
        });

        it('should be an array of strings', () => {
            expect(Array.isArray(omittedSystemFieldsForActions)).toBe(true);
            for (const field of omittedSystemFieldsForActions) {
                expect(typeof field).toBe('string');
            }
        });

        it('should not contain duplicate values', () => {
            const unique = [...new Set(omittedSystemFieldsForActions)];
            expect(unique).toHaveLength(omittedSystemFieldsForActions.length);
        });

        it('should not contain empty strings', () => {
            for (const field of omittedSystemFieldsForActions) {
                expect(field.trim()).not.toBe('');
                expect(field.length).toBeGreaterThan(0);
            }
        });
    });
});
