import type { Clock, CoverageChangedEvent } from '@repo/billing-verticals-contract';
import type { DrizzleClient } from '@repo/db';
import { createLogger } from '@repo/logger';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';

const logger = createLogger('payment-ports');

/** B9b supplies the policy that compares a recorded charge against the promo price. */
export interface PromoChargePolicy {
    chargedWithDiscount(input: {
        readonly subscriptionId: string;
        readonly redemptionId: string;
        readonly amountMinor: number;
        readonly currency: string;
        readonly tx: DrizzleClient;
    }): Promise<boolean>;
}

/** Fails visibly when a live redemption needs B9b's discount decision. */
export const unregisteredPromoChargePolicy: PromoChargePolicy = {
    async chargedWithDiscount() {
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Promo charge policy is not registered',
            undefined,
            'PROMO_CHARGE_POLICY_NOT_REGISTERED'
        );
    }
};

/** B9b supplies S30 after a redemption is exhausted. */
export interface PromoExhaustion {
    runS30(input: {
        readonly subscriptionId: string;
        readonly redemptionId: string;
    }): Promise<void>;
}

/** Fails visibly when an exhausted redemption needs B9b's S30 implementation. */
export const unregisteredPromoExhaustion: PromoExhaustion = {
    async runS30() {
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'S30 is not registered',
            undefined,
            'S30_NOT_REGISTERED'
        );
    }
};

/** B4 wires the listener that receives coverage changes. */
export interface CoverageNotices {
    emitCoverageChanged(event: CoverageChangedEvent): Promise<void>;
}

/** Coverage delivery is best effort; without B4, report the unwired notice. */
export const unwiredCoverageNotices: CoverageNotices = {
    async emitCoverageChanged(event) {
        logger.error({ event }, 'Coverage changed notice has no listener');
    }
};

export interface PaymentServicePorts {
    readonly clock: Clock;
    readonly promoCharges?: PromoChargePolicy;
    readonly promoExhaustion?: PromoExhaustion;
    readonly coverageNotices?: CoverageNotices;
}
