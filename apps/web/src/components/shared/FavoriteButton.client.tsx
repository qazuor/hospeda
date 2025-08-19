'use client';
import { HeartIcon } from '@/components/icons/HeartIcon';
import { useBookmark } from '@/hooks/useBookmark';
import { useEffect } from 'react';

/**
 * FavoriteButton
 * Reusable favorite button that works with any entity type.
 * Handles API calls and optimistic updates.
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

export function FavoriteButton({
    entityId,
    entityType,
    initialBookmarked = false,
    size = 24,
    onToggle,
    disabled = false
}: Props) {
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
            console.error('Failed to toggle bookmark:', error);
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
            aria-label={isBookmarked ? 'Remove from favorites' : 'Add to favorites'}
            onClick={handleClick}
            className={buttonClass}
        >
            <HeartIcon
                variant={isBookmarked ? 'solid' : 'outline'}
                size={size}
            />
            {isLoading && <span className="sr-only">Loading...</span>}
        </button>
    );
}
