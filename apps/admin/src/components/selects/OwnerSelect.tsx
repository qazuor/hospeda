/**
 * Owner Select Component
 *
 * Specialized select component for choosing accommodation owners (users).
 * Uses the generic ApiSelect component with user-specific configuration.
 *
 * SPEC-169 T-020: migrated from /api/v1/admin/users (requires USER_READ_ALL)
 * to /api/v1/admin/users/options (requires ACCESS_PANEL_ADMIN only).
 * Response shape: { items: [{ id, label, slug }] } — label = displayName ?? email (D4 addendum).
 */
import { useTranslations } from '@/hooks/use-translations';
import type { FC } from 'react';
import { ApiSelect, type ApiSelectOption } from '../ui/ApiSelect';

/**
 * User option from the /options endpoint.
 * The label field already contains the display name (or email as fallback — D4 addendum).
 */
type UserOption = ApiSelectOption & {
    slug?: string;
};

/**
 * Props for the OwnerSelect component
 */
type OwnerSelectProps = {
    /** Current selected owner ID */
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
    /** Maximum number of users to fetch (default: 100) */
    limit?: number;
};

/**
 * Transform /options API response to user options.
 *
 * The /options endpoint returns { items: [{ id, label, slug }] }.
 * label = displayName ?? email (D4 addendum — PII tradeoff accepted by owner).
 */
const transformUserResponse = (data: unknown): UserOption[] => {
    // /options returns { items: [...] } wrapped in the standard data envelope
    const envelope = data as Record<string, unknown> | null;
    let items: unknown[] = [];

    if (envelope && typeof envelope === 'object' && 'items' in envelope) {
        // Direct { items: [...] } (after fetchApi unwraps the outer data envelope)
        items = Array.isArray(envelope.items) ? envelope.items : [];
    } else if (envelope && typeof envelope === 'object' && 'data' in envelope) {
        // Standard admin response: { data: { items: [...] } }
        const inner = (envelope as { data: unknown }).data as Record<string, unknown> | null;
        if (inner && typeof inner === 'object' && 'items' in inner && Array.isArray(inner.items)) {
            items = inner.items;
        }
    }

    return (items as Record<string, unknown>[]).map((item) => ({
        id: String(item.id ?? ''),
        name: String(item.label ?? item.id ?? 'Unknown User'),
        slug: String(item.slug ?? '')
    }));
};

/**
 * Get display label for user option.
 * The label field already contains the best display string (D4 addendum).
 */
const getUserLabel = (option: UserOption): string => option.name || 'Unknown User';

/**
 * Owner Select Component
 *
 * Provides a select dropdown for choosing accommodation owners.
 * Fetches users from the API and displays them with name and email.
 */
export const OwnerSelect: FC<OwnerSelectProps> = ({
    value,
    onValueChange,
    disabled = false,
    required = false,
    error,
    className = '',
    limit = 100
}) => {
    const { t } = useTranslations();

    return (
        <ApiSelect
            endpoint="/api/v1/admin/users/options"
            queryKey={['users', 'options']}
            value={value}
            onValueChange={onValueChange}
            placeholder={t('admin-entities.selects.owner.placeholder')}
            disabled={disabled}
            required={required}
            error={error}
            limit={limit}
            paramName="limit"
            transformResponse={transformUserResponse}
            getOptionLabel={getUserLabel}
            getOptionValue={(option) => option.id}
            className={className}
        />
    );
};
