import { useState } from 'react';
import type { JSX } from 'react';
import { addToast } from '../../store/toast-store';
import { AuthRequiredPopover } from '../auth/AuthRequiredPopover.client';

/**
 * Props for the FavoriteButton component
 */
export interface FavoriteButtonProps {
    /** Unique identifier for the entity to favorite */
    readonly entityId: string;
    /** Type of entity being favorited */
    readonly entityType: 'accommodation' | 'destination' | 'event';
    /** Initial favorited state (defaults to false) */
    readonly initialFavorited?: boolean;
    /** Locale for accessibility labels (defaults to 'es') */
    readonly locale?: 'es' | 'en';
    /** Additional CSS classes to apply to the button */
    readonly className?: string;
    /** Whether the user is authenticated */
    readonly isAuthenticated?: boolean;
}

/**
 * Toggle favorite API call (placeholder - will be connected later)
 *
 * @param params - API call parameters
 * @param params.entityId - Entity ID to favorite/unfavorite
 * @param params.entityType - Type of entity
 * @returns Promise resolving to success status
 * @throws Error if API call fails
 */
async function toggleFavorite(params: {
    readonly entityId: string;
    readonly entityType: string;
}): Promise<{ readonly success: boolean }> {
    const { entityId, entityType } = params;

    const response = await fetch('/api/v1/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId, entityType })
    });

    if (!response.ok) {
        throw new Error('Failed to toggle favorite');
    }

    return response.json();
}

/**
 * FavoriteButton component
 *
 * A heart icon button that toggles favorite/unfavorite state with optimistic updates.
 * If the user is not authenticated, shows an AuthRequiredPopover instead of toggling.
 *
 * Features:
 * - Optimistic UI updates (immediate visual feedback)
 * - Auth check before allowing toggle
 * - Error handling with automatic state revert on API failure
 * - Toast notifications for errors
 * - Accessible with proper ARIA labels
 * - Localized for Spanish and English
 *
 * @param props - Component props
 * @returns React component
 *
 * @example
 * ```tsx
 * <FavoriteButton
 *   entityId="acc-123"
 *   entityType="accommodation"
 *   initialFavorited={false}
 *   isAuthenticated={true}
 *   locale="es"
 * />
 * ```
 */
export function FavoriteButton({
    entityId,
    entityType,
    initialFavorited = false,
    locale = 'es',
    className = '',
    isAuthenticated = false
}: FavoriteButtonProps): JSX.Element {
    const [isFavorited, setIsFavorited] = useState(initialFavorited);
    const [showAuthPopover, setShowAuthPopover] = useState(false);

    // Localized texts
    const texts = {
        es: {
            addToFavorites: 'Agregar a favoritos',
            removeFromFavorites: 'Quitar de favoritos',
            authRequired: 'Debes iniciar sesión para guardar favoritos',
            errorMessage: 'Error al guardar favorito. Por favor, intenta de nuevo.'
        },
        en: {
            addToFavorites: 'Add to favorites',
            removeFromFavorites: 'Remove from favorites',
            authRequired: 'You must sign in to save favorites',
            errorMessage: 'Failed to save favorite. Please try again.'
        }
    };

    const localizedTexts = texts[locale];

    /**
     * Handle button click
     * - If not authenticated, show auth popover
     * - If authenticated, optimistically toggle state and call API
     * - On API failure, revert state and show error toast
     */
    const handleClick = async (): Promise<void> => {
        // Check authentication
        if (!isAuthenticated) {
            setShowAuthPopover(true);
            return;
        }

        // Optimistic update
        const previousState = isFavorited;
        setIsFavorited(!isFavorited);

        try {
            // Call API
            await toggleFavorite({ entityId, entityType });
        } catch (_error) {
            // Revert state on error
            setIsFavorited(previousState);

            // Show error toast
            addToast({
                type: 'error',
                message: localizedTexts.errorMessage,
                duration: 5000
            });
        }
    };

    const ariaLabel = isFavorited
        ? localizedTexts.removeFromFavorites
        : localizedTexts.addToFavorites;

    return (
        <div className="relative">
            <button
                type="button"
                onClick={handleClick}
                aria-label={ariaLabel}
                className={`inline-flex items-center justify-center rounded-full p-2 transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${className}`.trim()}
            >
                {/* Heart icon */}
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill={isFavorited ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`h-6 w-6 transition-colors ${
                        isFavorited ? 'text-red-500' : 'text-gray-600'
                    }`}
                    aria-hidden="true"
                >
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
            </button>

            {/* Auth Required Popover */}
            {showAuthPopover && (
                <div className="absolute top-full right-0 z-50 mt-2 w-64">
                    <AuthRequiredPopover
                        message={localizedTexts.authRequired}
                        onClose={() => setShowAuthPopover(false)}
                        locale={locale}
                        returnUrl={typeof window !== 'undefined' ? window.location.pathname : ''}
                    />
                </div>
            )}
        </div>
    );
}
