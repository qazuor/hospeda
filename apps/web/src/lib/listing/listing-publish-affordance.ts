/**
 * Resolves the server's publish decision once per listed business vertical.
 * A missing session or failed read always leaves the affordance fail-closed.
 */
import { PublicationStatusEnum } from '@repo/schemas';
import { type PublishVerticalSlug, publishApi } from '@/lib/api/endpoints-protected';
import type { OwnerListingSummaryWithState } from '@/lib/listing/owner-listings';
import { webLogger } from '@/lib/logger';
import {
    type PublishAffordance,
    resolvePublishAffordance,
    UNKNOWN_PUBLISH_AFFORDANCE
} from '@/lib/publish/subscribe-button';

/** API boundary injected by tests; production uses the protected endpoint client. */
type SubscribeDestinationApi = Pick<typeof publishApi, 'subscribeDestination'>;

/**
 * Reads subscribe-destination for each vertical with at least one draft.
 *
 * @param input.listings - The cards rendered by the owner index.
 * @param input.cookieHeader - Authenticated SSR cookie header, if present.
 * @param input.api - Optional endpoint implementation for isolated tests.
 * @returns A per-vertical server-derived affordance map.
 */
export async function resolveListingPublishAffordances({
    listings,
    cookieHeader,
    api = publishApi
}: {
    readonly listings: readonly OwnerListingSummaryWithState[];
    readonly cookieHeader?: string;
    readonly api?: SubscribeDestinationApi;
}): Promise<Map<PublishVerticalSlug, PublishAffordance>> {
    const verticals = [
        ...new Set(
            listings
                .filter((listing) => listing.publicationStatus === PublicationStatusEnum.DRAFT)
                .map((listing) => listing.vertical)
        )
    ];

    const pairs = await Promise.all(
        verticals.map(async (vertical) => {
            if (!cookieHeader) return [vertical, UNKNOWN_PUBLISH_AFFORDANCE] as const;
            try {
                const result = await api.subscribeDestination({ vertical, cookieHeader });
                const affordance = resolvePublishAffordance({ result });
                if (!result.ok) {
                    webLogger.warn('[comercio] subscribe-destination read failed', {
                        vertical,
                        error: result.error
                    });
                }
                return [vertical, affordance] as const;
            } catch (error) {
                webLogger.warn('[comercio] subscribe-destination request failed', {
                    vertical,
                    error: error instanceof Error ? error.message : String(error)
                });
                return [vertical, UNKNOWN_PUBLISH_AFFORDANCE] as const;
            }
        })
    );

    return new Map(pairs);
}
