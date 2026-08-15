/**
 * Builds the entries rendered by `FormErrorSummary`.
 *
 * Exists because of H-28 (smoke agosto 2026): a 400 whose failing fields have
 * no error slot in the form — a TipTap editor, a select, or a field that is
 * simply not part of this form's sections — produced NOTHING on screen. The
 * message was mapped correctly and then dropped at the last step, so the save
 * button looked like it had done nothing at all.
 *
 * The summary is the guarantee that every field error reaches the user
 * regardless of whether its field can render one. Fields that DO render their
 * own error still appear here: an error summary above the form is the standard
 * accessible pattern, and duplicating a message is far cheaper than silently
 * losing one.
 *
 * @module form-error-summary
 */

import type { SectionConfig } from '@/components/entity-form/types/section-config.types';

/** One row of the summary. */
export interface FormErrorSummaryEntry {
    /** Dot-notation field path as reported by the API (e.g. `address.city`). */
    readonly field: string;
    /** Human label when the field is part of the form, else the field path. */
    readonly label: string;
    /** Already-translated message to display. */
    readonly message: string;
}

/** Input for {@link buildFormErrorSummaryEntries}. */
export interface BuildFormErrorSummaryEntriesInput {
    /** Field path → message map, as produced by `parseApiValidationErrors`. */
    readonly errors: Record<string, string | undefined>;
    /** Sections currently rendered, used to resolve labels and ordering. */
    readonly sections?: readonly SectionConfig[];
}

/**
 * Collect `fieldId → label` from a section tree, including nested sections.
 *
 * @param sections - Section configs to walk
 * @returns Map of field id to its label, in declaration order
 */
function collectFieldLabels(sections: readonly SectionConfig[]): Map<string, string> {
    const labels = new Map<string, string>();

    const walk = (list: readonly SectionConfig[]): void => {
        for (const section of list) {
            for (const field of section.fields ?? []) {
                if (!labels.has(field.id)) {
                    labels.set(field.id, field.label ?? field.title ?? field.id);
                }
            }
            if (section.sections) walk(section.sections);
        }
    };

    walk(sections);

    return labels;
}

/**
 * Resolve the label for a field path, tolerating the suffixes the form adds to
 * a single config field — multilang inputs report `description.es`, and nested
 * schemas report `location.city` for a `location` field.
 *
 * @param field - Dot-notation field path from the API
 * @param labels - Map built by `collectFieldLabels`
 * @returns The closest matching label, or the field path when nothing matches
 */
function resolveFieldLabel(field: string, labels: ReadonlyMap<string, string>): string {
    const exact = labels.get(field);
    if (exact) return exact;

    const parts = field.split('.');
    for (let i = parts.length - 1; i > 0; i--) {
        const candidate = labels.get(parts.slice(0, i).join('.'));
        if (candidate) return candidate;
    }

    return field;
}

/**
 * Build the summary rows for a form error map.
 *
 * Entries are ordered by field declaration order so the summary reads like the
 * form. Errors on fields absent from the sections — the ones most likely to
 * have nowhere to render — are kept and appended at the end, never dropped.
 *
 * @param input - Errors map plus the sections currently rendered
 * @returns Ordered, de-duplicated summary entries (empty when there is nothing to show)
 */
export function buildFormErrorSummaryEntries({
    errors,
    sections = []
}: BuildFormErrorSummaryEntriesInput): readonly FormErrorSummaryEntry[] {
    const labels = collectFieldLabels(sections);
    const declared = [...labels.keys()];

    const present = Object.entries(errors).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0
    );

    const rank = (field: string): number => {
        const index = declared.indexOf(field);
        if (index !== -1) return index;

        const parts = field.split('.');
        for (let i = parts.length - 1; i > 0; i--) {
            const parentIndex = declared.indexOf(parts.slice(0, i).join('.'));
            if (parentIndex !== -1) return parentIndex;
        }

        return Number.MAX_SAFE_INTEGER;
    };

    return present
        .map(([field, message], position) => ({ field, message, position }))
        .sort((a, b) => rank(a.field) - rank(b.field) || a.position - b.position)
        .map(({ field, message }) => ({
            field,
            label: resolveFieldLabel(field, labels),
            message
        }));
}
