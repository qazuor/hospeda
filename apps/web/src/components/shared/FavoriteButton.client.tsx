'use client';
import { LimitFallback } from '@/components/billing';
import { useBookmark } from '@/hooks/useBookmark';
import { webLogger } from '@/utils/logger';
import { LimitGate } from '@qazuor/qzpay-react';
import { FavoriteIcon } from '@repo/icons';
import { useEffect } from 'react';

/**
 * FavoriteButton
 * Reusable favorite button that works with any entity type.
 * Handles API calls and optimistic updates.
 * Uses LimitGate to enforce MAX_FAVORITES limit for tourists.
 */
interface Props {
    /** Entity ID to bookmark */
    entityId: string;
    /** Type of entity (ACCOMMODATION, DESTINATION, EVENT, POST) */
    entityType: 'ACCOMMODATION' | 'DESTINATION' | 'EVENT' | 'POST' | 'USER';
    /** Initial bookmark state */
    initialBookmarked?: boolean;
    /** Icon size in pixels */
    size?: number;
    /** Optional callback when bookmark state changes */
    onToggle?: (bookmarked: boolean) => void;
    /** Whether the button is disabled */
    disabled?: boolean;
}

/**
 * Internal button component (without gating)
 */
function FavoriteButtonInternal({
    entityId,
    entityType,
    initialBookmarked = false,
    size = 24,
    onToggle,
    disabled = false,
    showRemainingCount: _showRemainingCount = false
}: Props & { showRemainingCount?: boolean }) {
    const { isBookmarked, isLoading, toggleBookmark, setInitialBookmarked } = useBookmark(
        entityId,
        entityType
    );

    // Set initial state when component mounts
    useEffect(() => {
        setInitialBookmarked(initialBookmarked);
    }, [initialBookmarked, setInitialBookmarked]);

    const handleClick = async () => {
        if (disabled || isLoading) return;

        try {
            const newBookmarkedState = await toggleBookmark();
            onToggle?.(newBookmarkedState);
        } catch (error) {
            // Error is already logged in the hook
            // Could show a toast notification here
            webLogger.error('Failed to toggle bookmark', error);
        }
    };

    const buttonClass = [
        'transition',
        'hover:text-red-600',
        isBookmarked ? 'text-red-500' : 'text-gray-400',
        disabled || isLoading ? 'cursor-not-allowed opacity-50' : ''
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <button
            type="button"
            disabled={disabled || isLoading}
            aria-label={isBookmarked ? 'Quitar de favoritos' : 'Agregar a favoritos'}
            onClick={handleClick}
            className={buttonClass}
        >
            <FavoriteIcon
                size={size}
                className={isBookmarked ? 'fill-current' : ''}
            />
            {isLoading && <span className="sr-only">Cargando...</span>}
        </button>
    );
}

/**
 * Favorite button with limit gating
 */
export function FavoriteButton(props: Props) {
    const {
        entityId,
        entityType,
        initialBookmarked = false,
        size = 24,
        onToggle,
        disabled = false
    } = props;

    // Create button element
    const buttonElement = (
        <FavoriteButtonInternal
            entityId={entityId}
            entityType={entityType}
            initialBookmarked={initialBookmarked}
            size={size}
            onToggle={onToggle}
            disabled={disabled}
        />
    );

    // If already bookmarked, allow removal without limit check
    if (initialBookmarked) {
        return buttonElement;
    }

    // For adding a favorite, wrap with LimitGate
    // LimitGate will gracefully handle missing QZPayProvider context
    const fallback = (
        <LimitFallback
            limitName="favoritos"
            currentValue={3} // Placeholder - LimitGate should inject this
            maxValue={3} // Placeholder - LimitGate should inject this
            currentPlan="Gratuito"
            upgradeLink="/precios/turistas"
        />
    );

    return (
        <LimitGate
            limitKey="max_favorites"
            fallback={fallback}
            loading={<div className="text-gray-500 text-sm">Cargando...</div>}
        >
            {buttonElement}
        </LimitGate>
    );
}
