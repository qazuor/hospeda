import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';
import type { TouristVipInheritancePort } from './cancel-inherited-tourist-vip.service';

/** Rejects Tourist VIP purchases already inherited from the current plan. */
export async function assertTouristVipPurchaseAllowed(input: {
    readonly vertical: string;
    readonly userId: string;
    readonly touristVipInheritance: TouristVipInheritancePort;
}): Promise<void> {
    if (
        input.vertical === 'tourist' &&
        (await input.touristVipInheritance.inherits({ userId: input.userId }))
    ) {
        throw new ServiceError(
            ServiceErrorCode.ALREADY_EXISTS,
            'Your current plan already includes Tourist VIP',
            undefined,
            'TOURIST_VIP_INHERITED'
        );
    }
}
