import type { DirectEmailSuppression } from '@repo/schemas';
import { DirectEmailSuppressionReasonEnum } from '@repo/schemas';
import { and, count, desc, eq, inArray, ne, type SQL, sql } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { directEmailSuppressions } from '../../schemas/direct-email/direct_email_suppression.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { safeIlike } from '../../utils/drizzle-helpers.ts';

/** Case-insensitive address, the expression the unique index is built on. */
const lowerEmail = sql`lower(${directEmailSuppressions.email})`;

/** Input of {@link DirectEmailSuppressionModel.findPage}. */
export interface DirectEmailSuppressionPageInput {
    readonly page: number;
    readonly pageSize: number;
    /** Case-insensitive text matched against the address. */
    readonly search?: string;
    readonly reason?: DirectEmailSuppressionReasonEnum;
}

/** Input of {@link DirectEmailSuppressionModel.insertIfAbsent}. */
export interface InsertSuppressionInput {
    /** Lowercased address. */
    readonly email: string;
    readonly reason: DirectEmailSuppressionReasonEnum;
    readonly createdBy: string | null;
}

/**
 * Model for `direct_email_suppression` (HOS-2685). Rows are hard-deleted: removing
 * an address from the list is the point.
 */
export class DirectEmailSuppressionModel extends BaseModelImpl<DirectEmailSuppression> {
    protected table = directEmailSuppressions;
    public entityName = 'directEmailSuppressions';

    protected getTableName(): string {
        return 'directEmailSuppressions';
    }

    /**
     * Which of the given addresses are suppressed.
     *
     * @param emails - Lowercased addresses
     * @param tx - Optional transaction client
     * @returns The suppressed subset, lowercased
     */
    async findSuppressedEmails(emails: readonly string[], tx?: DrizzleClient): Promise<string[]> {
        if (emails.length === 0) return [];
        const db = this.getClient(tx);
        const rows = await db
            .select({ email: directEmailSuppressions.email })
            .from(directEmailSuppressions)
            .where(
                inArray(
                    lowerEmail,
                    emails.map((email) => email.toLowerCase())
                )
            );
        return rows.map((row) => row.email.toLowerCase());
    }

    /**
     * Adds an address to the list unless it is already there (one row per address,
     * the first reason wins).
     *
     * @param input - Address, reason and the admin who added it (or `null`)
     * @param tx - Optional transaction client
     * @returns The row, and whether this call created it
     */
    async insertIfAbsent(
        input: InsertSuppressionInput,
        tx?: DrizzleClient
    ): Promise<{ suppression: DirectEmailSuppression; created: boolean }> {
        const db = this.getClient(tx);
        const [inserted] = await db
            .insert(directEmailSuppressions)
            .values(input)
            // No target: the unique index is on lower(email), an expression.
            .onConflictDoNothing()
            .returning();
        if (inserted) {
            // DRIZZLE-LIMITATION: select() rows carry the unknown-typed jsonb / branded pgEnum columns; cast to the canonical schema type.
            return { suppression: inserted as unknown as DirectEmailSuppression, created: true };
        }
        const [existing] = await db
            .select()
            .from(directEmailSuppressions)
            .where(sql`${lowerEmail} = ${input.email.toLowerCase()}`)
            .limit(1);
        // DRIZZLE-LIMITATION: select() rows carry the unknown-typed jsonb / branded pgEnum columns; cast to the canonical schema type.
        return { suppression: existing as unknown as DirectEmailSuppression, created: false };
    }

    /**
     * Records a person's opt-out. A new address is inserted as `opt_out`; an address already
     * suppressed as `manual` or `hard_bounce` is UPGRADED to `opt_out` (the person's own
     * request must lock the row, whatever came first). An existing `opt_out` is untouched.
     * One statement on the `lower(email)` unique index: no read-then-write window.
     *
     * @param input.email - Address (lowercased here)
     * @param tx - Optional transaction client
     * @returns The row as it stands after the upsert
     */
    async upsertOptOut(
        input: { readonly email: string },
        tx?: DrizzleClient
    ): Promise<DirectEmailSuppression> {
        const db = this.getClient(tx);
        const email = input.email.trim().toLowerCase();
        // Raw SQL: drizzle's onConflictDoUpdate cannot target an expression index.
        await db.execute(sql`
            insert into direct_email_suppression (email, reason, created_by)
            values (${email}, ${DirectEmailSuppressionReasonEnum.OPT_OUT}::direct_email_suppression_reason_enum, null)
            on conflict (lower(email)) do update set reason = excluded.reason
        `);
        const [row] = await db
            .select()
            .from(directEmailSuppressions)
            .where(sql`${lowerEmail} = ${email}`)
            .limit(1);
        // DRIZZLE-LIMITATION: select() rows carry the unknown-typed jsonb / branded pgEnum columns; cast to the canonical schema type.
        return row as unknown as DirectEmailSuppression;
    }

    /**
     * Deletes a suppression unless it is an `opt_out`, in ONE statement
     * (`DELETE ... WHERE id = $1 AND reason <> 'opt_out'`), so a concurrent upgrade to
     * `opt_out` can never be undone by a delete that checked the reason earlier.
     *
     * @param id - Suppression id
     * @param tx - Optional transaction client
     * @returns Rows deleted: 0 when the id is unknown or the row is an opt-out
     */
    async deleteUnlessOptOut(id: string, tx?: DrizzleClient): Promise<number> {
        const db = this.getClient(tx);
        const deleted = await db
            .delete(directEmailSuppressions)
            .where(
                and(
                    eq(directEmailSuppressions.id, id),
                    ne(directEmailSuppressions.reason, DirectEmailSuppressionReasonEnum.OPT_OUT)
                )
            )
            .returning({ id: directEmailSuppressions.id });
        return deleted.length;
    }

    /**
     * One page of the list, newest first.
     *
     * @param input - Page, page size, optional address search and reason filter
     * @param tx - Optional transaction client
     * @returns The page and the total of matching rows
     */
    async findPage(
        input: DirectEmailSuppressionPageInput,
        tx?: DrizzleClient
    ): Promise<{ items: DirectEmailSuppression[]; total: number }> {
        const conditions: SQL[] = [];
        if (input.search) conditions.push(safeIlike(directEmailSuppressions.email, input.search));
        if (input.reason) conditions.push(eq(directEmailSuppressions.reason, input.reason));
        const where = conditions.length > 0 ? and(...conditions) : undefined;
        const db = this.getClient(tx);
        const [rows, totals] = await Promise.all([
            db
                .select()
                .from(directEmailSuppressions)
                .where(where)
                .orderBy(desc(directEmailSuppressions.createdAt))
                .limit(input.pageSize)
                .offset((input.page - 1) * input.pageSize),
            db.select({ total: count() }).from(directEmailSuppressions).where(where)
        ]);
        return {
            // DRIZZLE-LIMITATION: select() rows carry the unknown-typed jsonb / branded pgEnum columns; cast to the canonical schema type.
            items: rows as unknown as DirectEmailSuppression[],
            total: totals[0]?.total ?? 0
        };
    }
}
