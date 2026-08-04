/**
 * Alliance-lead service barrel export (HOS-277, extended by HOS-278).
 *
 * Exports `AllianceLeadService` (public submission, applicant self-service
 * listing, admin listing, and admin approve/reject) plus its RO-RO input types.
 */

export {
    AllianceLeadService,
    type CreateAllianceLeadInput,
    type ListAllianceLeadsForAdminInput,
    type ListMyAllianceLeadsInput,
    type MarkAllianceLeadHandledInput
} from './alliance-lead.service';
