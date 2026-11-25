/** Shared required-section and recommendation presentation for all editor hubs. */
import type { EditorCompleteness } from './editor-completeness';
import type { EditorSectionStatus } from './editor-hub-status-model';

/** Meter and rows share the same required-section verdict; advisory facts never change it. */
export function resolveEditorHubPresentation({
    completeness,
    statuses
}: {
    readonly completeness: EditorCompleteness;
    readonly statuses: Readonly<Record<string, EditorSectionStatus>>;
}): {
    readonly completeness: EditorCompleteness;
    readonly statuses: Readonly<Record<string, EditorSectionStatus>>;
    readonly recommendedCount: number;
} {
    const rows: Record<string, EditorSectionStatus> = { ...statuses };
    for (const sectionId of completeness.requiredSections) {
        const completion = completeness.missing.includes(sectionId) ? 'incomplete' : 'complete';
        const existing = rows[sectionId];
        rows[sectionId] = existing
            ? { ...existing, completion }
            : {
                  labelKey: `account.editorHub.${completion}`,
                  tone: completion === 'complete' ? 'neutral' : 'blocking',
                  completion
              };
    }
    return {
        completeness,
        statuses: rows,
        recommendedCount: Object.values(rows).filter((status) => status.tone === 'warning').length
    };
}
