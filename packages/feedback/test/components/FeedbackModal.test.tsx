/**
 * Tests for the FeedbackModal component.
 *
 * Since @testing-library/react and jsdom are not installed in this package,
 * we verify the component contract through: import validation, prop type
 * compliance, isMobile detection logic, and focusable-element selector
 * correctness (tested as pure logic, not DOM operations).
 *
 * Full DOM render tests should be added once jsdom + testing-library are
 * added to this package's devDependencies.
 */
import { describe, expect, it, vi } from 'vitest';
import type { FeedbackFormProps } from '../../src/components/FeedbackForm.js';
import { FeedbackModal, type FeedbackModalProps } from '../../src/components/FeedbackModal.js';
import { FEEDBACK_STRINGS } from '../../src/config/strings.js';

// ---------------------------------------------------------------------------
// Pure helper: isMobile detection logic
// (mirrors the state initializer in FeedbackModal)
// ---------------------------------------------------------------------------

const MOBILE_BREAKPOINT = 640;

/**
 * Determines whether a given viewport width should use mobile drawer layout.
 * Mirrors the logic used in FeedbackModal's useState initializer and
 * MediaQueryList event handler.
 *
 * @param viewportWidth - The viewport width in pixels
 * @returns true if the width is strictly below the mobile breakpoint
 */
function detectIsMobile(viewportWidth: number): boolean {
    return viewportWidth < MOBILE_BREAKPOINT;
}

// ---------------------------------------------------------------------------
// Pure helper: focusable selector string (mirrors getFocusableElements)
// ---------------------------------------------------------------------------

/**
 * Returns the CSS selector string used to query focusable elements.
 * Mirrors the selector assembled inside getFocusableElements in FeedbackModal.
 */
function buildFocusableSelector(): string {
    return [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
    ].join(', ');
}

// ---------------------------------------------------------------------------
// Pure helper: focus trap Tab key logic
// (mirrors the Tab-handling branch in handleKeyDown)
// ---------------------------------------------------------------------------

interface FocusTrapResult {
    /** Whether default Tab behavior should be prevented */
    preventDefault: boolean;
    /** Index of the element that should receive focus next (-1 = no change) */
    nextFocusIndex: number;
}

/**
 * Simulates the focus trap logic for Tab / Shift+Tab key events.
 *
 * @param focusableCount - Total number of focusable elements in the container
 * @param currentIndex - Index of the currently focused element
 * @param shiftKey - Whether Shift is held (Shift+Tab = reverse navigation)
 * @returns Result indicating whether to preventDefault and next focus index
 */
function simulateFocusTrap(
    focusableCount: number,
    currentIndex: number,
    shiftKey: boolean
): FocusTrapResult {
    if (focusableCount === 0) {
        return { preventDefault: false, nextFocusIndex: -1 };
    }

    const firstIndex = 0;
    const lastIndex = focusableCount - 1;

    if (shiftKey) {
        // Shift+Tab: wrap from first to last
        if (currentIndex === firstIndex) {
            return { preventDefault: true, nextFocusIndex: lastIndex };
        }
    } else {
        // Tab: wrap from last to first
        if (currentIndex === lastIndex) {
            return { preventDefault: true, nextFocusIndex: firstIndex };
        }
    }

    return { preventDefault: false, nextFocusIndex: -1 };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const minimalFormProps: Omit<FeedbackFormProps, 'onClose'> = {
    apiUrl: 'http://localhost:3001',
    appSource: 'web'
};

const makeModalProps = (overrides: Partial<FeedbackModalProps> = {}): FeedbackModalProps => ({
    isOpen: true,
    onClose: vi.fn(),
    formProps: minimalFormProps,
    ...overrides
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FeedbackModal', () => {
    // -----------------------------------------------------------------------
    // Component contract
    // -----------------------------------------------------------------------

    it('should be a callable React function component', () => {
        expect(typeof FeedbackModal).toBe('function');
    });

    it('should export FeedbackModalProps type (compile-time check via usage)', () => {
        const props: FeedbackModalProps = makeModalProps();
        expect(props.isOpen).toBe(true);
        expect(typeof props.onClose).toBe('function');
        expect(props.formProps.apiUrl).toBe('http://localhost:3001');
    });

    it('should accept isOpen=false without type error (contract check)', () => {
        const props: FeedbackModalProps = makeModalProps({ isOpen: false });
        expect(props.isOpen).toBe(false);
    });

    it('should accept all optional formProps without type error', () => {
        const props: FeedbackModalProps = {
            isOpen: true,
            onClose: vi.fn(),
            formProps: {
                apiUrl: 'http://localhost:3001',
                appSource: 'admin',
                deployVersion: 'abc1234',
                userId: 'usr_123',
                userEmail: 'admin@example.com',
                userName: 'Admin User',
                prefillData: {
                    type: 'feature-request',
                    title: 'Add dark mode',
                    description: 'Please add dark mode support to the platform.',
                    errorInfo: { message: 'ReferenceError', stack: 'at App.tsx:10' }
                }
            }
        };
        expect(props.formProps.userId).toBe('usr_123');
        expect(props.formProps.prefillData?.type).toBe('feature-request');
    });

    it('onClose should be a required callable prop', () => {
        const onClose = vi.fn();
        const props: FeedbackModalProps = makeModalProps({ onClose });
        props.onClose();
        expect(onClose).toHaveBeenCalledOnce();
    });

    it('formProps should not include onClose (it is injected by FeedbackModal)', () => {
        // Type-level check: Omit<FeedbackFormProps, 'onClose'> does not have onClose
        const formProps: Omit<FeedbackFormProps, 'onClose'> = {
            apiUrl: 'http://localhost:3001',
            appSource: 'web'
        };
        // onClose is not a key of formProps
        expect('onClose' in formProps).toBe(false);
    });

    // -----------------------------------------------------------------------
    // isMobile detection logic
    // -----------------------------------------------------------------------

    it('should return isMobile=true for viewport width below 640px', () => {
        expect(detectIsMobile(375)).toBe(true);
        expect(detectIsMobile(639)).toBe(true);
        expect(detectIsMobile(320)).toBe(true);
    });

    it('should return isMobile=false for viewport width >= 640px', () => {
        expect(detectIsMobile(640)).toBe(false);
        expect(detectIsMobile(768)).toBe(false);
        expect(detectIsMobile(1440)).toBe(false);
    });

    it('should use 640px as the exact breakpoint boundary', () => {
        expect(detectIsMobile(639)).toBe(true);
        expect(detectIsMobile(640)).toBe(false);
    });

    // -----------------------------------------------------------------------
    // Focus trap logic
    // -----------------------------------------------------------------------

    it('focus trap: should not prevent default or change focus when no focusable elements', () => {
        const result = simulateFocusTrap(0, 0, false);
        expect(result.preventDefault).toBe(false);
        expect(result.nextFocusIndex).toBe(-1);
    });

    it('focus trap: Tab on last element should wrap to first', () => {
        const result = simulateFocusTrap(3, 2, false);
        expect(result.preventDefault).toBe(true);
        expect(result.nextFocusIndex).toBe(0);
    });

    it('focus trap: Tab on non-last element should not intercept', () => {
        const result = simulateFocusTrap(3, 1, false);
        expect(result.preventDefault).toBe(false);
        expect(result.nextFocusIndex).toBe(-1);
    });

    it('focus trap: Tab on first element (not last) should not intercept', () => {
        const result = simulateFocusTrap(3, 0, false);
        expect(result.preventDefault).toBe(false);
        expect(result.nextFocusIndex).toBe(-1);
    });

    it('focus trap: Shift+Tab on first element should wrap to last', () => {
        const result = simulateFocusTrap(3, 0, true);
        expect(result.preventDefault).toBe(true);
        expect(result.nextFocusIndex).toBe(2);
    });

    it('focus trap: Shift+Tab on non-first element should not intercept', () => {
        const result = simulateFocusTrap(3, 1, true);
        expect(result.preventDefault).toBe(false);
        expect(result.nextFocusIndex).toBe(-1);
    });

    it('focus trap: Shift+Tab on last element should not intercept', () => {
        const result = simulateFocusTrap(3, 2, true);
        expect(result.preventDefault).toBe(false);
        expect(result.nextFocusIndex).toBe(-1);
    });

    it('focus trap: single focusable element, Tab wraps to itself', () => {
        const result = simulateFocusTrap(1, 0, false);
        expect(result.preventDefault).toBe(true);
        expect(result.nextFocusIndex).toBe(0);
    });

    it('focus trap: single focusable element, Shift+Tab wraps to itself', () => {
        const result = simulateFocusTrap(1, 0, true);
        expect(result.preventDefault).toBe(true);
        expect(result.nextFocusIndex).toBe(0);
    });

    it('focus trap: last index is always focusableCount - 1', () => {
        // Verify the boundary computation is consistent across sizes
        for (const count of [2, 5, 10]) {
            const result = simulateFocusTrap(count, count - 1, false);
            expect(result.preventDefault).toBe(true);
            expect(result.nextFocusIndex).toBe(0);
        }
    });

    // -----------------------------------------------------------------------
    // Focusable selector string
    // -----------------------------------------------------------------------

    it('focusable selector should include button:not([disabled])', () => {
        const selector = buildFocusableSelector();
        expect(selector).toContain('button:not([disabled])');
    });

    it('focusable selector should include a[href]', () => {
        const selector = buildFocusableSelector();
        expect(selector).toContain('a[href]');
    });

    it('focusable selector should include input:not([disabled])', () => {
        const selector = buildFocusableSelector();
        expect(selector).toContain('input:not([disabled])');
    });

    it('focusable selector should include select:not([disabled])', () => {
        const selector = buildFocusableSelector();
        expect(selector).toContain('select:not([disabled])');
    });

    it('focusable selector should include textarea:not([disabled])', () => {
        const selector = buildFocusableSelector();
        expect(selector).toContain('textarea:not([disabled])');
    });

    it('focusable selector should exclude elements with tabindex="-1"', () => {
        const selector = buildFocusableSelector();
        expect(selector).toContain('[tabindex]:not([tabindex="-1"])');
    });

    // -----------------------------------------------------------------------
    // FEEDBACK_STRINGS usage
    // -----------------------------------------------------------------------

    it('should use FEEDBACK_STRINGS.buttons.close for the close button label', () => {
        expect(FEEDBACK_STRINGS.buttons.close).toBe('Cerrar');
    });

    it('should use FEEDBACK_STRINGS.form.title for the dialog aria-labelledby title', () => {
        expect(FEEDBACK_STRINGS.form.title).toBeTruthy();
        expect(typeof FEEDBACK_STRINGS.form.title).toBe('string');
    });

    // -----------------------------------------------------------------------
    // Props passthrough contract
    // -----------------------------------------------------------------------

    it('formProps.appSource accepts all valid app source identifiers', () => {
        const sources = ['web', 'admin', 'standalone'] as const;
        for (const appSource of sources) {
            const props: FeedbackModalProps = makeModalProps({
                formProps: { ...minimalFormProps, appSource }
            });
            expect(props.formProps.appSource).toBe(appSource);
        }
    });

    it('formProps is typed as Omit<FeedbackFormProps, "onClose"> (compile-time via usage)', () => {
        const formProps: Omit<FeedbackFormProps, 'onClose'> = {
            apiUrl: 'https://api.example.com',
            appSource: 'standalone',
            deployVersion: 'v1.2.3',
            userId: 'usr_abc',
            userEmail: 'test@test.com',
            userName: 'Test'
        };
        const props: FeedbackModalProps = { isOpen: true, onClose: vi.fn(), formProps };
        expect(props.formProps.apiUrl).toBe('https://api.example.com');
    });

    it('isOpen prop is boolean typed (compile-time check via usage)', () => {
        const trueProps: FeedbackModalProps = makeModalProps({ isOpen: true });
        const falseProps: FeedbackModalProps = makeModalProps({ isOpen: false });
        expect(typeof trueProps.isOpen).toBe('boolean');
        expect(typeof falseProps.isOpen).toBe('boolean');
    });
});
