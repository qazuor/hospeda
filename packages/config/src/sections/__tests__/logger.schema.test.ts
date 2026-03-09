import { describe, expect, it } from 'vitest';
import { LoggerSchema, parseLoggerSchema } from '../logger.schema.js';

describe('LoggerSchema', () => {
    describe('validation', () => {
        it('should accept valid logger configuration with all fields', () => {
            // Arrange
            const input = {
                LEVEL: 'INFO',
                INCLUDE_TIMESTAMPS: true,
                INCLUDE_LEVEL: true,
                USE_COLORS: false
            };

            // Act
            const result = LoggerSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.LEVEL).toBe('INFO');
                expect(result.data.INCLUDE_TIMESTAMPS).toBe(true);
                expect(result.data.INCLUDE_LEVEL).toBe(true);
                expect(result.data.USE_COLORS).toBe(false);
            }
        });

        it('should accept all valid log levels', () => {
            // Arrange
            const levels = ['LOG', 'INFO', 'WARN', 'ERROR', 'DEBUG'] as const;

            // Act / Assert
            for (const level of levels) {
                const result = LoggerSchema.safeParse({ LEVEL: level });
                expect(result.success, `Expected LEVEL "${level}" to be valid`).toBe(true);
            }
        });

        it('should accept configuration with only LEVEL (optional fields omitted)', () => {
            // Arrange
            const input = { LEVEL: 'DEBUG' };

            // Act
            const result = LoggerSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.INCLUDE_TIMESTAMPS).toBeUndefined();
                expect(result.data.INCLUDE_LEVEL).toBeUndefined();
                expect(result.data.USE_COLORS).toBeUndefined();
            }
        });
    });

    describe('validation errors', () => {
        it('should reject an invalid log level', () => {
            // Arrange
            const input = { LEVEL: 'TRACE' };

            // Act
            const result = LoggerSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject missing LEVEL', () => {
            // Arrange
            const input = {};

            // Act
            const result = LoggerSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });
});

describe('parseLoggerSchema', () => {
    it('should parse valid env vars and uppercase the log level', () => {
        // Arrange
        const env = {
            VITE_LOG_LEVEL: 'info',
            VITE_LOG_INCLUDE_TIMESTAMPS: 'true',
            VITE_LOG_INCLUDE_LEVEL: 'false',
            VITE_LOG_USE_COLORS: 'true'
        } as unknown as ConfigMetaEnv;

        // Act
        const result = parseLoggerSchema(env);

        // Assert
        expect(result.LEVEL).toBe('INFO');
        expect(result.INCLUDE_TIMESTAMPS).toBe(true);
        expect(result.INCLUDE_LEVEL).toBe(false);
        expect(result.USE_COLORS).toBe(true);
    });

    it('should handle undefined optional fields', () => {
        // Arrange
        const env = {
            VITE_LOG_LEVEL: 'warn'
        } as unknown as ConfigMetaEnv;

        // Act
        const result = parseLoggerSchema(env);

        // Assert
        expect(result.LEVEL).toBe('WARN');
        expect(result.INCLUDE_TIMESTAMPS).toBeUndefined();
        expect(result.INCLUDE_LEVEL).toBeUndefined();
        expect(result.USE_COLORS).toBeUndefined();
    });

    it('should throw for missing log level', () => {
        // Arrange
        const env = {} as ConfigMetaEnv;

        // Act / Assert
        expect(() => parseLoggerSchema(env)).toThrow();
    });
});
