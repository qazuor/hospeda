import { PermissionEnum, VerticalEnum } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    routeClock,
    routeFake
} from '../billing-subscription/revocation-route-fixtures';
import {
    cleanupPermanentGrantRows,
    grantState,
    seedGrant,
    seedGrantPlan,
    seedGrantUser
} from './grant-fixtures';

let app: ReturnType<typeof initApp>;
const permissions = [
    PermissionEnum.ACCESS_PANEL_ADMIN,
    PermissionEnum.BILLING_GRANT_COMPLIMENTARY
] as const;
const actor = (id: string) => ({ id, role: 'SUPER_ADMIN', permissions });
const post = (path: string, body: Record<string, unknown>, id: string) =>
    app.request(path, {
        method: 'POST',
        headers: actorHeaders(actor(id)),
        body: JSON.stringify(body)
    });

describe('TEST:B9a:11 — API permanent grant floor policy', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
        app = initApp({ clock: routeClock(), paymentProvider: routeFake(routeClock()) });
    });
    afterAll(async () => {
        await cleanupPermanentGrantRows();
        await testDb.teardown();
    });

    it('rejects non-current grant and anchor floors as typed 422 responses', async () => {
        const beneficiary = await seedGrantUser('floor-beneficiary');
        const signer = await seedGrantUser('floor-signer');
        const floor = await seedGrantPlan(VerticalEnum.ACCOMMODATION, { current: false });
        app = initApp({ clock: routeClock(), paymentProvider: routeFake(routeClock()) });
        const grantResponse = await post(
            '/api/v1/admin/billing-permanent-grants',
            {
                beneficiaryUserId: beneficiary,
                reason: 'floor',
                includesAddons: false,
                anchors: [floor]
            },
            signer
        );
        expect(grantResponse.status).toBe(422);
        expect(await grantResponse.json()).toMatchObject({
            error: { code: 'VALIDATION_ERROR', reason: 'PERMANENT_GRANT_FLOOR_NOT_CURRENT' }
        });

        const current = await seedGrantPlan(VerticalEnum.GASTRONOMY);
        const existing = await seedGrant({
            beneficiaryUserId: beneficiary,
            grantedBy: signer,
            anchor: current
        });
        const anchorResponse = await post(
            `/api/v1/admin/billing-permanent-grants/${existing.grantId}/anchors`,
            floor,
            signer
        );
        expect(anchorResponse.status).toBe(422);
        expect(await anchorResponse.json()).toMatchObject({
            error: { code: 'VALIDATION_ERROR', reason: 'PERMANENT_GRANT_FLOOR_NOT_CURRENT' }
        });
        expect((await grantState(beneficiary)).anchors).toHaveLength(1);
    });
});
