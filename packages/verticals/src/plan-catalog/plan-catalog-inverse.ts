/**
 * The verticals implementation of the plan catalog's three entries of the
 * contract's inverse direction (HOS-1435, V2, AC:V2:3 to AC:V2:5; contract
 * §4.1): `planPolicy`, `changeDirection` and `addonPolicy`. They carry policy
 * and catalog state, never a capability: no entitlement or limit leaves here.
 *
 * Every argument and every answer crosses the contract's schemas: an answer
 * that does not validate is not delivered (contract §6.1).
 */
import {
    type AddonPolicyArgs,
    AddonPolicyArgsSchema,
    type AddonPolicyResponse,
    AddonPolicyResponseSchema,
    type ChangeDirectionArgs,
    ChangeDirectionArgsSchema,
    type ChangeDirectionResponse,
    ChangeDirectionResponseSchema,
    type PlanPolicyArgs,
    PlanPolicyArgsSchema,
    type PlanPolicyResponse,
    PlanPolicyResponseSchema,
    type VerticalsForBilling
} from '@repo/billing-verticals-contract';
import type { PlanCatalogReader, PlanVersionEffectsRow } from './catalog-reader';
import { decideChangeDirection } from './change-direction';
import { CatalogVersionNotFoundError } from './errors';

/** The plan catalog's part of {@link VerticalsForBilling}. */
export type PlanCatalogInverse = Pick<
    VerticalsForBilling,
    'planPolicy' | 'changeDirection' | 'addonPolicy'
>;

/**
 * Builds the plan catalog's inverse entries over a catalog reader.
 *
 * @param args.reader - Reads the catalog (`@repo/db`'s `planCatalogModel` in production)
 * @returns `planPolicy`, `changeDirection` and `addonPolicy`
 */
export function createPlanCatalogInverse(args: {
    readonly reader: PlanCatalogReader;
}): PlanCatalogInverse {
    const { reader } = args;

    /** Effects of a plan version that must exist. */
    const effectsOf = async (id: string): Promise<PlanVersionEffectsRow> => {
        if (!(await reader.findPlanVersion({ id }))) {
            throw new CatalogVersionNotFoundError({ kind: 'plan_version', id });
        }
        return reader.findPlanVersionEffects({ id });
    };

    return {
        /**
         * `políticaDePlan`: exactly grace days, pause, current and sellable,
         * read from the version. No trial days (the trial machine reads its
         * own table), no entitlement, no limit.
         */
        async planPolicy(input: PlanPolicyArgs): Promise<PlanPolicyResponse> {
            const { planVersionId } = PlanPolicyArgsSchema.parse(input);
            const version = await reader.findPlanVersion({ id: planVersionId });
            if (!version) {
                throw new CatalogVersionNotFoundError({ kind: 'plan_version', id: planVersionId });
            }
            return PlanPolicyResponseSchema.parse({
                graceDays: version.graceDays,
                allowsPause: version.allowsPause,
                current: version.current,
                sellable: version.sellable
            });
        },

        /**
         * `direcciónDeCambio`: the verdict by the delta of the two versions'
         * entitlements and limits, never by their rank; only the verdict.
         */
        async changeDirection(input: ChangeDirectionArgs): Promise<ChangeDirectionResponse> {
            const { fromPlanVersionId, toPlanVersionId } = ChangeDirectionArgsSchema.parse(input);
            const from = await effectsOf(fromPlanVersionId);
            const to = await effectsOf(toPlanVersionId);
            return ChangeDirectionResponseSchema.parse(decideChangeDirection({ from, to }));
        },

        /**
         * `políticaDeAddon`: the addon, its validity, its validity days and
         * its scope type, read from `addon_version`; never what it grants.
         */
        async addonPolicy(input: AddonPolicyArgs): Promise<AddonPolicyResponse> {
            const { addonVersionId } = AddonPolicyArgsSchema.parse(input);
            const version = await reader.findAddonVersion({ id: addonVersionId });
            if (!version) {
                throw new CatalogVersionNotFoundError({
                    kind: 'addon_version',
                    id: addonVersionId
                });
            }
            return AddonPolicyResponseSchema.parse({
                addonId: version.addonId,
                validity: version.validity,
                validityDays: version.validityDays,
                scopeType: version.scopeType
            });
        }
    };
}
