/**
 * The `ADDON` source of billing's real `coverage()` (contract §2.4, §2.6,
 * §2.7; AC:B4:7, AC:B4:8): one source per live addon instance of the person
 * that reaches the vertical asked about, read from `addon_instance` and
 * `addon_product`. Watched by `G-R2-C`: a `USER`/`GLOBAL` instance is emitted
 * only in the compatible verticals of its product.
 */
import type { CoverageArgs, CoverageSource } from '@repo/billing-verticals-contract';
import {
    addonInstances,
    addonProducts,
    and,
    type DrizzleClient,
    eq,
    getDb,
    subscriptions
} from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';
import type { BillingCoveragePorts } from './coverage-ports';

/** The columns of an addon instance, with its product, this source reads. */
interface AddonInstanceRow {
    readonly id: string;
    readonly addonVersionId: string;
    readonly targetId: string | null;
    readonly startsAt: Date | null;
    readonly endsAt: Date | null;
    readonly createdAt: Date;
    readonly product: { readonly compatibleVerticals: string[] };
}

/** The scope and target an emitted instance carries, or `null` when it does not reach the vertical. */
type Placement = { readonly scope: CoverageSource['scope']; readonly target: string | null } | null;

/** Fails on a row that cannot be emitted without inventing a field (HOS-1532 I-2). */
function inconsistentInstance(args: { readonly instanceId: string; readonly why: string }): never {
    throw new ServiceError(
        ServiceErrorCode.INTERNAL_ERROR,
        `Addon instance ${args.instanceId} cannot be emitted as a coverage source: ${args.why}`,
        undefined,
        'COVERAGE_ADDON_INSTANCE_INCONSISTENT'
    );
}

/** The target of a scope that requires one (extras 044 makes it non-null there). */
function requiredTarget(args: { readonly instance: AddonInstanceRow }): string {
    if (!args.instance.targetId) {
        return inconsistentInstance({ instanceId: args.instance.id, why: 'missing target_id' });
    }
    return args.instance.targetId;
}

/**
 * Resolves the `ADDON` sources of one `(user, vertical)`.
 *
 * Reads the person's `ACTIVE` instances; the scope type and validity come
 * from `políticaDeAddon` of the ANCHORED version (never from
 * `addon_product.version_id`, B/02 §2.4). By scope type: `USER`/`GLOBAL` are
 * emitted only when the product declares the vertical compatible (contract
 * §2.7); `VERTICAL_SUBSCRIPTION` travels as `VERTICAL` when the targeted
 * subscription is of this vertical; `LISTING` carries its listing when `ficha`
 * says it belongs to this vertical. A `FIXED_DAYS` instance whose end already
 * passed is not emitted (contract §2.6).
 *
 * @param args.userId - The owner of the instances
 * @param args.vertical - The vertical asked about
 * @param args.ports - Clock, `políticaDeAddon` and `ficha`
 * @param args.tx - Optional transaction every read runs in
 * @returns `{ sources }`
 */
export async function resolveAddonSources(args: {
    readonly userId: string;
    readonly vertical: CoverageArgs['vertical'];
    readonly ports: Pick<BillingCoveragePorts, 'clock' | 'addonPolicy' | 'listing'>;
    readonly tx?: DrizzleClient;
}): Promise<{ readonly sources: CoverageSource[] }> {
    const db = args.tx ?? getDb();
    const rows: AddonInstanceRow[] = await db
        .select({
            id: addonInstances.id,
            addonVersionId: addonInstances.addonVersionId,
            targetId: addonInstances.targetId,
            startsAt: addonInstances.startsAt,
            endsAt: addonInstances.endsAt,
            createdAt: addonInstances.createdAt,
            product: { compatibleVerticals: addonProducts.compatibleVerticals }
        })
        .from(addonInstances)
        .innerJoin(addonProducts, eq(addonProducts.id, addonInstances.productId))
        .where(and(eq(addonInstances.ownerId, args.userId), eq(addonInstances.status, 'ACTIVE')));
    const now = args.ports.clock.now().getTime();

    /** Where an instance lands in this vertical, by the scope type of its anchored version. */
    const placementOf = async (
        instance: AddonInstanceRow,
        scopeType: Awaited<ReturnType<BillingCoveragePorts['addonPolicy']>>['scopeType']
    ): Promise<Placement> => {
        switch (scopeType) {
            case 'USER':
            case 'GLOBAL':
                if (instance.product.compatibleVerticals.includes(args.vertical)) {
                    return { scope: scopeType, target: null };
                }
                return null;
            case 'VERTICAL_SUBSCRIPTION': {
                const [subscription] = await db
                    .select({ vertical: subscriptions.vertical })
                    .from(subscriptions)
                    .where(eq(subscriptions.id, requiredTarget({ instance })))
                    .limit(1);
                if (subscription?.vertical !== args.vertical) return null;
                return { scope: 'VERTICAL', target: null };
            }
            case 'LISTING': {
                const listingId = requiredTarget({ instance });
                const listing = await args.ports.listing({ listingId });
                if (listing.vertical !== args.vertical) return null;
                return { scope: 'LISTING', target: listingId };
            }
            default: {
                const exhaustive: never = scopeType;
                return exhaustive;
            }
        }
    };

    const sources: CoverageSource[] = [];
    for (const instance of rows) {
        const policy = await args.ports.addonPolicy({ addonVersionId: instance.addonVersionId });
        let until: Date | 'NO_KNOWN_DATE';
        switch (policy.validity) {
            case 'FIXED_DAYS':
                if (!instance.endsAt) {
                    inconsistentInstance({
                        instanceId: instance.id,
                        why: 'FIXED_DAYS without ends_at'
                    });
                }
                until = instance.endsAt;
                break;
            case 'WHILE_SUBSCRIPTION_ALIVE':
                until = 'NO_KNOWN_DATE';
                break;
            default: {
                const exhaustive: never = policy.validity;
                until = exhaustive;
            }
        }
        if (until instanceof Date && until.getTime() <= now) continue;
        const placement = await placementOf(instance, policy.scopeType);
        if (!placement) continue;
        sources.push({
            type: 'ADDON',
            reference: { kind: 'ADDON_VERSION', addonVersionId: instance.addonVersionId },
            scope: placement.scope,
            target: placement.target,
            since: instance.startsAt ?? instance.createdAt,
            until,
            charged: null,
            floor: null
        });
    }
    return { sources };
}
