/**
 * @file social-publish-log.service.ts
 *
 * Read-only query service for the social_publish_logs table.
 *
 * Provides paginated listing of dispatch attempt records with optional
 * filters by postId, targetId, status, and platform.
 *
 * @see SPEC-254 T-037
 */

import type { SocialPublishLogModel as SocialPublishLogModelType } from '@repo/db';
import { SocialPublishLogModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { ServiceConfig, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';
import type { Actor } from '../../types';
import { hasPermission } from '../../utils/permission';
import { serviceLogger } from '../../utils/service-logger';

// ---------------------------------------------------------------------------
// Input / output types
// ---------------------------------------------------------------------------

/**
 * Filters accepted by {@link SocialPublishLogService.list}.
 */
export interface ListPublishLogsFilters {
    /** Page number (1-based, default 1). */
    readonly page?: number;
    /** Page size (default 20, clamped to 100). */
    readonly pageSize?: number;
    /** Filter by parent social post UUID. */
    readonly postId?: string;
    /** Filter by social_post_targets UUID. */
    readonly targetId?: string;
    /** Filter by publish result status. */
    readonly status?: string;
    /** Filter by platform. */
    readonly platform?: string;
}

/**
 * Input for {@link SocialPublishLogService.list}.
 */
export interface ListPublishLogsInput {
    /** Actor performing the action — must hold SOCIAL_PUBLISH_LOG_VIEW. */
    readonly actor: Actor;
    /** Optional filter set. */
    readonly filters?: ListPublishLogsFilters;
}

/**
 * Paginated result from {@link SocialPublishLogService.list}.
 */
export interface SocialPublishLogListResult {
    readonly items: ReadonlyArray<Record<string, unknown>>;
    readonly total: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Read-only query service for social publish logs.
 *
 * ## Responsibilities
 * - Permission-gated list endpoint (SOCIAL_PUBLISH_LOG_VIEW).
 * - Supports filtering by postId, targetId, status, platform.
 * - Results ordered by createdAt DESC.
 *
 * SPEC-254 T-037.
 */
export class SocialPublishLogService {
    private readonly model: SocialPublishLogModelType;

    constructor(_config: ServiceConfig, model?: SocialPublishLogModelType) {
        this.model = model ?? new SocialPublishLogModel();
    }

    /**
     * Returns a paginated list of publish log entries ordered by createdAt DESC.
     *
     * Permission required: SOCIAL_PUBLISH_LOG_VIEW.
     *
     * @param input - Actor and optional filters.
     * @returns ServiceOutput containing items and total count.
     *
     * @example
     * ```ts
     * const result = await service.list({
     *   actor,
     *   filters: { status: 'FAILED', page: 1, pageSize: 20 }
     * });
     * ```
     */
    public async list(
        input: ListPublishLogsInput
    ): Promise<ServiceOutput<SocialPublishLogListResult>> {
        const { actor, filters = {} } = input;

        try {
            // Permission check
            if (!hasPermission(actor, PermissionEnum.SOCIAL_PUBLISH_LOG_VIEW)) {
                throw new ServiceError(
                    ServiceErrorCode.FORBIDDEN,
                    'Permission denied: SOCIAL_PUBLISH_LOG_VIEW required'
                );
            }

            const page = filters.page ?? 1;
            const pageSize = Math.min(filters.pageSize ?? 20, 100);

            // Build equality-based where clause
            const where: Record<string, unknown> = {};
            if (filters.postId) where.socialPostId = filters.postId;
            if (filters.targetId) where.socialPostTargetId = filters.targetId;
            if (filters.status) where.status = filters.status;
            if (filters.platform) where.platform = filters.platform;

            const { items, total } = await this.model.findAll(where, {
                page,
                pageSize,
                sortBy: 'createdAt',
                sortOrder: 'desc'
            });

            serviceLogger.info(
                { actorId: actor.id, total, page, pageSize },
                'SocialPublishLogService.list: completed'
            );

            return { data: { items: items as Record<string, unknown>[], total } };
        } catch (err) {
            if (err instanceof ServiceError) {
                return {
                    error: {
                        code: err.code,
                        message: err.message,
                        details: err.details,
                        reason: err.reason
                    }
                };
            }
            const message = err instanceof Error ? err.message : String(err);
            serviceLogger.error(
                { actorId: actor.id, error: message },
                'SocialPublishLogService.list: unexpected error'
            );
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: `Unexpected error during list: ${message}`
                }
            };
        }
    }
}
