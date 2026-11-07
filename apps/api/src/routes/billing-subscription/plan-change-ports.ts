import { planCatalogModel } from '@repo/db';
import type { RequestPlanChangePorts } from '@repo/service-core';
import { createPlanCatalogInverse } from '@repo/verticals';
import { getPlanChangeMirror } from '../../utils/billing-succession-ports';
import { getClock } from '../../utils/clock';
import { getPaymentProvider } from '../../utils/payment-provider';
import { beforeCancelNotice } from './before-cancel-notice';
import { touristVipInheritance } from './tourist-vip-inheritance';

/** Build the production ports shared by owner and administrative plan changes. */
export async function buildPlanChangePorts(): Promise<RequestPlanChangePorts> {
    const inverse = createPlanCatalogInverse({ reader: planCatalogModel });
    return {
        provider: getPaymentProvider(),
        clock: getClock().clock,
        planPolicy: inverse.planPolicy,
        changeDirection: inverse.changeDirection,
        beforeCancelNotice,
        touristVipInheritance,
        mirror: await getPlanChangeMirror()
    };
}
