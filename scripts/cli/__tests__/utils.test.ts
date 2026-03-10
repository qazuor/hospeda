import { describe, expect, it } from 'vitest';
import { findMonorepoRoot, isExitPromptError } from '../utils.js';

describe('findMonorepoRoot', () => {
    it('should return a non-empty string', () => {
        // Arrange & Act
        const root = findMonorepoRoot();

        // Assert
        expect(typeof root).toBe('string');
        expect(root.length).toBeGreaterThan(0);
    });

    it('should return a path that ends with the monorepo name', () => {
        // Arrange & Act
        const root = findMonorepoRoot();

        // Assert
        expect(root).toMatch(/hospeda$/);
    });

    it('should return an absolute path', () => {
        // Arrange & Act
        const root = findMonorepoRoot();

        // Assert
        expect(root.startsWith('/')).toBe(true);
    });

    it('should return the same value on repeated calls', () => {
        // Arrange & Act
        const first = findMonorepoRoot();
        const second = findMonorepoRoot();

        // Assert
        expect(first).toBe(second);
    });
});

describe('isExitPromptError', () => {
    it('should return true for objects with name ExitPromptError', () => {
        // Arrange
        const error = { name: 'ExitPromptError', message: 'user exited' };

        // Act & Assert
        expect(isExitPromptError(error)).toBe(true);
    });

    it('should return false for null', () => {
        expect(isExitPromptError(null)).toBe(false);
    });

    it('should return false for undefined', () => {
        expect(isExitPromptError(undefined)).toBe(false);
    });

    it('should return false for plain Error', () => {
        // Arrange
        const error = new Error('regular error');

        // Act & Assert
        expect(isExitPromptError(error)).toBe(false);
    });

    it('should return false for strings', () => {
        expect(isExitPromptError('ExitPromptError')).toBe(false);
    });

    it('should return false for numbers', () => {
        expect(isExitPromptError(42)).toBe(false);
    });

    it('should return false for objects with different name', () => {
        // Arrange
        const error = { name: 'TypeError', message: 'test' };

        // Act & Assert
        expect(isExitPromptError(error)).toBe(false);
    });

    it('should return false for objects without name property', () => {
        // Arrange
        const error = { message: 'no name field' };

        // Act & Assert
        expect(isExitPromptError(error)).toBe(false);
    });

    it('should return true for Error subclass with overridden name', () => {
        // Arrange
        const error = new Error('exit');
        error.name = 'ExitPromptError';

        // Act & Assert
        expect(isExitPromptError(error)).toBe(true);
    });
});
