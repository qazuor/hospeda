/**
 * Protected endpoints behind the venue and experience owner dashboards
 * (HOS-2475, HOS-2476).
 *
 * One aggregate read per dashboard (HOS-2414 Q2): listings by publication
 * state plus the traffic total when the plan grants it. Kept out of
 * `endpoints-protected.ts`, which is far over the 500-line limit.
 *
 * @module lib/api/endpoints-protected-dashboards
 */

import type {
    OwnerDashboardVertical,
    OwnerDashboardWindow,
    OwnerListingDashboard
} from '@repo/schemas';
import { apiClient } from './client';
import type { ApiResult } from './types';

const PROTECTED = '/api/v1/protected';

/** Path segment of each owner dashboard vertical. */
const VERTICAL_PATH: Readonly<Record<OwnerDashboardVertical, 'venues' | 'experiences'>> = {
    venue: 'venues',
    experience: 'experiences'
};

/** The owner dashboards' aggregate reads. */
export const ownerDashboardApi = {
    /**
     * Read one vertical's dashboard aggregate for the signed-in owner.
     *
     * @param input - `{ vertical, window }`; `window` defaults to `30d`.
     * @returns Listings by state, `trafficAccess` and, when granted, `traffic`.
     * @example const result = await ownerDashboardApi.getStats({ vertical: 'venue' });
     */
    getStats({
        vertical,
        window = '30d'
    }: {
        readonly vertical: OwnerDashboardVertical;
        readonly window?: OwnerDashboardWindow;
    }): Promise<ApiResult<OwnerListingDashboard>> {
        return apiClient.getProtected({
            path: `${PROTECTED}/${VERTICAL_PATH[vertical]}/mine/stats`,
            params: { window }
        });
    }
};
