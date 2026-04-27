/**
 * Filter configuration for the conversations inbox.
 *
 * Defines status enum filter, accommodation lookup,
 * and guest email substring filter.
 */

import type { ConversationStatus } from '../types';

/** A single filter option for a select filter */
export interface FilterOption {
    value: string;
    labelKey: string;
}

/** Filter configuration for the inbox filter bar */
export interface ConversationFilterConfig {
    paramKey: string;
    labelKey: string;
    type: 'select' | 'text';
    order: number;
    options?: FilterOption[];
    placeholder?: string;
}

/** Status options aligned with ConversationStatus values */
const statusOptions: FilterOption[] = [
    {
        value: 'PENDING_VERIFICATION' satisfies ConversationStatus,
        labelKey: 'conversations.status.pendingVerification'
    },
    {
        value: 'PENDING_OWNER' satisfies ConversationStatus,
        labelKey: 'conversations.status.pendingOwner'
    },
    {
        value: 'PENDING_GUEST' satisfies ConversationStatus,
        labelKey: 'conversations.status.pendingGuest'
    },
    { value: 'OPEN' satisfies ConversationStatus, labelKey: 'conversations.status.open' },
    { value: 'CLOSED' satisfies ConversationStatus, labelKey: 'conversations.status.closed' },
    { value: 'BLOCKED' satisfies ConversationStatus, labelKey: 'conversations.status.blocked' }
];

/**
 * Conversation inbox filter configurations.
 * Ordered for display in the filter bar.
 */
export const conversationFilters: readonly ConversationFilterConfig[] = [
    {
        paramKey: 'status',
        labelKey: 'conversations.filters.status',
        type: 'select',
        order: 1,
        options: statusOptions
    },
    {
        paramKey: 'guestEmail',
        labelKey: 'conversations.filters.guestEmail',
        type: 'text',
        order: 2,
        placeholder: 'conversations.filters.guestEmailPlaceholder'
    }
] as const;
