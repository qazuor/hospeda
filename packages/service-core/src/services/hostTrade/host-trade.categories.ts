import type { DrizzleClient, HostTradeCategoryModel, HostTradeModel } from '@repo/db';
import { LifecycleStatusEnum, ServiceErrorCode } from '@repo/schemas';
import type { ServiceContext } from '../../types';
import { ServiceError } from '../../types';

/** `hookState` key carrying the validated category ids from `_beforeX` to `_afterX`. */
export const CATEGORY_IDS_HOOK_KEY = 'hostTradeCategoryIds';

/** `hookState` key carrying the id of the provider being updated into `_beforeUpdate`. */
export const HOST_TRADE_ID_HOOK_KEY = 'hostTradeIdBeingUpdated';

/**
 * Validates the `categoryIds` of a provider write (HOS-919 AC-4.1..AC-4.3).
 *
 * Rules, in this order:
 * - every id must exist, not be soft-deleted, and belong to a group that is
 *   not soft-deleted either;
 * - an `INACTIVE` category is accepted only when the provider ALREADY holds it
 *   (a deactivated category stays on the providers that have it, it just can
 *   not be newly assigned). On create there is nothing to hold yet, so any
 *   inactive id is refused.
 *
 * The count (1..10) and uniqueness are already guaranteed by the Zod schema;
 * this function does not repeat them.
 *
 * @param input.categoryIds - Ids the caller wants the provider to have.
 * @param input.hostTradeId - The provider being updated, or `undefined` on create.
 * @param input.categoryModel - Model used to load the categories.
 * @param input.hostTradeModel - Model used to read the provider's current set.
 * @param input.tx - Optional transaction client.
 * @throws {ServiceError} VALIDATION_ERROR with `details.field = 'categoryIds'`.
 */
export async function assertCategoryIdsAssignable(input: {
    readonly categoryIds: readonly string[];
    readonly hostTradeId?: string | undefined;
    readonly categoryModel: HostTradeCategoryModel;
    readonly hostTradeModel: HostTradeModel;
    readonly tx?: DrizzleClient | undefined;
}): Promise<void> {
    const { categoryIds, hostTradeId, categoryModel, hostTradeModel, tx } = input;

    // FOR SHARE: serializes with the category soft delete (see `findByIdsForShare`).
    const found = await categoryModel.findByIdsForShare(categoryIds, tx);
    const byId = new Map(found.map((category) => [category.id as string, category]));

    const idsInDeletedGroups = new Set(await categoryModel.findIdsInDeletedGroups(categoryIds, tx));
    const unknownIds = categoryIds.filter((id) => {
        const category = byId.get(id);
        return !category || category.deletedAt || idsInDeletedGroups.has(id);
    });
    if (unknownIds.length > 0) {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'categoryIds contains a category that does not exist or was deleted',
            { field: 'categoryIds', reason: 'UNKNOWN_CATEGORY', categoryIds: unknownIds }
        );
    }

    const inactiveIds = categoryIds.filter(
        (id) => byId.get(id)?.lifecycleState === LifecycleStatusEnum.INACTIVE
    );
    if (inactiveIds.length === 0) return;

    const alreadyLinked = new Set<string>();
    if (hostTradeId) {
        const current = await hostTradeModel.hydrateCategories({
            hostTradeIds: [hostTradeId],
            tx
        });
        for (const ref of current.get(hostTradeId) ?? []) alreadyLinked.add(ref.id);
    }

    const newlyInactive = inactiveIds.filter((id) => !alreadyLinked.has(id));
    if (newlyInactive.length > 0) {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'categoryIds contains an inactive category the provider does not already have',
            { field: 'categoryIds', reason: 'INACTIVE_CATEGORY', categoryIds: newlyInactive }
        );
    }
}

/**
 * Validates the requested `categoryIds` and parks them in `hookState` so the
 * `_after*` hook can write the join rows in the same transaction as the row.
 * No-op when the ids are absent: an update without `categoryIds` leaves the
 * provider's set untouched.
 *
 * @param input.categoryIds - Ids the caller wants, or `undefined` to leave the set alone.
 * @param input.hostTradeId - The provider being updated, or `undefined` on create.
 * @param input.ctx - Service context; `hookState` is replaced with the staged ids.
 * @param input.categoryModel - Model used to load the categories.
 * @param input.hostTradeModel - Model used to read the provider's current set.
 */
export async function stageCategoryIds(input: {
    readonly categoryIds: readonly string[] | undefined;
    readonly hostTradeId: string | undefined;
    readonly ctx: ServiceContext;
    readonly categoryModel: HostTradeCategoryModel;
    readonly hostTradeModel: HostTradeModel;
}): Promise<void> {
    const { categoryIds, hostTradeId, ctx, categoryModel, hostTradeModel } = input;
    if (categoryIds === undefined) return;

    await assertCategoryIdsAssignable({
        categoryIds,
        hostTradeId,
        categoryModel,
        hostTradeModel,
        tx: ctx?.tx
    });
    ctx.hookState = { ...ctx.hookState, [CATEGORY_IDS_HOOK_KEY]: [...categoryIds] };
}

/**
 * Replaces the provider's category set with the ids staged by `_beforeX`.
 * Runs on the caller's transaction, so a failure rolls the row back too. Does
 * nothing when no ids were staged.
 *
 * @throws {ServiceError} INTERNAL_ERROR when ids are staged but there is no transaction.
 */
export async function persistStagedCategoryIds(input: {
    readonly hostTradeId: string;
    readonly ctx: ServiceContext;
    readonly hostTradeModel: HostTradeModel;
}): Promise<void> {
    const { hostTradeId, ctx, hostTradeModel } = input;
    const staged = ctx?.hookState?.[CATEGORY_IDS_HOOK_KEY];
    if (!Array.isArray(staged)) return;
    if (!ctx.tx) {
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Category writes require a transaction'
        );
    }
    await hostTradeModel.replaceCategories({
        hostTradeId,
        categoryIds: staged as string[],
        tx: ctx.tx
    });
}

/**
 * Fills `categories` on providers with ONE batched model call (no N+1). A
 * provider without categories gets `[]`. Used by every read path, list or
 * single-entity, so the catalog refs are never the schema default by accident.
 *
 * @param input.items - Providers as read from the table.
 * @param input.ctx - Optional context carrying the transaction.
 * @param input.hostTradeModel - Model used to hydrate.
 * @returns The same providers with their `categories`.
 */
export async function attachCategories<T extends { id: string }>(input: {
    readonly items: T[];
    readonly ctx: ServiceContext | undefined;
    readonly hostTradeModel: HostTradeModel;
}): Promise<(T & { categories: CategoryRefs })[]> {
    const { items, ctx, hostTradeModel } = input;
    if (items.length === 0) return [];
    const byProvider = await hostTradeModel.hydrateCategories({
        hostTradeIds: items.map((item) => item.id),
        tx: ctx?.tx
    });
    return items.map((item) => ({ ...item, categories: byProvider.get(item.id) ?? [] }));
}

/** Category refs as `HostTradeModel.hydrateCategories` returns them. */
type CategoryRefs =
    Awaited<ReturnType<HostTradeModel['hydrateCategories']>> extends Map<string, infer Refs>
        ? Refs
        : never;
