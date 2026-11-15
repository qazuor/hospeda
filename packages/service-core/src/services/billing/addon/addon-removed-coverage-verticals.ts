import type { DrizzleClient } from '@repo/db';
import { addonVersions, eq, subscriptions } from '@repo/db';
import { compatibleVerticalsOf, coverageVerticalsOf } from './addon-coverage-verticals';
import type { AddonOrphanhoodPorts } from './addon-orphanhood-ports';

/** Finds verticals for a removed source, including a listing whose row was deleted. */
export async function removedCoverageVerticalsOf(input: {
    readonly tx: DrizzleClient;
    readonly instance: {
        readonly addonVersionId: string;
        readonly productId: string;
        readonly targetId: string | null;
        readonly complementSubscriptionId: string | null;
    };
    readonly ports: Pick<AddonOrphanhoodPorts, 'listing'>;
}): Promise<readonly string[]> {
    const { tx, instance, ports } = input;
    const [version] = await tx
        .select({ scopeType: addonVersions.scopeType })
        .from(addonVersions)
        .where(eq(addonVersions.id, instance.addonVersionId))
        .limit(1);
    if (!version) throw new Error('Addon version missing for coverage removal');
    const compatibleVerticals = await compatibleVerticalsOf({ tx, productId: instance.productId });
    try {
        return await coverageVerticalsOf({
            tx,
            scopeType: version.scopeType,
            targetId: instance.targetId,
            compatibleVerticals,
            ports
        });
    } catch (error) {
        if (!(error instanceof Error && error.name === 'ListingNotFoundError')) throw error;
        if (instance.complementSubscriptionId) {
            const [complement] = await tx
                .select({ vertical: subscriptions.vertical })
                .from(subscriptions)
                .where(eq(subscriptions.id, instance.complementSubscriptionId))
                .limit(1);
            if (complement?.vertical) return [complement.vertical];
        }
        return compatibleVerticals;
    }
}
