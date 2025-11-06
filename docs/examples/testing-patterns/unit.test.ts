/**
 * Unit Testing Patterns
 *
 * This file demonstrates pure unit testing patterns:
 * - Testing business logic in isolation
 * - No database dependencies
 * - Fast execution
 * - Mocking dependencies
 * - AAA pattern (Arrange-Act-Assert)
 *
 * Unit tests focus on testing individual functions/methods
 * with mocked dependencies, ensuring fast and isolated tests.
 */

import { describe, expect, it, vi } from 'vitest';

// ============================================================================
// PURE FUNCTIONS - NO DEPENDENCIES
// ============================================================================

/**
 * Pure function to calculate booking total price
 * No dependencies, easy to test
 */
function calculateBookingPrice(input: {
    pricePerNight: number;
    nights: number;
    cleaningFee: number;
    serviceFeePercentage: number;
}): number {
    const { pricePerNight, nights, cleaningFee, serviceFeePercentage } = input;

    const subtotal = pricePerNight * nights;
    const serviceFee = subtotal * (serviceFeePercentage / 100);
    const total = subtotal + cleaningFee + serviceFee;

    return Math.round(total * 100) / 100; // Round to 2 decimals
}

describe('Pure Function Tests - calculateBookingPrice', () => {
    it('should calculate total price with all fees', () => {
        // Arrange
        const input = {
            pricePerNight: 100,
            nights: 3,
            cleaningFee: 50,
            serviceFeePercentage: 10
        };

        // Act
        const result = calculateBookingPrice(input);

        // Assert
        // (100 * 3) + 50 + (300 * 0.10) = 300 + 50 + 30 = 380
        expect(result).toBe(380);
    });

    it('should calculate total with zero cleaning fee', () => {
        // Arrange
        const input = {
            pricePerNight: 100,
            nights: 2,
            cleaningFee: 0,
            serviceFeePercentage: 10
        };

        // Act
        const result = calculateBookingPrice(input);

        // Assert
        // (100 * 2) + 0 + (200 * 0.10) = 200 + 0 + 20 = 220
        expect(result).toBe(220);
    });

    it('should round to 2 decimal places', () => {
        // Arrange
        const input = {
            pricePerNight: 99.99,
            nights: 1,
            cleaningFee: 25.5,
            serviceFeePercentage: 7.5
        };

        // Act
        const result = calculateBookingPrice(input);

        // Assert
        // 99.99 + 25.5 + (99.99 * 0.075) = 99.99 + 25.5 + 7.499 = 132.989 -> 132.99
        expect(result).toBe(132.99);
    });

    it('should handle single night booking', () => {
        // Arrange
        const input = {
            pricePerNight: 150,
            nights: 1,
            cleaningFee: 30,
            serviceFeePercentage: 12
        };

        // Act
        const result = calculateBookingPrice(input);

        // Assert
        // 150 + 30 + (150 * 0.12) = 150 + 30 + 18 = 198
        expect(result).toBe(198);
    });
});

// ============================================================================
// BUSINESS LOGIC VALIDATION - NO DATABASE
// ============================================================================

/**
 * Validates if a user can cancel a booking
 * Pure business logic, no external dependencies
 */
function canCancelBooking(booking: {
    checkIn: Date;
    status: string;
    isPaid: boolean;
}): { allowed: boolean; reason?: string } {
    const { checkIn, status, isPaid } = booking;

    // Rule 1: Cannot cancel already cancelled bookings
    if (status === 'cancelled') {
        return { allowed: false, reason: 'Booking is already cancelled' };
    }

    // Rule 2: Cannot cancel completed bookings
    if (status === 'completed') {
        return { allowed: false, reason: 'Cannot cancel completed bookings' };
    }

    // Rule 3: Must be at least 24 hours before check-in
    const now = new Date();
    const hoursUntilCheckIn = (checkIn.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilCheckIn < 24) {
        return { allowed: false, reason: 'Cannot cancel within 24 hours of check-in' };
    }

    // Rule 4: Refund policy based on payment status
    if (isPaid && hoursUntilCheckIn < 48) {
        return {
            allowed: true,
            reason: 'Cancellation allowed with 50% refund (less than 48 hours notice)'
        };
    }

    return { allowed: true };
}

describe('Business Logic Tests - canCancelBooking', () => {
    it('should allow cancellation with sufficient notice', () => {
        // Arrange
        const booking = {
            checkIn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
            status: 'confirmed',
            isPaid: true
        };

        // Act
        const result = canCancelBooking(booking);

        // Assert
        expect(result.allowed).toBe(true);
        expect(result.reason).toBeUndefined();
    });

    it('should reject cancellation for already cancelled booking', () => {
        // Arrange
        const booking = {
            checkIn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            status: 'cancelled',
            isPaid: false
        };

        // Act
        const result = canCancelBooking(booking);

        // Assert
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('Booking is already cancelled');
    });

    it('should reject cancellation for completed booking', () => {
        // Arrange
        const booking = {
            checkIn: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Past date
            status: 'completed',
            isPaid: true
        };

        // Act
        const result = canCancelBooking(booking);

        // Assert
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('Cannot cancel completed bookings');
    });

    it('should reject cancellation within 24 hours', () => {
        // Arrange
        const booking = {
            checkIn: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours from now
            status: 'confirmed',
            isPaid: true
        };

        // Act
        const result = canCancelBooking(booking);

        // Assert
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('Cannot cancel within 24 hours of check-in');
    });

    it('should allow cancellation with partial refund between 24-48 hours', () => {
        // Arrange
        const booking = {
            checkIn: new Date(Date.now() + 36 * 60 * 60 * 1000), // 36 hours from now
            status: 'confirmed',
            isPaid: true
        };

        // Act
        const result = canCancelBooking(booking);

        // Assert
        expect(result.allowed).toBe(true);
        expect(result.reason).toContain('50% refund');
    });
});

// ============================================================================
// STRING MANIPULATION UTILITIES
// ============================================================================

/**
 * Formats a name to proper case
 */
function formatName(name: string): string {
    return name
        .trim()
        .toLowerCase()
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

describe('Utility Function Tests - formatName', () => {
    it('should capitalize first letter of each word', () => {
        // Arrange
        const name = 'john doe';

        // Act
        const result = formatName(name);

        // Assert
        expect(result).toBe('John Doe');
    });

    it('should handle single name', () => {
        // Arrange
        const name = 'maria';

        // Act
        const result = formatName(name);

        // Assert
        expect(result).toBe('Maria');
    });

    it('should handle multiple spaces', () => {
        // Arrange
        const name = 'john   doe';

        // Act
        const result = formatName(name);

        // Assert
        expect(result).not.toContain('  '); // Should normalize spaces
    });

    it('should trim leading and trailing spaces', () => {
        // Arrange
        const name = '  john doe  ';

        // Act
        const result = formatName(name);

        // Assert
        expect(result).toBe('John Doe');
        expect(result.startsWith(' ')).toBe(false);
        expect(result.endsWith(' ')).toBe(false);
    });

    it('should handle all uppercase input', () => {
        // Arrange
        const name = 'JOHN DOE';

        // Act
        const result = formatName(name);

        // Assert
        expect(result).toBe('John Doe');
    });
});

// ============================================================================
// ARRAY/OBJECT MANIPULATION
// ============================================================================

/**
 * Groups accommodations by city
 */
function groupByCity(accommodations: Array<{ id: string; name: string; city: string }>) {
    return accommodations.reduce(
        (acc, accommodation) => {
            const { city } = accommodation;
            if (!acc[city]) {
                acc[city] = [];
            }
            acc[city].push(accommodation);
            return acc;
        },
        {} as Record<string, typeof accommodations>
    );
}

describe('Array Manipulation Tests - groupByCity', () => {
    it('should group accommodations by city', () => {
        // Arrange
        const accommodations = [
            { id: '1', name: 'Hotel A', city: 'Buenos Aires' },
            { id: '2', name: 'Hotel B', city: 'Córdoba' },
            { id: '3', name: 'Hotel C', city: 'Buenos Aires' }
        ];

        // Act
        const result = groupByCity(accommodations);

        // Assert
        expect(result['Buenos Aires']).toHaveLength(2);
        expect(result['Córdoba']).toHaveLength(1);
        expect(result['Buenos Aires'][0].name).toBe('Hotel A');
    });

    it('should handle empty array', () => {
        // Arrange
        const accommodations: Array<{ id: string; name: string; city: string }> = [];

        // Act
        const result = groupByCity(accommodations);

        // Assert
        expect(Object.keys(result)).toHaveLength(0);
    });

    it('should handle single city', () => {
        // Arrange
        const accommodations = [
            { id: '1', name: 'Hotel A', city: 'Rosario' },
            { id: '2', name: 'Hotel B', city: 'Rosario' }
        ];

        // Act
        const result = groupByCity(accommodations);

        // Assert
        expect(Object.keys(result)).toHaveLength(1);
        expect(result['Rosario']).toHaveLength(2);
    });
});

// ============================================================================
// CALCULATION UTILITIES
// ============================================================================

/**
 * Calculates average rating from reviews
 */
function calculateAverageRating(ratings: number[]): number {
    if (ratings.length === 0) return 0;

    const sum = ratings.reduce((acc, rating) => acc + rating, 0);
    const average = sum / ratings.length;

    return Math.round(average * 10) / 10; // Round to 1 decimal
}

describe('Calculation Tests - calculateAverageRating', () => {
    it('should calculate average of ratings', () => {
        // Arrange
        const ratings = [5, 4, 5, 3, 4];

        // Act
        const result = calculateAverageRating(ratings);

        // Assert
        // (5 + 4 + 5 + 3 + 4) / 5 = 21 / 5 = 4.2
        expect(result).toBe(4.2);
    });

    it('should return 0 for empty array', () => {
        // Arrange
        const ratings: number[] = [];

        // Act
        const result = calculateAverageRating(ratings);

        // Assert
        expect(result).toBe(0);
    });

    it('should round to 1 decimal place', () => {
        // Arrange
        const ratings = [5, 5, 4]; // Average: 4.666...

        // Act
        const result = calculateAverageRating(ratings);

        // Assert
        expect(result).toBe(4.7);
    });

    it('should handle single rating', () => {
        // Arrange
        const ratings = [4.5];

        // Act
        const result = calculateAverageRating(ratings);

        // Assert
        expect(result).toBe(4.5);
    });
});
