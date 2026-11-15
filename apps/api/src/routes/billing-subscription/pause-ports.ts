import { planCatalogModel } from '@repo/db';
import { createPlanCatalogInverse } from '@repo/verticals';
import { buildComplementPolicyPorts } from '../../utils/billing-complement-ports';
import { getClock } from '../../utils/clock';
import { getCoverageNotices } from '../../utils/listing-access/coverage-notices';
import { createScheduledChangeSurplusStep } from '../../utils/listing-publication/scheduled-change-surplus-step';
import { getPaymentProvider } from '../../utils/payment-provider';

/** Build production S8 ports shared by administrative and self-service routes. */
export function buildPausePorts() {
    return {
        provider: getPaymentProvider(),
        clock: getClock().clock,
        planPolicy: createPlanCatalogInverse({ reader: planCatalogModel }).planPolicy,
        complements: buildComplementPolicyPorts(),
        coverageNotices: getCoverageNotices()
    };
}

/** Build production S10 ports shared by administrative and self-service routes. */
export function buildResumePorts() {
    return {
        provider: getPaymentProvider(),
        clock: getClock().clock,
        complements: buildComplementPolicyPorts(),
        coverageNotices: getCoverageNotices(),
        surplusStep: createScheduledChangeSurplusStep()
    };
}
