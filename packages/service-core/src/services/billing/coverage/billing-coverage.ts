/**
 * Billing's real `coverage()` (contract §5.2): joins verticals' trial and BASE
 * resolution with billing's subscription, courtesy, grant and addon sources.
 */
import {
    type BillingForVerticals,
    type CoverageArgs,
    CoverageArgsSchema,
    type CoverageResponse,
    CoverageResponseSchema,
    type CoverageSource,
    coverageSourceClassOf
} from '@repo/billing-verticals-contract';
import type { DrizzleClient } from '@repo/db';
import { resolveAddonSources } from './addon-sources';
import { resolveCourtesySources } from './courtesy-sources';
import type { BillingCoveragePorts } from './coverage-ports';
import { resolveGrantSources } from './grant-sources';
import { resolveSubscriptionSources } from './subscription-sources';

/**
 * Resolves real `CORTESÍA` and `GRANT` sources from their billing tables.
 * Never uses bootstrap answers (G13).
 *
 * @param args.ports - The clock used to expire courtesy sources
 * @param args.tx - Optional transaction every read runs in
 * @returns `{ sources }` in courtesy-then-grant order
 */
async function resolveCourtesyAndGrantSources(args: {
    readonly userId: string;
    readonly vertical: CoverageArgs['vertical'];
    readonly ports: BillingCoveragePorts;
    readonly tx?: DrizzleClient;
}): Promise<{ readonly sources: CoverageSource[] }> {
    const [courtesy, grant] = await Promise.all([
        resolveCourtesySources(args),
        resolveGrantSources(args)
    ]);
    return { sources: [...courtesy.sources, ...grant.sources] };
}

/**
 * Builds billing's real `coverage()`.
 *
 * The response joins the trial/BASE sources with SUBSCRIPTION, ADDON,
 * COURTESY and GRANT; `covered` is recomputed as "at least one source of
 * class TITLE" (contract §2.4), and a response that does not validate is not
 * delivered (contract §6.1). No listener and no coverage-changed notice here.
 *
 * @param args.ports - The ports of the real coverage
 * @param args.tx - Optional transaction every billing read runs in
 * @returns `{ coverage }`
 */
export function createBillingCoverage(args: {
    readonly ports: BillingCoveragePorts;
    readonly tx?: DrizzleClient;
}): Pick<BillingForVerticals, 'coverage'> {
    const { ports, tx } = args;
    return {
        async coverage(input: CoverageArgs): Promise<CoverageResponse> {
            const { userId, vertical } = CoverageArgsSchema.parse(input);
            const [trialAndBase, subscription, addon, courtesyAndGrant] = await Promise.all([
                ports.trialAndBase({ userId, vertical }),
                resolveSubscriptionSources({ userId, vertical, ports, tx }),
                resolveAddonSources({ userId, vertical, ports, tx }),
                resolveCourtesyAndGrantSources({ userId, vertical, ports, tx })
            ]);
            const sources: CoverageSource[] = [
                ...trialAndBase.sources,
                ...subscription.sources,
                ...courtesyAndGrant.sources,
                ...addon.sources
            ];
            return CoverageResponseSchema.parse({
                covered: sources.some(
                    (source) => coverageSourceClassOf({ source }).sourceClass === 'TITLE'
                ),
                sources
            });
        }
    };
}
