/**
 * Utility functions for notification management
 */

export {
    resolveRenewalReminderFooter,
    resolveTrialSeriesCopy,
    type TrialSeriesVerticalCopy
} from './product-domain-copy.js';
export {
    findUnresolvedPlaceholders,
    getSubject,
    getSubjectPlaceholders,
    SAFE_FALLBACK_SUBJECT
} from './subject-builder.js';
export {
    buildSubjectData,
    DERIVED_SUBJECT_KEYS,
    type DerivedSubjectKey
} from './subject-data.js';
export { renderTiptapEmailContent } from './tiptap-email-renderer.js';
