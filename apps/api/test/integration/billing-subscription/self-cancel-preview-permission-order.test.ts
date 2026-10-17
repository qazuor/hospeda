import { PermissionEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import * as subscriptionReader from '../../../src/routes/billing-subscription/read-subscription';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    retireSelfCancelRows,
    routeClock,
    routeFake,
    seedSelfState
} from './self-cancel-fixtures';

const clock = routeClock();
const fake = routeFake(clock);
let app: ReturnType<typeof initApp>;
const previewPath = (id: string) =>
    `/api/v1/protected/billing-subscription/${id}/cancellation-preview`;
const deniedHeaders = actorHeaders({
    id: '8c49603b-f3af-4fb0-9859-7a1e8cb6d3cb',
    role: 'USER',
    permissions: []
});

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    app = initApp({ clock, paymentProvider: fake });
});
beforeEach(() => {
    vi.restoreAllMocks();
});
afterEach(async () => {
    await retireSelfCancelRows();
});
afterAll(async () => {
    await retireSelfCancelRows();
    await testDb.teardown();
});

describe('TEST:1617:11 cancellation preview permission order', () => {
    it('answers 401 before permission checks without a session', async () => {
        const response = await app.request(previewPath('8c49603b-f3af-4fb0-9859-7a1e8cb6d3cc'), {
            headers: actorHeaders()
        });
        expect(response.status, await response.clone().text()).toBe(401);
    });

    it('answers 403 before validating a malformed id when permission is absent', async () => {
        const response = await app.request(previewPath('not-a-uuid'), { headers: deniedHeaders });
        expect(response.status).toBe(403);
    });

    it('answers 403 before reading an owned subscription when permission is absent', async () => {
        const readSpy = vi.spyOn(subscriptionReader, 'readSubscription');
        const response = await app.request(previewPath('8c49603b-f3af-4fb0-9859-7a1e8cb6d3cc'), {
            headers: deniedHeaders
        });
        expect(response.status).toBe(403);
        expect(readSpy).not.toHaveBeenCalled();
    });

    it('answers 400 for a malformed id after permission succeeds', async () => {
        const headers = actorHeaders({
            id: '8c49603b-f3af-4fb0-9859-7a1e8cb6d3cb',
            role: 'USER',
            permissions: [PermissionEnum.BILLING_VIEW_OWN]
        });
        const response = await app.request(previewPath('not-a-uuid'), { headers });
        expect(response.status).toBe(400);
    });

    it('answers 404 for a well-formed id that is not owned', async () => {
        const foreign = await seedSelfState('ACTIVE');
        const headers = actorHeaders({
            id: '8c49603b-f3af-4fb0-9859-7a1e8cb6d3cb',
            role: 'USER',
            permissions: [PermissionEnum.BILLING_VIEW_OWN]
        });
        const response = await app.request(previewPath(foreign.subscriptionId), { headers });
        expect(response.status).toBe(404);
    });
});
