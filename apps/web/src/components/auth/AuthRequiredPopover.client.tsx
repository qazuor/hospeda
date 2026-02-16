import { useEffect, useRef } from 'react';
import type { JSX } from 'react';

/**
 * Props for the AuthRequiredPopover component
 */
export interface AuthRequiredPopoverProps {
    /** Message to display in the popover */
    readonly message: string;
    /** Callback function called when popover is closed */
    readonly onClose: () => void;
    /** Locale for link text (defaults to 'es') */
    readonly locale?: 'es' | 'en';
    /** URL to return to after login/registration */
    readonly returnUrl?: string;
    /** Additional CSS classes to apply to the popover container */
    readonly className?: string;
}

/**
 * AuthRequiredPopover component displays a contextual popover prompting users to log in or sign up.
 * The popover closes when:
 * - User presses the Escape key
 * - User clicks outside the popover
 * - User calls the onClose callback
 *
 * @example
 * ```tsx
 * <AuthRequiredPopover
 *   message="You must be logged in to save this item"
 *   onClose={() => setShowPopover(false)}
 *   locale="es"
 *   returnUrl="/accommodations/123"
 * />
 * ```
 *
 * @param props - Component props
 * @returns Rendered authentication required popover
 */
export function AuthRequiredPopover({
    message,
    onClose,
    locale = 'es',
    returnUrl = '',
    className = ''
}: AuthRequiredPopoverProps): JSX.Element {
    const popoverRef = useRef<HTMLDivElement>(null);

    // Get localized text
    const texts = {
        es: {
            signIn: 'Iniciar sesión',
            signUp: 'Registrarse',
            ariaLabel: 'Autenticación requerida'
        },
        en: {
            signIn: 'Sign in',
            signUp: 'Sign up',
            ariaLabel: 'Authentication required'
        }
    };

    const localizedTexts = texts[locale];

    // Build login and register URLs
    const loginHref = `/${locale}/auth/signin?returnUrl=${encodeURIComponent(returnUrl)}`;
    const registerHref = `/${locale}/auth/signup`;

    // Handle Escape key
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    // Handle click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent): void => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    return (
        <div
            ref={popoverRef}
            // biome-ignore lint/a11y/useSemanticElements: Using div with role="dialog" for popover (not modal)
            role="dialog"
            aria-label={localizedTexts.ariaLabel}
            className={`relative rounded-lg border border-gray-200 bg-white p-4 shadow-lg ${className}`.trim()}
        >
            {/* Arrow/caret pointing up */}
            <div
                className="-top-2 -translate-x-1/2 absolute left-1/2 h-4 w-4 rotate-45 border-gray-200 border-t border-l bg-white"
                aria-hidden="true"
            />

            {/* Message */}
            <p className="mb-4 text-gray-700 text-sm">{message}</p>

            {/* Action links */}
            <div className="flex gap-3">
                <a
                    href={loginHref}
                    className="flex-1 rounded-md bg-primary px-4 py-2 text-center font-semibold text-white transition-colors hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                >
                    {localizedTexts.signIn}
                </a>
                <a
                    href={registerHref}
                    className="flex-1 rounded-md border-2 border-primary bg-transparent px-4 py-2 text-center font-semibold text-primary transition-colors hover:bg-primary hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                >
                    {localizedTexts.signUp}
                </a>
            </div>
        </div>
    );
}
