/**
 * Re-export shim for the PlanService from `@repo/service-core`.
 *
 * @module services/plan.service
 */
export {
    PlanService,
    createPlan,
    getPlanById,
    hardDeletePlan,
    listPlans,
    mapDbToPlan,
    restorePlan,
    softDeletePlan,
    togglePlanActive,
    updatePlan,
    diffPlanFields,
    insertPlanAuditLog,
    type CreatePlanInput,
    type UpdatePlanInput,
    type ListPlansFilters,
    type BillingPlanResponse,
    type InsertPlanAuditLogInput,
    type PlanFieldDiff,
    type DiffChangedField
} from '@repo/service-core';
