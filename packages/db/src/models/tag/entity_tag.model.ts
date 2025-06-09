import type { EntityTagType } from '@repo/types';
import { and, asc, count, desc, eq, ilike } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import { rEntityTag } from '../../dbschemas/tag/r_entity_tag.dbschema.ts';
import {
    createOrderableColumnsAndMapping,
    getOrderableColumn,
    prepareLikeQuery
} from '../../utils';
import { dbLogger } from '../../utils/logger.ts';

/**
 * Orderable Columns Pattern for EntityTagModel
 * Columns: tagId, entityId
 */
const entityTagOrderable = createOrderableColumnsAndMapping(
    ['tagId', 'entityId'] as const,
    rEntityTag
);

export const ENTITY_TAG_ORDERABLE_COLUMNS = entityTagOrderable.mapping;
export type EntityTagOrderableColumn = keyof typeof ENTITY_TAG_ORDERABLE_COLUMNS;

export interface EntityTagPaginationParams {
    limit: number;
    offset: number;
    order?: 'asc' | 'desc';
    orderBy?: EntityTagOrderableColumn;
}

export interface EntityTagSearchParams extends EntityTagPaginationParams {
    query?: string;
}

export const EntityTagModel = {
    /**
     * Get a relation by tagId, entityId, entityType (composite PK)
     */
    async getById(
        tagId: string,
        entityId: string,
        entityType: string
    ): Promise<EntityTagType | undefined> {
        const db = getDb();
        try {
            const result = (await db
                .select()
                .from(rEntityTag)
                .where(
                    and(
                        eq(rEntityTag.tagId, tagId),
                        eq(rEntityTag.entityId, entityId),
                        eq(rEntityTag.entityType, entityType)
                    )
                )
                .limit(1)) as EntityTagType[];
            return result[0];
        } catch (err) {
            dbLogger.error({ table: 'rEntityTag', method: 'getById', err });
            throw new Error(`Failed to get entity tag by id: ${(err as Error).message}`);
        }
    },
    /**
     * Get relations by entityId and entityType
     */
    async getByEntity(entityId: string, entityType: string): Promise<EntityTagType[]> {
        const db = getDb();
        try {
            const result = (await db
                .select()
                .from(rEntityTag)
                .where(
                    and(eq(rEntityTag.entityId, entityId), eq(rEntityTag.entityType, entityType))
                )) as EntityTagType[];
            return result;
        } catch (err) {
            dbLogger.error({ table: 'rEntityTag', method: 'getByEntity', err });
            throw new Error(`Failed to get entity tags by entity: ${(err as Error).message}`);
        }
    },
    /**
     * Get relations by tagId
     */
    async getByTag(tagId: string): Promise<EntityTagType[]> {
        const db = getDb();
        try {
            const result = (await db
                .select()
                .from(rEntityTag)
                .where(eq(rEntityTag.tagId, tagId))) as EntityTagType[];
            return result;
        } catch (err) {
            dbLogger.error({ table: 'rEntityTag', method: 'getByTag', err });
            throw new Error(`Failed to get entity tags by tag: ${(err as Error).message}`);
        }
    },
    /**
     * Create a new relation
     */
    async create(input: EntityTagType): Promise<EntityTagType> {
        const db = getDb();
        try {
            const result = (await db
                .insert(rEntityTag)
                .values(input)
                .returning()) as EntityTagType[];
            if (!result?.[0]) throw new Error('Insert failed');
            return result[0];
        } catch (err) {
            dbLogger.error({ table: 'rEntityTag', method: 'create', err });
            throw new Error(`Failed to create entity tag: ${(err as Error).message}`);
        }
    },
    /**
     * Update a relation (by composite PK)
     */
    async update(
        tagId: string,
        entityId: string,
        entityType: string,
        input: Partial<EntityTagType>
    ): Promise<EntityTagType | undefined> {
        const db = getDb();
        try {
            const result = (await db
                .update(rEntityTag)
                .set(input)
                .where(
                    and(
                        eq(rEntityTag.tagId, tagId),
                        eq(rEntityTag.entityId, entityId),
                        eq(rEntityTag.entityType, entityType)
                    )
                )
                .returning()) as EntityTagType[];
            return result[0];
        } catch (err) {
            dbLogger.error({ table: 'rEntityTag', method: 'update', err });
            throw new Error(`Failed to update entity tag: ${(err as Error).message}`);
        }
    },
    /**
     * Soft delete a relation (by composite PK)
     */
    async delete(
        tagId: string,
        entityId: string,
        entityType: string
    ): Promise<{ tagId: string; entityId: string; entityType: string } | undefined> {
        const db = getDb();
        try {
            // No deletedAt/deletedById en la tabla, así que hacemos hard delete
            const result = (await db
                .delete(rEntityTag)
                .where(
                    and(
                        eq(rEntityTag.tagId, tagId),
                        eq(rEntityTag.entityId, entityId),
                        eq(rEntityTag.entityType, entityType)
                    )
                )
                .returning({
                    tagId: rEntityTag.tagId,
                    entityId: rEntityTag.entityId,
                    entityType: rEntityTag.entityType
                })) as { tagId: string; entityId: string; entityType: string }[];
            return result[0];
        } catch (err) {
            dbLogger.error({ table: 'rEntityTag', method: 'delete', err });
            throw new Error(`Failed to delete entity tag: ${(err as Error).message}`);
        }
    },
    /**
     * List relations paginated
     */
    async list(params: EntityTagPaginationParams): Promise<EntityTagType[]> {
        const db = getDb();
        const { limit, offset, order, orderBy } = params;
        try {
            const col = getOrderableColumn(
                entityTagOrderable.mapping,
                orderBy as string | undefined,
                rEntityTag.tagId
            );
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            const result = (await db
                .select()
                .from(rEntityTag)
                .orderBy(orderExpr)
                .limit(limit)
                .offset(offset)) as EntityTagType[];
            dbLogger.query({ table: 'rEntityTag', method: 'list', params });
            return result;
        } catch (err) {
            dbLogger.error({ table: 'rEntityTag', method: 'list', err });
            throw new Error(`Failed to list entity tags: ${(err as Error).message}`);
        }
    },
    /**
     * Search entity-tag relations by entityId, paginated.
     *
     * @param params - Search and pagination parameters
     * @returns Array of EntityTagType
     * @throws Error if the query fails
     */
    async search(params: EntityTagSearchParams): Promise<EntityTagType[]> {
        const db = getDb();
        const { limit, offset, order, orderBy, query } = params;
        try {
            const col = getOrderableColumn(
                entityTagOrderable.mapping,
                orderBy as string | undefined,
                rEntityTag.tagId
            );
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            const whereExpr = query
                ? ilike(rEntityTag.entityId, prepareLikeQuery(query))
                : undefined;
            const result = (await db
                .select()
                .from(rEntityTag)
                .where(whereExpr)
                .orderBy(orderExpr)
                .limit(limit)
                .offset(offset)) as EntityTagType[];
            dbLogger.query({ table: 'rEntityTag', method: 'search', params });
            return result;
        } catch (err) {
            dbLogger.error({ table: 'rEntityTag', method: 'search', err });
            throw new Error(`Failed to search entity tags: ${(err as Error).message}`);
        }
    },
    /**
     * Count entity-tag relations (optionally by search query).
     *
     * @param params - Search parameters
     * @returns Number of entity-tag relations matching the query
     * @throws Error if the query fails
     */
    async count(params: EntityTagSearchParams): Promise<number> {
        const db = getDb();
        const { query } = params;
        try {
            const whereExpr = query
                ? ilike(rEntityTag.entityId, prepareLikeQuery(query))
                : undefined;
            const result = await db.select({ count: count() }).from(rEntityTag).where(whereExpr);
            return Number(result[0]?.count ?? 0);
        } catch (err) {
            dbLogger.error({ table: 'rEntityTag', method: 'count', err });
            throw new Error(`Failed to count entity tags: ${(err as Error).message}`);
        }
    }
};
