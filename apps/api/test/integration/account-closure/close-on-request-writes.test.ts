/**
 * TEST:V8a:13 (HOS-1494, AC:V8a:11) — what administrative action 24 writes,
 * through its route and against a real PostgreSQL: the `users` row is
 * pseudonymised with `deleted_at` and `deleted_by_id`, its `account` and
 * `session` rows are gone, the partner application carrying its mailbox gets a
 * pseudonym, the trigger deletes the bookmarks OTHER accounts saved on it, the
 * `trial` row is untouched, the audit event names fields and never old values,
 * the audit events written before the closure keep their actor and subject ids,
 * the account can no longer sign in (H19), and the two mails enqueued BEFORE the
 * closure still leave to the real address while one enqueued after is
 * suppressed as `account_deleted` (the outbox part mirrors TEST:U2:2).
 */
import {
    buildEmailDedupKey,
    domainEventModel,
    emailOutbox,
    emailOutboxModel,
    getDb,
    notificationLog,
    notificationLogModel,
    sql
} from '@repo/db';
import {
    type EmailTransport,
    OUTBOX_LAST_ERROR_MARKERS,
    processEmailOutboxBatch
} from '@repo/notifications';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { inArray } from 'drizzle-orm';
import type { ReactElement } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { isUserSoftDeleted } from '../../../src/lib/auth-deleted-user-guard';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { actorHeaders, createOwner } from '../listing-publication/publication-routes.helpers';

const app = initApp();
const REASON = 'Juan pidió por correo que demos de baja su cuenta';
const createdUsers: string[] = [];
const createdApplications: string[] = [];
const createdDedupKeys: string[] = [];
const createdRecipients: string[] = [];

async function rows(query: ReturnType<typeof sql>) {
    return (await getDb().execute(query)).rows;
}

async function enqueuePurgedMail(input: { readonly userId: string; readonly email: string }) {
    const dedupKey = buildEmailDedupKey({
        recipient: input.userId,
        template: 'verticals.listing-purged',
        occurrence: `event:${crypto.randomUUID()}`
    });
    createdDedupKeys.push(dedupKey);
    const { row } = await emailOutboxModel.enqueue({
        recipientUserId: input.userId,
        recipientEmail: input.email,
        template: 'verticals.listing-purged',
        dedupKey
    });
    if (!row) throw new Error('enqueue wrote no row');
    return row;
}

async function runSender(send: EmailTransport['send']) {
    return processEmailOutboxBatch({
        deps: {
            outbox: emailOutboxModel,
            log: notificationLogModel,
            isOptedOut: async () => false,
            render: () => ({ subject: 's', react: {} as ReactElement }),
            transport: { send },
            escalate: vi.fn(),
            onRowError: vi.fn(),
            onRetry: vi.fn(),
            onLeaseLost: vi.fn()
        },
        owner: 'v8a-13-it',
        now: new Date(),
        leaseMs: 300_000,
        batchSize: 1000
    });
}

async function seedJuan() {
    const suffix = crypto.randomUUID();
    const email = `juan.perez-${suffix}@example.com`;
    const phone = '+5493442111111';
    const [juan] = await rows(sql`
        INSERT INTO users (email, display_name, first_name, last_name, slug, email_verified,
                           lifecycle_state, contact_info)
        VALUES (${email}, 'Juan Pérez', 'Juan', 'Pérez', ${`juan-perez-${suffix.slice(0, 8)}`},
                true, 'ACTIVE', ${JSON.stringify({ mobilePhone: phone, website: 'https://juan.example.com' })}::jsonb)
        RETURNING id`);
    const juanId = String(juan?.id);
    createdUsers.push(juanId);
    createdRecipients.push(email);
    const other = await createOwner();
    createdUsers.push(other.id);
    await getDb().execute(sql`INSERT INTO account (id, account_id, provider_id, user_id, password)
        VALUES (${crypto.randomUUID()}, ${juanId}, 'credential', ${juanId}, 'hash')`);
    await getDb().execute(sql`INSERT INTO account (id, account_id, provider_id, user_id)
        VALUES (${crypto.randomUUID()}, ${`google-${suffix}`}, 'google', ${juanId})`);
    for (let index = 0; index < 2; index += 1) {
        await getDb().execute(sql`INSERT INTO session (id, expires_at, token, user_id)
            VALUES (${crypto.randomUUID()}, now() + interval '1 day', ${crypto.randomUUID()}, ${juanId})`);
    }
    const [application] = await rows(
        sql`INSERT INTO partner_application (email, status) VALUES (${email}, 'PENDING') RETURNING id`
    );
    createdApplications.push(String(application?.id));
    const [foreign] = await rows(sql`INSERT INTO user_bookmarks (user_id, entity_id, entity_type)
        VALUES (${other.id}, ${juanId}, 'USER') RETURNING id`);
    const [own] = await rows(sql`INSERT INTO user_bookmarks (user_id, entity_id, entity_type)
        VALUES (${juanId}, ${other.id}, 'USER') RETURNING id`);
    const pseudonym = crypto.randomUUID().replaceAll('-', '').padEnd(64, '0').slice(0, 64);
    await getDb().execute(sql`INSERT INTO trial (user_id, vertical, status, email_pseudonym)
        VALUES (${juanId}, 'accommodation', 'TRIAL_CONVERTED', ${pseudonym})`);
    return {
        juanId,
        email,
        phone,
        applicationId: String(application?.id),
        foreignBookmarkId: String(foreign?.id),
        ownBookmarkId: String(own?.id)
    };
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});
afterEach(async () => {
    const db = getDb();
    if (createdRecipients.length > 0) {
        await db
            .delete(notificationLog)
            .where(inArray(notificationLog.recipient, createdRecipients.splice(0)));
    }
    if (createdDedupKeys.length > 0) {
        await db
            .delete(emailOutbox)
            .where(inArray(emailOutbox.dedupKey, createdDedupKeys.splice(0)));
    }
    for (const id of createdApplications.splice(0)) {
        await db.execute(sql`DELETE FROM partner_application WHERE id = ${id}::uuid`);
    }
    const users = createdUsers.splice(0);
    await db.transaction(async (tx) => {
        // `trial` rejects every DELETE by trigger (extras/042): only a replica session skips it.
        await tx.execute(sql`SET LOCAL session_replication_role = 'replica'`);
        for (const id of users) {
            await tx.execute(sql`DELETE FROM trial WHERE user_id = ${id}::uuid`);
            await tx.execute(
                sql`DELETE FROM user_bookmarks WHERE user_id = ${id}::uuid OR entity_id = ${id}::uuid`
            );
            await tx.execute(sql`DELETE FROM session WHERE user_id = ${id}::uuid`);
            await tx.execute(sql`DELETE FROM account WHERE user_id = ${id}::uuid`);
            await tx.execute(sql`DELETE FROM users WHERE id = ${id}::uuid`);
        }
    });
});
afterAll(async () => testDb.teardown());

describe('TEST:V8a:13 what action 24 writes', () => {
    it('pseudonymises the account in one transaction and touches nothing it must keep', async () => {
        // Arrange
        const juan = await seedJuan();
        const { id: adminId } = await createOwner();
        createdUsers.push(adminId);
        const priorActorEvent = await domainEventModel.insert({
            eventType: 'listing.edited',
            entityType: 'accommodation',
            entityId: crypto.randomUUID(),
            actorType: 'owner',
            actorId: juan.juanId,
            changes: [{ field: 'description' }],
            correlationId: crypto.randomUUID()
        });
        const priorSubjectEvent = await domainEventModel.insert({
            eventType: 'trial.extended',
            entityType: 'user',
            entityId: juan.juanId,
            actorType: 'admin',
            actorId: adminId,
            changes: [{ field: 'endsAt' }],
            correlationId: crypto.randomUUID()
        });
        const priorAuditRows = await rows(sql`SELECT * FROM domain_event
            WHERE id IN (${priorActorEvent.id}::uuid, ${priorSubjectEvent.id}::uuid)
            ORDER BY id`);
        const trialBefore = await rows(
            sql`SELECT * FROM trial WHERE user_id = ${juan.juanId}::uuid`
        );
        const queued = [
            await enqueuePurgedMail({ userId: juan.juanId, email: juan.email }),
            await enqueuePurgedMail({ userId: juan.juanId, email: juan.email })
        ];

        // Act
        const response = await app.request(`/api/v1/admin/users/${juan.juanId}/close-on-request`, {
            method: 'POST',
            headers: actorHeaders({
                id: adminId,
                role: RoleEnum.ADMIN,
                permissions: [
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.USER_CLOSE_ON_REQUEST
                ]
            }),
            body: JSON.stringify({ reason: REASON })
        });

        // Assert: the response and the account row
        expect(response.status).toBe(200);
        expect((await response.json()).data).toEqual({ closed: true });
        const [user] = await rows(sql`SELECT email, display_name, first_name, last_name, slug,
                contact_info, deleted_at, deleted_by_id FROM users WHERE id = ${juan.juanId}::uuid`);
        expect(user?.email).toBe(`deleted-${juan.juanId}@pseudonym.invalid`);
        expect(user?.display_name).toBe('deleted-user');
        expect(user?.first_name).toBeNull();
        expect(user?.last_name).toBeNull();
        expect(String(user?.slug)).not.toContain('juan');
        expect(JSON.stringify(user?.contact_info)).not.toContain(juan.phone);
        expect(user?.deleted_at).not.toBeNull();
        expect(user?.deleted_by_id).toBe(adminId);

        // credentials, sessions, the application, the bookmarks and the trial
        expect(
            await rows(sql`SELECT id FROM account WHERE user_id = ${juan.juanId}::uuid`)
        ).toEqual([]);
        expect(
            await rows(sql`SELECT id FROM session WHERE user_id = ${juan.juanId}::uuid`)
        ).toEqual([]);
        const [application] = await rows(
            sql`SELECT email, status FROM partner_application WHERE id = ${juan.applicationId}::uuid`
        );
        expect(application).toEqual({
            email: `deleted-application-${juan.applicationId}@pseudonym.invalid`,
            status: 'PENDING'
        });
        const bookmarks = await rows(sql`SELECT id FROM user_bookmarks
            WHERE id IN (${juan.foreignBookmarkId}::uuid, ${juan.ownBookmarkId}::uuid)`);
        expect(bookmarks.map((row) => String(row.id))).toEqual([juan.ownBookmarkId]);
        expect(await rows(sql`SELECT * FROM trial WHERE user_id = ${juan.juanId}::uuid`)).toEqual(
            trialBefore
        );

        // the audit events: names only, never an old personal value
        const [event] = await rows(sql`SELECT actor_type, actor_id, reason, changes, correlation_id
            FROM domain_event WHERE event_type = 'account.closed_on_request' AND entity_id = ${juan.juanId}`);
        expect(event).toMatchObject({ actor_type: 'admin', actor_id: adminId, reason: REASON });
        const changes = JSON.stringify(event?.changes);
        expect(changes).not.toContain(juan.email);
        expect(changes).not.toContain('Juan');
        expect(changes).not.toContain('Pérez');
        expect(changes).not.toContain(juan.phone);
        const replaced = await rows(sql`SELECT actor_type, reason, correlation_id, changes
            FROM domain_event WHERE event_type = 'partner_application.email_replaced'
              AND entity_id = ${juan.applicationId}`);
        expect(replaced).toEqual([
            {
                actor_type: 'admin',
                reason: REASON,
                correlation_id: event?.correlation_id,
                changes: [{ field: 'email' }]
            }
        ]);

        // the audit trail written before the closure is untouched: actor and subject stay by id
        const priorAuditAfter = await rows(sql`SELECT * FROM domain_event
            WHERE id IN (${priorActorEvent.id}::uuid, ${priorSubjectEvent.id}::uuid)
            ORDER BY id`);
        expect(priorAuditAfter).toEqual(priorAuditRows);
        expect(priorAuditAfter.find((row) => row.id === priorActorEvent.id)?.actor_id).toBe(
            juan.juanId
        );
        expect(priorAuditAfter.find((row) => row.id === priorSubjectEvent.id)?.entity_id).toBe(
            juan.juanId
        );

        // no session can be born on the account (H19)
        expect(await isUserSoftDeleted({ userId: juan.juanId })).toBe(true);

        // the mails enqueued before leave to the real address; one enqueued after is suppressed
        await new Promise((resolve) => setTimeout(resolve, 20));
        const after = await enqueuePurgedMail({
            userId: juan.juanId,
            email: `deleted-${juan.juanId}@pseudonym.invalid`
        });
        createdRecipients.push(`deleted-${juan.juanId}@pseudonym.invalid`);
        const send = vi.fn<EmailTransport['send']>(async () => ({
            messageId: `msg-${crypto.randomUUID()}`
        }));
        await runSender(send);
        const toJuan = send.mock.calls
            .map(([mail]) => mail.to)
            .filter((to) => to === juan.email || String(to).includes(juan.juanId));
        expect(toJuan).toEqual([juan.email, juan.email]);
        const outbox = await getDb()
            .select()
            .from(emailOutbox)
            .where(inArray(emailOutbox.id, [...queued.map((row) => row.id), after.id]));
        const status = new Map(outbox.map((row) => [row.id, row]));
        expect(queued.map((row) => status.get(row.id)?.status)).toEqual(['sent', 'sent']);
        expect(status.get(after.id)?.status).toBe('failed');
        expect(status.get(after.id)?.lastError).toBe(OUTBOX_LAST_ERROR_MARKERS.ACCOUNT_DELETED);
    });
});
