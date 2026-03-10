/**
 * @repo/feedback - useKeyboardShortcut hook.
 *
 * Registers the configured keyboard shortcut to open/close the feedback form.
 */
import { useEffect } from 'react';
import { FEEDBACK_CONFIG } from '../config/feedback.config.js';

/**
 * Input for `useKeyboardShortcut`.
 */
export interface UseKeyboardShortcutInput {
    /** Callback to invoke when the shortcut is detected */
    onToggle: () => void;
}

/**
 * Registers the keyboard shortcut to open or close the feedback form.
 *
 * The shortcut is read from {@link FEEDBACK_CONFIG.keyboardShortcut} and
 * defaults to Ctrl+Shift+F (or Cmd+Shift+F on macOS). The `metaKey`
 * (Cmd) is treated as equivalent to `ctrlKey` to support macOS users.
 *
 * The event listener is removed when the component unmounts or when
 * `onToggle` changes identity.
 *
 * @param input - Object containing the `onToggle` callback
 *
 * @example
 * ```tsx
 * function FeedbackFAB() {
 *   const [open, setOpen] = useState(false);
 *   useKeyboardShortcut({ onToggle: () => setOpen(prev => !prev) });
 *   return open ? <FeedbackModal /> : null;
 * }
 * ```
 */
export function useKeyboardShortcut({ onToggle }: UseKeyboardShortcutInput): void {
    useEffect(() => {
        const { key, ctrl, shift } = FEEDBACK_CONFIG.keyboardShortcut;

        function handleKeyDown(event: KeyboardEvent) {
            // Skip shortcut when focus is inside text inputs to avoid
            // interfering with typing (e.g., Ctrl+Shift+F in a textarea)
            const target = event.target as HTMLElement | null;
            if (target) {
                const tagName = target.tagName;
                if (
                    tagName === 'INPUT' ||
                    tagName === 'TEXTAREA' ||
                    tagName === 'SELECT' ||
                    target.isContentEditable
                ) {
                    return;
                }
            }

            const isCtrlOrCmd = ctrl ? event.ctrlKey || event.metaKey : true;
            const isShift = shift ? event.shiftKey : true;

            if (isCtrlOrCmd && isShift && event.key.toLowerCase() === key) {
                event.preventDefault();
                onToggle();
            }
        }

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onToggle]);
}
