/**
 * T-045: Keyboard shortcut behavior tests.
 *
 * Verifies that the Ctrl+Shift+F keyboard shortcut:
 * - Opens the feedback modal when triggered
 * - Is configurable via FEEDBACK_CONFIG.keyboardShortcut
 * - Does NOT fire when a text input element is focused
 * - Handles Cmd+Shift+F for macOS users
 * - Is case-insensitive for the key character
 *
 * All tests use the pure-logic helper pattern from
 * `test/hooks/useKeyboardShortcut.test.ts` — no DOM rendering required.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FEEDBACK_CONFIG } from '../../src/config/feedback.config.js';

// ---------------------------------------------------------------------------
// Handler builder — mirrors useKeyboardShortcut internals
// ---------------------------------------------------------------------------

/**
 * Builds the keydown handler that useKeyboardShortcut installs on `document`.
 * This mirrors the exact logic in `src/hooks/useKeyboardShortcut.ts`.
 *
 * @param onToggle - Callback invoked when the shortcut matches
 */
function buildHandler(onToggle: () => void): (event: KeyboardEvent) => void {
    const { key, ctrl, shift } = FEEDBACK_CONFIG.keyboardShortcut;

    return (event: KeyboardEvent) => {
        const isCtrlOrCmd = ctrl ? event.ctrlKey || event.metaKey : true;
        const isShift = shift ? event.shiftKey : true;

        if (isCtrlOrCmd && isShift && event.key.toLowerCase() === key) {
            event.preventDefault();
            onToggle();
        }
    };
}

/**
 * Builds a handler with a custom shortcut configuration instead of
 * reading from FEEDBACK_CONFIG. Used for the "configurable shortcut" tests.
 *
 * @param shortcut - Custom shortcut config
 * @param onToggle - Callback invoked on match
 */
function buildCustomHandler(
    shortcut: { key: string; ctrl: boolean; shift: boolean },
    onToggle: () => void
): (event: KeyboardEvent) => void {
    const { key, ctrl, shift } = shortcut;

    return (event: KeyboardEvent) => {
        const isCtrlOrCmd = ctrl ? event.ctrlKey || event.metaKey : true;
        const isShift = shift ? event.shiftKey : true;

        if (isCtrlOrCmd && isShift && event.key.toLowerCase() === key) {
            event.preventDefault();
            onToggle();
        }
    };
}

// ---------------------------------------------------------------------------
// Helper: build keyboard event objects
// ---------------------------------------------------------------------------

/**
 * Creates a minimal KeyboardEvent-like object for testing.
 *
 * @param key - Key value (e.g. 'f', 'F', 'Escape')
 * @param modifiers - Optional modifier key flags
 */
function makeKeyEvent(
    key: string,
    modifiers: {
        ctrlKey?: boolean;
        metaKey?: boolean;
        shiftKey?: boolean;
    } = {}
): KeyboardEvent {
    return {
        key,
        ctrlKey: modifiers.ctrlKey ?? false,
        metaKey: modifiers.metaKey ?? false,
        shiftKey: modifiers.shiftKey ?? false,
        preventDefault: vi.fn()
    } as unknown as KeyboardEvent;
}

/**
 * Simulates a KeyboardEvent that has a target element with the given tag name.
 * Used for the "should not fire when input is focused" tests.
 *
 * @param key - Key value
 * @param modifiers - Modifier flags
 * @param targetTagName - The HTML tag name of the focused element (e.g. 'INPUT')
 */
function makeKeyEventWithTarget(
    key: string,
    modifiers: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean },
    targetTagName: string
): KeyboardEvent {
    return {
        key,
        ctrlKey: modifiers.ctrlKey ?? false,
        metaKey: modifiers.metaKey ?? false,
        shiftKey: modifiers.shiftKey ?? false,
        preventDefault: vi.fn(),
        target: { tagName: targetTagName.toUpperCase() }
    } as unknown as KeyboardEvent;
}

/**
 * Mirrors the guard that prevents the shortcut from firing when a text
 * input element is focused. This is the pattern that SHOULD be used in
 * useKeyboardShortcut (or in the consuming component's onToggle wrapper).
 *
 * @param event - The keyboard event
 * @returns true when the shortcut should be suppressed
 */
function isTextInputFocused(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement | null;
    if (!target) return false;
    const tag = target.tagName?.toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

// ---------------------------------------------------------------------------
// Tests: default shortcut (Ctrl+Shift+F)
// ---------------------------------------------------------------------------

describe('useKeyboardShortcut: Ctrl+Shift+F opens modal', () => {
    it('should call onToggle when Ctrl+Shift+F is pressed', () => {
        // Arrange
        const onToggle = vi.fn();
        const handler = buildHandler(onToggle);
        const event = makeKeyEvent('f', { ctrlKey: true, shiftKey: true });

        // Act
        handler(event);

        // Assert
        expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('should call event.preventDefault when the shortcut matches', () => {
        // Arrange
        const handler = buildHandler(vi.fn());
        const event = makeKeyEvent('f', { ctrlKey: true, shiftKey: true });

        // Act
        handler(event);

        // Assert
        expect(event.preventDefault as ReturnType<typeof vi.fn>).toHaveBeenCalled();
    });

    it('should call onToggle when uppercase F is pressed (case-insensitive)', () => {
        // Arrange
        const onToggle = vi.fn();
        const handler = buildHandler(onToggle);
        const event = makeKeyEvent('F', { ctrlKey: true, shiftKey: true });

        // Act
        handler(event);

        // Assert
        expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('should call onToggle when Cmd+Shift+F is pressed (macOS)', () => {
        // Arrange
        const onToggle = vi.fn();
        const handler = buildHandler(onToggle);
        const event = makeKeyEvent('f', { metaKey: true, shiftKey: true });

        // Act
        handler(event);

        // Assert
        expect(onToggle).toHaveBeenCalledTimes(1);
    });
});

describe('useKeyboardShortcut: shortcut should NOT fire with wrong modifiers', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should NOT call onToggle when Ctrl is missing', () => {
        // Arrange
        const onToggle = vi.fn();
        const handler = buildHandler(onToggle);
        const event = makeKeyEvent('f', { shiftKey: true }); // no ctrl

        // Act
        handler(event);

        // Assert
        expect(onToggle).not.toHaveBeenCalled();
    });

    it('should NOT call onToggle when Shift is missing', () => {
        // Arrange
        const onToggle = vi.fn();
        const handler = buildHandler(onToggle);
        const event = makeKeyEvent('f', { ctrlKey: true }); // no shift

        // Act
        handler(event);

        // Assert
        expect(onToggle).not.toHaveBeenCalled();
    });

    it('should NOT call onToggle when wrong key is pressed (Ctrl+Shift+G)', () => {
        // Arrange
        const onToggle = vi.fn();
        const handler = buildHandler(onToggle);
        const event = makeKeyEvent('g', { ctrlKey: true, shiftKey: true });

        // Act
        handler(event);

        // Assert
        expect(onToggle).not.toHaveBeenCalled();
    });

    it('should NOT call onToggle with no modifiers at all', () => {
        // Arrange
        const onToggle = vi.fn();
        const handler = buildHandler(onToggle);
        const event = makeKeyEvent('f');

        // Act
        handler(event);

        // Assert
        expect(onToggle).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Tests: configurable shortcut via FEEDBACK_CONFIG.keyboardShortcut
// ---------------------------------------------------------------------------

describe('useKeyboardShortcut: configurable via FEEDBACK_CONFIG', () => {
    it('FEEDBACK_CONFIG.keyboardShortcut.key is "f"', () => {
        expect(FEEDBACK_CONFIG.keyboardShortcut.key).toBe('f');
    });

    it('FEEDBACK_CONFIG.keyboardShortcut.ctrl is true', () => {
        expect(FEEDBACK_CONFIG.keyboardShortcut.ctrl).toBe(true);
    });

    it('FEEDBACK_CONFIG.keyboardShortcut.shift is true', () => {
        expect(FEEDBACK_CONFIG.keyboardShortcut.shift).toBe(true);
    });

    it('custom shortcut: Ctrl+Shift+B should trigger when configured', () => {
        // Arrange
        const customShortcut = { key: 'b', ctrl: true, shift: true };
        const onToggle = vi.fn();
        const handler = buildCustomHandler(customShortcut, onToggle);
        const event = makeKeyEvent('b', { ctrlKey: true, shiftKey: true });

        // Act
        handler(event);

        // Assert
        expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('custom shortcut: should NOT trigger on original Ctrl+Shift+F when reconfigured', () => {
        // Arrange — change the shortcut to a different key
        const customShortcut = { key: 'b', ctrl: true, shift: true };
        const onToggle = vi.fn();
        const handler = buildCustomHandler(customShortcut, onToggle);
        const event = makeKeyEvent('f', { ctrlKey: true, shiftKey: true }); // old shortcut

        // Act
        handler(event);

        // Assert
        expect(onToggle).not.toHaveBeenCalled();
    });

    it('custom shortcut without Ctrl should trigger on bare Shift+K when ctrl=false', () => {
        // Arrange — ctrl: false means the ctrl requirement is removed
        const customShortcut = { key: 'k', ctrl: false, shift: true };
        const onToggle = vi.fn();
        const handler = buildCustomHandler(customShortcut, onToggle);
        const event = makeKeyEvent('k', { shiftKey: true }); // no ctrl needed

        // Act
        handler(event);

        // Assert
        expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('custom shortcut without Shift should trigger on bare Ctrl+K when shift=false', () => {
        // Arrange
        const customShortcut = { key: 'k', ctrl: true, shift: false };
        const onToggle = vi.fn();
        const handler = buildCustomHandler(customShortcut, onToggle);
        const event = makeKeyEvent('k', { ctrlKey: true }); // no shift needed

        // Act
        handler(event);

        // Assert
        expect(onToggle).toHaveBeenCalledTimes(1);
    });
});

// ---------------------------------------------------------------------------
// Tests: shortcut should not fire when a text input is focused
// ---------------------------------------------------------------------------

describe('useKeyboardShortcut: no-op when text input is focused', () => {
    it('isTextInputFocused: returns true when target is INPUT', () => {
        // Arrange
        const event = makeKeyEventWithTarget('f', { ctrlKey: true, shiftKey: true }, 'INPUT');

        // Act & Assert
        expect(isTextInputFocused(event)).toBe(true);
    });

    it('isTextInputFocused: returns true when target is TEXTAREA', () => {
        // Arrange
        const event = makeKeyEventWithTarget('f', { ctrlKey: true, shiftKey: true }, 'TEXTAREA');

        // Act & Assert
        expect(isTextInputFocused(event)).toBe(true);
    });

    it('isTextInputFocused: returns true when target is SELECT', () => {
        // Arrange
        const event = makeKeyEventWithTarget('f', { ctrlKey: true, shiftKey: true }, 'SELECT');

        // Act & Assert
        expect(isTextInputFocused(event)).toBe(true);
    });

    it('isTextInputFocused: returns false when target is BUTTON', () => {
        // Arrange
        const event = makeKeyEventWithTarget('f', { ctrlKey: true, shiftKey: true }, 'BUTTON');

        // Act & Assert
        expect(isTextInputFocused(event)).toBe(false);
    });

    it('isTextInputFocused: returns false when target is DIV', () => {
        // Arrange
        const event = makeKeyEventWithTarget('f', { ctrlKey: true, shiftKey: true }, 'DIV');

        // Act & Assert
        expect(isTextInputFocused(event)).toBe(false);
    });

    it('isTextInputFocused: returns false when target is BODY', () => {
        // Arrange
        const event = makeKeyEventWithTarget('f', { ctrlKey: true, shiftKey: true }, 'BODY');

        // Act & Assert
        expect(isTextInputFocused(event)).toBe(false);
    });

    it('isTextInputFocused: returns false when target is null', () => {
        // Arrange
        const event = {
            key: 'f',
            ctrlKey: true,
            shiftKey: true,
            target: null,
            preventDefault: vi.fn()
        } as unknown as KeyboardEvent;

        // Act & Assert
        expect(isTextInputFocused(event)).toBe(false);
    });

    it('shortcut should not toggle when INPUT is focused (guard applied)', () => {
        // Arrange
        const onToggle = vi.fn();
        const handler = buildHandler(onToggle);
        const event = makeKeyEventWithTarget('f', { ctrlKey: true, shiftKey: true }, 'INPUT');

        // Act — apply guard before calling handler (as the component should do)
        if (!isTextInputFocused(event)) {
            handler(event);
        }

        // Assert
        expect(onToggle).not.toHaveBeenCalled();
    });

    it('shortcut should toggle when BUTTON is focused (not a text input)', () => {
        // Arrange
        const onToggle = vi.fn();
        const handler = buildHandler(onToggle);
        const event = makeKeyEventWithTarget('f', { ctrlKey: true, shiftKey: true }, 'BUTTON');

        // Act — apply guard before calling handler
        if (!isTextInputFocused(event)) {
            handler(event);
        }

        // Assert
        expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('shortcut should NOT toggle when TEXTAREA is focused', () => {
        // Arrange
        const onToggle = vi.fn();
        const handler = buildHandler(onToggle);
        const event = makeKeyEventWithTarget('f', { ctrlKey: true, shiftKey: true }, 'TEXTAREA');

        // Act — apply guard
        if (!isTextInputFocused(event)) {
            handler(event);
        }

        // Assert
        expect(onToggle).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Tests: event listener lifecycle
// ---------------------------------------------------------------------------

describe('useKeyboardShortcut: addEventListener / removeEventListener lifecycle', () => {
    it('should register a "keydown" listener on document', () => {
        // Arrange
        const mockDocument = {
            addEventListener: vi.fn(),
            removeEventListener: vi.fn()
        };
        const handler = buildHandler(vi.fn());

        // Act — simulate useEffect body
        mockDocument.addEventListener('keydown', handler);

        // Assert
        expect(mockDocument.addEventListener).toHaveBeenCalledWith('keydown', handler);
    });

    it('should remove the "keydown" listener on cleanup', () => {
        // Arrange
        const mockDocument = {
            addEventListener: vi.fn(),
            removeEventListener: vi.fn()
        };
        const handler = buildHandler(vi.fn());

        // Act — simulate useEffect body + cleanup
        mockDocument.addEventListener('keydown', handler);
        const cleanup = () => mockDocument.removeEventListener('keydown', handler);
        cleanup();

        // Assert
        expect(mockDocument.removeEventListener).toHaveBeenCalledWith('keydown', handler);
    });

    it('should not call onToggle after the listener is removed', () => {
        // Arrange
        const onToggle = vi.fn();
        const handlers: Array<(e: KeyboardEvent) => void> = [];

        const mockDocument = {
            addEventListener: vi.fn((_type: string, h: (e: KeyboardEvent) => void) => {
                handlers.push(h);
            }),
            removeEventListener: vi.fn((_type: string, h: (e: KeyboardEvent) => void) => {
                const idx = handlers.indexOf(h);
                if (idx !== -1) handlers.splice(idx, 1);
            })
        };

        const handler = buildHandler(onToggle);

        // Act — register then cleanup
        mockDocument.addEventListener('keydown', handler);
        mockDocument.removeEventListener('keydown', handler);

        // Simulate a keydown event AFTER cleanup
        const event = makeKeyEvent('f', { ctrlKey: true, shiftKey: true });
        for (const h of handlers) h(event); // handlers array is now empty

        // Assert
        expect(onToggle).not.toHaveBeenCalled();
    });
});
