import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types/index.js';
import { PromoRedemptionReason } from './promo-redemption-reasons.js';

/** RP:RP3 / B/14 §1.3 PC-2: Mercado Pago's measured ARS 15 floor. */
export const PROVIDER_AMOUNT_FLOOR_MINOR = 1_500;

export function assertAboveProviderFloor(input: { readonly amountMinor: number }): void {
    if (input.amountMinor < PROVIDER_AMOUNT_FLOOR_MINOR) {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'The composed promo amount is below Mercado Pago minimum',
            undefined,
            PromoRedemptionReason.PROMO_BELOW_PROVIDER_MINIMUM
        );
    }
}
