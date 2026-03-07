/**
 * @file FavoriteButton.client.tsx
 * @description Heart toggle button for saving entities to user favorites.
 * Supports optimistic updates, authentication checks, Sentry error tracking,
 * and toast notifications. Renders an AuthRequiredPopover for unauthenticated users.
 */

import { FavoriteIcon } from '@repo/icons';
import * as Sentry from '@sentry/astro';
import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { z } from 'zod';
import { getApiUrl } from '../../lib/env';
import { webLogger } from '../../lib/logger';
import { addToast } from '../../store/toast-store';
import { AuthRequiredPopover } from '../auth/AuthRequiredPopover.client';

/**
 * Props for the FavoriteButton component.
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
    readonly locale?: 'es' | 'en' | 'pt';
    /** Additional CSS classes to apply to the button */
    readonly className?: string;
    /** Whether the user is authenticated */
    readonly isAuthenticated?: boolean;
}

/** Maps component-level entity types to the API enum values */
const ENTITY_TYPE_MAP: Readonly<Record<string, string>> = {
    accommodation: 'ACCOMMODATION',
    destination: 'DESTINATION',
    event: 'EVENT'
} as const;

/** Zod schema for validating the bookmark check API response */
const bookmarkCheckResponseSchema = z
    .object({
        isFavorited: z.boolean()
    })
    .passthrough();

/** Zod schema for validating the toggle favorite API response */
const toggleFavoriteResponseSchema = z
    .object({
        toggled: z.boolean()
    })
    .passthrough();

/**
 * Check if an entity is already bookmarked by the current user.
 *
 * @param params - Entity identifiers to check
 * @returns Object with `isFavorited` boolean
 */
async function checkBookmarkStatus(params: {
    readonly entityId: string;
    readonly entityType: string;
}): Promise<{ readonly isFavorited: boolean }> {
    const { entityId, entityType } = params;
    const apiBaseUrl = getApiUrl();
    const apiEntityType = ENTITY_TYPE_MAP[entityType] ?? entityType.toUpperCase();

    const url = `${apiBaseUrl}/api/v1/protected/user-bookmarks/check?entityId=${encodeURIComponent(entityId)}&entityType=${encodeURIComponent(apiEntityType)}`;

    const response = await fetch(url, {
        method: 'GET',
        credentials: 'include'
    });

    if (!response.ok) {
        return { isFavorited: false };
    }

    const json = await response.json();
    const raw = json?.data ?? json;
    const parsed = bookmarkCheckResponseSchema.safeParse(raw);

    if (!parsed.success) {
        return { isFavorited: false };
    }

    return { isFavorited: parsed.data.isFavorited };
}

/**
 * Toggle favorite (bookmark) via the protected user-bookmarks API.
 * The API handles toggle semantics: creates if not exists, deletes if exists.
 *
 * @param params - Entity identifiers and optional name
 * @returns Object with `toggled` boolean (true = now favorited, false = now unfavorited)
 * @throws Error if the API call fails or returns an invalid response
 */
async function toggleFavorite(params: {
    readonly entityId: string;
    readonly entityType: string;
    readonly entityName?: string;
}): Promise<{ readonly toggled: boolean }> {
    const { entityId, entityType, entityName } = params;
    const apiBaseUrl = getApiUrl();

    const body: Record<string, string> = {
        entityId,
        entityType: ENTITY_TYPE_MAP[entityType] ?? entityType.toUpperCase()
    };

    // Include name only if it meets the minimum length required by the schema
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

    const json = await response.json();
    const raw = json?.data ?? json;
    const parsed = toggleFavoriteResponseSchema.safeParse(raw);

    if (!parsed.success) {
        throw new Error(`Invalid toggle response: ${parsed.error.message}`);
    }

    return { toggled: parsed.data.toggled };
}

/** Localized text map for the three supported locales */
const LOCALIZED_TEXTS = {
    es: {
        addToFavorites: 'Agregar a favoritos',
        removeFromFavorites: 'Quitar de favoritos',
        authRequired: 'Debes iniciar sesion para guardar favoritos',
        errorMessage: 'Error al guardar favorito. Por favor, intenta de nuevo.'
    },
    en: {
        addToFavorites: 'Add to favorites',
        removeFromFavorites: 'Remove from favorites',
        authRequired: 'You must sign in to save favorites',
        errorMessage: 'Failed to save favorite. Please try again.'
    },
    pt: {
        addToFavorites: 'Adicionar aos favoritos',
        removeFromFavorites: 'Remover dos favoritos',
        authRequired: 'Voce precisa fazer login para salvar favoritos',
        errorMessage: 'Erro ao salvar favorito. Por favor, tente novamente.'
    }
} as const;

/**
 * FavoriteButton component.
 *
 * A heart icon button that toggles favorite/unfavorite state with optimistic updates.
 * Unauthenticated users see an AuthRequiredPopover instead of performing the toggle.
 *
 * Features:
 * - Syncs initial favorite state on mount for authenticated users
 * - Toggle semantics via API (prevents duplicates server-side)
 * - Optimistic UI updates with automatic revert on API failure
 * - Auth check before allowing toggle
 * - Sentry error tracking on API failures
 * - Toast notifications for error feedback
 * - Accessible with proper ARIA labels
 * - Localized for Spanish, English, and Portuguese
 *
 * @param props - Component props
 * @returns React element
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

    const localizedTexts = LOCALIZED_TEXTS[locale];

    // Sync bookmark state from server on mount for authenticated users
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

    /**
     * Handle button click.
     * - Shows AuthRequiredPopover for unauthenticated users.
     * - Optimistically toggles state and calls API for authenticated users.
     * - Reverts state and shows error toast on API failure.
     */
    const handleClick = async (): Promise<void> => {
        if (!isAuthenticated) {
            setShowAuthPopover(true);
            return;
        }

        // Optimistic update
        const previousState = isFavorited;
        setIsFavorited(!isFavorited);

        try {
            const result = await toggleFavorite({ entityId, entityType, entityName });
            // Sync with server response in case optimistic state diverged
            setIsFavorited(result.toggled);
        } catch (error) {
            webLogger.error('FavoriteButton: toggle favorite failed', error);
            Sentry.captureException(error);
            // Revert to previous state on failure
            setIsFavorited(previousState);
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
                className={`inline-flex items-center justify-center rounded-full p-2 transition-colors hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${className}`.trim()}
            >
                <FavoriteIcon
                    size={24}
                    weight={isFavorited ? 'fill' : 'regular'}
                    className={`transition-colors ${
                        isFavorited ? 'text-danger' : 'text-text-secondary'
                    }`}
                    aria-hidden="true"
                />
            </button>

            {showAuthPopover && (
                <div className="absolute top-full right-0 z-50 mt-3">
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
