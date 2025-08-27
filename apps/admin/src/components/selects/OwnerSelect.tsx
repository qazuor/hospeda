/**
 * Owner Select Component
 *
 * Specialized select component for choosing accommodation owners (users).
 * Uses the generic ApiSelect component with user-specific configuration.
 */
import type { FC } from 'react';
import { ApiSelect, type ApiSelectOption } from '../ui/ApiSelect';

/**
 * User option type with additional properties
 */
type UserOption = ApiSelectOption & {
    email?: string;
    role?: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
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
    /** Maximum number of users to fetch (default: 1000) */
    limit?: number;
};

/**
 * Transform API response to user options
 * Handles different possible user data structures
 */
const transformUserResponse = (data: unknown): UserOption[] => {
    let users: unknown[] = [];

    // Handle different response structures
    if (Array.isArray(data)) {
        users = data;
    } else if (data && typeof data === 'object' && 'data' in data) {
        const responseData = (data as { data: { items: unknown } }).data.items;
        if (Array.isArray(responseData)) {
            users = responseData;
        }
    }

    return (users as Record<string, unknown>[]).map((user: Record<string, unknown>) => ({
        id: String(user.id || user._id || ''),
        name: String(
            user.displayName ||
                user.name ||
                `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
                user.email ||
                'Unknown User'
        ),
        email: String(user.email || ''),
        role: String(user.role || ''),
        firstName: String(user.firstName || ''),
        lastName: String(user.lastName || ''),
        displayName: String(user.displayName || ''),
        ...user
    }));
};

/**
 * Get display label for user option
 * Shows name and email for better identification
 */
const getUserLabel = (option: UserOption): string => {
    const name =
        option.name ||
        option.displayName ||
        [option.firstName, option.lastName].filter(Boolean).join(' ');
    const email = option.email;

    if (name && email && name !== email) {
        return `${name} (${email})`;
    }

    return name || email || 'Unknown User';
};

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
    return (
        <ApiSelect
            endpoint="/api/v1/public/users"
            queryKey={['users', 'list']}
            value={value}
            onValueChange={onValueChange}
            placeholder="Select an owner..."
            disabled={disabled}
            required={required}
            error={error}
            limit={limit}
            transformResponse={transformUserResponse}
            getOptionLabel={getUserLabel}
            getOptionValue={(option) => option.id}
            className={className}
        />
    );
};
