import { eq, getDb, planVersions } from '@repo/db';
import {
    acceptsPaymentMethod,
    isSelfServiceCardCheckout,
    type PlanPaymentMethod,
    ServiceErrorCode
} from '@repo/schemas';
import { ServiceError } from '../../../types';

/**
 * Reads the payment methods a plan version accepts (HOS-2196). They live on `plan_version`, so a
 * plan declares them and a vertical never does.
 *
 * @throws {ServiceError} `NOT_FOUND` when the version does not exist.
 */
export async function readPlanVersionPaymentMethods(input: {
    readonly planVersionId: string;
}): Promise<readonly string[]> {
    const [row] = await getDb()
        .select({ paymentMethods: planVersions.paymentMethods })
        .from(planVersions)
        .where(eq(planVersions.id, input.planVersionId))
        .limit(1);
    if (!row) throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Plan version not found');
    return row.paymentMethods;
}

/**
 * Rejects a payment method the plan version does not accept.
 *
 * @throws {ServiceError} `VALIDATION_ERROR` with reason `PAYMENT_METHOD_NOT_ACCEPTED`.
 */
export function assertPlanAcceptsPaymentMethod(input: {
    readonly paymentMethods: readonly string[];
    readonly method: PlanPaymentMethod;
}): void {
    if (acceptsPaymentMethod(input)) return;
    throw new ServiceError(
        ServiceErrorCode.VALIDATION_ERROR,
        `This plan does not accept ${input.method} payment`,
        undefined,
        'PAYMENT_METHOD_NOT_ACCEPTED'
    );
}

/**
 * Guards the public card checkout (`?opcion=`) and the self-service plan change: a plan that also
 * accepts manual payment is sold by the team (administrative action 6), so it is refused here
 * (HOS-1739, PDR §17.3). Replaces the hardcoded Partner list.
 *
 * @throws {ServiceError} `VALIDATION_ERROR` with reason `PLAN_NOT_SELF_SERVICE`.
 */
export function assertSelfServiceCardCheckout(input: {
    readonly paymentMethods: readonly string[];
}): void {
    if (isSelfServiceCardCheckout(input)) return;
    throw new ServiceError(
        ServiceErrorCode.VALIDATION_ERROR,
        'This plan is not sold through the card checkout',
        undefined,
        'PLAN_NOT_SELF_SERVICE'
    );
}
