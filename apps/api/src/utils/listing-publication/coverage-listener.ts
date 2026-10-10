import { randomUUID } from 'node:crypto';
import { VerticalEnum } from '@repo/schemas';
import { recalculateCoverage } from '../../../../../packages/verticals/src/publication/coverage-recalculation';
import { getListingAccessPorts } from '../listing-access/ports';
import { apiLogger } from '../logger';
import { getListingPublicationPorts } from './ports';

let unsubscribe: (() => void) | undefined;

/** Registers the process-wide billing notice consumer once; the returned closure tears it down. */
export function subscribeListingCoverageRecalculation(): () => void {
    if (unsubscribe) return () => unsubscribe?.();
    unsubscribe = getListingAccessPorts().billing.onCoverageChanged((event) => {
        if (
            event.vertical !== VerticalEnum.ACCOMMODATION &&
            event.vertical !== VerticalEnum.GASTRONOMY &&
            event.vertical !== VerticalEnum.EXPERIENCE
        )
            return;
        void (async () => {
            try {
                await recalculateCoverage({
                    ...getListingPublicationPorts(),
                    userId: event.userId,
                    vertical:
                        event.vertical as import('../../../../../packages/verticals/src/publication/publication-types').PublicationVertical,
                    correlationId: randomUUID()
                });
            } catch (error) {
                apiLogger.error(
                    { error, userId: event.userId, vertical: event.vertical },
                    'Coverage change reconciliation failed'
                );
            }
        })();
    });
    return () => {
        unsubscribe?.();
        unsubscribe = undefined;
    };
}
