import type { DrizzleClient } from '@repo/db';
import { addonProducts, eq, subscriptions } from '@repo/db';
import type { AddonScopeType } from './addon-orphanhood';
import type { AddonOrphanhoodPorts } from './addon-orphanhood-ports';

/** Where an addon instance emitted its coverage source, by the anchored scope. */
export async function coverageVerticalsOf(input: {
    readonly tx: DrizzleClient;
    readonly scopeType: AddonScopeType;
    readonly targetId: string | null;
    readonly compatibleVerticals: readonly string[];
    readonly ports: Pick<AddonOrphanhoodPorts, 'listing'>;
}): Promise<readonly string[]> {
    switch (input.scopeType) {
        case 'USER':
        case 'GLOBAL':
            return input.compatibleVerticals;
        case 'VERTICAL_SUBSCRIPTION': {
            if (!input.targetId) return [];
            const [target] = await input.tx
                .select({ vertical: subscriptions.vertical })
                .from(subscriptions)
                .where(eq(subscriptions.id, input.targetId))
                .limit(1);
            return target?.vertical ? [target.vertical] : [];
        }
        case 'LISTING': {
            if (!input.targetId) return [];
            const listing = await input.ports.listing({ listingId: input.targetId });
            return [listing.vertical];
        }
        default: {
            const exhaustive: never = input.scopeType;
            return exhaustive;
        }
    }
}

/** The compatible verticals of the instance's product (USER/GLOBAL emit only there). */
export async function compatibleVerticalsOf(input: {
    readonly tx: DrizzleClient;
    readonly productId: string;
}): Promise<readonly string[]> {
    const [product] = await input.tx
        .select({ compatibleVerticals: addonProducts.compatibleVerticals })
        .from(addonProducts)
        .where(eq(addonProducts.id, input.productId))
        .limit(1);
    return product?.compatibleVerticals ?? [];
}
