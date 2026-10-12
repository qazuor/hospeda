import { listingPurgeModel } from '@repo/db';
import { OccupancySourceEnum } from '@repo/schemas';
import { getCalendarConnectionRevocationPort } from '@repo/service-core';
import type { PurgeAfterCommit } from '../../../../../packages/verticals/src/publication/publication-types';
import { getMediaProvider } from '../../services/media';
import { emitListingPurged } from './listing-purged-emitter';
import { getListingPublicationPorts } from './ports';

/** Production post-commit adapters for PB12 remote deletion and event emission. */
export function getPurgeAfterCommit(): PurgeAfterCommit {
    const { afterCommit } = getListingPublicationPorts();
    return {
        ...afterCommit,
        emitListingPurged: emitListingPurged,
        async deleteRemoteMedia({ vertical, mediaId, publicId }) {
            if (publicId) {
                const provider = getMediaProvider();
                if (!provider) throw new Error('Media provider is unavailable');
                await provider.delete({ publicId });
            }
            await listingPurgeModel.deleteMarkedMedia({ vertical, mediaId });
        },
        async revokeCalendarConnection({ connectionId, accommodationId, provider }) {
            const port = getCalendarConnectionRevocationPort();
            if (!port) throw new Error('Calendar revocation port is unavailable');
            const occupancyProvider = Object.values(OccupancySourceEnum).find(
                (value) => value === provider
            );
            if (!occupancyProvider) throw new Error('Unsupported calendar provider');
            const result = await port.revoke({ accommodationId, provider: occupancyProvider });
            if (result.revoked || provider !== OccupancySourceEnum.GOOGLE_CALENDAR) {
                await listingPurgeModel.deleteMarkedCalendarConnection({ connectionId });
                return;
            }
            throw new Error(result.reason);
        }
    };
}
