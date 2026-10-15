import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types/index.js';

/** A discount applied to an anchored list amount, expressed in minor units. */
export interface PromoDiscount {
    readonly discountKind: 'PERCENTAGE' | 'FIXED';
    readonly value: number;
}

function invalidInput(): ServiceError {
    return new ServiceError(
        ServiceErrorCode.VALIDATION_ERROR,
        'Promo composition input is invalid',
        undefined,
        'PROMO_COMPOSITION_INVALID_INPUT'
    );
}

/**
 * AC:B9b:1 composes every percentage before every fixed discount and rounds
 * down once. ARS 1,000 with 20% and ARS 100 is 700, never 720; ARS 9,999
 * with 15% and 10% is ARS 7,649.23. This is the ONE place promo arithmetic
 * lives; the redeeming writer, S30 and the sweep must all call it (B/14 §1.2).
 *
 * @throws {ServiceError} When the list amount or a discount is invalid.
 */
export function composePromoAmount(input: {
    readonly listAmountMinor: number;
    readonly promos: readonly PromoDiscount[];
}): { readonly amountMinor: number } {
    const { listAmountMinor, promos } = input;
    if (!Number.isSafeInteger(listAmountMinor) || listAmountMinor < 0) throw invalidInput();

    let numerator = BigInt(listAmountMinor);
    let denominator = 1n;
    let fixedTotal = 0n;
    for (const promo of promos) {
        if (promo.discountKind === 'PERCENTAGE') {
            if (!Number.isSafeInteger(promo.value) || promo.value < 1 || promo.value > 100)
                throw invalidInput();
            numerator *= BigInt(100 - promo.value);
            denominator *= 100n;
        } else if (promo.discountKind === 'FIXED') {
            if (!Number.isSafeInteger(promo.value) || promo.value < 1) throw invalidInput();
            fixedTotal += BigInt(promo.value);
        } else {
            throw invalidInput();
        }
    }

    const composed = numerator / denominator - fixedTotal;
    const amountMinor = composed > 0n ? composed : 0n;
    if (amountMinor > BigInt(Number.MAX_SAFE_INTEGER)) throw invalidInput();
    return { amountMinor: Number(amountMinor) };
}
