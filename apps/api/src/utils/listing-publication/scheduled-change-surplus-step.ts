import { randomUUID } from 'node:crypto';
import type { SurplusStep } from '@repo/service-core';
import { recalculateCoverage } from '../../../../../packages/verticals/src/publication/coverage-recalculation';
import type { PublicationVertical } from '../../../../../packages/verticals/src/publication/publication-types';
import { invalidateEffectiveSetsForUser } from '../effective-set-cache';
import { getListingPublicationPorts } from './ports';

/** Creates the post-commit S38 publication reconciliation adapter. */
export function createScheduledChangeSurplusStep(): SurplusStep {
    return {
        async reconcile({ userId, vertical, keepListingIds }) {
            await invalidateEffectiveSetsForUser(userId);
            await recalculateCoverage({
                ...getListingPublicationPorts(),
                userId,
                vertical: vertical as PublicationVertical,
                keepListingIds: new Set(keepListingIds),
                correlationId: randomUUID()
            });
        }
    };
}
