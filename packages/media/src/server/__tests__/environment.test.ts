import { afterEach, describe, expect, it } from 'vitest';
import { resolveEnvironment } from '../environment.js';

describe('resolveEnvironment', () => {
    afterEach(() => {
        process.env.VERCEL_ENV = undefined;
        process.env.NODE_ENV = undefined;
    });

    describe('when VERCEL_ENV=production', () => {
        it("should return 'prod'", () => {
            // Arrange
            process.env.VERCEL_ENV = 'production';

            // Act
            const result = resolveEnvironment();

            // Assert
            expect(result).toBe('prod');
        });
    });

    describe('when VERCEL_ENV=preview', () => {
        it("should return 'preview'", () => {
            // Arrange
            process.env.VERCEL_ENV = 'preview';

            // Act
            const result = resolveEnvironment();

            // Assert
            expect(result).toBe('preview');
        });
    });

    describe('when NODE_ENV=test and no VERCEL_ENV', () => {
        it("should return 'test'", () => {
            // Arrange
            process.env.VERCEL_ENV = undefined;
            process.env.NODE_ENV = 'test';

            // Act
            const result = resolveEnvironment();

            // Assert
            expect(result).toBe('test');
        });
    });

    describe('when neither VERCEL_ENV nor NODE_ENV is set', () => {
        it("should return 'dev'", () => {
            // Arrange
            process.env.VERCEL_ENV = undefined;
            process.env.NODE_ENV = undefined;

            // Act
            const result = resolveEnvironment();

            // Assert
            expect(result).toBe('dev');
        });
    });

    describe('when VERCEL_ENV takes precedence over NODE_ENV', () => {
        it("should return 'prod' when VERCEL_ENV=production and NODE_ENV=test", () => {
            // Arrange
            process.env.VERCEL_ENV = 'production';
            process.env.NODE_ENV = 'test';

            // Act
            const result = resolveEnvironment();

            // Assert
            expect(result).toBe('prod');
        });

        it("should return 'preview' when VERCEL_ENV=preview and NODE_ENV=test", () => {
            // Arrange
            process.env.VERCEL_ENV = 'preview';
            process.env.NODE_ENV = 'test';

            // Act
            const result = resolveEnvironment();

            // Assert
            expect(result).toBe('preview');
        });
    });
});
