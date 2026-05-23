/**
 * @file useFilterDebounce.ts
 * @description Debounced URL navigation hook for the FilterSidebar.
 * Encapsulates the 500ms debounce logic and Astro View Transitions navigate call.
 */

import { useCallback, useRef, useState } from 'react';

/** Return type for the useFilterDebounce hook. */
export interface UseFilterDebounceReturn {
    /**
     * Schedules a debounced navigation to the given URLSearchParams.
     * Cancels any pending navigation before scheduling a new one.
     * @param params - The new URL search params to navigate to.
     * @param onFiltersChange - Optional custom handler; if provided, skips URL navigation.
     */
    readonly debouncedNavigate: (
        params: URLSearchParams,
        onFiltersChange?: (params: URLSearchParams) => void
    ) => void;
    /** True while a navigation is in flight (after debounce fires, before page swap). */
    readonly isPending: boolean;
    /** Reset the pending state (called when Astro finishes loading). */
    readonly clearPending: () => void;
}

/**
 * Hook encapsulating the 500ms debounced URL navigation for filter state changes.
 * Uses Astro View Transitions `navigate()` with a hard-navigation fallback.
 *
 * @returns `{ debouncedNavigate, isPending, clearPending }`
 */
export function useFilterDebounce(): UseFilterDebounceReturn {
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
    const [isPending, setIsPending] = useState(false);

    const clearPending = useCallback(() => {
        setIsPending(false);
        delete document.documentElement.dataset.filtersLoading;
    }, []);

    const debouncedNavigate = useCallback(
        (params: URLSearchParams, onFiltersChange?: (params: URLSearchParams) => void) => {
            if (debounceRef.current) clearTimeout(debounceRef.current);

            // nosemgrep: javascript.lang.security.detect-eval-with-expression.detect-eval-with-expression
            debounceRef.current = setTimeout(() => {
                // If a custom handler is provided (e.g. tests or embedded usage), use it
                if (onFiltersChange) {
                    onFiltersChange(params);
                    return;
                }

                setIsPending(true);
                document.documentElement.dataset.filtersLoading = 'true';

                const newUrl = new URL(window.location.href);
                newUrl.pathname = newUrl.pathname.replace(/\/page\/\d+\/?$/, '/');
                newUrl.search = params.toString();
                newUrl.searchParams.delete('page');

                // Give the host page a chance to handle this navigation in-
                // place (e.g. ListingLayout's partial-swap script). Listeners
                // that own the swap call `event.preventDefault()` to signal
                // they took over — we then skip our default `navigate()` so
                // ClientRouter never runs. When nothing listens (or the
                // listener opts out), we fall through to the standard
                // `<ClientRouter />` flow.
                const handoff = new CustomEvent('hospeda:listing-nav', {
                    detail: { url: newUrl.href },
                    cancelable: true
                });
                window.dispatchEvent(handoff);
                if (handoff.defaultPrevented) return;

                // Use Astro View Transitions navigate for smooth transition
                (
                    import('astro:transitions/client') as Promise<{
                        navigate: (href: string) => Promise<void>;
                    }>
                )
                    .then(({ navigate }) => {
                        navigate(newUrl.href);
                    })
                    .catch(() => {
                        // Fallback to hard navigation if View Transitions are unavailable
                        window.location.href = newUrl.href;
                    });
            }, 500);
        },
        []
    );

    return { debouncedNavigate, isPending, clearPending };
}
