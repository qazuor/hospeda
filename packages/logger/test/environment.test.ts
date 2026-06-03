import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    getBooleanEnv,
    getConfigFromEnv,
    getLogFormatEnv,
    getLogLevelEnv,
    getNumberEnv
} from '../src/environment.js';
import { LogFormat, LogLevel } from '../src/types.js';

describe('environment', () => {
    beforeEach(() => {
        vi.unstubAllEnvs();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    describe('getBooleanEnv', () => {
        it('should return null if the variable is not set', () => {
            // Act
            const result = getBooleanEnv('NONEXISTENT_VAR');

            // Assert
            expect(result).toBeNull();
        });

        it('should return true for "true"', () => {
            // Arrange
            vi.stubEnv('TEST_BOOL', 'true');

            // Act
            const result = getBooleanEnv('TEST_BOOL');

            // Assert
            expect(result).toBe(true);
        });

        it('should return false for "false"', () => {
            // Arrange
            vi.stubEnv('TEST_BOOL', 'false');

            // Act
            const result = getBooleanEnv('TEST_BOOL');

            // Assert
            expect(result).toBe(false);
        });

        it('should return false for "0"', () => {
            // Arrange
            vi.stubEnv('TEST_BOOL', '0');

            // Act
            const result = getBooleanEnv('TEST_BOOL');

            // Assert
            expect(result).toBe(false);
        });

        it('should return false for "yes" (only "true" is truthy)', () => {
            // Arrange
            vi.stubEnv('TEST_BOOL', 'yes');

            // Act
            const result = getBooleanEnv('TEST_BOOL');

            // Assert
            expect(result).toBe(false);
        });
    });

    describe('getNumberEnv', () => {
        it('should return parsed integer for valid number string', () => {
            // Arrange
            vi.stubEnv('TEST_NUM', '42');

            // Act
            const result = getNumberEnv('TEST_NUM');

            // Assert
            expect(result).toBe(42);
        });

        it('should return null for NaN values', () => {
            // Arrange
            vi.stubEnv('TEST_NUM', 'not_a_number');

            // Act
            const result = getNumberEnv('TEST_NUM');

            // Assert
            expect(result).toBeNull();
        });

        it('should return null if the variable is not set', () => {
            // Act
            const result = getNumberEnv('NONEXISTENT_NUM');

            // Assert
            expect(result).toBeNull();
        });
    });

    describe('getLogLevelEnv', () => {
        it('should return valid LogLevel for valid values', () => {
            // Arrange
            vi.stubEnv('TEST_LEVEL', 'debug');

            // Act
            const result = getLogLevelEnv('TEST_LEVEL');

            // Assert
            expect(result).toBe(LogLevel.DEBUG);
        });

        it('should return null for invalid log level', () => {
            // Arrange
            vi.stubEnv('TEST_LEVEL', 'verbose');

            // Act
            const result = getLogLevelEnv('TEST_LEVEL');

            // Assert
            expect(result).toBeNull();
        });

        it('should return null if not set', () => {
            // Act
            const result = getLogLevelEnv('NONEXISTENT_LEVEL');

            // Assert
            expect(result).toBeNull();
        });
    });

    describe('getLogFormatEnv', () => {
        it('should return PRETTY for "pretty" (case-insensitive)', () => {
            // Arrange
            vi.stubEnv('TEST_FORMAT', 'pretty');

            // Act
            const result = getLogFormatEnv('TEST_FORMAT');

            // Assert
            expect(result).toBe(LogFormat.PRETTY);
        });

        it('should return JSON for "json" (case-insensitive)', () => {
            // Arrange
            vi.stubEnv('TEST_FORMAT', 'json');

            // Act
            const result = getLogFormatEnv('TEST_FORMAT');

            // Assert
            expect(result).toBe(LogFormat.JSON);
        });

        it('should return null for an invalid format', () => {
            // Arrange
            vi.stubEnv('TEST_FORMAT', 'xml');

            // Act
            const result = getLogFormatEnv('TEST_FORMAT');

            // Assert
            expect(result).toBeNull();
        });

        it('should return null if not set', () => {
            // Act
            const result = getLogFormatEnv('NONEXISTENT_FORMAT');

            // Assert
            expect(result).toBeNull();
        });
    });

    describe('getConfigFromEnv', () => {
        it('should use LOG_ prefix without categoryKey', () => {
            // Arrange
            vi.stubEnv('LOG_LEVEL', 'WARN');
            vi.stubEnv('LOG_SAVE', 'true');

            // Act
            const config = getConfigFromEnv();

            // Assert
            expect(config.LEVEL).toBe(LogLevel.WARN);
            expect(config.SAVE).toBe(true);
        });

        it('should use LOG_{CATEGORY}_ prefix with categoryKey', () => {
            // Arrange
            vi.stubEnv('LOG_AUTH_LEVEL', 'ERROR');
            vi.stubEnv('LOG_AUTH_SAVE', 'true');

            // Act
            const config = getConfigFromEnv('AUTH');

            // Assert
            expect(config.LEVEL).toBe(LogLevel.ERROR);
            expect(config.SAVE).toBe(true);
        });

        it('should fall back to LOG_ prefix when category-specific var is not set', () => {
            // Arrange
            vi.stubEnv('LOG_LEVEL', 'INFO');

            // Act
            const config = getConfigFromEnv('DB');

            // Assert
            expect(config.LEVEL).toBe(LogLevel.INFO);
        });

        it('should return Partial<BaseLoggerConfig>', () => {
            // Arrange
            vi.stubEnv('LOG_LEVEL', 'DEBUG');
            vi.stubEnv('LOG_TRUNCATE_LONG_TEXT', 'false');

            // Act
            const config = getConfigFromEnv();

            // Assert
            expect(config.LEVEL).toBe(LogLevel.DEBUG);
            expect(config.TRUNCATE_LONG_TEXT).toBe(false);
            // Fields not set in env should be absent
            expect(config.EXPAND_OBJECT_LEVELS).toBeUndefined();
        });

        it('should read LOG_LEVEL, LOG_SAVE, LOG_TRUNCATE_LONG_TEXT correctly', () => {
            // Arrange
            vi.stubEnv('LOG_LEVEL', 'ERROR');
            vi.stubEnv('LOG_SAVE', 'true');
            vi.stubEnv('LOG_TRUNCATE_LONG_TEXT', 'false');

            // Act
            const config = getConfigFromEnv();

            // Assert
            expect(config.LEVEL).toBe(LogLevel.ERROR);
            expect(config.SAVE).toBe(true);
            expect(config.TRUNCATE_LONG_TEXT).toBe(false);
        });

        it('should read LOG_FORMAT correctly', () => {
            // Arrange
            vi.stubEnv('LOG_FORMAT', 'json');

            // Act
            const config = getConfigFromEnv();

            // Assert
            expect(config.FORMAT).toBe(LogFormat.JSON);
        });

        it('should use category-specific LOG_{CATEGORY}_FORMAT over LOG_FORMAT', () => {
            // Arrange
            vi.stubEnv('LOG_FORMAT', 'pretty');
            vi.stubEnv('LOG_AUTH_FORMAT', 'json');

            // Act
            const config = getConfigFromEnv('AUTH');

            // Assert
            expect(config.FORMAT).toBe(LogFormat.JSON);
        });

        it('should fall back to LOG_FORMAT when category-specific format is not set', () => {
            // Arrange
            vi.stubEnv('LOG_FORMAT', 'json');

            // Act
            const config = getConfigFromEnv('DB');

            // Assert
            expect(config.FORMAT).toBe(LogFormat.JSON);
        });

        it('should leave FORMAT absent when LOG_FORMAT is not set', () => {
            // Act
            const config = getConfigFromEnv();

            // Assert
            expect(config.FORMAT).toBeUndefined();
        });

        it('should read LOG_STRINGIFY_OBJECTS correctly', () => {
            // Arrange
            vi.stubEnv('LOG_STRINGIFY_OBJECTS', 'true');

            // Act
            const config = getConfigFromEnv();

            // Assert
            expect(config.STRINGIFY_OBJECTS).toBe(true);
        });

        it('should read LOG_EXPAND_OBJECT_LEVELS correctly', () => {
            // Arrange
            vi.stubEnv('LOG_EXPAND_OBJECT_LEVELS', '3');

            // Act
            const config = getConfigFromEnv();

            // Assert
            expect(config.EXPAND_OBJECT_LEVELS).toBe(3);
        });

        it('should read LOG_TRUNCATE_LONG_TEXT_AT correctly', () => {
            // Arrange
            vi.stubEnv('LOG_TRUNCATE_LONG_TEXT_AT', '150');

            // Act
            const config = getConfigFromEnv();

            // Assert
            expect(config.TRUNCATE_LONG_TEXT_AT).toBe(150);
        });

        it('should read LOG_TRUNCATE_LONG_TEXT_ON_ERROR correctly', () => {
            // Arrange
            vi.stubEnv('LOG_TRUNCATE_LONG_TEXT_ON_ERROR', 'true');

            // Act
            const config = getConfigFromEnv();

            // Assert
            expect(config.TRUNCATE_LONG_TEXT_ON_ERROR).toBe(true);
        });

        it('should return empty object when no env vars are defined', () => {
            // Act
            const config = getConfigFromEnv();

            // Assert
            expect(Object.keys(config).length).toBe(0);
        });

        it('should use LOG_ prefix for DEFAULT categoryKey', () => {
            // Arrange
            vi.stubEnv('LOG_LEVEL', 'WARN');

            // Act
            const config = getConfigFromEnv('DEFAULT');

            // Assert
            expect(config.LEVEL).toBe(LogLevel.WARN);
        });
    });
});
