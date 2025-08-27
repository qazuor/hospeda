/**
 * Destination Select Component
 *
 * Specialized select component for choosing destinations.
 * Uses the generic ApiSelect component with destination-specific configuration.
 */
import type { FC } from 'react';
import { ApiSelect, type ApiSelectOption } from '../ui/ApiSelect';

/**
 * Destination option type with additional properties
 */
type DestinationOption = ApiSelectOption & {
    slug?: string;
    summary?: string;
    country?: string;
    region?: string;
    isFeatured?: boolean;
};

/**
 * Props for the DestinationSelect component
 */
type DestinationSelectProps = {
    /** Current selected destination ID */
    value?: string;
    /** Callback when selection changes */
    onValueChange: (value: string) => void;
    /** Whether the select is disabled */
    disabled?: boolean;
    /** Whether the select is required */
    required?: boolean;
    /** Custom error message */
    error?: string;
    /** Additional CSS classes */
    className?: string;
    /** Filter only featured destinations */
    onlyFeatured?: boolean;
    /** Maximum number of destinations to fetch (default: 1000) */
    limit?: number;
};

/**
 * Transform API response to destination options
 * Handles different possible destination data structures
 */
const transformDestinationResponse = (data: unknown): DestinationOption[] => {
    let destinations: Record<string, unknown>[] = [];

    // Handle different response structures
    if (Array.isArray(data)) {
        destinations = data as Record<string, unknown>[];
    } else if (data && typeof data === 'object' && 'data' in data) {
        const responseData = (data as { data: { items: unknown } }).data.items;
        if (Array.isArray(responseData)) {
            destinations = responseData as Record<string, unknown>[];
        }
    }

    return destinations.map((destination: Record<string, unknown>) => ({
        id: String(destination.id || destination._id || ''),
        name: String(destination.name || destination.title || 'Unknown Destination'),
        slug: String(destination.slug || ''),
        summary: String(destination.summary || ''),
        country: String(destination.country || ''),
        region: String(destination.region || ''),
        isFeatured: Boolean(destination.isFeatured || false),
        ...destination
    }));
};

/**
 * Get display label for destination option
 * Shows name and additional context if available
 */
const getDestinationLabel = (option: DestinationOption): string => {
    const name = option.name;
    const region = option.region;
    const country = option.country;

    // Build label with location context
    const locationParts = [region, country].filter(Boolean);
    const locationText = locationParts.length > 0 ? ` (${locationParts.join(', ')})` : '';

    return `${name}${locationText}`;
};

/**
 * Destination Select Component
 *
 * Provides a select dropdown for choosing destinations.
 * Fetches destinations from the API and displays them with location context.
 */
export const DestinationSelect: FC<DestinationSelectProps> = ({
    value,
    onValueChange,
    disabled = false,
    required = false,
    error,
    className = '',
    onlyFeatured = false,
    limit = 100
}) => {
    // Build endpoint with optional featured filter
    const endpoint = onlyFeatured
        ? '/api/v1/public/destinations?featured=true'
        : '/api/v1/public/destinations';

    // Build query key with featured filter
    const queryKey = onlyFeatured ? ['destinations', 'list', 'featured'] : ['destinations', 'list'];

    return (
        <ApiSelect
            endpoint={endpoint}
            queryKey={queryKey}
            value={value}
            onValueChange={onValueChange}
            placeholder="Select a destination..."
            disabled={disabled}
            required={required}
            error={error}
            limit={limit}
            transformResponse={transformDestinationResponse}
            getOptionLabel={getDestinationLabel}
            getOptionValue={(option) => option.id}
            className={className}
        />
    );
};
