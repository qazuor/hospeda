/**
 * @file compare-store.test.ts
 * @description Tests for the global accommodation comparison store.
 *
 * Covers: add (including deduplication), remove, toggle, clear, isInCompare,
 * subscribe/unsubscribe, a localStorage round-trip, and the compare-mode
 * sibling store (HOS-85: toggle, set, SSR default, persistence, and the
 * section-scoping helper).
 *
 * The store is a module-level singleton; each test starts from a clean state
 * via `clearCompare()` + `localStorage.clear()` in `beforeEach`/`afterEach`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    addToCompare,
    clearCompare,
    clearCompareModeIfOutsideSection,
    getCompareModeServerSnapshot,
    getCompareModeSnapshot,
    getSnapshot,
    isInCompare,
    loadCompareModeFromStorage,
    loadFromStorage,
    removeFromCompare,
    setCompareMode,
    subscribe,
    subscribeToCompareMode,
    toggleCompare,
    toggleCompareMode
} from '../../src/store/compare-store';

const STORAGE_KEY = 'hospeda:compare:v1';
const MODE_STORAGE_KEY = 'hospeda:compare:mode:v1';
const EXPIRY_STORAGE_KEY = 'hospeda:compare:savedAt:v1';
/** 7-day TTL mirrored from the store, for building fresh/stale timestamps. */
const COMPARE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

describe('compare-store', () => {
    beforeEach(() => {
        clearCompare();
        setCompareMode(false);
        localStorage.clear();
    });

    afterEach(() => {
        clearCompare();
        setCompareMode(false);
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
            // Arrange: pre-populate localStorage directly (simulates a previous
            // session — a real selection always carries a fresh TTL anchor)
            localStorage.setItem(STORAGE_KEY, JSON.stringify(['id-a', 'id-b', 'id-c']));
            localStorage.setItem(EXPIRY_STORAGE_KEY, JSON.stringify(Date.now()));

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
            localStorage.setItem(EXPIRY_STORAGE_KEY, JSON.stringify(Date.now()));

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

    // -----------------------------------------------------------------------
    // TTL / expiry (HOS-85 follow-up)
    // -----------------------------------------------------------------------

    describe('selection TTL', () => {
        it('restores a selection whose timestamp is within the TTL', () => {
            // Arrange — persisted one hour ago, well inside the 7-day window
            localStorage.setItem(STORAGE_KEY, JSON.stringify(['id-a', 'id-b']));
            localStorage.setItem(EXPIRY_STORAGE_KEY, JSON.stringify(Date.now() - 60 * 60 * 1000));

            // Act
            loadFromStorage();

            // Assert
            expect(getSnapshot().ids).toEqual(['id-a', 'id-b']);
        });

        it('discards a selection older than the TTL and clears its keys', () => {
            // Arrange — persisted 8 days ago (past the 7-day TTL)
            localStorage.setItem(STORAGE_KEY, JSON.stringify(['stale-1', 'stale-2']));
            localStorage.setItem(
                EXPIRY_STORAGE_KEY,
                JSON.stringify(Date.now() - (COMPARE_TTL_MS + 60_000))
            );

            // Act
            loadFromStorage();

            // Assert — in-memory reset AND persisted keys removed
            expect(getSnapshot().ids).toHaveLength(0);
            expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
            expect(localStorage.getItem(EXPIRY_STORAGE_KEY)).toBeNull();
        });

        it('discards a selection that carries no timestamp (unknown age)', () => {
            // Arrange — ids present but no TTL anchor (pre-TTL / legacy blob)
            localStorage.setItem(STORAGE_KEY, JSON.stringify(['legacy-1']));

            // Act
            loadFromStorage();

            // Assert
            expect(getSnapshot().ids).toHaveLength(0);
            expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
        });

        it('writes a TTL anchor whenever the selection is mutated', () => {
            // Arrange / Act
            addToCompare('acc-1');

            // Assert — a numeric, recent timestamp was persisted
            const raw = localStorage.getItem(EXPIRY_STORAGE_KEY);
            expect(raw).not.toBeNull();
            const savedAt = JSON.parse(raw ?? 'null');
            expect(typeof savedAt).toBe('number');
            expect(Date.now() - savedAt).toBeLessThan(5_000);
        });

        it('refreshes the TTL anchor on every change (sliding window)', () => {
            // Arrange
            addToCompare('acc-1');
            const first = JSON.parse(localStorage.getItem(EXPIRY_STORAGE_KEY) ?? 'null') as number;

            // Act — a later mutation must push the anchor forward
            vi.spyOn(Date, 'now').mockReturnValue(first + 10_000);
            addToCompare('acc-2');

            // Assert
            const second = JSON.parse(localStorage.getItem(EXPIRY_STORAGE_KEY) ?? 'null') as number;
            expect(second).toBeGreaterThan(first);

            vi.restoreAllMocks();
        });
    });

    // -----------------------------------------------------------------------
    // Compare mode (HOS-85)
    // -----------------------------------------------------------------------

    describe('compare mode', () => {
        describe('setCompareMode / toggleCompareMode', () => {
            it('defaults to false', () => {
                // Assert — reset to false in beforeEach
                expect(getCompareModeSnapshot()).toBe(false);
            });

            it('setCompareMode(true) turns mode on', () => {
                // Act
                setCompareMode(true);

                // Assert
                expect(getCompareModeSnapshot()).toBe(true);
            });

            it('setCompareMode(false) turns mode off', () => {
                // Arrange
                setCompareMode(true);

                // Act
                setCompareMode(false);

                // Assert
                expect(getCompareModeSnapshot()).toBe(false);
            });

            it('setCompareMode is a no-op when the value is unchanged (no listener notification)', () => {
                // Arrange
                const listener = vi.fn();
                const unsub = subscribeToCompareMode(listener);

                // Act — already false
                setCompareMode(false);

                // Assert
                expect(listener).not.toHaveBeenCalled();
                unsub();
            });

            it('toggleCompareMode flips false to true', () => {
                // Act
                toggleCompareMode();

                // Assert
                expect(getCompareModeSnapshot()).toBe(true);
            });

            it('toggleCompareMode flips true to false', () => {
                // Arrange
                setCompareMode(true);

                // Act
                toggleCompareMode();

                // Assert
                expect(getCompareModeSnapshot()).toBe(false);
            });

            it('notifies compare-mode subscribers on change', () => {
                // Arrange
                const listener = vi.fn();
                const unsub = subscribeToCompareMode(listener);

                // Act
                setCompareMode(true);

                // Assert
                expect(listener).toHaveBeenCalledTimes(1);
                unsub();
            });

            it('does not notify selection subscribers when mode changes', () => {
                // Arrange
                const listener = vi.fn();
                const unsub = subscribe(listener);

                // Act
                setCompareMode(true);

                // Assert
                expect(listener).not.toHaveBeenCalled();
                unsub();
            });
        });

        // ---------------------------------------------------------------------
        // SSR default
        // ---------------------------------------------------------------------

        describe('getCompareModeServerSnapshot', () => {
            it('always returns false, regardless of the in-memory flag', () => {
                // Arrange
                setCompareMode(true);

                // Assert — server snapshot is a stable constant, never client state
                expect(getCompareModeServerSnapshot()).toBe(false);
            });
        });

        // ---------------------------------------------------------------------
        // localStorage persistence
        // ---------------------------------------------------------------------

        describe('persistence', () => {
            it('writes the flag to localStorage on setCompareMode(true)', () => {
                // Act
                setCompareMode(true);

                // Assert
                expect(localStorage.getItem(MODE_STORAGE_KEY)).toBe('true');
            });

            it('writes the flag to localStorage on setCompareMode(false)', () => {
                // Arrange
                setCompareMode(true);

                // Act
                setCompareMode(false);

                // Assert
                expect(localStorage.getItem(MODE_STORAGE_KEY)).toBe('false');
            });

            it('persists across a simulated reload (loadCompareModeFromStorage restores true)', () => {
                // Arrange
                setCompareMode(true);

                // Act — simulate a fresh page load re-reading localStorage
                loadCompareModeFromStorage();

                // Assert
                expect(getCompareModeSnapshot()).toBe(true);
            });

            it('persists across a simulated reload (loadCompareModeFromStorage restores false)', () => {
                // Arrange
                setCompareMode(false);

                // Act
                loadCompareModeFromStorage();

                // Assert
                expect(getCompareModeSnapshot()).toBe(false);
            });

            it('loadCompareModeFromStorage reads pre-populated localStorage (simulates page reload)', () => {
                // Arrange — a previous session left mode enabled
                localStorage.setItem(MODE_STORAGE_KEY, 'true');

                // Act
                loadCompareModeFromStorage();

                // Assert
                expect(getCompareModeSnapshot()).toBe(true);
            });

            it('tolerates malformed JSON gracefully (resets to false)', () => {
                // Arrange
                setCompareMode(true);
                localStorage.setItem(MODE_STORAGE_KEY, '{not:valid{{json}}');

                // Act
                loadCompareModeFromStorage();

                // Assert
                expect(getCompareModeSnapshot()).toBe(false);
            });

            it('handles a missing localStorage key (defaults to false)', () => {
                // Arrange — localStorage is already cleared in beforeEach

                // Act
                loadCompareModeFromStorage();

                // Assert
                expect(getCompareModeSnapshot()).toBe(false);
            });

            it('does not touch selection storage keys', () => {
                // Arrange
                addToCompare('acc-1');

                // Act
                setCompareMode(true);

                // Assert — selection key untouched by a mode-only mutation
                expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toEqual(['acc-1']);
            });

            it('mode mutations do not touch the selection state', () => {
                // Arrange
                addToCompare('acc-1');

                // Act
                setCompareMode(true);
                toggleCompareMode();

                // Assert
                expect(getSnapshot().ids).toEqual(['acc-1']);
                expect(isInCompare('acc-1')).toBe(true);
            });
        });

        // ---------------------------------------------------------------------
        // clearCompareModeIfOutsideSection
        // ---------------------------------------------------------------------

        describe('clearCompareModeIfOutsideSection', () => {
            it.each([
                'es',
                'en',
                'pt'
            ])('leaves mode ON when pathname is under /%s/alojamientos/', (locale) => {
                // Arrange
                setCompareMode(true);

                // Act
                clearCompareModeIfOutsideSection(`/${locale}/alojamientos/`);

                // Assert
                expect(getCompareModeSnapshot()).toBe(true);
            });

            it('leaves mode ON for a nested path under the section (e.g. detail page)', () => {
                // Arrange
                setCompareMode(true);

                // Act
                clearCompareModeIfOutsideSection('/es/alojamientos/some-hotel-slug/');

                // Assert
                expect(getCompareModeSnapshot()).toBe(true);
            });

            it('leaves mode ON for the comparison page itself', () => {
                // Arrange
                setCompareMode(true);

                // Act
                clearCompareModeIfOutsideSection('/es/alojamientos/comparar/');

                // Assert
                expect(getCompareModeSnapshot()).toBe(true);
            });

            it.each([
                'es',
                'en',
                'pt'
            ])('turns mode OFF when pathname is outside the section (/%s/mi-cuenta/)', (locale) => {
                // Arrange
                setCompareMode(true);

                // Act
                clearCompareModeIfOutsideSection(`/${locale}/mi-cuenta/`);

                // Assert
                expect(getCompareModeSnapshot()).toBe(false);
            });

            it('turns mode OFF for the site root', () => {
                // Arrange
                setCompareMode(true);

                // Act
                clearCompareModeIfOutsideSection('/');

                // Assert
                expect(getCompareModeSnapshot()).toBe(false);
            });

            it('turns mode OFF for a path with an unsupported/missing locale prefix', () => {
                // Arrange
                setCompareMode(true);

                // Act
                clearCompareModeIfOutsideSection('/alojamientos/');

                // Assert
                expect(getCompareModeSnapshot()).toBe(false);
            });

            it('is a no-op (already off) when navigating outside the section with mode already off', () => {
                // Arrange
                const listener = vi.fn();
                const unsub = subscribeToCompareMode(listener);

                // Act — mode already false from beforeEach
                clearCompareModeIfOutsideSection('/es/mi-cuenta/');

                // Assert — no spurious notification
                expect(listener).not.toHaveBeenCalled();
                unsub();
            });

            it('clears the selection (not just the mode) when leaving the section', () => {
                // Arrange
                addToCompare('acc-1');
                addToCompare('acc-2');
                setCompareMode(true);

                // Act — navigating outside /alojamientos/*
                clearCompareModeIfOutsideSection('/es/mi-cuenta/');

                // Assert — both mode and selection are reset so "start comparing" begins empty
                expect(getCompareModeSnapshot()).toBe(false);
                expect(getSnapshot().ids).toEqual([]);
            });

            it('preserves the selection when staying inside the section (listing <-> detail)', () => {
                // Arrange
                addToCompare('acc-1');
                addToCompare('acc-2');
                setCompareMode(true);

                // Act — navigating to an accommodation detail page (still in-section)
                clearCompareModeIfOutsideSection('/es/alojamientos/some-hotel-slug/');

                // Assert — selection intact across listing <-> detail
                expect(getSnapshot().ids).toEqual(['acc-1', 'acc-2']);
            });
        });
    });
});
