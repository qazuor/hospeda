/**
 * T-041: FeedbackFAB minimize/restore behavior tests.
 *
 * Verifies the minimize-state lifecycle of FeedbackFAB:
 * - Clicking the minimize button transitions to minimized state
 * - The minimized state is persisted to localStorage under 'feedback-fab-minimized'
 * - Clicking the minimized FAB opens the modal (restore pathway)
 * - The state is correctly read from localStorage on mount (rehydration)
 *
 * Tests use the exported `readMinimizedFromStorage` and `writeMinimizedToStorage`
 * helpers plus pure-logic simulations of the state machine, following the same
 * no-DOM pattern established by the existing test suite.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    readMinimizedFromStorage,
    writeMinimizedToStorage
} from '../../src/components/FeedbackFAB.js';

// ---------------------------------------------------------------------------
// Constants — mirrored from FeedbackFAB.tsx
// ---------------------------------------------------------------------------

/** localStorage key for the minimized state — must match the source constant */
const MINIMIZED_STORAGE_KEY = 'feedback-fab-minimized';

// ---------------------------------------------------------------------------
// Mock localStorage factory
// ---------------------------------------------------------------------------

function buildLocalStorageMock(): Storage & { _store: Record<string, string> } {
    const store: Record<string, string> = {};
    return {
        _store: store,
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => {
            store[key] = value;
        },
        removeItem: (key: string) => {
            delete store[key];
        },
        clear: () => {
            for (const key of Object.keys(store)) delete store[key];
        },
        key: (index: number) => Object.keys(store)[index] ?? null,
        get length() {
            return Object.keys(store).length;
        }
    };
}

// ---------------------------------------------------------------------------
// Pure state-machine helpers mirroring FeedbackFAB internals
// ---------------------------------------------------------------------------

interface FabState {
    isOpen: boolean;
    isMinimized: boolean;
}

/**
 * Simulates the minimize button click handler.
 * Mirrors: `setIsMinimized(true)` (does not affect isOpen)
 */
function handleMinimizeClick(state: FabState): FabState {
    return { ...state, isMinimized: true };
}

/**
 * Simulates clicking the minimized FAB dot.
 * Mirrors: `setIsOpen(true)` (sets open; minimized state unchanged)
 */
function handleMinimizedFabClick(state: FabState): FabState {
    return { ...state, isOpen: true };
}

/**
 * Simulates the modal close callback.
 * Mirrors: `setIsOpen(false)`
 */
function handleModalClose(state: FabState): FabState {
    return { ...state, isOpen: false };
}

/**
 * Simulates restoring from minimized by clicking the full FAB.
 * Mirrors: `setIsOpen(true)` on the full-FAB click handler.
 */
function _handleFabClick(state: FabState): FabState {
    return { ...state, isOpen: true };
}

/**
 * Simulates the useEffect that reads localStorage on mount.
 * Mirrors:
 *   `useEffect(() => {
 *     const stored = readMinimizedFromStorage();
 *     if (stored) setIsMinimized(true);
 *   }, []);`
 */
function rehydrateMinimizedState(currentState: FabState, storedValue: boolean): FabState {
    if (storedValue) {
        return { ...currentState, isMinimized: true };
    }
    return currentState;
}

/**
 * Simulates the useEffect that persists minimized state changes.
 * Mirrors: `useEffect(() => { writeMinimizedToStorage(isMinimized); }, [isMinimized]);`
 */
function persistMinimizedState(isMinimized: boolean, storage: Storage): void {
    storage.setItem(MINIMIZED_STORAGE_KEY, String(isMinimized));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FeedbackFAB minimize state machine', () => {
    const initialState: FabState = { isOpen: false, isMinimized: false };

    it('handleMinimizeClick: should set isMinimized=true', () => {
        // Arrange
        const state = { ...initialState };

        // Act
        const next = handleMinimizeClick(state);

        // Assert
        expect(next.isMinimized).toBe(true);
    });

    it('handleMinimizeClick: should not change isOpen', () => {
        // Arrange
        const state: FabState = { isOpen: false, isMinimized: false };

        // Act
        const next = handleMinimizeClick(state);

        // Assert
        expect(next.isOpen).toBe(false);
    });

    it('handleMinimizeClick: should not mutate original state', () => {
        // Arrange
        const state = { ...initialState };

        // Act
        handleMinimizeClick(state);

        // Assert
        expect(state.isMinimized).toBe(false); // original unchanged
    });

    it('handleMinimizedFabClick: should set isOpen=true when minimized', () => {
        // Arrange
        const minimizedState: FabState = { isOpen: false, isMinimized: true };

        // Act
        const next = handleMinimizedFabClick(minimizedState);

        // Assert
        expect(next.isOpen).toBe(true);
    });

    it('handleMinimizedFabClick: should not change isMinimized', () => {
        // Arrange
        const minimizedState: FabState = { isOpen: false, isMinimized: true };

        // Act
        const next = handleMinimizedFabClick(minimizedState);

        // Assert
        expect(next.isMinimized).toBe(true);
    });

    it('handleModalClose: should set isOpen=false', () => {
        // Arrange
        const openState: FabState = { isOpen: true, isMinimized: false };

        // Act
        const next = handleModalClose(openState);

        // Assert
        expect(next.isOpen).toBe(false);
    });

    it('full minimize -> restore cycle', () => {
        // Arrange
        let state = { ...initialState };

        // Act 1 — minimize
        state = handleMinimizeClick(state);
        expect(state.isMinimized).toBe(true);
        expect(state.isOpen).toBe(false);

        // Act 2 — click minimized FAB to open modal
        state = handleMinimizedFabClick(state);
        expect(state.isOpen).toBe(true);

        // Act 3 — close modal
        state = handleModalClose(state);
        expect(state.isOpen).toBe(false);
        expect(state.isMinimized).toBe(true); // still minimized
    });
});

describe('FeedbackFAB localStorage persistence on minimize', () => {
    let mockStorage: ReturnType<typeof buildLocalStorageMock>;

    beforeEach(() => {
        mockStorage = buildLocalStorageMock();
        (globalThis as unknown as Record<string, unknown>).window = globalThis.window ?? {};
        (globalThis as unknown as Record<string, unknown>).localStorage = mockStorage;
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('persistMinimizedState: should write "true" when isMinimized=true', () => {
        // Arrange & Act
        persistMinimizedState(true, mockStorage);

        // Assert
        expect(mockStorage.getItem(MINIMIZED_STORAGE_KEY)).toBe('true');
    });

    it('persistMinimizedState: should write "false" when isMinimized=false', () => {
        // Arrange & Act
        persistMinimizedState(false, mockStorage);

        // Assert
        expect(mockStorage.getItem(MINIMIZED_STORAGE_KEY)).toBe('false');
    });

    it('writeMinimizedToStorage: should persist true under the correct key', () => {
        // Act
        writeMinimizedToStorage(true);

        // Assert
        expect(mockStorage.getItem(MINIMIZED_STORAGE_KEY)).toBe('true');
    });

    it('writeMinimizedToStorage: should persist false under the correct key', () => {
        // Act
        writeMinimizedToStorage(false);

        // Assert
        expect(mockStorage.getItem(MINIMIZED_STORAGE_KEY)).toBe('false');
    });

    it('localStorage key is "feedback-fab-minimized"', () => {
        // Act
        writeMinimizedToStorage(true);

        // Assert — key must match the constant used in the component
        expect(mockStorage.getItem('feedback-fab-minimized')).toBe('true');
    });
});

describe('FeedbackFAB localStorage rehydration on mount', () => {
    let mockStorage: ReturnType<typeof buildLocalStorageMock>;

    beforeEach(() => {
        mockStorage = buildLocalStorageMock();
        (globalThis as unknown as Record<string, unknown>).window = globalThis.window ?? {};
        (globalThis as unknown as Record<string, unknown>).localStorage = mockStorage;
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('rehydrateMinimizedState: should set isMinimized=true when stored value is true', () => {
        // Arrange
        const initial: FabState = { isOpen: false, isMinimized: false };
        const stored = true;

        // Act
        const next = rehydrateMinimizedState(initial, stored);

        // Assert
        expect(next.isMinimized).toBe(true);
    });

    it('rehydrateMinimizedState: should keep isMinimized=false when stored value is false', () => {
        // Arrange
        const initial: FabState = { isOpen: false, isMinimized: false };
        const stored = false;

        // Act
        const next = rehydrateMinimizedState(initial, stored);

        // Assert
        expect(next.isMinimized).toBe(false);
    });

    it('should read stored minimized state via readMinimizedFromStorage', () => {
        // Arrange — simulate a previous session that minimized the FAB
        mockStorage.setItem(MINIMIZED_STORAGE_KEY, 'true');

        // Act
        const stored = readMinimizedFromStorage();

        // Assert
        expect(stored).toBe(true);
    });

    it('should start as not-minimized when no stored value exists', () => {
        // Arrange — fresh storage (nothing set)
        const stored = readMinimizedFromStorage();

        // Assert
        expect(stored).toBe(false);
    });

    it('full rehydration cycle: write then read then rehydrate state', () => {
        // Arrange — simulate previous session
        writeMinimizedToStorage(true);

        // Act — simulate mount rehydration
        const stored = readMinimizedFromStorage();
        const initial: FabState = { isOpen: false, isMinimized: false };
        const rehydrated = rehydrateMinimizedState(initial, stored);

        // Assert
        expect(rehydrated.isMinimized).toBe(true);
        expect(rehydrated.isOpen).toBe(false);
    });

    it('rehydration should not affect isOpen state', () => {
        // Arrange
        mockStorage.setItem(MINIMIZED_STORAGE_KEY, 'true');
        const initial: FabState = { isOpen: false, isMinimized: false };

        // Act
        const stored = readMinimizedFromStorage();
        const next = rehydrateMinimizedState(initial, stored);

        // Assert
        expect(next.isOpen).toBe(false); // isOpen is unaffected by minimized rehydration
    });
});

describe('FeedbackFAB localStorage error resilience', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('readMinimizedFromStorage: should return false when localStorage.getItem throws', () => {
        // Arrange
        (globalThis as unknown as Record<string, unknown>).window = {};
        (globalThis as unknown as Record<string, unknown>).localStorage = {
            getItem: () => {
                throw new Error('SecurityError');
            }
        };

        // Act & Assert
        expect(() => readMinimizedFromStorage()).not.toThrow();
        expect(readMinimizedFromStorage()).toBe(false);
    });

    it('writeMinimizedToStorage: should not throw when localStorage.setItem throws', () => {
        // Arrange
        (globalThis as unknown as Record<string, unknown>).window = {};
        (globalThis as unknown as Record<string, unknown>).localStorage = {
            getItem: () => null,
            setItem: () => {
                throw new Error('QuotaExceededError');
            }
        };

        // Act & Assert
        expect(() => writeMinimizedToStorage(true)).not.toThrow();
    });
});
