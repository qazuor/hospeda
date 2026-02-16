import { CloseIcon, SearchIcon } from '@repo/icons';
import type { JSX } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Props for the SearchBar component
 */
export interface SearchBarProps {
    /**
     * Locale for placeholder text
     * @default 'es'
     */
    readonly locale?: 'es' | 'en' | 'pt';

    /**
     * Custom placeholder text (overrides locale-based placeholder)
     */
    readonly placeholder?: string;

    /**
     * Default value for the search input
     */
    readonly defaultValue?: string;

    /**
     * Callback triggered when search is performed (on Enter or button click)
     * If not provided, will navigate to search results page
     */
    readonly onSearch?: (query: string) => void;

    /**
     * Additional CSS classes to apply to the wrapper element
     */
    readonly className?: string;
}

/**
 * Localized placeholder text for the search input
 */
const PLACEHOLDERS = {
    es: 'Buscar alojamientos, destinos...',
    en: 'Search accommodations, destinations...',
    pt: 'Buscar hospedagens, destinos...'
} as const;

/**
 * SearchBar component with debounced input and search functionality
 *
 * Features:
 * - Debounced input (300ms) for optional autocomplete
 * - Enter key or search button click triggers search
 * - Clear button appears when input has text
 * - Navigates to `/${locale}/busqueda/?q=${query}` by default
 * - Fully accessible with ARIA attributes
 *
 * @example
 * ```tsx
 * <SearchBar locale="es" />
 * <SearchBar locale="en" defaultValue="beach" onSearch={(q) => console.log(q)} />
 * ```
 */
export function SearchBar({
    locale = 'es',
    placeholder,
    defaultValue = '',
    onSearch,
    className = ''
}: SearchBarProps): JSX.Element {
    const [query, setQuery] = useState(defaultValue);
    const [_debouncedQuery, setDebouncedQuery] = useState(defaultValue);
    const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Debounce input value (for potential autocomplete)
    useEffect(() => {
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }

        debounceTimeoutRef.current = setTimeout(() => {
            setDebouncedQuery(query);
        }, 300);

        return () => {
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
        };
    }, [query]);

    /**
     * Handles search execution (Enter key or button click)
     */
    const handleSearch = useCallback(() => {
        const trimmedQuery = query.trim();

        if (!trimmedQuery) {
            return;
        }

        if (onSearch) {
            onSearch(trimmedQuery);
        } else {
            const searchUrl = `/${locale}/busqueda/?q=${encodeURIComponent(trimmedQuery)}`;
            window.location.href = searchUrl;
        }
    }, [query, locale, onSearch]);

    /**
     * Handles Enter key press
     */
    const handleKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLInputElement>) => {
            if (event.key === 'Enter') {
                handleSearch();
            }
        },
        [handleSearch]
    );

    /**
     * Clears the search input
     */
    const handleClear = useCallback(() => {
        setQuery('');
        setDebouncedQuery('');
    }, []);

    const placeholderText = placeholder || PLACEHOLDERS[locale];
    const hasQuery = query.length > 0;

    return (
        <div className={`relative flex items-center gap-2 ${className}`}>
            {/* Search Icon */}
            <div className="pointer-events-none absolute left-3 flex items-center">
                <SearchIcon
                    size={20}
                    className="text-gray-400"
                    aria-hidden="true"
                />
            </div>

            {/* Search Input */}
            <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholderText}
                className="w-full rounded-lg border border-gray-300 py-2 pr-20 pl-10 text-base text-gray-900 placeholder-gray-500 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50"
                aria-label="Search"
            />

            {/* Clear Button */}
            {hasQuery && (
                <button
                    type="button"
                    onClick={handleClear}
                    className="absolute right-14 flex h-5 w-5 items-center justify-center rounded-full bg-gray-300 text-gray-700 transition-colors hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50"
                    aria-label="Clear search"
                >
                    <CloseIcon
                        size={12}
                        className="text-gray-700"
                        aria-hidden="true"
                    />
                </button>
            )}

            {/* Search Button */}
            <button
                type="button"
                onClick={handleSearch}
                disabled={!hasQuery}
                className="absolute right-2 rounded-md bg-primary px-3 py-1 font-semibold text-sm text-white transition-colors hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 disabled:cursor-not-allowed disabled:bg-gray-300"
                aria-label="Search"
            >
                <SearchIcon
                    size={16}
                    className="text-white"
                    aria-hidden="true"
                />
            </button>
        </div>
    );
}
