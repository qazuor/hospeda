import { beforeEach, describe, expect, it } from 'vitest';
import { configureLogger, defaultConfig, getConfig, resetLoggerConfig } from '../src/config.js';
import { LogLevel } from '../src/types.js';

describe('config', () => {
    beforeEach(() => {
        resetLoggerConfig();
    });

    describe('getConfig', () => {
        it('should return current config with default values', () => {
            // Act
            const config = getConfig();

            // Assert
            expect(config.LEVEL).toBe(defaultConfig.LEVEL);
            expect(config.INCLUDE_TIMESTAMPS).toBe(true);
            expect(config.INCLUDE_LEVEL).toBe(true);
            expect(config.USE_COLORS).toBe(true);
            expect(config.SAVE).toBe(false);
            expect(config.EXPAND_OBJECT_LEVELS).toBe(2);
            expect(config.TRUNCATE_LONG_TEXT).toBe(true);
            expect(config.TRUNCATE_LONG_TEXT_AT).toBe(100);
            expect(config.TRUNCATE_LONG_TEXT_ON_ERROR).toBe(false);
            expect(config.STRINGIFY_OBJECTS).toBe(true);
        });

        it('should return a copy, not the internal reference', () => {
            // Act
            const config1 = getConfig();
            const config2 = getConfig();

            // Assert
            expect(config1).toEqual(config2);
            expect(config1).not.toBe(config2);
        });
    });

    describe('configureLogger', () => {
        it('should update config with partial merge', () => {
            // Act
            configureLogger({ LEVEL: LogLevel.DEBUG });

            // Assert
            const config = getConfig();
            expect(config.LEVEL).toBe(LogLevel.DEBUG);
        });

        it('should preserve unmodified fields on partial update', () => {
            // Arrange
            const originalConfig = getConfig();

            // Act
            configureLogger({ LEVEL: LogLevel.ERROR });

            // Assert
            const config = getConfig();
            expect(config.LEVEL).toBe(LogLevel.ERROR);
            expect(config.USE_COLORS).toBe(originalConfig.USE_COLORS);
            expect(config.INCLUDE_TIMESTAMPS).toBe(originalConfig.INCLUDE_TIMESTAMPS);
            expect(config.SAVE).toBe(originalConfig.SAVE);
            expect(config.EXPAND_OBJECT_LEVELS).toBe(originalConfig.EXPAND_OBJECT_LEVELS);
            expect(config.TRUNCATE_LONG_TEXT).toBe(originalConfig.TRUNCATE_LONG_TEXT);
        });

        it('should apply multiple fields at once', () => {
            // Act
            configureLogger({
                LEVEL: LogLevel.WARN,
                USE_COLORS: false,
                SAVE: true,
                TRUNCATE_LONG_TEXT_AT: 200
            });

            // Assert
            const config = getConfig();
            expect(config.LEVEL).toBe(LogLevel.WARN);
            expect(config.USE_COLORS).toBe(false);
            expect(config.SAVE).toBe(true);
            expect(config.TRUNCATE_LONG_TEXT_AT).toBe(200);
        });
    });

    describe('resetLoggerConfig', () => {
        it('should restore defaults after configuration changes', () => {
            // Arrange
            configureLogger({
                LEVEL: LogLevel.ERROR,
                USE_COLORS: false,
                SAVE: true
            });

            // Act
            resetLoggerConfig();

            // Assert
            const config = getConfig();
            expect(config.LEVEL).toBe(defaultConfig.LEVEL);
            expect(config.USE_COLORS).toBe(defaultConfig.USE_COLORS);
            expect(config.SAVE).toBe(defaultConfig.SAVE);
        });
    });
});
