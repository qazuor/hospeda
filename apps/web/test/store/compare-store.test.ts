/**
 * @file compare-store.test.ts
 * @description Tests for the global accommodation comparison store.
 *
 * Covers: add (including deduplication), remove, toggle, clear, isInCompare,
 * subscribe/unsubscribe, and a localStorage round-trip.
 *
 * The store is a module-level singleton; each test starts from a clean state
 * via `clearCompare()` + `localStorage.clear()` in `beforeEach`/`afterEach`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    addToCompare,
    clearCompare,
    getSnapshot,
    isInCompare,
    loadFromStorage,
    removeFromCompare,
    subscribe,
    toggleCompare
} from '../../src/store/compare-store';

const STORAGE_KEY = 'hospeda:compare:v1';

describe('compare-store', () => {
    beforeEach(() => {
        clearCompare();
        localStorage.clear();
    });

    afterEach(() => {
        clearCompare();
        localStorage.clear();
    });

    // -----------------------------------------------------------------------
    // addToCompare
    // -----------------------------------------------------------------------

    describe('addToCompare', () => {
        it('adds a new id and updates the snapshot', () => {
            // Arrange / Act
            addToCompare('acc-1');

            // Assert
            expect(getSnapshot().ids).toEqual(['acc-1']);
            expect(isInCompare('acc-1')).toBe(true);
        });

        it('ignores a duplicate id (deduplication, no change in length)', () => {
            // Arrange
            addToCompare('acc-1');

            // Act — same id again
            addToCompare('acc-1');

            // Assert
            expect(getSnapshot().ids).toHaveLength(1);
        });

        it('does not notify listeners when the id is a duplicate', () => {
            // Arrange
            addToCompare('acc-1');
            const listener = vi.fn();
            const unsub = subscribe(listener);

            // Act — duplicate; store must not emit
            addToCompare('acc-1');

            // Assert
            expect(listener).not.toHaveBeenCalled();
            unsub();
        });

        it('preserves insertion order across multiple ids', () => {
            // Arrange / Act
            addToCompare('acc-1');
            addToCompare('acc-2');
            addToCompare('acc-3');

            // Assert
            expect(getSnapshot().ids).toEqual(['acc-1', 'acc-2', 'acc-3']);
        });
    });

    // -----------------------------------------------------------------------
    // removeFromCompare
    // -----------------------------------------------------------------------

    describe('removeFromCompare', () => {
        it('removes a present id and keeps the rest', () => {
            // Arrange
            addToCompare('acc-1');
            addToCompare('acc-2');

            // Act
            removeFromCompare('acc-1');

            // Assert
            expect(isInCompare('acc-1')).toBe(false);
            expect(isInCompare('acc-2')).toBe(true);
            expect(getSnapshot().ids).toHaveLength(1);
        });

        it('is a no-op for an absent id (same snapshot reference)', () => {
            // Arrange
            addToCompare('acc-1');
            const before = getSnapshot();

            // Act — id not in list
            removeFromCompare('acc-9999');

            // Assert — reference unchanged; no re-render scheduled
            expect(getSnapshot()).toBe(before);
        });

        it('does not notify listeners when the id is absent', () => {
            // Arrange
            addToCompare('acc-1');
            const listener = vi.fn();
            const unsub = subscribe(listener);

            // Act
            removeFromCompare('acc-9999');

            // Assert
            expect(listener).not.toHaveBeenCalled();
            unsub();
        });
    });

    // -----------------------------------------------------------------------
    // toggleCompare
    // -----------------------------------------------------------------------

    describe('toggleCompare', () => {
        it('adds the id when not present', () => {
            // Arrange / Act
            toggleCompare('acc-1');

            // Assert
            expect(isInCompare('acc-1')).toBe(true);
        });

        it('removes the id when already present', () => {
            // Arrange
            addToCompare('acc-1');

            // Act
            toggleCompare('acc-1');

            // Assert
            expect(isInCompare('acc-1')).toBe(false);
        });

        it('adds back after a second toggle', () => {
            // Arrange
            toggleCompare('acc-1'); // add
            toggleCompare('acc-1'); // remove

            // Act
            toggleCompare('acc-1'); // add again

            // Assert
            expect(isInCompare('acc-1')).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // clearCompare
    // -----------------------------------------------------------------------

    describe('clearCompare', () => {
        it('removes all ids at once', () => {
            // Arrange
            addToCompare('acc-1');
            addToCompare('acc-2');

            // Act
            clearCompare();

            // Assert
            expect(getSnapshot().ids).toHaveLength(0);
        });

        it('is a no-op on an already-empty store (same snapshot reference)', () => {
            // Arrange — store is empty after beforeEach
            const before = getSnapshot();
            expect(before.ids).toHaveLength(0);

            // Act
            clearCompare();

            // Assert — no new snapshot created, no listeners notified
            expect(getSnapshot()).toBe(before);
        });

        it('does not notify listeners when already empty', () => {
            // Arrange
            const listener = vi.fn();
            const unsub = subscribe(listener);

            // Act — store already empty
            clearCompare();

            // Assert
            expect(listener).not.toHaveBeenCalled();
            unsub();
        });
    });

    // -----------------------------------------------------------------------
    // isInCompare
    // -----------------------------------------------------------------------

    describe('isInCompare', () => {
        it('returns true for a present id', () => {
            // Arrange
            addToCompare('acc-1');

            // Assert
            expect(isInCompare('acc-1')).toBe(true);
        });

        it('returns false for an absent id', () => {
            // Assert
            expect(isInCompare('acc-9999')).toBe(false);
        });

        it('returns false after the id is removed', () => {
            // Arrange
            addToCompare('acc-1');
            removeFromCompare('acc-1');

            // Assert
            expect(isInCompare('acc-1')).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // subscribe / unsubscribe
    // -----------------------------------------------------------------------

    describe('subscribe', () => {
        it('notifies the listener when state changes', () => {
            // Arrange
            const listener = vi.fn();
            const unsub = subscribe(listener);

            // Act
            addToCompare('acc-1');

            // Assert
            expect(listener).toHaveBeenCalledTimes(1);
            unsub();
        });

        it('stops notifying after unsubscribe', () => {
            // Arrange
            const listener = vi.fn();
            const unsub = subscribe(listener);
            unsub();

            // Act
            addToCompare('acc-1');

            // Assert
            expect(listener).not.toHaveBeenCalled();
        });

        it('notifies all active listeners on each change', () => {
            // Arrange
            const listenerA = vi.fn();
            const listenerB = vi.fn();
            const unsubA = subscribe(listenerA);
            const unsubB = subscribe(listenerB);

            // Act
            addToCompare('acc-1');

            // Assert
            expect(listenerA).toHaveBeenCalledTimes(1);
            expect(listenerB).toHaveBeenCalledTimes(1);
            unsubA();
            unsubB();
        });

        it('returns a working unsubscribe function on every call', () => {
            // Arrange
            const listener = vi.fn();
            const unsub = subscribe(listener);

            // Act — verify the returned function is callable and removes the listener
            unsub();
            addToCompare('acc-1');

            // Assert
            expect(listener).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // localStorage persistence
    // -----------------------------------------------------------------------

    describe('localStorage persistence', () => {
        it('writes ids to localStorage on addToCompare', () => {
            // Arrange / Act
            addToCompare('id-1');
            addToCompare('id-2');

            // Assert
            const raw = localStorage.getItem(STORAGE_KEY);
            expect(JSON.parse(raw ?? 'null')).toEqual(['id-1', 'id-2']);
        });

        it('writes updated ids to localStorage on removeFromCompare', () => {
            // Arrange
            addToCompare('id-1');
            addToCompare('id-2');

            // Act
            removeFromCompare('id-1');

            // Assert
            const raw = localStorage.getItem(STORAGE_KEY);
            expect(JSON.parse(raw ?? 'null')).toEqual(['id-2']);
        });

        it('writes an empty array to localStorage on clearCompare', () => {
            // Arrange
            addToCompare('id-1');

            // Act
            clearCompare();

            // Assert
            const raw = localStorage.getItem(STORAGE_KEY);
            expect(JSON.parse(raw ?? 'null')).toEqual([]);
        });

        it('localStorage round-trip: mutation persists and loadFromStorage restores', () => {
            // Arrange: add IDs (they are written to localStorage immediately)
            addToCompare('id-x');
            addToCompare('id-y');

            const raw = localStorage.getItem(STORAGE_KEY);
            expect(JSON.parse(raw ?? 'null')).toEqual(['id-x', 'id-y']);

            // Act: simulate module re-init (fresh page load reads from localStorage)
            loadFromStorage();

            // Assert: state matches what was persisted
            expect(isInCompare('id-x')).toBe(true);
            expect(isInCompare('id-y')).toBe(true);
            expect(getSnapshot().ids).toHaveLength(2);
        });

        it('loadFromStorage reads pre-populated localStorage (simulates page reload)', () => {
            // Arrange: pre-populate localStorage directly (simulates a previous session)
            localStorage.setItem(STORAGE_KEY, JSON.stringify(['id-a', 'id-b', 'id-c']));

            // Act: simulate module initialisation
            loadFromStorage();

            // Assert
            expect(isInCompare('id-a')).toBe(true);
            expect(isInCompare('id-b')).toBe(true);
            expect(isInCompare('id-c')).toBe(true);
            expect(getSnapshot().ids).toHaveLength(3);
        });

        it('tolerates malformed JSON gracefully (resets to empty)', () => {
            // Arrange
            localStorage.setItem(STORAGE_KEY, '{not:valid{{json}}');

            // Act
            loadFromStorage();

            // Assert
            expect(getSnapshot().ids).toHaveLength(0);
        });

        it('tolerates a non-array JSON value (resets to empty)', () => {
            // Arrange
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ ids: ['acc-1'] }));

            // Act
            loadFromStorage();

            // Assert
            expect(getSnapshot().ids).toHaveLength(0);
        });

        it('filters out non-string entries from a mixed array', () => {
            // Arrange
            localStorage.setItem(STORAGE_KEY, JSON.stringify(['id-1', 42, null, true, 'id-2']));

            // Act
            loadFromStorage();

            // Assert
            expect(getSnapshot().ids).toEqual(['id-1', 'id-2']);
        });

        it('handles a missing localStorage key (keeps empty state)', () => {
            // Arrange — localStorage is already cleared in beforeEach

            // Act
            loadFromStorage();

            // Assert
            expect(getSnapshot().ids).toHaveLength(0);
        });
    });
});
