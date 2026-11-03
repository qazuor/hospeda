import { sql } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import type { DrizzleClient } from '../../types.ts';

/** One database row exposed by a Partner application panel view. */
export interface PartnerApplicationPanelRow {
    readonly id: string;
    readonly email: string;
    readonly status: 'PENDING' | 'APPROVED' | 'REJECTED';
    readonly createdAt: Date;
    readonly resolvedAt: Date | null;
    readonly overdue: boolean;
    readonly waitEndsAt: Date | null;
    readonly partner: { readonly id: string; readonly name: string; readonly slug: string } | null;
}

/** Input for a paginated Partner application panel read. */
export interface ListPartnerApplicationsForPanelInput {
    readonly client?: DrizzleClient;
    readonly view: 'pending' | 'approvedUnclaimed' | 'rejectedWaiting';
    readonly now: Date;
    readonly page: number;
    readonly pageSize: number;
}

/** Result of listing Partner applications for one panel view. */
export interface ListPartnerApplicationsForPanelResult {
    readonly items: readonly PartnerApplicationPanelRow[];
    readonly total: number;
}

interface RawPanelRow {
    id: string;
    email: string;
    status: PartnerApplicationPanelRow['status'];
    created_at: Date;
    resolved_at: Date | null;
    overdue: boolean;
    wait_ends_at: Date | null;
    partner_id: string | null;
    partner_name: string | null;
    partner_slug: string | null;
}

/**
 * Lists admin panel applications. This is the sole overdue-applications query
 * and supplies the clock-injectable read required by AC:V7:6 and PLAZO:8.
 * @throws Error when a row needs a deadline that is absent from its version.
 */
export async function listPartnerApplicationsForPanel(
    input: ListPartnerApplicationsForPanelInput
): Promise<ListPartnerApplicationsForPanelResult> {
    const db = input.client ?? getDb();
    const approved = input.view === 'approvedUnclaimed';
    const rejected = input.view === 'rejectedWaiting';
    const needsDeadline = !approved;
    const status = approved ? 'APPROVED' : rejected ? 'REJECTED' : 'PENDING';
    const partnerJoin = approved ? sql`JOIN partners p ON p.id = pa.partner_id` : sql``;
    const eligibility = approved
        ? sql`AND p.owner_user_id IS NULL AND p.deleted_at IS NULL`
        : rejected
          ? sql`AND pa.wait_cancelled_at IS NULL AND pa.resolved_at IS NOT NULL`
          : sql``;
    const deadlineKey = rejected ? '9' : '8';
    const deadlineColumn = rejected ? sql`d.d9` : sql`d.d8`;
    const deadlineJoin = needsDeadline
        ? sql`LEFT JOIN LATERAL (
                SELECT
                    ("values" -> '8' ->> 'days')::int AS d8,
                    ("values" -> '9' ->> 'days')::int AS d9
                FROM vertical_deadline_version
                WHERE version = COALESCE(
                    pa.deadlines_version,
                    (SELECT max(version) FROM vertical_deadline_version)
                )
            ) d ON TRUE`
        : sql``;

    if (needsDeadline) {
        const invalid = await db.execute(sql`
            SELECT pa.id
            FROM partner_application pa
            ${partnerJoin}
            ${deadlineJoin}
            WHERE pa.status = ${status}
              ${eligibility}
              AND ${deadlineColumn} IS NULL
            LIMIT 1`);
        if (invalid.rows.length > 0) {
            throw new Error(
                `Partner application panel requires PLAZO:${deadlineKey} in its deadline version`
            );
        }
    }

    const activeWaitFilter = rejected
        ? sql`AND pa.resolved_at + make_interval(days => d.d9) > ${input.now}`
        : sql``;
    const order = rejected
        ? sql`pa.resolved_at DESC, pa.id ASC`
        : approved
          ? sql`pa.resolved_at ASC NULLS LAST, pa.id ASC`
          : sql`pa.created_at ASC, pa.id ASC`;
    const totalResult = await db.execute(sql`
        SELECT count(*)::int AS total
        FROM partner_application pa
        ${partnerJoin}
        ${deadlineJoin}
        WHERE pa.status = ${status}
          ${eligibility}
          ${activeWaitFilter}`);
    const total = Number(totalResult.rows[0]?.total ?? 0);
    const offset = (input.page - 1) * input.pageSize;
    const rowsResult = await db.execute(sql`
        SELECT
            pa.id,
            pa.email,
            pa.status,
            pa.created_at,
            pa.resolved_at,
            ${input.view === 'pending' ? sql`pa.created_at + make_interval(days => d.d8) < ${input.now}` : sql`FALSE`} AS overdue,
            ${rejected ? sql`pa.resolved_at + make_interval(days => d.d9)` : sql`NULL::timestamptz`} AS wait_ends_at,
            ${approved ? sql`p.id` : sql`NULL::uuid`} AS partner_id,
            ${approved ? sql`p.name` : sql`NULL::text`} AS partner_name,
            ${approved ? sql`p.slug` : sql`NULL::text`} AS partner_slug
        FROM partner_application pa
        ${partnerJoin}
        ${deadlineJoin}
        WHERE pa.status = ${status}
          ${eligibility}
          ${activeWaitFilter}
        ORDER BY ${order}
        LIMIT ${input.pageSize} OFFSET ${offset}`);
    // DRIZZLE-LIMITATION: execute() returns untyped raw rows for parameterized SQL.
    const rawRows = rowsResult.rows as unknown as RawPanelRow[];
    return {
        items: rawRows.map((row) => ({
            id: String(row.id),
            email: String(row.email),
            status: row.status,
            createdAt: row.created_at,
            resolvedAt: row.resolved_at,
            overdue: row.overdue,
            waitEndsAt: row.wait_ends_at,
            partner:
                row.partner_id === null
                    ? null
                    : {
                          id: row.partner_id,
                          name: String(row.partner_name),
                          slug: String(row.partner_slug)
                      }
        })),
        total
    };
}
