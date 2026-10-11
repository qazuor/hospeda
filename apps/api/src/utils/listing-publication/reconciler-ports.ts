import { getDb, listingPublicationModel, planCatalogModel } from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import {
    type EffectiveSetSnapshot,
    type ReconcilerPorts,
    rehydrateEffectiveSet,
    resolveEffectiveSet
} from '@repo/verticals';
import type { PublicationVertical } from '../../../../../packages/verticals/src/publication/publication-types';
import { PUBLICATION_LIMIT_KEYS } from '../../../../../packages/verticals/src/publication/publication-types';
import { getClock } from '../clock';
import { pingCronMonitor } from '../cron-heartbeat';
import { invalidateEffectiveSetsForUser, peekEffectiveSetForUser } from '../effective-set-cache';
import { createBootstrapCoverageReader } from '../listing-access/bootstrap-coverage-reader';
import { getListingAccessPorts } from '../listing-access/ports';
import { getListingPublicationPorts } from './ports';

/** Builds live DB, billing, cache, and monitor ports for the daily reconciler. */
export function getListingReconcilerPorts(): ReconcilerPorts {
    const access = getListingAccessPorts();
    const trials = createBootstrapCoverageReader();
    const liveSet = async (userId: string, vertical: VerticalEnum) =>
        rehydrateEffectiveSet({
            version: 1,
            ...(await resolveEffectiveSet({
                reader: planCatalogModel,
                billing: access.billing,
                trials,
                userId,
                vertical
            }))
        } satisfies EffectiveSetSnapshot);
    const liveLimit = async ({
        userId,
        vertical
    }: {
        readonly userId: string;
        readonly vertical: PublicationVertical;
    }) => {
        const set = await liveSet(userId, vertical);
        return set.limits.get({ key: PUBLICATION_LIMIT_KEYS[vertical], userId, vertical }) ?? null;
    };
    const publication = getListingPublicationPorts({ liveLimit });
    return {
        ...publication,
        population: {
            async listOwnerVerticals(input) {
                return getDb().transaction((tx) =>
                    listingPublicationModel.listReconcilerPopulation({ ...input, tx })
                );
            },
            async listPartnerUsers(input) {
                return getDb().transaction((tx) =>
                    listingPublicationModel.listPartnerPresenceUsers({ ...input, tx })
                );
            }
        },
        reader: {
            async summarize(input) {
                return getDb().transaction((tx) =>
                    listingPublicationModel.summarizeOwnerListings({
                        ...input,
                        ownerId: input.userId,
                        tx
                    })
                );
            }
        },
        liveLimit,
        presence: {
            async liveKeys({ userId }) {
                const set = await liveSet(userId, VerticalEnum.PARTNER);
                return (['partner_public_page', 'partner_carousel_presence'] as const).filter(
                    (key) =>
                        set.entitlements.get({ key, userId, vertical: VerticalEnum.PARTNER }) !==
                        undefined
                );
            },
            async cachedKeys({ userId }) {
                const rawSnapshot = await peekEffectiveSetForUser({
                    userId,
                    vertical: VerticalEnum.PARTNER
                });
                const snapshot = rawSnapshot as EffectiveSetSnapshot | undefined;
                if (
                    !snapshot ||
                    snapshot.userId !== userId ||
                    snapshot.vertical !== VerticalEnum.PARTNER
                )
                    return null;
                const set = rehydrateEffectiveSet(snapshot);
                return (['partner_public_page', 'partner_carousel_presence'] as const).filter(
                    (key) =>
                        set.entitlements.get({ key, userId, vertical: VerticalEnum.PARTNER }) !==
                        undefined
                );
            },
            invalidate: async ({ userId }) => invalidateEffectiveSetsForUser(userId)
        },
        monitor: { ping: pingCronMonitor },
        clock: getClock().clock
    };
}
