/**
 * @file translation-init.test.ts
 *
 * Unit tests for the translation service singleton initialization.
 *
 * Covers uncovered lines from v8 report:
 *   - Lines 52-53: already-initialized branch (warn + return existing instance)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    _resetTranslationService,
    getTranslationService,
    initializeTranslationService
} from '../../src/translation/translation-init';

/** Minimal stub implementation of TranslationService. */
function makeTranslationStub() {
    return { translate: vi.fn().mockResolvedValue(undefined) };
}

describe('initializeTranslationService', () => {
    beforeEach(() => {
        // Reset singleton before each test to avoid cross-test contamination
        _resetTranslationService();
    });

    afterEach(() => {
        // Always clean up after test
        _resetTranslationService();
    });

    it('should store and return the provided service instance', () => {
        // Arrange
        const stub = makeTranslationStub();

        // Act
        const result = initializeTranslationService(stub);

        // Assert
        expect(result).toBe(stub);
        expect(getTranslationService()).toBe(stub);
    });

    it('should return the original instance when called a second time (already-initialized branch)', () => {
        // Arrange — initialize with the first service
        const firstStub = makeTranslationStub();
        const secondStub = makeTranslationStub();
        initializeTranslationService(firstStub);

        // Act — call again with a different stub; should be ignored
        const result = initializeTranslationService(secondStub);

        // Assert — original instance is returned, secondStub is never stored
        expect(result).toBe(firstStub);
        expect(getTranslationService()).toBe(firstStub);
    });
});

describe('getTranslationService', () => {
    beforeEach(() => {
        _resetTranslationService();
    });

    afterEach(() => {
        _resetTranslationService();
    });

    it('should return undefined when not yet initialized', () => {
        expect(getTranslationService()).toBeUndefined();
    });

    it('should return the initialized instance after initialization', () => {
        const stub = makeTranslationStub();
        initializeTranslationService(stub);
        expect(getTranslationService()).toBe(stub);
    });
});

describe('_resetTranslationService', () => {
    it('should clear the singleton so getTranslationService returns undefined', () => {
        // Arrange
        const stub = makeTranslationStub();
        initializeTranslationService(stub);
        expect(getTranslationService()).toBe(stub);

        // Act
        _resetTranslationService();

        // Assert
        expect(getTranslationService()).toBeUndefined();
    });
});
