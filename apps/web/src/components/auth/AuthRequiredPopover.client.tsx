import { FavoriteIcon, UserIcon } from '@repo/icons';
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import type { SupportedLocale } from '../../lib/i18n';

/**
 * Props for the AuthRequiredPopover component
 */
export interface AuthRequiredPopoverProps {
    /** Message to display in the popover */
    readonly message: string;
    /** Callback function called when popover is closed */
    readonly onClose: () => void;
    /** Locale for link text (defaults to 'es') */
    readonly locale?: 'es' | 'en' | 'pt';
    /** URL to return to after login/registration */
    readonly returnUrl?: string;
    /** Additional CSS classes to apply to the popover container */
    readonly className?: string;
}

/**
 * AuthRequiredPopover component displays a contextual popover prompting users to log in or sign up.
 * Uses the Hospeda design system colors (teal primary, warm accents) for visual consistency.
 *
 * The popover closes when:
 * - User presses the Escape key
 * - User clicks outside the popover
 * - User clicks the close button
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
    const [isVisible, setIsVisible] = useState(false);

    const { t } = useTranslation({ locale: locale as SupportedLocale, namespace: 'common' });

    const loginHref = `/${locale}/auth/signin?returnUrl=${encodeURIComponent(returnUrl)}`;
    const registerHref = `/${locale}/auth/signup`;

    // Animate in on mount
    useEffect(() => {
        const frame = requestAnimationFrame(() => setIsVisible(true));
        return () => cancelAnimationFrame(frame);
    }, []);

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
            aria-label={t('auth.authRequired')}
            className={`relative w-[280px] overflow-hidden rounded-xl border border-primary-100 bg-surface shadow-lg transition-all duration-200 ${
                isVisible ? 'scale-100 opacity-100' : '-translate-y-1 scale-[0.97] opacity-0'
            } ${className}`.trim()}
        >
            {/* Arrow pointing up */}
            <div
                aria-hidden="true"
                className="-top-1.5 absolute right-3.5 z-[1] h-3 w-3 rotate-45 border-primary-100 border-t border-l bg-primary-50"
            />

            {/* Close button */}
            <button
                type="button"
                onClick={onClose}
                aria-label={t('auth.close')}
                className="absolute top-2 right-2 z-10 flex h-6 w-6 items-center justify-center rounded-full text-primary-600 transition-colors hover:bg-primary-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
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

            {/* Teal header strip with icon */}
            <div className="flex items-center gap-2.5 border-primary-100 border-b bg-primary-50 px-4 py-3.5 pr-10">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100">
                    <FavoriteIcon
                        size={16}
                        weight="duotone"
                        className="text-primary"
                        aria-hidden="true"
                    />
                </div>
                <p className="m-0 font-medium text-[0.8125rem] text-primary-800 leading-snug">
                    {message}
                </p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 p-3.5 px-4">
                <a
                    href={loginHref}
                    className="hover:-translate-y-px flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 font-semibold text-[0.8125rem] text-white no-underline transition-all hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                >
                    <UserIcon
                        size={14}
                        weight="bold"
                        className="text-white"
                        aria-hidden="true"
                    />
                    {t('auth.signIn')}
                </a>
                <a
                    href={registerHref}
                    className="hover:-translate-y-px flex flex-1 items-center justify-center rounded-lg border-[1.5px] border-primary-200 bg-transparent px-3 py-2 font-semibold text-[0.8125rem] text-primary no-underline transition-all hover:border-primary hover:bg-primary-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                >
                    {t('auth.createAccount')}
                </a>
            </div>
        </div>
    );
}
