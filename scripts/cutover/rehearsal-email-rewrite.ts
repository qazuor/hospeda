import type { ReadOnlyClient } from './known-ids.ts';

/**
 * The reserved domain every rewritten mailbox lands on. `.invalid` is reserved by RFC 2606 and
 * never resolves, so no message addressed to it can be delivered by anyone.
 */
export const REHEARSAL_DOMAIN = 'example.invalid';

/** What an email embedded in a longer value (a JSON document, an array, free text) becomes. */
export const REHEARSAL_EMBEDDED_ADDRESS = `rehearsal@${REHEARSAL_DOMAIN}`;

/**
 * A value that IS one email, whole (after trimming). Used case-insensitively (`~*`). Such a value
 * becomes `rehearsal+<uuid>@example.invalid`, where the uuid is a salted hash of the lower-cased
 * address: the same mailbox gets the same rewrite in every table (so `users.email` and
 * `billing_customers.email` still match), and unique columns stay unique.
 */
export const WHOLE_EMAIL_RE = '^[a-z0-9._%+-]+@[a-z0-9-]+(\\.[a-z0-9-]+)*\\.[a-z]{2,}$';

/**
 * An email anywhere in a value whose domain is NOT the rehearsal domain. Used case-insensitively.
 * The negative lookahead is what makes the rewrite idempotent: an already rewritten address never
 * matches again, and the post-check counts exactly what is left to deliver.
 */
export const FOREIGN_EMAIL_RE =
    '[a-z0-9._%+-]+@(?!example\\.invalid([^a-z0-9.-]|$))[a-z0-9-]+(\\.[a-z0-9-]+)*\\.[a-z]{2,}';

/**
 * Every column that can hold text, in every user schema, read from the catalog at run time: the
 * columns are found by their VALUES, not by a list of names, so a mailbox column of the old schema
 * (`main`) or of the new one is covered without anyone having to know it exists. Views, partitions
 * (their parent is updated), generated columns and the migrations ledger schema are left out.
 */
const DISCOVER_SQL = `
    SELECT n.nspname AS schema_name, c.relname AS table_name, a.attname AS column_name,
           format_type(a.atttypid, a.atttypmod) AS column_type,
           CASE WHEN t.typname IN ('text', 'varchar', 'bpchar', 'citext') THEN 'scalar' ELSE 'structured' END AS shape
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_type t ON t.oid = a.atttypid
    LEFT JOIN pg_type e ON e.oid = t.typelem AND t.typcategory = 'A'
    WHERE c.relkind IN ('r', 'p') AND NOT c.relispartition
      AND a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = ''
      AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'drizzle')
      AND n.nspname NOT LIKE 'pg\\_%'
      AND (t.typname IN ('text', 'varchar', 'bpchar', 'citext', 'json', 'jsonb')
           OR (t.typcategory = 'A' AND e.typname IN ('text', 'varchar', 'bpchar', 'citext')))
    ORDER BY 1, 2, 3`;

/** One text-holding column found in the catalog. */
export interface TextColumn {
    readonly schema: string;
    readonly table: string;
    readonly column: string;
    /** `format_type` of the column, used to cast a structured value back after the rewrite. */
    readonly type: string;
    /** `scalar` text can hold one whole email; `structured` (json, jsonb, text arrays) only embeds them. */
    readonly shape: 'scalar' | 'structured';
}

/** Rows touched in one column. Counts only: no address ever leaves the database. */
export interface ColumnCount {
    /** `schema.table.column`. */
    readonly column: string;
    /** Rows whose whole value was one email (rewritten to a hashed address). */
    readonly whole: number;
    /** Other rows that embedded at least one email (rewritten to the fixed address). */
    readonly embedded: number;
}

/** The count report of one run. */
export interface EmailRewriteReport {
    readonly mode: 'dry-run' | 'confirm';
    readonly outcome: 'dry-run' | 'ok';
    readonly columnsScanned: number;
    /** Only the columns with at least one row to rewrite. */
    readonly columns: readonly ColumnCount[];
    readonly totals: { readonly rows: number; readonly whole: number; readonly embedded: number };
    /** Rows still holding a deliverable address after the run: `0` on `ok`, the total on `dry-run`. */
    readonly remainingRows: number;
}

/** Raised when the rewrite did not leave the copy clean; the transaction was rolled back. */
export class EmailRewriteError extends Error {
    public constructor({ message }: { readonly message: string }) {
        super(message);
        this.name = 'EmailRewriteError';
    }
}

/** Input of {@link runEmailRewrite}. */
export interface RunEmailRewriteInput {
    readonly mode: 'dry-run' | 'confirm';
    /** A WRITABLE session already proven to be staging's database. */
    readonly client: ReadOnlyClient;
    /** Per-run secret of the hash. Held in memory only, never printed nor written. */
    readonly salt: string;
}

function quoteIdent({ name }: { readonly name: string }): string {
    return `"${name.replaceAll('"', '""')}"`;
}

function qualified(c: TextColumn): string {
    return `${quoteIdent({ name: c.schema })}.${quoteIdent({ name: c.table })}`;
}

function label(c: TextColumn): string {
    return `${c.schema}.${c.table}.${c.column}`;
}

/** Reads the text-holding columns from the catalog. */
export async function discoverTextColumns({
    client
}: {
    readonly client: ReadOnlyClient;
}): Promise<readonly TextColumn[]> {
    const { rows } = await client.query(DISCOVER_SQL);
    return rows.map((row) => ({
        schema: String(row.schema_name),
        table: String(row.table_name),
        column: String(row.column_name),
        type: String(row.column_type),
        shape: row.shape === 'scalar' ? 'scalar' : 'structured'
    }));
}

/** A statement and exactly the parameters it references (an unreferenced one is an error). */
interface Statement {
    readonly sql: string;
    readonly params: readonly string[];
}

/** Counts, in one column, the rows a run would rewrite: `$1` foreign regex, `$2` whole regex. */
function countStatement(c: TextColumn): Statement {
    const v = `${quoteIdent({ name: c.column })}::text`;
    if (c.shape === 'structured') {
        return {
            sql: `SELECT 0 AS whole, count(*)::int AS total FROM ${qualified(c)} WHERE ${v} ~* $1`,
            params: [FOREIGN_EMAIL_RE]
        };
    }
    return {
        sql: `SELECT count(*) FILTER (WHERE btrim(${v}) ~* $2)::int AS whole, count(*)::int AS total
              FROM ${qualified(c)} WHERE ${v} ~* $1`,
        params: [FOREIGN_EMAIL_RE, WHOLE_EMAIL_RE]
    };
}

/**
 * Rewrites one column and returns how many rows it touched: `$1` foreign regex, then, for a
 * scalar, `$2` whole regex and `$3` salt. A scalar that is one whole email gets the hashed address;
 * everything else gets every embedded email replaced by the fixed one, and a structured value is
 * cast back to its type.
 */
function updateStatement({
    c,
    salt
}: {
    readonly c: TextColumn;
    readonly salt: string;
}): Statement {
    const col = quoteIdent({ name: c.column });
    const v = `${col}::text`;
    const embedded = `regexp_replace(${v}, $1, '${REHEARSAL_EMBEDDED_ADDRESS}', 'gi')`;
    const wrap = (value: string): string => `WITH u AS (
                UPDATE ${qualified(c)} SET ${col} = ${value} WHERE ${v} ~* $1 RETURNING 1
            ) SELECT count(*)::int AS n FROM u`;
    if (c.shape === 'structured') {
        return { sql: wrap(`(${embedded})::${c.type}`), params: [FOREIGN_EMAIL_RE] };
    }
    return {
        sql: wrap(`CASE WHEN btrim(${v}) ~* $2
                    THEN 'rehearsal+' || md5($3::text || lower(btrim(${v})))::uuid::text || '@${REHEARSAL_DOMAIN}'
                    ELSE ${embedded} END`),
        params: [FOREIGN_EMAIL_RE, WHOLE_EMAIL_RE, salt]
    };
}

async function countColumn({
    client,
    c
}: {
    readonly client: ReadOnlyClient;
    readonly c: TextColumn;
}): Promise<{ readonly whole: number; readonly total: number }> {
    const { sql, params } = countStatement(c);
    const { rows } = await client.query(sql, params);
    return { whole: Number(rows[0]?.whole ?? 0), total: Number(rows[0]?.total ?? 0) };
}

/**
 * G2 of HOS-1957: rewrites every email of the rehearsal copy to a mailbox that cannot receive
 * mail, so neither the old image nor the new system can write to a real person during the
 * rehearsal. Note that it changes the pseudonym step 3 computes from the email: the rehearsal does
 * not prove the real pseudonyms (declared in the runbook).
 *
 * `dry-run` counts inside a `READ ONLY` transaction. `confirm` rewrites every column in ONE
 * transaction, then re-counts every column inside it: anything left (or a count that does not
 * match what was rewritten) rolls the whole run back. A column the database refuses to update
 * (a trigger, a length limit, a unique collision) rolls it back too, naming the column only.
 *
 * @param input - mode, guarded client and the per-run salt
 * @returns the count report
 * @throws EmailRewriteError when the copy would not be left clean (nothing was written)
 */
export async function runEmailRewrite(input: RunEmailRewriteInput): Promise<EmailRewriteReport> {
    const { client, mode } = input;
    await client.query(mode === 'dry-run' ? 'BEGIN READ ONLY' : 'BEGIN');
    try {
        const columns = await discoverTextColumns({ client });
        const counts: ColumnCount[] = [];
        const planned = new Map<TextColumn, number>();
        for (const c of columns) {
            const { whole, total } = await countColumn({ client, c });
            if (total === 0) continue;
            planned.set(c, total);
            counts.push({ column: label(c), whole, embedded: total - whole });
        }
        const totals = {
            rows: counts.reduce((sum, c) => sum + c.whole + c.embedded, 0),
            whole: counts.reduce((sum, c) => sum + c.whole, 0),
            embedded: counts.reduce((sum, c) => sum + c.embedded, 0)
        };
        if (mode === 'dry-run') {
            await client.query('ROLLBACK');
            return {
                mode,
                outcome: 'dry-run',
                columnsScanned: columns.length,
                columns: counts,
                totals,
                remainingRows: totals.rows
            };
        }

        for (const [c, expected] of planned) {
            let touched: number;
            try {
                const { sql, params } = updateStatement({ c, salt: input.salt });
                const { rows } = await client.query(sql, params);
                touched = Number(rows[0]?.n ?? 0);
            } catch (error) {
                const code = (error as { readonly code?: unknown }).code;
                throw new EmailRewriteError({
                    message: `the database refused the rewrite of ${label(c)} (${typeof code === 'string' ? code : 'error'}); nothing was written`
                });
            }
            if (touched !== expected) {
                throw new EmailRewriteError({
                    message: `${label(c)}: ${touched} rows rewritten, ${expected} expected; nothing was written`
                });
            }
        }
        let remaining = 0;
        for (const c of columns) {
            remaining += (await countColumn({ client, c })).total;
        }
        if (remaining !== 0) {
            throw new EmailRewriteError({
                message: `${remaining} rows still hold a deliverable address after the rewrite; nothing was written`
            });
        }
        await client.query('COMMIT');
        return {
            mode,
            outcome: 'ok',
            columnsScanned: columns.length,
            columns: counts,
            totals,
            remainingRows: 0
        };
    } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
    }
}
