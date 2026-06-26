import {
    type FeatureFlag,
    type FeatureFlagAdminSearchSchema,
    type FeatureFlagCreateHttp,
    FeatureFlagCreateHttpSchema,
    type FeatureFlagPublicResponse,
    FeatureFlagSchema,
    type FeatureFlagUpdateHttp,
    FeatureFlagUpdateHttpSchema,
    type FlagContext,
    FlagContextSchema,
    ServiceErrorCode
} from '@repo/schemas';
import type { z } from 'zod';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { checkCanManageFlags } from './feature-flags.permissions';

import { FeatureFlagModel } from '@repo/db';

type FeatureFlagAdminSearch = z.infer<typeof FeatureFlagAdminSearchSchema>;

function mapFeatureFlag(flag: unknown): FeatureFlag {
    return FeatureFlagSchema.parse(flag);
}

interface CachedFlag {
    flag: FeatureFlag;
    timestamp: number;
}

const FLAG_CACHE_TTL_MS = 60 * 1000;
const featureFlagCache = new Map<string, CachedFlag>();

export function clearFeatureFlagCache(key?: string): void {
    if (key) {
        featureFlagCache.delete(key);
    } else {
        featureFlagCache.clear();
    }
}

function getFromCache(key: string): FeatureFlag | null {
    const cached = featureFlagCache.get(key);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > FLAG_CACHE_TTL_MS) {
        featureFlagCache.delete(key);
        return null;
    }
    return cached.flag;
}

function setInCache(flag: FeatureFlag): void {
    featureFlagCache.set(flag.key, {
        flag,
        timestamp: Date.now()
    });
}

function evaluateFlagWithCache(flag: FeatureFlag, context: FlagContext): boolean {
    if (!flag.isActive) return false;

    if (context.userId) {
        if (flag.forceOnUserIds.includes(context.userId)) return true;
        if (flag.forceOffUserIds.includes(context.userId)) return false;
    }

    if (context.role && flag.enabledForRoles.includes(context.role)) return true;

    return flag.enabled;
}

export class FeatureFlagService {
    private readonly model: FeatureFlagModel;

    constructor(model?: FeatureFlagModel) {
        this.model = model ?? new FeatureFlagModel();
    }

    async getAllFlags(): Promise<FeatureFlagPublicResponse> {
        const flags = await this.model.findActiveFlags();
        const result: FeatureFlagPublicResponse = {};
        for (const flag of flags) {
            result[flag.key] = true;
        }
        return result;
    }

    async evaluateFlag(key: string, context?: FlagContext): Promise<boolean> {
        const parsed = FlagContextSchema.parse(context ?? {});

        const cached = getFromCache(key);
        if (cached) {
            return evaluateFlagWithCache(cached, parsed);
        }

        const flagFromDb = await this.model.findByKey(key);
        if (!flagFromDb) return false;

        const flag = mapFeatureFlag(flagFromDb);
        setInCache(flag);

        return evaluateFlagWithCache(flag, parsed);
    }

    async adminList(
        actor: Actor,
        search: FeatureFlagAdminSearch
    ): Promise<{
        items: FeatureFlag[];
        pagination: {
            page: number;
            pageSize: number;
            total: number;
            totalPages: number;
            hasNextPage: boolean;
            hasPreviousPage: boolean;
        };
    }> {
        checkCanManageFlags(actor);

        const result = await this.model.findAll({
            search: search.search,
            isActive: search.isActive,
            enabled: search.enabled,
            page: search.page,
            pageSize: search.pageSize
        });

        return {
            items: result.items.map((flag) => mapFeatureFlag(flag)),
            pagination: result.pagination
        };
    }

    async getById(actor: Actor, id: string): Promise<FeatureFlag> {
        checkCanManageFlags(actor);

        const flag = await this.model.findById(id);
        if (!flag) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Feature flag not found');
        }

        return mapFeatureFlag(flag);
    }

    async createFlag(actor: Actor, input: FeatureFlagCreateHttp): Promise<FeatureFlag> {
        checkCanManageFlags(actor);

        const parsed = FeatureFlagCreateHttpSchema.parse(input);

        const existing = await this.model.findByKey(parsed.key);
        if (existing) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                `Feature flag with key '${parsed.key}' already exists`
            );
        }

        const flag = await this.model.create({
            ...parsed,
            createdById: actor.id
        });

        const mappedFlag = mapFeatureFlag(flag);
        setInCache(mappedFlag);

        await this.model.createAuditLog({
            flagId: flag.id,
            action: 'created',
            newValue: { key: flag.key, enabled: flag.enabled, isActive: flag.isActive },
            performedById: actor.id
        });

        return mappedFlag;
    }

    async updateFlag(actor: Actor, id: string, input: FeatureFlagUpdateHttp): Promise<FeatureFlag> {
        checkCanManageFlags(actor);

        const parsed = FeatureFlagUpdateHttpSchema.parse(input);

        const existing = await this.model.findById(id);
        if (!existing) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Feature flag not found');
        }

        const flag = await this.model.update(id, {
            ...parsed,
            updatedById: actor.id
        });

        if (!flag) {
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Failed to update feature flag'
            );
        }

        clearFeatureFlagCache(existing.key);
        const mappedFlag = mapFeatureFlag(flag);
        setInCache(mappedFlag);

        await this.model.createAuditLog({
            flagId: id,
            action: 'updated',
            previousValue: {
                key: existing.key,
                enabled: existing.enabled,
                isActive: existing.isActive
            },
            newValue: { key: flag.key, enabled: flag.enabled, isActive: flag.isActive },
            performedById: actor.id
        });

        return mappedFlag;
    }

    async toggleFlag(
        actor: Actor,
        id: string,
        isActive: boolean,
        reason?: string
    ): Promise<FeatureFlag> {
        checkCanManageFlags(actor);

        const existing = await this.model.findById(id);
        if (!existing) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Feature flag not found');
        }

        const flag = await this.model.toggleActive(id, {
            isActive,
            reason,
            performedById: actor.id
        });

        if (!flag) {
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Failed to toggle feature flag'
            );
        }

        clearFeatureFlagCache(existing.key);
        const mappedFlag = mapFeatureFlag(flag);
        setInCache(mappedFlag);

        await this.model.createAuditLog({
            flagId: id,
            action: isActive ? 'activated' : 'deactivated',
            previousValue: { isActive: existing.isActive },
            newValue: { isActive: flag.isActive },
            reason,
            performedById: actor.id
        });

        return mappedFlag;
    }

    async deleteFlag(actor: Actor, id: string): Promise<void> {
        checkCanManageFlags(actor);

        const existing = await this.model.findById(id);
        if (!existing) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Feature flag not found');
        }

        clearFeatureFlagCache(existing.key);

        await this.model.createAuditLog({
            flagId: id,
            action: 'deleted',
            previousValue: {
                key: existing.key,
                enabled: existing.enabled,
                isActive: existing.isActive
            },
            performedById: actor.id
        });

        await this.model.softDelete(id);
    }

    async getAuditLog(actor: Actor, flagId: string): Promise<Array<Record<string, unknown>>> {
        checkCanManageFlags(actor);

        return this.model.findAuditLogByFlagId(flagId);
    }
}
