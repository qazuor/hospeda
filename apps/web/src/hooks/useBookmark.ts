import { useState } from 'react';

/**
 * Custom hook for managing bookmarks/favorites
 * Handles API calls and local state management
 */
export const useBookmark = (
    entityId: string,
    entityType: 'ACCOMMODATION' | 'DESTINATION' | 'EVENT' | 'POST' | 'USER'
) => {
    const [isBookmarked, setIsBookmarked] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    /**
     * Toggle bookmark status by calling the API
     */
    const toggleBookmark = async (): Promise<boolean> => {
        setIsLoading(true);

        try {
            const response = await fetch('/api/bookmarks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    entityId,
                    entityType,
                    action: isBookmarked ? 'REMOVE' : 'ADD'
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const newBookmarkedState = !isBookmarked;
            setIsBookmarked(newBookmarkedState);

            return newBookmarkedState;
        } catch (error) {
            console.error('Failed to toggle bookmark:', error);
            // Revert optimistic update on error
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Set initial bookmark state
     */
    const setInitialBookmarked = (bookmarked: boolean) => {
        setIsBookmarked(bookmarked);
    };

    return {
        isBookmarked,
        isLoading,
        toggleBookmark,
        setInitialBookmarked
    };
};
