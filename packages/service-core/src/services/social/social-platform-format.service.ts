import {
    SocialPlatformFormatModel as RealSocialPlatformFormatModel,
    SocialPostTargetModel as RealSocialPostTargetModel,
    type SelectSocialPlatformFormat,
    type SelectSocialPostTarget,
    type SocialPlatformFormatModel,
    type SocialPostTargetModel
} from '@repo/db';
import type { SocialPlatformFormatAdminSearch, SocialPlatformFormatCreate } from '@repo/schemas';
import {
    ServiceErrorCode,
    SocialPlatformFormatAdminSearchSchema,
    SocialPlatformFormatCreateSchema,
    SocialPlatformFormatUpdateSchema,
    parseAdminSort
} from '@repo/schemas';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, PaginatedListOutput, ServiceConfig, ServiceContext } from '../../types';
import { ServiceError } from '../../types';
import { checkCanManagePlatform, checkCanViewPlatformFormat } from './social.permissions';

/**
 * Result shape for a platform-format update that may carry a non-fatal warning.
 */
export interface PlatformFormatUpdateResult {
    /** The updated platform format entity. */
    entity: SelectSocialPlatformFormat;
    /**
     * Number of ACTIVE `social_post_targets` that reference this format.
     * Non-zero only when the update disables the format (`enabled = false`).
     * The route should surface this to the caller as a warning.
     */
    activeTargetWarningCount: number;
}

/**
 * CRUD service for `social_platform_formats` (per-platform × format config).
 *
 * Platform-format rows are SEED-ONLY for creation and deletion — they cannot
 * be created or deleted via the API. The service gates create and hard/soft
 * delete with a `FORBIDDEN` error so no route can accidentally expose them.
 *
 * ## Update warning — disabled format with active targets
 * When an update sets `enabled = false` on a format that has ACTIVE post
 * targets (status not in PUBLISHED / FAILED / ARCHIVED), the update still
 * succeeds. The service returns the count of affected targets via
 * `countActiveTargetsForFormat()`. The caller (route) is responsible for
 * forwarding this as a response warning.
 *
 * Permission model:
 * - read / list / search / count → `SOCIAL_PLATFORM_FORMAT_VIEW`
 * - update / restore / visibility → `SOCIAL_PLATFORM_MANAGE`
 * - create / delete → FORBIDDEN (seed-only, no API access)
 */
export class SocialPlatformFormatService extends BaseCrudService<
    SelectSocialPlatformFormat,
    SocialPlatformFormatModel,
    typeof SocialPlatformFormatCreateSchema,
    typeof SocialPlatformFormatUpdateSchema,
    typeof SocialPlatformFormatAdminSearchSchema
> {
    static readonly ENTITY_NAME = 'socialPlatformFormat';
    protected readonly entityName = SocialPlatformFormatService.ENTITY_NAME;
    public readonly model: SocialPlatformFormatModel;

    public readonly createSchema = SocialPlatformFormatCreateSchema;
    public readonly updateSchema = SocialPlatformFormatUpdateSchema;
    public readonly searchSchema = SocialPlatformFormatAdminSearchSchema;

    /** Model for `social_post_targets` — used for active-target warning count. */
    private readonly postTargetModel: SocialPostTargetModel;

    protected getDefaultListRelations() {
        return undefined;
    }

    constructor(
        ctx: ServiceConfig,
        model?: SocialPlatformFormatModel,
        postTargetModel?: SocialPostTargetModel
    ) {
        super(ctx, SocialPlatformFormatService.ENTITY_NAME);
        this.model = model ?? new RealSocialPlatformFormatModel();
        this.postTargetModel = postTargetModel ?? new RealSocialPostTargetModel();
        this.adminSearchSchema = SocialPlatformFormatAdminSearchSchema;
    }

    // -------------------------------------------------------------------------
    // Permission hooks
    // -------------------------------------------------------------------------

    /**
     * Create is NOT available via the API (seed-only).
     * Always throws FORBIDDEN regardless of actor permissions.
     */
    protected _canCreate(_actor: Actor, _data: SocialPlatformFormatCreate): void {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Platform formats are seed-only and cannot be created via the API'
        );
    }

    protected _canUpdate(actor: Actor, _entity: SelectSocialPlatformFormat): void {
        checkCanManagePlatform(actor);
    }

    /**
     * Soft-delete is NOT available via the API (seed-only).
     * Always throws FORBIDDEN regardless of actor permissions.
     */
    protected _canSoftDelete(_actor: Actor, _entity: SelectSocialPlatformFormat): void {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Platform formats are seed-only and cannot be deleted via the API'
        );
    }

    /**
     * Hard-delete is NOT available via the API (seed-only).
     * Always throws FORBIDDEN regardless of actor permissions.
     */
    protected _canHardDelete(_actor: Actor, _entity: SelectSocialPlatformFormat): void {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Platform formats are seed-only and cannot be deleted via the API'
        );
    }

    protected _canRestore(actor: Actor, _entity: SelectSocialPlatformFormat): void {
        checkCanManagePlatform(actor);
    }

    protected _canView(actor: Actor, _entity: SelectSocialPlatformFormat): void {
        checkCanViewPlatformFormat(actor);
    }

    protected _canList(actor: Actor): void {
        checkCanViewPlatformFormat(actor);
    }

    protected _canSearch(actor: Actor): void {
        checkCanViewPlatformFormat(actor);
    }

    protected _canCount(actor: Actor): void {
        checkCanViewPlatformFormat(actor);
    }

    protected _canUpdateVisibility(
        actor: Actor,
        _entity: SelectSocialPlatformFormat,
        _newVisibility: unknown
    ): void {
        checkCanManagePlatform(actor);
    }

    // -------------------------------------------------------------------------
    // Active-target warning
    // -------------------------------------------------------------------------

    /**
     * Returns the count of ACTIVE `social_post_targets` that reference the
     * given platform format.
     *
     * "Active" means the target status is NOT one of: PUBLISHED, FAILED, ARCHIVED.
     * Used by the route layer to build a warning response when the format is disabled.
     *
     * @param formatId - UUID of the `social_platform_formats` row.
     * @returns Count of active post targets referencing this format.
     */
    public async countActiveTargetsForFormat(formatId: string): Promise<number> {
        const terminalStatuses = ['PUBLISHED', 'FAILED', 'ARCHIVED'];
        // Use findAll with a filter for platformFormatId; exclude terminal statuses
        // by fetching all non-deleted targets for the format and filtering client-side
        // (model.count does not support NOT-IN natively in a clean way, so we use
        // the count method with additionalConditions via the raw drizzle API).
        const result = await this.postTargetModel.findAll(
            { platformFormatId: formatId },
            { page: 1, pageSize: 1 },
            []
        );

        // The model's findAll returns all targets for the format; we need the count
        // of those with non-terminal status. Since findAll doesn't support NOT IN
        // directly through the where object, we fetch all and count client-side.
        // For production scale this would use a direct count query, but here the
        // realistic count of targets per format is small enough for a list approach.
        // We re-fetch with a higher pageSize to get an accurate count.
        if (result.total === 0) return 0;

        const all = await this.postTargetModel.findAll(
            { platformFormatId: formatId },
            { page: 1, pageSize: result.total },
            []
        );

        const activeItems = (all.items as SelectSocialPostTarget[]).filter(
            (t) => !terminalStatuses.includes(t.status)
        );
        return activeItems.length;
    }

    // -------------------------------------------------------------------------
    // Search / count
    // -------------------------------------------------------------------------

    protected async _executeSearch(
        params: SocialPlatformFormatAdminSearch,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<PaginatedListOutput<SelectSocialPlatformFormat>> {
        const {
            page = 1,
            pageSize = 20,
            sort,
            platform,
            publishFormat,
            mediaType,
            enabled,
            mvpEnabled
        } = params;
        const where: Record<string, unknown> = {};

        if (platform !== undefined) where.platform = platform;
        if (publishFormat !== undefined) where.publishFormat = publishFormat;
        if (mediaType !== undefined) where.mediaType = mediaType;
        if (enabled !== undefined) where.enabled = enabled;
        if (mvpEnabled !== undefined) where.mvpEnabled = mvpEnabled;

        const parsedSort = sort ? parseAdminSort(sort) : undefined;
        return this.model.findAll(
            where,
            { page, pageSize, sortBy: parsedSort?.field, sortOrder: parsedSort?.direction },
            []
        );
    }

    protected async _executeCount(
        params: SocialPlatformFormatAdminSearch,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<{ count: number }> {
        const { platform, publishFormat, mediaType, enabled, mvpEnabled } = params;
        const where: Record<string, unknown> = {};

        if (platform !== undefined) where.platform = platform;
        if (publishFormat !== undefined) where.publishFormat = publishFormat;
        if (mediaType !== undefined) where.mediaType = mediaType;
        if (enabled !== undefined) where.enabled = enabled;
        if (mvpEnabled !== undefined) where.mvpEnabled = mvpEnabled;

        const count = await this.model.count(where, { additionalConditions: [] });
        return { count };
    }
}
