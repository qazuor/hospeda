/**
 * @file v8b-pp1-unverified-session.test.ts
 * @description AC:V8b:5 TEST:V8b:5 — PP1 rejects an unverified account without writing an application.
 */

import { randomUUID } from 'node:crypto';
import { getDb, sql } from '@repo/db';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { Hono } from 'hono';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { publicSubmitPartnerApplicationRoute } from '../../../src/routes/partner-application/public/submit';
import type { AppBindings } from '../../../src/types';
import { createGuestActor } from '../../../src/utils/actor';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    createApplicationEmail,
    deleteApplications,
    readApplications
} from './partner-application.helpers';

const turnstileMocks = vi.hoisted(() => ({
    getTurnstileSecret: vi.fn(),
    verifyCfTurnstileToken: vi.fn()
}));

vi.mock('../../../src/utils/turnstile', () => ({
    getTurnstileSecret: turnstileMocks.getTurnstileSecret,
    verifyCfTurnstileToken: turnstileMocks.verifyCfTurnstileToken
}));

const testEmails: string[] = [];

function rememberEmail(): string {
    const email = createApplicationEmail();
    testEmails.push(email);
    return email;
}

function createAccountActor({ emailVerified }: { readonly emailVerified: boolean }): Actor {
    return {
        id: randomUUID(),
        roles: [RoleEnum.USER],
        permissions: [PermissionEnum.ACCESS_API_PUBLIC],
        emailVerified
    };
}

function buildApp(actor: Actor) {
    const app = new Hono<AppBindings>();
    app.use((context, next) => {
        context.set('actor', actor);
        return next();
    });
    app.route('/', publicSubmitPartnerApplicationRoute);
    return app;
}

async function postApplication(actor: Actor, body: unknown) {
    const response = await buildApp(actor).request('/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
    });
    return { response, body: await response.json() };
}

beforeAll(async () => {
    await testDb.setup();
    validateApiEnv();
});

beforeEach(() => {
    turnstileMocks.getTurnstileSecret.mockReset().mockReturnValue('test-secret');
    turnstileMocks.verifyCfTurnstileToken.mockReset().mockResolvedValue({ success: true });
});

afterEach(async () => {
    for (const email of testEmails.splice(0)) await deleteApplications({ email });
});

afterAll(async () => testDb.teardown());

describe('AC:V8b:5 TEST:V8b:5 PP1 with an unverified session', () => {
    it('(a) refuses an unverified account before Turnstile and writes no application', async () => {
        const email = rememberEmail();
        const { response, body } = await postApplication(
            createAccountActor({ emailVerified: false }),
            {
                email,
                cfTurnstileToken: 'valid-token'
            }
        );

        expect(response.status).toBe(403);
        expect(body).toEqual({
            success: false,
            error: {
                code: ServiceErrorCode.EMAIL_NOT_VERIFIED,
                message: 'Email verification required'
            },
            metadata: { timestamp: expect.any(String), requestId: expect.any(String) }
        });
        expect(await readApplications({ email })).toEqual([]);
        const count = await getDb().execute(sql`
            SELECT count(*)::integer AS count
            FROM partner_application
            WHERE lower(email) = lower(${email})`);
        expect(count.rows).toEqual([{ count: 0 }]);
        expect(turnstileMocks.verifyCfTurnstileToken).not.toHaveBeenCalled();
    });

    it('(b) creates one pending application for a verified account', async () => {
        const email = rememberEmail();
        const { response, body } = await postApplication(
            createAccountActor({ emailVerified: true }),
            {
                email,
                cfTurnstileToken: 'valid-token'
            }
        );

        expect(response.status).toBe(201);
        expect(body).toEqual({
            success: true,
            data: { submitted: true },
            metadata: { timestamp: expect.any(String), requestId: expect.any(String) }
        });
        const rows = await readApplications({ email });
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ status: 'PENDING', partner_id: null });
    });

    it('(c) continues to create one pending application for a guest', async () => {
        const email = rememberEmail();
        const { response, body } = await postApplication(createGuestActor(), {
            email,
            cfTurnstileToken: 'valid-token'
        });

        expect(response.status).toBe(201);
        expect(body).toEqual({
            success: true,
            data: { submitted: true },
            metadata: { timestamp: expect.any(String), requestId: expect.any(String) }
        });
        const rows = await readApplications({ email });
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ status: 'PENDING', partner_id: null });
    });

    it('(d) rejects an invalid body before parsing it for an unverified account', async () => {
        const email = rememberEmail();
        const { response, body } = await postApplication(
            createAccountActor({ emailVerified: false }),
            {
                cfTurnstileToken: 'valid-token'
            }
        );

        expect(response.status).toBe(403);
        expect(body).toEqual({
            success: false,
            error: {
                code: ServiceErrorCode.EMAIL_NOT_VERIFIED,
                message: 'Email verification required'
            },
            metadata: { timestamp: expect.any(String), requestId: expect.any(String) }
        });
        expect(await readApplications({ email })).toEqual([]);
    });
});
