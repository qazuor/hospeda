import type { DirectEmailTemplate } from '@repo/schemas';
import { and, desc, eq, isNull, type SQL } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { directEmailTemplates } from '../../schemas/direct-email/direct_email_template.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { safeIlike } from '../../utils/drizzle-helpers.ts';

/** Input of {@link DirectEmailTemplateModel.findLivePage}. */
export interface DirectEmailTemplatePageInput {
    readonly page: number;
    readonly pageSize: number;
    /** Case-insensitive text matched against the name. */
    readonly search?: string;
}

/**
 * Model for `direct_email_template` (HOS-2685). Soft delete by default, per
 * `BaseModelImpl`; reads here only ever see live rows.
 */
export class DirectEmailTemplateModel extends BaseModelImpl<DirectEmailTemplate> {
    protected table = directEmailTemplates;
    public entityName = 'directEmailTemplates';

    protected getTableName(): string {
        return 'directEmailTemplates';
    }

    /**
     * One page of live templates, most recently edited first.
     *
     * @param input - Page, page size and optional name search
     * @param tx - Optional transaction client
     * @returns The page and the total of matching live templates
     */
    async findLivePage(
        input: DirectEmailTemplatePageInput,
        tx?: DrizzleClient
    ): Promise<{ items: DirectEmailTemplate[]; total: number }> {
        const conditions: SQL[] = [isNull(directEmailTemplates.deletedAt)];
        if (input.search) conditions.push(safeIlike(directEmailTemplates.name, input.search));
        const where = and(...conditions);
        const db = this.getClient(tx);
        const [rows, total] = await Promise.all([
            db
                .select()
                .from(directEmailTemplates)
                .where(where)
                .orderBy(desc(directEmailTemplates.updatedAt))
                .limit(input.pageSize)
                .offset((input.page - 1) * input.pageSize),
            this.count({}, { additionalConditions: [where as SQL], tx })
        ]);
        // DRIZZLE-LIMITATION: select() rows carry the unknown-typed jsonb / branded pgEnum columns; cast to the canonical schema type.
        return { items: rows as unknown as DirectEmailTemplate[], total };
    }

    /**
     * Reads one live template.
     *
     * @param id - Template id
     * @param tx - Optional transaction client
     * @returns The template, or `null` when missing or soft-deleted
     */
    async findLiveById(id: string, tx?: DrizzleClient): Promise<DirectEmailTemplate | null> {
        const db = this.getClient(tx);
        const rows = await db
            .select()
            .from(directEmailTemplates)
            .where(and(eq(directEmailTemplates.id, id), isNull(directEmailTemplates.deletedAt)))
            .limit(1);
        // DRIZZLE-LIMITATION: select() rows carry the unknown-typed jsonb / branded pgEnum columns; cast to the canonical schema type.
        return (rows[0] as unknown as DirectEmailTemplate) ?? null;
    }
}
