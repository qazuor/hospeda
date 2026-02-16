import { useState } from 'react';
import type { JSX } from 'react';
import { addToast } from '../../store/toast-store';
import { AuthRequiredPopover } from '../auth/AuthRequiredPopover.client';

/**
 * Props for the NewsletterCTA component
 */
export interface NewsletterCTAProps {
    /** Locale for localized text (defaults to 'es') */
    readonly locale?: 'es' | 'en';
    /** Whether the user is authenticated */
    readonly isAuthenticated?: boolean;
    /** Whether the user is already subscribed to the newsletter */
    readonly isSubscribed?: boolean;
    /** Additional CSS classes to apply to the container */
    readonly className?: string;
}

/**
 * Localized text definitions for the component
 */
interface LocalizedTexts {
    readonly title: string;
    readonly description: string;
    readonly subscribe: string;
    readonly subscribed: string;
    readonly unsubscribe: string;
    readonly authMessage: string;
    readonly successSubscribe: string;
    readonly successUnsubscribe: string;
    readonly errorMessage: string;
}

/**
 * Toggle newsletter subscription via API
 *
 * @returns Promise resolving to success status
 */
async function toggleNewsletterSubscription(): Promise<{ success: boolean }> {
    const response = await fetch('/api/v1/newsletter/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
        throw new Error('Failed to toggle subscription');
    }

    return response.json();
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

    // Localized text definitions
    const texts: Record<'es' | 'en', LocalizedTexts> = {
        es: {
            title: 'Suscribite al newsletter',
            description: 'Recibí las mejores ofertas y novedades de alojamientos en tu email.',
            subscribe: 'Suscribirse',
            subscribed: 'Suscripto al newsletter',
            unsubscribe: 'Cancelar suscripción',
            authMessage: 'Iniciá sesión para suscribirte al newsletter',
            successSubscribe: 'Te suscribiste al newsletter',
            successUnsubscribe: 'Te desuscribiste del newsletter',
            errorMessage: 'No se pudo actualizar la suscripción'
        },
        en: {
            title: 'Subscribe to our newsletter',
            description: 'Get the best accommodation deals and news delivered to your inbox.',
            subscribe: 'Subscribe',
            subscribed: 'Subscribed to newsletter',
            unsubscribe: 'Unsubscribe',
            authMessage: 'Sign in to subscribe to the newsletter',
            successSubscribe: 'Successfully subscribed to newsletter',
            successUnsubscribe: 'Successfully unsubscribed from newsletter',
            errorMessage: 'Could not update subscription'
        }
    };

    const localizedTexts = texts[locale];

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
            await toggleNewsletterSubscription();

            // Show success toast
            addToast({
                type: 'success',
                message: newState
                    ? localizedTexts.successSubscribe
                    : localizedTexts.successUnsubscribe
            });
        } catch (_error) {
            // Revert on error
            setSubscribed(previousState);

            // Show error toast
            addToast({
                type: 'error',
                message: localizedTexts.errorMessage
            });
        } finally {
            setIsToggling(false);
        }
    }

    return (
        <div className={`relative rounded-lg bg-white p-6 shadow-md ${className}`.trim()}>
            <h3 className="mb-2 font-semibold text-gray-900 text-lg">{localizedTexts.title}</h3>
            <p className="mb-4 text-gray-600 text-sm">{localizedTexts.description}</p>

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
                            className="h-5 w-5 rounded border-gray-300 text-primary transition-colors focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                        <span className="text-gray-700 text-sm">
                            {subscribed ? localizedTexts.subscribed : localizedTexts.subscribe}
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
                        {localizedTexts.subscribe}
                    </button>

                    {showAuthPopover && (
                        <div className="top-full mt-4">
                            <AuthRequiredPopover
                                message={localizedTexts.authMessage}
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
