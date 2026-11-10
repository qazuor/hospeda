import {
    PLAN_MIGRATION_REJECTIONS,
    type PlanMigrationRejection,
    ServiceError
} from '@repo/service-core';
import type { Context } from 'hono';
import { createErrorResponse } from '../../../utils/response-helpers.js';

const REJECTION_STATUS: Readonly<Record<PlanMigrationRejection, 400 | 403 | 404 | 409 | 422>> = {
    ADMINISTRATIVE_ACTION_FORBIDDEN: 403,
    INVALID_PLAN_MIGRATION_INPUT: 400,
    PLAN_VERSION_NOT_FOUND: 404,
    PLAN_MIGRATION_SOURCE_NOT_RETIRED: 422,
    PLAN_MIGRATION_TARGET_NOT_SELLABLE: 422,
    PLAN_MIGRATION_VERTICAL_MISMATCH: 422,
    PLAN_MIGRATION_SAME_VERSION: 422,
    PLAN_MIGRATION_COHORT_CHANGED: 409,
    PLAN_MIGRATION_EMPTY_COHORT: 409
};

/** Answer owned action 17 failures and propagate unexpected failures. */
export function answerPlanMigrationRejection(args: {
    readonly error: unknown;
    readonly ctx: Context;
}) {
    const { error, ctx } = args;
    if (
        !(error instanceof ServiceError) ||
        !PLAN_MIGRATION_REJECTIONS.includes(error.reason as never)
    ) {
        throw error;
    }
    const reason = error.reason as PlanMigrationRejection;
    return createErrorResponse(
        { code: reason, message: error.message, reason },
        ctx,
        REJECTION_STATUS[reason]
    );
}
