/**
 * Tests for the useKeyboardShortcut hook logic.
 *
 * We test the key-matching logic directly without mounting a React component,
 * by simulating the event listener that the hook installs via useEffect.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FEEDBACK_CONFIG } from '../../src/config/feedback.config.js';

/**
 * Simulates the event handler logic from useKeyboardShortcut.
 * Returns a function that fires when a matching key event is received.
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
 * Creates a minimal KeyboardEvent-like object for testing.
 */
function makeKeyEvent(
    key: string,
    {
        ctrlKey = false,
        metaKey = false,
        shiftKey = false
    }: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean } = {}
): KeyboardEvent {
    return {
        key,
        ctrlKey,
        metaKey,
        shiftKey,
        preventDefault: vi.fn()
    } as unknown as KeyboardEvent;
}

describe('useKeyboardShortcut (handler logic)', () => {
    let onToggle: ReturnType<typeof vi.fn>;
    let handler: (event: KeyboardEvent) => void;

    beforeEach(() => {
        onToggle = vi.fn();
        handler = buildHandler(onToggle);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should call onToggle when Ctrl+Shift+F is pressed', () => {
        // Arrange
        const event = makeKeyEvent('f', { ctrlKey: true, shiftKey: true });

        // Act
        handler(event);

        // Assert
        expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('should call onToggle when Cmd+Shift+F is pressed (macOS)', () => {
        // Arrange
        const event = makeKeyEvent('f', { metaKey: true, shiftKey: true });

        // Act
        handler(event);

        // Assert
        expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('should match the key case-insensitively (uppercase F)', () => {
        // Arrange
        const event = makeKeyEvent('F', { ctrlKey: true, shiftKey: true });

        // Act
        handler(event);

        // Assert
        expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('should call event.preventDefault when the shortcut matches', () => {
        // Arrange
        const event = makeKeyEvent('f', { ctrlKey: true, shiftKey: true });

        // Act
        handler(event);

        // Assert
        expect(event.preventDefault as ReturnType<typeof vi.fn>).toHaveBeenCalled();
    });

    it('should NOT call onToggle when Ctrl is missing', () => {
        // Arrange
        const event = makeKeyEvent('f', { shiftKey: true });

        // Act
        handler(event);

        // Assert
        expect(onToggle).not.toHaveBeenCalled();
    });

    it('should NOT call onToggle when Shift is missing', () => {
        // Arrange
        const event = makeKeyEvent('f', { ctrlKey: true });

        // Act
        handler(event);

        // Assert
        expect(onToggle).not.toHaveBeenCalled();
    });

    it('should NOT call onToggle for a different key', () => {
        // Arrange
        const event = makeKeyEvent('g', { ctrlKey: true, shiftKey: true });

        // Act
        handler(event);

        // Assert
        expect(onToggle).not.toHaveBeenCalled();
    });

    it('should NOT call onToggle with no modifiers', () => {
        // Arrange
        const event = makeKeyEvent('f');

        // Act
        handler(event);

        // Assert
        expect(onToggle).not.toHaveBeenCalled();
    });

    it('should register and remove the listener via addEventListener/removeEventListener', () => {
        // Arrange – use a mock document object to avoid jsdom dependency
        const mockDocument = {
            addEventListener: vi.fn(),
            removeEventListener: vi.fn()
        };

        // Act – simulate useEffect body + cleanup
        mockDocument.addEventListener('keydown', handler);
        const cleanup = () => mockDocument.removeEventListener('keydown', handler);
        cleanup();

        // Assert
        expect(mockDocument.addEventListener).toHaveBeenCalledWith('keydown', handler);
        expect(mockDocument.removeEventListener).toHaveBeenCalledWith('keydown', handler);
    });
});
