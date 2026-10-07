import type { ObjectKind, ProviderApi, ProviderObject } from './types.ts';

const PAGE_SIZE = 100;
const MAX_PAGES = 10_000;

/** Result of one unfiltered, paginated walk of a family. */
export interface WalkResult {
    readonly kind: ObjectKind;
    /** The `total` the provider reported. */
    readonly total: number;
    /** Distinct ids seen. */
    readonly ids: ReadonlySet<string>;
    /** Rows seen, duplicates included (a drifting offset shows up as rows > ids). */
    readonly rowsSeen: number;
    /** True when `total` differed between pages. */
    readonly totalChanged: boolean;
}

/**
 * Walks every object of a family with NO filter. Filtered search returns a subset
 * with no signal that rows are missing (RC-1), so the census never filters.
 *
 * @param input - provider client and family
 * @returns the ids seen and the counts needed for the completeness gate
 */
export async function walkAll({
    api,
    kind
}: {
    readonly api: ProviderApi;
    readonly kind: ObjectKind;
}): Promise<WalkResult> {
    const ids = new Set<string>();
    let rowsSeen = 0;
    let total = 0;
    let totalChanged = false;
    let offset = 0;
    for (let page = 0; page < MAX_PAGES; page += 1) {
        const answer = await api.listPage({ kind, offset, limit: PAGE_SIZE });
        if (page === 0) total = answer.total;
        else if (answer.total !== total) totalChanged = true;
        for (const row of answer.results) ids.add(row.id);
        rowsSeen += answer.results.length;
        offset += answer.results.length;
        if (answer.results.length === 0 || offset >= total) break;
    }
    return { kind, total, ids, rowsSeen, totalChanged };
}

/**
 * Re-reads every id BY ID. The search listing can be minutes stale (RC-4); only the
 * read by id is trusted for status.
 *
 * @param input - provider client, family and ids
 * @returns one object per id, with its true status
 */
export async function rereadAll({
    api,
    kind,
    ids
}: {
    readonly api: ProviderApi;
    readonly kind: ObjectKind;
    readonly ids: Iterable<string>;
}): Promise<readonly ProviderObject[]> {
    const out: ProviderObject[] = [];
    for (const id of ids) out.push(await api.getById({ kind, id }));
    return out;
}
