import type { DrizzleClient } from '@repo/db';
import { sql } from '@repo/db';
import type { EntityChangeData } from '@repo/service-core';
import { getAffectedCacheTags } from '@repo/service-core';
import { PASSAGE_TABLE } from './passage-table.js';
import type { PassageRow } from './ports.js';

/** External page-cache and edge purge port. */
export interface PagePurger {
    /** Purges one ordered group of cache tags. */
    purge(input: { readonly group: string; readonly tags: readonly string[] }): Promise<{
        readonly ok: boolean;
        readonly failed: readonly string[];
    }>;
}

/** A tag group and its purge verdict. */
export interface Step4cGroup {
    readonly name: 'listings' | 'collections' | 'destinations';
    readonly tagCount: number;
    readonly ok: boolean;
    readonly failed: readonly string[];
}

/** Secret-free step 4c result. */
export interface Step4cResult {
    readonly status: 'completed' | 'failed' | 'dry_run';
    readonly groups: readonly Step4cGroup[];
    readonly listingCount: number;
    readonly destinationCount: number;
}

/** Missing passage table means the required earlier cutover step did not run or 5b ran first. */
export class Step4cPassageTableMissingError extends Error {
    constructor() {
        super('Step 4c requires cutover_v6_deleted_listing; run it before step 5b.');
        this.name = 'Step4cPassageTableMissingError';
    }
}

/** Inputs for the 4c cutover tool. */
export interface RunStep4cInput {
    readonly db: DrizzleClient;
    readonly pagePurger: PagePurger;
    readonly dryRun: boolean;
}

/** Revalidates deleted listing pages, collection pages, home, and live destinations. */
export async function runStep4c({ db, pagePurger, dryRun }: RunStep4cInput): Promise<Step4cResult> {
    const existence = await db.execute(
        sql`SELECT to_regclass('public.cutover_v6_deleted_listing')::text AS table_name`
    );
    if (rowsOf<{ table_name: string | null }>(existence)[0]?.table_name == null) {
        throw new Step4cPassageTableMissingError();
    }

    const passageResult = await db.execute(sql`
        SELECT entity_type AS "entityType", entity_id::text AS "entityId"
        FROM ${sql.raw(PASSAGE_TABLE)}
        ORDER BY entity_type, entity_id
    `);
    const listings = rowsOf<{ entityType: PassageRow['entityType']; entityId: string }>(
        passageResult
    );
    const destinationResult = await db.execute(sql`
        SELECT id::text AS id, slug
        FROM destinations
        WHERE deleted_at IS NULL
        ORDER BY slug, id
    `);
    const destinations = rowsOf<{ id: string; slug: string }>(destinationResult);

    const listingTags = sortedUnique(
        listings.flatMap(({ entityType, entityId }) => entityTags({ entityType, id: entityId }))
    );
    const collectionTags = sortedUnique(
        (['accommodation', 'gastronomy', 'experience'] as const)
            .flatMap((entityType) => getAffectedCacheTags({ entityType }))
            .filter((tag) => tag.startsWith('list-') || tag === 'home')
    );
    const destinationTags = sortedUnique(
        destinations.flatMap(({ id, slug }) => entityTags({ entityType: 'destination', slug, id }))
    );

    const groups: Step4cGroup[] = [];
    for (const [name, tags] of [
        ['listings', listingTags],
        ['collections', collectionTags],
        ['destinations', destinationTags]
    ] as const) {
        if (dryRun) {
            groups.push({ name, tagCount: tags.length, ok: true, failed: [] });
            continue;
        }
        if (tags.length === 0) {
            groups.push({ name, tagCount: 0, ok: true, failed: [] });
            continue;
        }
        const result = await pagePurger.purge({ group: name, tags });
        groups.push({
            name,
            tagCount: tags.length,
            ok: result.ok && result.failed.length === 0,
            failed: result.failed
        });
    }
    const ok = groups.every((group) => group.ok);
    return {
        status: dryRun ? 'dry_run' : ok ? 'completed' : 'failed',
        groups,
        listingCount: listings.length,
        destinationCount: destinations.length
    };
}

/** A change on an entity whose cache tags carry the entity's own slug or id. */
type SlugTaggedChange = Extract<
    EntityChangeData,
    { entityType: 'destination' | 'accommodation' | 'gastronomy' | 'experience' }
>;

/** Entity types whose cache tags carry the entity's own slug or id. */
const SLUG_TAGGED_ENTITY_TYPES: ReadonlySet<EntityChangeData['entityType']> = new Set<
    SlugTaggedChange['entityType']
>(['destination', 'accommodation', 'gastronomy', 'experience']);

function isSlugTagged(event: EntityChangeData): event is SlugTaggedChange {
    return SLUG_TAGGED_ENTITY_TYPES.has(event.entityType);
}

function entityTags(event: EntityChangeData): string[] {
    if (!isSlugTagged(event)) return [];
    const identifiers = [event.slug, event.id].filter(
        (value): value is string => value !== undefined
    );
    return getAffectedCacheTags(event).filter((tag) =>
        identifiers.some((identifier) => tag.endsWith(`-${identifier}`))
    );
}

function sortedUnique(tags: readonly string[]): string[] {
    return [...new Set(tags)].sort();
}

function rowsOf<T>(value: unknown): T[] {
    if (Array.isArray(value)) return value as T[];
    if (typeof value === 'object' && value !== null && 'rows' in value) {
        const rows = value.rows;
        if (Array.isArray(rows)) return rows as T[];
    }
    return [];
}
