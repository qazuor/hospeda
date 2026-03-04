import * as Sentry from '@sentry/astro';
import { useState } from 'react';
import type { JSX } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import type { SupportedLocale } from '../../lib/i18n';
import { webLogger } from '../../lib/logger';
import { addToast } from '../../store/toast-store';
import { AuthRequiredPopover } from '../auth/AuthRequiredPopover.client';

/**
 * Props for the NewsletterCTA component
 */
export interface NewsletterCTAProps {
    /** Locale for localized text (defaults to 'es') */
    readonly locale?: SupportedLocale;
    /** Whether the user is authenticated */
    readonly isAuthenticated?: boolean;
    /** Whether the user is already subscribed to the newsletter */
    readonly isSubscribed?: boolean;
    /** Additional CSS classes to apply to the container */
    readonly className?: string;
}

/**
 * Toggle newsletter subscription via API.
 *
 * @returns Promise resolving to the new subscription state
 */
async function toggleNewsletterSubscription(): Promise<{ subscribed: boolean }> {
    const apiUrl = import.meta.env.PUBLIC_API_URL;
    const response = await fetch(`${apiUrl}/api/v1/protected/users/me/newsletter/toggle`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
        throw new Error(`Newsletter toggle failed: ${response.status}`);
    }

    const json = (await response.json()) as { success: boolean; data: { subscribed: boolean } };
    return { subscribed: json.data.subscribed };
}

/**
 * NewsletterCTA component prompts users to subscribe to the newsletter.
 *
 * For unauthenticated users:
 * - Shows promotional text inviting them to subscribe
 * - Shows a "Subscribe" button
 * - When clicked, shows AuthRequiredPopover
 *
 * For authenticated users:
 * - Shows a toggle with a checkbox/switch to opt in/out
 * - Optimistic toggle with API call
 * - On error, reverts and shows error toast
 *
 * @example
 * ```tsx
 * // Unauthenticated user
 * <NewsletterCTA locale="es" isAuthenticated={false} />
 *
 * // Authenticated user, not subscribed
 * <NewsletterCTA locale="en" isAuthenticated={true} isSubscribed={false} />
 *
 * // Authenticated user, already subscribed
 * <NewsletterCTA locale="es" isAuthenticated={true} isSubscribed={true} />
 * ```
 *
 * @param props - Component props
 * @returns Rendered newsletter CTA component
 */
export function NewsletterCTA({
    locale = 'es',
    isAuthenticated = false,
    isSubscribed = false,
    className = ''
}: NewsletterCTAProps): JSX.Element {
    const [subscribed, setSubscribed] = useState(isSubscribed);
    const [isToggling, setIsToggling] = useState(false);
    const [showAuthPopover, setShowAuthPopover] = useState(false);

    const { t } = useTranslation({ locale: locale as SupportedLocale, namespace: 'newsletter' });

    /**
     * Handle subscribe button click for unauthenticated users
     */
    function handleUnauthenticatedSubscribe(): void {
        setShowAuthPopover(true);
    }

    /**
     * Handle newsletter toggle for authenticated users
     */
    async function handleToggle(): Promise<void> {
        if (isToggling) return;

        // Optimistic update
        const previousState = subscribed;
        const newState = !subscribed;
        setSubscribed(newState);
        setIsToggling(true);

        try {
            const result = await toggleNewsletterSubscription();
            // Use server-confirmed state
            setSubscribed(result.subscribed);

            // Show success toast
            addToast({
                type: 'success',
                message: result.subscribed ? t('successSubscribe') : t('successUnsubscribe')
            });
        } catch (error) {
            webLogger.error('NewsletterCTA: toggle subscription failed', error);
            Sentry.captureException(error);
            // Revert on error
            setSubscribed(previousState);

            // Show error toast
            addToast({
                type: 'error',
                message: t('errorMessage')
            });
        } finally {
            setIsToggling(false);
        }
    }

    return (
        <div className={`relative rounded-lg bg-surface p-6 shadow-md ${className}`.trim()}>
            <h3 className="mb-2 font-semibold text-lg text-text">{t('title')}</h3>
            <p className="mb-4 text-sm text-text-secondary">{t('description')}</p>

            {isAuthenticated ? (
                // Authenticated user: Show toggle
                <div className="flex items-center gap-3">
                    <label
                        htmlFor="newsletter-toggle"
                        className="flex items-center gap-2"
                    >
                        <input
                            id="newsletter-toggle"
                            type="checkbox"
                            checked={subscribed}
                            onChange={handleToggle}
                            disabled={isToggling}
                            className="h-5 w-5 rounded border-border text-primary transition-colors focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                        <span className="text-sm text-text">
                            {subscribed ? t('subscribed') : t('subscribe')}
                        </span>
                    </label>
                </div>
            ) : (
                // Unauthenticated user: Show subscribe button
                <div>
                    <button
                        type="button"
                        onClick={handleUnauthenticatedSubscribe}
                        className="rounded-md bg-primary px-4 py-2 font-semibold text-white transition-colors hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                    >
                        {t('subscribe')}
                    </button>

                    {showAuthPopover && (
                        <div className="top-full mt-4">
                            <AuthRequiredPopover
                                message={t('authMessage')}
                                onClose={() => setShowAuthPopover(false)}
                                locale={locale}
                                returnUrl={
                                    typeof window !== 'undefined' ? window.location.pathname : ''
                                }
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
