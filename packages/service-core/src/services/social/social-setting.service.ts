import {
    SocialAuditLogModel as RealSocialAuditLogModel,
    SocialSettingModel as RealSocialSettingModel,
    type SelectSocialSetting,
    type SocialAuditLogModel,
    type SocialSettingModel
} from '@repo/db';
import type { SocialSettingAdminSearch, SocialSettingCreate } from '@repo/schemas';
import {
    ServiceErrorCode,
    SocialSettingAdminSearchSchema,
    SocialSettingCreateSchema,
    SocialSettingUpdateSchema,
    parseAdminSort
} from '@repo/schemas';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, PaginatedListOutput, ServiceConfig, ServiceContext } from '../../types';
import { ServiceError } from '../../types';
import { checkCanManageSettings } from './social.permissions';

/** Sentinel value substituted for secret setting values in list/get responses. */
const SECRET_MASK = '***';

/**
 * Masks the `value` field of a setting row when its type is `'secret'`.
 * The raw value is never exposed through list or get operations.
 *
 * @param setting - The raw setting row from the database.
 * @returns The same row with `value` replaced by `'***'` when `type === 'secret'`.
 */
function maskSecretValue(setting: SelectSocialSetting): SelectSocialSetting {
    if (setting.type === 'secret') {
        return { ...setting, value: SECRET_MASK };
    }
    return setting;
}

/**
 * Result shape for `updateByKey`.
 */
export interface SocialSettingUpdateByKeyResult {
    /** The updated setting row (with `value` masked if `type === 'secret'`). */
    entity: SelectSocialSetting;
}

/**
 * CRUD service for `social_settings` (key-value social pipeline configuration).
 *
 * ## Secret masking
 * Any setting with `type === 'secret'` has its `value` field replaced by `'***'`
 * in all list and get responses. Raw values are never returned via the API.
 *
 * ## `updateByKey`
 * In addition to the standard `update(actor, id, data)` from `BaseCrudService`,
 * this service exposes `updateByKey(actor, key, value)` for updating a setting by
 * its unique key rather than its UUID. On success, an audit row is written to
 * `social_audit_log` (event type `SETTING_UPDATED`). Secret values are redacted
 * in the audit row (`'***'`) to avoid persisting credentials.
 *
 * ## Permission model
 * All operations (read, list, search, count, update) are gated on
 * `SOCIAL_SETTINGS_MANAGE`. There is no separate view-only permission.
 *
 * ## Create / delete
 * Settings are managed rows (not seed-only) but creation and deletion from the API
 * is intentionally gated — new settings should be added via migrations or seeding
 * to keep the config surface controlled. Create and delete throw FORBIDDEN.
 */
export class SocialSettingService extends BaseCrudService<
    SelectSocialSetting,
    SocialSettingModel,
    typeof SocialSettingCreateSchema,
    typeof SocialSettingUpdateSchema,
    typeof SocialSettingAdminSearchSchema
> {
    static readonly ENTITY_NAME = 'socialSetting';
    protected readonly entityName = SocialSettingService.ENTITY_NAME;
    public readonly model: SocialSettingModel;

    public readonly createSchema = SocialSettingCreateSchema;
    public readonly updateSchema = SocialSettingUpdateSchema;
    public readonly searchSchema = SocialSettingAdminSearchSchema;

    /** Model for `social_audit_log` — used for direct audit inserts in `updateByKey`. */
    private readonly auditLogModel: SocialAuditLogModel;

    protected getDefaultListRelations() {
        return undefined;
    }

    constructor(
        ctx: ServiceConfig,
        model?: SocialSettingModel,
        auditLogModel?: SocialAuditLogModel
    ) {
        super(ctx, SocialSettingService.ENTITY_NAME);
        this.model = model ?? new RealSocialSettingModel();
        this.auditLogModel = auditLogModel ?? new RealSocialAuditLogModel();
        this.adminSearchSchema = SocialSettingAdminSearchSchema;
    }

    // -------------------------------------------------------------------------
    // Secret masking — applied in lifecycle hooks after read
    // -------------------------------------------------------------------------

    /**
     * Masks secret values after a single entity is fetched via getByField / getById.
     */
    protected override async _afterGetByField(
        entity: SelectSocialSetting | null,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<SelectSocialSetting | null> {
        if (!entity) return null;
        return maskSecretValue(entity);
    }

    /**
     * Masks secret values in paginated list results.
     */
    protected override async _afterList(
        result: PaginatedListOutput<SelectSocialSetting>,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<PaginatedListOutput<SelectSocialSetting>> {
        return {
            ...result,
            items: (result.items as SelectSocialSetting[]).map(maskSecretValue)
        };
    }

    /**
     * Masks secret values in search results.
     */
    protected override async _afterSearch(
        result: PaginatedListOutput<SelectSocialSetting>,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<PaginatedListOutput<SelectSocialSetting>> {
        return {
            ...result,
            items: (result.items as SelectSocialSetting[]).map(maskSecretValue)
        };
    }

    // -------------------------------------------------------------------------
    // Permission hooks — all gated on SOCIAL_SETTINGS_MANAGE
    // -------------------------------------------------------------------------

    /**
     * Create is NOT available via the API (settings are managed via migrations/seed).
     * Always throws FORBIDDEN regardless of actor permissions.
     */
    protected _canCreate(_actor: Actor, _data: SocialSettingCreate): void {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Social settings cannot be created via the API — add them via migrations or seed'
        );
    }

    protected _canUpdate(actor: Actor, _entity: SelectSocialSetting): void {
        checkCanManageSettings(actor);
    }

    /**
     * Soft-delete is NOT available on settings (no `deletedAt` column by schema design).
     * Always throws FORBIDDEN.
     */
    protected _canSoftDelete(_actor: Actor, _entity: SelectSocialSetting): void {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Social settings cannot be deleted via the API'
        );
    }

    /**
     * Hard-delete is NOT available via the API.
     * Always throws FORBIDDEN.
     */
    protected _canHardDelete(_actor: Actor, _entity: SelectSocialSetting): void {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Social settings cannot be deleted via the API'
        );
    }

    protected _canRestore(actor: Actor, _entity: SelectSocialSetting): void {
        checkCanManageSettings(actor);
    }

    protected _canView(actor: Actor, _entity: SelectSocialSetting): void {
        checkCanManageSettings(actor);
    }

    protected _canList(actor: Actor): void {
        checkCanManageSettings(actor);
    }

    protected _canSearch(actor: Actor): void {
        checkCanManageSettings(actor);
    }

    protected _canCount(actor: Actor): void {
        checkCanManageSettings(actor);
    }

    protected _canUpdateVisibility(
        actor: Actor,
        _entity: SelectSocialSetting,
        _newVisibility: unknown
    ): void {
        checkCanManageSettings(actor);
    }

    // -------------------------------------------------------------------------
    // updateByKey — find-by-key + update + audit insert
    // -------------------------------------------------------------------------

    /**
     * Updates a setting row identified by its unique `key` column.
     *
     * On success:
     * - Writes an audit row to `social_audit_log` with event type `SETTING_UPDATED`.
     *   The `value` is redacted to `'***'` in the audit payload when `type === 'secret'`.
     * - Returns the updated entity with the `value` masked for secret settings.
     *
     * @param actor  - The acting user (must hold `SOCIAL_SETTINGS_MANAGE`).
     * @param key    - The unique setting key (e.g. `"make_webhook_url"`).
     * @param value  - The new value to store.
     * @returns The updated setting row (secret values masked).
     * @throws {ServiceError} `NOT_FOUND` if no setting with the given key exists.
     * @throws {ServiceError} `FORBIDDEN` if the actor lacks `SOCIAL_SETTINGS_MANAGE`.
     */
    public async updateByKey(
        actor: Actor,
        key: string,
        value: string
    ): Promise<SocialSettingUpdateByKeyResult> {
        checkCanManageSettings(actor);

        const existing = await this.model.findOne({ key });
        if (!existing) {
            throw new ServiceError(
                ServiceErrorCode.NOT_FOUND,
                `Social setting not found: key="${key}"`
            );
        }

        const updated = await this.model.update({ key }, { value });
        if (!updated) {
            throw new ServiceError(
                ServiceErrorCode.NOT_FOUND,
                `Social setting update failed: key="${key}"`
            );
        }

        const isSecret = updated.type === 'secret';
        const auditValue = isSecret ? SECRET_MASK : value;
        const oldAuditValue = isSecret ? SECRET_MASK : existing.value;

        // Write audit entry directly (SocialAuditLogService is T-029 — not yet available).
        await this.auditLogModel.create({
            actorId: actor.id || undefined,
            eventType: 'SETTING_UPDATED',
            entityType: 'social_setting',
            entityId: updated.id,
            oldValueJson: { value: oldAuditValue },
            newValueJson: { value: auditValue }
        });

        return { entity: maskSecretValue(updated) };
    }

    // -------------------------------------------------------------------------
    // listAll — convenience wrapper that returns all active settings (masked)
    // -------------------------------------------------------------------------

    /**
     * Returns all settings rows. Secret values are masked with `'***'`.
     *
     * This is a convenience wrapper around `list()` with a large page size.
     * For admin panels that need all settings in one call.
     *
     * @param actor - The acting user (must hold `SOCIAL_SETTINGS_MANAGE`).
     * @returns All settings with secret values masked.
     * @throws {ServiceError} `FORBIDDEN` if the actor lacks `SOCIAL_SETTINGS_MANAGE`.
     */
    public async listAll(actor: Actor): Promise<SelectSocialSetting[]> {
        checkCanManageSettings(actor);

        const result = await this.model.findAll({}, { page: 1, pageSize: 1000 }, []);
        return (result.items as SelectSocialSetting[]).map(maskSecretValue);
    }

    // -------------------------------------------------------------------------
    // Search / count
    // -------------------------------------------------------------------------

    protected async _executeSearch(
        params: SocialSettingAdminSearch,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<PaginatedListOutput<SelectSocialSetting>> {
        const { page = 1, pageSize = 20, sort, type, active } = params;
        const where: Record<string, unknown> = {};

        if (type !== undefined) where.type = type;
        if (active !== undefined) where.active = active;

        const parsedSort = sort ? parseAdminSort(sort) : undefined;
        return this.model.findAll(
            where,
            { page, pageSize, sortBy: parsedSort?.field, sortOrder: parsedSort?.direction },
            []
        );
    }

    protected async _executeCount(
        params: SocialSettingAdminSearch,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<{ count: number }> {
        const { type, active } = params;
        const where: Record<string, unknown> = {};

        if (type !== undefined) where.type = type;
        if (active !== undefined) where.active = active;

        const count = await this.model.count(where, { additionalConditions: [] });
        return { count };
    }
}
