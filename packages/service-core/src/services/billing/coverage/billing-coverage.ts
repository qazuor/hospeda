/**
 * Billing's real `coverage()` (contract §5.2): the trial and BASE resolution
 * of verticals, joined with the sources billing owns. It plugs in as sources
 * and touches nothing already built.
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
import type { BillingCoveragePorts } from './coverage-ports';
import { resolveSubscriptionSources } from './subscription-sources';

/**
 * The `CORTESÍA` and `GRANT` sources. B9a plugs the real ones in here without
 * touching anything else of this module; until then the answer is "none", the
 * default of denying (contract §6.1). Never the bootstrap answers (G13).
 *
 * @returns `{ sources }`, always empty in this cut
 */
async function resolveCourtesyAndGrantSources(_args: {
    readonly userId: string;
    readonly vertical: CoverageArgs['vertical'];
}): Promise<{ readonly sources: CoverageSource[] }> {
    return { sources: [] };
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
                resolveCourtesyAndGrantSources({ userId, vertical })
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
