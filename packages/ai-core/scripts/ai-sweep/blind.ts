/**
 * Blind export and grade ingestion for the HOS-2095 sweep. Pure: no I/O.
 *
 * The export hides model, effort and cap behind an opaque id so a human or an
 * LLM grader scores each answer without knowing which variant wrote it. A
 * separate key maps id -> variant, and is only used when merging grades back.
 *
 * @module ai-core/scripts/ai-sweep/blind
 */

import { createHash } from 'node:crypto';
import { z } from 'zod';
import { type CallResult, type Grade, type PromptCase, resultKey } from './lib.js';
import type { Rubric } from './quality.js';

/** One line of the blind export: everything a grader needs, nothing that names the variant. */
export interface BlindEntry {
    readonly id: string;
    readonly caseId: string;
    readonly context: string;
    readonly question: string;
    readonly rubric: Rubric;
    readonly answer: string;
}

/** Key file content: opaque id to the result it came from. */
export type BlindKey = Readonly<
    Record<
        string,
        { readonly variantKey: string; readonly caseId: string; readonly repetition: number }
    >
>;

/**
 * Builds the blind export. Entries are sorted by their (random-looking) id so
 * ordering does not group answers by variant. Errored calls have no answer and
 * are skipped.
 */
export function buildBlindExport(input: {
    readonly results: readonly CallResult[];
    readonly cases: readonly PromptCase[];
    /** Random per export; makes ids unguessable from the variant. */
    readonly salt: string;
}): { readonly entries: BlindEntry[]; readonly key: BlindKey } {
    const caseById = new Map(input.cases.map((c) => [c.id, c]));
    const entries: BlindEntry[] = [];
    const key: Record<string, BlindKey[string]> = {};
    for (const r of input.results) {
        const promptCase = caseById.get(r.caseId);
        if (!promptCase || r.error !== null) continue;
        const id = createHash('sha256')
            .update(`${input.salt}|${resultKey(r)}`)
            .digest('hex')
            .slice(0, 10);
        if (key[id]) throw new Error(`Blind id collision on ${id}; use a different salt.`);
        key[id] = { variantKey: r.variantKey, caseId: r.caseId, repetition: r.repetition };
        entries.push({
            id,
            caseId: r.caseId,
            context: promptCase.context,
            question: promptCase.question,
            rubric: promptCase.rubric,
            answer: r.text
        });
    }
    entries.sort((a, b) => a.id.localeCompare(b.id));
    return { entries, key };
}

/** Serializes entries as JSONL (one object per line). */
export function entriesToJsonl(entries: readonly BlindEntry[]): string {
    return entries.map((e) => JSON.stringify(e)).join('\n') + (entries.length ? '\n' : '');
}

const GradesFileSchema = z.record(
    z.string(),
    z.object({
        score: z.number().int().min(1).max(5),
        notes: z.string().optional()
    })
);

/**
 * Validates a `{id: {score: 1-5, notes}}` grades object and re-keys it by
 * {@link resultKey} using the key file. Unknown ids are returned, not thrown,
 * so a partially graded file still merges.
 */
export function ingestGrades(input: { readonly grades: unknown; readonly key: BlindKey }): {
    readonly grades: Record<string, Grade>;
    readonly unknownIds: string[];
} {
    const parsed = GradesFileSchema.parse(input.grades);
    const grades: Record<string, Grade> = {};
    const unknownIds: string[] = [];
    for (const [id, grade] of Object.entries(parsed)) {
        const target = input.key[id];
        if (!target) {
            unknownIds.push(id);
            continue;
        }
        grades[resultKey(target)] = { score: grade.score, notes: grade.notes };
    }
    return { grades, unknownIds };
}
