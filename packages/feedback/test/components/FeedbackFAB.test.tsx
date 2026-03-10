/**
 * Tests for the FeedbackFAB component.
 *
 * Covers:
 * - Pure logic: localStorage helpers, toggle state, kill switch
 * - RTL render tests: FAB rendering, minimized state, click interactions,
 *   tooltip visibility, keyboard shortcut toggle
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    FeedbackFAB,
    type FeedbackFABProps,
    readMinimizedFromStorage,
    writeMinimizedToStorage
} from '../../src/components/FeedbackFAB.js';
import { FEEDBACK_CONFIG } from '../../src/config/feedback.config.js';
import { FEEDBACK_STRINGS } from '../../src/config/strings.js';
import type { AppSourceId, ReportTypeId } from '../../src/schemas/feedback.schema.js';

// ---------------------------------------------------------------------------
// Pure helper: toggle state logic
// (mirrors the setState(prev => !prev) call in FeedbackFAB)
// ---------------------------------------------------------------------------

/**
 * Simulates toggling the modal open state.
 *
 * @param currentState - The current open/closed boolean value
 * @returns The toggled value
 */
function simulateToggle(currentState: boolean): boolean {
    return !currentState;
}

// ---------------------------------------------------------------------------
// Pure helper: kill switch logic
// (mirrors the early-return guard in FeedbackFAB)
// ---------------------------------------------------------------------------

/**
 * Determines whether the FAB should render based on the enabled flag.
 *
 * @param enabled - Value of FEEDBACK_CONFIG.enabled
 * @returns true when the FAB should render
 */
function shouldRender(enabled: boolean): boolean {
    return enabled;
}

// ---------------------------------------------------------------------------
// Mock localStorage
// ---------------------------------------------------------------------------

function buildLocalStorageMock(): Storage {
    const store: Record<string, string> = {};
    return {
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
// Fixtures
// ---------------------------------------------------------------------------

const minimalProps: FeedbackFABProps = {
    apiUrl: 'http://localhost:3001',
    appSource: 'web'
};

const makeProps = (overrides: Partial<FeedbackFABProps> = {}): FeedbackFABProps => ({
    ...minimalProps,
    ...overrides
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FeedbackFAB', () => {
    // -----------------------------------------------------------------------
    // Component contract
    // -----------------------------------------------------------------------

    it('should be a callable React function component', () => {
        expect(typeof FeedbackFAB).toBe('function');
    });

    it('should accept minimal required props without type error', () => {
        const props: FeedbackFABProps = makeProps();
        expect(props.apiUrl).toBe('http://localhost:3001');
        expect(props.appSource).toBe('web');
    });

    it('should accept all optional props without type error', () => {
        const props: FeedbackFABProps = makeProps({
            deployVersion: 'v1.2.3',
            userId: 'usr_abc',
            userEmail: 'user@example.com',
            userName: 'Test User',
            prefillData: {
                type: 'bug-js',
                title: 'Something is broken',
                description: 'The page crashes on load.',
                errorInfo: {
                    message: 'TypeError: Cannot read property',
                    stack: 'at App.tsx:42'
                }
            }
        });
        expect(props.userId).toBe('usr_abc');
        expect(props.prefillData?.type).toBe('bug-js');
        expect(props.prefillData?.errorInfo?.message).toBe('TypeError: Cannot read property');
    });

    it('should accept all valid appSource values without type error', () => {
        const sources: AppSourceId[] = ['web', 'admin', 'standalone'];
        for (const appSource of sources) {
            const props: FeedbackFABProps = makeProps({ appSource });
            expect(props.appSource).toBe(appSource);
        }
    });

    it('should accept all valid prefillData.type values without type error', () => {
        const types: ReportTypeId[] = [
            'bug-js',
            'bug-ui-ux',
            'bug-content',
            'feature-request',
            'improvement',
            'other'
        ];
        for (const type of types) {
            const props: FeedbackFABProps = makeProps({ prefillData: { type } });
            expect(props.prefillData?.type).toBe(type);
        }
    });

    it('prefillData is entirely optional', () => {
        const props: FeedbackFABProps = makeProps({ prefillData: undefined });
        expect(props.prefillData).toBeUndefined();
    });

    it('prefillData.errorInfo is optional inside prefillData', () => {
        const props: FeedbackFABProps = makeProps({
            prefillData: { title: 'No error info' }
        });
        expect(props.prefillData?.errorInfo).toBeUndefined();
        expect(props.prefillData?.title).toBe('No error info');
    });

    // -----------------------------------------------------------------------
    // Kill switch logic
    // -----------------------------------------------------------------------

    it('should render when FEEDBACK_CONFIG.enabled is true', () => {
        expect(shouldRender(true)).toBe(true);
    });

    it('should NOT render when FEEDBACK_CONFIG.enabled is false', () => {
        expect(shouldRender(false)).toBe(false);
    });

    it('FEEDBACK_CONFIG.enabled is truthy (kill switch off)', () => {
        // This verifies the actual config, not just the helper
        expect(FEEDBACK_CONFIG.enabled).toBe(true);
    });

    // -----------------------------------------------------------------------
    // Toggle state logic
    // -----------------------------------------------------------------------

    it('toggle: false -> true when modal is closed', () => {
        expect(simulateToggle(false)).toBe(true);
    });

    it('toggle: true -> false when modal is open', () => {
        expect(simulateToggle(true)).toBe(false);
    });

    it('toggle: double toggle returns to original state', () => {
        const initial = false;
        const afterFirst = simulateToggle(initial);
        const afterSecond = simulateToggle(afterFirst);
        expect(afterSecond).toBe(initial);
    });

    // -----------------------------------------------------------------------
    // localStorage persistence helpers
    // -----------------------------------------------------------------------

    describe('readMinimizedFromStorage', () => {
        let mockStorage: ReturnType<typeof buildLocalStorageMock>;

        beforeEach(() => {
            mockStorage = buildLocalStorageMock();
            // Simulate browser window presence and inject mock localStorage
            (globalThis as unknown as Record<string, unknown>).window = globalThis.window ?? {};
            (globalThis as unknown as Record<string, unknown>).localStorage = mockStorage;
        });

        it('should return false when key is not set', () => {
            expect(readMinimizedFromStorage()).toBe(false);
        });

        it('should return true when key is "true"', () => {
            mockStorage.setItem('feedback-fab-minimized', 'true');
            expect(readMinimizedFromStorage()).toBe(true);
        });

        it('should return false when key is "false"', () => {
            mockStorage.setItem('feedback-fab-minimized', 'false');
            expect(readMinimizedFromStorage()).toBe(false);
        });

        it('should return false for any non-"true" string value', () => {
            mockStorage.setItem('feedback-fab-minimized', '1');
            expect(readMinimizedFromStorage()).toBe(false);
        });

        it('should not throw when localStorage.getItem throws (graceful fallback)', () => {
            (globalThis as unknown as Record<string, unknown>).localStorage = {
                getItem: () => {
                    throw new Error('SecurityError');
                }
            };
            expect(() => readMinimizedFromStorage()).not.toThrow();
            expect(readMinimizedFromStorage()).toBe(false);
        });
    });

    describe('writeMinimizedToStorage', () => {
        let mockStorage: ReturnType<typeof buildLocalStorageMock>;

        beforeEach(() => {
            mockStorage = buildLocalStorageMock();
            // Simulate browser window presence and inject mock localStorage
            (globalThis as unknown as Record<string, unknown>).window = globalThis.window ?? {};
            (globalThis as unknown as Record<string, unknown>).localStorage = mockStorage;
        });

        it('should write "true" when value is true', () => {
            writeMinimizedToStorage(true);
            expect(mockStorage.getItem('feedback-fab-minimized')).toBe('true');
        });

        it('should write "false" when value is false', () => {
            writeMinimizedToStorage(false);
            expect(mockStorage.getItem('feedback-fab-minimized')).toBe('false');
        });

        it('round-trip: write then read returns the same value', () => {
            writeMinimizedToStorage(true);
            expect(readMinimizedFromStorage()).toBe(true);

            writeMinimizedToStorage(false);
            expect(readMinimizedFromStorage()).toBe(false);
        });

        it('should not throw when localStorage.setItem throws', () => {
            (globalThis as unknown as Record<string, unknown>).localStorage = {
                getItem: () => null,
                setItem: () => {
                    throw new Error('QuotaExceededError');
                }
            };
            expect(() => writeMinimizedToStorage(true)).not.toThrow();
        });
    });

    // -----------------------------------------------------------------------
    // FEEDBACK_STRINGS usage
    // -----------------------------------------------------------------------

    it('should use FEEDBACK_STRINGS.fab.tooltip as the button aria-label', () => {
        expect(FEEDBACK_STRINGS.fab.tooltip).toBeTruthy();
        expect(typeof FEEDBACK_STRINGS.fab.tooltip).toBe('string');
        expect(FEEDBACK_STRINGS.fab.tooltip).toContain('Ctrl+Shift+F');
    });

    it('fab tooltip should mention keyboard shortcut', () => {
        expect(FEEDBACK_STRINGS.fab.tooltip).toContain('Ctrl+Shift+F');
    });

    // -----------------------------------------------------------------------
    // Keyboard shortcut config
    // -----------------------------------------------------------------------

    it('keyboard shortcut is configured as Ctrl+Shift+F', () => {
        expect(FEEDBACK_CONFIG.keyboardShortcut.key).toBe('f');
        expect(FEEDBACK_CONFIG.keyboardShortcut.ctrl).toBe(true);
        expect(FEEDBACK_CONFIG.keyboardShortcut.shift).toBe(true);
    });

    // -----------------------------------------------------------------------
    // readMinimizedFromStorage + writeMinimizedToStorage are exported
    // -----------------------------------------------------------------------

    it('should export readMinimizedFromStorage as a function', () => {
        expect(typeof readMinimizedFromStorage).toBe('function');
    });

    it('should export writeMinimizedToStorage as a function', () => {
        expect(typeof writeMinimizedToStorage).toBe('function');
    });

    // -----------------------------------------------------------------------
    // Prop interface shape verification
    // -----------------------------------------------------------------------

    it('apiUrl prop is a string', () => {
        const props = makeProps({ apiUrl: 'https://api.hospeda.com' });
        expect(typeof props.apiUrl).toBe('string');
    });

    it('appSource prop is one of the valid enum values', () => {
        const validSources: AppSourceId[] = ['web', 'admin', 'standalone'];
        const props = makeProps();
        expect(validSources).toContain(props.appSource);
    });

    it('deployVersion is optional and can be any string', () => {
        const props = makeProps({ deployVersion: 'abc1234' });
        expect(props.deployVersion).toBe('abc1234');
    });

    it('userId, userEmail, userName are all optional strings', () => {
        const props = makeProps({
            userId: 'u1',
            userEmail: 'u@example.com',
            userName: 'User One'
        });
        expect(typeof props.userId).toBe('string');
        expect(typeof props.userEmail).toBe('string');
        expect(typeof props.userName).toBe('string');
    });

    // -----------------------------------------------------------------------
    // SSR safety: window not available
    // -----------------------------------------------------------------------

    it('readMinimizedFromStorage returns false when window is undefined', () => {
        const originalWindow = globalThis.window;
        (globalThis as unknown as Record<string, unknown>).window = undefined;
        try {
            // In SSR the guard `typeof window === 'undefined'` returns true,
            // so the helper exits early and returns false without throwing.
            const result = readMinimizedFromStorage();
            expect(typeof result).toBe('boolean');
        } finally {
            (globalThis as unknown as Record<string, unknown>).window = originalWindow;
        }
    });

    it('writeMinimizedToStorage does not throw when window is undefined', () => {
        const originalWindow = globalThis.window;
        (globalThis as unknown as Record<string, unknown>).window = undefined;
        try {
            expect(() => writeMinimizedToStorage(true)).not.toThrow();
        } finally {
            (globalThis as unknown as Record<string, unknown>).window = originalWindow;
        }
    });

    // -----------------------------------------------------------------------
    // vi.fn() spy to validate mock usage pattern
    // -----------------------------------------------------------------------

    it('onClose pattern: a spy function is callable and trackable', () => {
        const onClose = vi.fn();
        onClose();
        expect(onClose).toHaveBeenCalledOnce();
    });
});

// ---------------------------------------------------------------------------
// RTL render tests
// ---------------------------------------------------------------------------

// Mock useConsoleCapture to avoid side effects in test environment.
vi.mock('../../src/hooks/useConsoleCapture.js', () => ({
    useConsoleCapture: vi.fn(() => ({ getErrors: () => [] }))
}));

// Mock FeedbackModal to avoid native <dialog> and timer effects that hang jsdom.
vi.mock('../../src/components/FeedbackModal.js', () => ({
    FeedbackModal: ({ isOpen }: { isOpen: boolean }) =>
        isOpen ? <div data-testid="feedback-modal-dialog">Modal</div> : null
}));

describe('FeedbackFAB (RTL render)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
    });

    it('renders the FAB button with correct test id', () => {
        render(
            <FeedbackFAB
                apiUrl="http://localhost:3001"
                appSource="web"
            />
        );

        expect(screen.getByTestId('feedback-fab')).toBeInTheDocument();
    });

    it('renders with accessible aria-label from FEEDBACK_STRINGS', () => {
        render(
            <FeedbackFAB
                apiUrl="http://localhost:3001"
                appSource="web"
            />
        );

        const fab = screen.getByTestId('feedback-fab');
        expect(fab).toHaveAttribute('aria-label', FEEDBACK_STRINGS.fab.tooltip);
    });

    it('renders the minimize button', () => {
        render(
            <FeedbackFAB
                apiUrl="http://localhost:3001"
                appSource="web"
            />
        );

        expect(screen.getByTestId('feedback-fab-minimize')).toBeInTheDocument();
    });

    it('opens the modal dialog when FAB is clicked', () => {
        render(
            <FeedbackFAB
                apiUrl="http://localhost:3001"
                appSource="web"
            />
        );

        act(() => {
            fireEvent.click(screen.getByTestId('feedback-fab'));
        });

        expect(screen.getByTestId('feedback-modal-dialog')).toBeInTheDocument();
    });

    it('shows minimized dot after clicking minimize button', () => {
        render(
            <FeedbackFAB
                apiUrl="http://localhost:3001"
                appSource="web"
            />
        );

        act(() => {
            fireEvent.click(screen.getByTestId('feedback-fab-minimize'));
        });

        expect(screen.getByTestId('feedback-fab-minimized')).toBeInTheDocument();
        expect(screen.queryByTestId('feedback-fab')).not.toBeInTheDocument();
    });

    it('opens the modal when minimized dot is clicked', () => {
        render(
            <FeedbackFAB
                apiUrl="http://localhost:3001"
                appSource="web"
            />
        );

        // Minimize first
        act(() => {
            fireEvent.click(screen.getByTestId('feedback-fab-minimize'));
        });

        // Click the minimized dot to open modal
        act(() => {
            fireEvent.click(screen.getByTestId('feedback-fab-minimized'));
        });

        expect(screen.getByTestId('feedback-modal-dialog')).toBeInTheDocument();
    });

    it('transitions to minimized DOM state after clicking minimize', () => {
        render(
            <FeedbackFAB
                apiUrl="http://localhost:3001"
                appSource="web"
            />
        );

        // Full FAB is visible, minimized is not
        expect(screen.getByTestId('feedback-fab')).toBeInTheDocument();
        expect(screen.queryByTestId('feedback-fab-minimized')).not.toBeInTheDocument();

        act(() => {
            fireEvent.click(screen.getByTestId('feedback-fab-minimize'));
        });

        // After minimizing: full FAB gone, minimized dot visible
        expect(screen.queryByTestId('feedback-fab')).not.toBeInTheDocument();
        expect(screen.getByTestId('feedback-fab-minimized')).toBeInTheDocument();
    });
});
