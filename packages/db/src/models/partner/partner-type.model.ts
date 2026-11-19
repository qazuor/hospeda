import type { PartnerType, PartnerTypeRef, PublicPartnerType } from '@repo/schemas';
import { and, asc, count, eq, inArray, isNull, type SQL, sql } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { partners } from '../../schemas/partner/partner.dbschema.ts';
import { partnerTypes } from '../../schemas/partner/partner-type.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/**
 * Join predicate "this partner belongs to this type" during release N
 * (HOS-2336): by `type_id`, or, for a row the backfill has not reached yet, by
 * the legacy enum value equal to the slug. Compared on text so a slug with no
 * legacy value never raises an invalid-enum error.
 */
function partnerOfTypeCondition(): SQL {
    return sql`(${partners.typeId} = ${partnerTypes.id} OR (${partners.typeId} IS NULL AND ${partners.type}::text = ${partnerTypes.slug}))`;
}

/**
 * Model for the `partner_types` table (HOS-2336): the admin-managed partner
 * type catalog. Standard `BaseModelImpl` CRUD (the inherited `findByIds` does
 * NOT filter soft-deleted or inactive rows, so callers check those states
 * themselves) plus the reads and locks the services need.
 *
 * Locking protocol (same as the HOS-919 catalog): a partner write that assigns
 * a type reads it with {@link findByIdForShare}; a deactivation or soft delete
 * takes {@link lockForUpdate} before counting partners. The two lock modes
 * conflict, so an assignment and a delete serialize and the later one sees the
 * earlier one's committed result.
 */
export class PartnerTypeModel extends BaseModelImpl<PartnerType> {
    protected table = partnerTypes;
    /** Admin catalog: restore keeps an admin-set INACTIVE state (HOS-2366). */
    protected override readonly restoreKeepsLifecycleState = true;
    public entityName = 'partnerType';

    protected getTableName(): string {
        return 'partnerTypes';
    }

    /** Wraps a query with the model's logging and `DbError` conventions. */
    private async run<T>(
        method: string,
        logContext: Record<string, unknown>,
        fn: () => Promise<T>
    ): Promise<T> {
        try {
            const result = await fn();
            try {
                logQuery(this.entityName, method, logContext, result);
            } catch {}
            return result;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, method, logContext, err);
            } catch {}
            throw new DbError(this.entityName, method, logContext, err.message, err);
        }
    }

    /**
     * Returns the public catalog: ACTIVE, non-deleted types ordered by
     * `displayWeight`, then Spanish name, then slug.
     *
     * @param tx - Optional transaction client.
     * @returns The ordered public list.
     * @throws DbError if the database query fails.
     */
    async findPublicList(tx?: DrizzleClient): Promise<PublicPartnerType[]> {
        const db = this.getClient(tx);
        return this.run('findPublicList', {}, async () => {
            const rows = await db
                .select({
                    slug: partnerTypes.slug,
                    nameI18n: partnerTypes.nameI18n,
                    displayWeight: partnerTypes.displayWeight
                })
                .from(partnerTypes)
                .where(
                    and(eq(partnerTypes.lifecycleState, 'ACTIVE'), isNull(partnerTypes.deletedAt))
                )
                .orderBy(
                    asc(partnerTypes.displayWeight),
                    asc(sql`${partnerTypes.nameI18n} ->> 'es'`),
                    asc(partnerTypes.slug)
                );
            return rows as PublicPartnerType[];
        });
    }

    /**
     * Finds an ACTIVE, non-deleted type by slug. Used to validate an alliance
     * lead's `partnerType` at submission and approval (spec D3).
     *
     * @param slug - Type slug.
     * @param tx - Optional transaction client.
     * @returns The type, or `null` when unknown, inactive or deleted.
     * @throws DbError if the database query fails.
     */
    async findActiveBySlug(slug: string, tx?: DrizzleClient): Promise<PartnerType | null> {
        const db = this.getClient(tx);
        return this.run('findActiveBySlug', { slug }, async () => {
            const rows = await db
                .select()
                .from(partnerTypes)
                .where(
                    and(
                        eq(partnerTypes.slug, slug),
                        eq(partnerTypes.lifecycleState, 'ACTIVE'),
                        isNull(partnerTypes.deletedAt)
                    )
                )
                .limit(1);
            return (rows[0] as PartnerType | undefined) ?? null;
        });
    }

    /**
     * Same as {@link findActiveBySlug} but takes `FOR SHARE` on the row, so a
     * concurrent deactivation or delete cannot slip between this check and the
     * partner insert that depends on it. Must run on a transaction client.
     *
     * @param slug - Type slug.
     * @param tx - Transaction client holding the lock.
     * @returns The type, or `null` when unknown, inactive or deleted.
     * @throws DbError if the database query fails.
     */
    async findActiveBySlugForShare(slug: string, tx?: DrizzleClient): Promise<PartnerType | null> {
        const db = this.getClient(tx);
        return this.run('findActiveBySlugForShare', { slug }, async () => {
            const rows = await db
                .select()
                .from(partnerTypes)
                .where(
                    and(
                        eq(partnerTypes.slug, slug),
                        eq(partnerTypes.lifecycleState, 'ACTIVE'),
                        isNull(partnerTypes.deletedAt)
                    )
                )
                .for('share');
            return (rows[0] as PartnerType | undefined) ?? null;
        });
    }

    /**
     * Loads a type with `SELECT ... FOR SHARE`, holding a row lock until the
     * transaction ends (see the class doc). Must run on a transaction client.
     *
     * @param typeId - Type UUID.
     * @param tx - Transaction client holding the lock.
     * @returns The type (possibly soft-deleted or inactive, the caller checks), or `null`.
     * @throws DbError if the database query fails.
     */
    async findByIdForShare(typeId: string, tx?: DrizzleClient): Promise<PartnerType | null> {
        const db = this.getClient(tx);
        return this.run('findByIdForShare', { typeId }, async () => {
            const rows = await db
                .select()
                .from(partnerTypes)
                .where(eq(partnerTypes.id, typeId))
                .for('share');
            return (rows[0] as PartnerType | undefined) ?? null;
        });
    }

    /**
     * Locks the type row (`SELECT ... FOR UPDATE`) for the rest of the
     * transaction, so the partner count that follows and the write cannot be
     * overtaken by an assignment that validated the type FOR SHARE.
     *
     * @param typeId - Type UUID.
     * @param tx - Transaction client holding the lock.
     * @returns `true` when the row exists (and is now locked).
     * @throws DbError if the database query fails.
     */
    async lockForUpdate(typeId: string, tx?: DrizzleClient): Promise<boolean> {
        const db = this.getClient(tx);
        return this.run('lockForUpdate', { typeId }, async () => {
            const rows = await db
                .select({ id: partnerTypes.id })
                .from(partnerTypes)
                .where(eq(partnerTypes.id, typeId))
                .for('update');
            return rows.length > 0;
        });
    }

    /**
     * Counts the non-deleted partners that use a type, whatever their
     * lifecycle state (AC-3.4).
     *
     * Release N counts a row the backfill has not reached yet too
     * (`type_id IS NULL` with the legacy `type` equal to the slug): such a row
     * still belongs to the type, and the N+1 backfill will point it there, so
     * the type must not be deactivated or deleted under it.
     *
     * @param typeId - Type UUID.
     * @param tx - Optional transaction client.
     * @returns Number of non-deleted partners of this type.
     * @throws DbError if the database query fails.
     */
    async countPartners(typeId: string, tx?: DrizzleClient): Promise<number> {
        const db = this.getClient(tx);
        return this.run('countPartners', { typeId }, async () => {
            const [row] = await db
                .select({ total: count() })
                .from(partners)
                .innerJoin(partnerTypes, partnerOfTypeCondition())
                .where(and(eq(partnerTypes.id, typeId), isNull(partners.deletedAt)));
            return row?.total ?? 0;
        });
    }

    /**
     * Counts non-deleted partners per type in one grouped query, for the admin
     * list (AC-3.1), with the same legacy-row rule as {@link countPartners}.
     * Types with no partner are absent from the map.
     *
     * @param typeIds - Type UUIDs of the current page.
     * @param tx - Optional transaction client.
     * @returns Map of type id to partner count.
     * @throws DbError if the database query fails.
     */
    async countPartnersByTypeIds(
        typeIds: readonly string[],
        tx?: DrizzleClient
    ): Promise<Map<string, number>> {
        if (typeIds.length === 0) return new Map();
        const db = this.getClient(tx);
        return this.run('countPartnersByTypeIds', { count: typeIds.length }, async () => {
            const rows = await db
                .select({ typeId: partnerTypes.id, total: count() })
                .from(partners)
                .innerJoin(partnerTypes, partnerOfTypeCondition())
                .where(and(inArray(partnerTypes.id, [...typeIds]), isNull(partners.deletedAt)))
                .groupBy(partnerTypes.id);
            const map = new Map<string, number>();
            for (const row of rows) {
                if (row.typeId) map.set(row.typeId, row.total);
            }
            return map;
        });
    }

    /**
     * Loads the embedded refs for a set of type ids in one query, whatever the
     * row's state: a partner keeps showing its type after the type is
     * deactivated or deleted (AC-5.3).
     *
     * @param typeIds - Type UUIDs (duplicates allowed).
     * @param tx - Optional transaction client.
     * @returns Map of type id to ref.
     * @throws DbError if the database query fails.
     */
    async findRefsByIds(
        typeIds: readonly string[],
        tx?: DrizzleClient
    ): Promise<Map<string, PartnerTypeRef>> {
        const unique = [...new Set(typeIds)];
        if (unique.length === 0) return new Map();
        const db = this.getClient(tx);
        return this.run('findRefsByIds', { count: unique.length }, async () => {
            const rows = await db
                .select({
                    id: partnerTypes.id,
                    slug: partnerTypes.slug,
                    nameI18n: partnerTypes.nameI18n,
                    lifecycleState: partnerTypes.lifecycleState
                })
                .from(partnerTypes)
                .where(inArray(partnerTypes.id, unique));
            return new Map(rows.map((row) => [row.id, row as PartnerTypeRef]));
        });
    }
}

/** Singleton instance of PartnerTypeModel for use across the application. */
export const partnerTypeModel = new PartnerTypeModel();
