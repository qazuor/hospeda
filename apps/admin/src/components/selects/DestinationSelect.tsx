/**
 * Destination Select Component
 *
 * Specialized select component for choosing destinations.
 * Uses the generic ApiSelect component with destination-specific configuration.
 *
 * SPEC-169 T-021: migrated from /api/v1/admin/destinations (requires DESTINATION_VIEW_ALL)
 * to /api/v1/admin/destinations/options (requires ACCESS_PANEL_ADMIN only).
 * Response shape: { items: [{ id, label, slug }] }.
 *
 * NOTE: The /options endpoint does NOT return region/country fields — those
 * were part of the heavyweight list payload. The selector now shows only the
 * destination name (the label field). If richer context is needed in the future,
 * request it from the backend options endpoint (FLAG: SPEC-169/UX-DEST-LABEL).
 */
import { useTranslations } from '@/hooks/use-translations';
import type { FC } from 'react';
import { ApiSelect, type ApiSelectOption } from '../ui/ApiSelect';

/**
 * Destination option from the /options endpoint.
 */
type DestinationOption = ApiSelectOption & {
    slug?: string;
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
    /** Filter only featured destinations — NOTE: /options does not filter by featured; param is ignored */
    onlyFeatured?: boolean;
    /** Maximum number of destinations to fetch (default: 100) */
    limit?: number;
};

/**
 * Transform /options API response to destination options.
 *
 * The /options endpoint returns { items: [{ id, label, slug }] }.
 */
const transformDestinationResponse = (data: unknown): DestinationOption[] => {
    const envelope = data as Record<string, unknown> | null;
    let items: unknown[] = [];

    if (envelope && typeof envelope === 'object' && 'items' in envelope) {
        items = Array.isArray(envelope.items) ? envelope.items : [];
    } else if (envelope && typeof envelope === 'object' && 'data' in envelope) {
        const inner = (envelope as { data: unknown }).data as Record<string, unknown> | null;
        if (inner && typeof inner === 'object' && 'items' in inner && Array.isArray(inner.items)) {
            items = inner.items;
        }
    }

    return (items as Record<string, unknown>[]).map((item) => ({
        id: String(item.id ?? ''),
        name: String(item.label ?? item.id ?? 'Unknown Destination'),
        slug: String(item.slug ?? '')
    }));
};

/**
 * Get display label for destination option.
 * The label field already contains the display name.
 */
const getDestinationLabel = (option: DestinationOption): string =>
    option.name || 'Unknown Destination';

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
    onlyFeatured: _onlyFeatured = false,
    limit = 100
}) => {
    const { t } = useTranslations();

    return (
        <ApiSelect
            endpoint="/api/v1/admin/destinations/options"
            queryKey={['destinations', 'options']}
            value={value}
            onValueChange={onValueChange}
            placeholder={t('admin-entities.selects.destination.placeholder')}
            disabled={disabled}
            required={required}
            error={error}
            limit={limit}
            paramName="limit"
            transformResponse={transformDestinationResponse}
            getOptionLabel={getDestinationLabel}
            getOptionValue={(option) => option.id}
            className={className}
        />
    );
};
