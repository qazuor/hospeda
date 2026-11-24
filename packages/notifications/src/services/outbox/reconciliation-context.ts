import type {
    ReconciliationSubjectLookup,
    ReconciliationSubjectsReader,
    ReconciliationSummaryContext
} from '../../templates/billing/reconciliation-summary-enrichment.js';

/**
 * Render-time collaborators shared by the reconciliation summary and the staff
 * notices that name a subject (HOS-1971, HOS-2565 D8 and D9). All optional: a
 * missing or failing reader never blocks a send.
 *
 * @module services/outbox/reconciliation-context
 */
export interface SubjectEnrichment {
    /** Batched reader of holders and plans. Absent: no enrichment. */
    readonly readSubjects?: ReconciliationSubjectsReader;
    /** Marker of a non-production environment, e.g. `STAGING`. */
    readonly environmentLabel?: string;
    /** Admin panel base URL, without a trailing slash. Absent: no links. */
    readonly adminUrl?: string;
    /** Called when the reader throws; the mail still renders without details. */
    readonly onEnrichmentError?: (input: { readonly error: unknown }) => void;
}

/**
 * Resolves the subjects named by a lookup in ONE batched call. Never throws:
 * a failed or missing reader yields a context without details, so every row
 * that needs them is omitted and the mail still goes out (HOS-2565 AC-3.9).
 *
 * @param input.lookup - The ids to resolve
 * @param input.enrichment - The collaborators
 * @returns The context, with empty maps when nothing could be resolved
 */
export async function readSubjectContext(input: {
    readonly lookup: ReconciliationSubjectLookup;
    readonly enrichment: SubjectEnrichment;
}): Promise<ReconciliationSummaryContext> {
    const { enrichment, lookup } = input;
    const empty: ReconciliationSummaryContext = {
        ...(enrichment.environmentLabel ? { environmentLabel: enrichment.environmentLabel } : {}),
        ...(enrichment.adminUrl ? { adminUrl: enrichment.adminUrl } : {}),
        subscriptions: new Map(),
        addonInstances: new Map(),
        openMarks: new Map()
    };
    if (!enrichment.readSubjects) return empty;
    try {
        const found = await enrichment.readSubjects(lookup);
        return { ...empty, ...found };
    } catch (error) {
        enrichment.onEnrichmentError?.({ error });
        return empty;
    }
}
