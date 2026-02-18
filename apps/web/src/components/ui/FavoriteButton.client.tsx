import { FavoriteIcon } from '@repo/icons';
import { useEffect, useState } from 'react';
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
    /** Display name of the entity (stored in bookmark for listing) */
    readonly entityName?: string;
    /** Initial favorited state (defaults to false) */
    readonly initialFavorited?: boolean;
    /** Locale for accessibility labels (defaults to 'es') */
    readonly locale?: 'es' | 'en';
    /** Additional CSS classes to apply to the button */
    readonly className?: string;
    /** Whether the user is authenticated */
    readonly isAuthenticated?: boolean;
}

/** Maps component-level entity types to the API enum values */
const ENTITY_TYPE_MAP: Record<string, string> = {
    accommodation: 'ACCOMMODATION',
    destination: 'DESTINATION',
    event: 'EVENT'
} as const;

/**
 * Resolve the API base URL from environment.
 */
function getApiBaseUrl(): string {
    return (import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');
}

/**
 * Check if an entity is already bookmarked by the current user.
 */
async function checkBookmarkStatus(params: {
    readonly entityId: string;
    readonly entityType: string;
}): Promise<{ readonly isFavorited: boolean }> {
    const { entityId, entityType } = params;
    const apiBaseUrl = getApiBaseUrl();
    const apiEntityType = ENTITY_TYPE_MAP[entityType] ?? entityType.toUpperCase();

    const url = `${apiBaseUrl}/api/v1/protected/user-bookmarks/check?entityId=${encodeURIComponent(entityId)}&entityType=${encodeURIComponent(apiEntityType)}`;

    const response = await fetch(url, {
        method: 'GET',
        credentials: 'include'
    });

    if (!response.ok) {
        return { isFavorited: false };
    }

    const body = await response.json();
    const data = body?.data ?? body;
    return { isFavorited: data?.isFavorited === true };
}

/**
 * Toggle favorite (bookmark) via the protected user-bookmarks API.
 * The API handles toggle semantics: creates if not exists, deletes if exists.
 *
 * @returns Object with toggled state (true = now favorited, false = now unfavorited)
 * @throws Error if API call fails
 */
async function toggleFavorite(params: {
    readonly entityId: string;
    readonly entityType: string;
    readonly entityName?: string;
}): Promise<{ readonly toggled: boolean }> {
    const { entityId, entityType, entityName } = params;
    const apiBaseUrl = getApiBaseUrl();

    const body: Record<string, string> = {
        entityId,
        entityType: ENTITY_TYPE_MAP[entityType] ?? entityType.toUpperCase()
    };

    // Include name if provided (min 3 chars required by schema)
    if (entityName && entityName.length >= 3) {
        body.name = entityName;
    }

    const response = await fetch(`${apiBaseUrl}/api/v1/protected/user-bookmarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        throw new Error('Failed to toggle favorite');
    }

    const responseBody = await response.json();
    const data = responseBody?.data ?? responseBody;
    return { toggled: data?.toggled === true };
}

/**
 * FavoriteButton component
 *
 * A heart icon button that toggles favorite/unfavorite state with optimistic updates.
 * If the user is not authenticated, shows an AuthRequiredPopover instead of toggling.
 *
 * Features:
 * - Checks initial favorite state on mount (for authenticated users)
 * - Toggle semantics (API prevents duplicates)
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
    entityName,
    initialFavorited = false,
    locale = 'es',
    className = '',
    isAuthenticated = false
}: FavoriteButtonProps): JSX.Element {
    const [isFavorited, setIsFavorited] = useState(initialFavorited);
    const [showAuthPopover, setShowAuthPopover] = useState(false);

    // Check initial bookmark state when authenticated
    // biome-ignore lint/correctness/useExhaustiveDependencies: only check on mount with stable entityId/entityType
    useEffect(() => {
        if (!isAuthenticated) return;

        let cancelled = false;

        checkBookmarkStatus({ entityId, entityType }).then((result) => {
            if (!cancelled) {
                setIsFavorited(result.isFavorited);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [isAuthenticated, entityId, entityType]);

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
            // Call toggle API
            const result = await toggleFavorite({ entityId, entityType, entityName });
            // Sync with server response in case optimistic state diverged
            setIsFavorited(result.toggled);
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
                <FavoriteIcon
                    size={24}
                    weight={isFavorited ? 'fill' : 'regular'}
                    className={`transition-colors ${
                        isFavorited ? 'text-red-500' : 'text-gray-600'
                    }`}
                    aria-hidden="true"
                />
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
