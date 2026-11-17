import type { DrizzleClient, HostTradeCategoryModel, HostTradeModel } from '@repo/db';
import { LifecycleStatusEnum, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../types';

/** `hookState` key carrying the validated category ids from `_beforeX` to `_afterX`. */
export const CATEGORY_IDS_HOOK_KEY = 'hostTradeCategoryIds';

/** `hookState` key carrying the id of the provider being updated into `_beforeUpdate`. */
export const HOST_TRADE_ID_HOOK_KEY = 'hostTradeIdBeingUpdated';

/**
 * Validates the `categoryIds` of a provider write (HOS-919 AC-4.1..AC-4.3).
 *
 * Rules, in this order:
 * - every id must exist and not be soft-deleted;
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

    const found = await categoryModel.findByIds(categoryIds, tx);
    const byId = new Map(found.map((category) => [category.id as string, category]));

    const unknownIds = categoryIds.filter((id) => {
        const category = byId.get(id);
        return !category || category.deletedAt;
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
