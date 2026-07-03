import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { beforeAll, describe, expect, it, vi } from 'vitest';

// Deliberately does NOT set HOSPEDA_MERCADOLIBRE_CLIENT_ID / _REDIRECT_URI,
// simulating an environment where the MercadoLibre OAuth integration has not
// been configured yet — the route must fail loudly (503) instead of silently
// redirecting to an authorization URL with empty client_id/redirect_uri params.
vi.mock('../../../../src/utils/env', async (importOriginal) => {
    const original = await importOriginal<typeof import('../../../../src/utils/env')>();
    original.validateApiEnv();
    return {
        ...original,
        env: {
            ...original.env,
            HOSPEDA_MERCADOLIBRE_CLIENT_ID: undefined,
            HOSPEDA_MERCADOLIBRE_REDIRECT_URI: undefined
        }
    };
});

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}));

import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const USER_ID = '33333333-3333-4333-8333-333333333333';

function buildAdminActor(permissions: PermissionEnum[]): Actor {
    return {
        id: USER_ID,
        role: RoleEnum.ADMIN,
        permissions: [
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.ACCESS_API_ADMIN,
            ...permissions
        ]
    };
}

function actorHeaders(actor: Actor): Record<string, string> {
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        accept: 'application/json',
        'x-mock-actor-id': actor.id,
        'x-mock-actor-role': actor.role,
        'x-mock-actor-permissions': JSON.stringify(actor.permissions)
    };
}

describe('MercadoLibre OAuth authorize route — unconfigured environment (HOS-45 T-011)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    it('returns 503 when HOSPEDA_MERCADOLIBRE_CLIENT_ID / _REDIRECT_URI are unset', async () => {
        const actor = buildAdminActor([PermissionEnum.INTEGRATION_MERCADOLIBRE_MANAGE]);

        const res = await app.request('/api/v1/admin/mercadolibre-oauth/authorize', {
            method: 'GET',
            headers: actorHeaders(actor),
            redirect: 'manual'
        });

        expect(res.status).toBe(503);
    });
});
