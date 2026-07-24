/**
 * Alliance Leads feature barrel export.
 *
 * Exports all public-facing hooks and components for the alliance lead inbox
 * (HOS-277 §6.4).
 */

// Components
export { AllianceLeadInbox } from './components/AllianceLeadInbox';
export type { AllianceLeadStatusBadgeProps } from './components/AllianceLeadStatusBadge';
export { AllianceLeadStatusBadge } from './components/AllianceLeadStatusBadge';
export type {
    AllianceLeadPagination,
    AllianceLeadsPage,
    AllianceLeadsQueryParams,
    MarkAllianceLeadHandledPayload
} from './hooks/useAllianceLeads';
// Hooks
export {
    allianceLeadKeys,
    useAllianceLeadsQuery,
    useMarkAllianceLeadHandledMutation
} from './hooks/useAllianceLeads';
