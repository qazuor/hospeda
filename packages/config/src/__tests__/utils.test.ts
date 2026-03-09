import { describe, expect, it } from 'vitest';
import { getBooleanOrUndefined } from '../utils.js';

describe('getBooleanOrUndefined', () => {
    it('should return undefined when value is undefined', () => {
        // Arrange / Act
        const result = getBooleanOrUndefined(undefined);

        // Assert
        expect(result).toBeUndefined();
    });

    it('should return true when value is "true"', () => {
        // Arrange / Act
        const result = getBooleanOrUndefined('true');

        // Assert
        expect(result).toBe(true);
    });

    it('should return false when value is "false"', () => {
        // Arrange / Act
        const result = getBooleanOrUndefined('false');

        // Assert
        expect(result).toBe(false);
    });

    it('should return false for any string that is not "true"', () => {
        // Arrange
        const values = ['1', 'yes', 'on', 'TRUE', 'True', '', '0', 'no'];

        // Act / Assert
        for (const value of values) {
            expect(getBooleanOrUndefined(value), `Expected false for "${value}"`).toBe(false);
        }
    });

    it('should return false when called with no arguments', () => {
        // Arrange / Act
        const result = getBooleanOrUndefined();

        // Assert
        expect(result).toBeUndefined();
    });
});
