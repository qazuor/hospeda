import { ContentModerationThresholdModel } from '@repo/db';
import {
    type ContentModerationThreshold,
    type ContentModerationThresholdAdminSearch,
    PermissionEnum,
    ServiceErrorCode,
    contentModerationThresholdAdminSearchSchema,
    updateContentModerationThresholdSchema
} from '@repo/schemas';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, ServiceConfig, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';
import { invalidateModerationThresholdCache } from './get-threshold-for-context';

const DisabledCreateSchema = z.object({}).strict();

function assertPermission(
    actor: Actor,
    permission: Actor['permissions'][number],
    message: string
): void {
    if (!actor || !actor.id || !actor.permissions.includes(permission)) {
        throw new ServiceError(ServiceErrorCode.FORBIDDEN, message);
    }
}

export class ContentModerationThresholdService extends BaseCrudService<
    ContentModerationThreshold,
    ContentModerationThresholdModel,
    typeof DisabledCreateSchema,
    typeof updateContentModerationThresholdSchema,
    typeof contentModerationThresholdAdminSearchSchema
> {
    protected readonly entityName = 'contentModerationThreshold';
    protected readonly model: ContentModerationThresholdModel;
    protected readonly createSchema = DisabledCreateSchema;
    protected readonly updateSchema = updateContentModerationThresholdSchema;
    protected readonly searchSchema = contentModerationThresholdAdminSearchSchema;

    constructor(config: ServiceConfig, model?: ContentModerationThresholdModel) {
        super(config, 'contentModerationThreshold');
        this.model = model ?? new ContentModerationThresholdModel();
    }

    protected getDefaultListRelations() {
        return undefined;
    }

    protected _canCreate(): void {
        throw new ServiceError(ServiceErrorCode.NOT_IMPLEMENTED, 'Threshold creation is disabled');
    }

    protected _canUpdate(actor: Actor): void {
        assertPermission(
            actor,
            PermissionEnum.MODERATION_THRESHOLD_UPDATE,
            'Permission denied: Insufficient permissions to update moderation thresholds'
        );
    }

    protected _canDelete(): void {
        throw new ServiceError(ServiceErrorCode.NOT_IMPLEMENTED, 'Threshold delete is disabled');
    }

    protected _canView(actor: Actor): void {
        assertPermission(
            actor,
            PermissionEnum.MODERATION_THRESHOLD_VIEW,
            'Permission denied: Insufficient permissions to view moderation thresholds'
        );
    }

    protected _canList(actor: Actor): void {
        this._canView(actor);
    }

    protected _canSearch(actor: Actor): void {
        this._canView(actor);
    }

    protected _canCount(actor: Actor): void {
        this._canView(actor);
    }

    protected _canSoftDelete(): void {
        throw new ServiceError(ServiceErrorCode.NOT_IMPLEMENTED, 'Threshold delete is disabled');
    }

    protected _canHardDelete(actor: Actor): void {
        assertPermission(
            actor,
            PermissionEnum.MODERATION_THRESHOLD_HARD_DELETE,
            'Permission denied: Insufficient permissions to hard delete moderation thresholds'
        );
    }

    protected _canRestore(actor: Actor): void {
        assertPermission(
            actor,
            PermissionEnum.MODERATION_THRESHOLD_RESTORE,
            'Permission denied: Insufficient permissions to restore moderation thresholds'
        );
    }

    protected _canUpdateVisibility(actor: Actor): void {
        this._canUpdate(actor);
    }

    protected async _afterUpdate(
        entity: ContentModerationThreshold
    ): Promise<ContentModerationThreshold> {
        invalidateModerationThresholdCache();
        return entity;
    }

    protected async _afterHardDelete(result: { count: number }): Promise<{ count: number }> {
        invalidateModerationThresholdCache();
        return result;
    }

    protected async _afterRestore(result: { count: number }): Promise<{ count: number }> {
        invalidateModerationThresholdCache();
        return result;
    }

    /**
     * Updates a threshold, enforcing the `pending < reject` invariant even for
     * partial updates where only one of the two fields is supplied.
     *
     * When only `pending` or only `reject` is provided the Zod schema cannot
     * validate the cross-field constraint (it only activates when both are
     * present). This override reads the current row directly from the model,
     * merges the incoming partial payload, and rejects the operation with
     * VALIDATION_ERROR before the DB write if the merged values violate
     * `pending < reject`.
     */
    public override async update(
        actor: Actor,
        id: string,
        data: z.infer<typeof updateContentModerationThresholdSchema>,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<ContentModerationThreshold>> {
        // Only apply the invariant check when a partial update omits one field.
        if (data.pending !== undefined || data.reject !== undefined) {
            const current = await this.model.findById(id, ctx?.tx);
            if (!current) {
                return {
                    error: {
                        code: ServiceErrorCode.NOT_FOUND,
                        message: 'contentModerationThreshold not found'
                    }
                };
            }

            const mergedPending = data.pending ?? current.pending;
            const mergedReject = data.reject ?? current.reject;

            if (mergedPending >= mergedReject) {
                return {
                    error: {
                        code: ServiceErrorCode.VALIDATION_ERROR,
                        message: `Invalid threshold: pending (${mergedPending}) must be less than reject (${mergedReject})`
                    }
                };
            }
        }

        return super.update(actor, id, data, ctx) as Promise<
            ServiceOutput<ContentModerationThreshold>
        >;
    }

    protected async _executeSearch(params: ContentModerationThresholdAdminSearch) {
        const { page = 1, pageSize = 10 } = params;
        const result = await this.model.findAll({}, { page, pageSize }, undefined, undefined);
        return result;
    }

    protected async _executeCount(): Promise<{ count: number }> {
        const count = await this.model.count({});
        return { count };
    }
}
