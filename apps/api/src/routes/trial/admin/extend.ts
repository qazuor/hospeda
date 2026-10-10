import {
    AdminExtendTrialRequestSchema,
    AdminExtendTrialResponseSchema,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { entityNotFoundError } from '@repo/service-core';
import { extendTrialByAdmin, InvalidTrialMachineInputError } from '@repo/verticals';
import { getActorFromContext } from '../../../utils/actor';
import { getClock } from '../../../utils/clock';
import { createRouter } from '../../../utils/create-app';
import { createErrorResponse } from '../../../utils/response-helpers';
import { createAdminRoute } from '../../../utils/route-factory';
import { getTrialMachinePorts } from '../../../utils/trial/trial-machine-ports';

/** Administrative action 11: audited T4 outside redemption and ceiling policy. */
export const adminExtendTrialRoute = createAdminRoute({
    method: 'post',
    path: '/extend',
    summary: 'Extend a trial',
    description:
        'Administrative action 11: extends a running trial past the ceiling with a mandatory reason.',
    tags: ['Trials'],
    requiredPermissions: [PermissionEnum.TRIAL_EXTEND],
    requestBody: AdminExtendTrialRequestSchema,
    responseSchema: AdminExtendTrialResponseSchema,
    successStatusCode: 200,
    handler: async (ctx, _params, body) => {
        const actor = getActorFromContext(ctx);
        try {
            const result = await extendTrialByAdmin({
                ...getTrialMachinePorts(),
                clock: getClock().clock,
                input: { ...AdminExtendTrialRequestSchema.parse(body), actorId: actor.id }
            });
            if (!result.extended) {
                if (result.reason === 'NO_TRIAL')
                    throw entityNotFoundError({ entityName: 'Trial' });
                return createErrorResponse(
                    { code: ServiceErrorCode.ALREADY_EXISTS, message: 'Trial has ended' },
                    ctx,
                    409
                );
            }
            return {
                previousEndsAt: result.previousEndsAt.toISOString(),
                endsAt: result.endsAt.toISOString(),
                totalDays: result.totalDays
            };
        } catch (error) {
            if (error instanceof InvalidTrialMachineInputError) {
                return createErrorResponse(
                    { code: ServiceErrorCode.VALIDATION_ERROR, message: error.message },
                    ctx,
                    400
                );
            }
            throw error;
        }
    }
});

const router = createRouter();
router.route('/', adminExtendTrialRoute);

export { router as adminTrialRoutes };
