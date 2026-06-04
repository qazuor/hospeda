/**
 * Tests for vitest.shared.config.ts — verifies the VITEST_MAX_FORKS env knob
 * is honoured and that the pool settings match the machine-safety spec (SC-3).
 *
 * Run standalone (does NOT require any package build):
 *   pnpm vitest run vitest.shared.config.test.ts
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveMaxForks, sharedTestConfig } from './vitest.shared.config';

// Capture the original env value so we can restore it after each test.
const ORIGINAL_MAX_FORKS = process.env.VITEST_MAX_FORKS;

/** Removes VITEST_MAX_FORKS from the environment entirely (not just sets to undefined). */
function clearMaxForks(): void {
    // biome-ignore lint/performance/noDelete: process.env.X = undefined sets the key to the STRING "undefined" — not the same as the key being absent. delete is the correct way to remove env keys in test cleanup.
    delete process.env.VITEST_MAX_FORKS;
}

describe('resolveMaxForks', () => {
    afterEach(() => {
        // Restore env after each test to avoid cross-test pollution.
        if (ORIGINAL_MAX_FORKS === undefined) {
            clearMaxForks();
        } else {
            process.env.VITEST_MAX_FORKS = ORIGINAL_MAX_FORKS;
        }
    });

    it('should return 3 (safe local default) when VITEST_MAX_FORKS is not set', () => {
        // Arrange
        clearMaxForks();

        // Act
        const result = resolveMaxForks();

        // Assert
        expect(result).toBe(3);
    });

    it('should return the parsed integer when VITEST_MAX_FORKS is set to a valid value', () => {
        // Arrange
        process.env.VITEST_MAX_FORKS = '2';

        // Act
        const result = resolveMaxForks();

        // Assert
        expect(result).toBe(2);
    });

    it('should return the CI override value (4) when VITEST_MAX_FORKS=4', () => {
        // Arrange — matches the value wired in ci.yml
        process.env.VITEST_MAX_FORKS = '4';

        // Act
        const result = resolveMaxForks();

        // Assert
        expect(result).toBe(4);
    });

    it('should return the local default when VITEST_MAX_FORKS is an empty string', () => {
        // Arrange
        process.env.VITEST_MAX_FORKS = '';

        // Act
        const result = resolveMaxForks();

        // Assert — empty string is not a valid integer, falls back to default
        expect(result).toBe(3);
    });

    it('should return the local default when VITEST_MAX_FORKS is not a number', () => {
        // Arrange
        process.env.VITEST_MAX_FORKS = 'auto';

        // Act
        const result = resolveMaxForks();

        // Assert
        expect(result).toBe(3);
    });

    it('should return the local default when VITEST_MAX_FORKS is zero', () => {
        // Arrange — zero is not a valid fork count
        process.env.VITEST_MAX_FORKS = '0';

        // Act
        const result = resolveMaxForks();

        // Assert
        expect(result).toBe(3);
    });

    it('should return the local default when VITEST_MAX_FORKS is negative', () => {
        // Arrange
        process.env.VITEST_MAX_FORKS = '-1';

        // Act
        const result = resolveMaxForks();

        // Assert
        expect(result).toBe(3);
    });
});

describe('sharedTestConfig', () => {
    beforeEach(() => {
        clearMaxForks();
    });

    afterEach(() => {
        if (ORIGINAL_MAX_FORKS === undefined) {
            clearMaxForks();
        } else {
            process.env.VITEST_MAX_FORKS = ORIGINAL_MAX_FORKS;
        }
    });

    it('should use forks pool (required for api native-addon compatibility)', () => {
        // Assert
        expect(sharedTestConfig.test.pool).toBe('forks');
    });

    it('should expose poolOptions.forks.maxForks with the value computed at import time', () => {
        // The config object is evaluated at module load time, so the maxForks
        // value reflects whatever VITEST_MAX_FORKS was set to when the module
        // was imported. This test verifies the structure is present and is a
        // positive integer.
        const maxForks = sharedTestConfig.test.poolOptions.forks.maxForks;

        expect(typeof maxForks).toBe('number');
        expect(maxForks).toBeGreaterThan(0);
        expect(Number.isInteger(maxForks)).toBe(true);
    });

    it('should have maxForks equal to resolveMaxForks() called with the same env as at import time', () => {
        // sharedTestConfig is frozen at module import time — its maxForks reflects
        // whatever VITEST_MAX_FORKS was when the module was first required. We
        // can't assert a specific value (3) here because the test runner may be
        // invoked with an env override (e.g. VITEST_MAX_FORKS=2 for this very
        // check). What we CAN assert is the structural guarantee: the frozen
        // config value must match what resolveMaxForks() returns when called with
        // the SAME env state that existed at import time (ORIGINAL_MAX_FORKS).
        const fromConfig = sharedTestConfig.test.poolOptions.forks.maxForks;

        // Temporarily restore the original env so resolveMaxForks reflects the
        // import-time env, then compare.
        const currentEnv = process.env.VITEST_MAX_FORKS;
        if (ORIGINAL_MAX_FORKS === undefined) {
            clearMaxForks();
        } else {
            process.env.VITEST_MAX_FORKS = ORIGINAL_MAX_FORKS;
        }
        const fromFnAtImportTime = resolveMaxForks();
        // Restore back to whatever beforeEach set.
        if (currentEnv === undefined) {
            clearMaxForks();
        } else {
            process.env.VITEST_MAX_FORKS = currentEnv;
        }

        // The frozen config value must equal the resolved value at import time.
        expect(fromConfig).toBe(fromFnAtImportTime);
        // Both must be positive integers (structural guarantee).
        expect(typeof fromConfig).toBe('number');
        expect(fromConfig).toBeGreaterThan(0);
    });
});
