import { domainEventModel, getDb, partnerApplicationModel, sql } from '@repo/db';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import * as serviceCore from '@repo/service-core';
import { ServiceError } from '@repo/service-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { getAuth } from '../../../src/lib/auth';
import { claimPartnerOnEmailVerification } from '../../../src/services/partner-application/partner-claim.service';
import { env, validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { actorHeaders, createOwner } from '../listing-publication/publication-routes.helpers';
import {
    createApplicationEmail,
    deleteApplications,
    deletePartners,
    insertPending
} from './partner-application.helpers';

const { sendAppEmail, sentEmails } = vi.hoisted(() => {
    const sent: unknown[] = [];
    return {
        sentEmails: sent,
        sendAppEmail: vi.fn(async (args: unknown) => {
            sent.push(args);
            return { success: true };
        })
    };
});
vi.mock('../../../src/utils/email-sender', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../../src/utils/email-sender')>()),
    sendAppEmail
}));

const app = initApp();
const emails: string[] = [];
const partners: string[] = [];
const users: string[] = [];
const oldEmailApiKey = env.HOSPEDA_EMAIL_API_KEY;
const BODY = { reason: 'Reviewed application', name: 'Claim Test Partner', type: 'business' };
const PERMISSIONS = [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.PARTNER_RESOLVE_APPLICATION];

async function createUser(email: string): Promise<string> {
    const user = await createOwner({ email });
    users.push(user.id);
    return user.id;
}

async function approve(id: string, actorId: string) {
    return app.request(`/api/v1/admin/partner-applications/${id}/approve`, {
        method: 'POST',
        headers: actorHeaders({ id: actorId, role: RoleEnum.ADMIN, permissions: PERMISSIONS }),
        body: JSON.stringify(BODY)
    });
}

async function verificationToken(): Promise<string> {
    await vi.waitFor(() => expect(sendAppEmail).toHaveBeenCalled());
    const args = sentEmails.at(-1) as { readonly react: unknown };
    const verificationUrl = findVerificationUrl(args.react);
    expect(verificationUrl).toBeTruthy();
    const url = new URL(verificationUrl as string, 'http://localhost');
    const token = url.searchParams.get('token');
    expect(token).toBeTruthy();
    return token as string;
}

function findVerificationUrl(element: unknown): string | undefined {
    if (Array.isArray(element)) {
        for (const child of element) {
            const url = findVerificationUrl(child);
            if (url) return url;
        }
        return undefined;
    }
    if (element === null || typeof element !== 'object') return undefined;
    const props = (element as { readonly props?: Record<string, unknown> }).props;
    if (!props) return undefined;
    if (typeof props.verificationUrl === 'string') return props.verificationUrl;
    if (typeof props.href === 'string' && props.href.includes('token=')) return props.href;
    return findVerificationUrl(props.children);
}

async function verify(token: string): Promise<Response> {
    return app.request(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, {
        headers: { 'user-agent': 'pp2-claim-integration-test' }
    });
}

async function expectVerified(response: Response): Promise<void> {
    const body = (await response
        .clone()
        .json()
        .catch(() => ({}))) as {
        readonly code?: string;
        readonly error?: { readonly code?: string };
    };
    const code = body.code ?? body.error?.code ?? 'unknown';
    expect(response.status, `Better Auth verification response: ${response.status} (${code})`).toBe(
        200
    );
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});
beforeEach(() => {
    env.HOSPEDA_EMAIL_API_KEY = 'test-key';
    sendAppEmail.mockClear();
    sentEmails.splice(0);
});
afterEach(async () => {
    env.HOSPEDA_EMAIL_API_KEY = oldEmailApiKey;
    for (const value of emails.splice(0)) await deleteApplications({ email: value });
    await deletePartners({ ids: partners.splice(0) });
    for (const id of users.splice(0)) {
        await getDb().execute(sql`DELETE FROM account WHERE user_id = ${id}::uuid`);
        await getDb().execute(sql`DELETE FROM user_role_audit WHERE user_id = ${id}::uuid`);
        await getDb().execute(sql`DELETE FROM user_role WHERE user_id = ${id}::uuid`);
        await getDb().execute(sql`DELETE FROM users WHERE id = ${id}::uuid`);
    }
    vi.restoreAllMocks();
});
afterAll(async () => testDb.teardown());

describe('TEST:V7:4 claim on email verification', () => {
    it('rolls back the claim event, owner, and role when a later tx operation fails', async () => {
        const email = createApplicationEmail();
        emails.push(email);
        const applicationId = await insertPending({ email });
        const adminId = await createUser(`admin-${crypto.randomUUID()}@example.test`);
        const response = await approve(applicationId, adminId);
        const payload = (await response.json()) as { data: { partnerId: string } };
        const partnerId = payload.data.partnerId;
        partners.push(partnerId);
        const user = await getDb().execute(
            sql`SELECT id FROM users WHERE lower(email) = lower(${email})`
        );
        const userId = String(user.rows[0]?.id);
        users.push(userId);

        const insert = domainEventModel.insert.bind(domainEventModel);
        const eventSpy = vi.spyOn(domainEventModel, 'insert').mockImplementation(async (args) => {
            await insert(args);
            throw new Error('failure after event insert');
        });
        try {
            await expect(claimPartnerOnEmailVerification({ userId, email })).rejects.toThrow(
                'failure after event insert'
            );
            expect(
                (
                    await getDb().execute(
                        sql`SELECT owner_user_id FROM partners WHERE id = ${partnerId}::uuid`
                    )
                ).rows
            ).toEqual([{ owner_user_id: null }]);
            expect(
                (
                    await getDb().execute(
                        sql`SELECT user_id FROM user_role WHERE user_id = ${userId}::uuid AND role = 'PARTNER_OWNER'`
                    )
                ).rows
            ).toEqual([]);
            expect(
                (
                    await getDb().execute(
                        sql`SELECT id FROM domain_event WHERE entity_id = ${partnerId} AND event_type = 'partner.claimed'`
                    )
                ).rows
            ).toEqual([]);
        } finally {
            eventSpy.mockRestore();
        }
    });

    it('serializes two concurrent claims and records one owner and event', async () => {
        const email = createApplicationEmail();
        emails.push(email);
        const applicationId = await insertPending({ email });
        const adminId = await createUser(`admin-${crypto.randomUUID()}@example.test`);
        const response = await approve(applicationId, adminId);
        const payload = (await response.json()) as { data: { partnerId: string } };
        const partnerId = payload.data.partnerId;
        partners.push(partnerId);
        const user = await getDb().execute(
            sql`SELECT id FROM users WHERE lower(email) = lower(${email})`
        );
        const userId = String(user.rows[0]?.id);
        users.push(userId);

        const originalLock =
            partnerApplicationModel.lockPartnerClaimableByCreatedAccount.bind(
                partnerApplicationModel
            );
        let entrants = 0;
        let release: (() => void) | undefined;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        const fallback = setTimeout(() => release?.(), 1000);
        const lockSpy = vi
            .spyOn(partnerApplicationModel, 'lockPartnerClaimableByCreatedAccount')
            .mockImplementation(async (args) => {
                entrants += 1;
                if (entrants === 2) release?.();
                await gate;
                return originalLock(args);
            });
        try {
            const results = await Promise.all([
                claimPartnerOnEmailVerification({ userId, email }),
                claimPartnerOnEmailVerification({ userId, email })
            ]);
            expect(results.filter(({ claimed }) => claimed)).toHaveLength(1);
            expect(
                (
                    await getDb().execute(
                        sql`SELECT owner_user_id FROM partners WHERE id = ${partnerId}::uuid`
                    )
                ).rows
            ).toEqual([{ owner_user_id: userId }]);
            expect(
                (
                    await getDb().execute(
                        sql`SELECT id FROM domain_event WHERE entity_id = ${partnerId} AND event_type = 'partner.claimed'`
                    )
                ).rows
            ).toHaveLength(1);
        } finally {
            clearTimeout(fallback);
            lockSpy.mockRestore();
        }
    });

    it('does not overwrite an owner set before verification', async () => {
        const email = createApplicationEmail();
        emails.push(email);
        const applicationId = await insertPending({ email });
        const adminId = await createUser(`admin-${crypto.randomUUID()}@example.test`);
        const response = await approve(applicationId, adminId);
        const payload = (await response.json()) as { data: { partnerId: string } };
        const partnerId = payload.data.partnerId;
        partners.push(partnerId);
        const applicant = await getDb().execute(
            sql`SELECT id FROM users WHERE lower(email) = lower(${email})`
        );
        const applicantId = String(applicant.rows[0]?.id);
        users.push(applicantId);
        const existingOwnerId = await createUser(`owner-${crypto.randomUUID()}@example.test`);
        await getDb().execute(
            sql`UPDATE partners SET owner_user_id = ${existingOwnerId}::uuid WHERE id = ${partnerId}::uuid`
        );
        const seededOwner = await getDb().execute(
            sql`SELECT owner_user_id FROM partners WHERE id = ${partnerId}::uuid`
        );
        expect(seededOwner.rows).toEqual([{ owner_user_id: existingOwnerId }]);

        const token = await verificationToken();
        await expectVerified(await verify(token));
        const owner = await getDb().execute(
            sql`SELECT owner_user_id FROM partners WHERE id = ${partnerId}::uuid`
        );
        expect(owner.rows).toEqual([{ owner_user_id: existingOwnerId }]);
    });

    it('(a,c) creates an unverified account on approval and claims once when the same link verifies it', async () => {
        const email = createApplicationEmail();
        emails.push(email);
        const applicationId = await insertPending({ email });
        const adminId = await createUser(`admin-${crypto.randomUUID()}@example.test`);
        const response = await approve(applicationId, adminId);
        expect(response.status).toBe(200);
        const payload = (await response.json()) as { data: { partnerId: string } };
        const partnerId = payload.data.partnerId;
        partners.push(partnerId);
        const created = await getDb().execute(
            sql`SELECT id, email_verified FROM users WHERE lower(email) = lower(${email})`
        );
        expect(created.rows).toHaveLength(1);
        expect(created.rows[0]?.email_verified).toBe(false);
        const userId = String(created.rows[0]?.id);
        users.push(userId);
        expect(
            (
                await getDb().execute(
                    sql`SELECT user_id FROM user_role WHERE user_id = ${userId}::uuid AND role = 'PARTNER_OWNER'`
                )
            ).rows
        ).toHaveLength(0);
        expect(
            (
                await getDb().execute(
                    sql`SELECT status FROM partner_application WHERE id = ${applicationId}::uuid`
                )
            ).rows
        ).toEqual([{ status: 'APPROVED' }]);
        const approvedEvent = await getDb().execute(
            sql`SELECT changes FROM domain_event WHERE entity_id = ${applicationId} AND event_type = 'partner_application.approved'`
        );
        expect(approvedEvent.rows[0]?.changes).toContainEqual({
            field: 'claim_account_user_id',
            new: userId
        });
        expect(
            (
                await getDb().execute(
                    sql`SELECT id FROM partners WHERE id = ${partnerId}::uuid AND owner_user_id IS NULL`
                )
            ).rows
        ).toHaveLength(1);
        expect(
            (
                await getDb().execute(
                    sql`SELECT status FROM partner_application WHERE id = ${applicationId}::uuid`
                )
            ).rows
        ).toEqual([{ status: 'APPROVED' }]);

        const token = await verificationToken();
        await expectVerified(await verify(token));
        const verified = await getDb().execute(
            sql`SELECT email_verified FROM users WHERE id = ${userId}::uuid`
        );
        expect(verified.rows[0]?.email_verified).toBe(true);
        const owner = await getDb().execute(
            sql`SELECT owner_user_id FROM partners WHERE id = ${partnerId}::uuid`
        );
        expect(owner.rows[0]?.owner_user_id).toBe(userId);
        const role = await getDb().execute(
            sql`SELECT grant_reason FROM user_role WHERE user_id = ${userId}::uuid AND role = 'PARTNER_OWNER'`
        );
        expect(role.rows).toEqual([{ grant_reason: 'partner_claimed' }]);
        const claimEvents = await getDb().execute(
            sql`SELECT actor_type, actor_id FROM domain_event WHERE entity_type = 'partner' AND entity_id = ${partnerId} AND event_type = 'partner.claimed'`
        );
        expect(claimEvents.rows).toEqual([{ actor_type: 'owner', actor_id: userId }]);
        await verify(token);
        expect(
            (
                await getDb().execute(
                    sql`SELECT id FROM domain_event WHERE entity_id = ${partnerId} AND event_type = 'partner.claimed'`
                )
            ).rows
        ).toHaveLength(1);
    });

    it('(b) verifies an occupant account without claiming the Partner', async () => {
        const email = createApplicationEmail();
        emails.push(email);
        const occupantId = await createUser(email);
        await getDb().execute(
            sql`UPDATE users SET email_verified = false WHERE id = ${occupantId}::uuid`
        );
        const applicationId = await insertPending({ email });
        const adminId = await createUser(`admin-${crypto.randomUUID()}@example.test`);
        const response = await approve(applicationId, adminId);
        expect(response.status).toBe(200);
        const payload = (await response.json()) as { data: { partnerId: string } };
        const partnerId = payload.data.partnerId;
        partners.push(partnerId);
        expect(
            (await getDb().execute(sql`SELECT id FROM users WHERE lower(email) = lower(${email})`))
                .rows
        ).toHaveLength(1);
        expect(
            (
                await getDb().execute(
                    sql`SELECT changes FROM domain_event WHERE entity_id = ${applicationId} AND event_type = 'partner_application.approved' AND changes @> '[{"field":"claim_account_user_id"}]'::jsonb`
                )
            ).rows
        ).toHaveLength(0);
        await getAuth().api.sendVerificationEmail({ body: { email } });
        const token = await verificationToken();
        await expectVerified(await verify(token));
        const verified = await getDb().execute(
            sql`SELECT email_verified FROM users WHERE id = ${occupantId}::uuid`
        );
        expect(verified.rows[0]?.email_verified).toBe(true);
        expect(
            (
                await getDb().execute(
                    sql`SELECT id FROM partners WHERE id = ${partnerId}::uuid AND owner_user_id IS NULL`
                )
            ).rows
        ).toHaveLength(1);
        expect(
            (
                await getDb().execute(
                    sql`SELECT user_id FROM user_role WHERE user_id = ${occupantId}::uuid AND role = 'PARTNER_OWNER'`
                )
            ).rows
        ).toHaveLength(0);
        expect(
            (
                await getDb().execute(
                    sql`SELECT id FROM domain_event WHERE entity_id = ${partnerId} AND event_type = 'partner.claimed'`
                )
            ).rows
        ).toHaveLength(0);
    });

    it('(d) deletes the created account when the approval transaction fails', async () => {
        const email = createApplicationEmail();
        emails.push(email);
        const applicationId = await insertPending({ email });
        const adminId = await createUser(`admin-${crypto.randomUUID()}@example.test`);
        vi.spyOn(partnerApplicationModel, 'markApproved').mockRejectedValueOnce(
            new Error('forced approval failure')
        );
        const response = await approve(applicationId, adminId);
        expect(response.status).toBeGreaterThanOrEqual(500);
        const application = await getDb().execute(
            sql`SELECT status, partner_id FROM partner_application WHERE id = ${applicationId}::uuid`
        );
        expect(application.rows).toEqual([{ status: 'PENDING', partner_id: null }]);
        expect(
            (await getDb().execute(sql`SELECT id FROM users WHERE lower(email) = lower(${email})`))
                .rows
        ).toHaveLength(0);
        expect(
            (
                await getDb().execute(
                    sql`SELECT id FROM partners WHERE created_by_id = ${adminId}::uuid AND name = ${BODY.name}`
                )
            ).rows
        ).toHaveLength(0);
    });

    it('(e) leaves email unverified after a failed claim and retries the same link successfully', async () => {
        const email = createApplicationEmail();
        emails.push(email);
        const applicationId = await insertPending({ email });
        const adminId = await createUser(`admin-${crypto.randomUUID()}@example.test`);
        const response = await approve(applicationId, adminId);
        expect(response.status).toBe(200);
        const payload = (await response.json()) as { data: { partnerId: string } };
        const partnerId = payload.data.partnerId;
        partners.push(partnerId);
        const created = await getDb().execute(
            sql`SELECT id, email_verified FROM users WHERE lower(email) = lower(${email})`
        );
        expect(created.rows).toHaveLength(1);
        const userId = String(created.rows[0]?.id);
        users.push(userId);
        const token = await verificationToken();
        vi.spyOn(serviceCore, 'grantRole').mockResolvedValueOnce({
            error: new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'forced role grant failure')
        });
        const rejectedVerification = await verify(token);
        expect(rejectedVerification.status).toBeGreaterThanOrEqual(400);
        const failed = await getDb().execute(
            sql`SELECT email_verified FROM users WHERE id = ${userId}::uuid`
        );
        expect(failed.rows[0]?.email_verified).toBe(false);
        const unclaimed = await getDb().execute(
            sql`SELECT owner_user_id FROM partners WHERE id = ${partnerId}::uuid`
        );
        expect(unclaimed.rows[0]?.owner_user_id).toBeNull();
        vi.restoreAllMocks();
        await expectVerified(await verify(token));
        const retried = await getDb().execute(
            sql`SELECT email_verified FROM users WHERE id = ${userId}::uuid`
        );
        expect(retried.rows[0]?.email_verified).toBe(true);
        expect(
            (
                await getDb().execute(
                    sql`SELECT owner_user_id FROM partners WHERE id = ${partnerId}::uuid`
                )
            ).rows[0]?.owner_user_id
        ).toBe(userId);
    });
});
