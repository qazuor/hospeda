/**
 * Generic API Select Component
 *
 * A reusable select component that fetches options from an API endpoint
 * and provides a consistent interface for selection.
 */
import { useQuery } from '@tanstack/react-query';
import { LoaderIcon } from 'lucide-react';
import type { FC } from 'react';
import { fetchApi } from '../../lib/api/client';

/**
 * Generic option type for API responses
 */
export type ApiSelectOption = {
    id: string;
    name: string;
    [key: string]: unknown; // Allow additional properties
};

/**
 * Props for the ApiSelect component
 */
type ApiSelectProps = {
    /** API endpoint to fetch options from */
    endpoint: string;
    /** Query key for TanStack Query caching */
    queryKey: string[];
    /** Current selected value */
    value?: string;
    /** Callback when selection changes */
    onValueChange: (value: string) => void;
    /** Placeholder text */
    placeholder?: string;
    /** Label for the select */
    label?: string;
    /** Whether the select is disabled */
    disabled?: boolean;
    /** Whether the select is required */
    required?: boolean;
    /** Custom CSS classes */
    className?: string;
    /** Custom error message */
    error?: string;
    /** Maximum number of items to fetch (default: 1000) */
    limit?: number;
    /** Transform function for API response */
    transformResponse?: (data: unknown) => ApiSelectOption[];
    /** Custom function to get option label */
    getOptionLabel?: (option: ApiSelectOption) => string;
    /** Custom function to get option value */
    getOptionValue?: (option: ApiSelectOption) => string;
};

/**
 * Default transform function for API responses
 */
const defaultTransformResponse = (data: unknown): ApiSelectOption[] => {
    if (Array.isArray(data)) {
        return data.map((item: Record<string, unknown>) => ({
            id: String(item.id || ''),
            name: String(item.name || item.title || item.displayName || ''),
            ...item
        }));
    }

    // If data is wrapped in a data property
    if (data && typeof data === 'object' && 'data' in data) {
        return defaultTransformResponse((data as Record<string, unknown>).data);
    }

    return [];
};

/**
 * Generic API Select Component
 *
 * Fetches options from an API endpoint and renders them in a select dropdown.
 * Highly configurable and reusable across different entities.
 */
export const ApiSelect: FC<ApiSelectProps> = ({
    endpoint,
    queryKey,
    value,
    onValueChange,
    placeholder = 'Select an option...',
    label,
    disabled = false,
    required = false,
    className = '',
    error,
    limit = 100,
    transformResponse = defaultTransformResponse,
    getOptionLabel = (option) => option.name,
    getOptionValue = (option) => option.id
}) => {
    const {
        data: options = [],
        isLoading,
        isError,
        error: queryError
    } = useQuery<ApiSelectOption[]>({
        queryKey: [...queryKey, 'limit', limit],
        queryFn: async (): Promise<ApiSelectOption[]> => {
            // Add limit parameter to get all results
            const separator = endpoint.includes('?') ? '&' : '?';
            const endpointWithLimit = `${endpoint}${separator}limit=${limit}`;

            const { data } = await fetchApi<unknown>({
                path: endpointWithLimit,
                method: 'GET'
            });

            return transformResponse(data);
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000 // 10 minutes
    });

    const selectId = `${queryKey.join('-')}-select`;
    const hasError = error || isError;
    const errorMessage = error || queryError?.message || 'Failed to load options';

    return (
        <div className="space-y-1">
            {label && (
                <label
                    htmlFor={selectId}
                    className="block font-medium text-gray-700 text-sm"
                >
                    {label}
                    {required && <span className="ml-1 text-red-500">*</span>}
                </label>
            )}

            <div className="relative">
                <select
                    id={selectId}
                    value={value || ''}
                    onChange={(e) => onValueChange(e.target.value)}
                    disabled={disabled || isLoading}
                    required={required}
                    className={`w-full rounded-md border px-3 py-2 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 ${hasError ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'} ${className}`}
                >
                    <option value="">{isLoading ? 'Loading...' : placeholder}</option>

                    {options.map((option) => (
                        <option
                            key={getOptionValue(option)}
                            value={getOptionValue(option)}
                        >
                            {getOptionLabel(option)}
                        </option>
                    ))}

                    {options.length === 0 && !isLoading && !isError && (
                        <option
                            value=""
                            disabled
                        >
                            No options available
                        </option>
                    )}
                </select>

                {isLoading && (
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                        <LoaderIcon className="h-4 w-4 animate-spin text-gray-400" />
                    </div>
                )}
            </div>

            {hasError && <p className="text-red-600 text-sm">{errorMessage}</p>}
        </div>
    );
};
