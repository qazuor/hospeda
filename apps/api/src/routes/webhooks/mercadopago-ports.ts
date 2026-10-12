import { planCatalogModel } from '@repo/db';
import { creditedPaymentsFromLedger } from '@repo/service-core';
import { createPlanCatalogInverse } from '@repo/verticals';
import { getClock } from '../../utils/clock';
import { getPaymentProvider } from '../../utils/payment-provider';
import { beforeCancelNotice } from '../billing-subscription/before-cancel-notice';

/** Builds the real receiver ports; B4/B5/B7 add their own ports here. */
export function buildMercadoPagoNoticePorts() {
    return {
        provider: getPaymentProvider(),
        clock: getClock().clock,
        beforeCancelNotice,
        planPolicy: createPlanCatalogInverse({ reader: planCatalogModel }).planPolicy,
        payments: creditedPaymentsFromLedger
    };
}
