import type { TouristVipInheritancePort } from '../../../../src/services/billing/subscription/cancel-inherited-tourist-vip.service.ts';
import { getServiceTestPool } from '../helpers.ts';

/** Test port for fixtures whose scenario has no inherited Tourist VIP. */
export const noTouristVip: TouristVipInheritancePort = { inherits: async () => false };

/** DB-backed test double matching the production title-emitting state predicate. */
export const touristVipInheritanceFromDb: TouristVipInheritancePort = {
    async inherits({ userId }) {
        const result = await getServiceTestPool().query<{ inherits: boolean }>(
            `SELECT EXISTS (
                SELECT 1 FROM subscription s
                JOIN plan_version pv ON pv.id = s.plan_version_id
                WHERE s.user_id = $1 AND s.class = 'PRINCIPAL' AND s.vertical <> 'tourist'
                  AND s.status IN ('ACTIVE', 'GRACE_PERIOD', 'CANCEL_SCHEDULED')
                  AND pv.inherits_tourist_vip = true
            ) AS inherits`,
            [userId]
        );
        return result.rows[0]?.inherits === true;
    }
};
