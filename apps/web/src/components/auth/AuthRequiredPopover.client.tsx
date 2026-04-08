/**
 * @file AuthRequiredPopover.client.tsx
 * @description Contextual popover prompting unauthenticated users to sign in or register.
 *
 * Shown when an unauthenticated user attempts a protected action (e.g. adding a favorite).
 * Closes on Escape key, click-outside, or the close button.
 * Styled with CSS Modules using design tokens from global.css (no Tailwind).
 */

import { FavoriteIcon, UserIcon } from '@repo/icons';
import type { JSX } from 'react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/cn';
import styles from './AuthRequiredPopover.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Props for the AuthRequiredPopover component.
 */
export interface AuthRequiredPopoverProps {
    /** Message displayed in the popover header */
    readonly message: string;
    /** Called when the user closes the popover */
    readonly onClose: () => void;
    /** Current locale for building auth page URLs. Defaults to 'es'. */
    readonly locale?: 'es' | 'en' | 'pt';
    /** Current page URL to return to after sign-in. Defaults to empty string. */
    readonly returnUrl?: string;
    /** Additional CSS class to apply to the popover container */
    readonly className?: string;
    /** Accessible label for the dialog. Defaults to 'Autenticacion requerida'. */
    readonly dialogLabel?: string;
    /** Accessible label for the close button. Defaults to 'Cerrar'. */
    readonly closeLabel?: string;
    /** Sign-in button text. Defaults to 'Iniciar sesion'. */
    readonly signInLabel?: string;
    /** Register button text. Defaults to 'Crear cuenta'. */
    readonly registerLabel?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * AuthRequiredPopover displays a contextual prompt for unauthenticated users.
 *
 * @example
 * ```tsx
 * <AuthRequiredPopover
 *   message="Debes iniciar sesion para guardar favoritos"
 *   onClose={() => setShowPopover(false)}
 *   locale="es"
 *   returnUrl={window.location.pathname}
 * />
 * ```
 */
export function AuthRequiredPopover({
    message,
    onClose,
    locale = 'es',
    returnUrl = '',
    className = '',
    dialogLabel = 'Autenticacion requerida',
    closeLabel = 'Cerrar',
    signInLabel = 'Iniciar sesion',
    registerLabel = 'Crear cuenta'
}: AuthRequiredPopoverProps): JSX.Element {
    const popoverRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    const loginHref = `/${locale}/auth/signin/?returnUrl=${encodeURIComponent(returnUrl)}`;
    const registerHref = `/${locale}/auth/signup/`;

    // Animate in on mount using a rAF to allow the initial hidden state to paint first.
    useEffect(() => {
        const frame = requestAnimationFrame(() => setIsVisible(true));
        return () => cancelAnimationFrame(frame);
    }, []);

    // Close on Escape key.
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Close on click outside the popover.
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent): void => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    return (
        <div
            ref={popoverRef}
            // biome-ignore lint/a11y/useSemanticElements: Using div with role="dialog" for a non-modal popover
            role="dialog"
            aria-label={dialogLabel}
            className={cn(
                styles.popover,
                isVisible ? styles.popoverVisible : styles.popoverHidden,
                className
            )}
        >
            {/* Arrow pointing up toward the trigger button */}
            <div
                aria-hidden="true"
                className={styles.arrow}
            />

            {/* Close button */}
            <button
                type="button"
                onClick={onClose}
                aria-label={closeLabel}
                className={styles.closeButton}
            >
                <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    aria-hidden="true"
                >
                    <path
                        d="M9 3L3 9M3 3l6 6"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                    />
                </svg>
            </button>

            {/* Header strip with icon and message */}
            <div className={styles.header}>
                <div className={styles.iconWrapper}>
                    <FavoriteIcon
                        size={16}
                        weight="duotone"
                        aria-hidden="true"
                    />
                </div>
                <p className={styles.message}>{message}</p>
            </div>

            {/* Action buttons */}
            <div className={styles.actions}>
                <a
                    href={loginHref}
                    className={styles.signInButton}
                >
                    <UserIcon
                        size={14}
                        weight="bold"
                        aria-hidden="true"
                    />
                    {signInLabel}
                </a>
                <a
                    href={registerHref}
                    className={styles.registerButton}
                >
                    {registerLabel}
                </a>
            </div>
        </div>
    );
}
