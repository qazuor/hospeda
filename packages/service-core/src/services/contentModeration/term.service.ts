import {
    invalidateModerationCache,
    invalidateModerationCacheByTermPattern
} from '@repo/content-moderation';
import {
    ContentModerationTermModel,
    and,
    contentModerationTerms,
    count,
    eq,
    getDb,
    isNull,
    safeIlike,
    sql
} from '@repo/db';
import {
    type ContentModerationTermAdminSearch,
    type CreateContentModerationTerm,
    ModerationCategoryEnum,
    ServiceErrorCode,
    contentModerationTermAdminSearchSchema,
    createContentModerationTermSchema,
    updateContentModerationTermSchema
} from '@repo/schemas';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, ServiceConfig, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';
import { withServiceTransaction } from '../../utils/transaction';
import {
    checkCanCreateTerm,
    checkCanDeleteTerm,
    checkCanHardDeleteTerm,
    checkCanRestoreTerm,
    checkCanUpdateTerm,
    checkCanViewTerm
} from './term.permissions';

/**
 * Hard ceiling on the number of rows a single bulk import may carry. Kept as a
 * named constant so the cheap fail-fast guard in `bulkImport` and the schema's
 * `.max()` backstop stay in sync.
 */
const MAX_BULK_IMPORT_ROWS = 5000;

const BulkImportSchema = z.object({
    rows: z.array(createContentModerationTermSchema).min(1).max(MAX_BULK_IMPORT_ROWS)
});

export class ContentModerationTermService extends BaseCrudService<
    typeof contentModerationTerms.$inferSelect,
    ContentModerationTermModel,
    typeof createContentModerationTermSchema,
    typeof updateContentModerationTermSchema,
    typeof contentModerationTermAdminSearchSchema
> {
    protected readonly entityName = 'contentModerationTerm';
    protected readonly model: ContentModerationTermModel;
    protected readonly createSchema = createContentModerationTermSchema;
    protected readonly updateSchema = updateContentModerationTermSchema;
    protected readonly searchSchema = contentModerationTermAdminSearchSchema;

    constructor(config: ServiceConfig, model?: ContentModerationTermModel) {
        super(config, 'contentModerationTerm');
        this.model = model ?? new ContentModerationTermModel();
    }

    protected getDefaultListRelations() {
        return undefined;
    }

    protected _canCreate(actor: Actor): void {
        checkCanCreateTerm(actor);
    }

    protected _canUpdate(actor: Actor): void {
        checkCanUpdateTerm(actor);
    }

    protected _canDelete(actor: Actor): void {
        checkCanDeleteTerm(actor);
    }

    protected _canView(actor: Actor): void {
        checkCanViewTerm(actor);
    }

    protected _canList(actor: Actor): void {
        checkCanViewTerm(actor);
    }

    protected _canSearch(actor: Actor): void {
        checkCanViewTerm(actor);
    }

    protected _canCount(actor: Actor): void {
        checkCanViewTerm(actor);
    }

    protected _canSoftDelete(actor: Actor): void {
        checkCanDeleteTerm(actor);
    }

    protected _canHardDelete(actor: Actor): void {
        checkCanHardDeleteTerm(actor);
    }

    protected _canRestore(actor: Actor): void {
        checkCanRestoreTerm(actor);
    }

    protected _canUpdateVisibility(actor: Actor): void {
        checkCanUpdateTerm(actor);
    }

    protected async _afterCreate(
        entity: typeof contentModerationTerms.$inferSelect
    ): Promise<typeof contentModerationTerms.$inferSelect> {
        this.invalidateCache(entity.term);
        return entity;
    }

    protected async _afterUpdate(
        entity: typeof contentModerationTerms.$inferSelect
    ): Promise<typeof contentModerationTerms.$inferSelect> {
        this.invalidateCache(entity.term);
        return entity;
    }

    protected async _afterSoftDelete(result: { count: number }): Promise<{ count: number }> {
        invalidateModerationCache();
        return result;
    }

    protected async _afterHardDelete(result: { count: number }): Promise<{ count: number }> {
        invalidateModerationCache();
        return result;
    }

    protected async _afterRestore(result: { count: number }): Promise<{ count: number }> {
        invalidateModerationCache();
        return result;
    }

    protected async _executeSearch(params: ContentModerationTermAdminSearch) {
        const {
            page = 1,
            pageSize = 10,
            search,
            kind,
            category,
            enabled,
            includeDeleted = false
        } = params;
        const db = getDb();
        const conditions = this.buildConditions({
            search,
            kind,
            category,
            enabled,
            includeDeleted
        });
        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const [items, totalRows] = await Promise.all([
            db
                .select()
                .from(contentModerationTerms)
                .where(whereClause)
                .limit(pageSize)
                .offset((page - 1) * pageSize)
                .orderBy(sql`${contentModerationTerms.term} asc`),
            db.select({ value: count() }).from(contentModerationTerms).where(whereClause)
        ]);

        return {
            items,
            total: totalRows[0]?.value ?? 0
        };
    }

    protected async _executeCount(params: ContentModerationTermAdminSearch) {
        const db = getDb();
        const conditions = this.buildConditions(params);
        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
        const rows = await db
            .select({ value: count() })
            .from(contentModerationTerms)
            .where(whereClause);
        return { count: rows[0]?.value ?? 0 };
    }

    public async bulkImport(
        actor: Actor,
        input: { rows: CreateContentModerationTerm[] },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ createdCount: number }>> {
        // Fail fast on oversized payloads BEFORE runWithLoggingAndValidation,
        // which would otherwise serialize the entire input for logging and let
        // Zod deep-parse every row before reporting the `.max()` violation. With
        // thousands of rows that briefly materializes a large object graph,
        // enough to OOM a vitest fork under CI concurrency. A cheap length check
        // rejects the request without ever building that graph.
        if (input.rows.length > MAX_BULK_IMPORT_ROWS) {
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: `bulkImport accepts at most ${MAX_BULK_IMPORT_ROWS} rows`
                }
            };
        }

        return this.runWithLoggingAndValidation({
            methodName: 'bulkImport',
            input: { actor, ...input },
            schema: BulkImportSchema,
            ctx,
            execute: async (validated, validActor, execCtx) => {
                checkCanCreateTerm(validActor);

                const createdCount = await withServiceTransaction(async (txCtx) => {
                    let inserted = 0;

                    for (const row of validated.rows) {
                        const created = await this.create(validActor, row, txCtx);
                        if (created.error) {
                            throw new ServiceError(created.error.code, created.error.message);
                        }
                        inserted += 1;
                    }

                    return inserted;
                }, execCtx);

                invalidateModerationCache();
                return { createdCount };
            }
        });
    }

    public async seedFromEnv(
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ importedCount: number }>> {
        checkCanCreateTerm(actor);

        const rows = [
            ...this.parseCsv(process.env.HOSPEDA_MESSAGING_BLOCKED_WORDS).map((term) => ({
                term,
                kind: 'word' as const,
                category: ModerationCategoryEnum.OTHER,
                severity: 1,
                enabled: true
            })),
            ...this.parseCsv(process.env.HOSPEDA_MESSAGING_BLOCKED_DOMAINS).map((term) => ({
                term,
                kind: 'domain' as const,
                category: ModerationCategoryEnum.OTHER,
                severity: 1,
                enabled: true
            }))
        ];

        if (rows.length === 0) {
            return { data: { importedCount: 0 } };
        }

        const result = await this.bulkImport(actor, { rows }, ctx);
        return result.error
            ? { error: result.error }
            : { data: { importedCount: result.data.createdCount } };
    }

    private buildConditions(params: {
        search?: string;
        kind?: 'word' | 'domain';
        category?: ModerationCategoryEnum;
        enabled?: boolean;
        includeDeleted?: boolean;
    }) {
        const conditions = [];

        if (!params.includeDeleted) {
            conditions.push(isNull(contentModerationTerms.deletedAt));
        }

        if (params.kind) {
            conditions.push(eq(contentModerationTerms.kind, params.kind));
        }

        if (params.category) {
            conditions.push(eq(contentModerationTerms.category, params.category));
        }

        if (typeof params.enabled === 'boolean') {
            conditions.push(eq(contentModerationTerms.enabled, params.enabled));
        }

        if (params.search?.trim()) {
            conditions.push(safeIlike(contentModerationTerms.term, params.search.trim()));
        }

        return conditions;
    }

    private invalidateCache(term: string): void {
        invalidateModerationCache();
        invalidateModerationCacheByTermPattern(term);
    }

    private parseCsv(raw: string | undefined): string[] {
        if (!raw) return [];
        return raw
            .split(',')
            .map((value) => value.trim().toLowerCase())
            .filter((value) => value.length > 0);
    }
}
