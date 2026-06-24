import { and, count, desc, eq, getTableColumns, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { getDb } from '../../client';
import { featureFlagAuditLog, featureFlags } from '../../schemas/feature-flags';
import type { DrizzleClient } from '../../types';
import { safeIlike } from '../../utils/drizzle-helpers.ts';

export interface ListFeatureFlagsInput {
    search?: string;
    isActive?: boolean;
    enabled?: boolean;
    page?: number;
    pageSize?: number;
}

export interface ListFeatureFlagsResult {
    items: SelectFeatureFlag[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
    };
}

export interface CreateFeatureFlagInput {
    key: string;
    description: string;
    enabled?: boolean;
    isActive?: boolean;
    forceOnUserIds?: string[];
    forceOffUserIds?: string[];
    enabledForRoles?: string[];
    createdById?: string;
}

export interface UpdateFeatureFlagInput {
    key?: string;
    description?: string;
    enabled?: boolean;
    isActive?: boolean;
    forceOnUserIds?: string[];
    forceOffUserIds?: string[];
    enabledForRoles?: string[];
    updatedById?: string;
}

export interface ToggleFlagInput {
    isActive: boolean;
    reason?: string;
    performedById: string;
}

export interface CreateAuditLogInput {
    flagId: string;
    action: string;
    previousValue?: Record<string, unknown>;
    newValue?: Record<string, unknown>;
    reason?: string;
    performedById: string;
}

import type { SelectFeatureFlag, SelectFeatureFlagAuditLog } from '../../schemas/feature-flags';

export class FeatureFlagModel {
    private getClient(tx?: DrizzleClient): DrizzleClient {
        return tx ?? getDb();
    }

    async findAll(
        input: ListFeatureFlagsInput = {},
        tx?: DrizzleClient
    ): Promise<ListFeatureFlagsResult> {
        const db = this.getClient(tx);
        const { search, isActive, enabled: enabledFilter, page = 1, pageSize = 50 } = input;

        const conditions: SQL<unknown>[] = [];

        if (search) {
            const searchCondition = or(
                safeIlike(featureFlags.key, search),
                safeIlike(featureFlags.description, search)
            );

            if (searchCondition) {
                conditions.push(searchCondition);
            }
        }

        if (isActive !== undefined) {
            conditions.push(eq(featureFlags.isActive, isActive));
        }

        if (enabledFilter !== undefined) {
            conditions.push(eq(featureFlags.enabled, enabledFilter));
        }

        const where = conditions.length > 0 ? and(...conditions) : undefined;

        const items = await db
            .select(getTableColumns(featureFlags))
            .from(featureFlags)
            .where(where)
            .orderBy(desc(featureFlags.createdAt))
            .limit(pageSize)
            .offset((page - 1) * pageSize);

        const [countRow] = await db.select({ total: count() }).from(featureFlags).where(where);
        const total = countRow?.total ?? 0;

        const totalPages = Math.max(1, Math.ceil(total / pageSize));

        return {
            items,
            pagination: {
                page,
                pageSize,
                total,
                totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1
            }
        };
    }

    async findById(id: string, tx?: DrizzleClient): Promise<SelectFeatureFlag | null> {
        const db = this.getClient(tx);
        const [result] = await db
            .select(getTableColumns(featureFlags))
            .from(featureFlags)
            .where(eq(featureFlags.id, id))
            .limit(1);
        return result ?? null;
    }

    async findByKey(key: string, tx?: DrizzleClient): Promise<SelectFeatureFlag | null> {
        const db = this.getClient(tx);
        const [result] = await db
            .select(getTableColumns(featureFlags))
            .from(featureFlags)
            .where(eq(featureFlags.key, key))
            .limit(1);
        return result ?? null;
    }

    async create(input: CreateFeatureFlagInput, tx?: DrizzleClient): Promise<SelectFeatureFlag> {
        const db = this.getClient(tx);
        const [result] = await db
            .insert(featureFlags)
            .values({
                key: input.key,
                description: input.description,
                enabled: input.enabled ?? false,
                isActive: input.isActive ?? true,
                forceOnUserIds: input.forceOnUserIds ?? [],
                forceOffUserIds: input.forceOffUserIds ?? [],
                enabledForRoles: input.enabledForRoles ?? [],
                createdById: input.createdById
            })
            .returning(getTableColumns(featureFlags));
        if (!result) throw new Error('Failed to create feature flag');
        return result;
    }

    async update(
        id: string,
        input: UpdateFeatureFlagInput,
        tx?: DrizzleClient
    ): Promise<SelectFeatureFlag | null> {
        const db = this.getClient(tx);
        const [result] = await db
            .update(featureFlags)
            .set({
                ...input,
                updatedAt: sql`now()`
            })
            .where(eq(featureFlags.id, id))
            .returning(getTableColumns(featureFlags));
        return result ?? null;
    }

    async toggleActive(
        id: string,
        input: ToggleFlagInput,
        tx?: DrizzleClient
    ): Promise<SelectFeatureFlag | null> {
        const db = this.getClient(tx);
        const [result] = await db
            .update(featureFlags)
            .set({
                isActive: input.isActive,
                updatedAt: sql`now()`,
                updatedById: input.performedById
            })
            .where(eq(featureFlags.id, id))
            .returning(getTableColumns(featureFlags));
        return result ?? null;
    }

    async delete(id: string, tx?: DrizzleClient): Promise<void> {
        const db = this.getClient(tx);
        await db.delete(featureFlags).where(eq(featureFlags.id, id));
    }

    async findActiveFlags(tx?: DrizzleClient): Promise<SelectFeatureFlag[]> {
        const db = this.getClient(tx);
        return db
            .select(getTableColumns(featureFlags))
            .from(featureFlags)
            .where(and(eq(featureFlags.isActive, true), eq(featureFlags.enabled, true)))
            .orderBy(desc(featureFlags.createdAt));
    }

    async createAuditLog(
        input: CreateAuditLogInput,
        tx?: DrizzleClient
    ): Promise<SelectFeatureFlagAuditLog> {
        const db = this.getClient(tx);
        const [result] = await db
            .insert(featureFlagAuditLog)
            .values({
                flagId: input.flagId,
                action: input.action,
                previousValue: input.previousValue ?? null,
                newValue: input.newValue ?? null,
                reason: input.reason ?? null,
                performedById: input.performedById
            })
            .returning(getTableColumns(featureFlagAuditLog));
        if (!result) throw new Error('Failed to create audit log entry');
        return result;
    }

    async findAuditLogByFlagId(
        flagId: string,
        tx?: DrizzleClient
    ): Promise<SelectFeatureFlagAuditLog[]> {
        const db = this.getClient(tx);
        return db
            .select(getTableColumns(featureFlagAuditLog))
            .from(featureFlagAuditLog)
            .where(eq(featureFlagAuditLog.flagId, flagId))
            .orderBy(desc(featureFlagAuditLog.createdAt));
    }
}

export const featureFlagModel = new FeatureFlagModel();
