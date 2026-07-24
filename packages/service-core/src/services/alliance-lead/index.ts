/**
 * Alliance-lead service barrel export (HOS-277).
 *
 * Exports `AllianceLeadService` (public submission, admin listing, and
 * admin approve/reject) plus its RO-RO input types.
 */

export {
    AllianceLeadService,
    type CreateAllianceLeadInput,
    type ListAllianceLeadsForAdminInput,
    type MarkAllianceLeadHandledInput
} from './alliance-lead.service';
