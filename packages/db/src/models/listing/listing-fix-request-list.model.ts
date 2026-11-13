import type { PublicationStatusEnum } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import type { DrizzleClient } from '../../types.ts';
import { TABLES } from './listing-moderation.model.ts';
import type { ListingVertical } from './listing-publication.model.ts';

/** A joined open fix request and its non-deleted listing. */
export interface OpenFixRequestRow {
    readonly id: string;
    readonly vertical: ListingVertical;
    readonly listingId: string;
    readonly listingName: string;
    readonly listingSlug: string;
    readonly publicationStatus: PublicationStatusEnum;
    readonly reason: string;
    readonly suggestedDate: string | null;
    readonly openedAt: Date;
    readonly ownerReportedFixedAt: Date | null;
}

type RawOpenFixRequestRow = Omit<OpenFixRequestRow, 'openedAt' | 'ownerReportedFixedAt'> & {
    opened_at: Date | string;
    ownerReportedFixedAt: Date | string | null;
};

/** Lists open fix requests across the requested listing verticals. */
export async function listOpenFixRequests(input: {
    readonly client?: DrizzleClient;
    readonly verticals: readonly ListingVertical[];
    readonly ownerReported?: boolean;
    readonly suggestedBefore?: string;
    readonly page: number;
    readonly pageSize: number;
}): Promise<{ readonly items: readonly OpenFixRequestRow[]; readonly total: number }> {
    const client = input.client ?? getDb();
    const branches = input.verticals.map((vertical) => {
        const table = TABLES[vertical];
        return sql`SELECT fr.id::text AS id, fr.entity_type AS vertical, l.id::text AS "listingId",
            l.name AS "listingName", l.slug AS "listingSlug",
            l.publication_status AS "publicationStatus", fr.reason, fr.suggested_date AS "suggestedDate",
            fr.opened_at AS opened_at, fr.owner_reported_fixed_at AS "ownerReportedFixedAt"
            FROM fix_request fr JOIN ${sql.identifier(table)} l
              ON l.id = fr.entity_id AND fr.entity_type = ${vertical}
            WHERE fr.closed_at IS NULL AND l.deleted_at IS NULL
              AND (${input.ownerReported === undefined ? null : input.ownerReported}::boolean IS NULL
                OR (fr.owner_reported_fixed_at IS NOT NULL) = ${input.ownerReported ?? false})
              AND (${input.suggestedBefore ?? null}::date IS NULL OR fr.suggested_date < ${input.suggestedBefore ?? null}::date)`;
    });
    const union = branches.length
        ? sql.join(branches, sql` UNION ALL `)
        : sql`SELECT NULL WHERE false`;
    const countResult = await client.execute(
        sql`SELECT COUNT(*)::int AS total FROM (${union}) requests`
    );
    const listResult = await client.execute(sql`
        SELECT * FROM (${union}) requests ORDER BY opened_at ASC, id ASC
        LIMIT ${input.pageSize} OFFSET ${(input.page - 1) * input.pageSize}`);
    // DRIZZLE-LIMITATION: Raw SQL results are exposed as unknown and need a row-shape assertion.
    const countRows = countResult.rows as unknown as { total: number | string }[];
    // DRIZZLE-LIMITATION: Raw SQL results are exposed as unknown and need a row-shape assertion.
    const rows = listResult.rows as unknown as RawOpenFixRequestRow[];
    return {
        total: Number(countRows[0]?.total ?? 0),
        items: rows.map((row) => {
            const { opened_at, ...rest } = row;
            return {
                ...rest,
                openedAt: new Date(opened_at),
                ownerReportedFixedAt: row.ownerReportedFixedAt
                    ? new Date(row.ownerReportedFixedAt)
                    : null
            };
        })
    };
}
