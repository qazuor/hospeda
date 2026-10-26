import { and, eq, getDb, planCatalogModel, subscriptionModel, trials } from '@repo/db';
import {
    type PricingSituationResponse,
    type PricingSituationVertical,
    ServiceErrorCode,
    VerticalEnum
} from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { PublicationVertical } from '../../../../../packages/verticals/src/publication/publication-types';
import { touristVipInheritance } from '../../routes/billing-subscription/tourist-vip-inheritance';
import { getClock } from '../../utils/clock';
import { isTrialRunning } from '../listing-notices/listing-notices.builder';
import { resolveSubscribeDestinationForUser } from '../listing-publication/subscribe-destination.service';

type Vertical = PricingSituationVertical;

/** Resolve the same pricing gates and in the same order as S1 and PB1. */
export async function readPricingSituation(input: {
    readonly userId: string;
    readonly vertical: Vertical;
}): Promise<PricingSituationResponse> {
    const verticalQuestions: Record<Vertical, () => Promise<PricingSituationResponse>> = {
        accommodation: () =>
            readPublicationSituation({ ...input, vertical: VerticalEnum.ACCOMMODATION }),
        gastronomy: () => readPublicationSituation({ ...input, vertical: VerticalEnum.VENUE }),
        experience: () => readPublicationSituation({ ...input, vertical: VerticalEnum.EXPERIENCE }),
        tourist: () => readTouristSituation()
    };

    if (
        input.vertical === 'tourist' &&
        (await touristVipInheritance.inherits({ userId: input.userId }))
    ) {
        return { situation: 'TOURIST_VIP_INHERITED' };
    }

    const commitment = await subscriptionModel.findLiveCommitment(input);
    if (commitment) {
        const row = commitment.subscription;
        if (!row.planVersionId || !row.billingOptionId) {
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Live commitment is missing billing references'
            );
        }
        return {
            situation: 'SUBSCRIBED',
            status: row.status as Extract<
                PricingSituationResponse,
                { situation: 'SUBSCRIBED' }
            >['status'],
            planVersionId: row.planVersionId,
            billingOptionId: row.billingOptionId
        };
    }

    return verticalQuestions[input.vertical]();
}

async function readTouristSituation(): Promise<PricingSituationResponse> {
    const plans = await planCatalogModel.findSellableCurrentVersions({ vertical: 'tourist' });
    return plans.length ? { situation: 'CHECKOUT' } : { situation: 'NO_PLANS' };
}

async function readPublicationSituation(input: {
    readonly userId: string;
    readonly vertical: PublicationVertical;
}): Promise<PricingSituationResponse> {
    const result = await resolveSubscribeDestinationForUser(input);
    const destinationMap: Record<
        typeof result.destination,
        () => Promise<PricingSituationResponse>
    > = {
        PUBLISH: async () => {
            if (result.destination !== 'PUBLISH') {
                throw new ServiceError(
                    ServiceErrorCode.INTERNAL_ERROR,
                    'Publication destination changed'
                );
            }
            return { situation: 'FIRST_USE', trialDays: result.trialDays };
        },
        NO_PLANS_AVAILABLE: async () => ({ situation: 'NO_PLANS' }),
        CHECKOUT: async () => ({ situation: 'CHECKOUT' }),
        COVERED: async () => {
            const [trial] = await getDb()
                .select({
                    status: trials.status,
                    startedAt: trials.startedAt,
                    endsAt: trials.endsAt
                })
                .from(trials)
                .where(and(eq(trials.userId, input.userId), eq(trials.vertical, input.vertical)))
                .limit(1);
            const running = isTrialRunning({
                trial: trial ?? null,
                now: getClock().clock.now()
            }).running;
            return running ? { situation: 'TRIAL' } : { situation: 'COVERED' };
        }
    };
    return destinationMap[result.destination]();
}
