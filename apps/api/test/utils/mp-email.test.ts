/**
 * Tests for sanitizeEmailForMercadoPago (BETA-164)
 *
 * MercadoPago rejects '+' (plus-addressing) in emails with error 612
 * "Field=email - Syntax invalid". This util replaces '+' with '.' in the
 * LOCAL part only, so the sanitized value is safe to persist and reuse
 * across all downstream MP calls.
 */

import { describe, expect, it } from 'vitest';
import { sanitizeEmailForMercadoPago } from '../../src/utils/mp-email';

describe('sanitizeEmailForMercadoPago', () => {
    it('should replace a single "+" in the local part with "."', () => {
        // Arrange
        const email = 'qazuor+turista@gmail.com';

        // Act
        const result = sanitizeEmailForMercadoPago(email);

        // Assert
        expect(result).toBe('qazuor.turista@gmail.com');
    });

    it('should replace multiple "+" occurrences in the local part', () => {
        // Arrange
        const email = 'a+b+c@example.com';

        // Act
        const result = sanitizeEmailForMercadoPago(email);

        // Assert
        expect(result).toBe('a.b.c@example.com');
    });

    it('should return the email unchanged when it has no "+" (idempotent)', () => {
        // Arrange
        const email = 'plain@example.com';

        // Act
        const result = sanitizeEmailForMercadoPago(email);

        // Assert
        expect(result).toBe('plain@example.com');
    });

    it('should be idempotent when applied twice', () => {
        // Arrange
        const email = 'qazuor+host@gmail.com';

        // Act
        const once = sanitizeEmailForMercadoPago(email);
        const twice = sanitizeEmailForMercadoPago(once);

        // Assert
        expect(twice).toBe(once);
        expect(twice).toBe('qazuor.host@gmail.com');
    });

    it('should not touch a "+" in the domain part', () => {
        // Arrange - unusual/invalid but should not be mangled by this util
        const email = 'local@ex+ample.com';

        // Act
        const result = sanitizeEmailForMercadoPago(email);

        // Assert
        expect(result).toBe('local@ex+ample.com');
    });

    it('should return the string unchanged when it has no "@"', () => {
        // Arrange
        const notAnEmail = 'not-an-email';

        // Act
        const result = sanitizeEmailForMercadoPago(notAnEmail);

        // Assert
        expect(result).toBe('not-an-email');
    });

    it('should return the string unchanged when "@" is the first character', () => {
        // Arrange
        const edgeCase = '@example.com';

        // Act
        const result = sanitizeEmailForMercadoPago(edgeCase);

        // Assert
        expect(result).toBe('@example.com');
    });

    it('should use the LAST "@" to split local/domain parts', () => {
        // Arrange - defensive case with more than one '@' (invalid RFC email,
        // but the util should still behave predictably and only sanitize the
        // local part before the final '@').
        const email = 'a+b@c@example.com';

        // Act
        const result = sanitizeEmailForMercadoPago(email);

        // Assert
        expect(result).toBe('a.b@c@example.com');
    });
});
