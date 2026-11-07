import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types/index.js';
import { PromoRedemptionReason } from './promo-redemption-reasons.js';

/** RP:RP3 / B/14 §1.3 PC-2: Mercado Pago's measured ARS 15 floor. */
const RP3_FLOOR = 1_500;

/** The minimum composed amount (minor units) Mercado Pago will accept for a promo mutation. */
export const PROVIDER_AMOUNT_FLOOR_MINOR = RP3_FLOOR;

/** RP:RP3: Mercado Pago's measured ARS 2.000.000 ceiling. */
const RP3_CEILING = 200_000_000;

/** The maximum amount (minor units) Mercado Pago will accept for a charge (RP3). */
export const PROVIDER_AMOUNT_CEILING_MINOR = RP3_CEILING;

/**
 * Asserts that the composed promo amount meets Mercado Pago's minimum threshold.
 * @param input - The amount in minor units.
 * @throws ServiceError VALIDATION_ERROR `PROMO_BELOW_PROVIDER_MINIMUM` when
 *   `amountMinor` is below the provider floor.
 */
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
