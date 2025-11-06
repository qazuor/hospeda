/**
 * Custom Validators Tests
 *
 * Demonstrates how to test custom Zod validators:
 * - Testing valid inputs
 * - Testing invalid inputs
 * - Verifying error messages
 * - Using AAA pattern (Arrange-Act-Assert)
 */

import { describe, expect, it } from 'vitest';
import {
    argentinaCoordinatesValidator,
    coordinatesValidator,
    dateRangeValidator,
    emailDomainValidator,
    futureDateValidator,
    generateSlug,
    pastDateValidator,
    percentageValidator,
    phoneNumberValidator,
    priceValidator,
    slugValidator
} from './validators';

describe('Custom Validators', () => {
    // ========================================================================
    // DATE RANGE VALIDATOR
    // ========================================================================

    describe('dateRangeValidator', () => {
        it('should return true when start date is before end date', () => {
            // Arrange
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-01-31');

            // Act
            const result = dateRangeValidator(startDate, endDate);

            // Assert
            expect(result).toBe(true);
        });

        it('should return false when start date is after end date', () => {
            // Arrange
            const startDate = new Date('2024-01-31');
            const endDate = new Date('2024-01-01');

            // Act
            const result = dateRangeValidator(startDate, endDate);

            // Assert
            expect(result).toBe(false);
        });

        it('should return false when start date equals end date', () => {
            // Arrange
            const date = new Date('2024-01-15');

            // Act
            const result = dateRangeValidator(date, date);

            // Assert
            expect(result).toBe(false);
        });
    });

    // ========================================================================
    // EMAIL DOMAIN VALIDATOR
    // ========================================================================

    describe('emailDomainValidator', () => {
        it('should accept email from allowed domain', () => {
            // Arrange
            const validator = emailDomainValidator(['company.com', 'partner.org']);
            const email = 'user@company.com';

            // Act
            const result = validator(email);

            // Assert
            expect(result).toBe(true);
        });

        it('should reject email from non-allowed domain', () => {
            // Arrange
            const validator = emailDomainValidator(['company.com']);
            const email = 'user@other.com';

            // Act
            const result = validator(email);

            // Assert
            expect(result).toBe(false);
        });

        it('should handle multiple allowed domains', () => {
            // Arrange
            const validator = emailDomainValidator(['hospeda.com', 'turismo.gob.ar']);

            // Act & Assert
            expect(validator('admin@hospeda.com')).toBe(true);
            expect(validator('contact@turismo.gob.ar')).toBe(true);
            expect(validator('user@gmail.com')).toBe(false);
        });
    });

    // ========================================================================
    // PHONE NUMBER VALIDATOR
    // ========================================================================

    describe('phoneNumberValidator', () => {
        it('should accept valid Argentina phone with country code', () => {
            // Arrange
            const phones = ['+54 9 11 1234-5678', '+54 9 11 12345678', '+549111234567'];

            // Act & Assert
            phones.forEach((phone) => {
                expect(phoneNumberValidator(phone)).toBe(true);
            });
        });

        it('should accept valid local format', () => {
            // Arrange
            const phones = ['11 1234-5678', '1112345678', '0111234567'];

            // Act & Assert
            phones.forEach((phone) => {
                expect(phoneNumberValidator(phone)).toBe(true);
            });
        });

        it('should reject invalid formats', () => {
            // Arrange
            const invalidPhones = [
                '123', // Too short
                'abcd1234567', // Contains letters
                '+1234567890', // Wrong country code
                '+54 9 11 123' // Too short
            ];

            // Act & Assert
            invalidPhones.forEach((phone) => {
                expect(phoneNumberValidator(phone)).toBe(false);
            });
        });
    });

    // ========================================================================
    // SLUG VALIDATOR
    // ========================================================================

    describe('slugValidator', () => {
        it('should accept valid slugs', () => {
            // Arrange
            const validSlugs = [
                'buenos-aires',
                'hotel-5-stars',
                'playa-norte',
                'concepcion-del-uruguay',
                'abc123'
            ];

            // Act & Assert
            validSlugs.forEach((slug) => {
                const result = slugValidator.safeParse(slug);
                expect(result.success).toBe(true);
            });
        });

        it('should reject slugs with uppercase letters', () => {
            // Arrange
            const slug = 'Buenos-Aires';

            // Act
            const result = slugValidator.safeParse(slug);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('lowercase');
            }
        });

        it('should reject slugs with consecutive hyphens', () => {
            // Arrange
            const slug = 'buenos--aires';

            // Act
            const result = slugValidator.safeParse(slug);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('consecutive hyphens');
            }
        });

        it('should reject slugs starting or ending with hyphen', () => {
            // Arrange
            const invalidSlugs = ['-buenos-aires', 'buenos-aires-', '-invalid-'];

            // Act & Assert
            invalidSlugs.forEach((slug) => {
                const result = slugValidator.safeParse(slug);
                expect(result.success).toBe(false);
            });
        });

        it('should reject slugs with special characters', () => {
            // Arrange
            const invalidSlugs = ['buenos_aires', 'hotel@5', 'playa.norte', 'hotel#1'];

            // Act & Assert
            invalidSlugs.forEach((slug) => {
                const result = slugValidator.safeParse(slug);
                expect(result.success).toBe(false);
            });
        });
    });

    // ========================================================================
    // SLUG GENERATOR
    // ========================================================================

    describe('generateSlug', () => {
        it('should convert text to valid slug', () => {
            // Arrange
            const text = 'Buenos Aires Province';

            // Act
            const slug = generateSlug(text);

            // Assert
            expect(slug).toBe('buenos-aires-province');
        });

        it('should remove accents', () => {
            // Arrange
            const text = 'Concepción del Uruguay';

            // Act
            const slug = generateSlug(text);

            // Assert
            expect(slug).toBe('concepcion-del-uruguay');
        });

        it('should handle special characters', () => {
            // Arrange
            const text = 'Hotel 5 Stars!!! @#$%';

            // Act
            const slug = generateSlug(text);

            // Assert
            expect(slug).toBe('hotel-5-stars');
        });

        it('should handle multiple spaces', () => {
            // Arrange
            const text = 'Multiple    Spaces    Here';

            // Act
            const slug = generateSlug(text);

            // Assert
            expect(slug).toBe('multiple-spaces-here');
        });
    });

    // ========================================================================
    // PRICE VALIDATOR
    // ========================================================================

    describe('priceValidator', () => {
        it('should accept valid prices', () => {
            // Arrange
            const validPrices = [0.01, 1, 99.99, 1000, 999999.99];

            // Act & Assert
            validPrices.forEach((price) => {
                const result = priceValidator.safeParse(price);
                expect(result.success).toBe(true);
            });
        });

        it('should reject negative prices', () => {
            // Arrange
            const price = -10;

            // Act
            const result = priceValidator.safeParse(price);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('greater than 0');
            }
        });

        it('should reject zero price', () => {
            // Arrange
            const price = 0;

            // Act
            const result = priceValidator.safeParse(price);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject prices with more than 2 decimals', () => {
            // Arrange
            const price = 99.999;

            // Act
            const result = priceValidator.safeParse(price);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('2 decimal places');
            }
        });

        it('should reject prices exceeding maximum', () => {
            // Arrange
            const price = 1_000_001;

            // Act
            const result = priceValidator.safeParse(price);

            // Assert
            expect(result.success).toBe(false);
        });
    });

    // ========================================================================
    // COORDINATES VALIDATOR
    // ========================================================================

    describe('coordinatesValidator', () => {
        it('should accept valid coordinates', () => {
            // Arrange
            const validCoords = [
                { lat: 0, lng: 0 }, // Equator
                { lat: -32.4827, lng: -58.2388 }, // Concepción del Uruguay
                { lat: 90, lng: 180 }, // Boundaries
                { lat: -90, lng: -180 } // Boundaries
            ];

            // Act & Assert
            validCoords.forEach((coords) => {
                const result = coordinatesValidator.safeParse(coords);
                expect(result.success).toBe(true);
            });
        });

        it('should reject out-of-range latitude', () => {
            // Arrange
            const coords = { lat: 91, lng: 0 };

            // Act
            const result = coordinatesValidator.safeParse(coords);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject out-of-range longitude', () => {
            // Arrange
            const coords = { lat: 0, lng: 181 };

            // Act
            const result = coordinatesValidator.safeParse(coords);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject coordinates with excessive precision', () => {
            // Arrange
            const coords = { lat: -32.48273456, lng: -58.23881234 }; // More than 6 decimals

            // Act
            const result = coordinatesValidator.safeParse(coords);

            // Assert
            expect(result.success).toBe(false);
        });
    });

    // ========================================================================
    // ARGENTINA COORDINATES VALIDATOR
    // ========================================================================

    describe('argentinaCoordinatesValidator', () => {
        it('should accept coordinates within Argentina', () => {
            // Arrange
            const argentinaCoords = [
                { lat: -34.6037, lng: -58.3816 }, // Buenos Aires
                { lat: -32.4827, lng: -58.2388 }, // Concepción del Uruguay
                { lat: -54.8019, lng: -68.3029 } // Ushuaia
            ];

            // Act & Assert
            argentinaCoords.forEach((coords) => {
                const result = argentinaCoordinatesValidator.safeParse(coords);
                expect(result.success).toBe(true);
            });
        });

        it('should reject coordinates outside Argentina', () => {
            // Arrange
            const outsideCoords = [
                { lat: 40.7128, lng: -74.006 }, // New York
                { lat: -33.4489, lng: -70.6693 }, // Santiago (Chile)
                { lat: 0, lng: 0 } // Atlantic Ocean
            ];

            // Act & Assert
            outsideCoords.forEach((coords) => {
                const result = argentinaCoordinatesValidator.safeParse(coords);
                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.issues[0].message).toContain('Argentina');
                }
            });
        });
    });

    // ========================================================================
    // FUTURE DATE VALIDATOR
    // ========================================================================

    describe('futureDateValidator', () => {
        it('should accept future dates', () => {
            // Arrange
            const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

            // Act
            const result = futureDateValidator.safeParse(futureDate);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should reject past dates', () => {
            // Arrange
            const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

            // Act
            const result = futureDateValidator.safeParse(pastDate);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('future');
            }
        });

        it('should reject current date (within same second)', () => {
            // Arrange
            const now = new Date();

            // Act
            const result = futureDateValidator.safeParse(now);

            // Assert
            expect(result.success).toBe(false);
        });
    });

    // ========================================================================
    // PAST DATE VALIDATOR
    // ========================================================================

    describe('pastDateValidator', () => {
        it('should accept past dates', () => {
            // Arrange
            const pastDate = new Date('2020-01-01');

            // Act
            const result = pastDateValidator.safeParse(pastDate);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should reject future dates', () => {
            // Arrange
            const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year from now

            // Act
            const result = pastDateValidator.safeParse(futureDate);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('past');
            }
        });
    });

    // ========================================================================
    // PERCENTAGE VALIDATOR
    // ========================================================================

    describe('percentageValidator', () => {
        it('should accept valid percentages', () => {
            // Arrange
            const validPercentages = [0, 0.01, 25, 50.5, 99.99, 100];

            // Act & Assert
            validPercentages.forEach((pct) => {
                const result = percentageValidator.safeParse(pct);
                expect(result.success).toBe(true);
            });
        });

        it('should reject negative percentages', () => {
            // Arrange
            const percentage = -5;

            // Act
            const result = percentageValidator.safeParse(percentage);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('negative');
            }
        });

        it('should reject percentages over 100', () => {
            // Arrange
            const percentage = 101;

            // Act
            const result = percentageValidator.safeParse(percentage);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject percentages with more than 2 decimals', () => {
            // Arrange
            const percentage = 25.567;

            // Act
            const result = percentageValidator.safeParse(percentage);

            // Assert
            expect(result.success).toBe(false);
        });
    });
});
