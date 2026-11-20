/**
 * @file plan-comparison-source.ts
 * @description Chooses which plan resolves a comparison cell (HOS-2398).
 *
 * The owner table's `asTourist` group lists benefits an owner plan INHERITS from
 * Tourist VIP. Those cells are resolved against the sellable Tourist VIP plan,
 * which the page reads from the tourist catalog, so the table shows what the
 * owner really receives once the owner plans stop carrying a copy of the
 * tourist entitlements and limits.
 */

import {
    type CellRendered,
    type GroupConfig,
    type PlanCellSource,
    type RowCellDef,
    resolveCell
} from './plan-comparison-rows';

/**
 * Pick the plan a group's cells are resolved against for one column.
 *
 * A group flagged `resolvesAgainstTouristVip` reads an inheriting plan's cells
 * off the sellable Tourist VIP plan, because that is what the owner actually
 * receives (HOS-2398). Every other group, and every non-inheriting plan, reads
 * its own data. Without a Tourist VIP plan (the tourist catalog read failed)
 * the column falls back to its own rows rather than inventing values.
 *
 * @param params.group - The group the row belongs to.
 * @param params.plan - The plan rendered in this column.
 * @param params.touristVipPlan - The sellable Tourist VIP plan, or `null`.
 * @returns The plan whose data resolves the cell.
 */
export function resolveGroupCellSource({
    group,
    plan,
    touristVipPlan
}: {
    readonly group: Pick<GroupConfig, 'resolvesAgainstTouristVip'>;
    readonly plan: PlanCellSource;
    readonly touristVipPlan: PlanCellSource | null;
}): PlanCellSource {
    if (group.resolvesAgainstTouristVip === true && plan.inheritsTouristVip === true) {
        return touristVipPlan ?? plan;
    }
    return plan;
}

/**
 * Resolve one row cell for one plan column, honouring the group's source.
 *
 * @param params.group - The group the row belongs to.
 * @param params.cell - The row's typed cell definition.
 * @param params.plan - The plan rendered in this column.
 * @param params.touristVipPlan - The sellable Tourist VIP plan, or `null`.
 * @returns The value to render: `'yes' | 'no' | 'unlimited' | number`.
 */
export function resolveGroupCell({
    group,
    cell,
    plan,
    touristVipPlan
}: {
    readonly group: Pick<GroupConfig, 'resolvesAgainstTouristVip'>;
    readonly cell: RowCellDef;
    readonly plan: PlanCellSource;
    readonly touristVipPlan: PlanCellSource | null;
}): CellRendered {
    return resolveCell({ cell, plan: resolveGroupCellSource({ group, plan, touristVipPlan }) });
}
