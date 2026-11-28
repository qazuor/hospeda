import {
    readUtmParams,
    rewriteUtmParams,
    UTM_PARAM_KEYS,
    type UtmParamKey,
    type UtmQueryValues
} from './utm-query.js';

/**
 * The UTM editor of a redirectable QR code (HOS-2679), as pure functions so the
 * admin panel and the API's attribution tests share one implementation.
 *
 * Why the editor needs more than {@link rewriteUtmParams}: the QR redirect
 * decorates a stored own-site URL with `utm_source=qr&utm_medium=print&...` ONLY
 * when the URL carries no `utm_*` of its own (`withUtm` never mixes). Writing a
 * single `utm_campaign` into such a URL therefore switches the whole decoration
 * off and the scan loses `source` and `medium`. So when the stored URL has no
 * UTM and the landing does, the draft starts from the LANDING values, and the
 * first save writes the full set explicitly.
 *
 * @module attribution/utm-edit
 */

/** One editable string per UTM key; `''` means "absent". */
export type UtmEditDraft = Record<UtmParamKey, string>;

/** What {@link toUtmEditDraft} answers. */
export interface UtmEditStart {
    /** The values the editor opens with. */
    readonly draft: UtmEditDraft;
    /**
     * True when the draft came from the landing UTMs (the stored URL had none):
     * the editor should say that saving replaces the automatic values.
     */
    readonly seededFromLanding: boolean;
}

function toDraft(values: UtmQueryValues): UtmEditDraft {
    const draft = {} as UtmEditDraft;
    for (const key of UTM_PARAM_KEYS) {
        draft[key] = values[key] ?? '';
    }
    return draft;
}

const hasAny = (values: UtmQueryValues): boolean =>
    UTM_PARAM_KEYS.some((key) => values[key] !== null);

/**
 * The editor's starting values.
 *
 * @param input.url - The stored `targetUrl`.
 * @param input.landing - The UTMs a scan lands with (the API's `scanUtm`). Only
 *   non-null for a URL with no UTM of its own when the redirect decorates it,
 *   i.e. an own-site URL — so seeding needs no origin check of its own.
 * @returns The draft and whether it was seeded from the landing.
 */
export function toUtmEditDraft(input: {
    readonly url: string;
    readonly landing?: UtmQueryValues;
}): UtmEditStart {
    const stored = readUtmParams({ url: input.url });
    if (!hasAny(stored) && input.landing && hasAny(input.landing)) {
        return { draft: toDraft(input.landing), seededFromLanding: true };
    }
    return { draft: toDraft(stored), seededFromLanding: false };
}

/**
 * The new `targetUrl` for an edit, or `null` when there is nothing to write.
 *
 * - Nothing edited (draft equals the opening draft) → `null`, even for a seeded
 *   draft: opening and closing the editor never writes.
 * - Otherwise ONLY the keys whose value differs from what the URL stores are
 *   patched, so an untouched `a+b` is not re-encoded as `a%20b`. A seeded draft
 *   differs from the (empty) stored values in every seeded key, which is what
 *   writes the full set on the first save.
 * - A blank field removes its key. Comparison ignores surrounding whitespace,
 *   since the write trims.
 *
 * @param input.url - The stored `targetUrl`.
 * @param input.initial - The draft the editor opened with.
 * @param input.draft - The draft being saved.
 * @returns The rewritten URL, or `null`.
 */
export function applyUtmEdit(input: {
    readonly url: string;
    readonly initial: UtmEditDraft;
    readonly draft: UtmEditDraft;
}): string | null {
    const edited = UTM_PARAM_KEYS.some((key) => input.initial[key] !== input.draft[key]);
    if (!edited) return null;

    const stored = toDraft(readUtmParams({ url: input.url }));
    const patch: Partial<Record<UtmParamKey, string | null>> = {};
    for (const key of UTM_PARAM_KEYS) {
        const next = input.draft[key].trim();
        if (next === stored[key].trim()) continue;
        patch[key] = next === '' ? null : input.draft[key];
    }
    if (Object.keys(patch).length === 0) return null;
    return rewriteUtmParams({ url: input.url, utm: patch });
}
