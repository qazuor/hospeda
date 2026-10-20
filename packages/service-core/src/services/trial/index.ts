/**
 * Trial services barrel export (HOS-1443, program HOS-1352, piece V4).
 */

export {
    type CutoverTrialListing,
    type CutoverTrialPlan,
    type CutoverTrialResult,
    writeCutoverTrials
} from './cutover-v6-trials';
export {
    type ComputeTrialEmailPseudonymResult,
    computeTrialEmailPseudonym,
    MEASURED_RULES,
    type NormalizeEmailForTrialResult,
    normalizeEmailForTrial,
    type TrialEmailPseudonymError,
    type TrialEmailPseudonymErrorCode
} from './trial-email-pseudonym';
