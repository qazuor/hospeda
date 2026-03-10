/**
 * Test setup file for Vitest in the Feedback package.
 * Configures jsdom environment, React Testing Library, and browser API mocks
 * required by feedback components (matchMedia, HTMLDialogElement, localStorage).
 */

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Global environment
// ---------------------------------------------------------------------------

beforeAll(() => {
    process.env.NODE_ENV = 'test';
});

// ---------------------------------------------------------------------------
// Cleanup after each test
// ---------------------------------------------------------------------------

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// window.matchMedia mock
//
// jsdom does not implement matchMedia. FeedbackModal uses it to detect the
// mobile breakpoint and switch between drawer and modal layouts.
// ---------------------------------------------------------------------------

Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn(
        (query: string): MediaQueryList => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(), // deprecated but kept for compat
            removeListener: vi.fn(), // deprecated but kept for compat
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn()
        })
    )
});

// ---------------------------------------------------------------------------
// HTMLDialogElement mock
//
// jsdom does not implement the native <dialog> API. FeedbackModal calls
// dialogRef.current.showModal() and dialogRef.current.close() directly.
// ---------------------------------------------------------------------------

if (typeof HTMLDialogElement !== 'undefined') {
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn();
} else {
    // jsdom may not define HTMLDialogElement at all in some versions
    Object.defineProperty(globalThis, 'HTMLDialogElement', {
        writable: true,
        value: class HTMLDialogElement extends HTMLElement {
            showModal = vi.fn();
            close = vi.fn();
        }
    });
}

// ---------------------------------------------------------------------------
// localStorage mock
//
// FeedbackFAB persists the minimized state to localStorage. The in-memory
// implementation below keeps tests isolated from the real browser storage.
// ---------------------------------------------------------------------------

const localStorageStore: Record<string, string> = {};

const localStorageMock: Storage = {
    getItem: vi.fn((key: string): string | null => localStorageStore[key] ?? null),
    setItem: vi.fn((key: string, value: string): void => {
        localStorageStore[key] = value;
    }),
    removeItem: vi.fn((key: string): void => {
        delete localStorageStore[key];
    }),
    clear: vi.fn((): void => {
        for (const key of Object.keys(localStorageStore)) {
            delete localStorageStore[key];
        }
    }),
    key: vi.fn((index: number): string | null => Object.keys(localStorageStore)[index] ?? null),
    get length(): number {
        return Object.keys(localStorageStore).length;
    }
};

Object.defineProperty(window, 'localStorage', {
    writable: true,
    value: localStorageMock
});
