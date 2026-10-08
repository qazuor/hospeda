import { z } from 'zod';

/**
 * Role of a plan inside its vertical (HOS-1436, piece V2, AC:V2:6/7).
 *
 * The three non-sellable plans every vertical declares are not a separate
 * entity: each is an ordinary `plan` row, one per vertical, marked with this
 * role and, by construction, non-sellable (`plan_version.sellable = false`).
 * A plan whose `role` is `NULL` is an ordinary sellable plan.
 *
 * - `trial`      — the plan the `TRIAL` source points to while a trial is alive.
 *                  Its entitlements and limits are derived, never stored.
 * - `pre_trial`  — the plan the trial source points to while in `PRE_TRIAL`.
 * - `floor`      — the plan the `BASE` source points to for everyone.
 *
 * The three roles are the ONLY values `plan.role` accepts; the database repeats
 * the list in the `ck_plan_role` CHECK. This module is the single code source of
 * the literals, so no call site repeats them.
 */
export const PLAN_ROLES = ['trial', 'pre_trial', 'floor'] as const;
export type PlanRole = (typeof PLAN_ROLES)[number];
export const PlanRoleSchema = z.enum(PLAN_ROLES);

/** The role of the trial plan of a vertical. */
export const TRIAL_PLAN_ROLE: PlanRole = 'trial';
/** The role of the pre-trial plan of a vertical. */
export const PRE_TRIAL_PLAN_ROLE: PlanRole = 'pre_trial';
/** The role of the floor plan of a vertical. */
export const FLOOR_PLAN_ROLE: PlanRole = 'floor';

/** The two non-sellable roles that are not the trial plan. */
export const NON_SELLABLE_PLAN_ROLES: readonly PlanRole[] = [PRE_TRIAL_PLAN_ROLE, FLOOR_PLAN_ROLE];

/**
 * Whether a role names a non-sellable plan.
 *
 * @param role - The role to test, or `null` for a sellable plan.
 * @returns `true` when the role is one of the three non-sellable roles.
 */
export function isNonSellablePlanRole(role: PlanRole | null | undefined): role is PlanRole {
    return role != null && PLAN_ROLES.includes(role);
}
