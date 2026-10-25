import {
    and,
    billingOptions,
    eq,
    getDb,
    subscriptionModel as liveCommitmentReader,
    trials
} from '@repo/db';
import {
    BillingCycleSchema,
    ServiceErrorCode,
    type SignupNoticeResponse,
    SignupNoticeResponseSchema,
    VerticalEnumSchema
} from '@repo/schemas';
import { readBillingChoice, readResumableCheckoutUrl, ServiceError } from '@repo/service-core';
import { isTrialRunning } from '../../services/listing-notices/listing-notices.builder';
import { getClock } from '../../utils/clock';
import {
    touristVipCancelledOnActivation,
    touristVipCancelledOnReturn
} from './tourist-vip-inheritance';

const DAY_MS = 86_400_000;

/**
 * Read-only composition for the signup checkout notice. It resolves the
 * selected option's vertical and that user's trial in the same vertical.
 *
 * @throws `NOT_FOUND` when the billing option does not exist.
 * @throws `INTERNAL_ERROR` when the stored vertical is outside the contract.
 * @throws Any database read error so the page can show its conditional notice.
 */
export async function readSignupNotice(input: {
    readonly userId: string;
    readonly billingOptionId: string;
}): Promise<SignupNoticeResponse> {
    const choice = await readBillingChoice({ billingOptionId: input.billingOptionId });
    const vertical = VerticalEnumSchema.safeParse(choice.vertical);
    if (!vertical.success) {
        throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'Unknown billing option vertical');
    }
    const plan = await readPlan({ billingOptionId: input.billingOptionId });
    const now = getClock().clock.now();
    const commitment = await liveCommitmentReader.findLiveCommitment({
        userId: input.userId,
        vertical: vertical.data
    });
    let pendingAttempt: SignupNoticeResponse['pendingAttempt'] = null;
    if (
        commitment &&
        commitment.subscription.status === 'PENDING_AUTHORIZATION' &&
        commitment.subscription.billingOptionId &&
        commitment.subscription.billingOptionId !== input.billingOptionId &&
        commitment.subscription.authorizationWindowEndsAt &&
        commitment.subscription.authorizationWindowEndsAt > now &&
        commitment.providerLink &&
        commitment.idempotencyKey?.completedAt
    ) {
        pendingAttempt = {
            subscriptionId: commitment.subscription.id,
            plan: await readPlan({ billingOptionId: commitment.subscription.billingOptionId }),
            checkoutUrl: readResumableCheckoutUrl({ commitment }),
            authorizationWindowEndsAt:
                commitment.subscription.authorizationWindowEndsAt.toISOString()
        };
    }
    let touristVip: SignupNoticeResponse['touristVip'];
    switch (vertical.data) {
        case 'tourist':
            if (await touristVipCancelledOnReturn({ userId: input.userId })) {
                touristVip = { status: 'CANCELLED_ON_RETURN' };
            } else {
                touristVip = { status: 'NOT_AFFECTED' };
            }
            break;
        case 'accommodation':
        case 'gastronomy':
        case 'experience':
            touristVip = (await touristVipCancelledOnActivation({
                userId: input.userId,
                planVersionId: choice.planVersionId
            })) ?? { status: 'NOT_AFFECTED' };
            break;
        case 'partner':
            touristVip = { status: 'NOT_AFFECTED' };
            break;
        default:
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Unknown billing option vertical'
            );
    }
    const [trial] = await getDb()
        .select({
            id: trials.id,
            status: trials.status,
            startedAt: trials.startedAt,
            endsAt: trials.endsAt
        })
        .from(trials)
        .where(and(eq(trials.userId, input.userId), eq(trials.vertical, vertical.data)))
        .limit(1);
    if (!isTrialRunning({ trial: trial ?? null, now }).running || !trial?.endsAt) {
        return {
            plan,
            pendingAttempt,
            vertical: vertical.data,
            touristVip,
            trial: { status: 'NOT_RUNNING' }
        };
    }

    return {
        plan,
        pendingAttempt,
        vertical: vertical.data,
        touristVip,
        trial: {
            status: 'RUNNING',
            endsAt: trial.endsAt.toISOString(),
            daysLeft: Math.ceil((trial.endsAt.getTime() - now.getTime()) / DAY_MS)
        }
    };
}

async function readPlan(input: {
    readonly billingOptionId: string;
}): Promise<SignupNoticeResponse['plan']> {
    const choice = await readBillingChoice({ billingOptionId: input.billingOptionId });
    const [option] = await getDb()
        .select({
            cycle: billingOptions.cycle,
            amount: billingOptions.amount,
            currency: billingOptions.currency
        })
        .from(billingOptions)
        .where(eq(billingOptions.id, input.billingOptionId))
        .limit(1);
    if (!option) throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Billing option not found');
    const cycle = BillingCycleSchema.safeParse(option.cycle);
    if (!cycle.success)
        throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'Unknown billing option cycle');
    const currency = SignupNoticeResponseSchema.shape.plan.shape.currency.safeParse(
        option.currency
    );
    if (!currency.success)
        throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'Unknown billing option currency');
    return {
        slug: choice.planSlug,
        name: choice.planName,
        amount: option.amount,
        currency: currency.data,
        cycle: cycle.data
    };
}
