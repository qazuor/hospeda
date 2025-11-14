import type { NotificationModel } from '@repo/db';
import type { ListRelationsConfig, Notification } from '@repo/schemas';
import {
    CreateNotificationSchema,
    SearchNotificationsSchema,
    UpdateNotificationSchema
} from '@repo/schemas';
import type { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service.js';
import type { Actor, PaginatedListOutput, ServiceContext } from '../../types/index.js';
import {
    checkCanCount,
    checkCanCreate,
    checkCanDelete,
    checkCanHardDelete,
    checkCanList,
    checkCanPatch,
    checkCanRestore,
    checkCanSearch,
    checkCanSoftDelete,
    checkCanUpdate,
    checkCanUpdateVisibility,
    checkCanView
} from './notification.permissions.js';

/**
 * Service for managing notifications.
 * Extends BaseCrudService to provide CRUD operations with permission checks
 * for platform notification management across multiple channels.
 */
export class NotificationService extends BaseCrudService<
    Notification,
    NotificationModel,
    typeof CreateNotificationSchema,
    typeof UpdateNotificationSchema,
    typeof SearchNotificationsSchema
> {
    static readonly ENTITY_NAME = 'notification';
    protected readonly entityName = NotificationService.ENTITY_NAME;

    public readonly model: NotificationModel;

    public readonly createSchema = CreateNotificationSchema;
    public readonly updateSchema = UpdateNotificationSchema;
    public readonly searchSchema = SearchNotificationsSchema;

    constructor(ctx: ServiceContext, model?: NotificationModel) {
        super(ctx, NotificationService.ENTITY_NAME);
        this.model = model ?? ({} as NotificationModel);
    }

    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    // ============================================================================
    // PERMISSION HOOKS (11 standard hooks)
    // ============================================================================

    /**
     * Check if actor can create notifications
     */
    protected _canCreate(actor: Actor, _data: unknown): void {
        checkCanCreate(actor, _data);
    }

    /**
     * Check if actor can update notifications
     */
    protected _canUpdate(actor: Actor, entity: Notification): void {
        checkCanUpdate(actor, entity);
    }

    /**
     * Check if actor can patch notifications
     */
    protected _canPatch(actor: Actor, entity: Notification, data: unknown): void {
        checkCanPatch(actor, entity, data);
    }

    /**
     * Check if actor can update visibility of notifications
     */
    protected _canUpdateVisibility(actor: Actor, entity: Notification): void {
        checkCanUpdateVisibility(actor, entity);
    }

    /**
     * Check if actor can soft delete notifications
     */
    protected _canDelete(actor: Actor, entity: Notification): void {
        checkCanDelete(actor, entity);
    }

    /**
     * Check if actor can hard delete notifications
     */
    protected _canHardDelete(actor: Actor, entity: Notification): void {
        checkCanHardDelete(actor, entity);
    }

    /**
     * Check if actor can restore notifications
     */
    protected _canRestore(actor: Actor, entity: Notification): void {
        checkCanRestore(actor, entity);
    }

    /**
     * Check if actor can view notifications
     */
    protected _canView(actor: Actor, entity: Notification): void {
        checkCanView(actor, entity);
    }

    /**
     * Check if actor can list notifications
     */
    protected _canList(actor: Actor): void {
        checkCanList(actor);
    }

    /**
     * Check if actor can soft delete notifications
     */
    protected _canSoftDelete(actor: Actor, entity: Notification): void {
        checkCanSoftDelete(actor, entity);
    }

    /**
     * Check if actor can search notifications
     */
    protected _canSearch(actor: Actor): void {
        checkCanSearch(actor);
    }

    /**
     * Check if actor can count notifications
     */
    protected _canCount(actor: Actor): void {
        checkCanCount(actor);
    }

    /**
     * Execute search for notifications
     */
    protected async _executeSearch(
        _params: z.infer<typeof SearchNotificationsSchema>,
        _actor: Actor
    ): Promise<PaginatedListOutput<Notification>> {
        // For now, delegate to list method until search is implemented
        return {
            items: [],
            total: 0
        };
    }

    /**
     * Execute count for notifications
     */
    protected async _executeCount(
        _params: z.infer<typeof SearchNotificationsSchema>,
        _actor: Actor
    ): Promise<{ count: number }> {
        return { count: 0 };
    }
}
