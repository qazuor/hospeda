import {
    type FeatureFlag,
    type FeatureFlagAdminSearchSchema,
    type FeatureFlagCreateHttp,
    FeatureFlagCreateHttpSchema,
    type FeatureFlagPublicResponse,
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

        const flag = await this.model.findByKey(key);
        if (!flag) return false;

        if (!flag.isActive) return false;

        if (parsed.userId) {
            if (flag.forceOnUserIds.includes(parsed.userId)) return true;
            if (flag.forceOffUserIds.includes(parsed.userId)) return false;
        }

        if (parsed.role && flag.enabledForRoles.includes(parsed.role)) return true;

        return flag.enabled;
    }

    async adminList(
        actor: Actor,
        search: FeatureFlagAdminSearch
    ): Promise<{ items: FeatureFlag[]; total: number }> {
        checkCanManageFlags(actor);

        return this.model.findAll({
            search: search.search,
            isActive: search.isActive,
            enabled: search.enabled,
            page: search.page,
            pageSize: search.pageSize
        });
    }

    async getById(actor: Actor, id: string): Promise<FeatureFlag> {
        checkCanManageFlags(actor);

        const flag = await this.model.findById(id);
        if (!flag) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Feature flag not found');
        }

        return flag;
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

        await this.model.createAuditLog({
            flagId: flag.id,
            action: 'created',
            newValue: { key: flag.key, enabled: flag.enabled, isActive: flag.isActive },
            performedById: actor.id
        });

        return flag;
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

        return flag;
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

        await this.model.createAuditLog({
            flagId: id,
            action: isActive ? 'activated' : 'deactivated',
            previousValue: { isActive: existing.isActive },
            newValue: { isActive: flag.isActive },
            reason,
            performedById: actor.id
        });

        return flag;
    }

    async deleteFlag(actor: Actor, id: string): Promise<void> {
        checkCanManageFlags(actor);

        const existing = await this.model.findById(id);
        if (!existing) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Feature flag not found');
        }

        await this.model.delete(id);
    }

    async getAuditLog(actor: Actor, flagId: string): Promise<Array<Record<string, unknown>>> {
        checkCanManageFlags(actor);

        return this.model.findAuditLogByFlagId(flagId);
    }
}
