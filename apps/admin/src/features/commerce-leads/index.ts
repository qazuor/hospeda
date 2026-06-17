/**
 * Commerce Leads feature barrel export.
 *
 * Exports all public-facing hooks and components for the commerce lead inbox.
 */

// Components
export { CommerceLeadInbox } from './components/CommerceLeadInbox';
export { CommerceLeadStatusBadge } from './components/CommerceLeadStatusBadge';
export type { CommerceLeadStatusBadgeProps } from './components/CommerceLeadStatusBadge';

// Hooks
export {
    commerceLeadKeys,
    useCommerceLeadsQuery,
    useMarkLeadHandledMutation,
    useProvisionOwnerMutation
} from './hooks/useCommerceLeads';
export type {
    CommerceLeadPagination,
    CommerceLeadsPage,
    CommerceLeadsQueryParams,
    MarkLeadHandledPayload,
    ProvisionOwnerResult
} from './hooks/useCommerceLeads';
